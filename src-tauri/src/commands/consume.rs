/// consume_message: Read a single protobuf message from a RabbitMQ queue.
///
/// SECURITY: AMQP URI contains cleartext password — built in a tight scope and
/// immediately dropped. Error messages are sanitized to avoid leaking credentials.
///
/// D-10 DEVIATION: Ack happens BEFORE decode — always. This prevents poison-pill
/// messages from blocking the queue. Decode errors are shown inline; the message
/// is removed from the queue regardless of decode outcome.
use crate::profiles::{consumer_tag, AmqpEndpoint, AMQP_CONNECT_TIMEOUT};
use futures_util::StreamExt;
use std::time::Duration;

/// How long a batch read waits for the next delivery before deciding the queue is drained.
/// One consumer with prefetch = count replaces `count` sequential basic.get round trips.
const BATCH_IDLE_TIMEOUT: Duration = Duration::from_millis(300);

/// Result type returned to the frontend.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsumeResult {
    pub empty: bool,
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
}

/// Convert a byte slice to a space-separated lowercase hex string.
/// Example: [0x0a, 0x05] → "0a 05"
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub async fn consume_message(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    message_type_name: String,
    pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<ConsumeResult, crate::error::AppError> {
    // Clone pool FIRST (before any .await — MutexGuard is not Send)
    let pool = {
        let guard = pool_state
            .lock()
            .map_err(|_| crate::error::AppError::EncodeError {
                field: "<root>".to_string(),
                message: "Internal state lock poisoned — restart the application".to_string(),
            })?;
        guard.clone() // O(1) — Arc-backed
    }; // guard drops here

    // Load credentials (sync, no await)
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;
    crate::profiles::ensure_writable(&profile)?;
    let endpoint = AmqpEndpoint::from_profile(&profile)?;

    consume_message_core(
        pool,
        &endpoint,
        password,
        queue_name,
        message_type_name,
    )
    .await
}

/// Pure async core for [`consume_message`]: basic_get one message, ack-before-decode.
/// Decoupled from Tauri/keychain so it can be integration-tested against a live broker.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn consume_message_core(
    pool: Option<prost_reflect::DescriptorPool>,
    endpoint: &AmqpEndpoint,
    password: String,
    queue_name: String,
    message_type_name: String,
) -> Result<ConsumeResult, crate::error::AppError> {
    // Require a loaded pool — single-message consume cannot decode without one.
    let pool = pool.ok_or_else(|| crate::error::AppError::EncodeError {
        field: "<root>".to_string(),
        message: "No proto file loaded".to_string(),
    })?;

    // SECURITY: URI built and dropped inside `connect`; errors are sanitized there.
    let conn = endpoint.connect(password, AMQP_CONNECT_TIMEOUT, "Consume").await?;

    // Step 4: Create channel (close conn on error)
    let channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            tracing::warn!("consume_message: channel creation failed: {}", e);
            let _ = conn.close(0, "".into()).await;
            return Err(crate::error::AppError::AmqpError(
                "Failed to open AMQP channel — check broker permissions".to_string(),
            ));
        }
    };

    // Step 5: basic_get (NON-BLOCKING — returns None on empty queue)
    let get_result = channel
        .basic_get(
            queue_name.as_str().into(),
            lapin::options::BasicGetOptions::default(),
        )
        .await;
    let msg = match get_result {
        Err(e) => {
            tracing::warn!("consume_message: basic_get failed: {}", e);
            let _ = conn.close(0, "".into()).await;
            return Err(crate::error::AppError::AmqpError(
                "Failed to read from queue — queue may have been deleted or connection was interrupted".to_string(),
            ));
        }
        Ok(None) => {
            // PITFALL 7: close connection even on empty queue — prevents TCP leak
            let _ = conn.close(0, "".into()).await;
            return Ok(ConsumeResult {
                empty: true,
                decoded: None,
                hex_string: String::new(),
                error: None,
            });
        }
        Ok(Some(msg)) => msg,
    };

    // Step 6: Extract payload
    let delivery_tag = msg.delivery_tag;
    let payload: Vec<u8> = msg.data.clone();
    let hex_string = bytes_to_hex(&payload);

    // Step 7: ACK BEFORE CLOSE — D-10: always ack, even if decode fails later
    // CRITICAL ORDER: ack → close (acking after close silently fails)
    if let Err(e) = channel
        .basic_ack(
            delivery_tag,
            lapin::options::BasicAckOptions::default(),
        )
        .await
    {
        tracing::warn!("consume_message: ack failed: {}", e);
        let _ = conn.close(0, "".into()).await;
        return Err(crate::error::AppError::AmqpError(
            "Failed to acknowledge message — message may be requeued by the broker".to_string(),
        ));
    }

    // Step 8: Close connection AFTER ack
    let _ = conn.close(0, "".into()).await;

    // Step 9: Decode (synchronous — pool already cloned, no more awaits needed)
    let msg_desc = match pool.get_message_by_name(&message_type_name) {
        Some(d) => d,
        None => {
            return Ok(ConsumeResult {
                empty: false,
                decoded: None,
                hex_string,
                error: Some(format!(
                    "Message type '{}' not found in loaded schema",
                    message_type_name
                )),
            })
        }
    };

    match prost_reflect::DynamicMessage::decode(msg_desc, payload.as_ref()) {
        Ok(dyn_msg) => {
            // DECISION (Open Question 1): use_proto_field_name = true
            // Users see their .proto field names (snake_case), not lowerCamelCase transforms.
            // prost-reflect SerializeOptions::use_proto_field_name(true) preserves exact names.
            let mut buf = Vec::new();
            let mut ser = serde_json::Serializer::new(&mut buf);
            let opts = prost_reflect::SerializeOptions::new()
                .use_proto_field_name(true)
                .stringify_64_bit_integers(true);
            dyn_msg
                .serialize_with_options(&mut ser, &opts)
                .map_err(|e| crate::error::AppError::EncodeError {
                    field: "<root>".to_string(),
                    message: e.to_string(),
                })?;
            let decoded: serde_json::Value = serde_json::from_slice(&buf).map_err(|e| {
                crate::error::AppError::EncodeError {
                    field: "<root>".to_string(),
                    message: e.to_string(),
                }
            })?;
            Ok(ConsumeResult {
                empty: false,
                decoded: Some(decoded),
                hex_string,
                error: None,
            })
        }
        Err(e) => {
            // D-10: message was already acked above. Return error inline — do NOT propagate as Err.
            Ok(ConsumeResult {
                empty: false,
                decoded: None,
                hex_string,
                error: Some(format!("Decode failed: {}. Showing raw bytes.", e)),
            })
        }
    }
}

/// Per-message result from a drain operation.
/// decoded_as: the winning message type name, None if no candidate decoded successfully (D-19).
/// is_terminal: true if this is the final message from a subscribe session (consumer self-terminated).
///   The frontend uses this to transition subscribeStatus back to "Idle" without user interaction (CR-02).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainResult {
    pub routing_key: String,
    pub exchange: String,
    pub content_type: Option<String>,
    pub correlation_id: Option<String>, // AMQP correlation_id property, None when the publisher did not set one
    pub timestamp: Option<u64>,       // seconds since epoch; None if publisher did not set it
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
    pub decoded_as: Option<String>,   // winning type name from message_type_names (D-19)
    pub is_terminal: bool,            // CR-02: true signals consumer self-terminated; frontend sets Idle
}

/// Wrapper returned by drain_messages (D-18).
/// partial_error is set when basic_get errors mid-loop; messages holds all already-acked results.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainOutcome {
    pub messages: Vec<DrainResult>,
    pub partial_error: Option<String>,
}

/// Drain up to `count` messages from `queue_name` using the active profile.
/// message_type_names: ordered candidate list — first type that decodes without error wins (D-19).
/// Retained companion: consume_message is kept for testing/scripting; UI uses drain_messages.
#[tauri::command]
pub async fn drain_messages(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    message_type_names: Vec<String>,
    count: u32,
    requeue: bool,
    pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<DrainOutcome, crate::error::AppError> {
    // Clone pool BEFORE any .await (MutexGuard is not Send)
    let pool = {
        let guard = pool_state.lock().map_err(|_| {
            crate::error::AppError::AmqpError("Descriptor pool lock poisoned".to_string())
        })?;
        guard.clone()
    };

    // Load credentials (sync, no await) — same as consume_message
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;
    // Peeking (requeue) leaves the queue as it was, so read-only profiles may do it.
    if !requeue {
        crate::profiles::ensure_writable(&profile)?;
    }
    let endpoint = AmqpEndpoint::from_profile(&profile)?;

    drain_messages_core(
        pool,
        &endpoint,
        password,
        queue_name,
        message_type_names,
        count,
        requeue,
    )
    .await
}

/// Pure async core for [`drain_messages`]: read up to `count` messages, first-candidate-decodes-wins.
///
/// `requeue = false` (Consume): each message is acked before decode and is gone.
/// `requeue = true` (Peek): messages are left unacknowledged while they are read and handed
/// back to the queue in one nack at the end, so the real consumer still gets them (they
/// carry the redelivered flag afterwards).
///
/// Decoupled from Tauri/keychain for integration testing.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn drain_messages_core(
    pool: Option<prost_reflect::DescriptorPool>,
    endpoint: &AmqpEndpoint,
    password: String,
    queue_name: String,
    message_type_names: Vec<String>,
    count: u32,
    requeue: bool,
) -> Result<DrainOutcome, crate::error::AppError> {
    // Validate inputs at system boundary (CLAUDE.md: validate at system boundaries)
    if message_type_names.is_empty() {
        return Err(crate::error::AppError::InvalidInput(
            "message_type_names must not be empty".to_string(),
        ));
    }
    if count == 0 || count > 500 {
        return Err(crate::error::AppError::InvalidInput(
            "count must be between 1 and 500".to_string(),
        ));
    }

    // SECURITY: URI built and dropped inside `connect`; errors are sanitized there.
    let conn = endpoint.connect(password, AMQP_CONNECT_TIMEOUT, "Drain").await?;

    let channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            tracing::warn!("drain_messages: channel creation failed: {}", e);
            let _ = conn.close(0, "".into()).await;
            return Err(crate::error::AppError::AmqpError(
                "Failed to open AMQP channel — check broker permissions".to_string(),
            ));
        }
    };

    let mut results: Vec<DrainResult> = Vec::new();
    let mut partial_error: Option<String> = None;
    // Peek: highest delivery tag read so far; one multiple-nack at the end requeues them all.
    let mut last_unacked_tag: Option<u64> = None;

    // One consumer with prefetch = count: the broker pushes the batch in one go instead of
    // answering `count` sequential basic.get round trips (D-13/D-18/D-19).
    let prefetch = u16::try_from(count).unwrap_or(u16::MAX);
    if let Err(e) = channel.basic_qos(prefetch, lapin::options::BasicQosOptions::default()).await {
        tracing::warn!("drain_messages: basic_qos failed: {}", e);
        let _ = conn.close(0, "".into()).await;
        return Err(crate::error::AppError::AmqpError(
            "Failed to set prefetch on the channel — check broker permissions".to_string(),
        ));
    }
    let tag = consumer_tag(if requeue { "peek" } else { "consume" });
    let mut consumer = match channel
        .basic_consume(
            queue_name.as_str().into(),
            tag.as_str().into(),
            lapin::options::BasicConsumeOptions::default(),
            lapin::types::FieldTable::default(),
        )
        .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("drain_messages: basic_consume failed: {}", e);
            let _ = conn.close(0, "".into()).await;
            return Err(crate::error::AppError::AmqpError(
                "Failed to read from queue — queue may have been deleted or connection was interrupted".to_string(),
            ));
        }
    };

    while results.len() < count as usize {
        let delivery = match tokio::time::timeout(BATCH_IDLE_TIMEOUT, consumer.next()).await {
            // Nothing arrived for a while: the queue is drained (D-02).
            Err(_) => break,
            Ok(None) => {
                partial_error = Some("Queue read interrupted — partial results returned".to_string());
                break;
            }
            Ok(Some(Err(e))) => {
                // Mid-batch error — preserve already-read messages (D-18)
                tracing::warn!("drain_messages: delivery failed mid-batch: {}", e);
                partial_error = Some("Queue read interrupted — partial results returned".to_string());
                break;
            }
            Ok(Some(Ok(delivery))) => delivery,
        };

        // Extract AMQP metadata — ShortString.to_string() required (RESEARCH Pitfall 7)
        let routing_key = delivery.routing_key.to_string();
        let exchange = delivery.exchange.to_string();
        let content_type = delivery
            .properties
            .content_type()
            .as_ref()
            .map(|s| s.to_string());
        let correlation_id = delivery.properties.correlation_id().as_ref().map(|s| s.to_string());
        let timestamp: Option<u64> = *delivery.properties.timestamp();
        let payload: Vec<u8> = delivery.data.clone();
        let delivery_tag = delivery.delivery_tag;
        let hex_string = bytes_to_hex(&payload);

        if requeue {
            // Peek: leave it unacknowledged; it goes back in one nack after the loop.
            last_unacked_tag = Some(delivery_tag);
        } else {
            // ACK BEFORE DECODE (D-14: ack-before-decode — critical order)
            if let Err(e) = delivery.acker.ack(lapin::options::BasicAckOptions::default()).await {
                tracing::warn!("drain_messages: ack failed mid-batch: {}", e);
                partial_error = Some("Failed to acknowledge a message — partial results returned, message may be requeued".to_string());
                break;
            }
        }

        // Decode: iterate message_type_names, first success wins (D-19)
        let (decoded, decoded_as, error) = if let Some(pool) = &pool {
            let mut found_decoded: Option<serde_json::Value> = None;
            let mut found_decoded_as: Option<String> = None;
            let mut last_error: Option<String> = None;

            'candidates: for type_name in &message_type_names {
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
                        if dyn_msg
                            .serialize_with_options(&mut ser, &opts)
                            .is_ok()
                        {
                            if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&buf) {
                                found_decoded = Some(v);
                                found_decoded_as = Some(type_name.clone());
                                last_error = None;
                                break 'candidates; // first success wins
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
                Some("No proto schema loaded — cannot decode".to_string()),
            )
        };

        results.push(DrainResult {
            routing_key,
            exchange,
            content_type,
            correlation_id,
            timestamp,
            decoded,
            hex_string,
            error,
            decoded_as,
            is_terminal: false, // batch reads are never terminal
        });
    }

    // Stop the broker from pushing anything further before we hand back or close.
    let _ = channel
        .basic_cancel(tag.as_str().into(), lapin::options::BasicCancelOptions::default())
        .await;

    // Peek: hand everything back to the queue before closing (closing would also requeue,
    // but an explicit nack makes the intent visible and keeps ordering deterministic).
    if let Some(tag) = last_unacked_tag {
        if let Err(e) = channel
            .basic_nack(
                tag,
                lapin::options::BasicNackOptions { multiple: true, requeue: true },
            )
            .await
        {
            tracing::warn!("drain_messages: requeue after peek failed: {}", e);
        }
    }

    // Close connection after loop, even on partial error
    let _ = conn.close(0, "".into()).await;

    Ok(DrainOutcome {
        messages: results,
        partial_error,
    })
}

#[cfg(test)]
mod tests {
    use super::bytes_to_hex;

    #[test]
    fn bytes_to_hex_empty() {
        assert_eq!(bytes_to_hex(&[]), "");
    }

    #[test]
    fn bytes_to_hex_single_byte() {
        assert_eq!(bytes_to_hex(&[0x0a]), "0a");
    }

    #[test]
    fn bytes_to_hex_multiple_bytes() {
        assert_eq!(bytes_to_hex(&[0x0a, 0x05, 0x68]), "0a 05 68");
    }

    #[test]
    fn consume_result_empty_sentinel() {
        let r = super::ConsumeResult {
            empty: true,
            decoded: None,
            hex_string: String::new(),
            error: None,
        };
        assert!(r.empty);
        assert!(r.decoded.is_none());
        assert!(r.hex_string.is_empty());
        assert!(r.error.is_none());
    }

    // TDD RED: These tests reference DrainResult and DrainOutcome structs with all
    // required fields including decoded_as (D-19). They will fail to compile until
    // the structs are added in Task 1 GREEN phase.
    #[test]
    fn drain_result_construction_sentinel() {
        let r = super::DrainResult {
            routing_key: "test.key".to_string(),
            exchange: "my-exchange".to_string(),
            content_type: Some("application/protobuf".to_string()),
            correlation_id: None,
            timestamp: Some(1_700_000_000u64),
            decoded: None,
            hex_string: "0a 05".to_string(),
            error: None,
            decoded_as: Some("MyMessage".to_string()), // D-19: winning type name
            is_terminal: false,
        };
        assert_eq!(r.routing_key, "test.key");
        assert_eq!(r.decoded_as, Some("MyMessage".to_string()));
        assert!(r.error.is_none());
        assert!(!r.is_terminal);
    }

    #[test]
    fn drain_outcome_construction_sentinel() {
        let outcome = super::DrainOutcome {
            messages: vec![],
            partial_error: None,
        };
        assert!(outcome.messages.is_empty());
        assert!(outcome.partial_error.is_none());
    }

    #[test]
    fn drain_result_no_decode_sentinel() {
        let r = super::DrainResult {
            routing_key: String::new(),
            exchange: String::new(),
            content_type: None,
            correlation_id: None,
            timestamp: None,
            decoded: None,
            hex_string: String::new(),
            error: Some("Decode failed: bad wire type. Showing raw bytes.".to_string()),
            decoded_as: None, // D-19: None when no candidate succeeded
            is_terminal: false,
        };
        assert!(r.decoded.is_none());
        assert!(r.decoded_as.is_none());
        assert!(r.error.is_some());
        assert!(!r.is_terminal);
    }
}

// ─── Broker-backed integration tests ─────────────────────────────────────────────
#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::test_support::{broker_or_skip, test_channel, TestBroker};
    use lapin::options::{
        BasicPublishOptions, ConfirmSelectOptions, QueueDeclareOptions, QueuePurgeOptions,
    };
    use lapin::types::FieldTable;
    use lapin::BasicProperties;
    use prost_reflect::DescriptorPool;

    /// Build a pool from inline proto and encode a message to wire bytes.
    fn encode(proto: &str, file: &str, msg_type: &str, values: serde_json::Value) -> (DescriptorPool, Vec<u8>) {
        let tmp_dir = std::env::temp_dir().join("tap_consume_it");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let path = tmp_dir.join(file);
        std::fs::write(&path, proto).unwrap();
        let mut c = protox::Compiler::new(&[tmp_dir.to_str().unwrap()]).unwrap();
        c.include_imports(true);
        c.open_file(path.to_str().unwrap()).unwrap();
        let pool = DescriptorPool::from_file_descriptor_set(c.file_descriptor_set()).unwrap();
        let bytes =
            crate::commands::encode::encode_message_with_pool(&pool, msg_type, &values).unwrap();
        (pool, bytes)
    }

    /// Declare+purge a queue and publish raw payloads to it (default exchange), with confirms.
    async fn seed_queue(b: &TestBroker, queue: &str, payloads: &[Vec<u8>]) {
        let ch = test_channel(b).await;
        // RabbitMQ 4 rejects transient non-exclusive queues, so declare durable.
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

    const PROTO: &str = r#"syntax = "proto3"; message Item { string name = 1; int32 qty = 2; }"#;

    #[tokio::test]
    async fn consume_no_pool_errors_without_broker() {
        let res = consume_message_core(
            None, &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(),
            "q".to_string(), "Item".to_string(),
        )
        .await;
        assert!(matches!(res, Err(crate::error::AppError::EncodeError { .. })));
    }

    #[tokio::test]
    async fn consume_empty_queue_returns_empty_sentinel() {
        let Some(b) = broker_or_skip("consume_empty").await else { return };
        let queue = "tap-it-consume-empty";
        seed_queue(&b, queue, &[]).await;
        let (pool, _) = encode(PROTO, "c_empty.proto", "Item", serde_json::json!({}));
        let res = consume_message_core(
            Some(pool), &b.endpoint(), b.password.clone(),
            queue.to_string(), "Item".to_string(),
        )
        .await
        .unwrap();
        assert!(res.empty);
        crate::test_support::delete_queue(&b, queue).await;
    }

    #[tokio::test]
    async fn consume_decodes_a_published_message() {
        let Some(b) = broker_or_skip("consume_decode").await else { return };
        let queue = "tap-it-consume-decode";
        let (pool, bytes) = encode(PROTO, "c_dec.proto", "Item", serde_json::json!({ "name": "widget", "qty": 5 }));
        seed_queue(&b, queue, &[bytes]).await;
        let res = consume_message_core(
            Some(pool), &b.endpoint(), b.password.clone(),
            queue.to_string(), "Item".to_string(),
        )
        .await
        .unwrap();
        assert!(!res.empty);
        assert_eq!(res.decoded.as_ref().unwrap()["name"], "widget");
        assert!(res.error.is_none());
        crate::test_support::delete_queue(&b, queue).await;
    }

    #[tokio::test]
    async fn consume_unknown_type_returns_inline_error() {
        let Some(b) = broker_or_skip("consume_unknown").await else { return };
        let queue = "tap-it-consume-unknown";
        let (pool, bytes) = encode(PROTO, "c_unk.proto", "Item", serde_json::json!({ "name": "x" }));
        seed_queue(&b, queue, &[bytes]).await;
        let res = consume_message_core(
            Some(pool), &b.endpoint(), b.password.clone(),
            queue.to_string(), "NotAType".to_string(),
        )
        .await
        .unwrap();
        assert!(!res.empty);
        assert!(res.decoded.is_none());
        assert!(res.error.unwrap().contains("not found"));
        crate::test_support::delete_queue(&b, queue).await;
    }

    #[tokio::test]
    async fn drain_rejects_empty_type_names() {
        let res = drain_messages_core(
            None, &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(),
            "q".to_string(), vec![], 10, false,
        )
        .await;
        assert!(matches!(res, Err(crate::error::AppError::InvalidInput(_))));
    }

    #[tokio::test]
    async fn drain_rejects_invalid_count() {
        let res = drain_messages_core(
            None, &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev".to_string(),
            "q".to_string(), vec!["Item".to_string()], 0, false,
        )
        .await;
        assert!(matches!(res, Err(crate::error::AppError::InvalidInput(_))));
    }

    #[tokio::test]
    async fn drain_drains_multiple_messages() {
        let Some(b) = broker_or_skip("drain_multi").await else { return };
        let queue = "tap-it-drain-multi";
        let (pool, b1) = encode(PROTO, "d1.proto", "Item", serde_json::json!({ "name": "a", "qty": 1 }));
        let (_, b2) = encode(PROTO, "d1.proto", "Item", serde_json::json!({ "name": "b", "qty": 2 }));
        let (_, b3) = encode(PROTO, "d1.proto", "Item", serde_json::json!({ "name": "c", "qty": 3 }));
        seed_queue(&b, queue, &[b1, b2, b3]).await;
        let outcome = drain_messages_core(
            Some(pool), &b.endpoint(), b.password.clone(),
            queue.to_string(), vec!["Item".to_string()], 10, false,
        )
        .await
        .unwrap();
        assert_eq!(outcome.messages.len(), 3);
        assert!(outcome.partial_error.is_none());
        assert_eq!(outcome.messages[0].decoded_as, Some("Item".to_string()));
        crate::test_support::delete_queue(&b, queue).await;
    }

    #[tokio::test]
    async fn drain_without_pool_reports_decode_error_per_message() {
        let Some(b) = broker_or_skip("drain_no_pool").await else { return };
        let queue = "tap-it-drain-nopool";
        let (_, bytes) = encode(PROTO, "dnp.proto", "Item", serde_json::json!({ "name": "x" }));
        seed_queue(&b, queue, &[bytes]).await;
        let outcome = drain_messages_core(
            None, &b.endpoint(), b.password.clone(),
            queue.to_string(), vec!["Item".to_string()], 10, false,
        )
        .await
        .unwrap();
        assert_eq!(outcome.messages.len(), 1);
        assert!(outcome.messages[0].decoded.is_none());
        assert!(outcome.messages[0].error.as_ref().unwrap().contains("No proto schema"));
        crate::test_support::delete_queue(&b, queue).await;
    }

    #[tokio::test]
    async fn peek_returns_messages_and_leaves_them_on_the_queue() {
        let Some(b) = broker_or_skip("peek").await else { return };
        let queue = "tap-it-peek";
        let (pool, b1) = encode(PROTO, "peek1.proto", "Item", serde_json::json!({ "name": "a", "qty": 1 }));
        let (_, b2) = encode(PROTO, "peek2.proto", "Item", serde_json::json!({ "name": "b", "qty": 2 }));
        let (_, b3) = encode(PROTO, "peek3.proto", "Item", serde_json::json!({ "name": "c", "qty": 3 }));
        seed_queue(&b, queue, &[b1, b2, b3]).await;

        let peeked = drain_messages_core(
            Some(pool.clone()), &b.endpoint(), b.password.clone(),
            queue.to_string(), vec!["Item".to_string()], 2, true,
        )
        .await
        .unwrap();
        assert_eq!(peeked.messages.len(), 2);
        assert_eq!(peeked.messages[0].decoded.as_ref().unwrap()["name"], "a");
        assert_eq!(peeked.messages[1].decoded.as_ref().unwrap()["name"], "b");

        // Everything is still on the queue for the real consumer.
        let all = drain_messages_core(
            Some(pool), &b.endpoint(), b.password.clone(),
            queue.to_string(), vec!["Item".to_string()], 10, false,
        )
        .await
        .unwrap();
        assert_eq!(all.messages.len(), 3, "peek must requeue what it read");
        crate::test_support::delete_queue(&b, queue).await;
    }
}
