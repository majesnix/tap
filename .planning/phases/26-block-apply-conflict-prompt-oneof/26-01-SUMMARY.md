---
phase: 26-block-apply-conflict-prompt-oneof
plan: "01"
subsystem: blockApply-pure-function
tags: [tdd, typescript, block-apply, oneof, map-collision, conflict-detection]
dependency_graph:
  requires: []
  provides:
    - ConflictItemKind type (map_key_collision | oneof_dirty_subfield | oneof_branch_switch)
    - ConflictChoices type (compound key Record)
    - Extended ConflictItem with nonCollidingBlockRows, fieldLabel, subFieldLabel
    - buildApplyPlan oneof + map-collision detection
    - ELIGIBLE_KINDS includes 'oneof'
    - ApplyBlockRef.commitApply accepts choices?: ConflictChoices
  affects:
    - src/lib/blockApply.ts (extended types + logic)
    - src/lib/blockApply.test.ts (17 tests, 6 new)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (vitest)
    - Pure function extension (no React/form imports)
    - Per-key map collision detection with nonCollidingBlockRows carry
    - Dotted-path toApply item for oneof sub-fields (fieldName: "payment.card_number")
key_files:
  created: []
  modified:
    - src/lib/blockApply.ts
    - src/lib/blockApply.test.ts
decisions:
  - "makeOneofField helper uses branches: FieldSchema[][] (array-of-arrays) to match actual types.ts; plan prose described { name, fields } shape which doesn't exist in the type"
  - "Map collision: nonCollidingBlockRows is same array reference on every ConflictItem for a field — commitApply needs only read it from conflicts[0]"
  - "dirtyFields[key] check moved after map and oneof branches; scalar/enum/well_known keep the top-level dirty guard; oneof uses per-sub-field dirty check"
metrics:
  duration: ~8 minutes
  completed: "2026-05-25T14:05:21Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 26 Plan 01: blockApply Oneof + Map Collision Detection Summary

Extended `buildApplyPlan` pure function with oneof support and per-key map collision detection via TDD — 17 passing tests, zero regressions, clean TypeScript.

## What Was Built

### Types added to `src/lib/blockApply.ts`

- **`ConflictItemKind`** — `'map_key_collision' | 'oneof_dirty_subfield' | 'oneof_branch_switch'`
- **`ConflictChoices`** — `Record<string, 'skip' | 'overwrite'>` with compound key format
- **`ConflictItem`** — extended with `subFieldName?`, `currentBranch?`, `blockBranch?`, `collisionKey?`, `nonCollidingBlockRows?`, `fieldLabel?`, `subFieldLabel?`
- **`ApplyItemKind`** — `'oneof'` added to union
- **`ApplyBlockRef.commitApply`** — signature updated to `(plan: ApplyPlan, choices?: ConflictChoices) => void`

### Logic in `buildApplyPlan`

**Map collision detection (BLK-EXT-03):**
- Non-empty map field: partition block rows into colliding / non-colliding by existing key set
- ANY collision → suppress toApply for the field entirely; emit one `map_key_collision` ConflictItem per colliding row; `nonCollidingBlockRows` (same array ref on all items) carries non-colliding rows for Phase B atomic merge
- Zero collisions → emit toApply item as before (no regression)

**Oneof support (BLK-EXT-04, BLK-EXT-05, D-01, D-02, D-03):**
- `'oneof'` added to `ELIGIBLE_KINDS`
- `_selected` absent or not a string → silent skip (NOT in unknownKeys, per D-02)
- Unrecognized branch name → silent skip (per D-02)
- Current branch ≠ block branch → `oneof_branch_switch` ConflictItem
- Same branch, dirty sub-field → `oneof_dirty_subfield` ConflictItem
- Same branch, clean sub-field → toApply item with dotted path `"${key}.${subFieldName}"` and kind `'oneof'`

## TDD Gate Compliance

- RED commit: `1754bde` — test(26-01): 6 new failing tests, 2 updated tests; 11 still pass
- GREEN commit: `6615020` — feat(26-01): all 17 tests pass; full suite 506/506; tsc --noEmit clean

## Deviations from Plan

### Auto-adapted Issues

**1. [Rule 3 - Blocking] makeOneofField helper type mismatch**
- **Found during:** Task 1 (RED phase planning)
- **Issue:** Plan described `branches: Array<{ name: string; fields: FieldSchema[] }>` but `types.ts` defines `FieldKind.oneof.branches: FieldSchema[][]`. These are different shapes — the plan's prose was conceptual, not a real type.
- **Fix:** Implemented `makeOneofField` using `branches: branchNames.map((b) => [makeScalarField(b)])` matching the actual `FieldSchema[][]` type. Branch name lookup uses `branch[0]?.name` consistent with `OneofField.tsx:37`.
- **Files modified:** `src/lib/blockApply.test.ts`

None other — plan executed as designed.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. This is a pure TypeScript function with no I/O. T-26-01 and T-26-02 from plan threat register: both accepted as analyzed (read-only pure function; currentValue is local form state only).

## Known Stubs

None.

## Self-Check: PASSED

- [x] `src/lib/blockApply.ts` exists and exports `ConflictItemKind`, `ConflictChoices`
- [x] `src/lib/blockApply.test.ts` has `makeOneofField` helper and 17 tests
- [x] Commit `1754bde` (RED) exists: `git log --oneline | grep 1754bde`
- [x] Commit `6615020` (GREEN) exists: `git log --oneline | grep 6615020`
- [x] 17/17 tests pass; 506/506 full suite; tsc --noEmit clean
