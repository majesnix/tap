---
id: T04
parent: S04
milestone: M001
key_files:
  - src/lib/__tests__/randomizer.test.ts
  - src/components/form/fields/__tests__/FieldTooltip.test.tsx
  - src/components/form/__tests__/FormPanel-randomizer.test.tsx
key_decisions:
  - Used findAllByText helper for FieldTooltip tests because Radix Tooltip renders content text in both visible div and a visually-hidden screen-reader span, causing findByText to throw on duplicate matches
duration: 
verification_result: passed
completed_at: 2026-05-25T20:55:08.318Z
blocker_discovered: false
---

# T04: Added 23 tests covering generateRandomValues (all proto types), FieldTooltip (7 field kinds), and Randomize button integration (render, click, dirty field pass-through)

**Added 23 tests covering generateRandomValues (all proto types), FieldTooltip (7 field kinds), and Randomize button integration (render, click, dirty field pass-through)**

## What Happened

Created three test files as specified in the task plan:

1. **`src/lib/__tests__/randomizer.test.ts`** — 16 unit tests for `generateRandomValues` covering: all 14 scalar types (bool, string, bytes, int32, uint32, int64, uint64, float, double, sint32, sfixed32, fixed32, sint64, sfixed64, fixed64), enum (valid values + empty array), nested message (recursion + missing message), depth cap at 5 (self-referential message), oneof (branch selection + _selected), map ({key, value} entries with correct types), repeated (array of 1-3 items), dirty field skip (excluded from output), and well-known types (Timestamp ISO string, Duration seconds string).

2. **`src/components/form/fields/__tests__/FieldTooltip.test.tsx`** — 7 render tests covering: scalar tooltip with type/field number/cardinality, enum showing "enum", map showing "map" cardinality, oneof omitting field number when field_number is 0 (synthetic oneof groups), repeated showing "repeated" cardinality, message showing short type name, and well-known type showing wkt name. Used `findAllByText` helper because Radix Tooltip renders text twice (visible + screen-reader span).

3. **`src/components/form/__tests__/FormPanel-randomizer.test.tsx`** — 3 integration tests covering: Randomize button renders in header, click triggers setPendingReplayValues with generated values, and dirty fields are passed through to generateRandomValues.

## Verification

Ran full test suite with `pnpm vitest run --reporter=verbose`. All 616 tests pass across 48 test files with zero failures. Initial run had 7 FieldTooltip test failures due to Radix rendering tooltip text in duplicate DOM nodes; fixed by switching from `findByText` to `findAllByText` helper.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && pnpm vitest run --reporter=verbose` | 0 | pass | 6360ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/lib/__tests__/randomizer.test.ts`
- `src/components/form/fields/__tests__/FieldTooltip.test.tsx`
- `src/components/form/__tests__/FormPanel-randomizer.test.tsx`
