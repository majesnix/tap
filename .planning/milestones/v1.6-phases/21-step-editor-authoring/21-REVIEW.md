---
phase: 21-step-editor-authoring
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/plans/PlanDetailPanel.tsx
  - src/components/plans/StepBlockPicker.tsx
  - src/components/plans/StepFieldEditor.tsx
  - src/components/plans/StepHistoryPicker.tsx
  - src/components/plans/StepListPanel.tsx
  - src/components/publish/PublishBar.tsx
  - src/stores/useHistoryStore.test.ts
  - src/stores/useHistoryStore.ts
  - src/stores/usePlanStore.test.ts
  - src/stores/usePlanStore.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The Phase 21 implementation is well-structured. The immutable update pattern is consistently applied in `usePlanStore`, rollback-on-persist-failure is implemented for every plan-level action, and the dnd-kit integration follows the correct PointerSensor pattern noted in project memory. The auto-save debounce with stale-step guard and the `safeParseFieldValues` fallback are sound.

Two critical bugs were found: `parseInt(...) || default` silently coerces a user-entered `0` to the fallback value (incorrect behavior), and `useHistoryStore` lacks the rollback-on-persist pattern that `usePlanStore` deliberately implements — meaning a disk failure after `appendEntry` or `clearHistory` leaves in-memory state permanently diverged from disk. Four additional warnings cover a bounds-check gap in `reorderSteps`, weak type-guard coverage, non-deterministic history path resolution, and an unnecessary dead prop. Three info items cover `console.error` usage, magic numbers, and debug artifact patterns.

## Critical Issues

### CR-01: `parseInt(...) || default` silently discards a valid `0` value

**File:** `src/components/plans/StepFieldEditor.tsx:344,351`

**Issue:** `buildResponseMode` uses the pattern `parseInt(delayMs, 10) || 200` and `parseInt(timeoutMs, 10) || 10000`. When the user types `0` in either field, `parseInt("0", 10)` evaluates to `0`, which is falsy, so the expression silently substitutes the default. The `delay` and `timeout` inputs both have `min="0"`, so zero is a valid and meaningful value. A user setting `delay_ms: 0` (fire immediately, no wait) always receives `200` ms instead.

**Fix:**
```typescript
function buildResponseMode(currentMode: string): ResponseMode {
  if (currentMode === "no-wait") {
    const parsed = parseInt(delayMs, 10);
    return { mode: "no-wait", delay_ms: Number.isNaN(parsed) ? 200 : parsed };
  }
  const rm = currentMode === "correlation-id" ? "correlation-id" : "first-arrival";
  const parsedTimeout = parseInt(timeoutMs, 10);
  return {
    mode: rm,
    reply_queue: replyQueue,
    timeout_ms: Number.isNaN(parsedTimeout) ? 10000 : parsedTimeout,
  };
}
```

---

### CR-02: `useHistoryStore` has no rollback on persist failure — in-memory state diverges from disk

**File:** `src/stores/useHistoryStore.ts:47-62`

**Issue:** `appendEntry` and `clearHistory` both call `set(...)` to update in-memory state *before* `persistEntries` is awaited. If `store.save()` throws, the in-memory store reflects a state that was never written to disk. On the next app launch, `loadHistory` reloads from disk, silently discarding the in-memory changes. This is a data-loss risk. By contrast, every action in `usePlanStore` captures `previous`, optimistically sets `updated`, and rolls back to `previous` in the catch block — that pattern was explicitly built to prevent this. The history store breaks the established contract without documented intent.

**Fix:** Apply the same rollback pattern used in `usePlanStore`:
```typescript
appendEntry: async (entry) => {
  if (!get().historyLoaded) return;
  const previous = get().entries;
  const updated = [entry, ...previous].slice(0, MAX_ENTRIES);
  set({ entries: updated });
  try {
    await persistEntries(updated);
  } catch (err) {
    set({ entries: previous });
    throw err;
  }
},

clearHistory: async () => {
  const previous = get().entries;
  set({ entries: [] });
  try {
    await persistEntries([]);
  } catch (err) {
    set({ entries: previous });
    throw err;
  }
},
```

---

## Warnings

### WR-01: `reorderSteps` has no upper-bound guard — out-of-range index corrupts the steps array

**File:** `src/stores/usePlanStore.ts:267-270`

**Issue:** `steps.splice(fromIndex, 1)` returns `[]` (not an error) when `fromIndex >= steps.length`. The destructuring `const [moved] = steps.splice(...)` then yields `moved === undefined`. The subsequent `steps.splice(toIndex, 0, undefined)` inserts `undefined` into the steps array. The call site in `PlanDetailPanel` guards against `-1` from `findIndex`, but does not validate that indexes are within bounds. An `undefined` step in the array would crash any consumer that reads `step.id` or `step.name`.

**Fix:** Add a bounds check at the top of the `reorderSteps` handler:
```typescript
reorderSteps: async (planId, fromIndex, toIndex) => {
  if (!get().plansLoaded) return;
  const plan = get().plans.find((p) => p.id === planId);
  if (!plan) return;
  const len = plan.steps.length;
  if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) return;
  // ... rest of implementation
},
```

---

### WR-02: `isPlanStep` type guard does not validate discriminant fields — malformed persisted data passes validation

**File:** `src/stores/usePlanStore.ts:30-42`

**Issue:** `isPlanStep` checks `typeof v.target === "object"` but does not inspect `target.kind`, `target.queue`/`target.exchange`, or `response_mode.mode`. Persisted data with `target: {}`, `target: { kind: "bogus" }`, or `response_mode: { mode: "no-wait" }` (missing `delay_ms`) would pass the guard and be loaded into the store. CLAUDE.md notes that Phase 22 will exhaustive-switch on `target.kind` and `response_mode.mode` — corrupt data that passes this guard will cause a runtime crash at that switch. The type documentation (`types.ts:167`) explicitly calls out that these are discriminated unions.

**Fix:** Extend the guard to validate the discriminant and required fields:
```typescript
function isPublishTarget(v: unknown): v is PublishTarget {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  if (t.kind === "queue") return typeof t.queue === "string";
  if (t.kind === "exchange")
    return typeof t.exchange === "string" && typeof t.routing_key === "string";
  return false;
}

function isResponseMode(v: unknown): v is ResponseMode {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  if (m.mode === "no-wait") return typeof m.delay_ms === "number";
  if (m.mode === "correlation-id" || m.mode === "first-arrival")
    return typeof m.reply_queue === "string" && typeof m.timeout_ms === "number";
  return false;
}

function isPlanStep(value: unknown): value is PlanStep {
  // ... existing checks ...
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.proto_path === "string" &&
    typeof v.message_type === "string" &&
    typeof v.field_values === "string" &&
    isPublishTarget(v.target) &&
    isResponseMode(v.response_mode)
  );
}
```

---

### WR-03: History-based path resolution is non-deterministic when multiple open files declare the same message type

**File:** `src/components/plans/StepHistoryPicker.tsx:36-40`

**Issue:** When `entry.protoPath` is absent (entries created before Phase 21), the fallback uses `openFiles.find(...)` — which returns the *first* open file that declares `entry.messageTypeName`. If two open `.proto` files define the same fully-qualified message type name (a common occurrence in large polyrepo setups), the resolved path is determined by the order of `openFiles`, not by any stable semantic. The step will be silently pre-filled with the wrong file path, and the user may not notice until they attempt to send.

**Fix:** When multiple files match, surface a disambiguation prompt or toast rather than silently picking the first:
```typescript
const matches = openFiles.filter(
  (f) => f.schema?.message_map[entry.messageTypeName] !== undefined
);
if (matches.length === 0) {
  toast.error(`Open the .proto file for ${entry.messageTypeName} first, then retry.`);
  return;
}
if (matches.length > 1) {
  // Minimal safe fallback: warn and pick first, or show a picker
  toast.warning(
    `Multiple open files declare ${entry.messageTypeName}. Using ${matches[0].filePath.split("/").pop()}.`
  );
}
const resolvedPath = matches[0].filePath;
```

---

### WR-04: `duplicateStep` appends at the *end* of the array, not adjacent to the original

**File:** `src/stores/usePlanStore.ts:244-248`

**Issue:** `duplicateStep` appends the duplicate to the end of the steps array (`[...p.steps, duplicate]`). The test at line 411 explicitly asserts this behavior (`steps[0].id === 'orig3'` — original first, then duplicate appended). However, the typical user expectation for "Duplicate" in a list is that the copy appears immediately *after* the original, not at the end of a potentially long list. The test is testing the current (potentially surprising) behavior rather than the intended UX. If the UI-SPEC defines append-to-end this is correct, but the discrepancy between user expectation and behavior is a usability bug worth flagging.

**Fix (if intended to be adjacent):**
```typescript
updated = state.plans.map((p) => {
  if (p.id !== planId) return p;
  const idx = p.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return p;
  const steps = [...p.steps];
  steps.splice(idx + 1, 0, duplicate);
  return { ...p, steps };
});
```
If append-to-end is the intended design per UI-SPEC, add a comment citing the spec decision.

---

## Info

### IN-01: `activeDragId` prop is accepted but unused in `StepListPanel`

**File:** `src/components/plans/StepListPanel.tsx:193`

**Issue:** `activeDragId` is destructured as `_activeDragId` (dead-variable prefix) and never used inside the component. The prop participates in the public interface, costs a render, and adds noise to the type definition. It was likely intended for ghost-row rendering during drag, but that functionality was either moved to `DragOverlay` in `PlanDetailPanel` or not yet implemented.

**Fix:** Remove the prop from `StepListPanelProps` and the destructuring. If ghost-row rendering is planned for a future phase, add a TODO comment instead.

---

### IN-02: Multiple `console.error` calls in production component code

**Files:**
- `src/components/plans/PlanDetailPanel.tsx:60`
- `src/components/plans/StepFieldEditor.tsx:597, 627`
- `src/components/plans/StepListPanel.tsx:219, 229, 237`

**Issue:** Project coding-style rules (from CLAUDE.md / rules/ecc/common/coding-style.md) state "No console.log statements in production code — use proper logging libraries instead." The `.catch(console.error)` pattern appears in multiple places. For a desktop dev-tool this is low severity, but it is inconsistent with the stated project standard.

**Fix:** Either use a structured logger or suppress the calls if errors are already surfaced via toast. In cases where a toast is already shown (e.g., `StepBlockPicker`, `StepHistoryPicker`), the `console.error` in the catch is redundant with user-visible feedback and can be removed.

---

### IN-03: Magic numbers for debounce delay and outcome auto-dismiss durations

**Files:**
- `src/components/plans/StepFieldEditor.tsx:575` — `300` (debounce ms)
- `src/components/publish/PublishBar.tsx:249-253` — `3000`, `5000` (outcome dismiss delays)

**Issue:** Bare numeric literals are used for meaningful timing thresholds without named constants. Per the project coding-style, magic numbers should be extracted to named constants.

**Fix:**
```typescript
// StepFieldEditor.tsx
const FIELD_AUTOSAVE_DEBOUNCE_MS = 300;

// PublishBar.tsx
const ACK_BADGE_DISMISS_MS = 3000;
const NACK_RETURNED_BADGE_DISMISS_MS = 5000;
```

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
