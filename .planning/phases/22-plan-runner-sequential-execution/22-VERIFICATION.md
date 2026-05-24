---
phase: 22-plan-runner-sequential-execution
verified: 2026-05-24T12:00:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "D-02/D-03: StepResult.stepId is populated with the correct step identifier at runtime"
    status: failed
    reason: "ipc.ts declares StepResultIpc.step_id but Rust serializes the field as stepId (rename_all=camelCase on StepResult). ipc.step_id is always undefined at runtime; callers receive stepId: undefined."
    artifacts:
      - path: "src/lib/ipc.ts"
        issue: "Line 182: field declared as step_id; line 202: reads ipc.step_id — both wrong. The comment at line 178 asserts Rust does NOT apply rename_all, contradicting plan_runner.rs:97."
      - path: "src-tauri/src/commands/plan_runner.rs"
        issue: "Line 97: #[serde(rename_all = \"camelCase\")] on StepResult — step_id serializes as stepId over IPC, not step_id."
    missing:
      - "In ipc.ts: rename StepResultIpc.step_id → stepId and update ipc.step_id reference on line 202 to ipc.stepId"
      - "Remove incorrect comment at line 178 that contradicts the Rust derive"

  - truth: "SC #5 / RUN-02: Clicking Stop cancels the entire run — all remaining steps are skipped, not just the in-flight step"
    status: failed
    reason: "usePlanRunner.ts:83 gates the break on (stopOnError && !isCancelling). When isCancelling=true the second clause is false, so break is never executed. Combined with cancel_plan_run clearing the guard (plan_runner.rs:118, *guard = None), subsequent executeStep calls create fresh uncancelled CancellationTokens and execute normally."
    artifacts:
      - path: "src/hooks/usePlanRunner.ts"
        issue: "Lines 82-85: break only fires when (stopOnError && !isCancelling). When user cancels (isCancelling=true), !isCancelling=false and break is skipped. Same inverted logic at lines 93-96 in the catch branch. The comment at line 79-81 incorrectly states the loop will exit naturally."
      - path: "src-tauri/src/commands/plan_runner.rs"
        issue: "Lines 114-118: cancel_plan_run sets *guard = None after calling token.cancel(). Next execute_step call (line 139) finds guard as None and creates a fresh, uncancelled CancellationToken — cancellation is not sticky."
    missing:
      - "In usePlanRunner.ts error branch (after line 84): replace condition with (stopOnError || isCancelling) so break fires on either case"
      - "In usePlanRunner.ts catch branch (after line 94): same fix — (stopOnError || isCancelling)"
      - "Optionally: add an unconditional isCancelling check immediately after the await (before the if-else) to catch the success-path cancellation edge case"
---

# Phase 22: Plan Runner — Sequential Execution Verification Report

**Phase Goal:** Implement sequential plan execution — users can run a plan end-to-end, see step statuses update live, and cancel mid-run
**Verified:** 2026-05-24T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                          | Status     | Evidence                                                                                      |
|----|--------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | SC #1: Users can see step statuses update live during a run                    | PARTIAL    | Badges render and store wiring is correct. WR-03: 'sending' badge skipped for reply-mode steps (React batches two synchronous setStepStatus calls before await). Functional but degraded. |
| 2  | SC #2: Run button triggers sequential step execution                           | VERIFIED   | PlanRunBar → usePlanRunner.startRun() → for-loop over plan.steps → executeStep() per step. All wiring confirmed. |
| 3  | SC #3: StepStatusBadge displays correct status for each step state             | VERIFIED   | StepStatusBadge.tsx renders all six states (pending/sending/waiting-response/done/error/cancelled). StepListPanel mounts one per row. |
| 4  | SC #4: Forms are disabled (read-only) while a run is active                   | VERIFIED   | PlanDetailPanel passes disabled={isRunning} to StepFieldEditor; StepFieldEditor wraps all inputs in fieldset disabled={disabled}. |
| 5  | SC #5: Clicking Stop cancels the entire run — all remaining steps are skipped | FAILED     | CR-02 BLOCKER: break logic inverted. isCancelling=true causes break to be skipped. Steps 2..N execute normally after Stop is clicked. |
| 6  | SC #6: D-02/D-03 IPC contract — StepResult.stepId populated from Rust         | FAILED     | CR-01 BLOCKER: Rust serializes step_id as stepId (rename_all=camelCase). ipc.ts reads ipc.step_id which is always undefined at runtime. |

**Score:** 4/6 truths verified (2 FAILED — both BLOCKERs)

---

### Required Artifacts

| Artifact                                              | Expected                                | Status     | Details                                                          |
|-------------------------------------------------------|-----------------------------------------|------------|------------------------------------------------------------------|
| `src/lib/types.ts`                                    | Plan type with stop_on_error, StepResult, ReplyMessage | VERIFIED | Plan.stop_on_error? boolean at line 231; StepResult.stepId at lines 259-266; ReplyMessage at lines 244-252. |
| `src/lib/ipc.ts`                                      | StepResultIpc, executeStep, cancelPlanRun | STUB     | Exists and exported. StepResultIpc.step_id is wrong field name — Rust sends stepId. ipc.step_id always undefined. Behavioral stub despite structural presence. |
| `src-tauri/src/commands/plan_runner.rs`               | execute_step, cancel_plan_run, PlanRunState | VERIFIED | All three response modes implemented. PlanRunState with CancellationToken. cancel_plan_run clears guard after cancel (CR-02 root cause). |
| `src/stores/usePlanExecutionStore.ts`                 | 7 actions, ephemeral store               | VERIFIED   | All 7 actions present (setRunning, setStepStatus, setActiveStep, setIsCancelling, setSummary, finishRun, clearRun). No persist middleware. |
| `src/hooks/usePlanRunner.ts`                          | startRun loop, stopRun, re-run           | STUB       | Exists and wired. CR-02 BLOCKER: break condition inverted — cancellation does not stop loop. Structural presence but behavioral contract broken. |
| `src/components/plans/StepStatusBadge.tsx`            | Badge for 6 step states                  | VERIFIED   | All 6 states render correctly. Used in StepListPanel per row. |
| `src/components/plans/PlanRunBar.tsx`                 | Run/Stop/Re-run slot, stop_on_error toggle, summary | VERIFIED | All three states present. Summary formatting confirmed. |
| `src/components/plans/PlanDetailPanel.tsx`            | PlanRunBar mounted, StepFieldEditor disabled during run | VERIFIED | flex-col layout, PlanRunBar above split. disabled={isRunning} passed through. |
| `src/components/plans/StepListPanel.tsx`              | StepStatusBadge per row, active scroll   | VERIFIED   | Badge per row. scrollIntoView on isActiveStep. bg-accent highlight. |
| `src/components/plans/StepFieldEditor.tsx`            | disabled prop cascades to all inputs     | VERIFIED   | fieldset disabled={disabled} — cascades to all child inputs per HTML spec. |
| `src/stores/usePlanStore.ts`                          | updatePlan with optimistic rollback      | VERIFIED   | Lines 122-137: optimistic update + rollback on error. isPlan() guard does not check stop_on_error (backward compat). |

---

### Key Link Verification

| From                      | To                                | Via                                    | Status       | Details                                                                      |
|---------------------------|-----------------------------------|----------------------------------------|--------------|------------------------------------------------------------------------------|
| `PlanRunBar`              | `usePlanRunner`                   | `startRun()` / `stopRun()` callbacks   | VERIFIED     | PlanRunBar imports and calls hook actions directly.                          |
| `usePlanRunner`           | `executeStep` (ipc.ts)            | `await executeStep(profileName, step)` | VERIFIED     | Import confirmed. Called per step in for-loop.                               |
| `executeStep`             | `execute_step` Tauri command      | `invoke('execute_step', {...})`        | VERIFIED     | ipc.ts:200. Tauri command registered in lib.rs.                             |
| `StepResultIpc.step_id`   | `StepResult.step_id` (Rust)       | serde rename_all="camelCase"           | BROKEN       | CR-01: Rust serializes as stepId; TS reads step_id. Field always undefined. |
| `cancelPlanRun`           | `cancel_plan_run` Tauri command   | `invoke('cancel_plan_run')`            | VERIFIED     | ipc.ts:213. Command registered.                                             |
| `usePlanRunner` break     | stops loop on cancel              | `if (isCancelling) break`              | BROKEN       | CR-02: Condition is `stopOnError && !isCancelling` — inverted for cancel case. |
| `PlanDetailPanel`         | `StepFieldEditor disabled`        | `disabled={isRunning}` prop            | VERIFIED     | Wiring confirmed through component tree.                                    |
| `usePlanExecutionStore`   | `PlanRunBar` / `StepListPanel`    | Zustand selectors                      | VERIFIED     | Both consume store state. No persist middleware (ephemeral as required).    |

---

### Data-Flow Trace (Level 4)

| Artifact                  | Data Variable      | Source                                | Produces Real Data | Status       |
|---------------------------|--------------------|---------------------------------------|---------------------|--------------|
| `StepStatusBadge`         | `status` prop      | `usePlanExecutionStore.stepStatuses`  | Yes — set by usePlanRunner on each step | FLOWING |
| `PlanRunBar` summary      | `summary`          | `usePlanExecutionStore.summary`       | Yes — set by setSummary(succeeded, total) at run end | FLOWING |
| `executeStep` → `stepId`  | `result.stepId`    | `ipc.step_id` (StepResultIpc)         | No — always undefined (CR-01) | DISCONNECTED |
| `usePlanRunner` cancel    | `isCancelling`     | `usePlanExecutionStore.isCancelling`  | Yes — set by stopRun(). Read correctly. Break condition wrong (CR-02) | HOLLOW_PROP |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — Tauri desktop app requires running native process. Behavioral correctness verified by static code analysis (grep/read) instead. CR-01 and CR-02 confirmed through direct code path tracing without running the app.

---

### Probe Execution

Step 7c: No probe scripts found for this phase.

```
find /Users/majesnix/gits/proto-sender/scripts -name 'probe-*.sh' 2>/dev/null
(no output)
```

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                    | Status    | Evidence                                                                 |
|-------------|-------------|----------------------------------------------------------------|-----------|--------------------------------------------------------------------------|
| RUN-01      | 22-03-PLAN  | usePlanExecutionStore with 7 required actions                  | SATISFIED | All 7 actions in usePlanExecutionStore.ts. Ephemeral (no persist).      |
| RUN-02      | 22-03-PLAN  | Run can be cancelled mid-flight; remaining steps skip          | BLOCKED   | CR-02: break condition inverted — remaining steps execute after cancel. |
| RUN-03      | 22-03-PLAN  | Step statuses update live in the UI during execution           | SATISFIED | setStepStatus() called before and after executeStep. Store → StepStatusBadge wired. WR-03 degrades 'sending' display but does not block the requirement. |
| RUN-04      | 22-04-PLAN  | PlanRunBar shows Run/Stop/Re-run per run state                 | SATISFIED | Three-state slot confirmed in PlanRunBar.tsx.                           |
| RUN-05      | 22-04-PLAN  | Inputs disabled while run is active                            | SATISFIED | fieldset disabled={disabled} in StepFieldEditor; disabled={isRunning} passed from PlanDetailPanel. |
| RUN-06      | 22-04-PLAN  | stop_on_error toggle available in PlanRunBar                   | SATISFIED | Toggle confirmed. updatePlan() with optimistic rollback wired.          |
| RESP-01     | 22-02-PLAN  | execute_step supports NoWait response mode                     | SATISFIED | NoWait arm in plan_runner.rs — publish + configurable delay. Correct.  |
| RESP-02     | 22-02-PLAN  | execute_step supports CorrelationId response mode              | SATISFIED | CorrelationId arm: basic_consume before basic_publish, correlation_id matched from delivery.properties. |
| RESP-03     | 22-02-PLAN  | execute_step supports FirstArrival response mode               | SATISFIED | FirstArrival arm: accepts first delivery regardless of correlation_id.  |

**7/9 requirements satisfied. 1 BLOCKED (RUN-02). 1 effectively satisfied structurally but contract broken at runtime (RUN-02 is the blocker; the IPC mismatch of CR-01 is the second blocker mapped to the D-02/D-03 must-have, not a named requirement row).**

---

### Anti-Patterns Found

| File                                             | Line     | Pattern                                                  | Severity | Impact                                                                       |
|--------------------------------------------------|----------|----------------------------------------------------------|----------|------------------------------------------------------------------------------|
| `src/lib/ipc.ts`                                 | 178-179  | Incorrect comment: "Rust does NOT apply rename_all"       | BLOCKER  | CR-01 root: misleading documentation actively contradicts Rust derive. Developer trusting the comment maintains the wrong field name. |
| `src/lib/ipc.ts`                                 | 182      | `step_id: string` — wrong field name for camelCase IPC   | BLOCKER  | CR-01: Rust sends stepId; TS reads step_id. Always undefined.               |
| `src/lib/ipc.ts`                                 | 202      | `ipc.step_id` — reads field that is always undefined     | BLOCKER  | CR-01: stepId in returned StepResult is always undefined.                   |
| `src/hooks/usePlanRunner.ts`                     | 83       | `if (stopOnError && !isCancelling) break` — inverted     | BLOCKER  | CR-02: When isCancelling=true, break never fires. Remaining steps execute. |
| `src/hooks/usePlanRunner.ts`                     | 94       | Same inverted condition in catch branch                  | BLOCKER  | CR-02: Same defect applies to unexpected throw paths.                       |
| `src/hooks/usePlanRunner.ts`                     | 58-63    | `setStepStatus(id, 'sending')` immediately overwritten   | WARNING  | WR-03: React 18 batches the two synchronous calls — 'sending' never rendered for reply-mode steps. |
| `src/stores/usePlanExecutionStore.ts`            | 13-14    | JSDoc says "computed selector" but isRunning is stored state | WARNING | WR-04: PlanDetailPanel derives isRunning separately (runningPlanId !== null) — two sources of truth that can diverge. |
| `src-tauri/src/commands/plan_runner.rs`          | 114,140,151 | `.lock().unwrap()` — panics on poisoned mutex         | WARNING  | WR-05: Mutex poison crashes the entire Tauri process (UI host).             |
| `src-tauri/src/commands/plan_runner.rs`          | 468      | `conn.close()` only on normal exit — skipped on `?`      | WARNING  | WR-01: AMQP connection leaked on any early-return error path.               |
| `src-tauri/src/commands/plan_runner.rs`          | 337-342  | `nack(requeue: true)` on non-matching CorrelationId messages | WARNING | WR-02: Tight re-delivery loop on shared reply queues until timeout expires. |
| `src/hooks/usePlanRunner.test.ts`               | 305-331  | Test asserts isCancelling=true but not call count        | INFO     | IN-01: Test provides false confidence — passes even when CR-02 bug is present. |
| `src/lib/ipc.ts`                                | 2, 18    | Duplicate `import type` blocks from same module          | INFO     | IN-02: Style violation, not a runtime bug.                                  |

---

### Human Verification Required

None. Both blockers (CR-01, CR-02) are fully verifiable by static code analysis. No human interaction required for the gap determination.

---

### Gaps Summary

**Two blockers prevent the phase goal from being achieved.**

**CR-01 — IPC contract broken (ipc.ts + plan_runner.rs)**

`StepResult` in Rust carries `#[serde(rename_all = "camelCase")]` at line 97 of `plan_runner.rs`. This serializes the `step_id` field as `stepId` over the Tauri IPC channel. The TypeScript counterpart `StepResultIpc` in `ipc.ts` declares the field as `step_id` (line 182), and `executeStep` reads `ipc.step_id` (line 202). Because `step_id` is never present on the deserialized object, `ipc.step_id` evaluates to `undefined` at runtime. Every `StepResult` returned to callers has `stepId: undefined`.

The comment at `ipc.ts:178` actively reinforces the bug: it asserts "Rust does NOT apply rename_all to StepResult, so top-level fields use snake_case" — a direct contradiction of the Rust derive. The fix is one-line: rename `step_id` to `stepId` in `StepResultIpc` and update the read on line 202.

**CR-02 — Cancellation loop logic inverted (usePlanRunner.ts)**

The break that should stop the step loop on cancellation is gated on `stopOnError && !isCancelling` (lines 83 and 94). When the user clicks Stop, `isCancelling` is set to `true`, making `!isCancelling` false — so the break is never executed. The loop advances to the next step, calls `executeStep` again, and `cancel_plan_run` has already cleared the Rust guard (`*guard = None` at plan_runner.rs:118), so a fresh uncancelled `CancellationToken` is created. Steps 2..N execute normally as if Stop was never clicked.

The fix requires changing the condition from `stopOnError && !isCancelling` to `stopOnError || isCancelling` in both branches (error result and catch), which makes the loop break on either a stop-on-error failure or a user cancellation.

These two blockers are independent. CR-01 affects `StepResult.stepId` identity (not used in the loop today, but the IPC contract is broken). CR-02 makes the "cancel mid-run" goal statement false — the phase goal explicitly requires cancel mid-run to work.

---

_Verified: 2026-05-24T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
