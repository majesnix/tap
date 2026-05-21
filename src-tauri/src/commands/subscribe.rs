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
use lapin::{
    options::{BasicAckOptions, BasicCancelOptions, BasicConsumeOptions, BasicQosOptions},
    types::FieldTable,
};
use tokio_util::sync::CancellationToken;

use crate::commands::consume::DrainResult;

/// Holds the state for an active subscribe session.
/// Stored in Tauri managed state as `Mutex<Option<SubscribeState>>`.
pub struct SubscribeState {
    pub token: CancellationToken,
    /// JoinHandle from tauri::async_runtime::spawn — NOT tokio::task::JoinHandle.
    /// Both implement Future, so tokio::time::timeout still works.
    pub handle: tauri::async_runtime::JoinHandle<()>,
}

/// Construct a DrainResult representing a broker-level delivery error.
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

    // D-08: Double-start guard — lock, check if Some, drop guard before await.
    {
        let guard = subscribe_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Subscribe state lock poisoned".to_string()))?;
        if guard.is_some() {
            return Err(crate::error::AppError::AmqpError(
                "Already running: stop the current session first".to_string(),
            ));
        }
    } // guard drops here — MUST drop before any await below

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
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

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
        result
            .map_err(|_| {
                crate::error::AppError::AmqpError(
                    "Subscribe connection timed out (10s)".to_string(),
                )
            })?
            .map_err(|_| {
                crate::error::AppError::AmqpError(
                    "AMQP connection failed — check host, port, vhost, and credentials".to_string(),
                )
            })?
    };

    // Open AMQP channel (close conn on error)
    let amqp_channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            tracing::warn!("start_subscribe: channel creation failed: {}", e);
            let _ = conn.close(0, "".into()).await;
            return Err(crate::error::AppError::AmqpError(
                "Failed to open AMQP channel — check broker permissions".to_string(),
            ));
        }
    };

    // Create a fresh CancellationToken for this session.
    let token = CancellationToken::new();
    let token_child = token.clone();

    // Move all captured values into the spawn closure.
    // CRITICAL: URI and password are NOT captured here (dropped above).
    let queue_name_clone = queue_name.clone();
    let consumer_tag = "proto-sender-subscriber".to_string();

    // Spawn consumer task using tauri::async_runtime::spawn (NOT tokio::spawn — panics on Windows).
    let handle = tauri::async_runtime::spawn(async move {
        // D-12: basic_qos BEFORE basic_consume — cap in-flight deliveries at 20.
        let _ = amqp_channel
            .basic_qos(20, BasicQosOptions::default())
            .await;

        let consumer = match amqp_channel
            .basic_consume(
                queue_name_clone.as_str().into(),
                consumer_tag.as_str().into(),
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await
        {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("start_subscribe: basic_consume failed: {}", e);
                let _ = channel.send(error_drain_result(
                    "Failed to start consumer — queue may not exist or permissions are insufficient".to_string(),
                ));
                let _ = conn.close(0, "".into()).await;
                return;
            }
        };

        let mut consumer = consumer;

        loop {
            tokio::select! {
                delivery_opt = consumer.next() => {
                    match delivery_opt {
                        Some(Ok(delivery)) => {
                            // D-13: ack-before-decode — ack first, then decode.
                            // Prevents poison-pill messages from blocking the queue.
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
                            if let Err(e) = delivery
                                .acker
                                .ack(BasicAckOptions::default())
                                .await
                            {
                                tracing::warn!("start_subscribe: ack failed: {}", e);
                                let _ = channel.send(error_drain_result(
                                    "Failed to acknowledge message — stream interrupted".to_string(),
                                ));
                                break;
                            }

                            // Decode: iterate decode_types, first success wins (matches drain_messages pattern)
                            let (decoded, decoded_as, error) = if let Some(ref pool) = pool {
                                let mut found_decoded: Option<serde_json::Value> = None;
                                let mut found_decoded_as: Option<String> = None;
                                let mut last_error: Option<String> = None;

                                'candidates: for type_name in &decode_types {
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
                                    match prost_reflect::DynamicMessage::decode(msg_desc, payload.as_ref()) {
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
                                                    break 'candidates;
                                                }
                                            }
                                            last_error = Some(
                                                "Decode failed: serialization error. Showing raw bytes.".to_string(),
                                            );
                                        }
                                        Err(e) => {
                                            last_error = Some(format!(
                                                "Decode failed: {}. Showing raw bytes.",
                                                e
                                            ));
                                        }
                                    }
                                }

                                (found_decoded, found_decoded_as, last_error)
                            } else {
                                (
                                    None,
                                    None,
                                    Some("No proto schema loaded — showing raw bytes".to_string()),
                                )
                            };

                            let result = DrainResult {
                                routing_key,
                                exchange,
                                content_type,
                                timestamp,
                                decoded,
                                hex_string,
                                error,
                                decoded_as,
                            };
                            let _ = channel.send(result);
                        }
                        Some(Err(e)) => {
                            tracing::warn!("start_subscribe: delivery error: {}", e);
                            let _ = channel.send(error_drain_result(
                                "Consumer delivery error — stream interrupted".to_string(),
                            ));
                            break;
                        }
                        None => {
                            // Broker closed the consumer stream (e.g., queue deleted)
                            tracing::info!("start_subscribe: consumer stream ended (broker closed)");
                            let _ = channel.send(error_drain_result(
                                "Broker closed the consumer — queue may have been deleted".to_string(),
                            ));
                            break;
                        }
                    }
                }
                _ = token_child.cancelled() => {
                    // Stop requested by stop_subscribe command
                    tracing::info!("start_subscribe: cancellation received, shutting down consumer");
                    let _ = amqp_channel
                        .basic_cancel(consumer_tag.as_str().into(), BasicCancelOptions::default())
                        .await;
                    let _ = conn.close(200, "normal shutdown".into()).await;
                    break;
                }
            }
        }
    });

    // Store SubscribeState in Tauri managed state.
    // Lock, store state, drop guard.
    {
        let mut guard = subscribe_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Subscribe state lock poisoned".to_string()))?;
        *guard = Some(SubscribeState { token, handle });
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
        // Await handle with 5s timeout — best-effort cleanup
        let _ = tokio::time::timeout(Duration::from_secs(5), handle).await;
    }
    // Already stopped — idempotent Ok(())

    Ok(())
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
}
