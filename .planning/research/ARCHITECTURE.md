# Architecture Research: v1.4 Advanced Response Consumer

**Domain:** Long-lived AMQP consumer integrated into a Tauri 2 desktop app
**Researched:** 2026-05-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────────────────────────────┐  │
│  │  Sidebar /   │  │              Right Panel                  │  │
│  │  PublishBar  │  │  ┌──────────────────────────────────────┐ │  │
│  │  (unchanged) │  │  │  ResponseTab (extended)              │ │  │
│  │              │  │  │  ┌──────────┐ ┌──────┐ ┌──────────┐ │ │  │
│  │              │  │  │  │  Single  │ │Drain │ │Subscribe │ │ │  │
│  │              │  │  │  │  (prev.) │ │mode  │ │  mode    │ │ │  │
│  │              │  │  │  └──────────┘ └──────┘ └──────────┘ │ │  │
│  │              │  │  │  ┌──────────────────────────────────┐ │ │  │
│  │              │  │  │  │  ConsumedMessageList (new)       │ │ │  │
│  │              │  │  │  │  FilterBar (new)                 │ │ │  │
│  │              │  │  │  │  ExportButton (new)              │ │ │  │
│  │              │  │  │  └──────────────────────────────────┘ │ │  │
│  │              │  │  └──────────────────────────────────────┘ │  │
│  └──────────────┘  └──────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │          useResponseStore (extended)                      │    │
│  │  mode | messages[] | subscribeStatus | filter            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │     Channel<ConsumedMessage> onMessage callback         │     │
│  │     listen('consume-stopped') / listen('consume-error') │     │
│  └─────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                     Tauri IPC Boundary                           │
├─────────────────────────────────────────────────────────────────┤
│                       Rust Backend                               │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │  New Commands        │  │  Managed State                   │  │
│  │  drain_messages      │  │  Mutex<Option<ConsumerHandle>>   │  │
│  │  start_consume       │  │  (registered in lib.rs setup)    │  │
│  │  stop_consume        │  └──────────────────────────────────┘  │
│  │  (+ existing cmds)   │                                        │
│  └──────────────────────┘                                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Background Task (tauri::async_runtime::spawn)           │    │
│  │  tokio::select! { consumer.next() | token.cancelled() }  │    │
│  │  Long-lived lapin::Connection + Channel                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  RabbitMQ (lapin 4.x / AMQP 0-9-1)                      │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Tauri 2 Pattern |
|-----------|----------------|-----------------|
| `drain_messages` command | basic_get loop up to N times; streams each result via Channel<ConsumedMessage>; uses ephemeral connection | Standard Tauri command with Channel param |
| `start_consume` command | Opens long-lived lapin connection; spawns background task; stores CancellationToken in managed state | Spawns tauri::async_runtime task |
| `stop_consume` command | Takes ConsumerHandle from managed state; calls cancel(); returns immediately | Reads Mutex<Option<ConsumerHandle>> |
| Background consumer task | Runs tokio::select! loop; calls channel.basic_cancel on stop; closes connection; emits lifecycle events | tauri::async_runtime::spawn |
| `ConsumerState` managed state | Single-slot for one active consumer handle at a time | Mutex<Option<ConsumerHandle>> registered at startup |
| `useResponseStore` | Extended with mode, messages[], subscribeStatus, filter | Zustand store, addMessage action |
| `ResponseTab` | Mode toggle (Single/Drain/Subscribe); delegates to mode-specific sub-panels | React component, reads store |
| `ConsumedMessageList` | Virtualized list of ConsumedMessage rows; newest first; expandable rows | New component, shadcn/ui Collapsible |
| `FilterBar` | Client-side filter inputs for routingKey / contentType; writes to store.filter | New component, controlled inputs |
| `ExportButton` | Reads filtered messages from store; writes JSON/CSV via tauri-plugin-fs save dialog | New component |

## New vs Modified: Explicit Map

### New Rust Files

| File | What |
|------|------|
| `src-tauri/src/commands/drain.rs` | `drain_messages` command — basic_get loop, Channel streaming |
| `src-tauri/src/commands/subscribe.rs` | `start_consume` + `stop_consume` commands |
| `src-tauri/src/commands/consumer_state.rs` | `ConsumerHandle` struct, `ConsumerState` type alias |

### Modified Rust Files

| File | What Changes |
|------|--------------|
| `src-tauri/src/commands/mod.rs` | Add `pub mod drain; pub mod subscribe; pub mod consumer_state;` |
| `src-tauri/src/lib.rs` | Register `ConsumerState` with `.manage()`; add 3 new commands to `invoke_handler!` |

### New React Files

| File | What |
|------|------|
| `src/components/response/ConsumedMessageList.tsx` | Scrollable list of ConsumedMessage rows, expandable, newest-first |
| `src/components/response/ConsumedMessageRow.tsx` | Single expandable message row (routing key, content-type, decoded/hex toggle) |
| `src/components/response/FilterBar.tsx` | Routing key + content-type filter inputs |
| `src/components/response/ExportButton.tsx` | Export to JSON/CSV via tauri-plugin-fs |
| `src/components/response/QueueDepthBadge.tsx` | Fetches and displays queue depth via existing fetch_queue_depth |
| `src/hooks/useConsumeChannel.ts` | Wires Channel<ConsumedMessage> and lifecycle event listeners; returns startConsume / stopConsume |

### Modified React Files

| File | What Changes |
|------|--------------|
| `src/stores/useResponseStore.ts` | Add: `mode`, `messages[]`, `subscribeStatus`, `filter`, `addMessage`, `setMode`, `setSubscribeStatus`, `setFilter`, `clearMessages` |
| `src/lib/ipc.ts` | Add: `drainMessages()`, `startConsume()`, `stopConsume()` wrappers |
| `src/lib/types.ts` | Add: `ConsumedMessage` interface, `SubscribeStatus` union type |
| `src/components/response/ResponseTab.tsx` | Add mode toggle; render mode-specific sub-panel; Single mode keeps existing path |

## Recommended Project Structure After v1.4

```
src-tauri/src/commands/
├── consume.rs              # existing: single basic_get (unchanged)
├── drain.rs                # new: drain_messages (basic_get loop + Channel)
├── subscribe.rs            # new: start_consume + stop_consume
├── consumer_state.rs       # new: ConsumerHandle struct + ConsumerState alias
├── connection.rs           # unchanged
├── encode.rs               # unchanged
├── mod.rs                  # add new modules
├── proto.rs                # unchanged
└── publish.rs              # unchanged

src/components/response/
├── ResponseTab.tsx         # modified: add mode toggle
├── ResponseQueuePicker.tsx # reuse unchanged
├── ResponseDecodedView.tsx # reuse unchanged
├── ResponseHexSection.tsx  # reuse unchanged
├── ConsumedMessageList.tsx # new
├── ConsumedMessageRow.tsx  # new
├── FilterBar.tsx           # new
├── ExportButton.tsx        # new
└── QueueDepthBadge.tsx     # new

src/hooks/
├── useDebounce.ts          # unchanged
└── useConsumeChannel.ts    # new: Channel + lifecycle event wiring
```

## Architectural Patterns

### Pattern 1: Tauri Channel for Message Streaming (Drain + Subscribe)

**What:** The `drain_messages` and `start_consume` commands accept a `Channel<ConsumedMessage>` parameter. Each message is sent over the channel as it arrives. The frontend creates a `Channel` object and wires its `onmessage` callback before invoking the command.

**When to use:** Any time Rust needs to push an ordered stream of structured data to the frontend during a command's lifetime. Channel is preferred over `app.emit()` for streaming because: (1) it is tied to the specific invocation scope, (2) it preserves delivery order with an index, (3) it is faster than the global event bus.

**Trade-offs:** Channel is bound to the command invocation. For drain mode the command returns when the loop ends. For subscribe mode, the command returns immediately after spawning the background task, but the task holds the Channel clone and can continue sending until the task exits.

**Rust signature:**
```rust
use tauri::ipc::Channel;

#[tauri::command]
pub async fn drain_messages(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    max_messages: u32,
    message_type_name: String,
    on_message: Channel<ConsumedMessage>,
    pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<DrainSummary, crate::error::AppError> {
    let pool = { /* clone before any .await — guard not Send */ };
    // ephemeral connection loop
    for _ in 0..max_messages {
        match channel.basic_get(queue_name.as_str().into(), BasicGetOptions::default()).await? {
            None => break,
            Some(msg) => {
                // ack, decode, send
                on_message.send(consumed_message)?;
            }
        }
    }
    Ok(DrainSummary { count })
}
```

**TypeScript invocation:**
```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const onMessage = new Channel<ConsumedMessage>();
onMessage.onmessage = (msg) => store.addMessage(msg);
await invoke('drain_messages', { profileName, queueName, maxMessages: 50, messageTypeName, onMessage });
```

### Pattern 2: Managed State for Consumer Lifecycle (Subscribe Mode)

**What:** A single `ConsumerState = Mutex<Option<ConsumerHandle>>` is registered at app startup. `start_consume` stores a `ConsumerHandle` (holding a `CancellationToken` and the consumer tag) when it spawns the background task. `stop_consume` takes the handle out of the slot and calls `cancel()`. If `start_consume` is called while a handle already exists, it returns an error — single-consumer-at-a-time is the invariant.

**When to use:** Any cross-command state that a background task needs to be stopped from the outside.

**State shape:**
```rust
// consumer_state.rs
use tokio_util::sync::CancellationToken;

pub struct ConsumerHandle {
    pub cancel: CancellationToken,
    pub consumer_tag: String,
    pub queue_name: String,
}

pub type ConsumerState = std::sync::Mutex<Option<ConsumerHandle>>;
```

**Registration in lib.rs:**
```rust
.manage(crate::commands::consumer_state::ConsumerState::new(None))
```

**start_consume guard:**
```rust
#[tauri::command]
pub async fn start_consume(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    message_type_name: String,
    on_message: Channel<ConsumedMessage>,
    consumer_state: tauri::State<'_, ConsumerState>,
    pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<(), crate::error::AppError> {
    // Guard: reject if already consuming
    {
        let guard = consumer_state.lock().unwrap();
        if guard.is_some() {
            return Err(AppError::AmqpError(
                "Already consuming — call stop_consume first".to_string()
            ));
        }
    }
    let pool = { /* clone before any .await */ };
    let token = CancellationToken::new();
    let child_token = token.child_token();
    let consumer_tag = format!("proto-sender-{}", epoch_ms());

    // Store handle BEFORE spawning
    {
        let mut guard = consumer_state.lock().unwrap();
        *guard = Some(ConsumerHandle {
            cancel: token,
            consumer_tag: consumer_tag.clone(),
            queue_name: queue_name.clone(),
        });
    }

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        run_consumer_task(app_clone, conn, channel, consumer, child_token, on_message, pool).await;
    });

    Ok(())
}
```

### Pattern 3: tokio::select! Consumer Loop with CancellationToken

**What:** The background task uses `tokio::select!` to race between the next consumer message and the cancellation signal. On cancellation, it calls `channel.basic_cancel()` to tell the broker to stop delivering, then closes the connection cleanly.

**Why not JoinHandle.abort():** Aborting drops the task at the next `.await` without issuing `basic_cancel`. The broker retains the subscription until its TCP keepalive expires (~60s). `CancellationToken` enables a graceful protocol-level cancel.

**Rust pattern:**
```rust
async fn run_consumer_task(
    app: tauri::AppHandle,
    conn: lapin::Connection,
    channel: lapin::Channel,
    mut consumer: lapin::Consumer,
    cancel: CancellationToken,
    on_message: Channel<ConsumedMessage>,
    pool: prost_reflect::DescriptorPool,
) {
    use futures_lite::StreamExt;
    use tauri::Emitter;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                let _ = channel.basic_cancel(
                    consumer.tag().as_str().into(),
                    lapin::options::BasicCancelOptions::default(),
                ).await;
                break;
            }
            maybe_delivery = consumer.next() => {
                match maybe_delivery {
                    None => break,
                    Some(Err(e)) => {
                        let _ = app.emit("consume-error", e.to_string());
                        break;
                    }
                    Some(Ok(delivery)) => {
                        let msg = decode_delivery(&delivery, &pool);
                        let _ = on_message.send(msg);
                    }
                }
            }
        }
    }

    let _ = conn.close(0, "".into()).await;
    let _ = app.emit("consume-stopped", ());
}
```

### Pattern 4: Hybrid Channel + Events for Lifecycle

**What:** The message stream goes through `Channel<ConsumedMessage>` (fast, ordered, scoped to the invocation). Lifecycle signals (`consume-stopped`, `consume-error`) go through `app.emit()` global events. This separation is deliberate: the Channel is tied to the `start_consume` invocation's lifetime. Global events survive component remounts and are the right primitive for "something ended" notifications.

**Frontend wiring:**
```typescript
// useConsumeChannel.ts
import { invoke, Channel } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useResponseStore } from '@/stores/useResponseStore';

export function useConsumeChannel() {
  const { addMessage, setSubscribeStatus } = useResponseStore();

  const startConsume = async (params: StartConsumeParams) => {
    const onMessage = new Channel<ConsumedMessage>();
    onMessage.onmessage = (msg) => addMessage({ ...msg, receivedAt: Date.now() });

    const unlistenStopped = await listen('consume-stopped', () => {
      setSubscribeStatus('idle');
      unlistenStopped();
      unlistenError();
    });
    const unlistenError = await listen<string>('consume-error', (e) => {
      setSubscribeStatus('errored');
      unlistenStopped();
      unlistenError();
    });

    setSubscribeStatus('running');
    await invoke('start_consume', { ...params, onMessage });
  };

  const stopConsume = async () => {
    setSubscribeStatus('stopping');
    await invoke('stop_consume');
    // Do NOT set 'idle' here — wait for 'consume-stopped' event
  };

  return { startConsume, stopConsume };
}
```

## Critical Architectural Shift: Ephemeral to Long-Lived Connection

Every existing AMQP command uses an ephemeral connection: open, operate, close within the command's async fn. Subscribe mode breaks this invariant by design. The `lapin::Connection` and its `lapin::Channel` are moved into the background task and live for the duration of the consume session.

**Implications:**
- The background task owns the connection; no other code can reference it after the move
- If the background task panics, `conn.close()` is not called — the TCP socket will timeout via the broker's heartbeat. Acceptable for a dev tool.
- The `start_consume` command function returns `Ok(())` immediately after spawning the task. The `on_message` Channel stays alive because the spawned task holds the clone.
- Drain mode retains the ephemeral pattern: the command function owns the connection and returns when the loop finishes.

## Data Flow

### Drain Mode

```
User: click "Drain (N)"
    ↓
ResponseTab → invoke('drain_messages', { maxMessages: N, onMessage: Channel })
    ↓
Rust: drain_messages opens ephemeral lapin connection
    ↓ basic_get loop (up to N iterations)
    ↓ each message: ack → decode → on_message.send(ConsumedMessage)
    ↓ loop exits (empty queue or N reached)
    ↓ command returns DrainSummary { count }
    ↓
Channel.onmessage callbacks → store.addMessage() (one per message, in order)
invoke() resolves → setIsLoading(false)
```

### Subscribe Mode

```
User: click "Start Subscribe"
    ↓
useConsumeChannel.startConsume()
    ↓ create Channel.onmessage, listen('consume-stopped'), listen('consume-error')
    ↓ setSubscribeStatus('running')
    ↓ invoke('start_consume', { onMessage })
    ↓
Rust start_consume:
    ↓ guard: reject if ConsumerState is Some
    ↓ clone pool (before .await)
    ↓ open lapin connection
    ↓ create channel, basic_consume (no_ack: true)
    ↓ store ConsumerHandle { cancel, consumer_tag, queue_name }
    ↓ tauri::async_runtime::spawn(run_consumer_task)
    ↓ return Ok(()) immediately

Background task (run_consumer_task):
    ↓ tokio::select! loop
    ↓ delivery → decode → on_message.send()

User: click "Stop"
    ↓
invoke('stop_consume')
    ↓ lock ConsumerState, take ConsumerHandle, call cancel.cancel()
    ↓ return Ok(())
    ↓ setSubscribeStatus('stopping') (already set by hook)

Background task receives cancellation:
    ↓ basic_cancel → conn.close()
    ↓ app.emit('consume-stopped', ())

Frontend listen('consume-stopped'):
    ↓ setSubscribeStatus('idle')
    ↓ remove listeners
```

### State Management

```
useResponseStore
  mode: 'single' | 'drain' | 'subscribe'
  messages: ConsumedMessage[]     (newest first, capped at 500)
  subscribeStatus: 'idle' | 'running' | 'stopping' | 'errored'
  filter: { routingKey?: string; contentType?: string }
  lastResult: ...                 (legacy single-mode, unchanged)

  addMessage(msg) → [msg, ...prev].slice(0, 500)
  setMode(m)
  setSubscribeStatus(s)
  setFilter(f)
  clearMessages()
```

## Integration Points

### Existing Rust Commands: Unchanged

The three new Rust commands (`drain_messages`, `start_consume`, `stop_consume`) slot in alongside existing commands with no changes to `consume.rs`, `publish.rs`, `connection.rs`, or `encode.rs`.

### Pool State: Same Clone Pattern

All three new commands clone the `DescriptorPool` from `Mutex<Option<DescriptorPool>>` before any `.await`, identical to the existing `consume_message` pattern. The spawned background task receives an owned `DescriptorPool` clone — no lock held across await.

### tauri::async_runtime::spawn Requirement

The background consumer task MUST use `tauri::async_runtime::spawn`, NOT `tokio::spawn`. Hard constraint from Tauri issue #10289: `tokio::spawn` inside Tauri event listeners panics on Windows in Tauri 2. This is already enforced codebase-wide (documented in CLAUDE.md).

### Ack Policy: no_ack: true (Server Auto-Ack)

`basic_consume` is called with `BasicConsumeOptions { no_ack: true, .. }`. This is the generalization of the existing D-10 "ack-before-decode" doctrine. The broker removes messages from the queue as it delivers them. Consequences:

- No stuck unacked messages if the app crashes mid-session
- No prefetch count management needed
- No client-side ack calls in the message loop
- Matches dev-tool intent: consume = remove

### New IPC Surface

```typescript
// New type in types.ts
export interface ConsumedMessage {
  routingKey: string;
  contentType: string | null;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
  receivedAt: number;  // ms timestamp, added client-side in onmessage callback
}

export type SubscribeStatus = 'idle' | 'running' | 'stopping' | 'errored';

// New in ipc.ts
export async function drainMessages(
  profileName: string,
  queueName: string,
  maxMessages: number,
  messageTypeName: string,
  onMessage: Channel<ConsumedMessage>,
): Promise<{ count: number }>;

export async function startConsume(
  profileName: string,
  queueName: string,
  messageTypeName: string,
  onMessage: Channel<ConsumedMessage>,
): Promise<void>;

export async function stopConsume(): Promise<void>;
```

## Scalability Considerations

This is a local dev tool. Meaningful limits are:

| Concern | Design decision |
|---------|----------------|
| Memory: messages in store | Cap at 500 entries; `addMessage` prepends and slices |
| Broker backpressure | `no_ack: true` removes messages on delivery; no buildup |
| Multiple consumers | Single-slot `ConsumerState` — second `start_consume` returns error |
| App crash during subscribe | Broker closes consumer within heartbeat window (~60s) |

## Build Order

1. **`ConsumedMessage` type + `useResponseStore` extension** — no new commands; enables all downstream. Add mode, messages, subscribeStatus, filter, addMessage, clearMessages, setFilter.

2. **`QueueDepthBadge` component** — uses existing `fetch_queue_depth` unchanged. Zero new backend code.

3. **`drain_messages` Rust command + `drainMessages` IPC wrapper + `ConsumedMessageList` + `ConsumedMessageRow` + mode toggle in `ResponseTab` (Drain mode only)** — validates Channel streaming with an ephemeral connection; no managed state. `FilterBar` can appear here as client-side only (it reads from store, not from Rust).

4. **`consumer_state.rs` + `start_consume` + `stop_consume` + `useConsumeChannel` hook + Subscribe mode in `ResponseTab`** — adds managed state and long-lived connection. Channel pattern already proven in step 3.

5. **`FilterBar` integration** — client-side filter of `messages[]` from store. No new backend.

6. **`ExportButton`** — reads filtered messages from store; writes JSON/CSV via `tauri-plugin-fs` save dialog.

## Anti-Patterns

### Anti-Pattern 1: tokio::spawn for the Background Consumer Task

**What people do:** `tokio::spawn(async move { ... })` looks identical to `tauri::async_runtime::spawn`.

**Why it's wrong:** Panics on Windows in Tauri 2 event-listener contexts. See Tauri issue #10289.

**Do this instead:** `tauri::async_runtime::spawn(async move { ... })` — always, without exception.

### Anti-Pattern 2: Holding the DescriptorPool MutexGuard Across an Await

**What people do:** Lock `pool_state`, then `.await` on a lapin call while holding the guard.

**Why it's wrong:** `MutexGuard` is not `Send`. The Rust compiler rejects this. Even if it compiled, it would block the pool for the entire connection lifetime.

**Do this instead:** Clone the pool inside a tight block before any `.await`. `DescriptorPool` is `Arc`-backed; clone is O(1). Identical pattern to existing `consume_message`.

### Anti-Pattern 3: Using app.emit() for the Message Stream

**What people do:** Replace Channel with `app.emit("consume-message", msg)` for each delivery.

**Why it's wrong:** Global events fan out to all listeners, have no ordering guarantee under load, and are slower. Channel is explicitly recommended by Tauri 2 docs for streaming operations.

**Do this instead:** Channel for message delivery (scoped to invocation). Reserve `app.emit()` for lifecycle signals (`consume-stopped`, `consume-error`) where global fan-out is correct.

### Anti-Pattern 4: Aborting the Task via JoinHandle

**What people do:** Store a `JoinHandle<()>` and call `handle.abort()` from `stop_consume`.

**Why it's wrong:** `abort()` drops the future at the next `.await` without running cleanup. The broker keeps the subscription active until its TCP keepalive expires (~60s). During that window the queue cannot have a replacement consumer.

**Do this instead:** `CancellationToken` + `tokio::select!` — task exits cleanly and issues `basic_cancel` before closing the connection.

### Anti-Pattern 5: Setting subscribeStatus to 'idle' on stop_consume Resolution

**What people do:** `stop_consume` resolves → frontend immediately sets `subscribeStatus: 'idle'`.

**Why it's wrong:** The background task is still running between `cancel.cancel()` and the actual `basic_cancel` + `conn.close()`. UI shows idle but broker is still subscribed.

**Do this instead:** `stop_consume` returns `Ok(())` immediately (it only cancels the token). The frontend sets `subscribeStatus: 'stopping'` on invoke, then `'idle'` only on receipt of the `'consume-stopped'` global event.

## Sources

- Tauri 2 Channel API for streaming from Rust to frontend: https://v2.tauri.app/develop/calling-frontend/
- Tauri 2 managed state with Mutex: https://v2.tauri.app/develop/state-management/
- lapin Consumer struct (basic_consume, StreamExt, basic_cancel, consumer tag): https://docs.rs/lapin/latest/lapin/struct.Consumer.html
- tokio-util CancellationToken: https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html
- Tauri issue #10289 (tokio::spawn panic on Windows in Tauri 2): https://github.com/tauri-apps/tauri/issues/10289

---
*Architecture research for: Tauri 2 long-lived AMQP consumer (v1.4 Advanced Response Consumer)*
*Researched: 2026-05-20*
