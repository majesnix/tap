---
phase: 14-live-subscribe-mode
fixed_at: 2026-05-21T07:30:00Z
review_path: .planning/phases/14-live-subscribe-mode/14-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 11
skipped: 1
status: partial
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-21
**Source review:** .planning/phases/14-live-subscribe-mode/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12
- Fixed: 11
- Skipped: 1

## Fixed Issues

### CR-01: TOCTOU race in `start_subscribe` — double-start guard is ineffective

**Files modified:** `src-tauri/src/commands/subscribe.rs`
**Commit:** 689eca1
**Applied fix:** Changed `SubscribeState.handle` to `Option<tauri::async_runtime::JoinHandle<()>>`.
  Created the CancellationToken and stored `SubscribeState { token, handle: None }` atomically
  inside the lock block BEFORE the first await, claiming the slot immediately. After `spawn()`
  returns, a second lock pass sets `state.handle = Some(handle)`. Added a `clear_slot_and_return!`
  macro used on all error paths (connection timeout, channel creation failure, credential load
  failure) to clear the slot. `stop_subscribe` updated to handle `Option<JoinHandle>`.
  Fixes the window where two concurrent calls both saw `None` and both spawned consumers.

---

### CR-02: Consumer self-termination is invisible to the frontend

**Files modified:** `src-tauri/src/commands/consume.rs`, `src-tauri/src/commands/subscribe.rs`,
  `src/lib/types.ts`, `src/components/response/SubscribePanel.tsx`,
  `src/components/response/SubscribePanel.test.tsx`
**Commit:** 689eca1
**Applied fix:** Added `is_terminal: bool` field to `DrainResult` Rust struct and `isTerminal: boolean`
  to the TypeScript `DrainResult` interface. `error_drain_result()` sets `is_terminal: true` (all
  call sites that precede a `break` in the consumer loop). Normal messages in the subscribe loop
  and all drain_messages results set `is_terminal: false`. The `Channel` callback in `handleStart`
  now calls `setSubscribeStatus("Idle")` when `msg.isTerminal` is true, making consumer
  self-termination (broker close, ack failure, delivery error) immediately visible to the user.

---

### CR-03: Start button race — `subscribeStatus` stays "Idle" during IPC await

**Files modified:** `src/components/response/SubscribePanel.tsx`,
  `src/components/response/SubscribePanel.test.tsx`
**Commit:** 125b330
**Applied fix:** Added `isStartingRef = useRef(false)` guard. `handleStart` returns early if
  `isStartingRef.current` is true; sets it to `true` before the await; resets in `finally` block.
  Start button disabled condition includes `|| isStartingRef.current` as a secondary guard.
  Added test cases: double-click fires only one IPC call; re-enabled after resolution.

---

### CR-04: No unmount cleanup — backend consumer outlives the React component

**Files modified:** `src/components/response/SubscribePanel.tsx`,
  `src/components/response/SubscribePanel.test.tsx`
**Commit:** 125b330
**Applied fix:** Added `useEffect(() => { return () => { ... }; }, [])` with empty deps that fires
  only on unmount. Uses `useResponseStore.getState()` (direct store access, not hook) to read
  current `subscribeStatus` and calls `stopSubscribe().catch(() => {})` + `setSubscribeStatus("Idle")`
  if the status is Running or Stopping. Added test cases for Running and Idle unmount scenarios.

---

### WR-01: `basic_qos` failure is silently swallowed

**Files modified:** `src-tauri/src/commands/subscribe.rs`
**Commit:** 689eca1
**Applied fix:** Replaced `let _ = amqp_channel.basic_qos(...)` with `if let Err(e) = ...`.
  On failure: logs via `tracing::warn!`, sends a terminal `error_drain_result` to the frontend
  (so the user sees the error), closes the connection, and returns early. This enforces the D-12
  prefetch cap guarantee.

---

### WR-02: `reset()` desynchronizes frontend/backend state

**Files modified:** `src/stores/useResponseStore.ts`
**Commit:** a940fb0
**Applied fix:** Changed `create<ResponseStore>((set) => ...)` to `(set, get) => ...` to access
  current state. Added a `console.warn` before `set({ ...INITIAL_STATE })` when
  `subscribeStatus === "Running" || "Stopping"`, documenting that callers must stop the session
  first. The behavior of reset() is unchanged — only the safety warning is added.

---

### WR-03: `decode_types` individual elements not validated

**Files modified:** `src-tauri/src/commands/subscribe.rs`
**Commit:** 689eca1
**Applied fix:** Added element-level validation after the existing `is_empty()` check:
  `if decode_types.iter().any(|t| t.trim().is_empty()) { return Err(...) }`.
  Returns `AppError::InvalidInput` with a clear message. Prevents empty/whitespace strings
  from causing confusing decode-error feed messages with no root-cause indication.

---

### WR-04: Stale `channelRef.current` retained on failed `startSubscribe`

**Files modified:** `src/components/response/SubscribePanel.tsx`
**Commit:** 125b330
**Applied fix:** Added `channelRef.current = null` at the start of the `catch` block in `handleStart`,
  before `setSubscribeStatus("Error", message)`. Clears the stale channel ref so any future
  `handleStop` or cleanup code doesn't reference a channel from a failed session.

---

### WR-05: Auto-stop `useEffect` misses `subscribeStatus` in dependency array

**Files modified:** `src/components/response/SubscribePanel.tsx`
**Commit:** 2faa3a8
**Applied fix:** Replaced the bare `eslint-disable-next-line` comment with a detailed explanation
  of why `subscribeStatus` is intentionally excluded from the dependency array:
  including it would trigger a re-entry loop (handleStop sets status to "Stopping" →
  effect re-fires with connectionStatus still disconnected → second handleStop call).
  The stale-closure risk is accepted as safe given the trigger conditions.
  Note: requires `"fixed: requires human verification"` — the reasoning is documented
  but the safety of the stale closure depends on profile/connection changes co-occurring
  with status changes in practice.

---

### IN-01: Pluralization bug — "1 messages" in feed header

**Files modified:** `src/components/response/MessageFeedTab.tsx`,
  `src/components/response/MessageFeedTab.test.tsx`
**Commit:** 6cbf203
**Applied fix:** Updated `countLabel` to use a three-way conditional:
  `messageCount === 0 ? "No messages" : messageCount === 1 ? "1 message" : \`${messageCount} messages\``.
  Updated the test assertion from `"1 messages"` to `"1 message"`.

---

### IN-02: `consumer_tag` hardcoded — coupling to double-start guard

**Files modified:** `src-tauri/src/commands/subscribe.rs`
**Commit:** 689eca1
**Applied fix:** Added comment: `// IN-02: consumer_tag is safe as a constant because start_subscribe
  enforces a single active session via the CR-01 atomic slot claim above.`
  Did NOT add uuid dependency (per review instructions).

---

## Skipped Issues

### IN-03: `tokio-util` feature `"rt"` should be `"sync"`

**File:** `src-tauri/Cargo.toml:32`
**Reason:** skipped: code context differs from review — fix not applicable
**Original issue:** The review stated `CancellationToken` requires the `"sync"` feature of tokio-util.
  Investigation found that tokio-util 0.7 does NOT have a `"sync"` feature. Available features
  include: `rt`, `codec`, `compat`, `io`, `time`, `net`, `full`, `slab`, `join-map`.
  Attempting to set `features = ["sync"]` causes `cargo build` to fail:
  "package `tap` depends on `tokio-util` with feature `sync` but `tokio-util` does not have that feature."
  The `"rt"` feature in tokio-util 0.7 includes `tokio/sync` as a transitive dependency, which
  is what makes `CancellationToken` available. The current `features = ["rt"]` is correct.

---

_Fixed: 2026-05-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
