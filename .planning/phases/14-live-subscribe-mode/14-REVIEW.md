---
phase: 14-live-subscribe-mode
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src-tauri/src/commands/subscribe.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/stores/useResponseStore.test.ts
  - src/components/ui/toggle-group.tsx
  - src/lib/types.ts
  - src/lib/ipc.ts
  - src/stores/useResponseStore.ts
  - src/components/response/SubscribePanel.tsx
  - src/components/response/SubscribePanel.test.tsx
  - src/components/response/MessageFeedTab.tsx
  - src/components/response/MessageFeedTab.test.tsx
  - src/components/response/ResponseQueuePicker.tsx
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: resolved
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 14 implements a live AMQP subscribe mode: a Rust backend command that spawns a persistent consumer task with CancellationToken shutdown, and a React frontend with SubscribePanel, updated MessageFeedTab, and ResponseQueuePicker. The architecture is well-structured and matches the project conventions. However, four BLOCKER issues are present — two in the Rust backend (TOCTOU double-start race and silent consumer termination without frontend notification) and two in the frontend (start-click race and missing unmount cleanup). These would all produce visible runtime failures in normal use.

---

## Critical Issues

### CR-01: TOCTOU race in `start_subscribe` — double-start guard is ineffective

**File:** `src-tauri/src/commands/subscribe.rs:85-95, 320-324`

**Issue:** The double-start guard reads `guard.is_some()` and immediately drops the `Mutex` guard (line 95) to satisfy the Send constraint before the first `await`. Four `await` points follow (connection, channel, QoS, consume) before the `SubscribeState` is stored back at line 323. Two concurrent `start_subscribe` invocations both pass the `is_some()` check while the state is `None`, both spawn consumer tasks, and only the last one to reach line 323 has its `JoinHandle` retained. The first handle is overwritten and leaked: the consumer loop runs indefinitely, acking messages and pushing into the Channel callback, but `stop_subscribe` can never cancel it. The same window also causes a start/stop race: `stop_subscribe` can find `None` and return `Ok(())` while `start_subscribe` is still awaiting the broker, then `start_subscribe` stores the handle — the user's Stop was silently ignored.

**Fix:** Set a "pending" sentinel atomically before the first await. One approach: store the token immediately after creating it (before spawning), using an `Option<CancellationToken>` plus a secondary flag, or use an `AtomicBool` as a lightweight guard that is set to `true` before the first await and cleared on any failure path:

```rust
// Before the first await, atomically claim the slot:
{
    let mut guard = subscribe_state.lock()...?;
    if guard.is_some() {
        return Err(AppError::AmqpError("Already running".to_string()));
    }
    // Create the token NOW and store it so stop_subscribe can see it immediately.
    let token = CancellationToken::new();
    let token_child = token.clone();
    // Store a placeholder with no handle yet — replace after spawn.
    // (Requires making handle Option<JoinHandle<()>> in SubscribeState.)
    *guard = Some(SubscribeState { token, handle: None });
    token_child
} // guard drops here — slot is claimed
// ... awaits happen here ...
// After spawn, lock again and update the handle:
{
    let mut guard = subscribe_state.lock()...?;
    if let Some(ref mut state) = *guard {
        state.handle = Some(handle);
    }
}
```

Alternatively, use an `AtomicBool is_starting` flag in managed state that bridges the guard-to-store gap.

---

### CR-02: Consumer self-termination is invisible to the frontend

**File:** `src-tauri/src/commands/subscribe.rs:178-186, 212-219, 287-300`

**Issue:** When the consumer loop exits due to error conditions — `basic_consume` failure (line 178), ack failure (line 218), delivery stream error (line 287), or broker-initiated close (line 294) — the closure sends one `error_drain_result` and `break`s. The `JoinHandle` then resolves. The frontend has no mechanism to detect this: `subscribeStatus` stays `"Running"` in the store, the Stop button remains active, and the progress badge shows "Running" indefinitely. The error message appears only as a feed row, which may be overlooked. Users must manually click Stop even though the session is already dead.

**Fix:** Introduce a terminal sentinel message. Add a `terminal: bool` field to `DrainResult` (or use a dedicated `SubscribeEvent` enum), and handle it in `appendMessages` or a dedicated `onMessage` handler in `SubscribePanel`:

```typescript
// In SubscribePanel handleStart channel callback:
const channel = new Channel<DrainResult>((msg) => {
  appendMessages([msg]);
  if (msg.isTerminal) {           // new field set by Rust on break
    setSubscribeStatus("Idle");
  }
});
```

On the Rust side, set `terminal: true` in every `error_drain_result` call that precedes a `break`, and `terminal: false` for normal messages.

---

### CR-03: Start button race — `subscribeStatus` stays "Idle" during IPC await

**File:** `src/components/response/SubscribePanel.tsx:38-51, 134-135`

**Issue:** `handleStart` is `async` but does not set any pending/loading state before awaiting `startSubscribe`. The Start button's `disabled` condition is `subscribeStatus !== "Idle"` (line 135), which is `false` (button enabled) until `startSubscribe` resolves and line 43 sets status to `"Running"`. Broker connection typically takes 500ms–3s. During that window, the button is re-clickable; a second click fires a second `start_subscribe` IPC call before the first has registered its state, directly triggering the backend TOCTOU in CR-01.

**Fix:** Set a transient "connecting" state before the await, or guard via a ref:

```typescript
const isStartingRef = useRef(false);

const handleStart = async () => {
  if (isStartingRef.current) return;   // guard against double-click
  isStartingRef.current = true;
  const channel = new Channel<DrainResult>((msg) => appendMessages([msg]));
  channelRef.current = channel;
  try {
    await startSubscribe(profileName, selectedQueue, decodeTypes, channel);
    setSubscribeStatus("Running");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Subscribe failed";
    setSubscribeStatus("Error", message);
  } finally {
    isStartingRef.current = false;
  }
};
```

Alternatively add a `"Connecting"` variant to `SubscribeStatus` (requires Rust alignment) and set it before the await — this also gives the user visible feedback.

---

### CR-04: No unmount cleanup — backend consumer outlives the React component

**File:** `src/components/response/SubscribePanel.tsx:73-82`

**Issue:** There is no `useEffect` cleanup function (no `return () => { ... }`) in `SubscribePanel`. When the component unmounts while `subscribeStatus === "Running"` — which happens when the user switches from "subscribe" to "drain" mode (line 107 of `MessageFeedTab.tsx` conditionally renders `SubscribePanel`), navigates away, or closes the tab — the backend consumer task keeps running. It continues to ack messages, attempt proto decode, and push into the Channel callback. The `appendMessages` closure still holds a reference to the Zustand store so messages accumulate silently in the background, and the user loses any way to stop the session from the UI since `SubscribePanel` is unmounted and its Stop button is gone.

**Fix:** Add a cleanup effect that calls `stopSubscribe` if the session is active:

```typescript
useEffect(() => {
  return () => {
    // On unmount, stop any running session (fire-and-forget; best effort)
    if (
      useResponseStore.getState().subscribeStatus === "Running" ||
      useResponseStore.getState().subscribeStatus === "Stopping"
    ) {
      void stopSubscribe().catch(() => {});
      useResponseStore.getState().setSubscribeStatus("Idle");
    }
  };
}, []); // empty deps — runs only on unmount
```

---

## Warnings

### WR-01: `basic_qos` failure is silently swallowed

**File:** `src-tauri/src/commands/subscribe.rs:164-166`

**Issue:** `let _ = amqp_channel.basic_qos(20, ...).await;` discards the result. If QoS setup fails (e.g., broker rejects the prefetch count, or the channel is in a bad state), the consumer proceeds without any prefetch cap. This contradicts D-12's explicit guarantee of capping in-flight deliveries at 20, and can allow the broker to push an unbounded number of deliveries that accumulate in the consumer's internal buffer.

**Fix:**

```rust
if let Err(e) = amqp_channel.basic_qos(20, BasicQosOptions::default()).await {
    tracing::warn!("start_subscribe: basic_qos failed: {} — proceeding without prefetch cap", e);
    // Either abort:
    let _ = channel.send(error_drain_result(
        "Failed to set QoS prefetch — aborting subscribe".to_string(),
    ));
    let _ = conn.close(0, "".into()).await;
    return;
    // Or at minimum log and continue if prefetch is non-critical.
}
```

---

### WR-02: `reset()` clears `subscribeStatus` to "Idle" without stopping the backend

**File:** `src/stores/useResponseStore.ts:84`

**Issue:** `reset: () => set({ ...INITIAL_STATE })` resets `subscribeStatus` to `"Idle"` synchronously. If a subscribe session is active when `reset()` is called, the frontend state says "Idle" but the backend consumer keeps running. The Channel callback is still alive (holds the store reference), so messages continue to arrive and `appendMessages` fires into the just-reset store. Any subsequent `startSubscribe` call will be rejected by the Rust double-start guard (still Some in managed state).

**Fix:** `reset()` should either guard against active sessions, or callers must ensure the session is stopped first. Add a safety gate or document the precondition:

```typescript
reset: () => {
  const status = get().subscribeStatus;  // requires using `create<Store>((set, get) => ...)`
  if (status === "Running" || status === "Stopping") {
    console.warn("useResponseStore.reset() called while subscribe is active — session not stopped");
  }
  set({ ...INITIAL_STATE });
},
```

---

### WR-03: `decode_types` individual elements are not validated

**File:** `src-tauri/src/commands/subscribe.rs:79-83`

**Issue:** Input validation checks that the `decode_types` Vec is non-empty but does not validate individual elements. A caller passing `[""]` (empty string) or `["  "]` (whitespace) passes the guard and enters the consumer loop. On every message, `pool.get_message_by_name("")` returns `None`, last_error is set to "Message type '' not found in loaded schema", and every message is emitted with `decoded: None, error: Some(...)`. This produces a confusing feed of error-decorated messages with no indication of the root cause.

**Fix:**

```rust
if decode_types.iter().any(|t| t.trim().is_empty()) {
    return Err(crate::error::AppError::InvalidInput(
        "decode_types must not contain empty or whitespace-only strings".to_string(),
    ));
}
```

---

### WR-04: Stale `channelRef.current` retained on failed `startSubscribe`

**File:** `src/components/response/SubscribePanel.tsx:39-40`

**Issue:** `channelRef.current` is set to the newly created `Channel` at line 40 before `startSubscribe` is awaited. If `startSubscribe` rejects (error branch, line 48-50), `channelRef.current` holds the channel from the failed attempt. On the next `handleStart` call, line 40 overwrites it with a fresh channel — fine in that case. But if `handleStop` or the cleanup effect were to access `channelRef.current` to cancel the channel explicitly, they would reference a stale object from a failed session. While `channelRef` is not currently used outside `handleStart`, this is a latent hazard for maintainers extending the code.

**Fix:** Clear the ref in the catch block:

```typescript
} catch (e) {
  channelRef.current = null;   // clear stale ref
  const message = e instanceof Error ? e.message : "Subscribe failed";
  setSubscribeStatus("Error", message);
}
```

---

### WR-05: Auto-stop `useEffect` misses `subscribeStatus` in dependency array

**File:** `src/components/response/SubscribePanel.tsx:73-82`

**Issue:** The auto-stop `useEffect` at line 73 reads `subscribeStatus` inside the closure but does not include it in the dependency array — only `[activeProfileName, connectionStatus]` are listed, and the `react-hooks/exhaustive-deps` warning is suppressed (line 81). The closure captures `subscribeStatus` at the time the effect was last run. If `subscribeStatus` changes to `"Running"` between renders where `activeProfileName` and `connectionStatus` stayed the same, the stale closure sees the old value and the guard `if (subscribeStatus === "Running" || ...)` evaluates against a potentially stale snapshot. In practice this is narrow because profile/connection changes co-occur with status changes, but the suppression comment does not explain the reasoning for excluding `subscribeStatus`, making it a silent correctness risk.

**Fix:** Either add `subscribeStatus` to the dependency array (which will re-run the effect on each status transition — harmless given the `prevProfileRef` guard), or add an explicit comment documenting why the stale closure is safe here:

```typescript
useEffect(() => {
  // ...
}, [activeProfileName, connectionStatus, subscribeStatus]);
```

---

## Info

### IN-01: Pluralization bug — "1 messages" in feed header

**File:** `src/components/response/MessageFeedTab.tsx:83`
**Also:** `src/components/response/MessageFeedTab.test.tsx:119`

**Issue:** `countLabel` is `"${messageCount} messages"` for any non-zero count. When there is exactly 1 message, the header reads "1 messages". The test at line 119 asserts `"1 messages"`, meaning the test validates the broken string — it will not catch a fix.

**Fix:**

```typescript
const countLabel =
  messageCount === 0
    ? "No messages"
    : messageCount === 1
    ? "1 message"
    : `${messageCount} messages`;
```

Update the test to assert `"1 message"`.

---

### IN-02: `consumer_tag` is hardcoded; coupling to the double-start guard

**File:** `src-tauri/src/commands/subscribe.rs:159`

**Issue:** `consumer_tag` is the constant string `"proto-sender-subscriber"`. This is fine while CR-01's TOCTOU race doesn't exist (one session at a time), but if two consumers are ever live simultaneously due to the race, they share the same tag and the broker will reject the second `basic_consume` (brokers require unique consumer tags per channel). It also makes debugging harder when looking at broker-side consumer lists. If the double-start guard is correctly fixed (CR-01), this is benign. Document the coupling.

**Fix:** Generate a unique tag per session to be safe and to ease broker-side debugging:

```rust
let consumer_tag = format!("proto-sender-{}", uuid::Uuid::new_v4());
```

Or at minimum add a comment: `// consumer_tag is safe as a constant because start_subscribe enforces a single active session`.

---

### IN-03: `tokio-util` feature `"rt"` is unused; correct feature for `CancellationToken` is `"sync"`

**File:** `src-tauri/Cargo.toml:32`

**Issue:** `tokio-util = { version = "0.7", features = ["rt"] }`. `CancellationToken` lives in `tokio_util::sync`, which requires the `"sync"` feature, not `"rt"`. The `"rt"` feature provides runtime utilities. If the project compiles, the Cargo feature unification may be pulling in `"sync"` transitively through another dependency — but explicitly declaring `"rt"` while using `"sync"` is misleading and fragile.

**Fix:**

```toml
tokio-util = { version = "0.7", features = ["sync"] }
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
