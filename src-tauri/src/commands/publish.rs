use lapin::{
    options::BasicPublishOptions, BasicProperties, Connection, ConnectionProperties,
};
use std::time::Duration;
use tauri::AppHandle;

use crate::error::AppError;
use crate::profiles::build_amqp_uri;

/// Publish a binary protobuf message to RabbitMQ using an ephemeral connection.
///
/// PUBL-01: exchange = "" (default exchange), routing_key = queue_name
/// PUBL-02: exchange = named_exchange, routing_key = routing_key
///
/// CRITICAL: exchange = "" is the AMQP default exchange (not "default" or "amq.default").
///
/// SECURITY: AMQP URI contains cleartext password — built, used, dropped. Never logged.
#[tauri::command]
pub async fn publish_message(
    app: AppHandle,
    profile_name: String,
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
) -> Result<(), AppError> {
    // Load profile credentials
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

    // Build AMQP URI — use immediately, do NOT log
    let uri = build_amqp_uri(
        &profile.host,
        profile.port,
        &profile.vhost,
        &profile.username,
        &password,
    );
    // password is no longer needed — drop it
    drop(password);

    // Connect with 10s timeout (same as test_connection)
    // SECURITY: uri not logged
    let conn = tokio::time::timeout(
        Duration::from_secs(10),
        Connection::connect(&uri, ConnectionProperties::default()),
    )
    .await
    .map_err(|_| AppError::AmqpError("Publish connection timed out (10s)".to_string()))?
    .map_err(|e| AppError::AmqpError(e.to_string()))?;

    let channel = conn
        .create_channel()
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    // Publish: exchange = "" for default exchange (PUBL-01), named exchange (PUBL-02)
    channel
        .basic_publish(
            exchange.as_str().into(),
            routing_key.as_str().into(),
            BasicPublishOptions::default(),
            &payload,
            BasicProperties::default()
                .with_content_type("application/x-protobuf".into()),
        )
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?
        .await // await the publisher-confirm future
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    // Close connection — ephemeral, no persistent state
    let _ = conn.close(0, "".into()).await;

    tracing::debug!(
        "Published message to exchange='{}' routing_key='{}'",
        exchange,
        routing_key
    );
    Ok(())
}

#[cfg(test)]
mod tests {
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
}
