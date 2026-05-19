# Phase 7: MapField - Research

**Researched:** 2026-05-19
**Domain:** Proto map<K,V> fields — Rust extractor + encoder + React key-value row UI
**Confidence:** HIGH

## Summary

Phase 7 delivers `MapField` — a new field component for protobuf `map<K, V>` fields that renders as typed key-value rows with Add/Remove controls, duplicate-key validation, and correct binary wire-format encoding.

Three layers change: (1) the Rust schema extractor emits a new `FieldKind::Map` variant with extracted `key_type` and `value_kind`; (2) the Rust encoder adds a `Value::Map(HashMap<MapKey, Value>)` path (correcting CONTEXT.md D-03 which stated `BTreeMap` — `prost-reflect` 0.16.3 uses `HashMap`); (3) the React side adds `MapField.tsx` driven by `useFieldArray` with `{key, value}` row shape, a prop-injected `renderValue` for sub-renderers, and a hidden RHF Controller that keeps `formState.isValid` false while duplicate keys exist.

**Primary recommendation:** Follow the `RepeatedField` pattern exactly for the React layer — same `useFieldArray`, same `renderValue` prop pattern, same `rhfField.id` row keying — and add `field.is_map()` guards before the existing message and list branches in both the Rust extractor and encoder.

**CONTEXT.md correction (D-03):** `Value::Map` wraps `HashMap<MapKey, Value>` (not `BTreeMap`) per `prost-reflect` 0.16.3 docs. [VERIFIED: docs.rs/prost-reflect/0.16.3]

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New `FieldKind::Map { key_type: ScalarKind, value_kind: FieldKind }` variant added to both Rust `schema/types.rs` and TypeScript `types.ts`. `value_kind` reuses the existing `FieldKind` enum. Rust side: `#[serde(tag = "type", rename_all = "snake_case")]` already on the enum, so the variant serializes as `{ "type": "map", "key_type": "...", "value_kind": { ... } }`.
- **D-02:** Rust extractor sets `repeated: false` on map `FieldSchema`. `MapField` manages its own row array via `useFieldArray` internally.
- **D-03:** Encoder path: `encode.rs` must use `Value::Map(HashMap<MapKey, Value>)` (corrected from CONTEXT.md `BTreeMap` — verified `HashMap` in prost-reflect 0.16.3), NOT `Value::List`. Each `{key, value}` row from the frontend is encoded as one map entry.
- **D-04:** Duplicate detection lives in `MapField` component — a local check on key `onChange`. NOT a zod `.refine()` on the array (too late for inline UX).
- **D-05:** Error display: `<p className="text-xs text-destructive mt-1" role="alert">Duplicate key</p>` below the affected key input. Every row with a duplicate key shows the error.
- **D-06:** Send button blocking: `MapField` registers a hidden `Controller` with `${path}.__mapDuplicateGuard` name and a validate rule that returns an error string when `hasDuplicates` is true. Keeps `formState.isValid` false.
- **D-07:** `MapField` accepts `renderValue: RenderFieldFn` prop — same pattern as `RepeatedField.renderItem`. `ProtoFormRenderer` passes its own `renderField` as `renderValue`.
- **D-08:** Synthetic `FieldSchema` for value renderer per row: `{ name: \`${field.name}[${index}].value\`, label: "Value", kind: field.kind.value_kind, repeated: false }`. Path: `\`${path}.${index}.value\``.
- **D-09:** String keys → `type="text"` input.
- **D-10:** Integer keys (int32, uint32, sint32, fixed32, sfixed32) → `type="number"`. 64-bit keys (int64, uint64, sint64, fixed64, sfixed64) → `type="text"` with regex `/^-?[0-9]+$/` (signed) or `/^[0-9]+$/` (unsigned).
- **D-11:** Bool keys → shadcn `Select` with "true" / "false" string options. Stored as strings in RHF form state; Rust encoder converts to `MapKey::Bool`.

### Claude's Discretion

- Layout of each row (key | value | remove button alignment) — follow `RepeatedField` pattern
- Badge label for map fields — `<Badge variant="secondary" className="text-xs">map</Badge>` with key/value type annotation
- Default value for a new row's key when added — empty string / 0 / "false" depending on key type
- Whether to show the field name/label above the row list (follow `RepeatedField` pattern)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MFLD-01 | User can add and remove key-value row entries for a `map<K, V>` field | `useFieldArray` append/remove pattern — identical to `RepeatedField`; "Add entry" / Remove buttons |
| MFLD-02 | User sees the key input constrained to the declared proto key type | Key type dispatch table (D-09, D-10, D-11) based on `field.kind.key_type`; 6 ScalarKinds map to 3 input mechanisms |
| MFLD-03 | User sees an inline duplicate-key error and cannot send until keys are unique | onChange duplicate check; hidden `__mapDuplicateGuard` Controller; `role="alert"` error paragraph |
| MFLD-04 | User can fill in map values using the same field renderers as the rest of the form | `renderValue: RenderFieldFn` prop — same pattern as `RepeatedField.renderItem`; synthetic `FieldSchema` per row |
| MFLD-05 | User's map field encodes correctly as binary protobuf wire format when sent | `Value::Map(HashMap<MapKey, Value>)` path in encode.rs; `json_to_map_key` helper; `field.is_map()` guard before `is_list()` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Map field schema extraction | API / Backend (Rust) | — | `prost-reflect` descriptor introspection lives in Rust; `FieldDescriptor::is_map()` detects map fields at parse time |
| Map schema serialization to frontend | API / Backend (Rust) | Frontend (TypeScript types) | `FieldKind::Map` variant serialized via serde; TypeScript union must mirror it |
| Key-value row management | Frontend (React) | — | `useFieldArray` in `MapField.tsx` owns row add/remove; no Rust involvement |
| Duplicate-key validation | Frontend (React) | — | `onChange` handler in React; hidden RHF Controller for send-block signal |
| Binary protobuf encoding of map | API / Backend (Rust) | — | `Value::Map(HashMap<MapKey, Value>)` set on `DynamicMessage`; Rust encoder owns the wire format |

---

## Standard Stack

### Core (no new installs — all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prost-reflect` | 0.16.3 (locked) | `FieldDescriptor::is_map()`, `Value::Map`, `MapKey` | Already in Cargo.toml; this phase adds new paths in the same API |
| `react-hook-form` | 7.x (locked) | `useFieldArray` for row management; `Controller` for hidden guard | Already in package.json; proven pattern from `RepeatedField` |
| `zod` | ^3.24.2 (pinned) | Validate rule on hidden guard Controller | Pinned — do NOT upgrade to v4 |
| `shadcn/ui` (Select, Button, Badge, Input) | installed | Bool key Select, Add/Remove buttons, "map" badge | Already in project; no new installs |
| `lucide-react` (Plus, Trash2) | installed | Add/Remove button icons | Already in project |

### No new packages required for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
.proto file (user-provided)
        │
        ▼
[Rust: protox Compiler]
        │ FileDescriptorSet
        ▼
[Rust: prost-reflect DescriptorPool]
        │
        ├─ field.is_map()? ──YES──▶ [extractor.rs: FieldKind::Map { key_type, value_kind }]
        │                                    │
        │                         value_kind from map_entry_value_field().kind()
        │
        └─ field.is_list()? ─── repeated / scalar / message / enum / oneof
        
[Rust → IPC (serde_json)] ───▶ TypeScript FieldSchema (FieldKind with "map" type)

[ProtoFormRenderer.tsx]
  │ if field.kind.type === "map" (pre-dispatch branch)
  ▼
[MapField.tsx]
  ├─ useFieldArray → rows: [{key, value}, ...]
  ├─ key input (type per key_type: text/number/Select)
  │     └─ onChange → duplicate check → hasDuplicates state
  ├─ value renderer via renderValue(syntheticFieldSchema, path.N.value, depth)
  ├─ hidden Controller `${path}.__mapDuplicateGuard` → blocks formState.isValid
  └─ Add entry / Remove entry buttons

[formState values] ───IPC invoke encode_message──▶ [Rust encode.rs]
  │ form value arrives as JSON array: [{key: K, value: V}, ...]
  │
  ├─ field.is_map()? ──YES──▶ parse array → HashMap<MapKey, Value>
  │                                │ json_to_map_key() per row key
  │                                │ scalar_or_message_value() per row value
  │                                └─ dyn_msg.set_field(field, Value::Map(map))
  │
  └─ field.is_list()? ── existing repeated path (unchanged)
```

### Recommended Project Structure

No new directories — all files slot into existing structure:

```
src-tauri/src/
├── schema/
│   ├── types.rs       ← add FieldKind::Map variant
│   └── extractor.rs   ← add is_map() detection before Kind::Message arm
└── commands/
    └── encode.rs      ← add is_map() guard + Value::Map encoding path

src/
├── lib/
│   └── types.ts       ← add { type: "map"; key_type: ScalarKind; value_kind: FieldKind }
└── components/form/
    ├── fields/
    │   └── MapField.tsx    ← NEW
    └── ProtoFormRenderer.tsx  ← add pre-dispatch branch for "map" kind
```

### Pattern 1: Rust Extractor — Map Detection

**What:** Detect map fields via `FieldDescriptor::is_map()` before the existing `Kind::Message` match arm.

**When to use:** In `extract_field_kind()` in `extractor.rs`.

**Critical ordering:** The `is_map()` check MUST come before `field.kind()` match. Map fields have `Kind::Message(synthetic_entry_type)` — if not intercepted first, they fall through as nested messages.

**Note on `repeated`:** `FieldDescriptor::is_list()` returns false for map fields automatically (per docs). So the existing `let repeated = field.is_list()` in `extract_field_schema` already produces `repeated: false` for map fields — D-02 is satisfied for free. [VERIFIED: docs.rs/prost-reflect/0.16.3]

```rust
// Source: docs.rs/prost-reflect/0.16.3 FieldDescriptor + MessageDescriptor
fn extract_field_schema(field: &FieldDescriptor, oneof_group: Option<String>) -> FieldSchema {
    // is_map() must be checked BEFORE is_list() and before kind() match
    if field.is_map() {
        let map_entry_msg = match field.kind() {
            Kind::Message(m) => m,
            _ => unreachable!("map field always has Message kind"),
        };
        let key_field = map_entry_msg.map_entry_key_field();
        let val_field = map_entry_msg.map_entry_value_field();
        let key_type = extract_scalar_kind_from_field(&key_field);
        let value_kind = extract_field_kind_from_descriptor(&val_field);
        return FieldSchema {
            name: field.name().to_string(),
            label: to_label(field.name()),
            kind: FieldKind::Map { key_type, value_kind: Box::new(value_kind) },
            repeated: false, // is_list() returns false for maps; set explicitly per D-02
            oneof_group,
            default_value: None,
        };
    }
    let repeated = field.is_list();
    let kind = extract_field_kind(field);
    FieldSchema { name: field.name().to_string(), label: to_label(field.name()), kind, repeated, oneof_group, default_value: None }
}
```

**Note on `value_kind` boxing:** `FieldKind` is a recursive type when it contains another `FieldKind`. In Rust, recursive enum variants must use indirection (`Box<FieldKind>`) to avoid infinite size. Verify whether the existing `FieldKind` serde derive handles `Box` transparently — it does with default serde behavior.

### Pattern 2: Rust Types — FieldKind::Map Variant

```rust
// Source: src-tauri/src/schema/types.rs (existing enum, add variant)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldKind {
    Scalar { scalar: ScalarKind },
    Message { full_name: String },
    Enum { values: Vec<EnumValue> },
    Oneof { branches: Vec<Vec<FieldSchema>> },
    WellKnown { wkt: String },
    // NEW for Phase 7:
    Map { key_type: ScalarKind, value_kind: Box<FieldKind> },
}
```

Serializes as: `{ "type": "map", "key_type": "string", "value_kind": { "type": "scalar", "scalar": "int32" } }`.

### Pattern 3: Rust Encoder — Map Path

**Critical ordering:** `field.is_map()` guard MUST come before `field.is_list()` in `set_field_value`. Map fields match `field.is_list() == false` already, but conceptually the guard clarifies intent and prevents future regressions.

The frontend sends map rows as a JSON array: `[{key: "k1", value: 42}, {key: "k2", value: 99}]`. The encoder receives `JsonValue::Array` — NOT a JSON object. `as_object()` would silently produce empty.

```rust
// Source: docs.rs/prost-reflect/0.16.3 Value::Map + MapKey
fn set_field_value(dyn_msg: &mut DynamicMessage, field: &FieldDescriptor, json_val: &JsonValue) -> Result<(), AppError> {
    if json_val.is_null() { return Ok(()); }

    // Map fields: must come before is_list() check
    if field.is_map() {
        let arr = match json_val.as_array() {
            Some(a) => a,
            None => return Ok(()),
        };
        let mut map: std::collections::HashMap<prost_reflect::MapKey, Value> = std::collections::HashMap::new();
        for row in arr {
            let key_json = row.get("key").unwrap_or(&JsonValue::Null);
            let val_json = row.get("value").unwrap_or(&JsonValue::Null);
            let map_key = json_to_map_key(field, key_json)?;
            if let Some(val) = scalar_or_message_value_for_map_entry(field, val_json)? {
                map.insert(map_key, val);
            }
        }
        if !map.is_empty() {
            dyn_msg.set_field(field, Value::Map(map));
        }
        return Ok(());
    }

    if field.is_list() { /* existing repeated path */ }
    // ... rest of existing function unchanged
}

/// Convert a JSON key value to prost_reflect::MapKey.
/// Reuses existing parse_i32/i64/u32/u64 helpers.
fn json_to_map_key(field: &FieldDescriptor, key_json: &JsonValue) -> Result<prost_reflect::MapKey, AppError> {
    let map_entry = match field.kind() {
        Kind::Message(m) => m,
        _ => return Err(AppError::EncodeError { field: field.name().to_string(), message: "expected map entry message".into() }),
    };
    let key_field = map_entry.map_entry_key_field();
    let map_key = match key_field.kind() {
        Kind::String => prost_reflect::MapKey::String(key_json.as_str().unwrap_or("").to_string()),
        Kind::Bool => {
            let b = match key_json {
                JsonValue::Bool(b) => *b,
                JsonValue::String(s) => s == "true",
                _ => false,
            };
            prost_reflect::MapKey::Bool(b)
        }
        Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 => prost_reflect::MapKey::I32(parse_i32(key_json).unwrap_or(0)),
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 => prost_reflect::MapKey::I64(parse_i64(key_json).unwrap_or(0)),
        Kind::Uint32 | Kind::Fixed32 => prost_reflect::MapKey::U32(parse_u32(key_json).unwrap_or(0)),
        Kind::Uint64 | Kind::Fixed64 => prost_reflect::MapKey::U64(parse_u64(key_json).unwrap_or(0)),
        _ => return Err(AppError::EncodeError { field: field.name().to_string(), message: format!("unsupported map key kind: {:?}", key_field.kind()) }),
    };
    Ok(map_key)
}
```

### Pattern 4: TypeScript Type Addition

```typescript
// Source: src/lib/types.ts (existing FieldKind union, add case)
export type FieldKind =
  | { type: "scalar"; scalar: ScalarKind }
  | { type: "message"; full_name: string }
  | { type: "enum"; values: EnumValue[] }
  | { type: "oneof"; branches: FieldSchema[][] }
  | { type: "well_known"; wkt: "Timestamp" | "Duration" | string }
  // NEW for Phase 7:
  | { type: "map"; key_type: ScalarKind; value_kind: FieldKind };
```

No circular type issue — TypeScript resolves recursive `FieldKind` references without boxing.

### Pattern 5: ProtoFormRenderer Integration (pre-dispatch branch)

**FROZEN constraint:** `ProtoFormRenderer.tsx` dispatch switch is frozen. Add only a pre-dispatch `if` branch before the `switch`, following the Phase 6 bytes branch pattern.

```typescript
// Source: src/components/form/ProtoFormRenderer.tsx — after bytes branch, before switch
// Phase 7: map fields bypass switch — handled by MapField
if (field.kind.type === "map") {
  return (
    <MapField
      key={path}
      field={field}
      path={path}
      depth={depth}
      renderValue={renderField}
    />
  );
}
```

Also update `buildDefaultValues` to initialize map fields as empty array:
```typescript
case "map":
  defaults[field.name] = [];
  break;
```

### Pattern 6: MapField.tsx Component Structure

```typescript
// Source: established patterns from RepeatedField.tsx + ScalarField.tsx + EnumField.tsx
interface MapFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderValue: RenderFieldFn;
}

export function MapField({ field, path, depth, renderValue }: MapFieldProps) {
  const { control, register, setValue, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: path });
  const [hasDuplicates, setHasDuplicates] = useState(false);

  if (field.kind.type !== "map") return null;
  const { key_type, value_kind } = field.kind;

  // Compute duplicate keys from watched rows
  // Fires on onChange of key inputs — not deferred to blur (D-04)
  const rows = watch(path) as Array<{ key: unknown; value: unknown }> | undefined;
  const duplicateSet = useMemo(() => {
    const keys = (rows ?? []).map(r => String(r?.key ?? ""));
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const k of keys) { if (seen.has(k)) { dupes.add(k); } else { seen.add(k); } }
    return dupes;
  }, [rows]);

  useEffect(() => {
    setHasDuplicates(duplicateSet.size > 0);
  }, [duplicateSet]);

  // Hidden guard Controller — keeps formState.isValid false while duplicates exist (D-06)
  // ... Controller with name `${path}.__mapDuplicateGuard`
}
```

### Anti-Patterns to Avoid

- **Do NOT use `as_object()` in the Rust encoder for map values:** The frontend sends an array `[{key, value}]`, not a JSON object. `as_object()` will return `None` and silently encode an empty map.
- **Do NOT check `field.is_list()` before `field.is_map()`:** `is_map()` must come first in `set_field_value`. Although `is_list()` returns false for maps, placing `is_map()` first is the correct, explicit, and future-safe ordering.
- **Do NOT check `field.kind()` match before `field.is_map()` in extractor:** Map fields present as `Kind::Message(entry_type)`. If `extract_field_kind` runs first, they emit as a nested message pointing at a synthetic `XxxEntry` type.
- **Do NOT store map rows as Record/Object in React:** State.md: "map rows stored as `Array<{key, value}>` via useFieldArray — never as Record<K,V> (silent JS deduplication)".
- **Do NOT use rhfField index as React key:** Use `rhfField.id` (useFieldArray guarantee) — established in RepeatedField (G-6 pattern).
- **Do NOT apply `repeated: true` to the FieldSchema used by `renderValue`:** D-08 specifies `repeated: false` on the synthetic field — prevents `ProtoFormRenderer` double-wrapping in `RepeatedField`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row add/remove with stable identity | Manual array management | `useFieldArray` (RHF) | Handles stable field IDs, React reconciliation; manual arrays cause key collisions on reorder |
| Duplicate-key detection data structure | Custom linked list / sorted comparison | Local `Set` + `Array.map` | O(n) scan is fine; n is small (map entries); simpler is correct here |
| Send-button blocking signal | Zustand store coupling | Hidden RHF `Controller` with validate rule | Keeps `formState.isValid` false automatically; no store coupling needed |
| Protobuf map wire encoding | Manual byte construction | `prost-reflect Value::Map + DynamicMessage.set_field` | prost-reflect handles protobuf wire format complexity including field tag encoding for map entries |

---

## Common Pitfalls

### Pitfall 1: Map Field Classified as Nested Message

**What goes wrong:** Extractor emits `FieldKind::Message { full_name: "XxxEntry" }` instead of `FieldKind::Map`. The form renders a nested message sub-form for the synthetic map entry type.

**Why it happens:** `field.kind()` match runs before `field.is_map()` check. Map fields have `Kind::Message(synthetic_entry)` underneath.

**How to avoid:** Place `if field.is_map() { ... return; }` as the very first branch in `extract_field_schema`, before `let kind = extract_field_kind(field)`.

**Warning signs:** Map field renders with a nested message sub-form showing "key" and "value" sub-fields instead of key-value row controls.

### Pitfall 2: Encoder Receives JSON Array but Calls `as_object()`

**What goes wrong:** Map encodes as empty; no error is shown.

**Why it happens:** The frontend stores map rows as `Array<{key, value}>` via `useFieldArray`. IPC sends a JSON array. The encoder pattern from `populate_message` uses `as_object()` — but that applies to message fields, not map fields. `JsonValue::Array.as_object()` returns `None`, skipping all rows silently.

**How to avoid:** In `set_field_value`, use `json_val.as_array()` inside the `field.is_map()` branch.

**Warning signs:** Map appears to encode without error but the binary payload contains no map entries when decoded.

### Pitfall 3: Value::Map Uses HashMap, Not BTreeMap

**What goes wrong:** Code fails to compile or produces wrong result if `BTreeMap` is used.

**Why it happens:** CONTEXT.md D-03 stated `BTreeMap` but `prost-reflect` 0.16.3 uses `HashMap<MapKey, Value>` for `Value::Map`. [VERIFIED: docs.rs/prost-reflect/0.16.3]

**How to avoid:** Use `std::collections::HashMap<prost_reflect::MapKey, Value>` when constructing the map to pass to `Value::Map(...)`.

**Warning signs:** Compile error: `mismatched types: expected HashMap, found BTreeMap`.

### Pitfall 4: Duplicate Detection Deferred to Blur Mode

**What goes wrong:** Duplicate key errors only appear after the user clicks away from the key input (blur), not while typing/immediately on key change.

**Why it happens:** The form-wide `mode: "onBlur"` applies to zod validation. Duplicate detection per D-04 must fire on `onChange` independently.

**How to avoid:** Implement duplicate detection in a `useEffect` watching the `rows` from `watch(path)`, or via `onChange` on each key input — NOT through zod `.refine()`. The two validation systems (zod schema on blur, duplicate check on change) coexist intentionally.

**Warning signs:** User types the same key twice; no duplicate error appears until they blur out of the second key input.

### Pitfall 5: Recursive FieldKind Type in Rust Requires Box

**What goes wrong:** Rust compiler error: "recursive type has infinite size".

**Why it happens:** `FieldKind::Map { value_kind: FieldKind }` creates a recursive enum. Rust enums must have known size at compile time; recursive variants require heap indirection.

**How to avoid:** Use `Box<FieldKind>` for `value_kind` in the `Map` variant: `Map { key_type: ScalarKind, value_kind: Box<FieldKind> }`.

**Warning signs:** `error[E0072]: recursive type 'FieldKind' has infinite size`.

### Pitfall 6: ProtoFormRenderer `buildDefaultValues` Misses Map Case

**What goes wrong:** Map fields have `undefined` or `null` initial value instead of `[]`. `useFieldArray` initialized on `null` can throw or behave erratically.

**Why it happens:** `buildDefaultValues` switch has no `"map"` case; falls through to `default` which sets `null`.

**How to avoid:** Add `case "map": defaults[field.name] = []; break;` to the `buildDefaultValues` switch.

**Warning signs:** Console error from `useFieldArray` on mount about non-array initial value.

### Pitfall 7: Empty String Key Not Handled Consistently

**What goes wrong:** An empty-string key (user adds a row but doesn't type anything in the key input) causes unexpected behavior — either silent drop or spurious "Duplicate key" when two empty-key rows exist.

**Why it happens:** Empty string is a valid `MapKey::String("")` in protobuf. Two empty-key rows are genuinely duplicate. The duplicate check covers this case correctly if string comparison uses `String(row?.key ?? "")`.

**How to avoid:** Include the row in the map (do NOT silently skip empty-key rows). The duplicate-key check naturally blocks send when two empty-key rows exist.

---

## Code Examples

### Verified: MapKey Variants (prost-reflect 0.16.3)

```rust
// Source: docs.rs/prost-reflect/0.16.3/prost_reflect/enum.MapKey.html
// All 6 valid map key variants (proto3 spec — float/double/bytes/enum/message are illegal):
prost_reflect::MapKey::Bool(bool)
prost_reflect::MapKey::I32(i32)   // int32, sint32, sfixed32
prost_reflect::MapKey::I64(i64)   // int64, sint64, sfixed64
prost_reflect::MapKey::U32(u32)   // uint32, fixed32
prost_reflect::MapKey::U64(u64)   // uint64, fixed64
prost_reflect::MapKey::String(String)
```

### Verified: is_map() on FieldDescriptor

```rust
// Source: docs.rs/prost-reflect/0.16.3
// is_map() — "cardinality is Repeated AND field type is a message where is_map_entry() returns true"
// is_list() — "cardinality is Repeated AND is_map() returns false"
// → for map fields: is_map()=true, is_list()=false, is_list() will NOT double-fire
if field.is_map() {
    // Map branch
} else if field.is_list() {
    // Repeated branch
}
```

### Verified: Map Entry Descriptor Access

```rust
// Source: docs.rs/prost-reflect/0.16.3 MessageDescriptor
let entry_msg = match field.kind() { Kind::Message(m) => m, _ => unreachable!() };
let key_field: FieldDescriptor = entry_msg.map_entry_key_field();   // panics if !is_map_entry()
let val_field: FieldDescriptor = entry_msg.map_entry_value_field(); // panics if !is_map_entry()
```

### Verified: Select Mock Pattern for Bool Key Tests (jsdom)

```typescript
// Source: src/components/form/__tests__/EnumField.test.tsx (established project pattern)
// Radix UI Select is incompatible with jsdom pointer events.
// Mock with native <select> in test files — same pattern used for EnumField.
vi.mock("@/components/ui/select", () => ({
  Select: MockSelect, SelectTrigger: MockSelectTrigger,
  SelectContent: MockSelectContent, SelectItem: MockSelectItem, SelectValue: MockSelectValue,
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Proto map via JSON object | Proto map via `useFieldArray` array `[{key, value}]` | Phase 7 design decision | Prevents silent JS key deduplication; allows duplicate-key detection |
| `BTreeMap` (CONTEXT.md D-03) | `HashMap<MapKey, Value>` | Corrected via docs verification | Must use `HashMap` in encoder — `BTreeMap` won't compile with `Value::Map` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Box<FieldKind>` for `value_kind` in the Rust `Map` variant is the correct indirection approach | Architecture Patterns / Pattern 1 | Could use `Arc` or enum flattening instead; `Box` is simplest and idiomatic for this case |
| A2 | `FieldDescriptor::is_map()` is available on the `FieldDescriptor` type (not just on `MessageDescriptor`) | Common Pitfalls / Pitfall 1 | If only on `MessageDescriptor`, extractor approach changes slightly — but docs confirm it is on `FieldDescriptor` [VERIFIED] |

---

## Open Questions

1. **`value_kind` boxing — serde compatibility**
   - What we know: `Box<FieldKind>` with `#[derive(Serialize, Deserialize)]` is transparent in serde — the box is invisible to JSON output.
   - What's unclear: Whether the existing `#[serde(tag = "type", rename_all = "snake_case")]` on `FieldKind` interacts unexpectedly with `Box<FieldKind>` as a field type.
   - Recommendation: Compile and test serialization in Wave 0 / Task 1 before proceeding to React layer.

2. **Value sub-renderer for map values that are themselves messages**
   - What we know: D-08 specifies the synthetic FieldSchema uses `kind: field.kind.value_kind` and `repeated: false`. For message-typed values, `renderValue` will recurse into `NestedMessageField`.
   - What's unclear: Depth tracking — the `depth` argument passed to `renderValue` should be `depth + 1` (not `depth`) to count the map field as one level of nesting.
   - Recommendation: Pass `depth + 1` to `renderValue` inside MapField, matching how `NestedMessageField` increments depth for its children.

---

## Security Domain

> Security enforcement is enabled (absent = enabled in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod validate rule on key input; duplicate guard Controller; Rust encoder defensively handles unknown key kind |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via `__proto__` or `constructor` as map key | Tampering | Using `useFieldArray` array shape (not `Record<K,V>`) prevents prototype pollution; Rust `HashMap<MapKey, Value>` is not susceptible |
| Unbounded map growth | Denial of Service | No hard cap imposed by proto3; acceptable for dev tool — map size is limited by user intent, not automated input |

---

## Sources

### Primary (HIGH confidence)

- `docs.rs/prost-reflect/0.16.3/prost_reflect/enum.Value.html` — `Value::Map(HashMap<MapKey, Value>)` confirmed
- `docs.rs/prost-reflect/0.16.3/prost_reflect/enum.MapKey.html` — all 6 variants confirmed
- `docs.rs/prost-reflect/0.16.3/prost_reflect/struct.FieldDescriptor.html` — `is_map()`, `is_list()` confirmed
- `docs.rs/prost-reflect/0.16.3/prost_reflect/struct.MessageDescriptor.html` — `is_map_entry()`, `map_entry_key_field()`, `map_entry_value_field()` confirmed
- `src-tauri/src/schema/types.rs` — existing `FieldKind` enum and `ScalarKind` enum [VERIFIED: codebase]
- `src-tauri/src/schema/extractor.rs` — existing extractor pattern including `is_list()` usage [VERIFIED: codebase]
- `src-tauri/src/commands/encode.rs` — existing encoder including `set_field_value`, `scalar_or_message_value`, parse helpers [VERIFIED: codebase]
- `src/lib/types.ts` — existing `FieldKind` TypeScript union [VERIFIED: codebase]
- `src/components/form/fields/RepeatedField.tsx` — `useFieldArray` row pattern [VERIFIED: codebase]
- `src/components/form/fields/ScalarField.tsx` — Controller + error display pattern [VERIFIED: codebase]
- `src/components/form/fields/EnumField.tsx` — shadcn Select pattern for discrete values [VERIFIED: codebase]
- `src/components/form/ProtoFormRenderer.tsx` — frozen dispatch + bytes pre-dispatch branch pattern [VERIFIED: codebase]
- `src/components/form/__tests__/EnumField.test.tsx` — Select mock pattern for jsdom [VERIFIED: codebase]
- `.planning/config.json` — `nyquist_validation: false` confirmed [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

- `07-CONTEXT.md` decisions D-01 through D-11 — user-locked design decisions (D-03 corrected to `HashMap`)
- `07-UI-SPEC.md` — approved layout, spacing, color, copywriting contracts

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all existing libraries verified in codebase
- Architecture: HIGH — prost-reflect API verified via official docs; React pattern cloned from existing RepeatedField/ScalarField
- Pitfalls: HIGH — ordering requirements verified against prost-reflect docs; form-value shape verified against STATE.md
- One correction of CONTEXT.md D-03 (BTreeMap → HashMap): [VERIFIED: docs.rs]

**Research date:** 2026-05-19
**Valid until:** 2026-07-19 (prost-reflect API is stable; react-hook-form is stable)
