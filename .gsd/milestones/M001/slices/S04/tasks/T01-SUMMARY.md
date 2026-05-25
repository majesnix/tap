---
id: T01
parent: S04
milestone: M001
key_files:
  - src-tauri/src/schema/types.rs
  - src-tauri/src/schema/extractor.rs
  - src/lib/types.ts
  - src/components/form/fields/MapField.tsx
key_decisions:
  - Synthetic oneof FieldSchema gets field_number: 0 since oneof groups have no proto field number
  - Synthetic map value FieldSchema in MapField.tsx gets field_number: 0 since it represents a virtual field
duration: 
verification_result: passed
completed_at: 2026-05-25T20:43:15.890Z
blocker_discovered: false
---

# T01: Added field_number: u32 to Rust FieldSchema and field_number: number to TypeScript FieldSchema, populated from FieldDescriptor::number() in extractor

**Added field_number: u32 to Rust FieldSchema and field_number: number to TypeScript FieldSchema, populated from FieldDescriptor::number() in extractor**

## What Happened

Added `field_number: u32` to the Rust `FieldSchema` struct in types.rs (after `label`). Updated all three construction sites in extractor.rs: the map field path uses `field.number()`, the regular field path uses `field.number()`, and the synthetic oneof group field uses `0` (oneof groups have no proto field number). Added `field_number: number` to the TypeScript `FieldSchema` interface in types.ts. Updated the synthetic `valueFieldSchema` in MapField.tsx (used for rendering map value cells) with `field_number: 0`. Fixed all test fixtures across 13 test files: ScalarField, FormPanel, FormPanel-drafts, ProtoFormRenderer, WellKnownTypeField, RepeatedField, OneofField, NestedMessageField, MapField, EnumField, BytesField, keyboard-shortcuts, and blockApply tests.

## Verification

Ran cargo build (success), pnpm tsc --noEmit (no errors), and pnpm vitest run --reporter=verbose (580 tests passed, 45 test files).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd src-tauri && cargo build` | 0 | pass | 37010ms |
| 2 | `pnpm tsc --noEmit` | 0 | pass | 3000ms |
| 3 | `pnpm vitest run --reporter=verbose` | 0 | pass | 6800ms |

## Deviations

MapField.tsx had a synthetic FieldSchema construction not mentioned in the task plan — fixed it with field_number: 0. blockApply.test.ts and keyboard-shortcuts.test.tsx also had FieldSchema fixtures not listed in the plan — updated them as well.

## Known Issues

none

## Files Created/Modified

- `src-tauri/src/schema/types.rs`
- `src-tauri/src/schema/extractor.rs`
- `src/lib/types.ts`
- `src/components/form/fields/MapField.tsx`
