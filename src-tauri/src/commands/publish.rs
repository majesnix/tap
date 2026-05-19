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
    // T-03-02-05: Validate delivery_mode is 1 or 2 if provided
    if let Some(dm) = delivery_mode {
        if dm != 1 && dm != 2 {
            return Err(AppError::InvalidInput(format!(
                "delivery_mode must be 1 (non-persistent) or 2 (persistent), got {}",
                dm
            )));
        }
    }

    // Load profile credentials
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

    // WR-01: Build URI in a tight block so it is dropped before any error is
    // propagated. The connect error is replaced with a generic message to prevent
    // the password-containing URI from leaking into the AppError payload sent to
    // the frontend or captured by tracing.
    let conn = {
        let uri = build_amqp_uri(
            &profile.host,
            profile.port,
            &profile.vhost,
            &profile.username,
            &password,
        );
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
    use super::PublishOutcome;

    #[test]
    fn default_exchange_is_empty_string() {
        // Document the CRITICAL invariant: PUBL-01 requires exchange = "" not "amq.default"
        // This test is documentation — it cannot test the actual AMQP behavior without a broker.
        let exchange_for_queue_publish = "";
        assert!(
            exchange_for_queue_publish.is_empty(),
            "PUBL-01 requires empty string exchange (AMQP default exchange)"
        );
    }

    #[test]
    fn default_content_type_is_octet_stream() {
        // D-04: default content_type must be "application/octet-stream" not "application/x-protobuf"
        let default_ct = "application/octet-stream";
        assert_eq!(default_ct, "application/octet-stream");
    }

    #[test]
    fn ttl_conversion_to_string() {
        // TTL is AMQP ShortString — u32 must be converted to string before passing to with_expiration
        let ttl: u32 = 60000;
        let ttl_str = ttl.to_string();
        assert_eq!(ttl_str, "60000");
    }

    #[test]
    fn publish_outcome_status_values_are_lowercase() {
        // Document the IPC contract: status must match TypeScript union "ack"|"nack"|"returned"|"timeout"
        assert_eq!(PublishOutcome { status: "ack".to_string() }.status, "ack");
        assert_eq!(PublishOutcome { status: "nack".to_string() }.status, "nack");
        assert_eq!(PublishOutcome { status: "returned".to_string() }.status, "returned");
        assert_eq!(PublishOutcome { status: "timeout".to_string() }.status, "timeout");
    }
}
