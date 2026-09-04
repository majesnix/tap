/// plan_runner: Sequential plan execution commands.
///
/// execute_step — publish a single plan step and optionally wait for a reply.
///   Three response modes:
///   - NoWait: publish and sleep delay_ms, return "done" with no reply.
///   - CorrelationId: consume BEFORE publish; match reply by correlation_id property;
///     NACK non-matching deliveries with requeue; 10s timeout.
///   - FirstArrival: consume BEFORE publish; first delivery wins; 10s timeout.
///
/// cancel_plan_run — cancels the CancellationToken stored in PlanRunState.
///
/// SECURITY: AMQP URI built in tight scope and dropped before any await.
/// correlation_id read from AMQP properties ONLY — not from headers (pitfall #58).
/// tokio::pin!(deadline) placed OUTSIDE the select! loop (pitfall #4).
/// basic_consume called BEFORE basic_publish in reply modes (pitfall #59).
/// Non-matching correlation-id deliveries are NACKed with requeue=true (pitfall #60).
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions,
        BasicQosOptions, ConfirmSelectOptions, QueueDeclareOptions,
    },
    types::FieldTable,
    BasicProperties, Confirmation,
};
use prost_reflect::{DescriptorPool, DynamicMessage};
use tauri::Manager;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::AppError;
use crate::profiles::{consumer_tag, AmqpEndpoint, AMQP_CONNECT_TIMEOUT};

// ─── Limits ──────────────────────────────────────────────────────────────────

/// Longest pause a no-wait step may insert (one minute).
pub(crate) const MAX_STEP_DELAY_MS: u64 = 60_000;
/// Longest time a step may wait for a reply (five minutes).
pub(crate) const MAX_REPLY_TIMEOUT_MS: u64 = 300_000;
/// In-flight cap while waiting on a reply queue.
const REPLY_PREFETCH: u16 = 32;
/// Pause after requeueing an unrelated message on a shared reply queue, so Tap does
/// not spin at wire speed against the broker while it waits for its own reply.
const REQUEUE_BACKOFF: Duration = Duration::from_millis(50);
/// Publisher-confirm budget, matching publish.rs.
const PUBLISH_CONFIRM_TIMEOUT: Duration = Duration::from_secs(5);

/// Reject timings that would park the runner for hours; checked before connecting.
pub(crate) fn validate_step_timings(mode: &ResponseMode) -> Result<(), String> {
    match mode {
        ResponseMode::NoWait { delay_ms } if *delay_ms > MAX_STEP_DELAY_MS => Err(format!(
            "Step delay {} ms exceeds the maximum of {} ms",
            delay_ms, MAX_STEP_DELAY_MS
        )),
        ResponseMode::NoWait { .. } => Ok(()),
        ResponseMode::CorrelationId { timeout_ms, .. }
        | ResponseMode::FirstArrival { timeout_ms, .. } => {
            if *timeout_ms == 0 {
                Err("Reply timeout must be at least 1 ms".to_string())
            } else if *timeout_ms > MAX_REPLY_TIMEOUT_MS {
                Err(format!(
                    "Reply timeout {} ms exceeds the maximum of {} ms",
                    timeout_ms, MAX_REPLY_TIMEOUT_MS
                ))
            } else {
                Ok(())
            }
        }
    }
}

// ─── Managed state ───────────────────────────────────────────────────────────

/// Holds the CancellationToken for an in-progress plan run.
/// Simpler than SubscribeState — no JoinHandle needed because execute_step is
/// directly awaited (not spawned into a background task).
pub struct PlanRunState {
    pub token: CancellationToken,
}

// ─── Input structs ───────────────────────────────────────────────────────────

/// Target for a plan step — either a queue or an exchange + routing key.
/// serde(tag = "kind") matches TS discriminated union { kind: 'queue' | 'exchange' }.
/// rename_all = "lowercase" maps Queue→"queue", Exchange→"exchange".
#[derive(Debug, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum PublishTarget {
    Queue { queue: String },
    Exchange { exchange: String, routing_key: String },
}

/// Response mode for a plan step.
/// serde(tag = "mode", rename_all = "kebab-case") matches TS discriminated union
/// { mode: 'no-wait' | 'correlation-id' | 'first-arrival' }.
#[derive(Debug, serde::Deserialize)]
#[serde(tag = "mode", rename_all = "kebab-case")]
pub enum ResponseMode {
    NoWait { delay_ms: u64 },
    CorrelationId { reply_queue: String, timeout_ms: u64 },
    FirstArrival { reply_queue: String, timeout_ms: u64 },
}

/// A single step within a plan execution.
#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)] // name is deserialized from the IPC payload but not read in Rust logic
pub struct PlanStep {
    pub id: String,
    pub name: String,
    pub proto_path: String,
    pub message_type: String,
    /// JSON-serialized field values — parsed at use-time.
    pub field_values: String,
    pub target: PublishTarget,
    pub response_mode: ResponseMode,
}

// ─── Output structs ──────────────────────────────────────────────────────────

/// Decoded reply from a step's response queue.
/// Fields serialized as camelCase for the TS frontend (ReplyMessageIpc).
/// raw_bytes is internal only and not serialized to JS.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMessage {
    pub routing_key: String,
    pub exchange: String,
    pub content_type: Option<String>,
    pub correlation_id: Option<String>,
    /// Decoded protobuf payload as JSON value — None on decode failure.
    pub decoded: Option<serde_json::Value>,
    /// Set to Some(message_type) on successful decode, None on decode failure.
    pub decoded_as: Option<String>,
    /// Hex encoding of raw reply bytes for display.
    pub hex_string: String,
    // raw_bytes intentionally excluded from serialization — used only for hex_string.
}

/// Result of a single step execution.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub step_id: String,
    /// "done" | "error"
    pub status: String,
    pub reply: Option<ReplyMessage>,
    pub error: Option<String>,
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Cancel an in-progress plan run by flipping the CancellationToken.
/// Synchronous — no async needed.
#[tauri::command]
pub fn cancel_plan_run(
    run_state: tauri::State<'_, Mutex<Option<PlanRunState>>>,
) -> Result<(), AppError> {
    let mut guard = crate::commands::lock_state(&run_state)?;
    if let Some(ref state) = *guard {
        state.token.cancel();
    }
    *guard = None;
    Ok(())
}

/// Execute a single plan step: encode, publish, and optionally wait for a reply.
///
/// Correct parameter order: app FIRST (Tauri 2 convention), then profile_name, step,
/// pool_state, run_state.
#[tauri::command]
pub async fn execute_step(
    app: tauri::AppHandle,
    profile_name: String,
    step: PlanStep,
    pool_state: tauri::State<'_, Mutex<Option<DescriptorPool>>>,
    run_state: tauri::State<'_, Mutex<Option<PlanRunState>>>,
) -> Result<StepResult, AppError> {
    // ── 1. Load connection credentials ───────────────────────────────────────
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;
    crate::profiles::ensure_writable(&profile)?;

    // ── 2. Acquire/create CancellationToken BEFORE any .await ────────────────
    let token = {
        let mut guard = crate::commands::lock_state(&run_state)?;
        let state = guard.get_or_insert_with(|| PlanRunState { token: CancellationToken::new() });
        state.token.clone()
    };
    // Guard dropped here — before first .await

    // ── 3. Validate message type is configured ───────────────────────────────
    if step.message_type.is_empty() {
        return Ok(StepResult {
            step_id: step.id,
            status: "error".into(),
            reply: None,
            error: Some(
                "Step has no message type configured — open the step editor to select one"
                    .to_string(),
            ),
        });
    }

    // ── 3b. Ensure pool contains the step's message type; compile if needed ──
    {
        let has_type = crate::commands::lock_state(&pool_state)?
            .as_ref()
            .map(|p| p.get_message_by_name(&step.message_type).is_some())
            .unwrap_or(false);

        if !has_type {
            if step.proto_path.is_empty() {
                return Ok(StepResult {
                    step_id: step.id,
                    status: "error".into(),
                    reply: None,
                    error: Some(format!(
                        "Message type '{}' not found in pool and step has no proto file configured",
                        step.message_type
                    )),
                });
            }
            // Compile on the blocking pool: parsing an import tree must not stall the
            // async runtime that drives live consumers.
            let app_for_compile = app.clone();
            let proto_path = step.proto_path.clone();
            let compiled = tauri::async_runtime::spawn_blocking(move || {
                let pool = app_for_compile.state::<Mutex<Option<DescriptorPool>>>();
                compile_and_merge_proto(&proto_path, &pool)
            })
            .await
            .map_err(|e| AppError::ParseError(format!("proto compile task failed: {}", e)))?;
            if let Err(e) = compiled {
                return Ok(StepResult {
                    step_id: step.id,
                    status: "error".into(),
                    reply: None,
                    error: Some(format!(
                        "Could not load '{}': {}",
                        step.proto_path, e
                    )),
                });
            }
        }
    }

    // ── 4. Clone DescriptorPool BEFORE any .await (MutexGuard not Send) ──────
    let pool = {
        let guard = crate::commands::lock_state(&pool_state)?;
        guard
            .as_ref()
            .ok_or_else(|| AppError::AmqpError("descriptor pool not initialized".into()))?
            .clone() // O(1) — Arc-backed
    };
    // Guard dropped here — before first .await

    let endpoint = AmqpEndpoint::from_profile(&profile)?;
    execute_step_core(pool, token, &endpoint, password, step).await
}

/// Pure async core for [`execute_step`]: encode, connect, and run the response-mode branch.
/// Decoupled from Tauri State (pool/run_state) and keychain so it can be integration-tested
/// against a live broker. The descriptor pool and cancellation token are resolved by the
/// command and passed in.
pub(crate) async fn execute_step_core(
    pool: prost_reflect::DescriptorPool,
    token: CancellationToken,
    endpoint: &AmqpEndpoint,
    password: String,
    step: PlanStep,
) -> Result<StepResult, AppError> {
    // ── 5. Parse field_values JSON, encode, validate timings — all before connecting ──
    let field_values_json: serde_json::Value = match serde_json::from_str(&step.field_values) {
        Ok(v) => v,
        Err(e) => {
            return Ok(step_error(&step.id, format!("Failed to parse field_values JSON: {}", e)));
        }
    };

    let encoded_bytes = match crate::commands::encode::encode_message_with_pool(
        &pool,
        &step.message_type,
        &field_values_json,
    ) {
        Ok(bytes) => bytes,
        Err(e) => return Ok(step_error(&step.id, e.to_string())),
    };

    if let Err(message) = validate_step_timings(&step.response_mode) {
        return Ok(step_error(&step.id, message));
    }

    // ── 6. Open AMQP connection ────────────────────────────────────────────────
    //    URI built and dropped inside `connect`; errors sanitized there (WR-01).
    let conn = endpoint.connect(password, AMQP_CONNECT_TIMEOUT, "Step").await?;

    // Every path, including AMQP errors, closes the connection.
    let result = run_step(&conn, &pool, &token, &step, &encoded_bytes).await;
    let _ = conn.close(0, "".into()).await;
    result
}

fn step_error(step_id: &str, message: impl Into<String>) -> StepResult {
    StepResult {
        step_id: step_id.to_string(),
        status: "error".into(),
        reply: None,
        error: Some(message.into()),
    }
}

fn step_done(step_id: &str, reply: Option<ReplyMessage>) -> StepResult {
    StepResult {
        step_id: step_id.to_string(),
        status: "done".into(),
        reply,
        error: None,
    }
}

/// Where a step's reply arrives. Private queues are declared per step (exclusive,
/// auto-delete, server-named) so nothing else can be on them; named queues are shared
/// with real services and must be treated with care.
struct ReplyQueue {
    name: String,
    private: bool,
}

/// Use the configured reply queue, or declare a private one when none is configured.
async fn resolve_reply_queue(
    channel: &lapin::Channel,
    configured: &str,
) -> Result<ReplyQueue, AppError> {
    let configured = configured.trim();
    if !configured.is_empty() {
        return Ok(ReplyQueue { name: configured.to_string(), private: false });
    }
    let queue = channel
        .queue_declare(
            "".into(),
            QueueDeclareOptions { exclusive: true, auto_delete: true, ..Default::default() },
            FieldTable::default(),
        )
        .await
        .map_err(|e| AppError::AmqpError(format!("Could not declare a private reply queue: {}", e)))?;
    Ok(ReplyQueue { name: queue.name().to_string(), private: true })
}

/// Consume from the reply queue with a prefetch cap and an attributable consumer tag.
/// Called BEFORE publishing so a fast reply cannot be missed (pitfall #59).
async fn start_reply_consumer(
    channel: &lapin::Channel,
    reply: &ReplyQueue,
) -> Result<lapin::Consumer, AppError> {
    channel
        .basic_qos(REPLY_PREFETCH, BasicQosOptions::default())
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;
    channel
        .basic_consume(
            reply.name.as_str().into(),
            consumer_tag("plan").as_str().into(),
            BasicConsumeOptions { no_ack: false, ..Default::default() },
            FieldTable::default(),
        )
        .await
        .map_err(|e| {
            AppError::AmqpError(format!("Could not consume from reply queue '{}': {}", reply.name, e))
        })
}

/// Publish with publisher confirms and `mandatory`, like the main publish path.
/// `Ok(Err(reason))` is a delivery problem the step should report; `Err` is an AMQP failure.
async fn publish_confirmed(
    channel: &lapin::Channel,
    exchange: &str,
    routing_key: &str,
    payload: &[u8],
    props: BasicProperties,
) -> Result<Result<(), String>, AppError> {
    let confirm = channel
        .basic_publish(
            exchange.into(),
            routing_key.into(),
            BasicPublishOptions { mandatory: true, ..Default::default() },
            payload,
            props,
        )
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;
    match tokio::time::timeout(PUBLISH_CONFIRM_TIMEOUT, confirm).await {
        Err(_) => Ok(Err(format!(
            "Broker did not confirm the publish within {}s",
            PUBLISH_CONFIRM_TIMEOUT.as_secs()
        ))),
        Ok(Err(e)) => Err(AppError::AmqpError(e.to_string())),
        Ok(Ok(Confirmation::Ack(None))) | Ok(Ok(Confirmation::NotRequested)) => Ok(Ok(())),
        Ok(Ok(Confirmation::Ack(Some(_)))) => Ok(Err(format!(
            "Message was returned by the broker: nothing is routed from exchange '{}' with routing key '{}'",
            exchange, routing_key
        ))),
        Ok(Ok(Confirmation::Nack(_))) => Ok(Err("Broker rejected the message (nack)".to_string())),
    }
}

/// Run one step on an open connection: publish with confirms, then follow the response mode.
async fn run_step(
    conn: &lapin::Connection,
    pool: &DescriptorPool,
    token: &CancellationToken,
    step: &PlanStep,
    payload: &[u8],
) -> Result<StepResult, AppError> {
    let channel = conn
        .create_channel()
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;
    channel
        .confirm_select(ConfirmSelectOptions::default())
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    let (exchange, routing_key) = match &step.target {
        PublishTarget::Queue { queue } => ("".to_string(), queue.clone()),
        PublishTarget::Exchange { exchange, routing_key } => (exchange.clone(), routing_key.clone()),
    };

    match &step.response_mode {
        // Branch A: NoWait — publish, then pause (interruptible by Stop).
        ResponseMode::NoWait { delay_ms } => {
            if let Err(reason) =
                publish_confirmed(&channel, &exchange, &routing_key, payload, BasicProperties::default())
                    .await?
            {
                return Ok(step_error(&step.id, reason));
            }
            tokio::select! {
                biased;
                _ = token.cancelled() => Ok(step_error(&step.id, "Cancelled")),
                _ = tokio::time::sleep(Duration::from_millis(*delay_ms)) => Ok(step_done(&step.id, None)),
            }
        }

        // Branch B: CorrelationId — consume BEFORE publish; match by correlation_id property.
        ResponseMode::CorrelationId { reply_queue, timeout_ms } => {
            let reply = resolve_reply_queue(&channel, reply_queue).await?;
            let correlation_id = Uuid::new_v4().to_string();
            let mut consumer = start_reply_consumer(&channel, &reply).await?;

            let props = BasicProperties::default()
                .with_correlation_id(correlation_id.as_str().into())
                .with_reply_to(reply.name.as_str().into());
            if let Err(reason) =
                publish_confirmed(&channel, &exchange, &routing_key, payload, props).await?
            {
                return Ok(step_error(&step.id, reason));
            }

            // Pin deadline OUTSIDE the loop (pitfall #4)
            let deadline = tokio::time::sleep(Duration::from_millis(*timeout_ms));
            tokio::pin!(deadline);

            loop {
                tokio::select! {
                    biased;
                    _ = token.cancelled() => return Ok(step_error(&step.id, "Cancelled")),
                    _ = &mut deadline => return Ok(step_error(&step.id, "Timeout waiting for reply")),
                    maybe_delivery = consumer.next() => match maybe_delivery {
                        Some(Ok(delivery)) => {
                            // correlation_id from AMQP properties NOT headers (pitfall #58)
                            let corr = delivery
                                .properties
                                .correlation_id()
                                .as_ref()
                                .map(|s| s.as_str().to_owned());
                            if corr.as_deref() == Some(correlation_id.as_str()) {
                                let _ = delivery.ack(BasicAckOptions::default()).await;
                                let reply_msg = build_reply_message(&delivery, pool, &step.message_type);
                                return Ok(step_done(&step.id, Some(reply_msg)));
                            }
                            if reply.private {
                                // Nothing else can legitimately sit on a private queue: drop strays.
                                let _ = delivery.ack(BasicAckOptions::default()).await;
                            } else {
                                // Shared queue: hand the message back to its real consumer, then
                                // back off so the broker is not hammered with redeliveries.
                                let _ = delivery
                                    .nack(BasicNackOptions { requeue: true, ..Default::default() })
                                    .await;
                                tokio::time::sleep(REQUEUE_BACKOFF).await;
                            }
                        }
                        Some(Err(e)) => return Ok(step_error(&step.id, format!("Consumer error: {}", e))),
                        None => return Ok(step_error(&step.id, "Consumer channel closed")),
                    }
                }
            }
        }

        // Branch C: FirstArrival — consume BEFORE publish; first delivery wins.
        ResponseMode::FirstArrival { reply_queue, timeout_ms } => {
            let reply = resolve_reply_queue(&channel, reply_queue).await?;
            let mut consumer = start_reply_consumer(&channel, &reply).await?;

            let props = BasicProperties::default().with_reply_to(reply.name.as_str().into());
            if let Err(reason) =
                publish_confirmed(&channel, &exchange, &routing_key, payload, props).await?
            {
                return Ok(step_error(&step.id, reason));
            }

            let deadline = tokio::time::sleep(Duration::from_millis(*timeout_ms));
            tokio::pin!(deadline);

            tokio::select! {
                biased;
                _ = token.cancelled() => Ok(step_error(&step.id, "Cancelled")),
                _ = &mut deadline => Ok(step_error(&step.id, "Timeout waiting for reply")),
                maybe_delivery = consumer.next() => match maybe_delivery {
                    Some(Ok(delivery)) => {
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                        let reply_msg = build_reply_message(&delivery, pool, &step.message_type);
                        Ok(step_done(&step.id, Some(reply_msg)))
                    }
                    Some(Err(e)) => Ok(step_error(&step.id, format!("Consumer error: {}", e))),
                    None => Ok(step_error(&step.id, "Consumer channel closed")),
                },
            }
        }
    }
}

// ─── Proto compilation helper ────────────────────────────────────────────────

/// Compile `proto_path` and merge its descriptors into the global pool.
/// Uses the file's parent directory as the only include path (same fallback
/// as usePlanProtoAutoLoad on the frontend). Skips files already present by
/// name to avoid conflicts with shared imports.
fn compile_and_merge_proto(
    proto_path: &str,
    pool: &Mutex<Option<DescriptorPool>>,
) -> Result<(), AppError> {
    let sep = if proto_path.contains('\\') { '\\' } else { '/' };
    let parent_dir = {
        let parts: Vec<&str> = proto_path.split(sep).collect();
        let dir_parts = &parts[..parts.len().saturating_sub(1)];
        let joined = dir_parts.join(&sep.to_string());
        if joined.is_empty() { sep.to_string() } else { joined }
    };

    let mut compiler = protox::Compiler::new([parent_dir.as_str()])
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    compiler.include_imports(true);
    compiler
        .open_file(proto_path)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    let fds = compiler.file_descriptor_set();

    let mut guard = crate::commands::lock_state(pool)?;
    match guard.as_mut() {
        None => {
            let new_pool = DescriptorPool::from_file_descriptor_set(fds)
                .map_err(|e| AppError::ParseError(e.to_string()))?;
            *guard = Some(new_pool);
        }
        Some(existing) => {
            for file_proto in fds.file {
                let name = file_proto.name().to_string();
                if existing.get_file_by_name(&name).is_none() {
                    existing
                        .add_file_descriptor_proto(file_proto)
                        .map_err(|e| AppError::ParseError(e.to_string()))?;
                }
            }
        }
    }
    Ok(())
}

// ─── Reply decoding helper ────────────────────────────────────────────────────

/// Hex in the same spaced format as the feed, so replies and feed rows look alike.
fn reply_hex(bytes: &[u8]) -> String {
    crate::commands::consume::bytes_to_hex(bytes)
}

/// Build a ReplyMessage from a lapin delivery.
/// Decode failure sets decoded/decoded_as to None — it is NOT a step error.
/// hex_string is always populated regardless of decode outcome.
fn build_reply_message(
    delivery: &lapin::message::Delivery,
    pool: &DescriptorPool,
    message_type: &str,
) -> ReplyMessage {
    let routing_key = delivery.routing_key.to_string();
    let exchange = delivery.exchange.to_string();
    let content_type = delivery
        .properties
        .content_type()
        .as_ref()
        .map(|s| s.to_string());
    let correlation_id = delivery
        .properties
        .correlation_id()
        .as_ref()
        .map(|s| s.to_string());
    let hex_string = reply_hex(&delivery.data);

    // Decode attempt using pool (D-03 + Q4 resolution)
    let (decoded, decoded_as) = match pool.get_message_by_name(message_type) {
        None => (None, None),
        Some(desc) => match DynamicMessage::decode(desc, delivery.data.as_ref()) {
            Ok(msg) => {
                let json_val = serde_json::to_value(&msg).ok();
                (json_val, Some(message_type.to_string()))
            }
            Err(_) => (None, None),
        },
    };

    ReplyMessage {
        routing_key,
        exchange,
        content_type,
        correlation_id,
        decoded,
        decoded_as,
        hex_string,
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────
//
// Coverage scope: this module is dominated by `execute_step`, an async command that
// requires a live AMQP broker and a Tauri runtime, so it is exercised by integration
// testing rather than here (mirrors the pure-helper-only approach in subscribe.rs).
// These unit tests cover the parts that are pure and testable in isolation:
//   - compile_and_merge_proto (proto compilation + pool merge/dedup logic)
//   - the serde contracts for the IPC input/output structs (TS ↔ Rust shape).
#[cfg(test)]
mod tests {
    use super::*;

    /// Write inline `.proto` content to a temp file and return its absolute path.
    fn write_proto(content: &str, file_name: &str) -> String {
        let tmp_dir = std::env::temp_dir().join("tap_plan_runner_tests");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let path = tmp_dir.join(file_name);
        std::fs::write(&path, content).unwrap();
        path.to_str().unwrap().to_string()
    }

    // ---- compile_and_merge_proto ------------------------------------------

    #[test]
    fn compile_into_empty_pool_initializes_it() {
        let path = write_proto(
            r#"syntax = "proto3"; message Alpha { string a = 1; }"#,
            "alpha.proto",
        );
        let pool: Mutex<Option<DescriptorPool>> = Mutex::new(None);

        compile_and_merge_proto(&path, &pool).expect("compile should succeed");

        let guard = pool.lock().unwrap();
        let pool = guard.as_ref().expect("pool should be initialized");
        assert!(pool.get_message_by_name("Alpha").is_some());
    }

    #[test]
    fn merge_into_existing_pool_adds_new_messages() {
        let alpha = write_proto(
            r#"syntax = "proto3"; message Alpha { string a = 1; }"#,
            "merge_alpha.proto",
        );
        let beta = write_proto(
            r#"syntax = "proto3"; message Beta { string b = 1; }"#,
            "merge_beta.proto",
        );
        let pool: Mutex<Option<DescriptorPool>> = Mutex::new(None);

        compile_and_merge_proto(&alpha, &pool).unwrap();
        compile_and_merge_proto(&beta, &pool).unwrap();

        let guard = pool.lock().unwrap();
        let pool = guard.as_ref().unwrap();
        assert!(pool.get_message_by_name("Alpha").is_some(), "first file retained");
        assert!(pool.get_message_by_name("Beta").is_some(), "second file merged");
    }

    #[test]
    fn merge_is_idempotent_for_same_file_name() {
        // Compiling the same file twice must not error (file-already-present skip path).
        let path = write_proto(
            r#"syntax = "proto3"; message Gamma { string g = 1; }"#,
            "gamma.proto",
        );
        let pool: Mutex<Option<DescriptorPool>> = Mutex::new(None);

        compile_and_merge_proto(&path, &pool).unwrap();
        compile_and_merge_proto(&path, &pool).expect("re-compiling same file must not error");

        let guard = pool.lock().unwrap();
        assert!(guard.as_ref().unwrap().get_message_by_name("Gamma").is_some());
    }

    #[test]
    fn compile_invalid_proto_returns_parse_error() {
        let path = write_proto("this is not valid protobuf syntax", "invalid.proto");
        let pool: Mutex<Option<DescriptorPool>> = Mutex::new(None);

        let err = compile_and_merge_proto(&path, &pool).unwrap_err();
        assert!(matches!(err, AppError::ParseError(_)), "got {err:?}");
        assert!(pool.lock().unwrap().is_none(), "pool must stay uninitialized on failure");
    }

    #[test]
    fn compile_nonexistent_file_returns_parse_error() {
        let pool: Mutex<Option<DescriptorPool>> = Mutex::new(None);
        let err =
            compile_and_merge_proto("/nonexistent/path/to/missing.proto", &pool).unwrap_err();
        assert!(matches!(err, AppError::ParseError(_)), "got {err:?}");
    }

    // ---- timing bounds (A3) -----------------------------------------------

    #[test]
    fn timings_within_bounds_are_accepted() {
        assert!(validate_step_timings(&ResponseMode::NoWait { delay_ms: 0 }).is_ok());
        assert!(validate_step_timings(&ResponseMode::NoWait { delay_ms: MAX_STEP_DELAY_MS }).is_ok());
        assert!(validate_step_timings(&ResponseMode::CorrelationId {
            reply_queue: String::new(),
            timeout_ms: MAX_REPLY_TIMEOUT_MS,
        })
        .is_ok());
    }

    #[test]
    fn oversized_delay_and_timeout_are_rejected_with_the_limit_named() {
        let err = validate_step_timings(&ResponseMode::NoWait { delay_ms: MAX_STEP_DELAY_MS + 1 })
            .unwrap_err();
        assert!(err.contains("delay") && err.contains(&MAX_STEP_DELAY_MS.to_string()), "got {err}");
        let err = validate_step_timings(&ResponseMode::FirstArrival {
            reply_queue: "r".into(),
            timeout_ms: MAX_REPLY_TIMEOUT_MS + 1,
        })
        .unwrap_err();
        assert!(err.contains("timeout") && err.contains(&MAX_REPLY_TIMEOUT_MS.to_string()), "got {err}");
    }

    #[test]
    fn zero_reply_timeout_is_rejected() {
        let err = validate_step_timings(&ResponseMode::CorrelationId {
            reply_queue: "r".into(),
            timeout_ms: 0,
        })
        .unwrap_err();
        assert!(err.contains("timeout"), "got {err}");
    }

    // ---- input deserialization (TS discriminated unions) ------------------

    #[test]
    fn deserializes_queue_target() {
        let target: PublishTarget =
            serde_json::from_value(serde_json::json!({ "kind": "queue", "queue": "orders" }))
                .unwrap();
        match target {
            PublishTarget::Queue { queue } => assert_eq!(queue, "orders"),
            other => panic!("expected Queue, got {other:?}"),
        }
    }

    #[test]
    fn deserializes_exchange_target() {
        let target: PublishTarget = serde_json::from_value(serde_json::json!({
            "kind": "exchange",
            "exchange": "events",
            "routing_key": "user.created"
        }))
        .unwrap();
        match target {
            PublishTarget::Exchange { exchange, routing_key } => {
                assert_eq!(exchange, "events");
                assert_eq!(routing_key, "user.created");
            }
            other => panic!("expected Exchange, got {other:?}"),
        }
    }

    #[test]
    fn deserializes_all_response_modes() {
        let no_wait: ResponseMode =
            serde_json::from_value(serde_json::json!({ "mode": "no-wait", "delay_ms": 250 }))
                .unwrap();
        assert!(matches!(no_wait, ResponseMode::NoWait { delay_ms: 250 }));

        let corr: ResponseMode = serde_json::from_value(serde_json::json!({
            "mode": "correlation-id",
            "reply_queue": "replies",
            "timeout_ms": 5000
        }))
        .unwrap();
        match corr {
            ResponseMode::CorrelationId { reply_queue, timeout_ms } => {
                assert_eq!(reply_queue, "replies");
                assert_eq!(timeout_ms, 5000);
            }
            other => panic!("expected CorrelationId, got {other:?}"),
        }

        let first: ResponseMode = serde_json::from_value(serde_json::json!({
            "mode": "first-arrival",
            "reply_queue": "replies",
            "timeout_ms": 3000
        }))
        .unwrap();
        match first {
            ResponseMode::FirstArrival { reply_queue, timeout_ms } => {
                assert_eq!(reply_queue, "replies");
                assert_eq!(timeout_ms, 3000);
            }
            other => panic!("expected FirstArrival, got {other:?}"),
        }
    }

    #[test]
    fn deserializes_full_plan_step() {
        let step: PlanStep = serde_json::from_value(serde_json::json!({
            "id": "step-1",
            "name": "Send order",
            "proto_path": "/tmp/order.proto",
            "message_type": "Order",
            "field_values": "{\"id\":1}",
            "target": { "kind": "queue", "queue": "orders" },
            "response_mode": { "mode": "no-wait", "delay_ms": 0 }
        }))
        .unwrap();

        assert_eq!(step.id, "step-1");
        assert_eq!(step.message_type, "Order");
        assert!(matches!(step.target, PublishTarget::Queue { .. }));
        assert!(matches!(step.response_mode, ResponseMode::NoWait { .. }));
    }

    #[test]
    fn unknown_target_kind_fails_deserialization() {
        let result: Result<PublishTarget, _> =
            serde_json::from_value(serde_json::json!({ "kind": "topic", "queue": "x" }));
        assert!(result.is_err(), "unknown discriminant must be rejected");
    }

    // ---- output serialization (camelCase IPC contract) --------------------

    #[test]
    fn step_result_serializes_to_camel_case() {
        let result = StepResult {
            step_id: "s1".into(),
            status: "done".into(),
            reply: None,
            error: None,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["stepId"], "s1");
        assert_eq!(json["status"], "done");
        assert!(json.get("step_id").is_none(), "snake_case key must not be emitted");
    }

    #[test]
    fn reply_hex_uses_the_spaced_format_of_the_feed() {
        // Same convention as consume::bytes_to_hex, so replies and feed rows look alike.
        assert_eq!(reply_hex(&[0x0a, 0x05, 0x68]), "0a 05 68");
        assert_eq!(reply_hex(&[]), "");
    }

    #[test]
    fn reply_message_serializes_to_camel_case() {
        let reply = ReplyMessage {
            routing_key: "rk".into(),
            exchange: "ex".into(),
            content_type: Some("application/x-protobuf".into()),
            correlation_id: Some("abc".into()),
            decoded: None,
            decoded_as: None,
            hex_string: "deadbeef".into(),
        };
        let json = serde_json::to_value(&reply).unwrap();
        assert_eq!(json["routingKey"], "rk");
        assert_eq!(json["contentType"], "application/x-protobuf");
        assert_eq!(json["correlationId"], "abc");
        assert_eq!(json["decodedAs"], serde_json::Value::Null);
        assert_eq!(json["hexString"], "deadbeef");
    }
}

// ─── Broker-backed integration tests for execute_step_core ────────────────────────
#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::test_support::{broker_or_skip, test_channel, TestBroker};
    use lapin::options::{
        BasicPublishOptions, ConfirmSelectOptions, QueueDeclareOptions, QueuePurgeOptions,
    };
    use lapin::types::FieldTable;
    use prost_reflect::DescriptorPool;

    const PROTO: &str = r#"syntax = "proto3"; message Cmd { string action = 1; }"#;

    fn pool_and_bytes(values: serde_json::Value) -> (DescriptorPool, Vec<u8>) {
        let tmp_dir = std::env::temp_dir().join("tap_plan_it");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        // Unique file per call: tests run in parallel and fs::write truncates first, so a
        // shared file name let one test compile another test's half-written (empty) proto.
        let path = tmp_dir.join(format!("cmd-{}.proto", Uuid::new_v4().simple()));
        std::fs::write(&path, PROTO).unwrap();
        let mut c = protox::Compiler::new([tmp_dir.to_str().unwrap()]).unwrap();
        c.include_imports(true);
        c.open_file(path.to_str().unwrap()).unwrap();
        let pool = DescriptorPool::from_file_descriptor_set(c.file_descriptor_set()).unwrap();
        let bytes = crate::commands::encode::encode_message_with_pool(&pool, "Cmd", &values).unwrap();
        (pool, bytes)
    }

    async fn seed_queue(b: &TestBroker, queue: &str, payloads: &[Vec<u8>]) {
        let ch = test_channel(b).await;
        ch.queue_declare(queue.into(), QueueDeclareOptions { durable: true, ..Default::default() }, FieldTable::default())
            .await
            .unwrap();
        ch.queue_purge(queue.into(), QueuePurgeOptions::default()).await.unwrap();
        ch.confirm_select(ConfirmSelectOptions::default()).await.unwrap();
        for p in payloads {
            ch.basic_publish("".into(), queue.into(), BasicPublishOptions::default(), p, lapin::BasicProperties::default())
                .await
                .unwrap()
                .await
                .unwrap();
        }
    }

    fn step(id: &str, mtype: &str, values: &str, target: PublishTarget, mode: ResponseMode) -> PlanStep {
        PlanStep {
            id: id.to_string(),
            name: "test step".to_string(),
            proto_path: String::new(),
            message_type: mtype.to_string(),
            field_values: values.to_string(),
            target,
            response_mode: mode,
        }
    }

    // ── No-broker paths (parse/encode happen before connect) ──

    #[tokio::test]
    async fn bad_field_values_json_returns_error_result() {
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "x" }));
        let s = step(
            "s-badjson", "Cmd", "{not valid json",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::NoWait { delay_ms: 0 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        assert!(res.error.unwrap().contains("field_values"));
    }

    #[tokio::test]
    async fn unknown_message_type_returns_encode_error_result() {
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "x" }));
        let s = step(
            "s-badtype", "NotInPool", "{}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::NoWait { delay_ms: 0 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
    }

    #[tokio::test]
    async fn unreachable_host_returns_amqp_error() {
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "x" }));
        let s = step(
            "s-unreach", "Cmd", "{\"action\":\"go\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::NoWait { delay_ms: 0 },
        );
        let err = execute_step_core(pool, CancellationToken::new(), &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(), s)
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::AmqpError(_)), "got {err:?}");
    }

    // ── Broker-backed paths ──

    #[tokio::test]
    async fn no_wait_publishes_and_returns_done() {
        let Some(b) = broker_or_skip("plan_no_wait").await else { return };
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "go" }));
        let s = step(
            "s-nowait", "Cmd", "{\"action\":\"go\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::NoWait { delay_ms: 1 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "done");
        assert!(res.reply.is_none());
        crate::test_support::purge_queue(&b, "proto-test").await;
    }

    #[tokio::test]
    async fn first_arrival_receives_seeded_reply_and_decodes() {
        let Some(b) = broker_or_skip("plan_first_arrival").await else { return };
        let reply_q = "tap-it-plan-fa-reply";
        let (pool, reply_bytes) = pool_and_bytes(serde_json::json!({ "action": "pong" }));
        // Pre-seed the reply queue — FirstArrival consumes before publish, first delivery wins.
        seed_queue(&b, reply_q, &[reply_bytes]).await;
        let s = step(
            "s-firstarr", "Cmd", "{\"action\":\"ping\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::FirstArrival { reply_queue: reply_q.into(), timeout_ms: 5000 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "done");
        let reply = res.reply.expect("expected a reply");
        assert_eq!(reply.decoded_as, Some("Cmd".to_string()));
        assert_eq!(reply.decoded.unwrap()["action"], "pong");
        crate::test_support::delete_queue(&b, reply_q).await;
        crate::test_support::purge_queue(&b, "proto-test").await;
    }

    #[tokio::test]
    async fn first_arrival_times_out_on_empty_reply_queue() {
        let Some(b) = broker_or_skip("plan_fa_timeout").await else { return };
        let reply_q = "tap-it-plan-fa-timeout";
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "ping" }));
        seed_queue(&b, reply_q, &[]).await; // empty
        let s = step(
            "s-fatimeout", "Cmd", "{\"action\":\"ping\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::FirstArrival { reply_queue: reply_q.into(), timeout_ms: 400 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        assert!(res.error.unwrap().contains("Timeout"));
        crate::test_support::delete_queue(&b, reply_q).await;
        crate::test_support::purge_queue(&b, "proto-test").await;
    }

    #[tokio::test]
    async fn first_arrival_cancelled_returns_cancelled() {
        let Some(b) = broker_or_skip("plan_fa_cancel").await else { return };
        let reply_q = "tap-it-plan-fa-cancel";
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "ping" }));
        seed_queue(&b, reply_q, &[]).await;
        let token = CancellationToken::new();
        token.cancel(); // pre-cancelled → biased select picks the cancel arm
        let s = step(
            "s-facancel", "Cmd", "{\"action\":\"ping\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::FirstArrival { reply_queue: reply_q.into(), timeout_ms: 5000 },
        );
        let res = execute_step_core(pool, token, &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        assert_eq!(res.error, Some("Cancelled".to_string()));
        crate::test_support::delete_queue(&b, reply_q).await;
    }

    #[tokio::test]
    async fn correlation_id_nacks_nonmatching_then_times_out() {
        let Some(b) = broker_or_skip("plan_corr_timeout").await else { return };
        let reply_q = "tap-it-plan-corr-timeout";
        let (pool, junk) = pool_and_bytes(serde_json::json!({ "action": "unrelated" }));
        // Seed a reply with no/!matching correlation_id → NACK+requeue branch, then deadline.
        seed_queue(&b, reply_q, &[junk]).await;
        let s = step(
            "s-corr", "Cmd", "{\"action\":\"ping\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::CorrelationId { reply_queue: reply_q.into(), timeout_ms: 500 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        assert!(res.error.unwrap().contains("Timeout"));
        crate::test_support::delete_queue(&b, reply_q).await;
        crate::test_support::purge_queue(&b, "proto-test").await;
    }

    // ── Bounded timings, confirms, cancellation, private reply queues ──

    #[tokio::test]
    async fn oversized_delay_is_a_step_error_before_any_connection() {
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "x" }));
        let s = step(
            "s-bigdelay", "Cmd", "{\"action\":\"go\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::NoWait { delay_ms: MAX_STEP_DELAY_MS + 1 },
        );
        // Unreachable host: validation must fail first, so this returns Ok(error result), not Err.
        let res = execute_step_core(pool, CancellationToken::new(), &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        assert!(res.error.unwrap().contains("delay"));
    }

    #[tokio::test]
    async fn no_wait_to_unroutable_target_reports_the_return() {
        let Some(b) = broker_or_skip("plan_no_wait_unroutable").await else { return };
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "go" }));
        let s = step(
            "s-unroutable", "Cmd", "{\"action\":\"go\"}",
            PublishTarget::Queue { queue: "tap-it-no-such-queue-zzz".into() },
            ResponseMode::NoWait { delay_ms: 0 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        assert!(res.error.unwrap().to_lowercase().contains("routed"), "unroutable publish must not report done");
    }

    #[tokio::test]
    async fn no_wait_delay_is_interrupted_by_cancellation() {
        let Some(b) = broker_or_skip("plan_no_wait_cancel").await else { return };
        let (pool, _) = pool_and_bytes(serde_json::json!({ "action": "go" }));
        let s = step(
            "s-cancel-delay", "Cmd", "{\"action\":\"go\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::NoWait { delay_ms: 30_000 },
        );
        let token = CancellationToken::new();
        let cancel = token.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(200)).await;
            cancel.cancel();
        });
        let started = std::time::Instant::now();
        let res = execute_step_core(pool, token, &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert!(started.elapsed() < Duration::from_secs(5), "cancel must interrupt the delay");
        assert_eq!(res.error, Some("Cancelled".to_string()));
        crate::test_support::purge_queue(&b, "proto-test").await;
    }

    #[tokio::test]
    async fn correlation_id_with_private_reply_queue_round_trips_through_a_responder() {
        let Some(b) = broker_or_skip("plan_private_reply").await else { return };
        let request_q = "tap-it-plan-private-req";
        let (pool, reply_bytes) = pool_and_bytes(serde_json::json!({ "action": "pong" }));
        seed_queue(&b, request_q, &[]).await;

        // A responder that answers on reply_to with the request's correlation id, like a real service.
        let responder_broker = b.clone();
        let responder = tokio::spawn(async move {
            let ch = test_channel(&responder_broker).await;
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            loop {
                if let Some(msg) = ch.basic_get(request_q.into(), lapin::options::BasicGetOptions::default()).await.unwrap() {
                    let reply_to = msg.properties.reply_to().as_ref().map(|s| s.as_str().to_owned()).unwrap();
                    let corr = msg.properties.correlation_id().as_ref().map(|s| s.as_str().to_owned()).unwrap();
                    msg.ack(BasicAckOptions::default()).await.unwrap();
                    ch.basic_publish(
                        "".into(),
                        reply_to.as_str().into(),
                        BasicPublishOptions::default(),
                        &reply_bytes,
                        lapin::BasicProperties::default().with_correlation_id(corr.as_str().into()),
                    )
                    .await
                    .unwrap();
                    return reply_to;
                }
                assert!(std::time::Instant::now() < deadline, "responder never saw the request");
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        });

        let s = step(
            "s-private", "Cmd", "{\"action\":\"ping\"}",
            PublishTarget::Queue { queue: request_q.into() },
            // Empty reply_queue: Tap declares an exclusive, auto-delete reply queue for this step.
            ResponseMode::CorrelationId { reply_queue: String::new(), timeout_ms: 5000 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        let reply_to = responder.await.unwrap();
        assert!(reply_to.starts_with("amq.gen-"), "expected a server-named private queue, got {reply_to}");
        assert_eq!(res.status, "done", "error: {:?}", res.error);
        let reply = res.reply.expect("expected a reply");
        assert_eq!(reply.decoded.unwrap()["action"], "pong");
        crate::test_support::delete_queue(&b, request_q).await;
    }

    #[tokio::test]
    async fn correlation_id_on_a_shared_queue_requeues_unrelated_messages() {
        let Some(b) = broker_or_skip("plan_corr_requeue").await else { return };
        let reply_q = "tap-it-plan-corr-requeue";
        let (pool, junk) = pool_and_bytes(serde_json::json!({ "action": "unrelated" }));
        seed_queue(&b, reply_q, &[junk]).await;
        let s = step(
            "s-corr-requeue", "Cmd", "{\"action\":\"ping\"}",
            PublishTarget::Queue { queue: "proto-test".into() },
            ResponseMode::CorrelationId { reply_queue: reply_q.into(), timeout_ms: 400 },
        );
        let res = execute_step_core(pool, CancellationToken::new(), &b.endpoint(), b.password.clone(), s)
            .await
            .unwrap();
        assert_eq!(res.status, "error");
        // The unrelated message must still be on the queue for its real consumer.
        let ch = test_channel(&b).await;
        let leftover = ch.basic_get(reply_q.into(), lapin::options::BasicGetOptions::default()).await.unwrap();
        assert!(leftover.is_some(), "unrelated message was consumed instead of requeued");
        leftover.unwrap().ack(BasicAckOptions::default()).await.unwrap();
        crate::test_support::delete_queue(&b, reply_q).await;
        crate::test_support::purge_queue(&b, "proto-test").await;
    }
}
