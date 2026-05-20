# Phase 14: Live Subscribe Mode - Research

**Researched:** 2026-05-21
**Domain:** Tauri 2.x Channel streaming / lapin 4.x basic_consume / React Zustand state extension
**Confidence:** HIGH

## Summary

Phase 14 adds a persistent AMQP `basic_consume` session that streams messages into the existing message feed in real time. The Rust backend spawns a long-running async task that forwards lapin `Consumer` deliveries through a Tauri `Channel<DrainResult>` to the frontend, with a `CancellationToken` for graceful stop and a `JoinHandle` for synchronous confirmation of termination. The frontend adds a mode toggle (Drain | Subscribe), subscribe controls, and a `subscribeStatus` field in `useResponseStore`.

The implementation is architecturally straightforward: all primitives are already present in the project's dependencies or can be made available with minor `Cargo.toml` changes. The most significant design constraint is the Stopping→Idle transition mechanism — CONTEXT.md D-09 implies the Channel drop signals Idle, but Tauri's `Channel<T>` has no frontend-observable close callback. The correct mechanism is: `stop_subscribe` cancels the token, awaits the JoinHandle (bounded by timeout), then returns `Ok(())`; the frontend transitions to Idle when the IPC call resolves. This is the prescribed approach and must be reflected in all plans.

Two Cargo.toml changes are required before implementation can begin: add `tokio-util = "0.7"` as an explicit dependency, and add `"sync"` to the tokio feature list. Both are currently absent (tokio-util is only transitive; `tokio/sync` feature is not activated). Without these, `tokio_util::sync::CancellationToken` will not compile.

**Primary recommendation:** Use `Channel<DrainResult>` + `CancellationToken` + `JoinHandle` stored in `std::sync::Mutex<Option<SubscribeState>>` in Tauri app state. Transition to Idle when `invoke("stop_subscribe")` resolves. Do not implement a no-message idle timeout — it causes spurious Error state on legitimately quiet queues.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Streaming delivery mechanism**
Use Tauri 2.x `Channel<T>` (from `@tauri-apps/api`) for real-time Rust→frontend delivery. Do not use `app.emit()` / `app.emit_to()` for message feed. The `Channel` is created on the frontend, passed as a parameter to `start_subscribe`, and messages are pushed via `channel.send(result)` in the Rust consumer loop. `app.emit()` is permitted for status transitions only.

**D-02 — Consumer loop structure**
The Rust consumer task uses `tokio::select!` combining `consumer.next()` and `cancellation_token.cancelled()`. The `basic_qos` prefetch limit is set before `basic_consume` is called. `lapin::Consumer` implements `futures_core::stream::Stream`, consumed via `.next()`.

**D-03 — Message payload type**
Reuse the existing `DrainResult` struct (from `commands/consume.rs`) as the Channel payload type. No new serialization type is needed.

**D-04 — Mode toggle UI**
Add a segmented Drain | Subscribe toggle in the toolbar (replacing or wrapping `ResponseQueuePicker`). When Subscribe is active, the Drain count input and Drain button are hidden; a Start / Stop Subscribe button and the status badge are shown instead.

**D-05 — Status badge**
The badge reflects `subscribeStatus` from `useResponseStore`: `Idle` (grey), `Running` (green), `Stopping` (amber), `Error` (red). Error state shows the error message from `subscribeError` on hover.

**D-06 — FIFO cap**
Reuse the existing `appendMessages` action (already capped at 500 FIFO). No separate buffer or queue is needed.

**D-07 — Stop signal**
Store a `CancellationToken` in Tauri app state under `Arc<Mutex<Option<CancellationToken>>>`. The `stop_subscribe` command cancels the token. Also store the `JoinHandle` to confirm task termination (see Stopping→Idle Mechanism below).

**D-08 — Start command signature**
```rust
#[tauri::command]
async fn start_subscribe(
    profile_name: String,
    queue_name: String,
    decode_types: Vec<String>,
    channel: tauri::ipc::Channel<DrainResult>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String>
```

**D-09 — Stop command and Idle transition**
`stop_subscribe` is a separate Tauri command. Frontend sets status to "Stopping" when it invokes `stop_subscribe`. The **correct** Idle transition mechanism: `stop_subscribe` cancels the CancellationToken AND awaits the JoinHandle (with a bounded timeout), then returns `Ok(())`. The frontend transitions to Idle when the `invoke("stop_subscribe")` promise resolves. (Note: The original D-09 wording "Channel drop signals the frontend callback to finalize the Idle transition" is incorrect — `Channel<T>` has no frontend-observable close callback in Tauri 2.x.)

**D-10 — Store additions**
`useResponseStore` gains:
- `subscribeStatus: SubscribeStatus` (`'Idle' | 'Running' | 'Stopping' | 'Error'`)
- `subscribeError: string | null`
- `setSubscribeStatus(status: SubscribeStatus, error?: string): void`

**D-11 — Auto-stop trigger**
A `useEffect` watching `[activeProfileName, connectionStatus]` in the Subscribe panel calls `handleStop()` when `connectionStatus !== 'Connected'` or when `activeProfileName` changes while status is `Running` or `Stopping`.

**D-12 — Prefetch limit**
`basic_qos(prefetch_count: 20)` is called on the lapin channel before `basic_consume`. Value of 20 is a reasonable default for a dev tool; not exposed as a setting in v1.4.

**D-13 — Ack on delivery**
Each delivered message is acked immediately using the delivery's `acker.ack(BasicAckOptions::default())` before decode — consistent with the existing drain ack-before-decode pattern.

### Claude's Discretion

- Exact prefetch count value (D-12 says 20; adjust within 10–50 range if there is a strong reason)
- Whether the `JoinHandle` and `CancellationToken` are co-located in a single `SubscribeState` struct or stored separately in `AppState` — co-location in a struct is recommended
- Exact timeout duration for awaiting JoinHandle in `stop_subscribe` (recommend 3–5 seconds)
- Whether to emit an app-level event for error state or rely solely on Channel metadata — Channel send with an error sentinel is simpler
- Test coverage granularity beyond the three core behaviors

### Deferred Ideas (OUT OF SCOPE)

- Message filtering in the subscribe feed
- Pause/resume subscribe without full stop
- Multiple concurrent subscribe sessions
- Configurable prefetch count in UI
- Dead-letter queue subscribe
- Exchange subscribe (queue only in v1.4)
- No-message idle timeout (30s timeout in `##Specifics` in CONTEXT.md) — **explicitly recommended against**: causes spurious Error state on legitimately quiet queues; omit entirely
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONS-05 | Live subscribe session delivering messages continuously until stopped | `lapin::Consumer` as Stream + `tokio::select!` + CancellationToken loop; Channel<DrainResult> for delivery |
| CONS-06 | Status badge showing Running/Stopping/Idle/Error | `subscribeStatus` field in useResponseStore; shadcn Badge component already in codebase |
| CONS-07 | Auto-stop on active profile change or disconnect | `useEffect` on `[activeProfileName, connectionStatus]` from useConnectionStore; calls handleStop() |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AMQP consumer lifecycle (start/stop) | API / Backend (Rust) | — | Connection and protocol logic must stay in Rust; no AMQP in browser |
| Real-time message delivery to UI | Tauri IPC (Channel<T>) | — | Channel<T> is the prescribed Tauri 2.x streaming primitive; replaces polling |
| Consumer task cancellation | API / Backend (Rust) | — | CancellationToken + JoinHandle owned by Tauri app state |
| Status badge rendering | Frontend (React) | — | Reads subscribeStatus from Zustand store |
| Mode toggle (Drain/Subscribe) | Frontend (React) | — | UI-only decision; no backend involvement |
| Auto-stop on profile change | Frontend (React) | — | useEffect watching connectionStore values |
| Message buffering (FIFO 500) | Frontend (React/Zustand) | — | appendMessages already implements this |
| Subscribe controls (Start/Stop) | Frontend (React) | — | Calls start_subscribe / stop_subscribe IPC commands |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lapin` | 4.7.4 | AMQP consumer via `basic_consume` | Already in Cargo.toml; project standard [VERIFIED: Cargo.toml] |
| `tokio_util::sync::CancellationToken` | 0.7.18 (tokio-util) | Stop signal for consumer task | Standard cancellation primitive for tokio tasks; pairs with `tokio::select!` [VERIFIED: Cargo.lock transitive] |
| `tokio::task::JoinHandle` | (tokio 1.x) | Await task termination in stop_subscribe | Part of tokio; already a project dep [VERIFIED: Cargo.toml] |
| `tauri::ipc::Channel<T>` | Tauri 2.x | Real-time Rust→JS streaming | Prescribed by D-01; no polling needed [VERIFIED: docs.rs/tauri] |
| `zustand` | 5.x | Subscribe status state | Already project standard [VERIFIED: package.json] |
| `@tauri-apps/api` | 2.x | Channel constructor on frontend | Already project standard [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `futures_util::StreamExt` | 0.3.32 | `.next()` on lapin Consumer | Required to call `.next()` on Stream trait; add to Rust imports [VERIFIED: Cargo.lock — futures-util 0.3.32 present] |
| `radix-ui` (ToggleGroup) | 1.4.3 | Mode toggle component | Already in package.json umbrella; wrap in shadcn-style component [VERIFIED: package.json + node_modules] |
| `shadcn/ui Badge` | (copied) | Status badge rendering | Check if already in src/components/ui/; create in Wave 0 if absent |

### Required Cargo.toml Changes

**CRITICAL — both changes are required before Wave 1:**

```toml
# Change 1: Add "sync" feature to tokio
# Current:
tokio = { version = "1", features = ["rt", "time"] }
# Required:
tokio = { version = "1", features = ["rt", "time", "sync"] }

# Change 2: Add tokio-util as explicit dependency
# Currently only transitive (via h2 → reqwest) — must be explicit
tokio-util = { version = "0.7", features = ["rt"] }
```

`CancellationToken` lives in `tokio_util::sync` and internally uses `tokio::sync::futures::Notified`, so both changes are required. Without them, `use tokio_util::sync::CancellationToken` will fail to compile.

### Installation

```bash
# No new npm dependencies needed — all frontend libs already present
# Cargo.toml edits only (see above)
cargo build  # verify after Cargo.toml changes
```

## Architecture Patterns

### System Architecture Diagram

```
Frontend                          Tauri IPC                    Rust Backend
─────────────                     ─────────                    ─────────────
[Subscribe Panel]
  - Mode toggle
  - Start button ──── invoke("start_subscribe", {             AppState
                       profileName, queueName,     ──────►  Mutex<Option<
                       decodeTypes, channel})                  SubscribeState {
                                                                 token: CancellationToken,
                                                                 handle: JoinHandle
                                                               }>>
                                                  spawns ──► [Consumer Task]
                                                               loop {
[Channel callback] ◄───── channel.send(DrainResult) ──────     select! {
  appendMessages()                                               delivery = consumer.next()
  (FIFO 500 cap)                                                 => ack + decode + send
                                                                _ = token.cancelled()
  - Stop button ──── invoke("stop_subscribe") ──►               => basic_cancel
                       cancel token                              + conn.close()
                       await handle (5s timeout)                 break
                       return Ok(())             ◄──────       }
                                                             }
[setSubscribeStatus("Idle")]
  (on invoke resolves)

[useEffect]
  watches: activeProfileName,
           connectionStatus
  → calls handleStop() on change
    while Running or Stopping
```

### Recommended File Structure Changes

```
src-tauri/src/commands/
├── consume.rs          # existing — drain logic; reuse DrainResult
├── subscribe.rs        # NEW — start_subscribe, stop_subscribe commands

src-tauri/src/
├── lib.rs              # add SubscribeState to AppState; register new commands

src/stores/
├── useResponseStore.ts # add subscribeStatus, subscribeError, setSubscribeStatus

src/lib/
├── types.ts            # add SubscribeStatus type
├── ipc.ts              # add startSubscribe(), stopSubscribe() wrappers

src/components/
├── ui/
│   ├── toggle-group.tsx    # NEW — shadcn wrapper for radix ToggleGroup
│   └── badge.tsx           # create if absent (check first)
├── response/
│   ├── SubscribePanel.tsx  # NEW — Start/Stop button + status badge
│   ├── MessageFeedTab.tsx  # extend — add mode toggle, conditionally render panels
│   └── ResponseQueuePicker.tsx  # extend — hide when Subscribe mode active
```

### Pattern 1: Consumer Task with CancellationToken

**What:** Spawned async task that loops over lapin Consumer deliveries until cancelled
**When to use:** Any long-running consumer in Tauri 2.x backend

```rust
// Source: lapin 4.x docs + tokio-util 0.7 docs
use tokio_util::sync::CancellationToken;
use futures_util::StreamExt;
use lapin::options::{BasicAckOptions, BasicCancelOptions, BasicConsumeOptions, BasicQosOptions};
use lapin::types::FieldTable;

pub struct SubscribeState {
    pub token: CancellationToken,
    pub handle: tokio::task::JoinHandle<()>,
}

async fn run_consumer(
    channel: lapin::Channel,
    conn: lapin::Connection,
    queue_name: String,
    decode_types: Vec<String>,
    tauri_channel: tauri::ipc::Channel<DrainResult>,
    token: CancellationToken,
) {
    // MUST call basic_qos before basic_consume
    let _ = channel.basic_qos(20, BasicQosOptions::default()).await;

    let mut consumer = channel
        .basic_consume(
            &queue_name,
            "proto-sender-subscriber",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await
        .expect("basic_consume failed");

    loop {
        tokio::select! {
            delivery = consumer.next() => {
                match delivery {
                    Some(Ok(delivery)) => {
                        // Ack before decode (D-13, consistent with drain pattern)
                        let _ = delivery.acker.ack(BasicAckOptions::default()).await;
                        let result = decode_delivery(&delivery, &decode_types);
                        let _ = tauri_channel.send(result);
                    }
                    Some(Err(e)) => {
                        // lapin error — send error sentinel; break
                        let _ = tauri_channel.send(DrainResult::error(e.to_string()));
                        break;
                    }
                    None => {
                        // Broker closed channel — treat as error, break
                        let _ = tauri_channel.send(DrainResult::broker_closed());
                        break;
                    }
                }
            }
            _ = token.cancelled() => {
                // Graceful stop: cancel consumer tag, then close connection
                let _ = channel.basic_cancel(
                    "proto-sender-subscriber",
                    BasicCancelOptions::default(),
                ).await;
                let _ = conn.close(200, "normal shutdown").await;
                break;
            }
        }
    }
}
```

### Pattern 2: stop_subscribe Awaiting JoinHandle (Idle Transition)

**What:** The only reliable mechanism for Stopping→Idle transition
**When to use:** The stop_subscribe Tauri command

```rust
// Source: tokio docs + Tauri 2.x app state pattern
#[tauri::command]
async fn stop_subscribe(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let subscribe_state = {
        let mut guard = state.subscribe_state.lock().unwrap();
        guard.take()  // take ownership, clearing the slot
    };

    if let Some(SubscribeState { token, handle }) = subscribe_state {
        token.cancel();
        // Await termination with 5-second timeout
        let _ = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            handle,
        ).await;
    }

    Ok(())
    // Frontend transitions to Idle when this Ok(()) resolves
}
```

### Pattern 3: AppState Extension

**What:** Adding SubscribeState to existing Tauri app state
**When to use:** Wave 0 / lib.rs changes

```rust
// Consistent with existing DescriptorPool pattern (std::sync::Mutex, not tokio)
// src-tauri/src/lib.rs
pub struct AppState {
    pub descriptor_pool: std::sync::Mutex<Option<prost_reflect::DescriptorPool>>,
    pub subscribe_state: std::sync::Mutex<Option<SubscribeState>>,
}
```

### Pattern 4: Frontend — Stopping→Idle Transition

**What:** Setting Idle status when stop_subscribe resolves
**When to use:** Subscribe panel stop handler

```typescript
// src/components/response/SubscribePanel.tsx
const handleStop = async () => {
  setSubscribeStatus('Stopping')
  try {
    await invoke('stop_subscribe')
    setSubscribeStatus('Idle')  // resolves only after JoinHandle awaited in Rust
  } catch (e) {
    setSubscribeStatus('Error', String(e))
  }
}
```

### Pattern 5: Auto-Stop useEffect

**What:** Automatically stops subscribe when profile changes or disconnects
**When to use:** Subscribe panel or MessageFeedTab

```typescript
// Mirrors the established pattern in ResponseQueuePicker.tsx
const activeProfileName = useConnectionStore(s => s.activeProfileName)
const connectionStatus = useConnectionStore(s => s.connectionStatus)
const subscribeStatus = useResponseStore(s => s.subscribeStatus)

useEffect(() => {
  if (
    subscribeStatus === 'Running' || subscribeStatus === 'Stopping'
  ) {
    if (connectionStatus !== 'Connected' || activeProfileName !== prevProfileRef.current) {
      handleStop()
    }
  }
  prevProfileRef.current = activeProfileName
}, [activeProfileName, connectionStatus])
```

### Pattern 6: Mode Toggle with ToggleGroup

**What:** Drain | Subscribe segmented control using existing radix-ui
**When to use:** Wave 0 — create `src/components/ui/toggle-group.tsx`

```tsx
// Wrap radix-ui ToggleGroup (already in node_modules via radix-ui umbrella package)
// No new npm install needed
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
// (radix-ui 1.4.3 includes toggle-group; verify exact sub-package path)
```

### Anti-Patterns to Avoid

- **Using `app.emit()` for message delivery:** Event listeners can be registered multiple times, causing duplicate deliveries. Use `Channel<T>` exclusively for message streaming.
- **Using `tokio::spawn` instead of `tauri::async_runtime::spawn`:** Panics on Windows in Tauri 2.x event listeners (Tauri issue #10289).
- **No-message idle timeout in consumer loop:** A `tokio::time::timeout` on `consumer.next()` that fires on quiet queues causes spurious Error state. Do not implement the 30s timeout suggested in CONTEXT.md `##Specifics`.
- **Holding `std::sync::Mutex` across `.await`:** Lock the mutex, extract value, drop guard — then await. Never hold a `std::sync::Mutex` guard across an async boundary.
- **Using `tokio::sync::Mutex` for SubscribeState:** Unnecessary complexity. The lock is held for microseconds (extract/insert the Option). `std::sync::Mutex` is correct and consistent with the existing DescriptorPool slot.
- **Skipping `basic_qos` before `basic_consume`:** Without a prefetch limit, RabbitMQ delivers all queued messages immediately, flooding the Channel buffer.
- **Not handling `consumer.next()` returning `None`:** None means the broker closed the channel. This must be treated as an error and trigger status Error + loop exit.
- **Calling `basic_cancel` after connection is already closed:** Check connection state before calling, or ignore the error result from `basic_cancel`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cancellation signal | Custom AtomicBool + notify | `tokio_util::sync::CancellationToken` | Handles waker registration, race conditions, and multi-waiter notify correctly |
| Real-time push to frontend | Polling IPC calls | `tauri::ipc::Channel<T>` | Zero polling overhead; designed for this exact use case in Tauri 2.x |
| Stream consumption | Manual Future poll | `futures_util::StreamExt::next()` | `.next()` is the idiomatic async stream consumer |
| Task completion wait | Sleep + check | `tokio::task::JoinHandle::await` | Deterministic; no polling |
| Segmented toggle control | Custom CSS toggle | Radix UI ToggleGroup | Already in project deps; accessible; keyboard-navigable |

**Key insight:** The entire consumer lifecycle (spawn, stream, cancel, await) is a solved problem with tokio + tokio-util. Custom signaling mechanisms introduce subtle race conditions that are difficult to test.

## Common Pitfalls

### Pitfall 1: Missing Cargo.toml Changes Block Compilation

**What goes wrong:** `use tokio_util::sync::CancellationToken` fails with "unresolved module" or feature-gate error.
**Why it happens:** `tokio-util` is only transitive in the project (via h2→reqwest). `tokio/sync` feature is not activated. Both are required.
**How to avoid:** Wave 0 task must edit Cargo.toml: add `tokio-util = { version = "0.7", features = ["rt"] }` and add `"sync"` to tokio features. Run `cargo build` to verify before implementing subscribe logic.
**Warning signs:** Compiler error mentioning `tokio_util`, `sync`, or `CancellationToken` not found.

### Pitfall 2: Stopping→Idle Transition Never Fires

**What goes wrong:** UI stays at "Stopping" forever; user cannot restart subscribe.
**Why it happens:** Original D-09 wording implied "Channel drop signals Idle" — but `Channel<T>` has no JS-observable close callback in Tauri 2.x. If the frontend waits for a signal that never comes, it hangs.
**How to avoid:** Use the JoinHandle pattern: `stop_subscribe` awaits the JoinHandle before returning. Frontend transitions to Idle when `invoke("stop_subscribe")` resolves. No sentinel payload, no app.emit().
**Warning signs:** subscribeStatus stays at "Stopping" after stop button is clicked.

### Pitfall 3: `tokio::spawn` Instead of `tauri::async_runtime::spawn`

**What goes wrong:** Consumer task panics on Windows; may work on macOS/Linux but fail in production.
**Why it happens:** Tauri 2.x manages its own tokio runtime. Using `tokio::spawn` from within a Tauri command context panics on Windows (Tauri issue #10289, confirmed in CLAUDE.md).
**How to avoid:** Always use `tauri::async_runtime::spawn(...)` for tasks spawned from Tauri commands.
**Warning signs:** Works on macOS, crashes on Windows. GitHub Actions CI on Windows fails.

### Pitfall 4: `basic_qos` Not Called Before `basic_consume`

**What goes wrong:** RabbitMQ delivers all queued messages at once, flooding the tokio channel buffer; app appears frozen; memory spikes.
**Why it happens:** Without a prefetch limit, AMQP 0-9-1 has no back-pressure on the consumer.
**How to avoid:** Always call `channel.basic_qos(20, BasicQosOptions::default()).await` before `basic_consume`.
**Warning signs:** Memory usage climbs immediately on subscribe to a large queue; UI freezes.

### Pitfall 5: `consumer.next()` Returning `None` Not Handled

**What goes wrong:** Consumer loop exits silently; no error shown; status stays "Running" forever.
**Why it happens:** `None` from the Stream means the broker closed the underlying AMQP channel. This is an abnormal condition that must surface as Error state.
**How to avoid:** Match `None` explicitly in the consumer loop arm, send an error sentinel via the Channel, break the loop.
**Warning signs:** Stop button has no effect after a RabbitMQ restart or channel close.

### Pitfall 6: Holding `std::sync::Mutex` Across `.await`

**What goes wrong:** Deadlock or panic ("MutexGuard held across await point").
**Why it happens:** `std::sync::Mutex` is not safe to hold across async yield points.
**How to avoid:** Lock → extract value → drop guard → then await. Pattern: `let state = { guard.lock().unwrap().take() }; if let Some(s) = state { s.handle.await; }`.
**Warning signs:** Compiler warning "this MutexGuard is held across an await point"; potential deadlock at runtime.

### Pitfall 7: Idle Timeout Anti-Pattern

**What goes wrong:** Subscribe session enters Error state on any queue that receives no messages for 30 seconds — a legitimate condition for dev/test queues.
**Why it happens:** CONTEXT.md `##Specifics` mentions a 30s no-message timeout. This is an anti-pattern for this use case.
**How to avoid:** Do not add `tokio::time::timeout` around `consumer.next()` in the main loop. The consumer should wait indefinitely. The only exit paths are: delivery error, broker close (None), or explicit cancellation.
**Warning signs:** Users report "subscribe stops randomly" on quiet queues.

## Code Examples

### Verified Pattern: Channel<T> in Tauri 2.x

```rust
// Source: docs.rs/tauri (Tauri 2.x Channel API)
// The Channel is created on the frontend and passed as a Tauri command parameter
#[tauri::command]
async fn start_subscribe(
    channel: tauri::ipc::Channel<DrainResult>,
) -> Result<(), String> {
    channel.send(some_result).map_err(|e| e.to_string())?;
    Ok(())
}
```

```typescript
// Source: @tauri-apps/api v2.x
import { Channel } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'

const channel = new Channel<DrainResult>()
channel.onmessage = (message) => {
  appendMessages([{ ...message, id: crypto.randomUUID() }])
}
await invoke('start_subscribe', {
  profileName,
  queueName,
  decodeTypes,
  channel,
})
```

### Verified Pattern: useResponseStore Extension

```typescript
// Source: src/stores/useResponseStore.ts (existing INITIAL_STATE pattern)
export type SubscribeStatus = 'Idle' | 'Running' | 'Stopping' | 'Error'

const INITIAL_STATE = {
  // ... existing fields ...
  subscribeStatus: 'Idle' as SubscribeStatus,
  subscribeError: null as string | null,
}

// In store actions:
setSubscribeStatus: (status: SubscribeStatus, error?: string) =>
  set({ subscribeStatus: status, subscribeError: error ?? null }),
```

### Verified Pattern: IPC Wrappers

```typescript
// Source: src/lib/ipc.ts (existing drainMessages pattern)
import { Channel, invoke } from '@tauri-apps/api/core'
import type { DrainResult } from './types'

export function startSubscribe(
  profileName: string,
  queueName: string,
  decodeTypes: string[],
  channel: Channel<DrainResult>,
): Promise<void> {
  return invoke('start_subscribe', { profileName, queueName, decodeTypes, channel })
}

export function stopSubscribe(): Promise<void> {
  return invoke('stop_subscribe')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling IPC with `setInterval` | `Channel<T>` push streaming | Tauri 2.0 (2024) | Zero latency, no wasted IPC roundtrips |
| `tokio::sync::watch` for stop signal | `tokio_util::sync::CancellationToken` | tokio-util 0.7 | Cleaner API; supports multi-waiter; idiomatic |
| Manual `AtomicBool` + `Notify` | `CancellationToken` | tokio-util 0.7 | No manual waker management |
| app.emit() event bus | `Channel<T>` per session | Tauri 2.0 (2024) | Scoped to session; no event name collisions |

**Deprecated/outdated:**
- `tokio::spawn` in Tauri 2.x commands: Use `tauri::async_runtime::spawn` — tokio::spawn panics on Windows (Tauri issue #10289)
- `app.emit()` for streaming data: Still valid for one-shot events, not for message feed delivery

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `radix-ui` 1.4.3 umbrella package includes ToggleGroup sub-module importable as `@radix-ui/react-toggle-group` | Standard Stack | If not included, requires `npm install @radix-ui/react-toggle-group`; low impact |
| A3 | shadcn/ui `Badge` component does not yet exist in `src/components/ui/` | Standard Stack | If it exists already, Wave 0 badge creation task is not needed |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (A2 upgraded to VERIFIED after Cargo.lock check.)

## Open Questions (RESOLVED)

1. **Error sentinel in DrainResult** — RESOLVED
   - Decision: Reuse the existing `DrainResult.error` field (`Option<String>`) as the error sentinel.
     No separate error type is needed. Construct error results by setting `error: Some(msg)` directly
     in the consumer loop; no new constructor method required. The existing `DrainResult` shape
     handles both lapin errors and broker-close (None) cases.

2. **Consumer tag uniqueness** — RESOLVED
   - Decision: Use hardcoded tag `"proto-sender-subscriber"`. The D-08 double-start guard in Rust
     (start_subscribe takes ownership of the SubscribeState slot and cancels any prior session before
     spawning a new one) prevents two concurrent sessions from ever holding the same tag simultaneously.
     UUID-based tags are not needed for this use case.

3. **Badge component location** — RESOLVED
   - Decision: `badge.tsx` already exists at `src/components/ui/badge.tsx` (size 1.8K, confirmed
     via PATTERNS.md and the interfaces block in this plan set). No creation task is needed;
     import directly as `import { Badge } from "@/components/ui/badge"`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Backend compilation | ✓ | (project in use) | — |
| Node 20 LTS | Frontend build | ✓ | (project in use) | — |
| RabbitMQ instance | Manual UAT only | — | — | Use existing test RabbitMQ from Phase 13 UAT |
| `tokio-util` in Cargo.lock | CancellationToken | ✓ (transitive 0.7.18) | 0.7.18 | Must become explicit dep |

**Missing dependencies with no fallback:**
- None that block execution. `tokio-util` is already in Cargo.lock; it just needs to be made explicit.

**Missing dependencies with fallback:**
- RabbitMQ for automated tests: Unit tests mock IPC; manual UAT requires a local RabbitMQ instance (same as Phase 13 UAT setup).

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | AMQP credentials are handled in existing profile connection logic; subscribe reuses the same connection |
| V3 Session Management | yes | Consumer session tied to Tauri app state slot; cleaned up on stop or profile change; no session token exposed to frontend |
| V4 Access Control | no | Local desktop app; no multi-user access control |
| V5 Input Validation | yes | Broker-delivered payload bytes must be treated as untrusted; decode errors must be caught and returned as `DrainResult.error`, not propagated as panics |
| V6 Cryptography | no | No new cryptographic operations; AMQP TLS is handled by lapin/connection layer already present |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed protobuf payload from broker causes decode panic | Tampering | Wrap `prost_reflect` decode in `catch_unwind` or `Result`; never `.unwrap()` on broker data |
| Broker URI / AMQP credentials leaked in error message | Information Disclosure | Strip credentials from error strings before sending via Channel to frontend; use the existing password-drop-before-log pattern from `consume.rs` |
| Stale consumer handle remains active after profile change | Elevation of Privilege | Auto-stop useEffect (D-11) + `stop_subscribe` clearing app state slot on each `start_subscribe` call — always take/replace, never stack consumers |
| Channel<T> callback invoked after component unmount | Tampering / crash | Set `channel.onmessage = null` in React cleanup (return from useEffect); guard `appendMessages` call |

### Security Notes

- The existing `consume.rs` already drops the password from connection URIs before logging — the subscribe command must follow the same pattern [VERIFIED: consume.rs read].
- Broker-delivered bytes are external/untrusted input per V5. `prost_reflect` decode failures must produce `DrainResult { error: Some(...) }`, not cause the Tauri command to panic.
- The app state slot (`Mutex<Option<SubscribeState>>`) must be taken (set to None) at the start of `start_subscribe` to ensure any previous consumer is cancelled before a new one starts. This prevents two simultaneous consumers on the same connection.

## Sources

### Primary (HIGH confidence)

- `docs.rs/tauri` (tauri::ipc::Channel) — Channel<T> API, send(), command parameter pattern [VERIFIED: WebFetch]
- `docs.rs/tokio-util` (tokio_util::sync::CancellationToken) — CancellationToken API [VERIFIED: transitive in Cargo.lock 0.7.18]
- `src-tauri/Cargo.toml` — tokio features `["rt", "time"]` confirmed; tokio-util absent [VERIFIED: Read]
- `src-tauri/Cargo.lock` — tokio-util 0.7.18 and futures-util 0.3.32 confirmed as transitive [VERIFIED: Bash]
- `src-tauri/src/commands/consume.rs` — DrainResult struct, bytes_to_hex, ack-before-decode pattern, password-drop pattern [VERIFIED: Read]
- `src/stores/useResponseStore.ts` — INITIAL_STATE pattern, appendMessages FIFO-500 cap [VERIFIED: Read]
- `src/lib/types.ts` — DrainResult interface, FeedMessage interface [VERIFIED: Read]
- `src/lib/ipc.ts` — drainMessages wrapper pattern [VERIFIED: Read]
- `src/components/response/ResponseQueuePicker.tsx` — useEffect auto-stop pattern [VERIFIED: Read]
- `src-tauri/src/lib.rs` — AppState with Mutex<Option<DescriptorPool>> pattern [VERIFIED: Read]
- `package.json` — radix-ui 1.4.3, zustand 5.x, @tauri-apps/api 2.x [VERIFIED: Read]
- `.planning/config.json` — nyquist_validation: false confirmed; security_enforcement absent (treated as enabled) [VERIFIED: Read + Bash]
- Tauri issue #10289 — tokio::spawn panic on Windows [CITED: github.com/tauri-apps/tauri/issues/10289]
- `.planning/STATE.md` lines 183+ — v1.4 pitfalls list [VERIFIED: Read]

### Secondary (MEDIUM confidence)

- `lapin` 4.x `basic_qos` + `basic_consume` API — confirmed via prior Context7 session (summarized); lapin 4.7.4 [CITED: crates.io/crates/lapin]
- `futures_util::StreamExt::next()` on lapin Consumer — futures-util 0.3.32 confirmed in Cargo.lock; StreamExt is standard [VERIFIED: Cargo.lock grep]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified in Cargo.toml/Cargo.lock/package.json; API shapes confirmed via docs
- Architecture: HIGH — Channel<T> + CancellationToken + JoinHandle pattern is idiomatic and fully verified
- Pitfalls: HIGH — All 7 pitfalls sourced from: STATE.md explicit list, CLAUDE.md constraints, Tauri issue #10289, and verified API gaps in Cargo.toml
- Stopping→Idle mechanism: HIGH — Prescribed after identifying the architectural gap in CONTEXT.md D-09
- Security: MEDIUM — ASVS categories reasoned from phase tech stack; no security-specific tool calls made

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (30 days — lapin and tauri-ipc are stable)
