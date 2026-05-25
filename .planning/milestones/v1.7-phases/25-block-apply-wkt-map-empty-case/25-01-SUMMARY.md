---
phase: 25-block-apply-wkt-map-empty-case
plan: "01"
subsystem: frontend-lib
tags: [tdd, pure-function, block-apply, typescript]
dependency_graph:
  requires: []
  provides: [buildApplyPlan, ApplyPlan, ApplyItem, ConflictItem, ApplyItemKind, ApplyBlockRef]
  affects: [src/lib/blockApply.ts, src/lib/blockApply.test.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, pure-function extraction, factory helpers in tests]
key_files:
  created:
    - src/lib/blockApply.ts
    - src/lib/blockApply.test.ts
  modified: []
decisions:
  - "D-02: ApplyPlan has no skipped field — FormPanel derives skipped list inline (OQ-1 resolved)"
  - "D-03: buildApplyPlan is a pure function in src/lib/blockApply.ts with no React imports"
  - "'message' kind excluded from ELIGIBLE_KINDS — deprecated per BLK-EXT-FUTURE-02 (OQ-4 resolved)"
  - "conflicts is always [] in Phase 25 — Phase 26 fills this for non-empty map fields"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-25"
  tasks_completed: 1
  files_changed: 2
---

# Phase 25 Plan 01: buildApplyPlan Pure Function Summary

## One-liner

Pure `buildApplyPlan` function with 6 exported types, TDD red-green cycle, covering scalar/enum/WKT/map-empty eligibility logic with dirty-field and non-empty-map guards.

## What Was Built

### src/lib/blockApply.ts (NEW)

Standalone pure function `buildApplyPlan` and 5 exported type definitions:

- `ApplyItemKind` — `'scalar' | 'enum' | 'well_known' | 'map'`
- `ApplyItem` — `{ fieldName: string; value: unknown; kind: ApplyItemKind }`
- `ConflictItem` — `{ fieldName: string; blockValue: unknown; currentValue: unknown; kind: ApplyItemKind }`
- `ApplyPlan` — `{ toApply: ApplyItem[]; conflicts: ConflictItem[] }`
- `ApplyBlockRef` — object ref shape for plan 25-02 (`{ buildPlan, commitApply }`)
- `buildApplyPlan(fields, formValues, dirtyFields, blockValues): ApplyPlan`

Key behaviors:
- `ELIGIBLE_KINDS` excludes `'message'` — deprecated shallow setValue path retired per BLK-EXT-FUTURE-02
- Dirty-field guard: `dirtyFields[key]` truthy → skip (protects user-touched fields)
- Map gate: `Array.isArray(formValues[key]) && length > 0` → skip silently (Phase 26 handles conflict)
- Unknown keys silently ignored; `conflicts` always `[]` in Phase 25

### src/lib/blockApply.test.ts (NEW)

10 test cases in `describe("buildApplyPlan")` using vitest AAA pattern with factory helpers:

| Test | Case |
|------|------|
| fills scalar field when not dirty | scalar fill |
| fills enum field when not dirty | enum fill |
| fills well_known field when not dirty (D-06) | WKT fill |
| skips well_known field when dirty (D-06) | WKT dirty skip |
| fills map field when empty (BLK-EXT-02) | map empty fill |
| skips map field when non-empty (Phase 26 conflict path) | map non-empty skip |
| skips unknown block key silently | unknown key skip |
| skips message kind field (D-02 + BLK-EXT-FUTURE-02) | message kind skip |
| conflicts is always empty array in Phase 25 | conflicts invariant |
| returns empty toApply when blockValues is empty | empty blockValues |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | `2c7cb8b` — test(25-01): add failing tests for buildApplyPlan | PASS — all tests failed (module not found) |
| GREEN (feat) | `6ed6c0d` — feat(25-01): implement buildApplyPlan pure function | PASS — all 10 tests pass |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `2c7cb8b` | test | add failing tests for buildApplyPlan — RED phase |
| `6ed6c0d` | feat | implement buildApplyPlan pure function — GREEN phase |

## Verification Results

- `npx vitest run src/lib/blockApply.test.ts` — 10/10 passing
- `npx tsc --noEmit` — clean (no errors)
- `grep -c "^export" src/lib/blockApply.ts` — 6 exports confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in test file makeScalarField factory**

- **Found during:** GREEN phase TypeScript compile check (`npx tsc --noEmit`)
- **Issue:** `makeScalarField` used an inline conditional generic `FieldSchema["kind"] extends { type: "scalar"; scalar: infer S } ? S : never` which resolves to `never`, making the default parameter `"string"` unassignable and the call site argument `"int32"` invalid.
- **Fix:** Changed parameter type to explicit `ScalarKind` imported from `@/lib/types`. Also added `ScalarKind` to the type import statement.
- **Files modified:** `src/lib/blockApply.test.ts`
- **Commit:** Included in `6ed6c0d` (GREEN phase commit)

## Known Stubs

None — all logic is complete. `conflicts: []` is intentionally hardcoded per Phase 25 scope (not a stub; Phase 26 requirement clearly documented).

## Threat Flags

None — this plan creates only a pure utility function in `src/lib/`. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

- [x] `src/lib/blockApply.ts` exists at expected path
- [x] `src/lib/blockApply.test.ts` exists at expected path
- [x] RED commit `2c7cb8b` found in git log
- [x] GREEN commit `6ed6c0d` found in git log
- [x] All 10 tests pass
- [x] TypeScript compiles cleanly
- [x] 6 exports confirmed
