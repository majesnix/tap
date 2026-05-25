---
sliceId: S04
uatType: artifact-driven
verdict: PASS
date: 2026-05-25T23:01:00.000Z
---

# UAT Result — S04

## Checks

| Check | Mode | Result | Notes |
|-------|------|--------|-------|
| Randomize fills empty fields | artifact | PASS | 23 randomizer unit tests cover all proto types (bool, string, bytes, int32, uint32, int64, uint64, float, double, sint32/64, sfixed32/64, fixed32/64, enum, nested, map, repeated, oneof). All pass. |
| Randomize preserves dirty fields | artifact | PASS | FormPanel-randomizer test "dirty fields are passed to generateRandomValues" confirms dirty fields forwarded; randomizer skips them. blockApply tests confirm dirty-field guard (BLK-07). |
| FieldTooltip displays proto metadata | artifact | PASS | FieldTooltip test "scalar field tooltip shows type, field number, and cardinality" passes (404ms render + assertion). |
| FieldTooltip for enum field | artifact | PASS | FieldTooltip test "enum field tooltip shows 'enum'" passes. |
| FieldTooltip for repeated field | artifact | PASS | FieldTooltip test "repeated field shows 'repeated' cardinality" passes. |
| FieldTooltip for map field | artifact | PASS | FieldTooltip test "map field tooltip shows 'map' cardinality" passes. |
| FieldTooltip hides field number for synthetic fields | artifact | PASS | FieldTooltip test "oneof field tooltip omits field number when field_number is 0" passes. |
| Deeply nested message randomization | artifact | PASS | Randomizer test "returns empty object for nested messages at depth 5" confirms MAX_RECURSION_DEPTH=5 cap. |
| All fields already dirty | artifact | PASS | Dirty-field guard logic confirmed in FormPanel-randomizer and blockApply tests — dirty fields are never overwritten. |
| Proto with only enum fields | artifact | PASS | Randomizer tests "returns a valid enum number from values array" and "returns 0 for empty enum values" confirm valid enum selection. |
| Randomize button renders in header | artifact | PASS | FormPanel-randomizer test "Randomize button renders in the header" passes. Dices icon import and aria-label="Randomize" confirmed in FormPanel.tsx. |
| field_number on FieldSchema (Rust) | artifact | PASS | `field_number: u32` present in src-tauri/src/schema/types.rs. |
| field_number on FieldSchema (TypeScript) | artifact | PASS | `field_number: number` present in src/lib/types.ts. |
| getDirtyFieldsRef pattern | artifact | PASS | Ref wired in both FormPanel.tsx and ProtoFormRenderer.tsx, matching existing resetRef/applyBlockRef pattern. |
| Full regression suite | artifact | PASS | 616/616 tests pass across 48 test files (6.36s). No failures, no skips. |

## Overall Verdict

PASS — All 15 checks pass. The randomizer utility, FieldTooltip component, field_number plumbing, and getDirtyFieldsRef pattern are fully covered by 23 dedicated S04 tests plus the full 616-test regression suite with zero failures.

## Notes

- Tooltip tests produce benign "An update to Tooltip inside a test was not wrapped in act(...)" warnings from Radix — these are cosmetic and do not affect test correctness.
- Visual tooltip positioning/styling and draft persistence of randomized values are explicitly out of scope per the UAT spec.
