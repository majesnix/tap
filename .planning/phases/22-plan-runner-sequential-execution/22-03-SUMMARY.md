---
phase: "22-plan-runner-sequential-execution"
plan: "03"
subsystem: "frontend-state-hooks-components"
tags: ["zustand", "react-hooks", "components", "plan-runner", "tdd"]
dependency_graph:
  requires:
    - "22-01 (StepStatus, StepResult, executeStep, cancelPlanRun)"
  provides:
    - "usePlanExecutionStore — ephemeral Zustand run state (D-14)"
    - "usePlanRunner — sequential runner hook (D-15)"
    - "StepStatusBadge — step status badge component (RUN-03)"
  affects:
    - "src/stores/usePlanExecutionStore.ts"
    - "src/hooks/usePlanRunner.ts"
    - "src/components/plans/StepStatusBadge.tsx"
tech_stack:
  added: []
  patterns:
    - "Ephemeral Zustand store (no persist middleware) — same shape as useResponseStore"
    - "isCancelling guard reads from store.getState() inside loop (not closure) — prevents stale flag"
    - "finishRun keeps stepStatuses+summary visible; clearRun called by setRunning at next run start"
    - "Badge lookup map (Record<StepStatus, BadgeConfig>) instead of switch statement"
key_files:
  created:
    - "src/stores/usePlanExecutionStore.ts"
    - "src/hooks/usePlanRunner.ts"
    - "src/components/plans/StepStatusBadge.tsx"
    - "src/stores/usePlanExecutionStore.test.ts"
    - "src/hooks/usePlanRunner.test.ts"
    - "src/components/plans/StepStatusBadge.test.tsx"
  modified: []
decisions:
  - "D-14: usePlanExecutionStore holds ephemeral run state — not persisted, cleared on restart"
  - "D-15: usePlanRunner sequential for...of loop, no concurrency"
  - "isCancelling read from store.getState() inside error branch (not closure) to avoid pitfall #8 stale value"
  - "finishRun vs clearRun: finishRun() called at loop end to preserve badges; clearRun() called only by setRunning at next run start"
  - "stop_on_error ?? true: D-07 default applied in usePlanRunner startRun"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
---

# Phase 22 Plan 03: Execution Store, Runner Hook, and StepStatusBadge

**One-liner:** Ephemeral Zustand execution store, sequential plan runner hook with cancellation guard and stop_on_error, and StepStatusBadge component with per-status tint classes and Loader2 spinner.

## What Was Built

### Task 1: usePlanExecutionStore — ephemeral run state

- `src/stores/usePlanExecutionStore.ts`: Zustand store, NOT persisted (no persist middleware). Ephemeral — clears on app restart. (D-14, RUN-01)
- State shape: `runningPlanId`, `stepStatuses: Record<string, StepStatus>`, `activeStepId`, `isCancelling`, `summary`, `isRunning` (computed).
- 7 actions: `setRunning`, `setStepStatus`, `setActiveStep`, `setIsCancelling`, `setSummary`, `finishRun`, `clearRun`.
- `setRunning(planId, stepIds)` initializes ALL steps to `'pending'` via `Object.fromEntries` so Pending badges appear immediately when run begins (D-14, RUN-03, SC#1).
- `finishRun()` clears `runningPlanId` and `activeStepId` but intentionally keeps `stepStatuses` and `summary` intact for post-run UI display (D-11).
- `clearRun()` resets everything to initial state — called by `setRunning` at the start of the next run.
- `setStepStatus` uses spread operator for immutable update (`{ ...state.stepStatuses, [stepId]: status }`).
- 31 tests covering all actions, initial state, immutability, and computed selector.

### Task 2: usePlanRunner hook + StepStatusBadge component

- `src/hooks/usePlanRunner.ts`: Sequential runner hook with `startRun(plan)`, `stopRun()`, `isRunning`.
- `startRun` calls `setRunning(plan.id, plan.steps.map(s => s.id))` first — all steps initialized to `'pending'` before any execution.
- Sequential `for...of` loop: `setStepStatus('sending')` → `setStepStatus('waiting-response')` for reply modes → `await executeStep()` → `setStepStatus('done'/'error')`.
- `stop_on_error ?? true` default applied per D-07.
- **isCancelling guard (pitfall #8)**: error branch reads `isCancelling` fresh via `usePlanExecutionStore.getState()` (not a closure value) — prevents stale flag from the time the error arrives after a cancellation.
- `stopRun()` sets `isCancelling=true` BEFORE calling `cancelPlanRun()` (T-22-09 race mitigation).
- `finishRun()` called after `setSummary()` — keeps badges and summary visible post-run.
- `src/components/plans/StepStatusBadge.tsx`: Lookup map (Record<StepStatus, BadgeConfig>) for clean rendering. All 5 statuses with exact UI-SPEC classNames.
  - `pending`: neutral, no tint override
  - `sending`: `bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20`
  - `waiting-response`: same amber tint + Loader2 spinner (size=14, `animate-spin mr-1`)
  - `done`: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20`
  - `error`: `bg-destructive/10 text-destructive border-destructive/20`
- 28 tests for badge rendering + runner behavior.

## Verification

All plan success criteria met:

- `npx tsc --noEmit` passes with 0 errors
- `grep -n "persist" src/stores/usePlanExecutionStore.ts` → 0 results (only in comment)
- All 7 actions defined in store (setRunning, setStepStatus, setActiveStep, setIsCancelling, setSummary, finishRun, clearRun)
- `setRunning` initializes all steps to `'pending'` via `Object.fromEntries`
- `isRunning` computed selector derived from `runningPlanId !== null`
- `usePlanRunner.ts` exports `startRun`, `stopRun`, `isRunning`
- `StepStatusBadge.tsx` renders correct variant + className for all 5 statuses per UI-SPEC
- `Loader2` spinner present for `waiting-response` status
- `finishRun()` called after `setSummary()` in hook
- `plan.steps.map` confirms stepIds passed to `setRunning`
- `isCancelling` read from `store.getState()` in error branch (not closure)
- `stop_on_error ?? true` default applied
- All three tint class patterns present: `bg-amber-500/10`, `bg-emerald-500/10`, `bg-destructive/10`
- 59 total tests pass across all 3 test files

## Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| 1 - RED  | test  | 753f0bf | test(22-03): add failing tests for usePlanExecutionStore |
| 1 - GREEN | feat | 576aca6 | feat(22-03): implement usePlanExecutionStore |
| 2 - RED  | test  | 3918966 | test(22-03): add failing tests for usePlanRunner + StepStatusBadge |
| 2 - GREEN | feat | 80649ca | feat(22-03): implement usePlanRunner hook and StepStatusBadge component |

## TDD Gate Compliance

- [x] RED gate: `test(22-03)` commit exists before any `feat(22-03)` commit (Task 1)
- [x] RED gate: `test(22-03)` commit exists before `feat(22-03)` commit (Task 2)
- [x] GREEN gate: `feat(22-03)` commit follows RED commit for both tasks
- No REFACTOR gate needed — code is clean on first pass

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Test Infrastructure Note

Vitest runs from the main repo (`/Users/majesnix/gits/proto-sender`) against test files in the worktree. The worktree has its own `vite.config.ts` with correct `__dirname`-based `@` alias. Tests for `usePlanRunner.test.ts` require running with `--config .claude/worktrees/agent-acc7adc4d261ef154/vite.config.ts` to resolve `@/` imports correctly against the worktree's src directory.

Test fix applied: switched from `vi.clearAllMocks()` to `vi.resetAllMocks()` in `usePlanRunner.test.ts` to properly reset `mockResolvedValueOnce` queues between tests. The `useConnectionStore` mock was changed from a `vi.fn()` with selector to a plain factory function (not a vi.fn) so `vi.resetAllMocks()` doesn't clear its selector behavior.

## Known Stubs

None. All functionality is fully implemented with real Zustand state and IPC calls.

## Threat Flags

No new security-relevant surface introduced beyond what was planned. This plan adds frontend state management only — no new network endpoints, auth paths, or file access patterns.

T-22-07 (loop bounded by plan.steps.length) — mitigated: `for...of` loop is naturally bounded.
T-22-09 (isCancelling flag race) — mitigated: `setIsCancelling(true)` called synchronously before `await cancelPlanRun()`.

## Self-Check: PASSED

- [x] `src/stores/usePlanExecutionStore.ts` exists — contains all 7 actions
- [x] `src/hooks/usePlanRunner.ts` exists — exports startRun, stopRun, isRunning
- [x] `src/components/plans/StepStatusBadge.tsx` exists — all 5 statuses implemented
- [x] Commit 753f0bf exists: test(22-03) RED for usePlanExecutionStore
- [x] Commit 576aca6 exists: feat(22-03) GREEN for usePlanExecutionStore
- [x] Commit 3918966 exists: test(22-03) RED for usePlanRunner + StepStatusBadge
- [x] Commit 80649ca exists: feat(22-03) GREEN for usePlanRunner + StepStatusBadge
- [x] TypeScript compiles with 0 errors
- [x] 59 tests pass across 3 test files
