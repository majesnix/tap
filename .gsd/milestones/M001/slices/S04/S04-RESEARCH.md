# S04: Randomizer + Field Type Tooltips — Research

**Date:** 2026-05-25
**Depth:** Targeted research — known tech stack, new feature with known patterns, one backend extension needed.

## Summary

S04 has two independent features: (1) a Randomize button that fills all non-dirty fields with type-appropriate random values, and (2) inline tooltips on field labels showing proto type, field number, and cardinality. Both are well-scoped with clear integration points.

The randomizer is a pure frontend utility that produces a values object compatible with `setPendingReplayValues` (MEM003 — mandatory form-fill path). It must handle all 6 FieldKind variants plus the `repeated` flag, with a depth cap of 5 matching `ProtoFormRenderer.MAX_DEPTH`. The key design question is whether to fill *all* fields or only *non-dirty* fields (R008 says non-dirty). This requires reading `formState.dirtyFields` at randomize time.

The tooltips require a **backend change**: `FieldSchema` currently lacks `field_number`. The `prost-reflect::FieldDescriptor` API exposes `.number()` and `.cardinality()` directly — adding these to the Rust `FieldSchema` struct and the extractor is a 5-line change per field. On the frontend, the existing `Tooltip`/`TooltipContent` Radix component is already used in 12+ files.

## Recommendation

**Build order: backend extension → randomizer utility → tooltip wrapper → button wiring → tests.**

Start with the Rust backend change (add `field_number` and `cardinality` to `FieldSchema`) because it unblocks tooltips and is zero-risk. Then build the randomizer as a standalone pure function (`generateRandomValues`) that takes a `MessageSchema` + `message_map` + `dirtyFields` and returns a values object. Wire the Randomize button into FormPanel header (between Clear and JSON toggle). Build the tooltip wrapper as a shared component wrapping each field label. Tests last, covering all proto types for randomizer and tooltip rendering.

## Implementation Landscape

### Key Files

- `src-tauri/src/schema/types.rs` — Add `field_number: u32` to `FieldSchema` struct (line 18-25)
- `src-tauri/src/schema/extractor.rs` — Extract `field.number()` in `extract_field_schema` (line 97-139); extract cardinality from `field.is_list()` + `field.is_map()` + existing `repeated` bool
- `src/lib/types.ts` — Add `field_number: number` to `FieldSchema` interface (line 33-40)
- `src/lib/randomizer.ts` — **New file**: pure function `generateRandomValues(message, messageMap, dirtyFields?)` → `Record<string, unknown>`
- `src/components/form/fields/FieldTooltip.tsx` — **New file**: shared tooltip wrapper component showing proto type, field number, cardinality
- `src/components/form/FormPanel.tsx` — Add Randomize button in header (line 431, between Clear and JSON toggle); wire to `setPendingReplayValues`
- `src/components/form/fields/ScalarField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/EnumField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/BytesField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/MapField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/RepeatedField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/WellKnownTypeField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/NestedMessageField.tsx` — Wrap label with `FieldTooltip`
- `src/components/form/fields/OneofField.tsx` — Wrap label with `FieldTooltip` (group-level, no field_number)

### Build Order

1. **Rust backend: add field_number** — Unblocks tooltips. Add `field_number: u32` to `FieldSchema` in `types.rs`, extract via `field.number()` in `extractor.rs`. Update TS `FieldSchema` to match. This is the riskiest change (cross-boundary schema change) so prove it first with `cargo build`.

2. **Randomizer utility** — Pure function, fully testable in isolation. Handles all FieldKind variants:
   - `scalar/bool` → random true/false
   - `scalar/string` → random 8-char alphanumeric
   - `scalar/bytes` → random 16-byte base64 string
   - `scalar/int32,uint32,sint32,fixed32,sfixed32` → random integer in safe range
   - `scalar/int64,uint64,sint64,fixed64,sfixed64` → random integer as string (matches buildDefaultValues pattern)
   - `scalar/float,double` → random float
   - `enum` → random valid enum value number (from `field.kind.values`)
   - `message` → recurse into nested message (depth-capped at 5, emit `{}` at max)
   - `well_known/Timestamp` → current time ISO string
   - `well_known/Duration` → random seconds string
   - `oneof` → pick random branch, fill its fields, set `_selected`
   - `map` → generate 1-3 random entries
   - `repeated` → generate 1-3 random items
   - Skip fields where `dirtyFields[fieldName]` is truthy (R008: non-dirty only)

3. **FieldTooltip component** — Shared wrapper that reads `field.field_number`, `field.kind.type`, `field.kind.scalar` (when scalar), and `field.repeated`. Renders as Radix `Tooltip` around the existing `Label`. Content: `"int32 · field 3 · optional"` format.

4. **FormPanel Randomize button** — Add `Dices` icon button. On click: read current `dirtyFields` from form state, call `generateRandomValues`, pass result to `setPendingReplayValues`. Auto-save via existing debounce wiring handles draft persistence (S03 follow-up confirmed).

5. **Apply FieldTooltip to all field components** — Mechanical: wrap existing `<Label>` in each field component with `<FieldTooltip field={field}>`. 8 files, same pattern.

6. **Tests** — Unit tests for randomizer (all proto types, depth cap, dirty field skip). Integration test for Randomize button in FormPanel. Tooltip render tests per field type.

### Seams (Independent Work Units)

The randomizer utility and the tooltip component are fully independent of each other. The backend change is a prerequisite for tooltips only, not for the randomizer. This allows parallelism:

- **Track A**: Rust backend change → FieldTooltip component → apply to field components → tooltip tests
- **Track B**: Randomizer utility → FormPanel button wiring → randomizer tests

### Backend Schema Change Detail

In `src-tauri/src/schema/types.rs`, `FieldSchema`:
```rust
pub struct FieldSchema {
    pub name: String,
    pub label: String,
    pub field_number: u32,  // NEW
    pub kind: FieldKind,
    pub repeated: bool,
    pub oneof_group: Option<String>,
    pub default_value: Option<serde_json::Value>,
}
```

In `src-tauri/src/schema/extractor.rs`, `extract_field_schema`:
```rust
FieldSchema {
    name: field.name().to_string(),
    label: to_label(field.name()),
    field_number: field.number(),  // NEW — prost-reflect FieldDescriptor::number()
    kind,
    repeated,
    oneof_group,
    default_value: None,
}
```

**Cardinality** does not need a new field — it's derivable from `repeated` (bool) + `kind.type`. Proto3 has no "required" — fields are either singular (optional) or repeated. The tooltip can display:
- `repeated: true` → "repeated"
- `kind.type === "map"` → "map"
- else → "optional"

**Oneof field_number**: Oneof groups don't have a field number (they're a synthetic grouping). The synthetic `FieldSchema` for oneof should use `field_number: 0` and the tooltip should omit it. Individual oneof branch fields DO have field numbers — these are already extracted as branch `FieldSchema` items.

### Randomizer Design Constraints

- **Depth cap**: Match `MAX_DEPTH = 5` from ProtoFormRenderer. At depth 5, nested messages emit `{}` (R009).
- **messageMap access**: Needed to resolve `{ type: "message", full_name }` to its `MessageSchema` for recursive generation.
- **64-bit integers as strings**: Must match `buildDefaultValues` convention — int64/uint64/sint64/fixed64/sfixed64 use string representation.
- **Enum values**: Pick from `field.kind.values[].number` — must be a valid enum number, not arbitrary int.
- **Draft integration**: Randomized values auto-save as draft via existing FormPanel debounce (confirmed by S03 follow-up).

### Existing Patterns to Follow

- **Button in FormPanel header**: Copy existing Clear button pattern (ghost variant, icon-sm size, title with keyboard shortcut if applicable)
- **Tooltip composition**: Follow existing Radix Tooltip usage pattern from `src/components/ui/tooltip.tsx`
- **Field label rendering**: Each field component has a consistent label div pattern — `<div className="flex items-center gap-2"><Label>...</Label><Badge>...</Badge><CopyButton /></div>`
- **Pure utility location**: `src/lib/randomizer.ts` follows existing pattern of `src/lib/blockApply.ts`

### Verification

- `cargo build` — Rust compiles with new field_number
- `pnpm tsc --noEmit` — TS compiles with updated FieldSchema
- `pnpm vitest run` — All existing 580+ tests still pass (no regressions from schema change)
- New randomizer unit tests: one test per proto type + depth cap + dirty field skip
- New tooltip render tests: verify tooltip content for each field kind
- New FormPanel integration test: Randomize button triggers setPendingReplayValues

### Risks

- **Schema change propagation**: Adding `field_number` to `FieldSchema` crosses the Rust→TS boundary. All existing tests that construct `FieldSchema` test fixtures will need the new field added. This is mechanical but touches many test files.
- **Oneof randomizer complexity**: Generating valid oneof values requires picking a branch, filling only that branch's fields, and setting `_selected`. Must match OneofField's expected shape exactly.
- **Map randomizer**: Must generate `[{ key: ..., value: ... }]` array matching MapField's expected form structure, not a plain JS object.

### Dependency Slice Outputs Consumed

From S03:
- `useDraftStore` — randomized values auto-save via existing FormPanel debounce wiring
- `setPendingReplayValues` — mandatory path for applying randomized values (MEM003)
- Draft persistence confirms randomized values survive app restart

### Forward Intelligence for S05

- `field_number` is now available in `FieldSchema` — S05's schema explorer can display it in the tree
- The randomizer's recursive message traversal pattern (depth cap + messageMap lookup) is the same pattern S05 needs for tree rendering
- `FieldTooltip` component can be reused in schema explorer for field metadata display

### Skills Considered

- **shadcn** — already installed, relevant for Tooltip component usage. No action needed.
- **react-best-practices** — already installed, relevant for component patterns. No action needed.
- No new skills needed — all technologies are already in use locally.
