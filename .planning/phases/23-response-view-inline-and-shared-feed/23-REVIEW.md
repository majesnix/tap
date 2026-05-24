---
phase: 23-response-view-inline-and-shared-feed
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/stores/usePlanExecutionStore.ts
  - src/stores/usePlanExecutionStore.test.ts
  - src/hooks/usePlanRunner.ts
  - src/hooks/usePlanRunner.test.ts
  - src/components/plans/StepReplyView.tsx
  - src/components/plans/PlanReplyFeedTab.tsx
  - src/components/plans/PlanDetailPanel.tsx
  - src/components/plans/StepListPanel.tsx
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 23 response-view implementation: the new Zustand store fields (`stepReplies`, `planReplyFeed`, `paneMode`), the runner hook that dispatches reply data, and the four UI components that render the inline step reply and shared feed tab. The store implementation is structurally sound and the test suite has good coverage of state transitions. Four issues require attention before this ships: one timestamp precision bug that corrupts stored data, one test that silently misasserts a critical guard (isCancelling), one duplicate-render issue in `StepReplyView`, and one misleading "computed selector" comment that will cause maintenance bugs.

---

## Warnings

### WR-01: Fractional Timestamp Written to FeedMessage — Data Inconsistency

**File:** `src/hooks/usePlanRunner.ts:84`

**Issue:** `Date.now() / 1000` produces a floating-point value (e.g., `1716523200.123`). `FeedMessage.timestamp` is typed `number | null` with the doc comment "seconds since epoch" — matching the integer seconds produced by every other `FeedMessage` producer in the codebase (all DrainResult sources supply integer Unix timestamps from the RabbitMQ broker). Downstream consumers in `MessageFeedRow` format this field as an integer timestamp; a fractional value will produce subtle display drift or wrong sorting depending on the formatter used.

**Fix:**
```typescript
// Before
timestamp: Date.now() / 1000,

// After
timestamp: Math.floor(Date.now() / 1000),
```

---

### WR-02: Test Comment Contradicts Implementation — isCancelling Guard Untested

**File:** `src/hooks/usePlanRunner.test.ts:319-344`

**Issue:** The test titled "when isCancelling is true, error from in-flight step does not stop loop" has a comment claiming "isCancelling prevents the break." The actual implementation at `usePlanRunner.ts:103` is:

```typescript
if (stopOnError || isCancelling) {
  break;
}
```

`isCancelling` causes a `break` — it does NOT prevent one. The sole assertion (`expect(isCancelling).toBe(true)`) is trivially true because the mock itself calls `setIsCancelling(true)` — it passes regardless of whether the loop broke or continued. The test therefore provides zero behavioral coverage of the pitfall-#8 mitigation it claims to verify. If the guard were accidentally removed from `usePlanRunner.ts`, this test would still pass.

**Fix:** Replace the vacuous assertion with one that actually checks loop behavior:

```typescript
// Assert loop broke before reaching step2
expect(ipc.executeStep).toHaveBeenCalledTimes(1);
expect(usePlanExecutionStore.getState().stepStatuses["s2"]).toBe("pending");
```

Also fix the misleading comment on line 338 to match reality: "when isCancelling is true, the loop breaks (same as stopOnError=true)."

---

### WR-03: Duplicate Empty-State Render in StepReplyView When decoded Is Null

**File:** `src/components/plans/StepReplyView.tsx:14-17`

**Issue:** When `reply.decoded === null`, both `<ResponseDecodedView decoded={null} error={null} />` and the "No decoded content available" `<div>` render simultaneously. If `ResponseDecodedView` renders its own null/empty state (which it almost certainly does — rendering nothing or a placeholder), the user sees stacked redundant UI. If `ResponseDecodedView` throws or crashes on a null `decoded`, this component silently swallows it under the fallback div.

```tsx
// Current — both render when decoded is null
<ResponseDecodedView decoded={reply.decoded} error={null} />
{reply.decoded === null && (
  <div className="text-sm text-muted-foreground">No decoded content available.</div>
)}
```

**Fix:** Guard `ResponseDecodedView` to only render when `decoded` is non-null, and let the fallback `div` handle the null case exclusively:

```tsx
{reply.decoded !== null
  ? <ResponseDecodedView decoded={reply.decoded} error={null} />
  : <div className="text-sm text-muted-foreground">No decoded content available.</div>
}
```

---

### WR-04: isRunning Documented as "Computed Selector" but Is Stored State — Desync Risk

**File:** `src/stores/usePlanExecutionStore.ts:13-14`

**Issue:** The JSDoc comment on `isRunning` says "Computed selector: true when runningPlanId is not null." It is not a selector — it is manually managed stored state that must be explicitly set in `setRunning` (line 94), `finishRun` (line 115), and `clearRun` (via INITIAL_STATE spread, line 118). Any future action that changes `runningPlanId` without also updating `isRunning` (e.g., an emergency reset helper) will produce a desync where `runningPlanId === null` but `isRunning === true` (or vice versa).

**Fix (option A — preferred):** Remove `isRunning` from stored state and derive it at the call site:

```typescript
// In components and hooks, replace:
const { isRunning } = usePlanExecutionStore();
// With:
const isRunning = usePlanExecutionStore((s) => s.runningPlanId !== null);
```

**Fix (option B — minimal):** Correct the comment to remove the "Computed selector" language and document the three update sites that must stay in sync:

```typescript
/**
 * Mirrors runningPlanId !== null. Must be kept in sync manually in
 * setRunning, finishRun, and clearRun — not a derived selector.
 */
isRunning: boolean;
```

---

## Info

### IN-01: console.error in Catch Handlers Violates Project Logging Convention

**Files:**
- `src/components/plans/StepListPanel.tsx:259, 268, 277, 384`
- `src/components/plans/PlanDetailPanel.tsx:87`

**Issue:** Five catch handlers call `console.error` directly. The project coding-style rule prohibits console statements in production code ("No console.log statements in production code — use proper logging libraries instead"). These calls are silent from the user's perspective (no toast, no feedback) when step mutations fail, which means silent data loss from the user's view if `addStep`, `updateStep`, `duplicateStep`, or `deleteStep` throws.

**Fix:** Replace `console.error` with a user-visible `toast.error` call. Example for `StepListPanel.tsx:259`:

```typescript
} catch (err) {
  toast.error("Failed to add step — please try again");
}
```

For `PlanDetailPanel.tsx:87` (fire-and-forget `.catch(console.error)`):

```typescript
reorderSteps(planId, fromIndex, toIndex).catch((err: unknown) => {
  toast.error("Failed to reorder steps — please try again");
});
```

---

### IN-02: Full-Store Subscription Pattern Inconsistency

**Files:**
- `src/hooks/usePlanRunner.ts:20-31`
- `src/components/plans/PlanDetailPanel.tsx:36`
- `src/components/plans/StepListPanel.tsx:240`

**Issue:** Three consumers destructure the entire store with `const { ... } = usePlanExecutionStore()`, while `PlanReplyFeedTab.tsx:7` uses the correct selector pattern (`usePlanExecutionStore((s) => s.planReplyFeed)`). The selector pattern is the idiomatic Zustand approach for reactive components and is what the rest of the codebase uses. While performance impact is out of scope for this review, the inconsistency will confuse future contributors who check `PlanReplyFeedTab` as a reference.

**Fix:** Apply selector pattern consistently across all consumers:

```typescript
// Instead of:
const { activeStepId, runningPlanId, paneMode, stepReplies, planReplyFeed, stepStatuses } = usePlanExecutionStore();

// Use per-field selectors or a shallow selector:
import { useShallow } from 'zustand/react/shallow';
const { activeStepId, runningPlanId, paneMode, stepReplies, planReplyFeed, stepStatuses } =
  usePlanExecutionStore(useShallow((s) => ({
    activeStepId: s.activeStepId,
    runningPlanId: s.runningPlanId,
    paneMode: s.paneMode,
    stepReplies: s.stepReplies,
    planReplyFeed: s.planReplyFeed,
    stepStatuses: s.stepStatuses,
  })));
```

For `usePlanRunner.ts`, the hook is not a component and calls `usePlanExecutionStore()` outside of render, so the impact is lower — but the pattern should still be consistent.

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
