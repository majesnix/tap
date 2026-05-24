---
phase: "22-plan-runner-sequential-execution"
plan: "04"
subsystem: "frontend-ui-components"
tags: ["react", "zustand", "plan-runner", "ui", "plandDetailPanel"]
dependency_graph:
  requires:
    - "22-02 (execute_step, cancel_plan_run Rust backend)"
    - "22-03 (usePlanExecutionStore, usePlanRunner, StepStatusBadge)"
  provides:
    - "PlanRunBar — Run/Stop/Re-run controls + stop_on_error toggle + run summary"
    - "PlanDetailPanel — PlanRunBar above split; effectiveSelectedStepId sync"
    - "StepListPanel — StepStatusBadge per row + active step highlight + scrollIntoView"
    - "StepFieldEditor — disabled prop cascaded via fieldset[disabled] during run"
  affects:
    - "src/components/plans/PlanRunBar.tsx"
    - "src/components/plans/PlanDetailPanel.tsx"
    - "src/components/plans/StepListPanel.tsx"
    - "src/components/plans/StepFieldEditor.tsx"
tech_stack:
  added: []
  patterns:
    - "fieldset[disabled] className=contents — cascades disabled to all descendant form controls without prop drilling"
    - "effectiveSelectedStepId — activeStepId override during run (D-10)"
    - "Hook calls hoisted before early return in PlanDetailPanel to comply with React rules of hooks"
    - "Tooltip wrapping <span> around disabled Button (shadcn Tooltip + disabled button pattern)"
key_files:
  created:
    - "src/components/plans/PlanRunBar.tsx"
  modified:
    - "src/components/plans/PlanDetailPanel.tsx"
    - "src/components/plans/StepListPanel.tsx"
    - "src/components/plans/StepFieldEditor.tsx"
decisions:
  - "D-12: PlanRunBar mounted above step list + editor split in PlanDetailPanel using flex-col wrapper"
  - "D-10: effectiveSelectedStepId = activeStepId during run; selectedStepId after run — editor auto-switches to active step"
  - "D-09: fieldset[disabled] approach for StepFieldEditor — cascades to all form controls without prop drilling into frozen field components"
  - "D-14/D-11: Re-run calls startRun(plan) which calls setRunning() internally — resets all statuses to pending and clears prior summary"
  - "React hooks order: usePlanExecutionStore() hoisted before the !selectedPlan early return in PlanDetailPanel"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 22 Plan 04: Plan Runner UI Assembly

**One-liner:** PlanRunBar with Run/Stop/Re-run controls and stop_on_error toggle wired to usePlanRunner; StepListPanel rows augmented with StepStatusBadge and active-step highlight; StepFieldEditor inputs disabled via fieldset[disabled] during run; PlanDetailPanel assembles all pieces with effectiveSelectedStepId auto-switch.

## What Was Built

### Task 1: PlanRunBar component

- `src/components/plans/PlanRunBar.tsx` (NEW): Full-width sticky header bar above the step list/editor split.
- Three run button states:
  - Idle: `Button variant="default"` + Play icon + "Run Plan" — `onClick: startRun(plan)`
  - Running: `Button variant="destructive"` + Square icon + "Stop Run" — `onClick: stopRun()`
  - Post-run: summary line + "Re-run Plan" `Button variant="outline"` — `onClick: startRun(plan)` (resets via setRunning internally per D-14)
- Disabled Run button wrapped in `<TooltipProvider><Tooltip><TooltipTrigger asChild><span>` pattern (shadcn disabled button tooltip compatibility)
- Disable conditions: no steps → "Add at least one step to run this plan"; no active profile → "Connect to a profile first"
- `stop_on_error` Switch with Label, `disabled={isRunning}`, `onCheckedChange` persists via `updatePlan`
- Summary line: `text-emerald-700 dark:text-emerald-400` for success (succeeded === total), `text-destructive` for failure
- Container: `flex items-center gap-4 bg-card border-b border-border px-4 py-2 shrink-0` per UI-SPEC

### Task 2: PlanDetailPanel + StepListPanel + StepFieldEditor wiring

**PlanDetailPanel** (`src/components/plans/PlanDetailPanel.tsx`):
- Import `PlanRunBar` and `usePlanExecutionStore`
- `usePlanExecutionStore()` hoisted before `!selectedPlan` early return (React rules of hooks compliance)
- Outer wrapper changed from `flex flex-1 min-h-0 min-w-0` to `flex flex-1 flex-col min-h-0 min-w-0`
- `PlanRunBar` rendered above the inner horizontal split div
- `effectiveSelectedStepId = isRunning && activeStepId !== null ? activeStepId : selectedStepId` (D-10)
- `selectedStep` derived from `effectiveSelectedStepId` (editor shows active step during run)
- `StepFieldEditor` receives `disabled={isRunning}` (D-09)
- `StepListPanel` receives `effectiveSelectedStepId` as `selectedStepId` (active step highlighted)

**StepListPanel** (`src/components/plans/StepListPanel.tsx`):
- Import `StepStatusBadge` from `./StepStatusBadge` and `usePlanExecutionStore`
- Import `StepStatus` from `@/lib/types`
- Read `{ stepStatuses, activeStepId }` from `usePlanExecutionStore()` in panel body
- `SortableStepRowProps` extended with `stepStatus: StepStatus | undefined` and `isActiveStep: boolean`
- `SortableStepRow`: `rowRef` + combined ref (merges `setSortableRef` + `rowRef`) for `scrollIntoView`
- `useEffect([isActiveStep])`: `rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })` (D-10)
- Active step highlight: `isSelected || isActiveStep` → `bg-accent text-accent-foreground`
- `{stepStatus !== undefined && <StepStatusBadge status={stepStatus} />}` placed between step name and context menu (right-aligned)

**StepFieldEditor** (`src/components/plans/StepFieldEditor.tsx`):
- `disabled?: boolean` added to `StepFieldEditorProps` and `StepFieldEditorInnerProps`
- `disabled` threaded from `StepFieldEditor` → `StepFieldEditorInner`
- `<fieldset disabled={disabled} className="contents">` wraps `<FormProvider>`, `<form>`, `<TargetSection>`, `<ResponseModeSection>` — HTML fieldset disabled cascades to all descendant form controls without prop drilling into frozen field components (`ScalarField`, `EnumField`, etc.)

## Verification

All plan success criteria met:

- `npx tsc --noEmit` passes with 0 errors after both tasks
- `grep -n "PlanRunBar" src/components/plans/PlanDetailPanel.tsx` → import + usage in return JSX
- `grep -n "flex-col" src/components/plans/PlanDetailPanel.tsx` → outer wrapper is `flex flex-1 flex-col min-h-0 min-w-0`
- `grep -n "StepStatusBadge" src/components/plans/StepListPanel.tsx` → import + conditional render
- `grep -n "stop_on_error\|updatePlan" src/components/plans/PlanRunBar.tsx` → both present
- `grep -n "scrollIntoView" src/components/plans/StepListPanel.tsx` → present in useEffect
- `grep -n "disabled" src/components/plans/PlanDetailPanel.tsx` → `disabled={isRunning}` passed to StepFieldEditor
- `grep -n "disabled" src/components/plans/StepFieldEditor.tsx` → in props interface + fieldset element
- `grep -n "effectiveSelectedStepId\|activeStepId" src/components/plans/PlanDetailPanel.tsx` → both present
- `grep -n "Re-run\|startRun" src/components/plans/PlanRunBar.tsx` → Re-run calls `startRun(plan)`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 - PlanRunBar | ca52681 | feat(22-04): add PlanRunBar component |
| 2 - Integration | 6f947bd | feat(22-04): wire PlanRunBar, StepStatusBadge, auto-scroll, disabled state |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] React rules of hooks compliance in PlanDetailPanel**
- **Found during:** Task 2
- **Issue:** The plan's action description placed `usePlanExecutionStore()` after the `!selectedPlan` early return, which violates React rules of hooks (hooks cannot be called conditionally).
- **Fix:** Hoisted `usePlanExecutionStore()` call to before the early return, with a comment explaining the requirement.
- **Files modified:** `src/components/plans/PlanDetailPanel.tsx`
- **Commit:** 6f947bd

**2. [Rule 2 - Missing Critical Functionality] fieldset[disabled] instead of per-element prop drilling**
- **Found during:** Task 2
- **Issue:** StepFieldEditor renders deeply nested field components (`ScalarField`, `EnumField`, `NestedMessageField`, etc.) from `src/components/form/fields/*` which are outside this plan's file scope. Prop drilling `disabled` into each field component would require modifying files not in the plan's `<files>` list.
- **Fix:** Used HTML `<fieldset disabled={disabled} className="contents">` which cascades the disabled state to all descendant form controls natively without prop drilling. This satisfies D-09 while respecting the scope boundary.
- **Files modified:** `src/components/plans/StepFieldEditor.tsx`
- **Commit:** 6f947bd

## Known Stubs

None. All functionality is fully implemented and wired to live state from `usePlanExecutionStore` and `usePlanRunner`.

## Threat Flags

No new security-relevant surface introduced. This plan adds UI-only components:
- T-22-10 (double-submit) mitigated: `isRunning=true` disables Run button; `disabled` button cannot be clicked.
- T-22-11 (Stop during cancel) accepted: `stopRun()` / `cancelPlanRun()` is idempotent.
- T-22-12 (plan.name truncation) accepted: user data displayed to same user who created it.
- T-22-SC (no new npm packages): confirmed — all imports from existing shadcn/ui, lucide-react, zustand.

## Self-Check: PASSED

- [x] `src/components/plans/PlanRunBar.tsx` exists — Run/Stop/Re-run controls + stop_on_error toggle + summary
- [x] `src/components/plans/PlanDetailPanel.tsx` modified — PlanRunBar imported + rendered above split
- [x] `src/components/plans/StepListPanel.tsx` modified — StepStatusBadge + isActiveStep + scrollIntoView
- [x] `src/components/plans/StepFieldEditor.tsx` modified — disabled prop + fieldset[disabled]
- [x] Commit ca52681 exists: feat(22-04) PlanRunBar
- [x] Commit 6f947bd exists: feat(22-04) integration
- [x] TypeScript compiles with 0 errors
- [x] All verification grep checks pass
