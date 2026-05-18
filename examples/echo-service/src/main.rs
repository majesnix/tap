//! Mini RabbitMQ echo service for testing proto-sender's response queue reader.
//!
//! Polls SOURCE_QUEUE and republishes every message verbatim to REPLY_QUEUE so
//! you can use proto-sender to send to SOURCE_QUEUE and read the echo back from
//! REPLY_QUEUE without needing a real downstream service.
//!
//! # Quick start (local)
//!
//! ```sh
//! # Start RabbitMQ first:
//! docker compose up -d rabbitmq
//!
//! # Then run the echo service:
//! cargo run
//! ```
//!
//! # Quick start (Docker — echo service + RabbitMQ together)
//!
//! ```sh
//! docker compose up -d        # from the repo root
//! ```
//!
//! # Configuration (env vars — all optional)
//!
//! | Variable      | Default                              | Description                   |
//! |---------------|--------------------------------------|-------------------------------|
//! | AMQP_URL      | amqp://dev:dev@localhost:5672        | Broker URI                    |
//! | SOURCE_QUEUE  | test-queue                           | Queue to consume from         |
//! | REPLY_QUEUE   | test-queue.reply                     | Queue to echo messages into   |
//! | POLL_MS       | 200                                  | Poll interval when queue empty|
//! | RETRY_SECS    | 5                                    | Reconnect delay after failure |

use std::time::Duration;

use lapin::{
    options::{BasicAckOptions, BasicGetOptions, BasicPublishOptions, QueueDeclareOptions},
    types::{AMQPValue, FieldTable},
    BasicProperties, Connection, ConnectionProperties,
};

#[tokio::main]
async fn main() {
    let amqp_url = env("AMQP_URL", "amqp://dev:dev@localhost:5672");
    let source = env("SOURCE_QUEUE", "test-queue");
    let reply = env("REPLY_QUEUE", "test-queue.reply");
    let poll_ms: u64 = env("POLL_MS", "200").parse().unwrap_or(200);
    let retry_secs: u64 = env("RETRY_SECS", "5").parse().unwrap_or(5);

    println!("proto-sender echo service");
    println!("  source : {source}");
    println!("  reply  : {reply}");
    println!("  broker : {}", redact(&amqp_url));
    println!("  poll   : {poll_ms}ms | retry: {retry_secs}s");
    println!("  Ctrl-C to stop\n");

    loop {
        match run(&amqp_url, &source, &reply, poll_ms).await {
            Ok(()) => break, // clean Ctrl-C shutdown
            Err(e) => {
                eprintln!("Connection lost: {e}");
                eprintln!("Reconnecting in {retry_secs}s…");
                tokio::time::sleep(Duration::from_secs(retry_secs)).await;
            }
        }
    }
}

async fn run(
    amqp_url: &str,
    source: &str,
    reply: &str,
    poll_ms: u64,
) -> Result<(), lapin::Error> {
    let conn = connect_with_retry(amqp_url).await?;
    let channel = conn.create_channel().await?;

    // Declare both queues — idempotent, safe to call even if they already exist.
    for q in [source, reply] {
        channel
            .queue_declare(
                q.into(),
                QueueDeclareOptions {
                    durable: true,
                    ..QueueDeclareOptions::default()
                },
                FieldTable::default(),
            )
            .await?;
    }

    println!("Ready — listening on '{source}', echoing to '{reply}'\n");

    let mut count: u64 = 0;

    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {
                println!("\nShutting down — {count} message(s) echoed.");
                let _ = conn.close(0, "".into()).await;
                return Ok(());
            }
            result = channel.basic_get(source.into(), BasicGetOptions::default()) => {
                match result? {
                    None => {
                        tokio::time::sleep(Duration::from_millis(poll_ms)).await;
                    }
                    Some(msg) => {
                        let tag  = msg.delivery_tag;
                        let body = msg.data.clone();
                        let len  = body.len();

                        // Ack before republish — mirrors the D-10 convention in proto-sender.
                        channel.basic_ack(tag, BasicAckOptions::default()).await?;

                        let mut headers = FieldTable::default();
                        headers.insert(
                            "x-echo-reply".into(),
                            AMQPValue::LongString("Reply".into()),
                        );

                        channel
                            .basic_publish(
                                "".into(),     // default exchange — routes by queue name
                                reply.into(),
                                BasicPublishOptions::default(),
                                &body,
                                BasicProperties::default()
                                    .with_content_type("application/octet-stream".into())
                                    .with_headers(headers),
                            )
                            .await?;

                        count += 1;
                        println!("[{count}] Reply  {len} bytes  →  {reply}");
                    }
                }
            }
        }
    }
}

/// Connects to the broker, retrying every 3 seconds until successful.
/// This handles the race between docker compose starting this service and RabbitMQ.
async fn connect_with_retry(url: &str) -> Result<Connection, lapin::Error> {
    let mut attempt = 0u32;
    loop {
        attempt += 1;
        match Connection::connect(url, ConnectionProperties::default()).await {
            Ok(conn) => {
                if attempt > 1 {
                    println!("Connected (attempt {attempt}).");
                } else {
                    println!("Connected.");
                }
                return Ok(conn);
            }
            Err(e) => {
                eprintln!("Attempt {attempt}: broker not ready — {e}. Retrying in 3s…");
                tokio::time::sleep(Duration::from_secs(3)).await;
            }
        }
    }
}

fn env(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Redacts credentials from an AMQP URI for safe printing.
/// amqp://user:pass@host:port/vhost → amqp://***@host:port/vhost
fn redact(url: &str) -> String {
    if let (Some(scheme_end), Some(at)) = (url.find("://"), url.rfind('@')) {
        let scheme = &url[..scheme_end + 3];
        let host = &url[at + 1..];
        return format!("{scheme}***@{host}");
    }
    url.to_string()
}
