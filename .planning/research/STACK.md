# Stack Research: Proto Sender v1.4 Advanced Response Consumer

**Researched:** 2026-05-20
**Milestone:** v1.4 — Drain Mode, Live Subscribe, Queue Depth, Export
**Overall confidence:** HIGH — all findings verified against docs.rs, official Tauri docs, crates.io, and project source

---

## Context: What is Already Shipped

The stack below is fully in place and working. Do NOT re-add or re-research any of it.

| Layer | Libraries / Versions |
|-------|----------------------|
| Rust backend | `lapin 4.7.4` (version constraint `"4"`), `reqwest 0.13`, `tokio 1.x` (features: `rt`, `time`), `serde 1.x`, `serde_json 1.x`, `percent-encoding 2`, `tauri 2.x` |
| Tauri plugins (Rust) | `tauri-plugin-store 2.x`, `tauri-plugin-dialog 2.x`, `tauri-plugin-fs 2.x` |
| Frontend | `@tauri-apps/api 2.11.0`, `zustand 5.x`, `react-hook-form 7.x`, `shadcn/ui`, `tailwindcss 4.x`, `sonner 2.x` |
| Already implemented | `fetch_queue_depth` Tauri command (uses `messages` field from `/api/queues/{vhost}/{queue}`), `useResponseStore.queueDepth: number | null` |

Note: `lapin 4.7.4` is the current latest — confirmed via docs.rs/crate/lapin/latest (released 2026-05-12). The `"4"` constraint in `Cargo.toml` picks it up automatically.

---

## Summary

Four new capabilities are needed for v1.4. Research by feature:

**Drain mode** (basic_get loop): No new deps. Ephemeral connection pattern, returns `Vec<ConsumedMessage>` in one IPC call.

**Live subscribe mode** (persistent consumer): Two new Rust deps — `tokio-util` for `CancellationToken` (cooperative task stopping) and a `tokio::sync` feature flag on the existing `tokio` entry. No new npm deps — `Channel<T>` is already in `@tauri-apps/api/core`.

**Queue depth**: Already implemented. Zero stack work.

**Export** (JSON + CSV): One new Rust dep — `csv 1.4` for CSV writing. JSON export uses `serde_json` (already present). No new npm deps.

---

## New Dependencies

### Rust (`Cargo.toml`)

| Crate | Version | Purpose | Why this, not alternatives |
|-------|---------|---------|---------------------------|
| `tokio-util` | `0.7` | `CancellationToken` for cooperative cancellation of the live consumer loop | Purpose-built for this pattern. `cancel()` + `select!` stops a `while let Some(delivery) = consumer.next().await` loop cleanly from a separate `stop_consume` command. More composable than `oneshot` (can cancel multiple sub-tasks, exposes `is_cancelled()` guard). Maintained by the tokio-rs team at 0.7.18 as of Jan 2026. |
| `csv` | `1.4` | Write CSV rows for export | BurntSushi's `csv` crate is the de facto standard (183M+ downloads, 1.4.0 released 2025-10-17). `wtr.serialize(&msg)` with Serde derives maps a `ConsumedMessage` struct to a row with one call. No other CSV writer has meaningful adoption in the Rust ecosystem. |

Also update the existing `tokio` entry to add the `sync` feature:

```toml
# BEFORE
tokio = { version = "1", features = ["rt", "time"] }

# AFTER
tokio = { version = "1", features = ["rt", "time", "sync"] }
```

`tokio::sync::Mutex` is required for `ConsumerState` because the mutex guard must be held across `.await` points when starting a session. `std::sync::Mutex` cannot be held across `.await` — using it here would require dropping before every await, which defeats the purpose of guarded optional state.

**Full Cargo.toml additions:**

```toml
tokio-util = { version = "0.7", features = ["rt"] }
csv = "1.4"
```

Feature flag verification: `tokio-util`'s `rt` feature enables `tokio/sync` + `futures-util` (confirmed in `tokio-util/Cargo.toml`). The `sync` module containing `CancellationToken` is unconditionally compiled in `tokio-util` — it has no `cfg(feature)` gate. So `features = ["rt"]` is both sufficient (no extra flag needed) and correct (also makes `futures-util` + `StreamExt` available for the consumer loop — see note below).

### JavaScript (none)

`Channel<T>` is exported from `@tauri-apps/api/core`, which is part of the already-installed `@tauri-apps/api 2.11.0`. No new npm packages.

---

## Integration Notes by Feature

### Drain Mode (basic_get loop)

Remains ephemeral — one `drain_messages` Tauri command, loop `basic_get` up to N times, close connection, return `Vec<ConsumedMessage>`.

- No new deps needed.
- Array return is correct for a dev tool at N <= 500 — single IPC response, no partial-load UI state.
- Reuses the existing `consume_message` pattern from `commands/consume.rs`.
- `no_ack` does not apply to `basic_get` — `basic_get` always requires explicit ack per message. Ack each delivery before continuing the loop (consistent with existing ack-before-decode decision D-10).

---

### Live Subscribe Mode (persistent consumer)

**This is the architecturally significant change in v1.4.** The existing Key Decision "Ephemeral lapin connections per operation" cannot apply here.

**Rust managed state:**

```rust
use tokio_util::sync::CancellationToken;
use tokio::sync::Mutex;

pub struct ConsumerSession {
    pub token: CancellationToken,
}

pub type ConsumerState = Mutex<Option<ConsumerSession>>;
```

Register in `lib.rs` builder setup alongside the existing `DescriptorPool` state:

```rust
.manage(ConsumerState::new(None))
```

**`start_consume` command signature:**

```rust
#[tauri::command]
pub async fn start_consume(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    message_type_name: String,
    on_message: tauri::ipc::Channel<ConsumedMessage>,
    consumer_state: tauri::State<'_, ConsumerState>,
    pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<(), crate::error::AppError>
```

The command opens a lapin connection, starts `basic_consume` with `no_ack: true`, stores a `ConsumerSession` in managed state, then spawns a background task via `tauri::async_runtime::spawn` (not `tokio::spawn` — see constraint below). The command returns `Ok(())` immediately after spawning. The task drives the consumer loop and sends each delivery via `on_message.send(msg)`.

**Consumer loop pattern:**

```rust
// Required import — consumer.next() comes from StreamExt, not the Consumer type itself.
// lapin::Consumer implements futures_core::Stream; .next() is the extension method.
// futures_util::StreamExt is available because tokio-util's "rt" feature pulls in futures-util.
use futures_util::StreamExt;

tauri::async_runtime::spawn(async move {
    loop {
        tokio::select! {
            _ = token.cancelled() => break,
            delivery = consumer.next() => {
                match delivery {
                    Some(Ok(d)) => { let _ = on_message.send(encode_delivery(d)); }
                    Some(Err(_)) => break,
                    None => break,
                }
            }
        }
    }
    let _ = conn.close(0, "".into()).await;
});
```

**`stop_consume` command:**

```rust
#[tauri::command]
pub async fn stop_consume(
    consumer_state: tauri::State<'_, ConsumerState>,
) -> Result<(), crate::error::AppError> {
    let mut guard = consumer_state.lock().await;
    if let Some(session) = guard.take() {
        session.token.cancel();
    }
    Ok(())
}
```

`guard.take()` removes the session from state. `token.cancel()` wakes the `select!` branch in the background task, which then breaks the loop and drops the connection.

**BasicConsumeOptions for live subscribe:**

```rust
BasicConsumeOptions {
    no_ack: true,   // server acks implicitly — no ack roundtrip per message
    no_local: false,
    exclusive: false,
    nowait: false,
}
```

`no_ack: true` is correct here. Consistent with the milestone requirement "ack immediately on consume". Eliminates per-message ack roundtrips, which matters for a streaming consumer.

**Backpressure (explicit non-decision):** `tauri::ipc::Channel<T>` is unbounded — if the broker delivers messages faster than the frontend can render them, the Rust task will accumulate sends without throttling. For a dev tool where message rates are low (developer-level traffic, not production load), this is acceptable. If the UI freezes under load, add a bounded `tokio::sync::mpsc` channel between the consumer task and the `on_message.send()` call, and drop messages when the channel is full.

---

### Streaming to Frontend via `tauri::ipc::Channel<T>`

Use `Channel<T>`, not `AppHandle::emit`. Official Tauri 2 documentation is explicit: "The Tauri channel is the recommended mechanism for streaming data... The event system is not designed for low latency or high throughput situations."

| Mechanism | Type-safe | Throughput | Verdict |
|-----------|-----------|------------|---------|
| `tauri::ipc::Channel<T>` | Yes | High, ordered | **Use for message stream** |
| `AppHandle::emit` | No (JSON only) | Low | Avoid for per-message delivery |

**Rust:** Command receives `on_message: tauri::ipc::Channel<ConsumedMessage>` as a parameter. Calls `on_message.send(msg)` per delivery. The command spawns and returns immediately; the channel stays open until the task exits.

**JavaScript (`@tauri-apps/api/core`, already installed):**

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const onMessage = new Channel<ConsumedMessage>();
onMessage.onmessage = (msg) => {
  // prepend to messages array in Zustand store
};
await invoke('start_consume', { profileName, queueName, messageTypeName, onMessage });
```

`Channel` is part of `@tauri-apps/api` 2.x and available from `@tauri-apps/api/core`. No new npm install needed.

**Channel lifecycle:** The `Channel` is garbage-collected on the JS side when `onMessage` goes out of scope (or the component unmounts). Call `stop_consume` explicitly in the component cleanup (`useEffect` return / unmount) to cancel the Rust task and close the lapin connection. Do not rely on GC to stop the Rust side.

---

### Queue Depth Indicator

**Already implemented.** `fetch_queue_depth` is a registered Tauri command in `lib.rs`, implemented in `connection.rs`. It calls `GET /api/queues/{vhost}/{queue}` and deserializes the `messages` field (total = ready + unacknowledged). `useResponseStore` already has `queueDepth: number | null` with a `setQueueDepth` action.

No stack work needed. Phase implementation work only: wire the existing command to the UI before/during consume.

If the frontend needs to show `messages_ready` and `messages_unacknowledged` separately, extend `QueueDepthApiInfo` in `connection.rs`:

```rust
#[derive(Deserialize)]
struct QueueDepthApiInfo {
    messages: u64,
    messages_ready: u64,              // add if needed
    messages_unacknowledged: u64,     // add if needed
}
```

No new dep, no API change.

---

### Export (JSON and CSV)

**JSON export:** No new deps.

```rust
let json = serde_json::to_string_pretty(&messages)
    .map_err(|e| AppError::ExportError(e.to_string()))?;
std::fs::write(&dest_path, json)
    .map_err(|e| AppError::ExportError(e.to_string()))?;
```

**CSV export:** Requires `csv 1.4`.

```rust
use csv::Writer;

let mut wtr = Writer::from_path(&dest_path)
    .map_err(|e| AppError::ExportError(e.to_string()))?;
for msg in &messages {
    wtr.serialize(msg)
        .map_err(|e| AppError::ExportError(e.to_string()))?;
}
wtr.flush().map_err(|e| AppError::ExportError(e.to_string()))?;
```

**File path from save dialog:** `tauri-plugin-dialog` is already installed. Use the existing JS dialog API to get a user-chosen path, pass it to an `export_messages` Rust command as a `String`. On the Rust side, `std::fs::write` (JSON) or `csv::Writer::from_path` (CSV) do not need `tauri-plugin-fs` — the path is already user-approved by the dialog, and `std::fs` has no sandbox restrictions in a Tauri Rust command.

**No `tauri-plugin-fs` needed for export.** The plugin is for JavaScript-side file access; Rust-side writes use `std::fs` directly.

---

## What NOT to Add

| Rejected | Reason |
|----------|--------|
| `amqprs` | Would replace working `lapin 4.7.4`. No throughput benefit for a dev tool. Breaking API change. |
| `tokio::spawn` | Panics on Windows in Tauri 2 event listeners (confirmed: tauri-apps/tauri#10289). Always use `tauri::async_runtime::spawn`. |
| `AppHandle::emit` for message streaming | Official Tauri docs: "not designed for low latency or high throughput situations." Use `Channel<T>`. |
| `rabbitmq-management-client` crate | Thin wrapper over two endpoints; `reqwest` already in place. Already rejected in v1.0. |
| `tauri-plugin-fs` for export | Only needed for JS-side file writes. Rust `std::fs` is sufficient after a dialog-approved path. |
| `@dnd-kit` additions | Sorting or reordering consume results is not in v1.4 scope. |
| `async_std` runtime | Tauri manages the tokio runtime. Do not add a second async runtime. |
| `#[tokio::main]` in `main.rs` | Creates nested runtime conflict with Tauri's embedded runtime. |
| `std::sync::Mutex` for `ConsumerState` | Cannot be held across `.await`. Use `tokio::sync::Mutex` for the consumer session state. |
| `lapin::basic_cancel` as the only stop mechanism | Stops the server consumer but the Rust task loop is still running. Pair with `CancellationToken` or rely on connection drop from `token.cancel()` + task exit. |
| `futures` crate (direct dep) | `futures_util::StreamExt` is available transitively via `tokio-util`'s `rt` feature. Adding the full `futures` crate is unnecessary. |

---

## Version Constraints

| Constraint | Detail |
|------------|--------|
| `tokio-util 0.7` | Must match `tokio 1.x`. Both maintained by tokio-rs. `tokio-util = "0.7"` resolves cleanly against `tokio = "1"`. |
| `tokio-util "rt"` feature | Enables `tokio/sync` + `futures-util`. `CancellationToken` has no feature gate in tokio-util's source (verified in `tokio-util/src/sync/mod.rs`). `"rt"` is the minimum feature needed and is sufficient. |
| `csv 1.4` | Uses `serde 1` for `serialize()` — no conflict with existing `serde = "1"`. |
| `tokio "sync"` feature | Add `"sync"` to the existing `tokio` `features` array. Currently `["rt", "time"]`; must become `["rt", "time", "sync"]`. |
| `futures_util::StreamExt` import | Required for `consumer.next()`. Available as a transitive dep; explicitly in scope when `tokio-util` `rt` feature is active. Import: `use futures_util::StreamExt;` |
| `tauri::ipc::Channel<T>` | Tauri 2.x only. Already on Tauri 2. |
| `@tauri-apps/api` `Channel` export | Available from `@tauri-apps/api/core` in version 2.x. Already at 2.11.0. |
| `tauri::async_runtime::spawn` | Required for all background tasks — do not use `tokio::spawn` directly. |
| `BasicConsumeOptions.no_ack` | Set `true` for live subscribe to skip server-side ack roundtrips. Per lapin docs: "The server implicitly acknowledges each message after it has been sent." |

---

## Architecture Note: Connection Lifecycle Shift

The existing Key Decision "Ephemeral lapin connections per operation" cannot apply to live subscribe mode. This is the only architectural delta in v1.4.

**Drain mode** stays ephemeral (one command, returns array, closes connection).

**Live subscribe** uses Tauri managed state (`ConsumerState`) holding an `Option<ConsumerSession>`. Two new commands are registered: `start_consume` (opens connection, spawns task, returns immediately) and `stop_consume` (cancels token, task exits and drops connection). The frontend calls `start_consume` with a `Channel<ConsumedMessage>` argument and receives messages via `onmessage` until it calls `stop_consume` or the component unmounts.

---

## Sources

- `lapin` 4.7.4 (current): https://docs.rs/crate/lapin/latest
- `lapin` `Consumer` + `basic_consume` + `BasicConsumeOptions.no_ack`: https://docs.rs/lapin/latest/lapin/struct.Consumer.html
- `lapin` `basic_cancel`: https://docs.rs/lapin/latest/lapin/struct.Channel.html
- `tokio-util` `CancellationToken`: https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html
- `tokio-util` feature flags (rt covers sync + futures-util): https://docs.rs/crate/tokio-util/latest/features
- `tokio-util` sync module (no feature gate): https://github.com/tokio-rs/tokio/blob/master/tokio-util/src/sync/mod.rs
- `csv` 1.4.0: https://docs.rs/csv/latest/csv/
- Tauri 2 `Channel<T>` as streaming recommendation: https://v2.tauri.app/develop/calling-frontend/
- Tauri 2 `Channel<T>` Rust command API: https://v2.tauri.app/develop/calling-rust/
- Tauri 2 State Management + `tokio::sync::Mutex` guidance: https://v2.tauri.app/develop/state-management/
- Tauri async background task pattern (rfdonnelly): https://rfdonnelly.github.io/posts/tauri-async-rust-process/
- Tauri `tokio::spawn` panic on Windows (issue #10289): https://github.com/tauri-apps/tauri/issues/10289
- `fetch_queue_depth` already implemented: `/Users/majesnix/gits/proto-sender/src-tauri/src/commands/connection.rs` (lines 266–318)
- `consume_message` ephemeral pattern: `/Users/majesnix/gits/proto-sender/src-tauri/src/commands/consume.rs`
