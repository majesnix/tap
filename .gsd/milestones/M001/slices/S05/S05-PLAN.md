# S05: Schema Explorer Tree

**Goal:** User opens schema explorer in the sidebar, sees all messages, fields, and enums from the loaded .proto file as a collapsible tree, expands nested types, and loads a recursive proto without the tree freezing. Clicking a message name sets it as the selected message type.
**Demo:** User opens schema explorer, sees all messages/fields/enums as a tree, expands nested types, loads a recursive proto and the tree renders safely without freezing

## Must-Haves

- 1. SchemaExplorer renders all messages and standalone enums from schema as collapsible tree nodes. 2. Expanding a message shows its fields with type badges, field numbers, and repeated/map indicators. 3. Expanding a standalone enum shows name=number value pairs. 4. Recursive message types show '(recursive)' label via visited-set guard — no infinite render. 5. Depth cap at 5 prevents excessively deep trees even without cycles. 6. Clicking a message name in the tree calls setSelectedType. 7. All existing tests still pass after adding enums field to ProtoSchema. 8. R025 and R026 are satisfied.

## Proof Level

- This slice proves: Contract + integration: unit tests verify tree rendering, recursive guards, enum display, and click-to-select behavior. TypeScript and Rust compilation verify type contract.

## Integration Closure

Upstream: consumes useProtoStore.schema (existing), field metadata pattern from S04. New wiring: SchemaExplorer component added to Sidebar.tsx between message selector and ConnectionSection. Rust extractor gains all_enums() extraction, ProtoSchema gains enums field. What remains after this slice: nothing — milestone S05 is the final slice.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Added EnumSchema to Rust types and extractor, TypeScript types, and updated all test fixtures with enums: []** `est:45m`
  **Why:** The schema explorer needs to display top-level enums, but the Rust extractor only inlines enum values into FieldKind::Enum per field. pool.all_enums() exposes standalone enum descriptors that must be extracted and serialized to the frontend.
  - Files: `src-tauri/src/schema/types.rs`, `src-tauri/src/schema/extractor.rs`, `src/lib/types.ts`, `src/components/form/__tests__/FormPanel-randomizer.test.tsx`, `src/__tests__/keyboard-shortcuts.test.tsx`, `src/components/form/__tests__/NestedMessageField.test.tsx`, `src/components/form/__tests__/FormPanel.test.tsx`, `src/components/form/__tests__/FormPanel-drafts.test.tsx`, `src/stores/useProtoStore.test.ts`, `src/components/response/ResponseQueuePicker.test.tsx`, `src/components/response/MessageFeedTab.test.tsx`
  - Verify: cargo build && pnpm tsc --noEmit && pnpm vitest run

- [x] **T02: Built SchemaExplorer tree component with message/field/enum/oneof nodes, recursive guard, depth cap, and wired into Sidebar** `est:1h30m`
  **Why:** R025 requires a collapsible tree showing all messages, fields, and enums. R026 requires recursive type safety with depth cap and visited-set guard.
  - Files: `src/components/sidebar/SchemaExplorer.tsx`, `src/components/sidebar/Sidebar.tsx`
  - Verify: pnpm tsc --noEmit && pnpm vitest run

- [x] **T03: Added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches** `est:1h`
  **Why:** R025 and R026 need test coverage proving the tree renders correctly and handles recursive types safely. Tests also verify the click-to-select integration with useProtoStore.
  - Files: `src/components/sidebar/__tests__/SchemaExplorer.test.tsx`
  - Verify: pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx

## Files Likely Touched

- src-tauri/src/schema/types.rs
- src-tauri/src/schema/extractor.rs
- src/lib/types.ts
- src/components/form/__tests__/FormPanel-randomizer.test.tsx
- src/__tests__/keyboard-shortcuts.test.tsx
- src/components/form/__tests__/NestedMessageField.test.tsx
- src/components/form/__tests__/FormPanel.test.tsx
- src/components/form/__tests__/FormPanel-drafts.test.tsx
- src/stores/useProtoStore.test.ts
- src/components/response/ResponseQueuePicker.test.tsx
- src/components/response/MessageFeedTab.test.tsx
- src/components/sidebar/SchemaExplorer.tsx
- src/components/sidebar/Sidebar.tsx
- src/components/sidebar/__tests__/SchemaExplorer.test.tsx
