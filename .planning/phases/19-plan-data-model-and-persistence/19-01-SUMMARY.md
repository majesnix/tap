---
phase: 19-plan-data-model-and-persistence
plan: "01"
subsystem: ui
tags: [zustand, tauri-plugin-store, typescript, vitest, plans]

requires: []
provides:
  - Plan, PlanStep, StepStatus, PublishTarget, ResponseMode types in src/lib/types.ts
  - PLAN_SCHEMA_VERSION = 1 constant
  - usePlanStore Zustand store with CRUD + plans.json persistence
  - 21 Vitest tests covering all D-14 conditions
affects: [phase-20, phase-21, phase-22, phase-23]

tech-stack:
  added: []
  patterns:
    - plansLoaded hydration gate (mirrors useBlockStore.blocksLoaded)
    - optimistic rollback on persist failure
    - field_values as string (mirrors Block.content) — no undefined→null coercion
    - vi.hoisted mock pattern for tauri-plugin-store in Vitest

key-files:
  created:
    - src/stores/usePlanStore.ts
    - src/stores/usePlanStore.test.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "All 5 Plan types placed in src/lib/types.ts (not co-located with store) — enables Phase 22 to import StepStatus/PublishTarget/ResponseMode without circular dependency"
  - "field_values: string not Record<string, unknown> — mirrors Block.content: string, avoids undefined→null coercion in JSON.stringify across persist/reload cycles (D-12)"
  - "plansLoaded gate identical to useBlockStore line 52 / useHistoryStore line 47 — consistent hydration pattern across all stores"
  - "PLAN_SCHEMA_VERSION constant exported — future phases use the constant, not magic number 1"
  - "No selectedPlanId in store — Phase 20 owns selection as local React state (D-09)"
  - "No usePlanExecutionStore scaffolded — Phase 22 concern, deferred per D-10"

patterns-established:
  - "plansLoaded gate: all write ops guard on !get().plansLoaded and return null/void early — prevents writes before tauri-plugin-store async hydration resolves"
  - "optimistic rollback: capture previous[], set updated[], call persist, catch → set({ previous }), rethrow — identical across createPlan/renamePlan/deletePlan/duplicatePlan"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05]

duration: 15min
completed: 2026-05-23
---

# Phase 19: Plan Data Model and Persistence Summary

**Plan type contract (5 types + constant) + usePlanStore CRUD with plans.json persistence + 21 passing Vitest tests covering all D-14 conditions**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-23T14:00:00Z
- **Completed:** 2026-05-23T14:15:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Extended `src/lib/types.ts` with Plan, PlanStep, StepStatus, PublishTarget, ResponseMode types and PLAN_SCHEMA_VERSION constant — stable contract for phases 20–23
- Created `usePlanStore.ts` mirroring useBlockStore exactly: plansLoaded gate, optimistic rollback, no-options load(), no deferred scope (selectedPlanId, usePlanExecutionStore)
- 21 Vitest tests passing: CRUD round-trips, plansLoaded hydration gate (all 4 write ops), field_values JSON round-trip, duplicatePlan UUID/name/step semantics

## Task Commits

1. **Task 1: Define Plan types** - `d0bdabc` (feat)
2. **Task 2: Implement usePlanStore** - `2666775` (feat)
3. **Task 3: Write usePlanStore.test.ts** - `b831d52` (test)

## Files Created/Modified

- `src/lib/types.ts` - Appended Phase 19 Plan library types section (PublishTarget, ResponseMode, StepStatus, PlanStep, Plan, PLAN_SCHEMA_VERSION)
- `src/stores/usePlanStore.ts` - New store: loadPlans, createPlan, renamePlan, deletePlan, duplicatePlan with persistence
- `src/stores/usePlanStore.test.ts` - 21 tests covering all D-14 conditions

## Decisions Made

- Types in `src/lib/types.ts` not co-located with store: Phase 22 needs StepStatus/PublishTarget/ResponseMode without importing the store — avoiding a circular dependency
- `field_values: string`: mirrors Block.content pattern from useBlockStore; JSON stringify coerces `undefined` values to `null`, silently corrupting Record<string, unknown> fields — string avoids this entirely
- `PLAN_SCHEMA_VERSION = 1 as const`: constant over magic number, consistent with existing codebase style

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Self-Check: PASSED

- `grep -F "kind: 'queue'" src/lib/types.ts` exits 0 ✓
- `grep -F "field_values: string" src/lib/types.ts` exits 0 ✓
- `grep -F "PLAN_SCHEMA_VERSION" src/lib/types.ts` exits 0 ✓
- `grep -F "plansLoaded: false" src/stores/usePlanStore.ts` exits 0 ✓
- No `selectedPlanId` or `usePlanExecutionStore` in store ✓
- `npx vitest run src/stores/usePlanStore.test.ts` → 21 passed ✓
- `npx tsc --noEmit` → no errors ✓

## Next Phase Readiness

Phase 20 (Plan List UI) can immediately:
- `import { usePlanStore } from './usePlanStore'`
- `import type { Plan, PlanStep } from '../lib/types'`

No further setup required. The plansLoaded gate means Phase 20 just needs to call `loadPlans()` on mount before any writes.

---
*Phase: 19-plan-data-model-and-persistence*
*Completed: 2026-05-23*
