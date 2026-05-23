# Technology Stack — v1.6 Plan Runner

**Project:** Tap
**Milestone:** v1.6 Plan Runner
**Researched:** 2026-05-23
**Scope:** Additions and changes needed beyond the existing v1.5 stack.

---

## Verdict: Minimal additions. One new Rust crate. Zero new npm packages.

The Plan Runner feature maps cleanly onto the existing stack. The analysis below documents what each new capability uses, which existing primitive covers it, and what (little) needs to be added.

---

## New Rust Crate: `uuid`

**Add to Cargo.toml:**
```toml
uuid = { version = "1", features = ["v4"] }
```

**Why:** The Plan Runner needs to generate correlation IDs to match responses to their originating steps. `uuid::Uuid::new_v4().to_string()` is the standard approach.

**Status:** Already present in `Cargo.lock` as a transitive dependency at v1.23.1. Adding it as a direct dependency makes the intent explicit and locks the feature set. No version resolution impact — the same version is used.

**Why not a string timestamp or counter?** Correlation IDs must be globally unique even if two plans run concurrently or if the reply queue has leftover messages from a previous run. UUID v4 is collision-free without coordination.

---

## No New npm Packages

All Plan Runner frontend capabilities are covered by the existing stack:

| Capability | Existing package |
|---|---|
| Step reordering drag-and-drop | `@dnd-kit/core` 6.x — already integrated at AppLayout level |
| Step editor form state | `react-hook-form` 7.x + `zod` 4.x |
| Runner state machine (Pending / Sending / WaitingResponse / Done / Error) | Zustand 5.x discriminated union slice |
| Toast notifications (step errors, plan done) | `sonner` 2.x |
| JSON field values, block apply | `@uiw/react-codemirror` 4.x — already present |
| Plan persistence | `@tauri-apps/plugin-store` 2.x — already present |

**Do NOT add:** XState, any workflow/state-machine library, JSON Schema validators, or a second form library. The per-step status is a discriminated union (`{ status: 'pending' | 'sending' | 'waiting_response' | 'done' | 'error' }`), not a state chart that needs a library.

---

## Existing Crates — How Each Covers a Plan Runner Capability

### 1. Plan + Step Data Serialization (`serde` + `tauri-plugin-store`)

**Capability:** Persist complex nested plan/step structures across restarts.

**How it works:** `tauri-plugin-store` serializes arbitrary `serde_json::Value` trees. A `Plan` struct with nested `Vec<Step>` serializes via `#[derive(Serialize, Deserialize)]` identically to the flat structures already stored (message history, blocks). There is no documented depth or size cap on the store.

**Required discipline — add a `schema_version` field to the plan root:**
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Plan {
    pub schema_version: u32,  // = 1; increment on breaking changes
    pub id: String,
    pub name: String,
    pub steps: Vec<Step>,
    pub created_at: u64,
    pub updated_at: u64,
}
```
Mirror with a zod schema on the JS side for runtime validation at load time. This prevents silent data corruption if the store file is edited manually or migrated between app versions.

**Confidence:** HIGH — pattern is identical to existing block storage.

### 2. Multi-Queue Concurrent Response Monitoring (Tauri Channel + lapin + tokio)

**Capability:** Watch N reply queues simultaneously during a plan run, stream all arriving messages to the frontend's shared feed.

**Key fact verified:** `tauri::ipc::Channel<T>` implements `Clone`, `Send`, and `Sync` (confirmed via docs.rs). It can be safely cloned across tasks — each spawned task gets its own clone that writes to the same frontend listener.

**Pattern — single Channel, N consumer tasks:**
```rust
// channel: tauri::ipc::Channel<PlanEvent> — passed in from the Tauri command
// For each reply queue the plan needs to watch:
let ch = channel.clone();
let token = root_token.child_token();
tauri::async_runtime::spawn(async move {
    let mut consumer = amqp_channel
        .basic_consume(queue_name, consumer_tag, opts, FieldTable::default())
        .await?;
    loop {
        tokio::select! {
            delivery_opt = consumer.next() => { /* decode, send via ch */ }
            _ = token.cancelled() => break,
        }
    }
});
```

All tasks write to the same `Channel<PlanEvent>`. The frontend receives a single ordered stream and dispatches by `queue` and `correlation_id` fields on the event.

**Why not `futures::stream::select_all`?** The per-task + shared Channel approach gives independent cancellation per queue using child `CancellationToken`s. This is needed when a step's wait-window closes but other steps' response queues are still open. `select_all` would require polling all streams from a single task and loses per-stream cancellation without additional complexity.

**Existing primitives used:**

| Primitive | Source | Already in project |
|---|---|---|
| `tauri::ipc::Channel<T>` clone | tauri 2.x | Yes — used in `subscribe.rs` |
| `lapin::Consumer` (impl `Stream`) | lapin 4.x | Yes — confirmed in lapin source |
| `futures_util::StreamExt` | futures-util 0.3 | Yes — imported in `subscribe.rs` |
| `tokio_util::sync::CancellationToken` child tokens | tokio-util 0.7 | Yes — used in `subscribe.rs` |
| `tauri::async_runtime::spawn` | tauri 2.x | Yes — established pattern |

**No new crate needed.**

### 3. CorrelationId-Based Response Matching (`tokio::sync`)

**Capability:** When a step sends a message with a correlation ID, match the reply on the reply queue by that same ID.

**Pattern — oneshot registry:**
```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};

type CorrelationRegistry = Arc<Mutex<HashMap<String, oneshot::Sender<Delivery>>>>;
```

The runner holds a `CorrelationRegistry`. Before sending a step's message, it inserts `(correlation_id, tx)`. The reply-queue consumer checks each delivery's `correlation_id` property; on match, fires the `oneshot::Sender` and removes the entry. The runner step awaits `rx` with `tokio::time::timeout`.

The three step execution modes map as follows:

| Mode | Implementation |
|---|---|
| Wait for correlationId match | `tokio::time::timeout(step.timeout, rx).await` where rx is the oneshot receiver |
| Wait for first arrival | Reply consumer sends all deliveries to a `tokio::sync::mpsc`; step awaits first recv with timeout |
| No-wait with delay | `tokio::time::sleep(step.delay).await` after publish; no consumer needed |

**Existing primitives used:**

| Primitive | Tokio feature | Already enabled |
|---|---|---|
| `tokio::sync::oneshot` | "sync" | Yes |
| `tokio::sync::Mutex` | "sync" | Yes |
| `tokio::time::timeout` | "time" | Yes |
| `tokio::time::sleep` | "time" | Yes |
| `std::collections::HashMap` | stdlib | Yes |

**No new crate needed.**

### 4. Plan Run Cancellation (`tokio-util` + `tokio`)

**Capability:** "Stop" button cancels an in-flight plan, tearing down all consumer tasks cleanly.

**Pattern:** One root `CancellationToken` per plan run. Each consumer task holds a child token (`root_token.child_token()`). `root_token.cancel()` propagates to all children. Use `tokio::task::JoinSet` to collect and await all spawned tasks:

```rust
let mut set = tokio::task::JoinSet::new();
set.spawn(consumer_task_a);
set.spawn(consumer_task_b);
// On stop:
root_token.cancel();
let _ = tokio::time::timeout(Duration::from_secs(5), set.join_all()).await;
```

`tokio::task::JoinSet` is in the `"rt"` feature which is already enabled.

**Existing primitives used:**
- `tokio_util::sync::CancellationToken` — already in Cargo.toml
- `tokio::task::JoinSet` — in existing tokio "rt" feature
- `tauri::async_runtime::spawn` — established pattern

**No new crate needed.**

### 5. Reply Queue Lifecycle (lapin — existing)

Two reply queue strategies are viable with existing lapin — this is a design decision, not a stack gap:

| Strategy | lapin call | Tradeoff |
|---|---|---|
| Per-run exclusive auto-delete queue | `queue_declare` with `exclusive: true, auto_delete: true` | Clean teardown; no name collision; queue disappears when connection closes |
| User-specified persistent reply queue per step | Reuse existing queue config | User controls lifetime; leftover messages from prior runs possible |

Both use the existing `lapin::Channel::queue_declare` API. The recommended approach is to allow an optional `reply_queue` override per step, with a fallback to a per-run auto-generated exclusive queue (declared once on plan start, shared across all steps). This keeps noise out of the broker and removes manual cleanup.

---

## Tokio Feature Additions: None Required

Current Cargo.toml:
```toml
tokio = { version = "1", features = ["rt", "time", "sync"] }
```

- `"rt"` covers `tokio::task::JoinSet` and `tauri::async_runtime::spawn`
- `"time"` covers `tokio::time::timeout` and `tokio::time::sleep`
- `"sync"` covers `tokio::sync::oneshot`, `tokio::sync::Mutex`, `tokio::sync::mpsc`

No feature additions needed.

---

## Summary of Changes

### Cargo.toml — one addition

```toml
uuid = { version = "1", features = ["v4"] }
```

### package.json — no additions

### Existing stack coverage for all new capabilities

| Capability | Crate / package | API |
|---|---|---|
| Correlation ID generation | `uuid` (new direct dep) | `Uuid::new_v4().to_string()` |
| Multi-queue streaming | `tauri::ipc::Channel<T>` clone | `channel.clone()` per spawned task |
| Consumer stream iteration | `lapin::Consumer` + `futures_util::StreamExt` | `consumer.next()` in `tokio::select!` |
| Per-task cancellation | `tokio_util::sync::CancellationToken` | `root_token.child_token()` per task |
| Task collection + stop | `tokio::task::JoinSet` | `set.spawn()` / `set.join_all()` |
| CorrelationId match | `tokio::sync::oneshot` | `tx.send(delivery)` from consumer |
| No-wait delay | `tokio::time::sleep` | `sleep(step.delay).await` |
| Plan/step persistence | `tauri-plugin-store` + `serde` | Nested struct with `schema_version: u32` |
| Step form state | `react-hook-form` 7.x | Existing `useFieldArray` pattern |
| Runner state | Zustand 5.x | Discriminated union slice |
| Step reordering | `@dnd-kit/core` 6.x | Already at AppLayout level |
| Reply queue declaration | `lapin::Channel::queue_declare` | `exclusive: true, auto_delete: true` for per-run queue |

---

## Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| `uuid` as only new Rust dep | HIGH | Cargo.lock confirms it is the only missing direct dep; all other capabilities map to existing crates |
| Channel clone across tasks | HIGH | `impl Clone for Channel<TSend>` + `impl Send + Sync` confirmed via docs.rs |
| lapin Consumer as Stream | HIGH | `impl Stream for Consumer` confirmed in lapin 4.x source (Context7) |
| tokio JoinSet in "rt" feature | HIGH | Standard tokio documentation |
| oneshot/Mutex in "sync" feature | HIGH | Standard tokio documentation |
| tauri-plugin-store nested JSON | HIGH | Backed by `serde_json::Value`; no documented cap; identical to existing block/history storage |
| Zero new npm packages | HIGH | Feature-by-feature mapping against existing deps leaves no gap |

---

## Note for Architecture Phase

**AMQP connection topology is a key design decision.** PROJECT.md records "Ephemeral lapin connections per operation" as a validated Key Decision. The Plan Runner is the first feature where one user action spans N publishes plus M concurrent reply-queue consumers within a coherent unit of work.

Following the ephemeral-connection pattern strictly would mean opening N+M lapin connections per plan run — incorrect for this shape of work. The correct pattern is: **one `lapin::Connection` per plan run, with multiple `lapin::Channel`s on that connection** (one for publishes, one per concurrent reply-queue consumer). lapin fully supports this; it changes nothing about the stack, but it is an intentional deviation from the stated Key Decision that needs explicit documentation during architecture.

---

## Sources

- `tauri::ipc::Channel` Clone + Send + Sync: https://docs.rs/tauri/latest/tauri/ipc/struct.Channel.html
- `lapin::Consumer` Stream impl: https://docs.rs/lapin/latest/src/lapin/consumer.rs.html (Context7 verified)
- `tokio_util::sync::CancellationToken` existing usage: `src-tauri/src/commands/subscribe.rs`
- `uuid` v1.23.1 in Cargo.lock: `src-tauri/Cargo.lock`
- `tauri::async_runtime::spawn` pattern: established in `subscribe.rs` (not `tokio::spawn`)
- tokio feature flags: https://docs.rs/tokio/latest/tokio/#feature-flags
