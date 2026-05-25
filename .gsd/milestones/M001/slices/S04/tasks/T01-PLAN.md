---
estimated_steps: 8
estimated_files: 10
skills_used: []
---

# T01: Added field_number: u32 to Rust FieldSchema and field_number: number to TypeScript FieldSchema, populated from FieldDescriptor::number() in extractor

**Why:** Tooltips need proto field numbers (R024) which are not currently in FieldSchema. This crosses the Rust→TS IPC boundary and must be proven first since all downstream work depends on the schema shape.

**Do:**
1. In `src-tauri/src/schema/types.rs`, add `pub field_number: u32` to FieldSchema struct (after `label`)
2. In `src-tauri/src/schema/extractor.rs`, add `field_number: field.number()` to both FieldSchema construction sites (map path at line 119 and regular path at line 132)
3. In `extract_message`, set `field_number: 0` on the synthetic oneof FieldSchema (line 76) — oneof groups have no proto field number
4. In `src/lib/types.ts`, add `field_number: number` to FieldSchema interface (after `label`)
5. Update all existing test fixtures that construct FieldSchema objects to include `field_number` — search for `kind:` in test files under `src/` to find them

**Done when:** `cargo build` succeeds, `pnpm tsc --noEmit` passes, all existing tests pass with updated fixtures.

## Inputs

- `src-tauri/src/schema/types.rs`
- `src-tauri/src/schema/extractor.rs`
- `src/lib/types.ts`

## Expected Output

- `src-tauri/src/schema/types.rs`
- `src-tauri/src/schema/extractor.rs`
- `src/lib/types.ts`

## Verification

cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && cd src-tauri && cargo build && cd .. && pnpm tsc --noEmit && pnpm vitest run --reporter=verbose
