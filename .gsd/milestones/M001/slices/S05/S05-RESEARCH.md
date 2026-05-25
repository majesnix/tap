# S05: Schema Explorer Tree — Research

**Date:** 2026-05-25

## Summary

The Schema Explorer Tree is a read-only collapsible tree that shows all messages, fields, and enums from the loaded `.proto` file. The codebase already has every building block: `useProtoStore` exposes `schema.messages` and `schema.message_map`, shadcn `Collapsible` is proven in `NestedMessageField.tsx`, and `FieldKind` is a discriminated union that maps cleanly to tree node types. The main gap is **standalone enum extraction** — the Rust extractor only extracts messages via `pool.all_messages()`, but `prost-reflect::DescriptorPool` also exposes `all_enums()` which is needed to show top-level enums in the tree.

For placement, the best option is a new **collapsible section in the left sidebar** between the Message Type selector and ConnectionSection. This keeps schema exploration co-located with file/message selection (the user's mental model: "I loaded this file → I see its structure") and avoids bloating the RightPanel which is already 3 tabs deep. The section should be collapsible since not all users want it open all the time.

Recursive type safety follows the established `MAX_DEPTH = 5` pattern from `ProtoFormRenderer.tsx`, plus a **visited-set** (R026 requirement) to detect actual cycles and show a "(recursive)" indicator rather than just a depth cutoff.

## Recommendation

Build the SchemaExplorer as a pure frontend component consuming existing `useProtoStore.schema` data. Add standalone enum extraction to the Rust backend (`all_enums()` on DescriptorPool, new `enums` field on `ProtoSchema`). Use the existing `Collapsible` component with recursive rendering, depth cap at 5, and a visited-set guard for cycle detection. Place it as a collapsible sidebar section.

**No new npm dependencies.** No new Rust crates. The `ScrollArea` shadcn component is already available for overflow handling.

## Implementation Landscape

### Key Files

- `src-tauri/src/schema/types.rs` — Add `EnumSchema { name, full_name, values: Vec<EnumValue> }` struct; add `enums: Vec<EnumSchema>` to `ProtoSchema`
- `src-tauri/src/schema/extractor.rs` — Add `pool.all_enums()` extraction, filter `google.protobuf.*`, build `EnumSchema` entries
- `src/lib/types.ts` — Add `EnumSchema` interface; add `enums: EnumSchema[]` to `ProtoSchema`
- `src/components/sidebar/SchemaExplorer.tsx` — **New file**: collapsible tree component, recursive rendering with depth cap + visited-set
- `src/components/sidebar/Sidebar.tsx` — Add `SchemaExplorer` section between message selector and ConnectionSection
- `src/components/ui/collapsible.tsx` — Already exists, no changes needed
- `src/components/ui/scroll-area.tsx` — Already exists, wrap the tree for overflow
- `src/stores/useProtoStore.ts` — No changes needed; `schema` already contains `messages` and `message_map`

### Build Order

1. **T01: Rust enum extraction** — Add `EnumSchema` type, extract standalone enums from `DescriptorPool.all_enums()`, add `enums` field to `ProtoSchema`. This unblocks the frontend and proves the backend contract. Verify: `cargo build` passes, existing tests still pass.

2. **T02: TypeScript type update** — Add `EnumSchema` interface and `enums` field to `ProtoSchema` in `types.ts`. Quick change, unblocks component development. Verify: `pnpm tsc --noEmit`.

3. **T03: SchemaExplorer component** — Build the collapsible tree in `src/components/sidebar/SchemaExplorer.tsx`. Three node types: message (expandable, shows fields), field (leaf or expandable if message/oneof/map type), and enum (expandable, shows values). Recursive message fields resolve via `message_map` lookup. Wire into `Sidebar.tsx`. Verify: visual inspection + unit tests.

4. **T04: Tests** — Unit tests for SchemaExplorer: renders messages, expands/collapses, handles recursive types with visited-set, shows enums, shows field metadata (type badge, field number). Verify: `pnpm vitest run`.

### Constraints and Gotchas

**Standalone enums vs field-level enums:** The Rust extractor currently inlines enum values into `FieldKind::Enum { values }` on each field. Standalone enums (top-level `enum Foo { ... }` not nested inside a message) are not currently extracted at all. `DescriptorPool::all_enums()` returns all enum descriptors — filter out `google.protobuf.*` and map entry synthetics.

**Recursive type detection:** R026 requires a visited-set, not just depth cap. The visited set tracks `full_name` of message types currently on the render stack. When a message type is encountered that's already in the set, render "(recursive)" instead of expanding. This is strictly stronger than depth cap alone — it catches actual cycles at any depth.

**Depth cap still needed:** Even without cycles, deeply nested (but non-recursive) types could produce very deep trees. Keep `MAX_DEPTH = 5` as a secondary guard.

**No click-to-select-message:** The roadmap says "Jump-to-field from schema tree" is future/out-of-scope. The tree is read-only exploration. However, clicking a message name in the tree to set it as the selected message type is a natural affordance — consider adding this as a low-effort bonus (calls `setSelectedType`).

**ProtoSchema serialization:** Adding `enums` to the Rust `ProtoSchema` struct changes the IPC payload. The frontend TypeScript type must match. No migration needed — the field is additive and old schemas without `enums` will deserialize as `undefined` until the backend is updated.

**Existing test fixtures:** Multiple test files create mock `ProtoSchema` objects. Adding `enums: EnumSchema[]` will require updating these fixtures (add `enums: []` to each). Grep for `messages:` and `message_map:` patterns in test files to find them all.

### Component Architecture

```
SchemaExplorer (sidebar section)
├── ScrollArea (overflow)
│   ├── Messages section header
│   │   ├── MessageNode (collapsible)
│   │   │   ├── FieldNode (leaf: scalar/enum/bytes/wkt)
│   │   │   ├── FieldNode → MessageNode (expandable: message kind, recurse)
│   │   │   ├── FieldNode → OneofNode (expandable: shows branches)
│   │   │   └── FieldNode → MapNode (shows key→value types)
│   │   └── ...more messages
│   └── Enums section header
│       ├── EnumNode (collapsible, shows values)
│       └── ...more enums
```

Each node shows:
- **Message**: icon + name, field count badge, expandable
- **Field**: name, type badge (scalar type / message name / enum), field number, repeated/map indicator
- **Enum**: icon + name, value count badge, expandable → shows `name = number` per value
- **Recursive**: "(recursive — see above)" label instead of expanding

### Visual Design Notes

- Use `text-xs` for compact tree rendering (sidebar is narrow at 288px)
- Indent with `ml-3` per level (tighter than form's `ml-4` since this is read-only)
- Type badges: `<Badge variant="outline">` with scalar type name, message short name, or "enum"
- Field numbers: dim `text-muted-foreground` after the field name
- Icons: `ChevronRight`/`ChevronDown` for expand/collapse (matches `NestedMessageField`), `FileText` for messages, `List` for enums
- ScrollArea wraps the entire tree for long schemas

### Patterns to Follow

- **Collapsible pattern from NestedMessageField.tsx**: `useState(true)` for open state, `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` from shadcn
- **message_map lookup for nested types**: Same pattern as ProtoFormRenderer — resolve `FieldKind::Message { full_name }` via `schema.message_map[full_name]`
- **No circular imports**: SchemaExplorer is self-contained — it reads from `useProtoStore` and renders its own tree. No dependency on form components.

### Risk Assessment

**Risk: LOW.** This is a read-only visualization component with no side effects. All data sources exist. The recursive rendering pattern is proven in `NestedMessageField.tsx`. The only backend change (enum extraction) is additive. No new dependencies.

### Skill Discovery

No new skills needed. The codebase uses established patterns (shadcn Collapsible, Zustand store subscription, discriminated union dispatch) that are well-covered by existing knowledge. The `shadcn` skill is available if component setup questions arise.
