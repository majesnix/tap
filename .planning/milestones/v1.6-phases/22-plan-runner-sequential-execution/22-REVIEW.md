---
phase: 22-plan-runner-sequential-execution
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/plan_runner.rs
  - src-tauri/src/lib.rs
  - src/components/plans/PlanDetailPanel.tsx
  - src/components/plans/PlanRunBar.tsx
  - src/components/plans/StepFieldEditor.tsx
  - src/components/plans/StepListPanel.tsx
  - src/components/plans/StepStatusBadge.test.tsx
  - src/components/plans/StepStatusBadge.tsx
  - src/hooks/usePlanRunner.test.ts
  - src/hooks/usePlanRunner.ts
  - src/lib/ipc.ts
  - src/lib/types.ts
  - src/stores/usePlanExecutionStore.test.ts
  - src/stores/usePlanExecutionStore.ts
  - src/stores/usePlanStore.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 22: Code Review Report (post gap-closure)

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 17
**Note:** This review reflects the post-gap-closure state after CR-01 (stepId field) and CR-02 (cancel break condition) were fixed in plan 22-05.

## Summary

Phase 22 implements sequential plan execution: a Rust `execute_step` command that encodes a protobuf message, opens an AMQP connection, publishes, and optionally waits for a reply; a `usePlanRunner` hook that iterates steps and drives a Zustand execution store; and UI components (PlanRunBar, StepListPanel, StepFieldEditor, StepStatusBadge). The IPC field name and cancellation break condition gaps from the initial implementation are now resolved. Four residual issues remain: one critical and three warnings.

---

## Critical Issues

### CR-01: NoWait `delay_ms` sleep is not cancellation-aware — Stop Run ignored during sleep

**File:** `src-tauri/src/commands/plan_runner.rs` — `ResponseMode::NoWait` branch

**Issue:** The `NoWait` branch issues `tokio::time::sleep(Duration::from_millis(delay)).await` without wrapping it in a `tokio::select!` that watches the `CancellationToken`. The `CorrelationId` and `FirstArrival` branches both use `select! { biased; _ = token.cancelled() => ... }` correctly. In `NoWait`, if `delay_ms` is large (e.g., 30000 ms), pressing "Stop Run" has no effect until the sleep elapses — the step then returns `status: "done"`, the summary counts it as success, and only the next step sees cancellation.

**Fix:**
```rust
ResponseMode::NoWait { delay_ms } => {
    let delay = *delay_ms;
    channel.basic_publish(/* ... */).await?;
    tokio::select! {
        biased;
        _ = token.cancelled() => {}
        _ = tokio::time::sleep(Duration::from_millis(delay)) => {}
    }
    StepResult { step_id: step.id.clone(), status: "done".into(), reply: None, error: None }
}
```
Returning `"done"` on cancel-during-sleep is correct: the message was already sent; the delay is only a pacing mechanism.

---

## Warnings

### WR-01: `isCancelling` test asserts trivially-true state — wrong behavior tested

**File:** `src/hooks/usePlanRunner.test.ts` — test "when isCancelling is true, error from in-flight step does not stop loop"

**Issue:** The condition is now `if (stopOnError || isCancelling) break`. With `stop_on_error: true` AND `isCancelling: true`, the loop **does** break — step2 is never called. The test checks only `isCancelling === true` (trivially true because the mock set it) and its comment says "the loop does NOT break when isCancelling=true" — which is false. The test passes for the wrong reason and provides no regression protection.

**Fix:** Set `stop_on_error: false` so only the `isCancelling` branch controls the break, then assert step2 was *not* called (break still fires on `isCancelling`):
```typescript
// With stop_on_error=false and isCancelling set during s1, break fires on isCancelling
expect(ipc.executeStep).toHaveBeenCalledTimes(1); // only s1
expect(usePlanExecutionStore.getState().stepStatuses['s2']).toBe('pending');
```

### WR-02: `isRunning` is stored state, not derived — drift risk

**File:** `src/stores/usePlanExecutionStore.ts`

**Issue:** The interface comment says "Computed selector: true when runningPlanId is not null", but `isRunning` is a plain `boolean` field toggled by `setRunning`, `finishRun`, and `clearRun`. Any future code path that sets `runningPlanId` directly without updating `isRunning` will silently desync the two fields. Currently not broken — all mutation points update both — but the misleading comment creates a maintenance trap.

**Fix:** Either update the comment to accurately say "manually kept in sync with runningPlanId by setRunning/finishRun/clearRun", or derive `isRunning` as a Zustand computed selector: `isRunning: () => get().runningPlanId !== null`.

### WR-03: `sending` status never rendered for reply-mode steps

**File:** `src/hooks/usePlanRunner.ts:57-63`

**Issue:** For non-`no-wait` steps, `setStepStatus(step.id, "sending")` and `setStepStatus(step.id, "waiting-response")` are both called synchronously before the first `await`. React batches these into one render — `sending` is never observable in the UI. The comment says "transition to 'waiting-response' immediately before the await" but there is no await between the two calls. Since both states share the same amber CSS class (per UI-SPEC comment), the visual impact is nil, but the code is misleading.

**Fix:** Skip the `sending` state for reply-mode steps:
```typescript
if (step.response_mode.mode === "no-wait") {
  setStepStatus(step.id, "sending");
} else {
  setStepStatus(step.id, "waiting-response");
}
```

---

## Security

No security issues found. The execution model uses Tauri IPC (not raw network), protobuf encoding is validated by `prost-reflect`, and no user input reaches shell commands or file paths outside the managed profile store.

---

_Reviewed: 2026-05-24_
_Reviewer: gsd-code-reviewer (Claude)_
_Depth: standard_
