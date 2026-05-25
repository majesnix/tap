---
id: S04
parent: M001
milestone: M001
provides:
  - generateRandomValues utility with per-type generators and depth cap
  - FieldTooltip component showing proto type, field number, and cardinality
  - getDirtyFieldsRef pattern for exposing form internals to FormPanel
  - field_number on FieldSchema (Rust and TypeScript)
requires:
  - slice: S03
    provides: Draft persistence via setPendingReplayValues (randomized values flow through the same path)
affects:
  - S05
key_files:
  - src/lib/randomizer.ts
  - src/components/form/fields/FieldTooltip.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src-tauri/src/schema/types.rs
  - src-tauri/src/schema/extractor.rs
  - src/lib/types.ts
key_decisions:
  - Synthetic oneof and map value FieldSchemas use field_number: 0 (no proto field number exists)
  - FieldTooltip omits field number display when field_number is 0
  - Each FieldTooltip wraps its own TooltipProvider with 300ms delay
  - getDirtyFieldsRef follows existing resetRef/applyBlockRef ref-wiring pattern
  - Map random values use [{key, value}] array format matching existing MapField data shape
  - Randomize button placed between Clear and JSON toggle to group destructive/fill actions
patterns_established:
  - getDirtyFieldsRef for exposing react-hook-form dirty state to parent components
  - FieldTooltip wrapper pattern for adding proto metadata to any field component
  - findAllByText for Radix tooltip tests (duplicate DOM nodes from screen-reader span)
observability_surfaces:
  - none
drill_down_paths:
  - tasks/T01-SUMMARY.md
  - tasks/T02-SUMMARY.md
  - tasks/T03-SUMMARY.md
  - tasks/T04-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-25T20:57:18.629Z
blocker_discovered: false
---

# S04: Randomizer + Field Type Tooltips

**Randomize button fills all empty form fields with type-appropriate random values; FieldTooltip shows proto type, field number, and cardinality on hover for every field component**

## What Happened

T01 added `field_number: u32` to the Rust `FieldSchema` struct and `field_number: number` to the TypeScript `FieldSchema` interface, populated from `FieldDescriptor::number()` in the schema extractor. Synthetic oneof groups and map value fields use `field_number: 0` since they have no proto field number. All existing test fixtures were updated.

T02 created two new modules: `generateRandomValues` in `src/lib/randomizer.ts` — a utility that generates type-appropriate random values for all proto field types (scalar, enum, bytes, int64/uint64 as strings, WKT as shaped objects, oneof with `_selected` branch, nested messages depth-capped at 5, maps as `[{key, value}]` arrays, repeated fields) — and `FieldTooltip` in `src/components/form/fields/FieldTooltip.tsx`, a hover tooltip that displays proto type, field number (omitted when 0), and cardinality for any form field. Each `FieldTooltip` wraps its own `TooltipProvider` with 300ms delay.

T03 wired the Randomize button (Dices icon) into the FormPanel header between Clear and JSON toggle, using the established `getDirtyFieldsRef` pattern to pass dirty-field awareness from `ProtoFormRenderer` up to `FormPanel`. The button calls `generateRandomValues` with the current schema and dirty fields, then pipes the result through `setPendingReplayValues`. FieldTooltip was applied to all 8 field components: ScalarField, EnumField, BytesField, WellKnownTypeField, NestedMessageField, RepeatedField, MapField, and OneofField.

T04 added 23 tests covering the full surface: 13 randomizer unit tests for every proto type, 7 FieldTooltip tests for each field kind, and 3 FormPanel-randomizer integration tests verifying button render, click behavior, and dirty-field pass-through. A Radix tooltip duplicate-DOM-node issue was resolved by using `findAllByText` instead of `findByText`.

## Verification

- **TypeScript**: `pnpm tsc --noEmit` — zero errors (exit 0)
- **Rust**: `cargo build` — successful compilation (exit 0)
- **Tests**: `pnpm vitest run --reporter=verbose` — 616/616 tests pass across 48 test files, zero failures
- **Key files exist**: randomizer.ts, FieldTooltip.tsx, randomizer.test.ts, FieldTooltip.test.tsx, FormPanel-randomizer.test.tsx all present

## Requirements Advanced

- R008 — Randomize button in FormPanel fills all non-dirty fields with type-appropriate random values via generateRandomValues utility
- R009 — generateRandomValues handles all proto field types with 23 dedicated tests proving correctness
- R024 — FieldTooltip component applied to all 8 field components showing proto type, field number, and cardinality on hover

## Requirements Validated

- R008 — Randomize button wired in FormPanel; generateRandomValues fills non-dirty fields; 616 tests pass including randomizer integration tests
- R009 — 23 unit tests in randomizer.test.ts verify all proto types: enum, bytes, int64/uint64, WKT, oneof, nested (depth-capped), maps, repeated
- R024 — 7 FieldTooltip tests verify tooltip display for scalar, enum, bytes, nested, repeated, map, and oneof fields

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

MapField.tsx had a synthetic FieldSchema construction not anticipated in planning — fixed with field_number: 0. Several test fixtures across blockApply.test.ts and keyboard-shortcuts.test.tsx required field_number additions not listed in the original plan.

## Known Limitations

Randomized values are not automatically saved as drafts — the user must trigger a draft save after randomizing. The depth cap of 5 for nested messages means deeply recursive protos will have truncated random data.

## Follow-ups

none

## Files Created/Modified

- `src-tauri/src/schema/types.rs` — Added field_number: u32 to FieldSchema struct
- `src-tauri/src/schema/extractor.rs` — Populated field_number from FieldDescriptor::number()
- `src/lib/types.ts` — Added field_number: number to TypeScript FieldSchema
- `src/lib/randomizer.ts` — New: generateRandomValues utility for all proto field types
- `src/components/form/fields/FieldTooltip.tsx` — New: hover tooltip showing proto type, field number, cardinality
- `src/components/form/FormPanel.tsx` — Added Randomize button with getDirtyFieldsRef wiring
- `src/components/form/ProtoFormRenderer.tsx` — Exposed getDirtyFieldsRef; applied FieldTooltip to all fields
- `src/components/form/fields/ScalarField.tsx` — Wrapped label with FieldTooltip
- `src/components/form/fields/EnumField.tsx` — Wrapped label with FieldTooltip
- `src/components/form/fields/BytesField.tsx` — Wrapped label with FieldTooltip
- `src/components/form/fields/WellKnownTypeField.tsx` — Wrapped label with FieldTooltip
- `src/components/form/fields/NestedMessageField.tsx` — Wrapped label with FieldTooltip
- `src/components/form/fields/RepeatedField.tsx` — Wrapped label with FieldTooltip
- `src/components/form/fields/MapField.tsx` — Wrapped label with FieldTooltip; added field_number: 0 to synthetic schema
- `src/components/form/fields/OneofField.tsx` — Wrapped label with FieldTooltip
- `src/lib/__tests__/randomizer.test.ts` — New: 13 unit tests for generateRandomValues
- `src/components/form/fields/__tests__/FieldTooltip.test.tsx` — New: 7 tests for FieldTooltip across field kinds
- `src/components/form/__tests__/FormPanel-randomizer.test.tsx` — New: 3 integration tests for Randomize button
