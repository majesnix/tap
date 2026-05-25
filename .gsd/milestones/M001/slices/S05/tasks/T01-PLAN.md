---
estimated_steps: 7
estimated_files: 11
skills_used: []
---

# T01: Added EnumSchema to Rust types and extractor, TypeScript types, and updated all test fixtures with enums: []

**Why:** The schema explorer needs to display top-level enums, but the Rust extractor only inlines enum values into FieldKind::Enum per field. pool.all_enums() exposes standalone enum descriptors that must be extracted and serialized to the frontend.

**Do:**
1. In `src-tauri/src/schema/types.rs`: add `EnumSchema { name: String, full_name: String, values: Vec<EnumValue> }` struct with Serialize/Deserialize/Clone derives. Add `enums: Vec<EnumSchema>` field to `ProtoSchema`.
2. In `src-tauri/src/schema/extractor.rs`: import the new `EnumSchema` type. After the messages extraction, call `pool.all_enums()`, filter out `google.protobuf.*` prefixes, map each to `EnumSchema { name, full_name, values }`, collect into a Vec. Add `enums` to the `ProtoSchema` constructor.
3. In `src/lib/types.ts`: add `EnumSchema` interface `{ name: string; full_name: string; values: EnumValue[] }`. Add `enums: EnumSchema[]` to the `ProtoSchema` interface.
4. Update all test fixtures that construct ProtoSchema objects — add `enums: []` to each. Grep for `messages:` and `message_map:` in test files to find them all (8 files identified: FormPanel-randomizer.test.tsx, keyboard-shortcuts.test.tsx, NestedMessageField.test.tsx, FormPanel.test.tsx, FormPanel-drafts.test.tsx, useProtoStore.test.ts, ResponseQueuePicker.test.tsx, MessageFeedTab.test.tsx).

**Done when:** `cargo build` succeeds, `pnpm tsc --noEmit` succeeds, `pnpm vitest run` passes all existing tests with updated fixtures.

## Inputs

- `src-tauri/src/schema/types.rs`
- `src-tauri/src/schema/extractor.rs`
- `src/lib/types.ts`

## Expected Output

- `src-tauri/src/schema/types.rs`
- `src-tauri/src/schema/extractor.rs`
- `src/lib/types.ts`

## Verification

cargo build && pnpm tsc --noEmit && pnpm vitest run
