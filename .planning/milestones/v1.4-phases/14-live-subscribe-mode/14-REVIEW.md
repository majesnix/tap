---
phase: 14-live-subscribe-mode
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/response/SubscribePanel.tsx
  - src/components/response/SubscribePanel.test.tsx
  - src/components/layout/RightPanel.tsx
  - src/components/layout/RightPanel.test.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 14 Gap Closure (Plan 14-04): Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the four files changed in gap-closure plan 14-04 for phase 14 (live subscribe mode). The changes address GAP-1 (Start button re-enabled from Error state), GAP-2 (tab-switch guard during subscribe), and GAP-3 (Error-to-Idle reset on profile change).

No security vulnerabilities, injection vectors, or hardcoded credentials were found. The component trust boundary is appropriate for a single-user desktop tool. Logic and control flow are generally correct and the GAP-1/GAP-2/GAP-3 fixes are structurally sound. Four warnings and four info items were found.

---

## Warnings

### WR-01: `isStartingRef.current` in the `disabled` prop does not update the button visually

**File:** `src/components/response/SubscribePanel.tsx:192`

**Issue:** The Start button's `disabled` expression includes `|| isStartingRef.current`, but refs do not trigger re-renders. When the user clicks Start, `isStartingRef.current` is set to `true` inside `handleStart` (line 46), but the component does not re-render, so the button remains visually enabled for the entire `await startSubscribe()` window — typically 500ms to 3s. The functional guard inside `handleStart` (line 45) does correctly block the second IPC call, but the button visually affords a second click with no indication that the first click was registered. This is a misleading UI affordance that could cause user confusion.

Either use `useState` so the button reflects reality, or remove the ref from the `disabled` prop and rely solely on the guard.

**Fix:**
```tsx
// Option A — use useState so the button visually updates
const [isStarting, setIsStarting] = useState(false);

const handleStart = async () => {
  if (isStarting) return;
  setIsStarting(true);
  // ...existing logic...
  // in finally:
  setIsStarting(false);
};

// disabled prop:
disabled={(subscribeStatus !== "Idle" && subscribeStatus !== "Error") || !selectedQueue || isStarting}

// Option B — minimal: remove the ref from disabled (guard inside handleStart is sufficient)
disabled={(subscribeStatus !== "Idle" && subscribeStatus !== "Error") || !selectedQueue}
```

---

### WR-02: Auto-stop effect can fire a second `handleStop()` while status is already `Stopping`

**File:** `src/components/response/SubscribePanel.tsx:127-139`

**Issue:** The auto-stop `useEffect` condition is `subscribeStatus === "Running" || subscribeStatus === "Stopping"`. When status is `"Stopping"` (meaning a `handleStop()` call is already in-flight) and `activeProfileName` or `connectionStatus` changes again in the same render cycle — for example, a disconnect event arrives while stopping is pending — the effect fires a second `handleStop()`. This results in two concurrent `stopSubscribe()` IPC calls, which may cause an error response from the Rust backend and will set status to `"Idle"` twice in sequence.

Guarding on `"Running"` only eliminates the re-entrancy window. The `"Stopping"` branch was included to handle connection drops mid-stop, but a connection drop during `"Stopping"` is already handled by the `catch` branch in `handleStop` (line 80-82).

**Fix:**
```tsx
useEffect(() => {
  if (subscribeStatus === "Running") {
    if (connectionStatus !== "connected" || activeProfileName !== prevProfileRef.current) {
      void handleStop();
    }
  } else if (subscribeStatus === "Error" && activeProfileName !== prevProfileRef.current) {
    // GAP-3: dead Error session — reset to Idle on profile switch
    setSubscribeStatus("Idle");
  }
  prevProfileRef.current = activeProfileName;
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeProfileName, connectionStatus]);
```

---

### WR-03: Unmount cleanup swallows `stopSubscribe` errors but unconditionally marks status Idle, silently leaking backend consumer on failure

**File:** `src/components/response/SubscribePanel.tsx:92-101`

**Issue:** The unmount cleanup at line 97 calls `void stopSubscribe().catch(() => {})` and unconditionally calls `setStatus("Idle")` immediately after. If `stopSubscribe` rejects (e.g., the connection is already closed, or the Rust command returns an error), the backend consumer process may still be running with no UI to observe or stop it, while the store shows `"Idle"`. The empty `.catch(() => {})` guarantees the error is silently lost. At minimum the error should be logged so developers can diagnose backend consumer leaks during development.

**Fix:**
```tsx
useEffect(() => {
  return () => {
    const { subscribeStatus: status, setSubscribeStatus: setStatus } =
      useResponseStore.getState();
    if (status === "Running" || status === "Stopping") {
      void stopSubscribe().catch((err) => {
        console.warn("stopSubscribe failed during unmount cleanup:", err);
      });
      setStatus("Idle");
    }
  };
}, []);
```

---

### WR-04: Test renders two `SubscribePanel` instances simultaneously without unmounting the first

**File:** `src/components/response/SubscribePanel.test.tsx:316-317`

**Issue:** In the "does not call stopSubscribe on unmount when status is Idle" test, `render(...)` is called twice before the first render is unmounted:

```ts
render(<SubscribePanel {...DEFAULT_PROPS} />);           // never unmounted
const { unmount } = render(<SubscribePanel {...DEFAULT_PROPS} />);
```

Both instances share the same Zustand store and both have live `useEffect` hooks (auto-stop effect, unmount cleanup). The first instance is never cleaned up and its effects remain active for the test's duration. The test passes coincidentally because status is `Idle` for both, but the double-render is a latent reliability issue — a future store state change in this test could trigger the first instance's auto-stop effect unexpectedly.

**Fix:**
```ts
test("does not call stopSubscribe on unmount when status is Idle", () => {
  const { unmount } = render(<SubscribePanel {...DEFAULT_PROPS} />);

  act(() => {
    unmount();
  });

  expect(mockStopSubscribe).not.toHaveBeenCalled();
});
```

---

## Info

### IN-01: Duplicate `useEffect` import across two lines

**File:** `src/components/response/SubscribePanel.tsx:1, 12`

**Issue:** `useEffect` is imported on line 12 as a standalone import, while line 1 already imports from React (but only `useRef`). The comment on line 11 suggests this was an intentional split, but it is non-standard and will trigger linting warnings in most configs. Both imports should be consolidated.

**Fix:**
```tsx
// Consolidated single import on line 1
import { useRef, useEffect } from "react";
// Delete line 12
```

---

### IN-02: `renderStatusBadge` switch has no exhaustiveness guard

**File:** `src/components/response/SubscribePanel.tsx:148-178`

**Issue:** The `switch (subscribeStatus)` covers all four current `SubscribeStatus` union members but has no `default` branch. If a new status value is added to the union in the future, TypeScript will not warn at the call site and the function will return `undefined` implicitly (the JSX renders nothing). Adding a `never` exhaustiveness check converts this into a compile-time error at the point of the union extension.

**Fix:**
```tsx
default: {
  const _exhaustive: never = subscribeStatus;
  return null;
}
```

---

### IN-03: Fragile `setTimeout(50)` used to wait for effect non-firing in test

**File:** `src/components/response/SubscribePanel.test.tsx:394`

**Issue:** The test "does NOT reset Error state when only connectionStatus changes" uses `await new Promise((resolve) => setTimeout(resolve, 50))` to wait for any potential `useEffect` to fire before asserting the status is still `"Error"`. Timing-based waits in tests are inherently fragile on slow CI machines and are an antipattern in Vitest, which provides deterministic timer control.

**Fix:** Use Vitest fake timers for this test, or restructure to assert synchronously after `act()`. The effect is synchronous after the `act` wrapper, so a 50ms sleep is not needed:

```ts
act(() => {
  useConnectionStore.setState({ connectionStatus: "disconnected" });
});
// The effect has now run synchronously inside act — no sleep needed
expect(useResponseStore.getState().subscribeStatus).toBe("Error");
```

---

### IN-04: `RightPanel.test.tsx` does not cover `pendingReplayValues` or `lastReadAt` auto-switch paths

**File:** `src/components/layout/RightPanel.test.tsx`

**Issue:** The test file covers both GAP-2 scenarios (send while on hex, send while on response), but the other two auto-switch effects in `RightPanel.tsx` have no test coverage:
1. Lines 37-42: `pendingReplayValues` null-to-non-null transition switches to hex tab.
2. Lines 44-50: `lastReadAt` change switches to response tab.
3. The edge-detection guard (line 38: `prevPendingReplay.current === null`) that prevents a non-null-to-same-non-null repeat from re-switching is also untested.

These paths are reachable from the same file under review and a regression there would be invisible to the current test suite.

**Fix:** Add coverage:
```ts
test("switches to hex tab when pendingReplayValues transitions from null to non-null", ...)
test("does NOT re-switch to hex when pendingReplayValues stays non-null across re-render", ...)
test("switches to response tab when lastReadAt changes", ...)
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
