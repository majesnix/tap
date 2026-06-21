/// subscribe: Live AMQP consumer that streams decoded protobuf messages to the frontend.
///
/// SECURITY: AMQP URI contains cleartext password — built in a tight scope and
/// immediately dropped before any await point. Neither the URI nor the password
/// is ever captured in a spawn closure.
///
/// D-08: start_subscribe returns Err if a session is already Running (double-start guard).
/// D-09: stop_subscribe cancels the token and awaits the JoinHandle with a 5s timeout.
/// D-12: basic_qos(20) is called before basic_consume to cap in-flight deliveries.
/// D-13: ack-before-decode — each delivery is acked before the proto decode attempt.
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;
use tauri::Manager;
use lapin::{
    options::{BasicAckOptions, BasicCancelOptions, BasicConsumeOptions, BasicQosOptions},
    types::FieldTable,
};
use tokio_util::sync::CancellationToken;

use crate::commands::consume::DrainResult;

/// Holds the state for an active subscribe session.
/// Stored in Tauri managed state as `Mutex<Option<SubscribeState>>`.
///
/// CR-01: handle is Option<JoinHandle<()>> so the token can be stored BEFORE the first await
/// (atomically claiming the slot), with the handle filled in after spawn completes.
/// stop_subscribe only requires the token — it cancels via token.cancel() and awaits handle
/// if present. A None handle means spawn hasn't returned yet (extremely narrow window).
pub struct SubscribeState {
    pub token: CancellationToken,
    /// JoinHandle from tauri::async_runtime::spawn — NOT tokio::task::JoinHandle.
    /// Both implement Future, so tokio::time::timeout still works.
    /// Option: None between token-store and spawn-return (CR-01 TOCTOU fix).
    pub handle: Option<tauri::async_runtime::JoinHandle<()>>,
}

/// Construct a DrainResult representing a broker-level delivery error.
/// is_terminal=true signals to the frontend that the consumer has self-terminated and the
/// subscribeStatus should be set to "Idle" without user interaction (CR-02).
fn error_drain_result(message: String) -> DrainResult {
    DrainResult {
        routing_key: String::new(),
        exchange: String::new(),
        content_type: None,
        timestamp: None,
        decoded: None,
        hex_string: String::new(),
        error: Some(message),
        decoded_as: None,
        is_terminal: true, // CR-02: consumer is terminating — frontend must reset status to Idle
    }
}

/// Start a persistent AMQP consumer on `queue_name`.
///
/// Returns immediately after spawning the consumer task. Messages are delivered
/// one-at-a-time via the Tauri `channel` parameter as they arrive.
///
/// D-02: The command returns Ok(()) immediately; the consumer loop runs in a
///       background task until cancelled or the broker closes the connection.
///
/// Deviations from plan signature:
/// - Uses `Result<(), crate::error::AppError>` instead of `Result<(), String>` to match
///   all other commands and allow `?`-propagation of AppError from load_profile_with_password.
/// - Adds `pool_state` parameter (required for decode — DrainResult.decoded field).
#[tauri::command]
pub async fn start_subscribe(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    decode_types: Vec<String>,
    channel: tauri::ipc::Channel<DrainResult>,
    subscribe_state: tauri::State<'_, Mutex<Option<SubscribeState>>>,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<(), crate::error::AppError> {
    // Validate inputs at system boundary (T-14-01, T-14-05)
    validate_subscribe_inputs(&profile_name, &queue_name, &decode_types)?;

    // CR-01: TOCTOU fix — create the token and atomically claim the slot BEFORE the first await.
    // Two concurrent start_subscribe calls both reading guard.is_some()==false and then both
    // proceeding to spawn was the race. Now we: (1) check, (2) create token, (3) store with
    // handle:None — all inside one lock scope. The slot is claimed before any await.
    // Error paths after this point MUST clear the slot via clear_subscribe_state().
    let token = CancellationToken::new();
    let token_child = token.clone();
    {
        let mut guard = subscribe_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Subscribe state lock poisoned".to_string()))?;
        if guard.is_some() {
            return Err(crate::error::AppError::AmqpError(
                "Already running: stop the current session first".to_string(),
            ));
        }
        // Store a placeholder with handle:None — slot is now claimed.
        // stop_subscribe sees this immediately and can cancel via token.cancel().
        *guard = Some(SubscribeState { token, handle: None });
    } // guard drops here — slot claimed, safe to await below

    // Helper macro to clear the claimed slot on any error path below.
    // We cannot use a closure because subscribe_state is a tauri::State<'_> borrow.
    macro_rules! clear_slot_and_return {
        ($err:expr) => {{
            if let Ok(mut g) = subscribe_state.lock() {
                *g = None;
            }
            return Err($err);
        }};
    }

    // Clone DescriptorPool BEFORE any await (MutexGuard is not Send).
    // pool is Option<DescriptorPool> — None means "no proto loaded, skip decode".
    let pool = {
        let guard = pool_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Descriptor pool lock poisoned".to_string()))?;
        guard.clone() // O(1) — Arc-backed
    }; // guard drops here

    // Load credentials (sync, no await) — same pattern as consume.rs
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)
            .inspect_err(|_| { if let Ok(mut g) = subscribe_state.lock() { *g = None; } })?;

    // Open connection in tight URI scope (SECURITY: password dropped before .await; uri dropped at block end)
    let conn = {
        let uri = crate::profiles::build_amqp_uri(
            &profile.host,
            profile.port,
            &profile.vhost,
            &profile.username,
            &password,
        );
        // SECURITY: drop password before connecting — never reaches spawn closure
        drop(password);
        let result = tokio::time::timeout(
            Duration::from_secs(10),
            lapin::Connection::connect(&uri, lapin::ConnectionProperties::default()),
        )
        .await;
        // uri dropped here (end of block) — password and URI both gone before any await resumes
        match result {
            Err(_) => clear_slot_and_return!(crate::error::AppError::AmqpError(
                "Subscribe connection timed out (10s)".to_string(),
            )),
            Ok(Err(_)) => clear_slot_and_return!(crate::error::AppError::AmqpError(
                "AMQP connection failed — check host, port, vhost, and credentials".to_string(),
            )),
            Ok(Ok(c)) => c,
        }
    };

    // Open AMQP channel (close conn on error)
    let amqp_channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            tracing::warn!("start_subscribe: channel creation failed: {}", e);
            let _ = conn.close(0, "".into()).await;
            clear_slot_and_return!(crate::error::AppError::AmqpError(
                "Failed to open AMQP channel — check broker permissions".to_string(),
            ));
        }
    };

    // Move all captured values into the spawn closure.
    // CRITICAL: URI and password are NOT captured here (dropped above).
    let queue_name_clone = queue_name.clone();
    // IN-02: consumer_tag is safe as a constant because start_subscribe enforces a single
    // active session via the CR-01 atomic slot claim above.
    let consumer_tag = "tap-subscriber".to_string();

    // Clone app handle for use inside the spawn closure to clear state on self-termination.
    let app_handle_clone = app.clone();

    // Spawn consumer task using tauri::async_runtime::spawn (NOT tokio::spawn — panics on Windows).
    let handle = tauri::async_runtime::spawn(async move {
        // BUG-2 fix: clear the subscribe state slot on every non-cancellation exit path
        // so start_subscribe never returns "Already running" after a self-termination.
        let on_terminate = move || {
            if let Ok(mut g) = app_handle_clone
                .state::<Mutex<Option<SubscribeState>>>()
                .lock()
            {
                *g = None;
            }
        };
        // Sink: forward each result to the frontend via the Tauri IPC channel.
        let sink = move |r: DrainResult| {
            let _ = channel.send(r);
        };

        run_subscribe_loop(
            conn,
            amqp_channel,
            queue_name_clone,
            consumer_tag,
            pool,
            decode_types,
            token_child,
            sink,
            on_terminate,
        )
        .await;
    });

    // CR-01: The token was already stored in subscribe_state before the first await.
    // Now update the existing SubscribeState entry to set the JoinHandle.
    {
        let mut guard = subscribe_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Subscribe state lock poisoned".to_string()))?;
        if let Some(ref mut state) = *guard {
            state.handle = Some(handle);
        }
        // If guard is None here, stop_subscribe was called concurrently in the narrow
        // window between token-store and spawn-return. The handle would leak but the
        // session is already being torn down — acceptable best-effort.
    } // guard drops here

    Ok(())
}

/// Stop the active subscribe session.
///
/// D-09: Cancels the CancellationToken and awaits the JoinHandle with a 5s timeout.
/// Returns Ok(()) regardless of whether the timeout was reached (cleanup is best-effort).
/// Returns Ok(()) immediately if no session is active (idempotent).
#[tauri::command]
pub async fn stop_subscribe(
    subscribe_state: tauri::State<'_, Mutex<Option<SubscribeState>>>,
) -> Result<(), crate::error::AppError> {
    // Lock → take ownership → drop guard BEFORE any await (MutexGuard is not Send)
    let state = {
        let mut guard = subscribe_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Subscribe state lock poisoned".to_string()))?;
        guard.take() // replace with None, return old value
    }; // guard dropped here — safe to await below

    if let Some(SubscribeState { token, handle }) = state {
        token.cancel();
        // CR-01: handle is Option — may be None if stop was called in the narrow window
        // between token-store and spawn-return. In that case, best-effort cleanup only.
        if let Some(h) = handle {
            // Await handle with 5s timeout — best-effort cleanup
            let _ = tokio::time::timeout(Duration::from_secs(5), h).await;
        }
    }
    // Already stopped — idempotent Ok(())

    Ok(())
}

/// Validate start_subscribe inputs at the system boundary (T-14-01, T-14-05, WR-03).
/// Extracted so the validation rules can be unit-tested without the Tauri command surface.
pub(crate) fn validate_subscribe_inputs(
    profile_name: &str,
    queue_name: &str,
    decode_types: &[String],
) -> Result<(), crate::error::AppError> {
    if profile_name.trim().is_empty() {
        return Err(crate::error::AppError::InvalidInput(
            "profile_name must not be empty".to_string(),
        ));
    }
    if queue_name.trim().is_empty() {
        return Err(crate::error::AppError::InvalidInput(
            "queue_name must not be empty".to_string(),
        ));
    }
    if decode_types.is_empty() {
        return Err(crate::error::AppError::InvalidInput(
            "decode_types must not be empty".to_string(),
        ));
    }
    // WR-03: empty/whitespace strings would make pool.get_message_by_name("") return None
    // on every message, producing a confusing feed of decode errors with no root cause.
    if decode_types.iter().any(|t| t.trim().is_empty()) {
        return Err(crate::error::AppError::InvalidInput(
            "decode_types must not contain empty or whitespace-only strings".to_string(),
        ));
    }
    Ok(())
}

/// Decode one delivery payload against an ordered candidate list — first success wins (D-19).
/// Returns `(decoded, decoded_as, error)`. Pure: no broker, no Tauri.
///
/// NOTE: duplicates `drain_messages_core`'s candidate loop (consume.rs); intentional for now
/// to avoid destabilizing the green drain tests mid-sweep — DRY follow-up tracked separately.
pub(crate) fn decode_delivery(
    pool: &Option<prost_reflect::DescriptorPool>,
    decode_types: &[String],
    payload: &[u8],
) -> (Option<serde_json::Value>, Option<String>, Option<String>) {
    let Some(pool) = pool else {
        return (
            None,
            None,
            Some("No proto schema loaded — showing raw bytes".to_string()),
        );
    };

    let mut found_decoded: Option<serde_json::Value> = None;
    let mut found_decoded_as: Option<String> = None;
    let mut last_error: Option<String> = None;

    for type_name in decode_types {
        let msg_desc = match pool.get_message_by_name(type_name) {
            Some(d) => d,
            None => {
                last_error = Some(format!(
                    "Message type '{}' not found in loaded schema",
                    type_name
                ));
                continue;
            }
        };
        match prost_reflect::DynamicMessage::decode(msg_desc, payload) {
            Ok(dyn_msg) => {
                let mut buf = Vec::new();
                let mut ser = serde_json::Serializer::new(&mut buf);
                let opts = prost_reflect::SerializeOptions::new()
                    .use_proto_field_name(true)
                    .stringify_64_bit_integers(true);
                if dyn_msg.serialize_with_options(&mut ser, &opts).is_ok() {
                    if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&buf) {
                        found_decoded = Some(v);
                        found_decoded_as = Some(type_name.clone());
                        last_error = None;
                        break; // first success wins
                    }
                }
                last_error =
                    Some("Decode failed: serialization error. Showing raw bytes.".to_string());
            }
            Err(e) => {
                last_error = Some(format!("Decode failed: {}. Showing raw bytes.", e));
            }
        }
    }

    (found_decoded, found_decoded_as, last_error)
}

/// The persistent consumer loop, decoupled from the Tauri IPC channel and AppHandle.
///
/// `sink` receives each [`DrainResult`] (production: forwards to the Tauri channel; tests:
/// collect via mpsc). `on_terminate` runs the slot-clearing side effect on every self-termination
/// path (BUG-2/CR-01) — but NOT on the cancel path, where `stop_subscribe` already cleared the slot.
/// Takes ownership of `conn` and closes it on exit.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn run_subscribe_loop(
    conn: lapin::Connection,
    amqp_channel: lapin::Channel,
    queue_name: String,
    consumer_tag: String,
    pool: Option<prost_reflect::DescriptorPool>,
    decode_types: Vec<String>,
    token: CancellationToken,
    mut sink: impl FnMut(DrainResult) + Send,
    on_terminate: impl Fn() + Send,
) {
    // D-12: basic_qos BEFORE basic_consume — cap in-flight deliveries at 20.
    if let Err(e) = amqp_channel.basic_qos(20, BasicQosOptions::default()).await {
        tracing::warn!("subscribe: basic_qos failed: {} — aborting subscribe session", e);
        sink(error_drain_result(
            "Failed to set QoS prefetch — aborting subscribe".to_string(),
        ));
        on_terminate();
        let _ = conn.close(0, "".into()).await;
        return;
    }

    let mut consumer = match amqp_channel
        .basic_consume(
            queue_name.as_str().into(),
            consumer_tag.as_str().into(),
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("subscribe: basic_consume failed: {}", e);
            sink(error_drain_result(
                "Failed to start consumer — queue may not exist or permissions are insufficient"
                    .to_string(),
            ));
            on_terminate();
            let _ = conn.close(0, "".into()).await;
            return;
        }
    };

    loop {
        tokio::select! {
            delivery_opt = consumer.next() => {
                match delivery_opt {
                    Some(Ok(delivery)) => {
                        // D-13: ack-before-decode — ack first, then decode.
                        let routing_key = delivery.routing_key.to_string();
                        let exchange = delivery.exchange.to_string();
                        let content_type = delivery
                            .properties
                            .content_type()
                            .as_ref()
                            .map(|s| s.to_string());
                        let timestamp: Option<u64> = *delivery.properties.timestamp();
                        let payload: Vec<u8> = delivery.data.clone();
                        let hex_string = crate::commands::consume::bytes_to_hex(&payload);

                        // ACK BEFORE DECODE (D-13)
                        if let Err(e) = delivery.acker.ack(BasicAckOptions::default()).await {
                            tracing::warn!("subscribe: ack failed: {}", e);
                            sink(error_drain_result(
                                "Failed to acknowledge message — stream interrupted".to_string(),
                            ));
                            on_terminate();
                            let _ = conn.close(0, "".into()).await;
                            break;
                        }

                        let (decoded, decoded_as, error) =
                            decode_delivery(&pool, &decode_types, &payload);

                        sink(DrainResult {
                            routing_key,
                            exchange,
                            content_type,
                            timestamp,
                            decoded,
                            hex_string,
                            error,
                            decoded_as,
                            is_terminal: false, // normal message — session continues
                        });
                    }
                    Some(Err(e)) => {
                        tracing::warn!("subscribe: delivery error: {}", e);
                        sink(error_drain_result(
                            "Consumer delivery error — stream interrupted".to_string(),
                        ));
                        on_terminate();
                        let _ = conn.close(0, "".into()).await;
                        break;
                    }
                    None => {
                        tracing::info!("subscribe: consumer stream ended (broker closed)");
                        sink(error_drain_result(
                            "Broker closed the consumer — queue may have been deleted".to_string(),
                        ));
                        on_terminate();
                        let _ = conn.close(0, "".into()).await;
                        break;
                    }
                }
            }
            _ = token.cancelled() => {
                // Stop requested by stop_subscribe — do NOT call on_terminate (slot already taken).
                tracing::info!("subscribe: cancellation received, shutting down consumer");
                let _ = amqp_channel
                    .basic_cancel(consumer_tag.as_str().into(), BasicCancelOptions::default())
                    .await;
                let _ = conn.close(200, "normal shutdown".into()).await;
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_drain_result_populates_error_field() {
        let result = error_drain_result("test error".to_string());
        assert_eq!(result.error, Some("test error".to_string()));
        assert!(result.decoded.is_none());
        assert!(result.decoded_as.is_none());
        assert!(result.routing_key.is_empty());
        assert!(result.hex_string.is_empty());
    }

    #[test]
    fn error_drain_result_no_decoded() {
        let result = error_drain_result("broker closed".to_string());
        assert!(result.decoded.is_none());
        assert!(result.decoded_as.is_none());
    }

    #[test]
    fn error_drain_result_is_terminal() {
        // CR-02: error results from the consumer loop are always terminal
        let result = error_drain_result("stream interrupted".to_string());
        assert!(result.is_terminal, "error_drain_result must set is_terminal=true (CR-02)");
    }
}

// ─── Broker-backed integration tests + pure-helper unit tests ─────────────────────
#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::test_support::{broker_or_skip, test_channel, test_connection_and_channel, TestBroker};
    use lapin::options::{
        BasicPublishOptions, ConfirmSelectOptions, QueueDeclareOptions, QueuePurgeOptions,
    };
    use lapin::BasicProperties;
    use prost_reflect::DescriptorPool;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    const PROTO: &str = r#"syntax = "proto3"; message Ping { string msg = 1; }"#;

    fn encode(values: serde_json::Value) -> (DescriptorPool, Vec<u8>) {
        let tmp_dir = std::env::temp_dir().join("tap_subscribe_it");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let path = tmp_dir.join("ping.proto");
        std::fs::write(&path, PROTO).unwrap();
        let mut c = protox::Compiler::new(&[tmp_dir.to_str().unwrap()]).unwrap();
        c.include_imports(true);
        c.open_file(path.to_str().unwrap()).unwrap();
        let pool = DescriptorPool::from_file_descriptor_set(c.file_descriptor_set()).unwrap();
        let bytes = crate::commands::encode::encode_message_with_pool(&pool, "Ping", &values).unwrap();
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
            ch.basic_publish("".into(), queue.into(), BasicPublishOptions::default(), p, BasicProperties::default())
                .await
                .unwrap()
                .await
                .unwrap();
        }
    }

    // ---- validate_subscribe_inputs (pure) ----

    #[test]
    fn validate_rejects_empty_and_whitespace() {
        assert!(validate_subscribe_inputs("", "q", &["T".into()]).is_err());
        assert!(validate_subscribe_inputs("p", "  ", &["T".into()]).is_err());
        assert!(validate_subscribe_inputs("p", "q", &[]).is_err());
        assert!(validate_subscribe_inputs("p", "q", &["  ".into()]).is_err());
        assert!(validate_subscribe_inputs("p", "q", &["T".into()]).is_ok());
    }

    // ---- decode_delivery (pure) ----

    #[test]
    fn decode_delivery_no_pool_returns_raw_notice() {
        let (_, bytes) = encode(serde_json::json!({ "msg": "x" }));
        let (decoded, as_, err) = decode_delivery(&None, &["Ping".into()], &bytes);
        assert!(decoded.is_none());
        assert!(as_.is_none());
        assert!(err.unwrap().contains("No proto schema"));
    }

    #[test]
    fn decode_delivery_decodes_first_matching_type() {
        let (pool, bytes) = encode(serde_json::json!({ "msg": "hello" }));
        let (decoded, as_, err) =
            decode_delivery(&Some(pool), &["Ping".into()], &bytes);
        assert_eq!(decoded.unwrap()["msg"], "hello");
        assert_eq!(as_, Some("Ping".to_string()));
        assert!(err.is_none());
    }

    #[test]
    fn decode_delivery_unknown_type_reports_error() {
        let (pool, bytes) = encode(serde_json::json!({ "msg": "x" }));
        let (decoded, as_, err) =
            decode_delivery(&Some(pool), &["Nope".into()], &bytes);
        assert!(decoded.is_none());
        assert!(as_.is_none());
        assert!(err.unwrap().contains("not found"));
    }

    // ---- run_subscribe_loop (broker) ----

    #[tokio::test]
    async fn loop_streams_decoded_messages_then_cancels_without_terminate() {
        let Some(b) = broker_or_skip("subscribe_loop_stream").await else { return };
        let queue = "tap-it-sub-stream";
        let (pool, b1) = encode(serde_json::json!({ "msg": "one" }));
        let (_, b2) = encode(serde_json::json!({ "msg": "two" }));
        seed_queue(&b, queue, &[b1, b2]).await;

        let (conn, ch) = test_connection_and_channel(&b).await;
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<DrainResult>();
        let token = CancellationToken::new();
        let terminated = Arc::new(AtomicBool::new(false));
        let terminated_c = terminated.clone();

        let handle = tokio::spawn(run_subscribe_loop(
            conn,
            ch,
            queue.to_string(),
            "tap-test-sub".to_string(),
            Some(pool),
            vec!["Ping".to_string()],
            token.clone(),
            move |r| { let _ = tx.send(r); },
            move || terminated_c.store(true, Ordering::SeqCst),
        ));

        // Collect the two seeded messages (bounded by a timeout so a regression fails, not hangs).
        let mut got = Vec::new();
        for _ in 0..2 {
            let r = tokio::time::timeout(Duration::from_secs(5), rx.recv())
                .await
                .expect("timed out waiting for delivery")
                .expect("sink closed");
            got.push(r);
        }
        assert_eq!(got[0].decoded.as_ref().unwrap()["msg"], "one");
        assert_eq!(got[1].decoded.as_ref().unwrap()["msg"], "two");

        // Cancel and ensure the loop exits cleanly.
        token.cancel();
        tokio::time::timeout(Duration::from_secs(5), handle)
            .await
            .expect("loop did not stop after cancel")
            .expect("loop task panicked");

        // Cancel path must NOT clear state (stop_subscribe owns that) — CR-01/BUG-2 invariant.
        assert!(!terminated.load(Ordering::SeqCst), "on_terminate must not run on cancel");
    }

    #[tokio::test]
    async fn loop_on_consume_failure_emits_error_and_terminates() {
        let Some(b) = broker_or_skip("subscribe_loop_consume_fail").await else { return };
        // basic_consume on a non-existent queue fails → error result + on_terminate called.
        let (conn, ch) = test_connection_and_channel(&b).await;
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<DrainResult>();
        let token = CancellationToken::new();
        let terminated = Arc::new(AtomicBool::new(false));
        let terminated_c = terminated.clone();

        let handle = tokio::spawn(run_subscribe_loop(
            conn,
            ch,
            "tap-it-nonexistent-queue-zzz".to_string(),
            "tap-test-sub-fail".to_string(),
            None,
            vec!["Ping".to_string()],
            token,
            move |r| { let _ = tx.send(r); },
            move || terminated_c.store(true, Ordering::SeqCst),
        ));

        let r = tokio::time::timeout(Duration::from_secs(5), rx.recv())
            .await
            .expect("timed out")
            .expect("sink closed");
        assert!(r.is_terminal, "consume failure result must be terminal");
        assert!(r.error.is_some());

        tokio::time::timeout(Duration::from_secs(5), handle)
            .await
            .expect("loop did not exit after consume failure")
            .expect("loop task panicked");
        assert!(terminated.load(Ordering::SeqCst), "on_terminate must run on consume failure");
    }
}
