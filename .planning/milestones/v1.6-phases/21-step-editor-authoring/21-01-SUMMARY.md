---
phase: 21-step-editor-authoring
plan: "01"
subsystem: store-layer
tags: [zustand, plan-store, history-store, step-actions, tdd]
dependency_graph:
  requires: []
  provides:
    - usePlanStore.addStep
    - usePlanStore.updateStep
    - usePlanStore.deleteStep
    - usePlanStore.duplicateStep
    - usePlanStore.reorderSteps
    - HistoryEntry.protoPath
  affects:
    - src/stores/usePlanStore.ts
    - src/stores/useHistoryStore.ts
    - src/components/publish/PublishBar.tsx
tech_stack:
  added: []
  patterns:
    - optimistic-write + rollback (plansLoaded guard + persistPlans + rollback pattern)
    - TDD RED/GREEN on store actions
key_files:
  created: []
  modified:
    - src/stores/usePlanStore.ts
    - src/stores/usePlanStore.test.ts
    - src/stores/useHistoryStore.ts
    - src/stores/useHistoryStore.test.ts
    - src/components/publish/PublishBar.tsx
decisions:
  - "duplicateStep name pattern is '{original} (copy)' — intentionally different from plan duplication 'Copy of {name}'"
  - "protoPath is optional on HistoryEntry for backward compatibility with pre-Phase-21 history entries"
metrics:
  duration: "3m 16s"
  completed_date: "2026-05-23T21:40:10Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 21 Plan 01: Step Store Foundation Summary

Five step-level Zustand actions on `usePlanStore` plus `HistoryEntry.protoPath` optional field and `PublishBar` wiring for D-10 protoPath capture.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for five step actions | eb7becf | src/stores/usePlanStore.test.ts |
| 1 (GREEN) | Five step actions on usePlanStore | 101c6fa | src/stores/usePlanStore.ts |
| 2 | protoPath on HistoryEntry + PublishBar | ef62b2b | src/stores/useHistoryStore.ts, src/stores/useHistoryStore.test.ts, src/components/publish/PublishBar.tsx |

## What Was Built

### usePlanStore — Five new step actions

All five follow the canonical `plansLoaded` guard + optimistic-write + `persistPlans` + rollback pattern established by `renamePlan`:

- **`addStep(planId, step)`** — appends a `PlanStep` to the named plan; no-op when `plansLoaded` is false
- **`updateStep(planId, stepId, partial)`** — merges `Partial<PlanStep>` into the target step; non-matching steps/plans are unchanged
- **`deleteStep(planId, stepId)`** — filters the target step from the plan's steps array
- **`duplicateStep(planId, stepId)`** — produces a copy with new UUID and `"{original.name} (copy)"` name; appended after original; returns `null` if step not found or `plansLoaded` is false
- **`reorderSteps(planId, fromIndex, toIndex)`** — splice-based arrayMove: removes from `fromIndex`, inserts at `toIndex`

### HistoryEntry.protoPath

`protoPath?: string` added between `routingKey` and `status` in the `HistoryEntry` interface (D-10). Optional to preserve backward compatibility with existing `history.json` entries from pre-Phase-21 sessions.

### PublishBar updates

Both `appendEntry` call sites (success path and failure path) now include `protoPath: activeFilePath ?? undefined`. `activeFilePath` is destructured from `useProtoStore.getState()` in the synchronous capture block before the first `await`.

## Test Coverage

| File | Tests |
|------|-------|
| usePlanStore.test.ts | 36 total (21 prior + 15 new step-action tests) |
| useHistoryStore.test.ts | 10 total (8 prior + 2 new protoPath tests) |

All 46 tests pass. TypeScript compiles without errors.

## TDD Gate Compliance

- RED commit `eb7becf`: `test(21-01): add failing tests for five step actions` — 15 tests failing, 21 passing
- GREEN commit `101c6fa`: `feat(21-01): add five step actions to usePlanStore` — all 36 passing

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all five actions are fully implemented and wired to `persistPlans`. `HistoryEntry.protoPath` is populated from `activeFilePath` on every send.

## Self-Check: PASSED

Files exist:
- src/stores/usePlanStore.ts: FOUND
- src/stores/usePlanStore.test.ts: FOUND
- src/stores/useHistoryStore.ts: FOUND
- src/components/publish/PublishBar.tsx: FOUND

Commits exist:
- eb7becf (RED): FOUND
- 101c6fa (GREEN): FOUND
- ef62b2b (Task 2): FOUND
