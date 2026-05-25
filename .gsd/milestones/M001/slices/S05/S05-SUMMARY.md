---
id: S05
parent: M001
milestone: M001
provides:
  - SchemaExplorer collapsible tree component in sidebar
  - Top-level EnumSchema extraction from .proto files (Rust + TypeScript types)
  - Recursive type safety pattern (visited-set + MAX_DEPTH=5) reusable for other schema-walking UI
requires:
  - slice: S04
    provides: Field metadata pattern (proto type, field number, cardinality) for badge rendering
  - slice: S03
    provides: useProtoStore schema state shape consumed by the tree
affects:
  - none — final slice of M001
key_files:
  - src/components/sidebar/SchemaExplorer.tsx
  - src/components/sidebar/Sidebar.tsx
  - src/components/sidebar/__tests__/SchemaExplorer.test.tsx
  - src-tauri/src/schema/types.rs
  - src-tauri/src/schema/extractor.rs
  - src/lib/types.ts
key_decisions:
  - Indentation via inline paddingLeft, not dynamic Tailwind classes (Tailwind purges dynamic names)
  - SchemaExplorer reads schema directly from useProtoStore rather than via props
  - Recursive guard combines visited-set with MAX_DEPTH=5 hard cap (defense in depth)
  - vi.mock + vi.resetModules + dynamic import in beforeEach for fresh store mocks per test
  - cargo build must run from src-tauri/ directory, not worktree root
patterns_established:
  - Recursive schema-tree rendering with visited-set + depth cap
  - Store-driven sidebar components (read from useProtoStore directly, no prop drilling)
  - EnumSchema type bridging Rust pool.all_enums() to TypeScript via FileDescriptorSet handoff
  - Per-test store mock reset via vi.resetModules + dynamic import
observability_surfaces:
  - none — pure UI component with no runtime side effects, network, or persisted state
drill_down_paths:
  - .gsd/milestones/M001/slices/S05/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S05/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S05/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-25T21:34:16.370Z
blocker_discovered: false
---

# S05: Schema Explorer Tree

**Collapsible schema tree in sidebar with recursive-type safety, depth cap, and click-to-select message type**

## What Happened

S05 closes M001 by shipping the SchemaExplorer power-user panel. Three tasks chained cleanly with no replans.

T01 surfaced top-level enums to the frontend. The Rust extractor only inlined enum values per-field via FieldKind::Enum; standalone enum declarations were invisible to the UI. We added an EnumSchema type to src-tauri/src/schema/types.rs, used pool.all_enums() in the extractor to collect every enum descriptor, and added a matching EnumSchema TypeScript shape plus an enums: EnumSchema[] field on ProtoSchema. All ten existing test fixtures across form, store, response, and keyboard-shortcut tests were updated to include enums: []. Verification ran cargo build from src-tauri/ (not worktree root — a verification-path gotcha worth remembering), then pnpm tsc --noEmit and pnpm vitest run — 48 files / 616 tests green.

T02 built the SchemaExplorer component (src/components/sidebar/SchemaExplorer.tsx) and wired it into Sidebar.tsx between the message selector and ConnectionSection. The tree renders messages with field counts, expands to show fields with type badges plus repeated/map/oneof indicators, expands standalone enums to name=number value rows, and emits setSelectedType on message-name click. Recursive types are guarded by a visited-set carried through render; depth is hard-capped at MAX_DEPTH=5. Two implementation choices worth flagging: indentation uses inline paddingLeft (Tailwind purges dynamic class names), and the component reads schema directly from useProtoStore rather than taking props — keeps the Sidebar wiring minimal and matches the established store-driven pattern. Verification: tsc clean, 48 files / 616 tests green.

T03 added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches. The tests mock useProtoStore with vi.mock + dynamic import inside beforeEach after vi.resetModules() so each test installs a fresh store before SchemaExplorer is re-imported. MAX_DEPTH is verified end-to-end by building a Level0..Level6 chain and asserting expansion halts past depth 5. Verification: 13/13 pass in ~958ms.

Final slice-level verification: pnpm tsc --noEmit clean, pnpm vitest run = 49 files / 629 tests pass. R025 (schema explorer panel) and R026 (recursive safety with depth cap + visited-set) are both satisfied with passing tests as proof. Milestone M001 is now ready for closeout.

## Verification

Ran `pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx` — 1 file, 13/13 tests passed (~420ms test duration). Ran `pnpm tsc --noEmit` — no type errors. Ran full `pnpm vitest run` across the project — 49 test files, 629 tests, 0 failures (~6.5s). All slice verification commands listed in S05-PLAN pass. R025 and R026 are covered by the SchemaExplorer test file.

## Requirements Advanced

- R025 — SchemaExplorer component now renders all messages, fields, and standalone enums as a collapsible tree in the sidebar
- R026 — Tree applies visited-set guard plus MAX_DEPTH=5 cap to render recursive proto types safely

## Requirements Validated

- R025 — 13 SchemaExplorer tests cover tree rendering, field badges, repeated/map/oneof indicators, enum expansion, and click-to-select
- R026 — Recursive-guard and MAX_DEPTH tests prove safe rendering of recursive proto types with no infinite expansion

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

none

## Known Limitations

No live-runtime UAT was executed for the recursive-render guard against an actual Tauri-loaded proto file with extremely deep nesting; the test asserts behavior in jsdom with a 7-level fixture. Visual polish (exact spacing, icon hover states) was not formally tested.

## Follow-ups

none

## Files Created/Modified

- `src-tauri/src/schema/types.rs` — Added EnumSchema struct and enums field on ProtoSchema
- `src-tauri/src/schema/extractor.rs` — Extracts standalone enums via pool.all_enums() into ProtoSchema.enums
- `src/lib/types.ts` — Added EnumSchema TypeScript type and enums field on ProtoSchema
- `src/components/sidebar/SchemaExplorer.tsx` — New collapsible tree component with recursive guard, depth cap, and click-to-select
- `src/components/sidebar/Sidebar.tsx` — Wired SchemaExplorer into sidebar between message selector and ConnectionSection
- `src/components/sidebar/__tests__/SchemaExplorer.test.tsx` — New test file: 13 tests covering tree rendering, recursion, depth cap, click-to-select
- `src/components/form/__tests__/FormPanel-randomizer.test.tsx` — Added enums: [] to schema fixture
- `src/__tests__/keyboard-shortcuts.test.tsx` — Added enums: [] to schema fixture
- `src/components/form/__tests__/NestedMessageField.test.tsx` — Added enums: [] to schema fixture
- `src/components/form/__tests__/FormPanel.test.tsx` — Added enums: [] to schema fixture
- `src/components/form/__tests__/FormPanel-drafts.test.tsx` — Added enums: [] to schema fixture
- `src/stores/useProtoStore.test.ts` — Added enums: [] to schema fixture
- `src/components/response/ResponseQueuePicker.test.tsx` — Added enums: [] to schema fixture
- `src/components/response/MessageFeedTab.test.tsx` — Added enums: [] to schema fixture
