---
id: T03
parent: S04
milestone: M001
key_files:
  - src/components/form/FormPanel.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/components/form/fields/ScalarField.tsx
  - src/components/form/fields/EnumField.tsx
  - src/components/form/fields/BytesField.tsx
  - src/components/form/fields/WellKnownTypeField.tsx
  - src/components/form/fields/OneofField.tsx
  - src/components/form/fields/MapField.tsx
  - src/components/form/fields/RepeatedField.tsx
  - src/components/form/fields/NestedMessageField.tsx
key_decisions:
  - getDirtyFieldsRef follows existing resetRef/applyBlockRef ref-wiring pattern to expose form internals to FormPanel without breaking component boundaries
  - Randomize button placed between Clear and JSON toggle to group destructive/fill actions together
duration: 
verification_result: passed
completed_at: 2026-05-25T20:51:10.316Z
blocker_discovered: false
---

# T03: Wired Randomize button into FormPanel header and applied FieldTooltip to all 8 field components

**Wired Randomize button into FormPanel header and applied FieldTooltip to all 8 field components**

## What Happened

Added a Randomize button (Dices icon from lucide-react) to the FormPanel header, positioned between the Clear button and the JSON toggle button. The button calls generateRandomValues with the current message schema, message map, and the form's dirtyFields (obtained via a new getDirtyFieldsRef pattern), then passes the result through setPendingReplayValues — following the established mandatory form-fill path (MEM003).

To expose dirtyFields from the form context (which lives inside ProtoFormRenderer's FormProvider) to FormPanel (which lives outside it), added a getDirtyFieldsRef prop to ProtoFormRenderer following the same ref-wiring pattern used by resetRef and applyBlockRef. The ref is populated with a closure that returns methods.formState.dirtyFields.

Applied FieldTooltip wrapper to the Label (or label-like span) element in all 8 field components:
- ScalarField.tsx — wraps Label
- EnumField.tsx — wraps Label
- BytesField.tsx — wraps Label
- WellKnownTypeField.tsx — wraps Label
- OneofField.tsx — wraps group-level Label
- MapField.tsx — wraps field name span
- RepeatedField.tsx — wraps field name span
- NestedMessageField.tsx — wraps field label span inside CollapsibleTrigger

## Verification

Ran pnpm tsc --noEmit (zero errors) and pnpm vitest run --reporter=verbose (580/580 tests passed). All existing tests pass without regression.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 5000ms |
| 2 | `pnpm vitest run --reporter=verbose` | 0 | pass | 6780ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/form/FormPanel.tsx`
- `src/components/form/ProtoFormRenderer.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/form/fields/WellKnownTypeField.tsx`
- `src/components/form/fields/OneofField.tsx`
- `src/components/form/fields/MapField.tsx`
- `src/components/form/fields/RepeatedField.tsx`
- `src/components/form/fields/NestedMessageField.tsx`
