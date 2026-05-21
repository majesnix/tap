# Phase 14: Live Subscribe Mode - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a persistent AMQP consumer (`basic_consume`) to the existing MessageFeedTab that streams messages into the feed in real time until the user stops it or the active connection profile changes. The Phase 13 feed (FIFO-500 accordion, `appendMessages`, `FeedMessage[]`) is reused unchanged. The toolbar gains a mode toggle (Drain ↔ Subscribe) that swaps the control set for each mode.

Requirements covered: CONS-05, CONS-06, CONS-07.

</domain>

<decisions>
## Implementation Decisions

### Streaming Delivery

- **D-01:** Messages are delivered via **Tauri `Channel<T>`** from `@tauri-apps/api`. The JS caller creates a `Channel` and passes it as a parameter to the `start_subscribe` Tauri command. Rust calls `basic_consume` on a lapin channel and pushes each delivery through the Tauri channel as it arrives. True real-time one-at-a-time push — no polling, no repeated connections.
- **D-02:** `start_subscribe(profile, queue, decode_types, channel)` **returns `()` (or `Err`)**. The function returns immediately after spawning the consumer task; the consumer loop runs in a `tauri::async_runtime::spawn` task indefinitely until cancelled or errored. The frontend receives messages via the channel callback.
- **D-03:** Subscribe **reuses `DrainResult`** as the channel payload type. No new type needed — `DrainResult` already has all required fields (`routingKey`, `exchange`, `contentType`, `timestamp`, `decoded`, `hexString`, `error`, `decodedAs`). `appendMessages()` in the store works unchanged; `FeedMessage` covers both drain and subscribe sources.

### Subscribe/Drain UI (Toolbar)

- **D-04:** The toolbar uses a **segmented mode toggle** (Drain | Subscribe). In **Drain mode**: existing drain count input + Drain button are shown. In **Subscribe mode**: Start/Stop button (context-dependent) is shown instead. The Queue picker and Decode-as combobox are shared between both modes and always visible.
- **D-05:** The **status badge** (Running / Stopping / Idle / Error) lives **inline in the Subscribe toolbar row**, to the left of the Start/Stop button. Visible only in Subscribe mode.
- **D-06:** The mode toggle is **disabled while `subscribeStatus` is `"Running"` or `"Stopping"`**. The user must click Stop and wait for `Idle` before switching to Drain mode. This prevents ambiguous concurrent state.

### Consumer Stop Signal (Rust App State)

- **D-07:** A **`CancellationToken`** (from `tokio-util`) is stored in Tauri app state as `Arc<Mutex<Option<CancellationToken>>>`. `start_subscribe` creates a fresh token, stores it in state, then spawns the consumer task. The task body uses `select!` between `consumer.next()` (lapin consumer stream) and `token.cancelled()`. On cancellation, the task exits and the Channel closes naturally.
- **D-08:** If `start_subscribe` is called while a token already exists in state (a session is running), it **returns `AppError`** immediately. This is a safety net — the frontend disables Start when status is `Running`, so this path is for unexpected double-calls only.
- **D-09:** `stop_subscribe` is a **separate `#[tauri::command]`**. Frontend calls `invoke("stop_subscribe")`, sets `subscribeStatus` to `"Stopping"`, and waits. The Rust command reads the token from state, calls `cancel()`, and returns `Ok(())`. The consumer task exits asynchronously; the Channel drop signals the frontend callback to finalize the `Idle` transition.

### Subscribe Store Fields

- **D-10:** `useResponseStore` gains two new fields:
  - `subscribeStatus: SubscribeStatus` — `"Idle" | "Running" | "Stopping" | "Error"`, default `"Idle"`
  - `subscribeError: string | null` — error message when status is `"Error"`, null otherwise
  - New action: `setSubscribeStatus(status: SubscribeStatus, error?: string | null)`
  - The `INITIAL_STATE` const is extended; reset spreads it as before.

### Auto-Stop Behavior

- **D-11:** When the active connection profile changes (`activeProfileName` transitions) **or** `connectionStatus` transitions to `"disconnected"` or `"error"`: auto-stop fires. Auto-stop calls `invoke("stop_subscribe")` and sets status to `"Stopping"` → `"Idle"`. Detected via `useEffect` in the subscribe component watching both store values.
- **D-12:** Auto-stop **keeps feed messages**. Existing messages remain in the feed for inspection after the profile switch. The user uses the existing Clear button to wipe the feed if desired. Consistent with Drain behavior (D-05 from Phase 13).
- **D-13:** When Subscribe **starts**, messages **append** to the top of the existing feed (same as Drain). No auto-clear on Start. User controls clearing via the Clear button.

### Claude's Discretion

- Exact segmented control component (shadcn `ToggleGroup` vs hand-rolled radio group vs `Tabs`)
- Start/Stop button label and icon choices
- Status badge color per state (e.g., green=Running, amber=Stopping, red=Error, muted=Idle)
- Whether `subscribeStatus` is defined in `types.ts` as a type alias or inline union
- Error toast wording for consumer errors (complement to status badge)
- Whether to show a "Stopped — X messages received" toast when subscribe exits cleanly

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Live Subscribe — CONS-05, CONS-06, CONS-07 (authoritative acceptance criteria)
- `.planning/ROADMAP.md` §Phase 14 — success criteria and phase goal

### Existing Feed Architecture (read before implementing)
- `src/components/response/MessageFeedTab.tsx` — component being extended with mode toggle and subscribe controls
- `src/components/response/ResponseQueuePicker.tsx` — toolbar component; mode toggle and subscribe controls plug into or replace this layout
- `src/stores/useResponseStore.ts` — store to extend: add `subscribeStatus`, `subscribeError`, `setSubscribeStatus` (D-10); existing `appendMessages` reused unchanged
- `src/lib/types.ts` — add `SubscribeStatus` type alias; `DrainResult` reused as channel payload (D-03)
- `src/lib/ipc.ts` — add `startSubscribe(profileName, queueName, decodeTypes, channel)` and `stopSubscribe()` IPC wrappers

### Rust Backend (read before implementing)
- `src-tauri/src/commands/consume.rs` — existing `drain_messages` and `basic_consume` channel pattern; `bytes_to_hex` utility reused; ack-before-decode pattern applies per-message in the subscribe loop
- `src-tauri/src/lib.rs` — register new commands (`start_subscribe`, `stop_subscribe`) and add `CancellationToken` app state entry

### Phase 13 Context (decisions that constrain Phase 14)
- `.planning/phases/13-message-feed-foundation-drain-mode/13-CONTEXT.md` — D-05 (append, no auto-clear), D-14 (ack-before-decode), D-17 (FIFO-500 in `appendMessages`), D-20 (`selectedDecodeTypes` store field reused as-is)

### Stack Constraints
- `tauri::async_runtime::spawn` (not `tokio::spawn`) — mandatory per CLAUDE.md; confirmed by Tauri issue #10289
- `Channel<T>` from `@tauri-apps/api 2.11.0` — already confirmed available (Phase 13 context §Stack Constraints)
- `CancellationToken` from `tokio-util` crate — verify `tokio-util` is in `Cargo.toml` or add it
- `select!` macro from `tokio` — for consumer loop cancellation (D-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/useResponseStore.ts::appendMessages` — reused unchanged for subscribe messages (D-03); FIFO-500 cap already enforced
- `src/stores/useResponseStore.ts::selectedDecodeTypes` — existing multi-select decode candidates; Subscribe reads this same field, no duplication
- `src-tauri/src/commands/consume.rs::bytes_to_hex` — pub utility; reuse in subscribe message handler
- `src/components/ui/sonner.tsx` + `toast` — wired in App.tsx; use for consumer error toasts
- `src/lib/types.ts::DrainResult` — reused as channel payload type (D-03)

### Established Patterns
- Ack-before-decode per message (D-10 from consume.rs) — applies per-delivery in the `basic_consume` loop
- `tauri::async_runtime::spawn` not `tokio::spawn` — mandatory in all new async Rust commands
- Zustand `INITIAL_STATE` const + spread reset — extend with `subscribeStatus` and `subscribeError` fields (D-10)
- `useEffect` watching store values for side-effects — established pattern in `ResponseQueuePicker` for queue depth refresh; use same pattern for auto-stop (D-11)
- Ephemeral lapin connection per operation — `start_subscribe` opens one connection+channel for the lifetime of the subscribe session (not per-message like drain)

### Integration Points
- `ResponseQueuePicker.tsx` → add mode toggle (Drain | Subscribe) to the existing toolbar; swap drain controls for subscribe controls based on mode
- `useResponseStore.ts` → add `subscribeStatus`, `subscribeError`, `setSubscribeStatus`; existing fields unchanged
- `src-tauri/src/lib.rs` → register `start_subscribe` and `stop_subscribe`; add `CancellationToken` app state entry
- `src-tauri/src/commands/consume.rs` → add `start_subscribe` and `stop_subscribe` commands; keep existing `drain_messages` and `consume_message`

</code_context>

<specifics>
## Specific Ideas

- Mode toggle: **[ Drain | Subscribe ]** segmented control at the top of the toolbar row, before the queue picker — matches the Preview confirmed during discussion
- Subscribe mode toolbar row: `[ Drain | Subscribe ] [ Queue ▾ ] [ Decode-as ▾ ] [ ● RUNNING ] [ ▶ Start ]` / `[ ■ Stop ]`
- Status badge colors: suggest green dot for Running, amber for Stopping, red for Error, muted/gray for Idle
- The consumer task's `select!` loop should have a timeout branch too (e.g., 30s of no messages) to surface liveness — this is Claude's discretion
- `CancellationToken` app state key should be distinct from any future per-connection state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-Live Subscribe Mode*
*Context gathered: 2026-05-21*
