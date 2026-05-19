# Phase 7: MapField - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `MapField` — a new component for proto `map<K, V>` fields that renders as typed key-value rows with Add/Remove controls. Requires:

1. **Rust** — new `FieldKind::Map` variant in `schema/types.rs` + extractor logic in `schema/extractor.rs` to detect map fields via `prost-reflect`'s `is_map_entry()`, plus a new `Value::Map` path in `commands/encode.rs`
2. **TypeScript** — new `Map` case in `types.ts` FieldKind union
3. **React** — `MapField.tsx` using `useFieldArray` with `{key, value}` rows; routed from `ProtoFormRenderer` as a pre-dispatch branch or new `case`

Requirements covered: MFLD-01, MFLD-02, MFLD-03, MFLD-04, MFLD-05.

</domain>

<decisions>
## Implementation Decisions

### Rust Schema Shape
- **D-01:** New `FieldKind::Map { key_type: ScalarKind, value_kind: FieldKind }` variant added to both Rust `schema/types.rs` and TypeScript `types.ts`. `value_kind` reuses the existing `FieldKind` enum — no new type needed for values. Rust side: `#[serde(tag = "type", rename_all = "snake_case")]` already on the enum, so the variant serializes as `{ "type": "map", "key_type": "...", "value_kind": { ... } }`.
- **D-02:** Rust extractor sets `repeated: false` on map `FieldSchema`. `MapField` manages its own row array via `useFieldArray` internally. `repeated: true` would cause `ProtoFormRenderer` to double-wrap the field in `RepeatedField` before `MapField` gets a chance to render.
- **D-03:** Encoder path: `encode.rs` must use `Value::Map(BTreeMap<MapKey, Value>)` (prost-reflect's map representation), NOT `Value::List`. Each `{key, value}` row from the frontend is encoded as one map entry.

### Duplicate Key Validation
- **D-04:** Duplicate detection lives in `MapField` component state — a local `Set` or `Array.filter` check on key change (`onChange` watch). Not a zod `.refine()` on the array (that fires at submit/resolver time, too late for inline UX).
- **D-05:** Error display: `<p className="text-xs text-destructive" role="alert">Duplicate key</p>` rendered below the affected key input — same style as zod errors in `ScalarField`. Each row that has a duplicate key shows the error, not just one.
- **D-06:** Send button blocking: `MapField` registers a hidden `Controller` (or RHF `register`) with a `zod` rule that returns an error string when `hasDuplicates` is true. This keeps `formState.isValid` false automatically — no Zustand store coupling. The hidden field's name follows `${path}.__mapDuplicateGuard`.

### Value Sub-renderer
- **D-07:** `MapField` accepts a `renderValue: RenderFieldFn` prop — the same pattern as `RepeatedField`'s `renderItem`. `ProtoFormRenderer` passes its own `renderField` function as `renderValue`. This avoids circular imports and reuses the established pattern exactly.
- **D-08:** Synthetic `FieldSchema` for the value renderer per row: `{ name: \`${field.name}[${index}].value\`, label: "Value", kind: field.kind.value_kind, repeated: false }`. Path argument: `\`${path}.${index}.value\``. This mirrors how `RepeatedField` modifies `field.name` and `path` per row.

### Key Input Rendering (MFLD-02)
- **D-09:** **String keys** → `type="text"` input (default).
- **D-10:** **Integer keys** (int32, uint32, sint32, fixed32, sfixed32) → `type="number"` input. **64-bit keys** (int64, uint64, sint64, fixed64, sfixed64) → `type="text"` with regex `/^-?[0-9]+$/` (same JS precision pattern as existing 64-bit scalars in `ScalarField`).
- **D-11:** **Bool keys** → shadcn `Select` with "true" / "false" options. Consistent with `EnumField`'s Select approach. A bool key map can have at most 2 entries.

### Claude's Discretion
- Layout of each row (key | value | remove button alignment) — follow `RepeatedField` pattern
- Badge label for map fields — e.g., `<Badge variant="secondary" className="text-xs">map</Badge>` with key/value type annotation
- Default value for a new row's key when added — empty string / 0 / false depending on key type
- Whether to show the field name/label above the row list (follow `RepeatedField` pattern: label + "map" badge in header row)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Map Field — MFLD-01 through MFLD-05 (authoritative acceptance criteria)

### Existing Field Components (read before writing MapField)
- `src/components/form/fields/RepeatedField.tsx` — closest analog: `useFieldArray`, `renderItem` prop, Add/Remove buttons; MapField follows this pattern
- `src/components/form/fields/ScalarField.tsx` — key input Controller pattern + error display
- `src/components/form/fields/EnumField.tsx` — shadcn Select pattern (used for bool keys)
- `src/components/form/ProtoFormRenderer.tsx` — dispatch point; pre-dispatch branch for map goes here (FROZEN otherwise)

### Rust Files (must read before extending)
- `src-tauri/src/schema/types.rs` — add `Map { key_type: ScalarKind, value_kind: FieldKind }` variant to `FieldKind`
- `src-tauri/src/schema/extractor.rs` — add map detection via `is_map_entry()`; set `repeated: false` on map FieldSchema
- `src-tauri/src/commands/encode.rs` — add `Value::Map` encoding path (not `Value::List`)

### TypeScript Types
- `src/lib/types.ts` — add `{ type: "map"; key_type: ScalarKind; value_kind: FieldKind }` to `FieldKind` union

### Stack Constraints (from STATE.md)
- zod pinned to `^3.24.2` (not v4) — `@hookform/resolvers` incompatible with zod v4
- `ProtoFormRenderer` dispatch is **FROZEN** — add pre-dispatch branch only, do not restructure the switch
- `mode: onBlur` form-wide — per-field validation fires on blur
- `useFieldArray` rows keyed by `rhfField.id`, never by index (G-6 from RepeatedField)
- Base64 alphabet for bytes-typed map values: standard `+/` alphabet (from Phase 6 BytesField — BFLD-01 decision)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RepeatedField.tsx` — `useFieldArray({ control, name: path })`, `append` / `remove`, Add/Remove buttons; copy structure verbatim with key+value row shape
- `ScalarField.tsx` — `Controller` + `fieldState.error` display pattern for the key input
- shadcn `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` — available, used in `EnumField` for bool keys
- shadcn `Button` (variant="outline" size="sm" / variant="destructive" size="icon") — Add/Remove buttons
- shadcn `Badge` (variant="secondary") — "map" type label in field header

### Established Patterns
- `useFieldArray` + `rhfField.id` as React key (never index) — enforced by RepeatedField
- Single `Controller` per input field (not two Controllers) — key input + error display in one
- `<p className="text-xs text-destructive" role="alert">` for inline errors
- Prop-based `renderItem` / `renderValue` to avoid circular imports with `ProtoFormRenderer`
- `getDefaultItem()` for initializing new row values (follow RepeatedField pattern)

### Integration Points
- `ProtoFormRenderer.tsx:renderField` — add `if (field.kind.type === "map")` branch before the `switch` (after the bytes branch from Phase 6)
- `schema/extractor.rs:extract_field_schema` — detect `field.is_map()` or message `is_map_entry()`, emit `FieldKind::Map`
- `commands/encode.rs` — add `FieldKind::Map` match arm encoding rows as `Value::Map`

</code_context>

<specifics>
## Specific Ideas

- Hidden duplicate guard field name: `${path}.__mapDuplicateGuard` (unique per map field instance)
- "Add entry" button label (consistent with MFLD-01 wording): "Add entry"
- Bool key Select values: string literals `"true"` and `"false"` (not booleans) — consistent with how RHF stores form values as strings; Rust encoder converts to bool
- 64-bit key regex: `/^-?[0-9]+$/` (allow negative for signed; no negatives for uint/fixed types — same split as ScalarField)
- Row layout: `[key input] [value renderer] [remove button]` in a flex row with `gap-2`, matching RepeatedField's `flex items-start gap-2 p-2 border rounded` container

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 7-MapField*
*Context gathered: 2026-05-19*
