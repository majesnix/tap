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
    options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions},
    BasicProperties, Connection, ConnectionProperties,
};
use prost_reflect::{DescriptorPool, DynamicMessage};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::AppError;

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
    let mut guard = run_state.lock().unwrap();
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

    // ── 2. Acquire/create CancellationToken BEFORE any .await ────────────────
    let token = {
        let mut guard = run_state.lock().unwrap();
        if guard.is_none() {
            *guard = Some(PlanRunState { token: CancellationToken::new() });
        }
        guard.as_ref().unwrap().token.clone()
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
        let has_type = pool_state
            .lock()
            .unwrap()
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
            if let Err(e) = compile_and_merge_proto(&step.proto_path, &*pool_state) {
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
        let guard = pool_state.lock().unwrap();
        guard
            .as_ref()
            .ok_or_else(|| AppError::AmqpError("descriptor pool not initialized".into()))?
            .clone() // O(1) — Arc-backed
    };
    // Guard dropped here — before first .await

    // ── 5. Parse field_values JSON and encode message ─────────────────────────
    let field_values_json: serde_json::Value = match serde_json::from_str(&step.field_values) {
        Ok(v) => v,
        Err(e) => {
            return Ok(StepResult {
                step_id: step.id,
                status: "error".into(),
                reply: None,
                error: Some(format!("Failed to parse field_values JSON: {}", e)),
            });
        }
    };

    let encoded_bytes =
        match crate::commands::encode::encode_message_with_pool(&pool, &step.message_type, &field_values_json) {
            Ok(bytes) => bytes,
            Err(e) => {
                return Ok(StepResult {
                    step_id: step.id,
                    status: "error".into(),
                    reply: None,
                    error: Some(e.to_string()),
                });
            }
        };

    // ── 6. Open AMQP connection ────────────────────────────────────────────────
    //    Follow the tight-scope URI pattern from publish.rs (WR-01: password not leaked).
    let conn = {
        use crate::profiles::build_amqp_uri;
        let uri = build_amqp_uri(
            &profile.host,
            profile.port,
            &profile.vhost,
            &profile.username,
            &password,
        );
        drop(password);
        let result = tokio::time::timeout(
            Duration::from_secs(10),
            Connection::connect(&uri, ConnectionProperties::default()),
        )
        .await;
        result
            .map_err(|_| AppError::AmqpError("Step connection timed out (10s)".to_string()))?
            .map_err(|_| AppError::AmqpError("AMQP connection failed — check host, port, vhost, and credentials".to_string()))?
    };

    let channel = conn
        .create_channel()
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    // ── 7. Determine routing info from step.target ────────────────────────────
    let (exchange, routing_key) = match &step.target {
        PublishTarget::Queue { queue } => ("".to_string(), queue.clone()),
        PublishTarget::Exchange { exchange, routing_key } => {
            (exchange.clone(), routing_key.clone())
        }
    };

    // ── 8. Branch on response_mode ────────────────────────────────────────────
    let result = match &step.response_mode {
        // Branch A: NoWait — publish and sleep delay_ms
        ResponseMode::NoWait { delay_ms } => {
            let delay = *delay_ms;

            channel
                .basic_publish(
                    exchange.as_str().into(),
                    routing_key.as_str().into(),
                    BasicPublishOptions::default(),
                    &encoded_bytes,
                    BasicProperties::default(),
                )
                .await
                .map_err(|e| AppError::AmqpError(e.to_string()))?;

            tokio::time::sleep(Duration::from_millis(delay)).await;

            StepResult {
                step_id: step.id.clone(),
                status: "done".into(),
                reply: None,
                error: None,
            }
        }

        // Branch B: CorrelationId — consume BEFORE publish; match by correlation_id property
        ResponseMode::CorrelationId { reply_queue, timeout_ms } => {
            let timeout = *timeout_ms;
            let reply_queue = reply_queue.clone();
            let correlation_id = Uuid::new_v4().to_string();

            // basic_consume BEFORE basic_publish (pitfall #59)
            let consumer_tag = format!("tap-run-{}", &step.id[..8.min(step.id.len())]);
            let mut consumer = channel
                .basic_consume(
                    reply_queue.as_str().into(),
                    consumer_tag.as_str().into(),
                    BasicConsumeOptions { no_ack: false, ..Default::default() },
                    lapin::types::FieldTable::default(),
                )
                .await
                .map_err(|e| AppError::AmqpError(e.to_string()))?;

            // Build AMQP props with correlation_id + reply_to
            let props = BasicProperties::default()
                .with_correlation_id(correlation_id.as_str().into())
                .with_reply_to(reply_queue.as_str().into());

            channel
                .basic_publish(
                    exchange.as_str().into(),
                    routing_key.as_str().into(),
                    BasicPublishOptions::default(),
                    &encoded_bytes,
                    props,
                )
                .await
                .map_err(|e| AppError::AmqpError(e.to_string()))?;

            // Pin deadline OUTSIDE the loop (pitfall #4)
            let deadline = tokio::time::sleep(Duration::from_millis(timeout));
            tokio::pin!(deadline);

            let mut step_result = StepResult {
                step_id: step.id.clone(),
                status: "error".into(),
                reply: None,
                error: Some("Timeout waiting for reply".to_string()),
            };

            loop {
                tokio::select! {
                    biased;
                    _ = token.cancelled() => {
                        step_result = StepResult {
                            step_id: step.id.clone(),
                            status: "error".into(),
                            reply: None,
                            error: Some("Cancelled".to_string()),
                        };
                        break;
                    }
                    _ = &mut deadline => {
                        // step_result already set to timeout error above
                        break;
                    }
                    maybe_delivery = consumer.next() => {
                        match maybe_delivery {
                            Some(Ok(delivery)) => {
                                // correlation_id from AMQP properties NOT headers (pitfall #58)
                                let corr = delivery
                                    .properties
                                    .correlation_id()
                                    .as_ref()
                                    .map(|s| s.as_str().to_owned());

                                if corr.as_deref() == Some(correlation_id.as_str()) {
                                    // Match — ack and return done
                                    let _ = delivery
                                        .ack(BasicAckOptions::default())
                                        .await;
                                    let reply = build_reply_message(&delivery, &pool, &step.message_type);
                                    step_result = StepResult {
                                        step_id: step.id.clone(),
                                        status: "done".into(),
                                        reply: Some(reply),
                                        error: None,
                                    };
                                    break;
                                } else {
                                    // No match — NACK with requeue=true (pitfall #60)
                                    let _ = delivery
                                        .nack(BasicNackOptions { requeue: true, ..Default::default() })
                                        .await;
                                    // Continue loop
                                }
                            }
                            Some(Err(e)) => {
                                step_result = StepResult {
                                    step_id: step.id.clone(),
                                    status: "error".into(),
                                    reply: None,
                                    error: Some(format!("Consumer error: {}", e)),
                                };
                                break;
                            }
                            None => {
                                step_result = StepResult {
                                    step_id: step.id.clone(),
                                    status: "error".into(),
                                    reply: None,
                                    error: Some("Consumer channel closed".to_string()),
                                };
                                break;
                            }
                        }
                    }
                }
            }

            step_result
        }

        // Branch C: FirstArrival — consume BEFORE publish; first delivery wins
        ResponseMode::FirstArrival { reply_queue, timeout_ms } => {
            let timeout = *timeout_ms;
            let reply_queue = reply_queue.clone();

            // basic_consume BEFORE basic_publish (pitfall #59)
            let consumer_tag = format!("tap-fa-{}", &step.id[..8.min(step.id.len())]);
            let mut consumer = channel
                .basic_consume(
                    reply_queue.as_str().into(),
                    consumer_tag.as_str().into(),
                    BasicConsumeOptions { no_ack: false, ..Default::default() },
                    lapin::types::FieldTable::default(),
                )
                .await
                .map_err(|e| AppError::AmqpError(e.to_string()))?;

            // No correlation_id or reply_to in props for first-arrival mode
            channel
                .basic_publish(
                    exchange.as_str().into(),
                    routing_key.as_str().into(),
                    BasicPublishOptions::default(),
                    &encoded_bytes,
                    BasicProperties::default(),
                )
                .await
                .map_err(|e| AppError::AmqpError(e.to_string()))?;

            // Pin deadline OUTSIDE the select (pitfall #4)
            let deadline = tokio::time::sleep(Duration::from_millis(timeout));
            tokio::pin!(deadline);

            // FirstArrival: every arm is terminal — no loop needed (unlike CorrelationId
            // which may NACK and continue).
            tokio::select! {
                biased;
                _ = token.cancelled() => StepResult {
                    step_id: step.id.clone(),
                    status: "error".into(),
                    reply: None,
                    error: Some("Cancelled".to_string()),
                },
                _ = &mut deadline => StepResult {
                    step_id: step.id.clone(),
                    status: "error".into(),
                    reply: None,
                    error: Some("Timeout waiting for reply".to_string()),
                },
                maybe_delivery = consumer.next() => match maybe_delivery {
                    Some(Ok(delivery)) => {
                        // First arrival — ack and return done (no correlation check)
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                        let reply = build_reply_message(&delivery, &pool, &step.message_type);
                        StepResult {
                            step_id: step.id.clone(),
                            status: "done".into(),
                            reply: Some(reply),
                            error: None,
                        }
                    }
                    Some(Err(e)) => StepResult {
                        step_id: step.id.clone(),
                        status: "error".into(),
                        reply: None,
                        error: Some(format!("Consumer error: {}", e)),
                    },
                    None => StepResult {
                        step_id: step.id.clone(),
                        status: "error".into(),
                        reply: None,
                        error: Some("Consumer channel closed".to_string()),
                    },
                },
            }
        }
    };

    // Close connection (best-effort — don't fail the step on close error)
    let _ = conn.close(0, "".into()).await;

    Ok(result)
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

    let mut compiler = protox::Compiler::new(&[parent_dir.as_str()])
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    compiler.include_imports(true);
    compiler
        .open_file(proto_path)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    let fds = compiler.file_descriptor_set();

    let mut guard = pool.lock().unwrap();
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
    let hex_string = delivery
        .data
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();

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
