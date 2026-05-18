---
phase: 01-proto-parsing-form
reviewed: 2026-05-17T10:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/components/form/FormPanel.tsx
  - src/components/form/__tests__/FormPanel.test.tsx
  - src/test/setup.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-17T10:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This review covers the `FormPanel` component, its test suite, and the shared test setup file. The component wires debounced form values to the `encodeMessage` IPC call and renders the protobuf form. The architecture is clean and readable. Two blockers exist: a stale-async race condition that can display incorrect hex output, and a type-switch desync window where a changed message type fires `encodeMessage` with values from the previous type. Two warnings cover error-detail loss and missing failure-path test coverage.

---

## Critical Issues

### CR-01: Async encode effect has no cancellation — stale result can overwrite live hex preview

**File:** `src/components/form/FormPanel.tsx:27-43`

**Issue:** The `useEffect` fires a self-invoking `async` IIFE with `void (async () => { ... })()` and does not return a cleanup function. If `debouncedValues` or `selectedMessageType` changes while a previous `encodeMessage` call is still in-flight (e.g., the backend is slow), the stale promise resolves after the newer one and calls `setHexPreview` / `setEncoding(false)` with the old result. The user sees hex output for data they no longer intend to send. The same pattern causes a React "can't perform a state update on an unmounted component" warning if the component unmounts mid-encode.

**Fix:**
```tsx
useEffect(() => {
  if (!debouncedValues || !selectedMessageType) return;

  let cancelled = false;

  void (async () => {
    try {
      setEncoding(true);
      setEncodeError(null);
      const bytes = await encodeMessage(selectedMessageType, debouncedValues);
      if (cancelled) return;
      setHexPreview(bytesToHex(bytes));
    } catch (err) {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Encoding failed";
      setEncodeError(msg);
      setHexPreview("");
    } finally {
      if (!cancelled) setEncoding(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [debouncedValues, selectedMessageType, setHexPreview, setEncoding, setEncodeError]);
```

---

### CR-02: `selectedMessageType` / `debouncedValues` desync — wrong type sent to encoder when switching message types

**File:** `src/components/form/FormPanel.tsx:27-43`

**Issue:** When the user selects a different message type, `selectedMessageType` updates immediately in the store and the `useEffect` re-runs. At that point `debouncedValues` still holds the form values from the previous message type (the `useDebounce` hook has not fired yet, and `ProtoFormRenderer`'s `useWatch` emits the post-reset values only on the next render after `methods.reset` runs). The effect therefore calls `encodeMessage(newType, oldValues)`. This either produces a backend error (if the old field names are unknown to the new schema) or silently encodes mismatched data and displays incorrect bytes.

**Fix:** Clear `latestValues` and `debouncedValues` when the selected message type changes so the effect skips until new-type values arrive:
```tsx
// Reset local values whenever the message type changes
useEffect(() => {
  setLatestValues(null);
}, [selectedMessageType]);
```
Because `debouncedValues` depends on `latestValues` via `useDebounce`, resetting `latestValues` to `null` makes the guard `if (!debouncedValues || !selectedMessageType) return;` suppress the stale-values encode on the next tick.

---

## Warnings

### WR-01: Error narrowing discards structured error detail from Tauri IPC

**File:** `src/components/form/FormPanel.tsx:36`

**Issue:** `const msg = typeof err === "string" ? err : "Encoding failed";` only preserves the error message when the IPC layer returns a raw string. Tauri `invoke` errors from `thiserror`-derived types are serialized as JSON objects (or sometimes as `{ message: "..." }` structs). `typeof err` for an object is `"object"`, so the branch always falls to `"Encoding failed"` and discards all context. The TypeScript coding-style rule in this project mandates `instanceof Error` narrowing with a `getErrorMessage(error: unknown)` helper.

**Fix:**
```tsx
function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Encoding failed";
}

// In the catch block:
setEncodeError(getErrorMessage(err));
```

---

### WR-02: Test suite has no coverage for the encode error path

**File:** `src/components/form/__tests__/FormPanel.test.tsx:60-117`

**Issue:** Both tests only exercise the happy path (`encodeMessage` resolves). There is no test for: (a) `encodeMessage` rejecting and the error message appearing in the store, (b) the component unmounting before the encode completes, or (c) a second debounce firing before the first IPC call resolves. Given the project's 80% coverage requirement and the fact that the error-narrowing bug in CR-01/WR-01 is undetectable without a rejection test, the absence of these cases is a quality gap that would block a PR under the project's own standards.

**Fix:** Add at minimum one rejection-path test:
```tsx
test("stores encode error when encodeMessage rejects", async () => {
  vi.mocked(ipc.encodeMessage).mockRejectedValue(new Error("bad field"));
  render(<FormPanel />);

  const input = screen.getByRole("textbox");
  act(() => { fireEvent.change(input, { target: { value: "x" } }); });
  await act(async () => { vi.advanceTimersByTime(200); });

  expect(useProtoStore.getState().encodeError).toBe("bad field");
  expect(useProtoStore.getState().hexPreview).toBe("");
});
```

---

## Info

### IN-01: `ResizeObserverStub` does not satisfy the DOM `ResizeObserver` interface

**File:** `src/test/setup.ts:5-11`

**Issue:** The stub class has no constructor signature accepting `ResizeObserverCallback`. The DOM `ResizeObserver` constructor is `new ResizeObserver(callback: ResizeObserverCallback)`. With `strict` TypeScript, the assignment `window.ResizeObserver = ResizeObserverStub` may produce a type error because `typeof ResizeObserverStub` is not assignable to `typeof ResizeObserver`. This is harmless at runtime but can suppress TS errors in test files that try to construct a `ResizeObserver`.

**Fix:**
```ts
class ResizeObserverStub {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
```

---

_Reviewed: 2026-05-17T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
