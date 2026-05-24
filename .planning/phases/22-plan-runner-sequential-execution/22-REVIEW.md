---
phase: 22-plan-runner-sequential-execution
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/lib/types.ts
  - src/lib/ipc.ts
  - src/stores/usePlanStore.ts
  - src-tauri/src/commands/plan_runner.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/stores/usePlanExecutionStore.ts
  - src/hooks/usePlanRunner.ts
  - src/components/plans/StepStatusBadge.tsx
  - src/stores/usePlanExecutionStore.test.ts
  - src/hooks/usePlanRunner.test.ts
  - src/components/plans/StepStatusBadge.test.tsx
  - src/components/plans/PlanRunBar.tsx
  - src/components/plans/PlanDetailPanel.tsx
  - src/components/plans/StepListPanel.tsx
  - src/components/plans/StepFieldEditor.tsx
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 22 implements sequential plan execution: a Rust `execute_step` command handles
AMQP publish + optional reply wait, and a React hook `usePlanRunner` orchestrates
the step loop. The overall structure is clean and well-reasoned. However two blockers
were found — one in the IPC field name mapping (the contract is silently broken at
runtime) and one in the cancellation flow (cancelling a run does not actually stop
remaining steps from executing). Three meaningful warnings cover resource leaks and
logic gaps. Two info items note duplicated state and a test coverage gap.

---

## Critical Issues

### CR-01: IPC field name mismatch — `stepId` arrives as `stepId` but code reads `step_id`

**File:** `src/lib/ipc.ts:181-187` and `src-tauri/src/commands/plan_runner.rs:96-104`

**Issue:** `StepResult` in Rust carries `#[serde(rename_all = "camelCase")]`, which means
`step_id` is serialized over the Tauri IPC channel as `stepId`. The TypeScript counterpart
`StepResultIpc` (ipc.ts:181-187) declares the field as `step_id`, and `executeStep`
(ipc.ts:200) reads `ipc.step_id`. Because `step_id` is never present on the deserialized
object, `ipc.step_id` is always `undefined`, and the `StepResult` returned to callers
always has `stepId: undefined`.

The comment on line 178 even asserts "Rust does NOT apply rename_all to StepResult,
so top-level fields use snake_case" — this directly contradicts the derive on
plan_runner.rs:97 (`#[serde(rename_all = "camelCase")]`).

`usePlanRunner` does not read `result.stepId` today, so there is no visible crash.
But the contract is broken: the `StepResult` type claims `stepId: string` while the
runtime value is `undefined`.

**Fix — Option A (preferred): match the existing Rust derive in TypeScript**

In `ipc.ts`, rename the field in `StepResultIpc` and remove the manual mapping:

```typescript
// ipc.ts — StepResultIpc
export interface StepResultIpc {
  stepId: string;      // camelCase — rename_all="camelCase" on Rust StepResult
  status: 'done' | 'error';
  reply: ReplyMessageIpc | null;
  error: string | null;
}

// executeStep — no snake_case mapping needed
export async function executeStep(
  profileName: string,
  step: PlanStep,
): Promise<StepResult> {
  const ipc = await invoke<StepResultIpc>('execute_step', { profileName, step });
  return {
    stepId: ipc.stepId,
    status: ipc.status,
    error: ipc.error,
    reply: ipc.reply as ReplyMessage | null,
  };
}
```

**Fix — Option B: drop `rename_all` from Rust and keep snake_case throughout**

```rust
// plan_runner.rs — drop rename_all from StepResult only
#[derive(Debug, serde::Serialize)]
pub struct StepResult {
    pub step_id: String,
    pub status: String,
    pub reply: Option<ReplyMessage>,
    pub error: Option<String>,
}
```

---

### CR-02: Cancellation does not stop remaining steps — all steps after the cancelled one still execute

**File:** `src/hooks/usePlanRunner.ts:79-85` and `src-tauri/src/commands/plan_runner.rs:114-119`

**Issue:** The cancellation flow has a logic error that makes "Stop Run" inoperative
for all steps beyond the one currently in flight.

Trace:

1. User clicks Stop → `stopRun()` sets `isCancelling = true`, then calls `cancelPlanRun()`.
2. `cancel_plan_run` (Rust, line 116): calls `state.token.cancel()`, then **sets
   `*guard = None`** (line 118), clearing the shared run state.
3. The in-flight step receives the cancellation signal and returns
   `StepResult { status: "error", error: "Cancelled" }`.
4. The hook's error branch (line 82-85) checks `isCancelling`; because it is `true`,
   the `break` is skipped. The comment says "it will exit naturally as the
   cancellation propagates."
5. The loop advances to the next step and calls `executeStep(profileName, step2)`.
6. `execute_step` (Rust, line 139-145): guard is `None` (cleared in step 2), so it
   creates a **fresh, uncancelled `CancellationToken`** and assigns it to the state.
7. Step 2, 3, … execute normally. "Stop Run" only stops the single in-flight step.

The root cause is the combination of (a) clearing the guard in `cancel_plan_run` and
(b) the frontend loop not breaking on cancellation errors.

**Fix:** The frontend loop should break on cancellation just as it does for real errors
when `stop_on_error` is true. Two complementary changes are needed:

In `usePlanRunner.ts`, add an explicit early exit when `isCancelling` is detected:

```typescript
// After the executeStep call resolves (both success and error branches)
const { isCancelling } = usePlanExecutionStore.getState();
if (isCancelling) break;   // always stop remaining steps on cancel
```

Replace the current logic block (lines 79-85 and 92-96) with:

```typescript
} else {
  setStepStatus(step.id, "error");
  const { isCancelling } = usePlanExecutionStore.getState();
  if (!isCancelling) {
    // Only toast real failures — cancelled steps are expected errors
    toast.error(`Step '${step.name}' failed: ${result.error ?? "Unknown error"}`);
  }
  if (stopOnError || isCancelling) break;
}
```

The same unconditional `if (isCancelling) break` should be added to the `catch` branch
on line 93-96.

---

## Warnings

### WR-01: AMQP connection not closed on early-return paths — resource leak

**File:** `src-tauri/src/commands/plan_runner.rs:208-215, 268, 284, 385, 397`

**Issue:** The `conn.close()` call at line 469 is only reached when execution flows
through to the end of the `match` block without hitting a `?` operator. Any `?`
propagation inside the match arms (basic_consume at lines 268/385 or basic_publish at
lines 240/284/397) causes an early return that skips `conn.close()`, leaking the AMQP
connection until the broker times it out.

Connections also opened before the match (`channel` creation at line 215) are leaked
if any earlier `?` fires.

**Fix:** Use a `defer`-equivalent pattern — hold the connection in a guard that closes
on drop, or close it in all exit paths:

```rust
// Simplest fix: close the connection before all early-return Err propagations
// by restructuring to return a named result and close unconditionally.
let result = execute_step_inner(...).await;
let _ = conn.close(0, "".into()).await;
result
```

Alternatively, wrap `conn` in a newtype that calls `conn.close()` on `Drop` (though
async drop is not natively supported in Rust — best approach is the inner-function
pattern).

---

### WR-02: NACK-with-requeue tight loop on shared reply queue (CorrelationId mode)

**File:** `src-tauri/src/commands/plan_runner.rs:337-342`

**Issue:** In CorrelationId mode, deliveries whose `correlation_id` does not match are
NACK'd with `requeue: true`. On a shared reply queue (not exclusive), the broker may
re-deliver the same non-matching message to the same consumer immediately, creating a
CPU-busy spin loop until `timeout_ms` expires. Unrelated messages that happen to arrive
during the wait will be repeatedly NACK'd for the full timeout duration, delaying their
consumption by other consumers.

```rust
// plan_runner.rs:337-342 — current
let _ = delivery
    .nack(BasicNackOptions { requeue: true, ..Default::default() })
    .await;
```

**Fix:** Use `requeue: false` for non-matching messages, or document that `reply_queue`
must be an exclusive/dedicated queue. If the intent is that non-matching messages must
be preserved for other consumers, consider using a `basic_recover` pattern or sleeping
briefly before retrying rather than immediately looping.

---

### WR-03: `sending` status never rendered for reply-mode steps

**File:** `src/hooks/usePlanRunner.ts:57-64`

**Issue:** For steps with a reply mode (not `no-wait`), the status is set to `sending`
on line 58 and then immediately overwritten with `waiting-response` on line 63 in the
same synchronous block before `executeStep` is awaited. React batches these two
`setStepStatus` calls, so a render cycle never fires between them. The `sending` state
is never displayed in the UI for any reply-mode step.

The Rust backend performs encoding and publishing before entering the wait loop, so
there is a meaningful time window when the step is "sending" and not yet "waiting for
response." Users see the amber badge jump directly from `pending` to `waiting-response`
instead of going through `sending` first.

```typescript
// usePlanRunner.ts:57-64 — current (sending immediately overwritten)
setStepStatus(step.id, "sending");
if (step.response_mode.mode !== "no-wait") {
  setStepStatus(step.id, "waiting-response");   // overwrites before render
}
const result = await executeStep(activeProfileName, step);
```

**Fix:** Remove the pre-await status override and transition to `waiting-response`
only when it is certain the message has been published (this requires execute_step to
report publish completion separately, or accept the simplified model of always showing
`sending` until the command returns). The minimum fix that preserves the correct
`sending` state is to remove the pre-await override entirely and leave the
`waiting-response` transition for when the command is actively waiting:

```typescript
setStepStatus(step.id, "sending");
const result = await executeStep(activeProfileName, step);
// Backend returns when step is complete — no intermediate transition needed
```

---

### WR-04: `isRunning` is stored state, not a derived selector — drift risk

**File:** `src/stores/usePlanExecutionStore.ts:13-14, 57, 78, 92-97`

**Issue:** The JSDoc comment on line 13 calls `isRunning` a "Computed selector: true
when runningPlanId is not null," but it is stored as explicit state that is manually
set to `true` in `setRunning` and `false` in `finishRun`. This creates two separate
sources of truth that can diverge.

Evidence of actual divergence: `PlanDetailPanel.tsx:33` derives `isRunning` directly
from `runningPlanId !== null`, bypassing the store's `isRunning` field entirely:

```typescript
// PlanDetailPanel.tsx:33
const isRunning = runningPlanId !== null;
```

Meanwhile `PlanRunBar` and `usePlanRunner` consume `usePlanExecutionStore().isRunning`.
If `finishRun()` is ever missed (e.g., an unhandled exception in startRun after
`setRunning` is called), the two derivations will disagree on whether a run is active,
potentially disabling the editor while allowing the run button to reappear.

**Fix:** Either make `isRunning` a true derived field (remove it from state, compute
from `runningPlanId !== null` everywhere), or remove the manual derivation from
`PlanDetailPanel` and have it read from the store directly:

```typescript
// Option A — remove isRunning from state, derive everywhere
const isRunning = runningPlanId !== null;

// Option B — read from store in PlanDetailPanel
const { runningPlanId, isRunning } = usePlanExecutionStore();
```

---

### WR-05: Mutex poisoning panics the Tauri process

**File:** `src-tauri/src/commands/plan_runner.rs:114, 140, 151`

**Issue:** All three `Mutex::lock().unwrap()` calls will panic if the mutex is poisoned
(i.e., if a thread panicked while holding the lock). In a Tauri 2 application the
process is the UI host — a panic here crashes the entire application window. Because
these locks are held during async operations on the same mutex (`run_state`) from
multiple Tauri command invocations, a panic in one command can poison the mutex and
cause all subsequent invocations of `execute_step` and `cancel_plan_run` to panic.

```rust
// plan_runner.rs:114 — unwrap() panics on poisoned mutex
let mut guard = run_state.lock().unwrap();
```

**Fix:** Handle the poisoned lock case explicitly:

```rust
let mut guard = run_state.lock().unwrap_or_else(|e| e.into_inner());
// or, to propagate as AppError:
let mut guard = run_state.lock()
    .map_err(|_| AppError::AmqpError("internal state lock poisoned".into()))?;
```

---

## Info

### IN-01: Test for cancellation guard (pitfall #8) does not assert the loop stops

**File:** `src/hooks/usePlanRunner.test.ts:305-331`

**Issue:** The test "when isCancelling is true, error from in-flight step does not
stop loop" only asserts that `isCancelling` is `true` after the run (line 329). It
does not assert whether step 2 was executed or not. Because CR-02 shows the loop
actually continues (rather than stopping), this test passes while the underlying
behavior is wrong. The test provides false confidence that the cancellation guard
is working as documented.

**Fix:** Add an explicit assertion on call count:

```typescript
// After startRun completes, step2 should NOT have been called
// (cancellation should stop the loop)
expect(ipc.executeStep).toHaveBeenCalledTimes(1);
```

Note: this assertion will fail until CR-02 is fixed. Write it now so it acts as a
regression gate.

---

### IN-02: Duplicate import style — `import type` split across two blocks in ipc.ts

**File:** `src/lib/ipc.ts:2, 18`

**Issue:** `ipc.ts` has two separate `import type` blocks at the top of the file: one
at line 2 importing from `"./types"` and a second at line 18 also importing from
`"./types"`. Both import different symbols from the same module. This is not a runtime
bug but violates the project's coding style and creates confusion about where type
imports live.

```typescript
// Line 2
import type { ProtoSchema, ConsumeResult, ExchangeSummary, PublishOutcome, DrainOutcome, DrainResult, PlanStep, StepResult, ReplyMessage } from "./types";

// Line 18 (should be merged with line 2)
import type { ConnectionProfile } from "./types";
```

**Fix:** Merge the two `import type` blocks into one:

```typescript
import type {
  ProtoSchema,
  ConsumeResult,
  ExchangeSummary,
  PublishOutcome,
  DrainOutcome,
  DrainResult,
  PlanStep,
  StepResult,
  ReplyMessage,
  ConnectionProfile,
} from "./types";
```

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
