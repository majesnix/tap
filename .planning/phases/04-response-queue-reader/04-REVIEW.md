---
phase: 04-response-queue-reader
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src-tauri/src/commands/consume.rs
  - src/stores/useResponseStore.ts
  - src/components/response/ResponseTab.tsx
  - src/components/response/ResponseTab.test.tsx
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/types.ts
  - src/lib/ipc.ts
  - src/components/layout/RightPanel.tsx
  - src/components/response/ResponseQueuePicker.tsx
  - src/components/response/ResponseQueuePicker.test.tsx
  - src/components/response/ResponseDecodedView.tsx
  - src/components/response/ResponseDecodedView.test.tsx
  - src/components/response/ResponseHexSection.tsx
  - src/components/response/ResponseHexSection.test.tsx
findings:
  critical: 3
  warning: 3
  info: 1
  total: 7
status: fixed
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The phase implements a response queue reader: a Rust `consume_message` Tauri command that connects to RabbitMQ via `basic_get`, acks, and decodes a protobuf message, paired with React components (`ResponseQueuePicker`, `ResponseDecodedView`, `ResponseHexSection`, `ResponseTab`) wired through a Zustand store.

The AMQP logic is solid — ack-before-decode, tight URI scope, connection cleanup on error paths, and the connection mutex guard correctly dropped before any `.await`. The component structure is clean and the test coverage is reasonable.

Three blockers were found:

1. The Read button appears enabled (no proto type selected) but clicks silently do nothing — no feedback to the user.
2. The `consume_message` Rust command calls `.unwrap()` on a `Mutex` that a sibling command (`encode_message`) also holds with `.unwrap()` — a panic in either command poisons the mutex for all subsequent calls.
3. Clipboard write failures are swallowed silently while a success toast fires.

---

## Critical Issues

### CR-01: Read button enabled without proto type — silent no-op on click

**File:** `src/components/response/ResponseTab.tsx:22`

**Issue:** `canRead` is computed as `isConnected && selectedQueue.trim().length > 0`. It does not include `selectedMessageType`. As a result, the Read button is enabled — and the `disabled` prop on the `<Button>` evaluates to `false` — even when no `.proto` file has been loaded and `selectedMessageType` is `null`.

When the user clicks the enabled button, `handleRead` silently returns at line 30 (`if (!canRead || !activeProfileName || !selectedMessageType) return;`) with no feedback: no error, no toast, no state change. The user is left confused.

`selectedMessageType` starts as `null` in `useProtoStore` (INITIAL_STATE line 54 in `useProtoStore.ts`) and is only populated after a proto file is opened. This is a real user-reachable state.

**Fix:**
```tsx
// ResponseTab.tsx
const canRead =
  isConnected &&
  selectedQueue.trim().length > 0 &&
  selectedMessageType !== null;
```

Optionally, add a tooltip on the disabled button explaining "Load a .proto file to enable reading."

---

### CR-02: `consume_message` panics on poisoned Mutex — cascading crash

**File:** `src-tauri/src/commands/consume.rs:41`

**Issue:** `pool_state.lock().unwrap()` will panic if the mutex is in a poisoned state. A mutex becomes poisoned when a thread panics while holding it.

`encode_message` (`src-tauri/src/commands/encode.rs:13`) holds the same `Mutex<Option<DescriptorPool>>` and also calls `.lock().unwrap()`. If `encode_message` panics for any reason while the lock is held, the shared mutex is permanently poisoned. Every subsequent call to `consume_message`, `encode_message`, or any other command that locks this mutex will panic — crashing the backend for the rest of the application session.

**Fix:** Replace `.unwrap()` with `.map_err(...)` to convert a poisoned lock into a graceful `AppError`:

```rust
// consume.rs:40-49
let pool = {
    let guard = pool_state
        .lock()
        .map_err(|_| crate::error::AppError::EncodeError {
            field: "<root>".to_string(),
            message: "Internal state lock poisoned — restart the application".to_string(),
        })?;
    guard
        .as_ref()
        .ok_or_else(|| crate::error::AppError::EncodeError {
            field: "<root>".to_string(),
            message: "No proto file loaded".to_string(),
        })?
        .clone()
};
```

Apply the same fix in `encode.rs:13` to prevent the poison in the first place.

---

### CR-03: Clipboard write rejection silently swallowed — false success toast

**File:** `src/components/response/ResponseHexSection.tsx:13,19`

**Issue:** Both `handleCopyHex` and `handleCopyJson` use `void navigator.clipboard.writeText(...)` and immediately call `toast(...)`. The `void` operator discards the promise return value. If `writeText` rejects — which happens when the document is not focused, the browser denies clipboard permission, or the Tauri webview is in the background — the error is silently discarded and the user sees "Hex copied" / "JSON copied" even though no copy occurred.

**Fix:** Await the clipboard write and gate the success toast on the resolved value; show an error toast on rejection:

```tsx
const handleCopyHex = async () => {
  try {
    await navigator.clipboard.writeText(lastResult.hexString);
    toast("Hex copied", { duration: 2000 });
  } catch {
    toast.error("Copy failed — clipboard access denied", { duration: 2000 });
  }
};

const handleCopyJson = async () => {
  if (!lastResult.decoded) return;
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(lastResult.decoded, null, 2)
    );
    toast("JSON copied", { duration: 2000 });
  } catch {
    toast.error("Copy failed — clipboard access denied", { duration: 2000 });
  }
};
```

---

## Warnings

### WR-01: IPC error in `handleRead` does not trigger tab auto-switch — error hidden off-screen

**File:** `src/components/response/ResponseTab.tsx:47-49`

**Issue:** The `handleRead` success path calls `setLastReadAt(Date.now())` only when `!result.empty` (line 44). The `catch` block sets `lastResult.error` but never calls `setLastReadAt`. `RightPanel.tsx` auto-switches to the Response tab only on a `lastReadAt` change (line 42). This means:

- If the user is on the Hex tab and clicks Read,
- The IPC call throws (connection lost, queue deleted, etc.),
- The error is stored in `lastResult.error` in the Response tab,
- But the tab never switches — the error is invisible.

The user must manually navigate to the Response tab to see the error.

**Fix:** Call `setLastReadAt(Date.now())` on any non-empty result including the IPC error path:

```tsx
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  setLastResult({ empty: false, decoded: null, hexString: "", error: msg });
  setLastReadAt(Date.now()); // switch to Response tab to surface the error
} finally {
```

---

### WR-02: Fragile substring match coupling between frontend and backend error message

**File:** `src/components/response/ResponseQueuePicker.tsx:44`

**Issue:** The frontend distinguishes 401 auth errors from other failures by checking `errMsg.includes("authentication failed")`. The backend comment at `error.rs:19` explicitly warns that "this exact message is matched by frontend catch block substring." This is a brittle string coupling: any rephrasing of the backend error message silently changes the frontend behavior from showing the destructive auth-error badge to silently falling through to Manual mode without surfacing the auth failure.

The typed `AppError` enum already has a clean `ManagementApiAuthFailed` discriminant. The proper fix is to plumb a discriminating code through the IPC boundary rather than substring-matching the serialized message.

**Fix (minimal, without changing the IPC contract):** Define the sentinel string as a shared constant that both sides reference, or pin the check to the exact prefix:

```tsx
// At minimum: assert the exact prefix to avoid false negatives
if (errMsg.startsWith("Management API authentication failed")) {
```

**Fix (proper):** Add a `code` field to the serialized error so the frontend can switch on `error.code === "auth_failed"` instead of parsing the message string. This requires a small change to `AppError`'s `Serialize` implementation.

---

### WR-03: Race condition on rapid profile switches in `ResponseQueuePicker` useEffect

**File:** `src/components/response/ResponseQueuePicker.tsx:35-54`

**Issue:** The `fetchQueues` effect has no cancellation mechanism. If `activeProfileName` changes from A to B before the fetch for A completes, both fetches are in-flight simultaneously. The slower one resolves last and overwrites the state with stale data (A's queue list while profile B is active).

Additionally, `setQueueList` and `setManagementAuthError` are referenced inside the effect but omitted from the dependency array. While Zustand setters are referentially stable (no functional difference), this is an exhaustive-deps violation that could cause issues if the component is ever refactored to use non-Zustand setters.

**Fix:**
```tsx
useEffect(() => {
  if (!activeProfileName) return;
  let cancelled = false;

  const fetch = async () => {
    try {
      const qs = await fetchQueues(activeProfileName);
      if (cancelled) return;
      setManagementAuthError(null);
      setQueueList(qs, true);
    } catch (err: unknown) {
      if (cancelled) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("authentication failed")) {
        setManagementAuthError(errMsg);
        setQueueList([], false);
      } else {
        setManagementAuthError(null);
        setQueueList([], false);
      }
    }
  };
  void fetch();
  return () => { cancelled = true; };
}, [activeProfileName, setQueueList, setManagementAuthError]);
```

---

## Info

### IN-01: `JsonTreeNode` comment says "top-level nodes start expanded" but all depths start expanded

**File:** `src/components/response/ResponseDecodedView.tsx:16`

**Issue:** The comment reads `// top-level nodes start expanded (UI-SPEC)` but the `useState(true)` initial value applies to all depths, not just depth 0. Deeply nested messages also start expanded. This is either an incorrect comment or an unimplemented intent to only expand the top level.

**Fix:** Either correct the comment to match actual behavior:
```tsx
const [open, setOpen] = useState(true); // all nodes start expanded
```

Or implement the intent (gate on depth):
```tsx
const [open, setOpen] = useState(depth === 0);
```

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
