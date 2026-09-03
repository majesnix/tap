//! Shared helpers for broker-backed integration tests.
//!
//! Integration tests that talk to a live RabbitMQ are gated through
//! [`broker_or_skip`]. Locally (no broker running) they skip silently so the
//! normal `cargo test` stays green without docker. In CI, set `TAP_INTEGRATION=1`
//! so a missing broker fails loudly instead of silently skipping coverage.
//!
//! Connection parameters default to the `docker compose` RabbitMQ
//! (`localhost:5672`, vhost `/`, `dev`/`dev`) and can be overridden via env vars.
#![cfg(test)]

use lapin::{Connection, ConnectionProperties};
use std::time::Duration;

use crate::profiles::{AmqpEndpoint, ManagementEndpoint};

/// Connection parameters for the test broker.
#[derive(Clone)]
pub struct TestBroker {
    pub host: String,
    pub port: u16,
    pub vhost: String,
    pub username: String,
    pub password: String,
    pub management_port: u16,
}

impl TestBroker {
    /// Plain-AMQP endpoint for the test broker.
    pub fn endpoint(&self) -> AmqpEndpoint {
        AmqpEndpoint::plain(&self.host, self.port, &self.vhost, &self.username)
    }

    /// Plain-HTTP Management API endpoint for the test broker.
    pub fn management_endpoint(&self) -> ManagementEndpoint {
        ManagementEndpoint::plain(&self.host, self.management_port, &self.vhost, &self.username)
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Test broker parameters, sourced from env vars with docker-compose defaults.
pub fn test_broker() -> TestBroker {
    TestBroker {
        host: env_or("TAP_TEST_HOST", "localhost"),
        port: env_or("TAP_TEST_PORT", "5672").parse().expect("TAP_TEST_PORT must be a u16"),
        vhost: env_or("TAP_TEST_VHOST", "/"),
        username: env_or("TAP_TEST_USER", "dev"),
        password: env_or("TAP_TEST_PASS", "dev"),
        management_port: env_or("TAP_TEST_MGMT_PORT", "15672")
            .parse()
            .expect("TAP_TEST_MGMT_PORT must be a u16"),
    }
}

/// Return broker parameters if a broker is reachable, or `None` to skip the test.
///
/// - Broker reachable → `Some(TestBroker)`.
/// - Not reachable and `TAP_INTEGRATION=1` → panics (CI must provide a broker).
/// - Not reachable otherwise → prints a skip notice and returns `None`.
pub async fn broker_or_skip(test_name: &str) -> Option<TestBroker> {
    let b = test_broker();
    let uri = b.endpoint().uri(&b.password);
    let reachable = matches!(
        tokio::time::timeout(
            Duration::from_secs(3),
            Connection::connect(&uri, ConnectionProperties::default()),
        )
        .await,
        Ok(Ok(_))
    );

    if reachable {
        return Some(b);
    }
    if std::env::var("TAP_INTEGRATION").as_deref() == Ok("1") {
        panic!(
            "TAP_INTEGRATION=1 but no RabbitMQ broker reachable at {}:{}",
            b.host, b.port
        );
    }
    eprintln!(
        "[skip] {test_name}: no RabbitMQ broker at {}:{} (run `docker compose up -d rabbitmq`, \
         or set TAP_INTEGRATION=1 to require one)",
        b.host, b.port
    );
    None
}

/// Open a connection + channel against the test broker.
/// Returns both so callers that need to keep the `Connection` alive (or move it into
/// a core that closes it) can hold ownership rather than relying on channel-keepalive.
pub async fn test_connection_and_channel(b: &TestBroker) -> (lapin::Connection, lapin::Channel) {
    let uri = b.endpoint().uri(&b.password);
    let conn = Connection::connect(&uri, ConnectionProperties::default())
        .await
        .expect("test broker connect failed");
    let ch = conn.create_channel().await.expect("test channel open failed");
    (conn, ch)
}

/// Open a channel against the test broker — convenience for tests that need one.
pub async fn test_channel(b: &TestBroker) -> lapin::Channel {
    test_connection_and_channel(b).await.1
}

/// Delete a test queue so runs do not pile up on the developer's broker.
pub async fn delete_queue(b: &TestBroker, queue: &str) {
    let ch = test_channel(b).await;
    let _ = ch
        .queue_delete(queue.into(), lapin::options::QueueDeleteOptions::default())
        .await;
}

/// Delete a test exchange declared by a test.
pub async fn delete_exchange(b: &TestBroker, exchange: &str) {
    let ch = test_channel(b).await;
    let _ = ch
        .exchange_delete(exchange.into(), lapin::options::ExchangeDeleteOptions::default())
        .await;
}

/// Drop the messages a test published to a shared, pre-declared queue.
pub async fn purge_queue(b: &TestBroker, queue: &str) {
    let ch = test_channel(b).await;
    let _ = ch
        .queue_purge(queue.into(), lapin::options::QueuePurgeOptions::default())
        .await;
}
