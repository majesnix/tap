---
phase: 07-mapfield
plan: 03
subsystem: ui
tags: [react, react-hook-form, useFieldArray, tdd, mapfield, duplicate-detection]

# Dependency graph
requires:
  - phase: 07-02
    provides: MapField.tsx stub + ProtoFormRenderer pre-dispatch routing + FieldKind map union

provides:
  - MapField.tsx full implementation — useFieldArray rows, key type dispatch, duplicate detection,
    hidden __mapDuplicateGuard Controller, renderValue prop with depth+1
  - MapField.test.tsx — 7 test cases covering all MFLD requirements

affects: [07-04-plan, proto-form-renderer, mapfield-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - hasDuplicatesRef pattern — useRef mirrors hasDuplicates so validate closure never captures stale value
    - setError + clearErrors in useEffect for manual error propagation to formState.isValid
    - useWatch(path) + useMemo for duplicate key detection firing on onChange
    - Hidden Controller (__mapDuplicateGuard) as formState.isValid gate without visual rendering

key-files:
  created:
    - src/components/form/__tests__/MapField.test.tsx
  modified:
    - src/components/form/fields/MapField.tsx

key-decisions:
  - "hasDuplicatesRef pattern: validate closure captures ref.current (not stale hasDuplicates) — prevents validate returning true from clearing the setError error"
  - "setError alone sufficient for formState.isValid — validate rule on hidden Controller uses ref to stay in sync"
  - "isDupe check uses duplicateKeys.has(rowKey) with no empty-string exception — two rows with key '' are duplicate per MFLD-03"
  - "depth+1 passed to renderValue — prevents MAX_DEPTH recursion bypass for nested map values"

# Metrics
duration: 15min
completed: 2026-05-19
---

# Phase 7 Plan 03: MapField TDD Implementation Summary

**Full MapField component implemented via TDD — useFieldArray rows with key type dispatch (string/number/bool Select), duplicate detection via useWatch+useMemo+setError, hidden __mapDuplicateGuard keeping formState.isValid false while duplicates exist, and renderValue prop with depth+1**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-19T09:10:00Z
- **Completed:** 2026-05-19T09:24:54Z
- **Tasks:** 2 (Task 1: RED, Task 2: GREEN)
- **Files modified:** 2 (1 created test file, 1 overwritten component)

## Accomplishments

- Created `MapField.test.tsx` with 7 test cases covering all MFLD-01 through MFLD-04 requirements
- Confirmed RED state: all 7 tests failed against the Plan 02 null-returning stub
- Implemented full `MapField.tsx` overwriting the stub:
  - `useFieldArray` rows keyed by `rhfField.id` (never index)
  - Key input dispatched by `key_type`: text (string), number (int32), text+regex (int64), shadcn Select (bool)
  - Duplicate detection via `useWatch` + `useMemo` — fires on `onChange`, shows inline "Duplicate key" error on every affected row
  - Hidden `${path}.__mapDuplicateGuard` Controller keeps `formState.isValid` false while duplicates exist
  - `renderValue` called with `depth + 1` to respect MAX_DEPTH recursion guard
- Confirmed GREEN state: all 7 tests pass
- `npx tsc --noEmit` exits 0 — no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Write MapField test file — 7 failing tests** - `57ddd5b` (test)
2. **Task 2 GREEN: Implement MapField.tsx — overwrite stub with full component** - `749dd9d` (feat)

## Files Created/Modified

- `src/components/form/__tests__/MapField.test.tsx` — 7 test cases with Select mock from EnumField.test.tsx
- `src/components/form/fields/MapField.tsx` — Full implementation (stub replaced)

## Decisions Made

- `hasDuplicatesRef` pattern: the `validate` closure on the hidden guard Controller must read `hasDuplicatesRef.current` rather than capturing `hasDuplicates` by closure. Without the ref, the validate function could run with a stale `false` value and return `true`, which clears the error set by `setError` in the `useEffect`. This was the root cause of test 6 (`formState.isValid is false while duplicates exist`) initially failing.
- `setError`/`clearErrors` in `useEffect` is the primary mechanism for keeping `formState.isValid` false — RHF respects manually-set errors in `formState.isValid` derivation.
- `duplicateKeys.has(rowKey)` with no empty-string exception: two rows with `key = ""` are treated as duplicate per MFLD-03 spec.
- `depth + 1` passed to `renderValue` — prevents circular/deep nesting from bypassing the MAX_DEPTH guard in ProtoFormRenderer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale closure in validate rule clearing setError error**

- **Found during:** Task 2 GREEN — test 6 (`formState.isValid is false while duplicates exist`) failed after initial implementation
- **Issue:** The `validate` rule on the hidden `__mapDuplicateGuard` Controller captured `hasDuplicates` by closure. When validate ran (triggered by onChange on key inputs), it read the stale value `false` and returned `true` — which caused RHF to clear the error that `setError` had just set, preventing `formState.isValid` from becoming `false`.
- **Fix:** Added `hasDuplicatesRef = useRef(hasDuplicates)` with `hasDuplicatesRef.current = hasDuplicates` kept in sync. The validate closure now reads `hasDuplicatesRef.current` instead of `hasDuplicates`.
- **Files modified:** `src/components/form/fields/MapField.tsx`
- **Commit:** `749dd9d` (part of GREEN commit)

## TDD Gate Compliance

- RED gate: `test(07-03)` commit `57ddd5b` — all 7 tests failed (RED confirmed)
- GREEN gate: `feat(07-03)` commit `749dd9d` — all 7 tests pass (GREEN confirmed)

## Known Stubs

None — MapField.tsx is fully implemented with no placeholder values.

## Threat Flags

No new threat surface introduced beyond what was documented in the plan's threat register:
- T-07-06: Duplicate key detection (client-side guard) — implemented via `duplicateKeys` useMemo
- T-07-07: renderValue prop — no direct code execution risk
- T-07-08: `__mapDuplicateGuard` field name — path-derived from schema field names, no prototype pollution risk

---
*Phase: 07-mapfield*
*Completed: 2026-05-19*
