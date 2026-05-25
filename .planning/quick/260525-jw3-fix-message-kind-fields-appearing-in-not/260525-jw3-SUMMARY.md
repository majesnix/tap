---
phase: quick
plan: 260525-jw3
subsystem: block-apply
tags: [bug-fix, tdd, toast, block-apply]
dependency_graph:
  requires: []
  provides: [ApplyPlan.unknownKeys]
  affects: [src/lib/blockApply.ts, src/components/form/FormPanel.tsx]
tech_stack:
  added: []
  patterns: [allFields map for unknown-key detection]
key_files:
  created: []
  modified:
    - src/lib/blockApply.ts
    - src/lib/blockApply.test.ts
    - src/components/form/FormPanel.tsx
decisions:
  - "D-01: unknownKeys populated in buildApplyPlan (pure function) and surfaced via ApplyPlan rather than recomputed in FormPanel"
  - "D-02: message-kind keys are silently skipped (not in unknownKeys) — existing D-02 / BLK-EXT-FUTURE-02 disposition unchanged"
metrics:
  duration: ~4 minutes
  completed: "2026-05-25"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 260525-jw3: Fix message-kind fields appearing in not-in-form toast

**One-liner:** Added `unknownKeys: string[]` to `ApplyPlan` via an `allFields` map that separates schema-unknown keys from ineligible-kind (message) keys, wiring FormPanel toast to use `plan.unknownKeys` directly.

## What Was Done

### Task 1 — Add unknownKeys to ApplyPlan and fix buildApplyPlan (TDD)

**RED commit** `3ca7b2d` — Updated `blockApply.test.ts`:
- Updated "skips unknown block key silently": added `expect(plan.unknownKeys).toEqual(["unknownField"])`
- Updated "skips message kind field": added `expect(plan.unknownKeys).toEqual([])`
- Added new "separates unknown keys from message-kind keys in mixed block" test
- Added `expect(plan.unknownKeys).toEqual([])` to all other tests for exhaustive coverage
- 11 tests, all failing RED as expected

**GREEN commit** `1edd582` — Updated `blockApply.ts`:
- Added `unknownKeys: string[]` to `ApplyPlan` type
- Added `allFields` map over all fields (all kinds) before the loop
- Declared `unknownKeys: string[]` alongside `toApply`
- Changed loop guard: `!allFields.has(key)` → push to unknownKeys; `!eligibleFields.get(key)` → silent skip
- Updated return to `{ toApply, conflicts: [], unknownKeys }`
- Updated JSDoc to reflect new semantics
- All 11 tests pass GREEN

### Task 2 — Wire plan.unknownKeys into FormPanel toast

**Commit** `eae5014` — Updated `FormPanel.tsx`:
- Replaced skipped-derivation set arithmetic (4 lines) with `plan.unknownKeys` check (3 lines)
- Removed stale OQ-1/D-02 comment
- TypeScript compiles with zero errors (`tsc --noEmit`)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `3ca7b2d` | test | add failing tests for unknownKeys separation (RED) |
| `1edd582` | feat | separate unknown keys from message-kind keys in ApplyPlan (GREEN) |
| `eae5014` | fix | toast uses plan.unknownKeys instead of derived skipped set |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — change is purely within existing trusted boundaries. `unknownKeys` is derived from schema field names (trusted compile-time data) and block values (already parsed/guarded at the drag-end boundary).

## TDD Gate Compliance

- RED gate commit: `3ca7b2d` (test) — present
- GREEN gate commit: `1edd582` (feat) — present, after RED

## Self-Check: PASSED

Files exist:
- src/lib/blockApply.ts — modified, `unknownKeys` present
- src/lib/blockApply.test.ts — modified, 11 tests all pass
- src/components/form/FormPanel.tsx — modified, `plan.unknownKeys` present

Commits exist:
- 3ca7b2d — confirmed in git log
- 1edd582 — confirmed in git log
- eae5014 — confirmed in git log
