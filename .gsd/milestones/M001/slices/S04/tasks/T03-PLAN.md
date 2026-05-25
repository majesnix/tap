---
estimated_steps: 14
estimated_files: 9
skills_used: []
---

# T03: Wired Randomize button into FormPanel header and applied FieldTooltip to all 8 field components

**Why:** The standalone artifacts from T02 need to be wired into the UI. The Randomize button integrates the randomizer into FormPanel's header. FieldTooltip wraps every field label for R024.

**Do:**
1. In FormPanel.tsx, add a Randomize button (Dices icon from lucide-react) between the Clear button and the JSON toggle button in the header (line ~441). On click: read formState.dirtyFields, call generateRandomValues with current message + messageMap + dirtyFields, pass result to setPendingReplayValues. Follow existing button pattern (ghost variant, icon-sm size, title with tooltip text).
2. Apply FieldTooltip to all 8 field components by wrapping each Label element:
   - ScalarField.tsx — wrap Label (line 136)
   - EnumField.tsx — wrap Label (line 37)
   - BytesField.tsx — wrap Label (line 95)
   - WellKnownTypeField.tsx — wrap Label (line 34)
   - OneofField.tsx — wrap group-level Label (line 61)
   - MapField.tsx — wrap Label
   - RepeatedField.tsx — wrap Label
   - NestedMessageField.tsx — wrap Label
3. Import FieldTooltip and Dices icon where needed.

**Done when:** `pnpm tsc --noEmit` passes, all existing tests pass, Randomize button is visible in FormPanel header.

## Inputs

- `src/lib/randomizer.ts`
- `src/components/form/fields/FieldTooltip.tsx`
- `src/components/form/FormPanel.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/form/fields/WellKnownTypeField.tsx`
- `src/components/form/fields/OneofField.tsx`
- `src/components/form/fields/MapField.tsx`
- `src/components/form/fields/RepeatedField.tsx`
- `src/components/form/fields/NestedMessageField.tsx`
- `src/stores/useProtoStore.ts`

## Expected Output

- `src/components/form/FormPanel.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/form/fields/WellKnownTypeField.tsx`
- `src/components/form/fields/OneofField.tsx`
- `src/components/form/fields/MapField.tsx`
- `src/components/form/fields/RepeatedField.tsx`
- `src/components/form/fields/NestedMessageField.tsx`

## Verification

cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && pnpm tsc --noEmit && pnpm vitest run --reporter=verbose
