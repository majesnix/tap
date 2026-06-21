use lapin::{
    options::{BasicPublishOptions, ConfirmSelectOptions},
    BasicProperties, Confirmation, Connection, ConnectionProperties,
};
use std::time::Duration;
use tauri::AppHandle;

use crate::error::AppError;
use crate::profiles::build_amqp_uri;

/// Delivery outcome returned by publish_message.
/// D-02: Flat serializable struct with a status string field.
/// status values: "ack" | "nack" | "returned" | "timeout"
#[derive(Debug, serde::Serialize)]
pub struct PublishOutcome {
    pub status: String,
}

/// Publish a binary protobuf message to RabbitMQ using an ephemeral connection.
///
/// PUBL-01: exchange = "" (default exchange), routing_key = queue_name
/// PUBL-02: exchange = named_exchange, routing_key = routing_key
///
/// CRITICAL: exchange = "" is the AMQP default exchange (not "default" or "amq.default").
///
/// SECURITY: AMQP URI contains cleartext password — built in a tight scope and
/// immediately dropped; error messages from Connection::connect are sanitized to
/// avoid leaking the URI/password in AppError payloads sent to the frontend.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn publish_message(
    app: AppHandle,
    profile_name: String,
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
    content_type: Option<String>,
    delivery_mode: Option<u8>,
    ttl: Option<u32>,
    correlation_id: Option<String>,
    reply_to: Option<String>,
    headers: Option<Vec<(String, String)>>,
) -> Result<PublishOutcome, AppError> {
    // Load profile credentials
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

    publish_message_core(
        &profile.host,
        profile.port,
        &profile.vhost,
        &profile.username,
        password,
        exchange,
        routing_key,
        payload,
        content_type,
        delivery_mode,
        ttl,
        correlation_id,
        reply_to,
        headers,
    )
    .await
}

/// Pure async core for [`publish_message`]: connect, publish with confirms, map the outcome.
/// Decoupled from Tauri/keychain so it can be integration-tested against a live broker.
///
/// SECURITY: `password` is moved in, used to build the URI in a tight scope, and dropped
/// before connect; connect errors are sanitized (never propagate the cleartext URI).
#[allow(clippy::too_many_arguments)]
pub(crate) async fn publish_message_core(
    host: &str,
    port: u16,
    vhost: &str,
    username: &str,
    password: String,
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
    content_type: Option<String>,
    delivery_mode: Option<u8>,
    ttl: Option<u32>,
    correlation_id: Option<String>,
    reply_to: Option<String>,
    headers: Option<Vec<(String, String)>>,
) -> Result<PublishOutcome, AppError> {
    // T-03-02-05: Validate delivery_mode is 1 or 2 if provided
    if let Some(dm) = delivery_mode {
        if dm != 1 && dm != 2 {
            return Err(AppError::InvalidInput(format!(
                "delivery_mode must be 1 (non-persistent) or 2 (persistent), got {}",
                dm
            )));
        }
    }

    // WR-01: Build URI in a tight block so it is dropped before any error is
    // propagated. The connect error is replaced with a generic message to prevent
    // the password-containing URI from leaking into the AppError payload sent to
    // the frontend or captured by tracing.
    let conn = {
        let uri = build_amqp_uri(host, port, vhost, username, &password);
        // password is no longer needed — drop it before connecting
        drop(password);
        // uri is in scope only for the duration of this block
        let result = tokio::time::timeout(
            Duration::from_secs(10),
            Connection::connect(&uri, ConnectionProperties::default()),
        )
        .await;
        // uri is dropped here, before we inspect the result
        result
            .map_err(|_| AppError::AmqpError("Publish connection timed out (10s)".to_string()))?
            .map_err(|_| AppError::AmqpError("AMQP connection failed — check host, port, vhost, and credentials".to_string()))?
    };

    // CR-02: close the connection on any error path after this point so we do
    // not leak TCP connections when create_channel or basic_publish fails.
    let channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            let _ = conn.close(0, "".into()).await;
            return Err(AppError::AmqpError(e.to_string()));
        }
    };

    // CR-01: enable publisher confirm mode on the channel BEFORE publishing.
    // Without this call the channel is in normal (fire-and-forget) mode and the
    // Confirmation future returned by basic_publish resolves immediately with a
    // synthetic ack — the broker never actually acknowledges the message.
    if let Err(e) = channel
        .confirm_select(ConfirmSelectOptions::default())
        .await
    {
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }

    // D-04: default content_type is "application/octet-stream", NOT "application/x-protobuf"
    // content_type=None means the caller did not override → use the D-04 default
    let mut props = BasicProperties::default()
        .with_content_type("application/octet-stream".into());

    if let Some(ct) = content_type {
        props = props.with_content_type(ct.into());
    }
    if let Some(dm) = delivery_mode {
        props = props.with_delivery_mode(dm);
    }
    if let Some(t) = ttl {
        // CRITICAL: TTL is an AMQP ShortString — must convert u32 to string first
        props = props.with_expiration(t.to_string().into());
    }
    if let Some(cid) = correlation_id {
        props = props.with_correlation_id(cid.into());
    }
    if let Some(rt) = reply_to {
        props = props.with_reply_to(rt.into());
    }
    if let Some(hdrs) = headers {
        use lapin::types::{AMQPValue, FieldTable, LongString};
        let mut table = FieldTable::default();
        for (key, value) in hdrs {
            table.insert(
                key.into(),
                AMQPValue::LongString(LongString::from(value.into_bytes())),
            );
        }
        props = props.with_headers(table);
    }

    // Publish: exchange = "" for default exchange (PUBL-01), named exchange (PUBL-02)
    // Now that confirm mode is enabled (CR-01), the second .await is a real broker ack.
    // CRITICAL ORDER: (1) basic_publish → get confirm future, (2) await confirm future,
    // (3) close connection. Closing before (2) causes "invalid connection state: Closed".
    let confirm_future = match channel
        .basic_publish(
            exchange.as_str().into(),
            routing_key.as_str().into(),
            BasicPublishOptions { mandatory: true, ..Default::default() },
            &payload,
            props,
        )
        .await
    {
        Ok(f) => f,
        Err(e) => {
            let _ = conn.close(0, "".into()).await;
            return Err(AppError::AmqpError(e.to_string()));
        }
    };

    // D-03: 5-second timeout around broker confirmation — timeout returns Ok(timeout outcome),
    // not Err, because broker non-response is a delivery outcome not a command error.
    // CRITICAL: pass confirm_future (the Future itself) as the second argument — do NOT .await it
    // before passing. The outer .await drives the timeout Future.
    let confirm_result = tokio::time::timeout(
        Duration::from_secs(5),
        confirm_future,
    ).await;

    // D-05: Match on Confirmation variant to produce PublishOutcome.
    // Pitfall 2: Close connection BEFORE returning from the timeout branch.
    let outcome = match confirm_result {
        Err(_elapsed) => {
            // Broker did not confirm within 5 seconds — close connection and surface as outcome.
            let _ = conn.close(0, "".into()).await;
            return Ok(PublishOutcome { status: "timeout".to_string() });
        }
        Ok(Err(e)) => {
            // lapin internal error resolving the confirm future (not a delivery outcome).
            let _ = conn.close(0, "".into()).await;
            return Err(AppError::AmqpError(e.to_string()));
        }
        // D-05: Ack(None) = broker confirmed delivery, no return frame.
        Ok(Ok(Confirmation::Ack(None))) => PublishOutcome { status: "ack".to_string() },
        // D-05: Ack(Some(_)) = mandatory=true + no binding match → message returned by broker.
        Ok(Ok(Confirmation::Ack(Some(_returned)))) => PublishOutcome { status: "returned".to_string() },
        Ok(Ok(Confirmation::Nack(_))) => PublishOutcome { status: "nack".to_string() },
        Ok(Ok(Confirmation::NotRequested)) => {
            // Unreachable: confirm_select() is always called before publish (CR-01).
            PublishOutcome { status: "ack".to_string() }
        }
    };

    // CR-02: close connection after confirmation is received (non-timeout path).
    let _ = conn.close(0, "".into()).await;

    tracing::debug!(
        "Published message to exchange='{}' routing_key='{}' outcome='{}'",
        exchange,
        routing_key,
        outcome.status,
    );
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    // No-broker unit tests for the validation/contract surface.

    #[tokio::test]
    async fn rejects_invalid_delivery_mode() {
        let err = publish_message_core(
            "localhost", 5672, "/", "dev", "dev".to_string(),
            "".to_string(), "q".to_string(), vec![1, 2, 3],
            None, Some(3), None, None, None, None,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
    }

    #[tokio::test]
    async fn unreachable_host_returns_amqp_error() {
        let err = publish_message_core(
            "127.0.0.1", 1, "/", "dev", "dev".to_string(),
            "".to_string(), "q".to_string(), vec![1], None, None, None, None, None, None,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::AmqpError(_)), "got {err:?}");
    }

    // Broker-backed integration tests.

    #[tokio::test]
    async fn publish_to_default_exchange_existing_queue_acks() {
        let Some(b) = crate::test_support::broker_or_skip("publish_default_ack").await else {
            return;
        };
        // Default exchange ("") routes by queue name; "proto-test" exists (definitions.json).
        let outcome = publish_message_core(
            &b.host, b.port, &b.vhost, &b.username, b.password.clone(),
            "".to_string(), "proto-test".to_string(), vec![0x08, 0x96, 0x01],
            None, None, None, None, None, None,
        )
        .await
        .unwrap();
        assert_eq!(outcome.status, "ack");
    }

    #[tokio::test]
    async fn publish_unroutable_mandatory_is_returned() {
        let Some(b) = crate::test_support::broker_or_skip("publish_returned").await else {
            return;
        };
        // mandatory=true + no queue bound to this routing key → broker returns the message.
        let outcome = publish_message_core(
            &b.host, b.port, &b.vhost, &b.username, b.password.clone(),
            "".to_string(), "no-such-queue-xyz-123".to_string(), vec![1],
            None, None, None, None, None, None,
        )
        .await
        .unwrap();
        assert_eq!(outcome.status, "returned");
    }

    #[tokio::test]
    async fn publish_to_named_exchange_with_all_props_acks() {
        let Some(b) = crate::test_support::broker_or_skip("publish_named_props").await else {
            return;
        };
        // test-direct + routing key "proto.test" is bound to test-queue (definitions.json).
        // Exercises every optional-property branch (content_type/delivery_mode/ttl/corr/reply/headers).
        let outcome = publish_message_core(
            &b.host, b.port, &b.vhost, &b.username, b.password.clone(),
            "test-direct".to_string(), "proto.test".to_string(), vec![0x08, 0x01],
            Some("application/x-protobuf".to_string()),
            Some(2),
            Some(60000),
            Some("corr-1".to_string()),
            Some("reply-q".to_string()),
            Some(vec![("x-trace".to_string(), "abc".to_string())]),
        )
        .await
        .unwrap();
        assert_eq!(outcome.status, "ack");
    }
}
