---
phase: 06-bytesfield
plan: 01
subsystem: ui
tags: [react, react-hook-form, zod, shadcn/ui, base64, bytes, form-field, TextEncoder]

# Dependency graph
requires:
  - phase: 01-form-foundation
    provides: ScalarField pattern (Controller + validate + error display), ProtoFormRenderer dispatch switch
  - phase: 03-publish
    provides: Controlled-open Popover pattern from AmqpPropertiesSheet

provides:
  - BytesField component with RFC 4648 base64 validation and UTF-8 text helper
  - Pre-dispatch branch in ProtoFormRenderer routing bytes fields to BytesField
  - Bytes handling removed from ScalarField (clean separation)

affects:
  - 07-mapfield (same pre-dispatch branch pattern for new field types)
  - 08-json-override (same ProtoFormRenderer frozen switch pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pre-dispatch branch in ProtoFormRenderer for specialized scalar types (before switch, switch FROZEN)"
    - "two-layer zod validation: char-set regex + structural .refine() for base64"
    - "TextEncoder-based utf8ToBase64 helper (safe for non-ASCII, no btoa() on user text)"
    - "safeParse().success guard before atob() — prevents InvalidCharacterError on partial inputs during typing"
    - "controlled-open Popover with local useState for text helpers"

key-files:
  created:
    - src/components/form/fields/BytesField.tsx
    - src/components/form/__tests__/BytesField.test.tsx
  modified:
    - src/components/form/ProtoFormRenderer.tsx
    - src/components/form/fields/ScalarField.tsx
    - src/components/form/__tests__/ScalarField.test.tsx

key-decisions:
  - "Structural base64 validation uses strict RFC 4648 regex in .refine() (not atob()) — jsdom/Node atob() silently pads 'abc' to 2 bytes instead of throwing; strict regex catches invalid lengths reliably"
  - "Pre-dispatch branch pattern: bytes check added before ProtoFormRenderer switch (switch body FROZEN per D-01)"
  - "BytesField uses single Controller pattern (same as ScalarField) — never two Controllers for one field"
  - "Byte count label guarded by base64Schema.safeParse().success — only calls atob() on known-valid values"

patterns-established:
  - "Pre-dispatch branch: if (field.kind.type === 'scalar' && field.kind.scalar === X) return <SpecialField /> — used before ProtoFormRenderer switch"
  - "TDD RED/GREEN: test file first (import fails = valid RED), then implement"

requirements-completed: [BFLD-01, BFLD-02, BFLD-03, BFLD-04]

# Metrics
duration: 15min
completed: 2026-05-19
---

# Phase 6 Plan 01: BytesField Summary

**Dedicated BytesField component with two-layer RFC 4648 base64 validation (char-set regex + structural refine) and TextEncoder-based UTF-8 text helper, replacing ScalarField's bare z.string() bytes fallback**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-19T08:47:00Z
- **Completed:** 2026-05-19T08:51:00Z
- **Tasks:** 2 (Task 1 TDD: 3 commits; Task 2: 1 commit)
- **Files modified:** 5

## Accomplishments

- BytesField component with RFC 4648 standard base64 validation: char-set regex (rejects URL-safe `-_`) + structural .refine() (rejects padded-wrong lengths like "abc")
- TextEncoder-based utf8ToBase64 helper for UTF-8-safe conversion in "From text" popover — handles non-ASCII characters that would break bare btoa()
- Byte count label shows decoded byte length for valid non-empty inputs, guarded by safeParse().success to prevent atob() crashes on partial inputs during typing
- ProtoFormRenderer pre-dispatch branch routes bytes fields to BytesField before the switch (switch body frozen)
- ScalarField fully cleaned: bytes case removed from getZodSchema, textKinds, JSDoc, and badge JSX
- Full test suite: 157 tests pass across 21 test files; npx tsc --noEmit exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: BytesField tests (failing)** - `7498f7b` (test)
2. **Task 1 GREEN: BytesField implementation** - `43e2724` (feat)
3. **Task 2: Wire BytesField + remove bytes from ScalarField** - `9737fab` (feat)

## Files Created/Modified

- `src/components/form/fields/BytesField.tsx` — New dedicated bytes field component
- `src/components/form/__tests__/BytesField.test.tsx` — 8 tests: render, badge, byte count, URL-safe rejection, structural-invalid rejection, empty-is-valid, From text button, Convert flow
- `src/components/form/ProtoFormRenderer.tsx` — BytesField import + pre-dispatch branch before switch
- `src/components/form/fields/ScalarField.tsx` — 4 surgical cuts: bytes from getZodSchema, textKinds, JSDoc, badge JSX
- `src/components/form/__tests__/ScalarField.test.tsx` — Bytes test removed (19 tests remain, all pass)

## Decisions Made

- **Structural validation uses strict regex not atob():** Plan specified `.refine((s) => { try { atob(s) } catch { return false } })` for structural invalid base64. During GREEN phase, Node/jsdom's atob() proved lenient — it silently pads "abc" (3 chars) to produce 2 bytes instead of throwing. The test for "abc" would have passed without catching it. Fixed by using the correct strict RFC 4648 structural regex `/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/` in the .refine() instead. Intent preserved (BFLD-04 mitigation) — implementation corrected for runtime reality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced atob()-based structural validation with strict RFC 4648 regex**
- **Found during:** Task 1 GREEN phase (test 5 — structural invalid "abc" failing to show alert)
- **Issue:** Plan's `.refine((s) => { try { atob(s); return true; } catch { return false; } })` does not work in Node.js / jsdom environments — both silently pad "abc" (3 chars) to 2 bytes rather than throwing. The structural validation had no effect; "abc" would pass and reach Rust's `base64_decode_or_empty` silently returning empty bytes (BFLD-04 violation).
- **Fix:** Replaced atob() check with strict RFC 4648 structural regex: `/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/`. This correctly rejects "abc" (no padding, not a multiple of 4), "abcde" (5 chars, wrong tail), while accepting "abcd" (4 chars, valid), "abc=" (4 chars with 1 pad), "aGVsbG8=" (valid "hello" encoding).
- **Files modified:** src/components/form/fields/BytesField.tsx
- **Verification:** npm test -- BytesField exits 0 with 8 passing tests; structural invalid "abc" correctly triggers alert
- **Committed in:** 43e2724 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix essential for BFLD-04 correctness. The .refine() with atob() approach is a documented Node/jsdom incompatibility — production Chrome/Firefox would also silently accept "abc" (modern browsers are lenient with atob padding). The strict regex is the correct universal validation approach. No scope creep.

## Issues Encountered

None beyond the atob() structural validation deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 (MapField) can follow the same pre-dispatch branch pattern established here
- ProtoFormRenderer switch is frozen; any new specialized scalar types follow the same `if (field.kind.type === "scalar" && field.kind.scalar === X)` pre-dispatch pattern
- BytesField is fully integrated and tested; bytes fields will render correctly in any proto schema

## Self-Check

- [x] BytesField.tsx exists at src/components/form/fields/BytesField.tsx
- [x] BytesField.test.tsx exists at src/components/form/__tests__/BytesField.test.tsx
- [x] 06-01-SUMMARY.md created at .planning/phases/06-bytesfield/06-01-SUMMARY.md
- [x] RED commit 7498f7b exists
- [x] GREEN commit 43e2724 exists
- [x] Task 2 commit 9737fab exists
- [x] 157 tests pass, npx tsc --noEmit exits 0

## Self-Check: PASSED

---
*Phase: 06-bytesfield*
*Completed: 2026-05-19*
