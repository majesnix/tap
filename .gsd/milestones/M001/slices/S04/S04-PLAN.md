# S04: Randomizer + Field Type Tooltips

**Goal:** User clicks Randomize and all empty (non-dirty) fields populate with valid typed values; hovering over any field label shows proto type, field number, and cardinality in a tooltip.
**Demo:** User clicks Randomize and all empty fields populate with valid typed values; hovering over any field label shows proto type, field number, and cardinality

## Must-Haves

- 1. Randomize button fills all non-dirty fields with type-appropriate random values (R008)\n2. All proto field types handled correctly: scalar, enum, bytes, int64, WKT, oneof, map, nested message with depth cap at 5 (R009)\n3. Field tooltips show proto type, field number, and cardinality on hover for all field components (R024)\n4. Randomized values persist as drafts via existing S03 debounce wiring\n5. All existing 580+ tests pass without regression

## Proof Level

- This slice proves: Contract — randomizer tested as pure function with all proto types; tooltip rendering verified per field kind; FormPanel integration tested for button wiring. No real runtime required.

## Integration Closure

Upstream: consumes FieldSchema from Rust backend (extended with field_number), setPendingReplayValues from useProtoStore, draft auto-save from S03 debounce wiring.\nNew wiring: Randomize button in FormPanel header invokes generateRandomValues → setPendingReplayValues; FieldTooltip wraps Label in all 8 field components.\nRemaining for milestone: S05 schema explorer tree.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Added field_number: u32 to Rust FieldSchema and field_number: number to TypeScript FieldSchema, populated from FieldDescriptor::number() in extractor** `est:30m`
  **Why:** Tooltips need proto field numbers (R024) which are not currently in FieldSchema. This crosses the Rust→TS IPC boundary and must be proven first since all downstream work depends on the schema shape.
  - Files: `src-tauri/src/schema/types.rs`, `src-tauri/src/schema/extractor.rs`, `src/lib/types.ts`, `src/components/form/__tests__/FormPanel.test.tsx`, `src/components/form/__tests__/ScalarField.test.tsx`, `src/components/form/__tests__/JsonEditor.test.tsx`, `src/components/publish/__tests__/PublishBar.test.tsx`, `src/components/sidebar/__tests__/FileSection-reload.test.tsx`, `src/components/sidebar/__tests__/IncludePathManager.test.tsx`, `src/stores/__tests__/useProtoStore-reload.test.ts`
  - Verify: cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && cd src-tauri && cargo build && cd .. && pnpm tsc --noEmit && pnpm vitest run --reporter=verbose

- [x] **T02: Created generateRandomValues utility handling all proto field types and FieldTooltip component showing type/field number/cardinality on hover** `est:45m`
  **Why:** The randomizer (R008, R009) is a pure function that generates type-appropriate values for all proto field types. The FieldTooltip (R024) shows proto metadata on hover. Both are new standalone artifacts with no UI wiring yet.
  - Files: `src/lib/randomizer.ts`, `src/components/form/fields/FieldTooltip.tsx`
  - Verify: cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && pnpm tsc --noEmit

- [x] **T03: Wired Randomize button into FormPanel header and applied FieldTooltip to all 8 field components** `est:30m`
  **Why:** The standalone artifacts from T02 need to be wired into the UI. The Randomize button integrates the randomizer into FormPanel's header. FieldTooltip wraps every field label for R024.
  - Files: `src/components/form/FormPanel.tsx`, `src/components/form/fields/ScalarField.tsx`, `src/components/form/fields/EnumField.tsx`, `src/components/form/fields/BytesField.tsx`, `src/components/form/fields/WellKnownTypeField.tsx`, `src/components/form/fields/OneofField.tsx`, `src/components/form/fields/MapField.tsx`, `src/components/form/fields/RepeatedField.tsx`, `src/components/form/fields/NestedMessageField.tsx`
  - Verify: cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && pnpm tsc --noEmit && pnpm vitest run --reporter=verbose

- [x] **T04: Added 23 tests covering generateRandomValues (all proto types), FieldTooltip (7 field kinds), and Randomize button integration (render, click, dirty field pass-through)** `est:45m`
  **Why:** R008, R009, R024 require verified coverage. The randomizer is a complex pure function handling all proto types — tests prove correctness for every variant. Tooltips and button wiring need integration tests.
  - Files: `src/lib/__tests__/randomizer.test.ts`, `src/components/form/fields/__tests__/FieldTooltip.test.tsx`, `src/components/form/__tests__/FormPanel-randomizer.test.tsx`
  - Verify: cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && pnpm vitest run --reporter=verbose

## Files Likely Touched

- src-tauri/src/schema/types.rs
- src-tauri/src/schema/extractor.rs
- src/lib/types.ts
- src/components/form/__tests__/FormPanel.test.tsx
- src/components/form/__tests__/ScalarField.test.tsx
- src/components/form/__tests__/JsonEditor.test.tsx
- src/components/publish/__tests__/PublishBar.test.tsx
- src/components/sidebar/__tests__/FileSection-reload.test.tsx
- src/components/sidebar/__tests__/IncludePathManager.test.tsx
- src/stores/__tests__/useProtoStore-reload.test.ts
- src/lib/randomizer.ts
- src/components/form/fields/FieldTooltip.tsx
- src/components/form/FormPanel.tsx
- src/components/form/fields/ScalarField.tsx
- src/components/form/fields/EnumField.tsx
- src/components/form/fields/BytesField.tsx
- src/components/form/fields/WellKnownTypeField.tsx
- src/components/form/fields/OneofField.tsx
- src/components/form/fields/MapField.tsx
- src/components/form/fields/RepeatedField.tsx
- src/components/form/fields/NestedMessageField.tsx
- src/lib/__tests__/randomizer.test.ts
- src/components/form/fields/__tests__/FieldTooltip.test.tsx
- src/components/form/__tests__/FormPanel-randomizer.test.tsx
