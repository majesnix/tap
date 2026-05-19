# Phase 7: MapField - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 8 (5 modified, 2 new, 1 new test)
**Analogs found:** 7 / 8 (hidden-guard Controller has no exact analog — see No Analog Found)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/schema/types.rs` | model | transform | itself (existing `FieldKind` enum, lines 27-35) | exact |
| `src-tauri/src/schema/extractor.rs` | service | transform | itself (existing `extract_field_schema`, lines 105-117; `extract_field_kind`, lines 119-186) | exact |
| `src-tauri/src/commands/encode.rs` | service | request-response | itself (existing `is_list()` branch, lines 106-123; parse helpers, lines 252-272) | exact |
| `src/lib/types.ts` | model | transform | itself (existing `FieldKind` union, lines 20-25) | exact |
| `src/components/form/ProtoFormRenderer.tsx` | component | request-response | itself (bytes pre-dispatch branch lines 145-148; `buildDefaultValues` switch lines 42-79) | exact |
| `src/components/form/fields/MapField.tsx` | component | event-driven | `RepeatedField.tsx` (primary); `ScalarField.tsx` (secondary); `EnumField.tsx` (bool key) | role-match |
| `src/components/form/__tests__/MapField.test.tsx` | test | — | `RepeatedField.test.tsx` (structure); `EnumField.test.tsx` lines 7-82 (Select mock) | role-match |
| `src-tauri/src/commands/encode.rs` `#[cfg(test)]` cases | test | — | `encode.rs` tests, lines 332-436 | exact |

---

## Pattern Assignments

### `src-tauri/src/schema/types.rs` (model, transform)

**Analog:** itself — existing `FieldKind` enum at lines 27-35 and `ScalarKind` enum at lines 37-55.

**Core pattern — add one variant to `FieldKind`** (after `WellKnown`):
```rust
// src-tauri/src/schema/types.rs lines 27-35 — existing enum shape to match:
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldKind {
    Scalar { scalar: ScalarKind },
    // ... existing variants ...
    WellKnown { wkt: String },
    // ADD:
    Map { key_type: ScalarKind, value_kind: Box<FieldKind> },
}
```

**Critical notes:**
- `value_kind: Box<FieldKind>` is mandatory — recursive enum variant requires heap indirection (`error[E0072]` otherwise). See RESEARCH.md Pitfall 5.
- `#[serde(tag = "type", rename_all = "snake_case")]` is already present; serde treats `Box<FieldKind>` transparently — JSON output is `{ "type": "map", "key_type": "string", "value_kind": { ... } }`.
- `ScalarKind` (lines 37-55) is reused as-is for `key_type` — no new type needed.

---

### `src-tauri/src/schema/extractor.rs` (service, transform)

**Analog:** itself — `extract_field_schema` at lines 105-117, `extract_field_kind` at lines 119-186.

**Insertion point — `extract_field_schema` (lines 105-117):**

Add an `is_map()` guard as the very first branch, before `let repeated = field.is_list()` (line 106). This is critical: map fields present as `Kind::Message(synthetic_entry)` — without this guard they fall through as nested messages (RESEARCH.md Pitfall 1).

```rust
// INSERT before line 106:
if field.is_map() {
    let map_entry_msg = match field.kind() {
        Kind::Message(m) => m,
        _ => unreachable!("map field always has Message kind"),
    };
    let key_field = map_entry_msg.map_entry_key_field();
    let val_field = map_entry_msg.map_entry_value_field();
    let value_kind = extract_field_kind(&val_field);
    let key_type = match extract_field_kind(&key_field) {
        FieldKind::Scalar { scalar } => scalar,
        _ => unreachable!("proto3 spec: map key must be scalar"),
    };
    return FieldSchema {
        name: field.name().to_string(),
        label: to_label(field.name()),
        kind: FieldKind::Map { key_type, value_kind: Box::new(value_kind) },
        repeated: false,
        oneof_group,
        default_value: None,
    };
}
// EXISTING line 106 stays as-is:
let repeated = field.is_list();
```

**`extract_field_kind` reuse (lines 119-186):** Call `extract_field_kind(&val_field)` for `value_kind` — the function already handles all `Kind` variants. No duplication.

**`extract_schema` filter (lines 27-43):** The `filter(|m| !m.full_name().starts_with("google.protobuf."))` already excludes synthetic map-entry messages from the top-level schema output — no change needed.

**Imports to add:** None. `Kind::Message` is already imported (line 1); `FieldKind::Map` is in the same `super::types` import (line 4).

---

### `src-tauri/src/commands/encode.rs` (service, request-response)

**Analog:** itself — `is_list()` branch at lines 106-123 for structural shape; parse helpers `parse_i32/i64/u32/u64` at lines 252-272 for reuse in `json_to_map_key`.

**Insertion point — `set_field_value` (lines 97-130):**

Add `is_map()` guard before the existing `is_list()` check at line 106. Frontend sends `Array<{key, value}>` — use `as_array()`, NOT `as_object()` (RESEARCH.md Pitfall 2).

```rust
// INSERT at start of set_field_value, before line 106 (is_list check):
if field.is_map() {
    let arr = match json_val.as_array() {
        Some(a) => a,
        None => return Ok(()),
    };
    let mut map: std::collections::HashMap<prost_reflect::MapKey, Value> =
        std::collections::HashMap::new();
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
// EXISTING line 106 stays:
if field.is_list() { ... }
```

**New helper — `json_to_map_key`:** Place after `set_field_value`. Reuses existing `parse_i32/i64/u32/u64` helpers (lines 252-272) verbatim:

```rust
fn json_to_map_key(field: &FieldDescriptor, key_json: &JsonValue) -> Result<prost_reflect::MapKey, AppError> {
    let map_entry = match field.kind() {
        Kind::Message(m) => m,
        _ => return Err(AppError::EncodeError { field: field.name().to_string(), message: "expected map entry message".into() }),
    };
    let key_field = map_entry.map_entry_key_field();
    match key_field.kind() {
        Kind::String => Ok(prost_reflect::MapKey::String(key_json.as_str().unwrap_or("").to_string())),
        Kind::Bool => {
            let b = match key_json {
                JsonValue::Bool(b) => *b,
                JsonValue::String(s) => s == "true",
                _ => false,
            };
            Ok(prost_reflect::MapKey::Bool(b))
        }
        Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 => Ok(prost_reflect::MapKey::I32(parse_i32(key_json).unwrap_or(0))),
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 => Ok(prost_reflect::MapKey::I64(parse_i64(key_json).unwrap_or(0))),
        Kind::Uint32 | Kind::Fixed32 => Ok(prost_reflect::MapKey::U32(parse_u32(key_json).unwrap_or(0))),
        Kind::Uint64 | Kind::Fixed64 => Ok(prost_reflect::MapKey::U64(parse_u64(key_json).unwrap_or(0))),
        _ => Err(AppError::EncodeError { field: field.name().to_string(), message: format!("unsupported map key kind: {:?}", key_field.kind()) }),
    }
}
```

**New helper — `scalar_or_message_value_for_map_entry`:** For map value encoding, get the value `FieldDescriptor` from the map entry message and delegate to existing `scalar_or_message_value`. The map entry's value field is `map_entry.map_entry_value_field()`.

**Import to add:** `prost_reflect::MapKey` — add to the existing `use prost_reflect::` import at line 3.

**Test cases to add** (analog: existing `#[cfg(test)]` block, lines 332-436):
- `test_encode_map_string_key_scalar_value` — uses `make_pool_with_schema` helper (line 336)
- `test_encode_map_int32_key` — verifies integer key path
- `test_encode_map_bool_key` — verifies string `"true"/"false"` conversion
- `test_encode_map_empty_array` — verifies empty map encodes as absent field

---

### `src/lib/types.ts` (model, transform)

**Analog:** itself — `FieldKind` union at lines 20-25.

**Edit — add one union member** (after `well_known` case, line 25):

```typescript
// src/lib/types.ts lines 20-25 — existing union to extend:
export type FieldKind =
  | { type: "scalar"; scalar: ScalarKind }
  | { type: "message"; full_name: string }
  | { type: "enum"; values: EnumValue[] }
  | { type: "oneof"; branches: FieldSchema[][] }
  | { type: "well_known"; wkt: "Timestamp" | "Duration" | string }
  // ADD:
  | { type: "map"; key_type: ScalarKind; value_kind: FieldKind };
```

No `Box` needed in TypeScript — recursive `FieldKind` reference is resolved structurally.

---

### `src/components/form/ProtoFormRenderer.tsx` (component, request-response)

**Analog:** itself — two distinct edit points.

**Edit point 1 — pre-dispatch branch in `renderField`:**

Insert after the bytes pre-dispatch branch at lines 145-148. Pattern: same `if` check shape as the bytes branch.

```typescript
// src/components/form/ProtoFormRenderer.tsx lines 145-148 — bytes branch to mirror:
if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
  return <BytesField key={path} field={field} path={path} />;
}
// ADD immediately after:
if (field.kind.type === "map") {
  return (
    <MapField key={path} field={field} path={path} depth={depth} renderValue={renderField} />
  );
}
```

Also add `import { MapField } from "./fields/MapField";` to the import block (lines 1-10) — matching the pattern of the other field imports.

**Edit point 2 — `buildDefaultValues` switch (lines 42-79):**

Add a `"map"` case before the `default` fallthrough. Pattern: follows the `"oneof"` case at lines 68-73.

```typescript
// ADD inside the switch at lines 42-79, after "well_known" case:
case "map":
  defaults[field.name] = [];
  break;
```

Without this, `useFieldArray` in `MapField` will receive `null` as initial value and throw (RESEARCH.md Pitfall 6).

---

### `src/components/form/fields/MapField.tsx` (component, event-driven) — NEW

**Primary analog:** `RepeatedField.tsx` (entire file, 67 lines). Copy structure verbatim; replace single `renderItem` slot with key input + `renderValue` slot side by side.

**Imports pattern** (mirror `RepeatedField.tsx` lines 1-5, extend with additional hooks):
```typescript
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { FieldSchema, RenderFieldFn, ScalarKind } from "@/lib/types";
```

**Props interface** (mirror `RepeatedFieldProps`, lines 7-12, rename prop `renderItem` → `renderValue`):
```typescript
interface MapFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderValue: RenderFieldFn;
}
```

**`useFieldArray` setup** (mirror `RepeatedField.tsx` lines 19-23):
```typescript
const { control, watch } = useFormContext();
const { fields, append, remove } = useFieldArray({ control, name: path });
```

**Row layout** (mirror `RepeatedField.tsx` lines 32-53, add key input before value renderer):
```typescript
{fields.map((rhfField, index) => (
  // ALWAYS use rhfField.id — never index (G-6, RepeatedField.tsx line 34)
  <div key={rhfField.id} className="flex items-start gap-2 p-2 border rounded">
    <div className="shrink-0">{/* key input — see key input pattern */}</div>
    <div className="flex-1">
      {renderValue(
        { name: `${field.name}[${index}].value`, label: "Value", kind: field.kind.value_kind, repeated: false },
        `${path}.${index}.value`,
        depth + 1  // increment depth — prevents MAX_DEPTH bypass for deep nested values
      )}
    </div>
    <Button type="button" variant="destructive" size="icon"
      onClick={() => remove(index)} aria-label="Remove entry" className="shrink-0 mt-1">
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
))}
```

**Synthetic FieldSchema for value renderer** (D-08 — mirrors `RepeatedField.tsx` lines 36-40):
- `name`: `` `${field.name}[${index}].value` ``
- `label`: `"Value"`
- `kind`: `field.kind.value_kind` (from destructured `Map` kind)
- `repeated`: `false` — prevents double-wrap in `RepeatedField`

**Key input pattern per `key_type`** (analog: `ScalarField.tsx` lines 72-84 for type dispatch; `EnumField.tsx` lines 41-62 for Select):
- `"string"` → `<Input type="text" />`
- `"int32" | "uint32" | "sint32" | "fixed32" | "sfixed32"` → `<Input type="number" />`
- `"int64" | "sint64" | "sfixed64"` → `<Input type="text" />` with regex validate `/^-?[0-9]+$/`
- `"uint64" | "fixed64"` → `<Input type="text" />` with regex validate `/^[0-9]+$/`
- `"bool"` → `<Select>` with `"true"` / `"false"` string options (mirror `EnumField.tsx` lines 41-62 Select pattern)

Wrap key input in a `Controller` (mirror `ScalarField.tsx` lines 146-186): one `Controller` per key input, with `rules={{ validate }}` and `fieldState.error` display.

**Duplicate-key detection** (D-04, onChange — no codebase analog, see No Analog Found):
```typescript
const rows = watch(path) as Array<{ key: unknown; value: unknown }> | undefined;
const duplicateSet = useMemo(() => {
  const keys = (rows ?? []).map(r => String(r?.key ?? ""));
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const k of keys) { if (seen.has(k)) dupes.add(k); else seen.add(k); }
  return dupes;
}, [rows]);
useEffect(() => { setHasDuplicates(duplicateSet.size > 0); }, [duplicateSet]);
```

**Error display per duplicate row** (D-05 — mirror `ScalarField.tsx` lines 179-183):
```typescript
{duplicateSet.has(String(rowKey)) && (
  <p className="text-xs text-destructive mt-1" role="alert">Duplicate key</p>
)}
```

**Header row** (mirror `RepeatedField.tsx` lines 27-30):
```typescript
<div className="flex items-center gap-2 mb-3">
  <Badge variant="secondary" className="text-xs">map</Badge>
  <span className="text-sm font-semibold">{field.label}</span>
</div>
```

**Add entry button** (mirror `RepeatedField.tsx` lines 55-64, label: "Add entry" per MFLD-01):
```typescript
<Button type="button" variant="outline" size="sm" onClick={() => append(getDefaultRow())} className="self-start">
  <Plus className="w-4 h-4 mr-1" />
  Add entry
</Button>
```

**Default row factory** (mirror `RepeatedField.tsx` line 23 `getDefaultItem`):
```typescript
const getDefaultRow = () => ({
  key: key_type === "bool" ? "false" : key_type.startsWith("int") || key_type.startsWith("uint") || key_type.startsWith("sint") || key_type.startsWith("fixed") || key_type.startsWith("sfixed") ? 0 : "",
  value: field.default_value ?? "",
});
```

---

### `src/components/form/__tests__/MapField.test.tsx` (test) — NEW

**Primary analog:** `RepeatedField.test.tsx` (entire file, 58 lines) — copy test harness structure.

**Test harness pattern** (mirror `RepeatedField.test.tsx` lines 19-36):
```typescript
function renderMap(field: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { [field.name]: [] } });
    return (
      <FormProvider {...methods}>
        <MapField
          field={field}
          path={field.name}
          depth={0}
          renderValue={(_f, itemPath) => <input key={itemPath} data-testid={itemPath} type="text" />}
        />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}
```

**Select mock for bool key tests** — copy the entire mock block from `EnumField.test.tsx` lines 7-82 (MockSelect, MockSelectTrigger, MockSelectContent, MockSelectItem, MockSelectValue + `vi.mock`). Required because Radix UI Select is incompatible with jsdom pointer events.

**Required test cases** (80% coverage rule):
- `"renders empty list initially with Add entry button"` — mirror `RepeatedField.test.tsx` line 38
- `"clicking Add entry appends a new row with key and value inputs"` — mirror line 43
- `"clicking remove deletes the row"` — mirror line 50
- `"shows duplicate key error when two rows have the same key"` — unique to MapField; use `userEvent.type` to set same key value on two rows, assert `role="alert"` is visible
- `"hides duplicate key error when keys differ"` — follow-up to above
- `"renders Select for bool key_type"` — uses the Select mock

---

## Shared Patterns

### useFieldArray + rhfField.id row keying (G-6)
**Source:** `src/components/form/fields/RepeatedField.tsx` line 34
**Apply to:** `MapField.tsx` — all row `key` props MUST use `rhfField.id`, never the index
```typescript
// RepeatedField.tsx line 34:
<div key={rhfField.id} className="flex items-start gap-2 p-2 border rounded">
```

### renderItem / renderValue prop injection (avoids circular imports)
**Source:** `src/components/form/fields/RepeatedField.tsx` lines 11, 19, 36-40
**Apply to:** `MapField.tsx` — `renderValue` prop receives `ProtoFormRenderer`'s `renderField`
```typescript
// RepeatedField.tsx lines 36-40 — synthetic FieldSchema shape to mirror for value renderer:
renderItem(
  { ...field, repeated: false, name: `${field.name}[${index}]` },
  `${path}.${index}`,
  depth
)
```
MapField variant: `{ name: \`${field.name}[${index}].value\`, label: "Value", kind: field.kind.value_kind, repeated: false }`, path `\`${path}.${index}.value\``, depth `depth + 1`.

### Controller + validate + fieldState.error display
**Source:** `src/components/form/fields/ScalarField.tsx` lines 146-186
**Apply to:** `MapField.tsx` key input Controller; hidden duplicate-guard Controller
```typescript
// ScalarField.tsx lines 146-152 — Controller shape:
<Controller
  name={path}
  control={control}
  defaultValue={defaultValue}
  rules={{ validate }}
  render={({ field: rhfField, fieldState }) => ( ... )}
/>
```
Error display (line 179-183):
```typescript
{fieldState.error && (
  <p className="text-xs text-destructive" role="alert">
    {field.label}: {fieldState.error.message}
  </p>
)}
```

### shadcn Select for discrete value inputs
**Source:** `src/components/form/fields/EnumField.tsx` lines 41-62
**Apply to:** `MapField.tsx` bool key input
```typescript
// EnumField.tsx lines 41-62 — Select + Controller pattern:
<Controller name={path} control={control} defaultValue={defaultNumber}
  render={({ field: rhfField }) => (
    <Select value={String(rhfField.value)} onValueChange={(strVal) => rhfField.onChange(strVal)}>
      <SelectTrigger id={path}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="true">true</SelectItem>
        <SelectItem value="false">false</SelectItem>
      </SelectContent>
    </Select>
  )}
/>
```
Note: for bool keys, `onValueChange` stores string `"true"/"false"` (not boolean) — Rust encoder converts via `s == "true"`.

### Pre-dispatch if-branch pattern in ProtoFormRenderer
**Source:** `src/components/form/ProtoFormRenderer.tsx` lines 145-148
**Apply to:** Phase 7 map pre-dispatch branch — identical structure
```typescript
// ProtoFormRenderer.tsx lines 145-148 — bytes branch to match:
if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
  return <BytesField key={path} field={field} path={path} />;
}
```

### is_list() / is_map() ordering in Rust encoder
**Source:** `src-tauri/src/commands/encode.rs` lines 106-123
**Apply to:** `encode.rs` `set_field_value` — `is_map()` guard MUST precede `is_list()` guard (RESEARCH.md Pitfall 2 and Anti-patterns)

### Rust test harness with temp-file pool
**Source:** `src-tauri/src/commands/encode.rs` lines 336-349
**Apply to:** New `#[cfg(test)]` map encoding tests — reuse `make_pool_with_schema` helper exactly

---

## No Analog Found

| File | Role | Specific Sub-pattern | Reason |
|------|------|----------------------|--------|
| `src/components/form/fields/MapField.tsx` | component | Hidden duplicate-guard `Controller` with `${path}.__mapDuplicateGuard` name and `validate` rule (D-06) | No field component in the codebase currently registers a hidden RHF Controller purely to block `formState.isValid`. Closest shape: `ScalarField.tsx` Controller with `rules.validate` (lines 146-154) — but that is visible, not hidden. Use RESEARCH.md Pattern 6 directly for this sub-pattern. |

---

## Metadata

**Analog search scope:** `src/components/form/fields/`, `src/lib/`, `src-tauri/src/schema/`, `src-tauri/src/commands/`, `src/components/form/__tests__/`
**Files scanned:** 11
**Pattern extraction date:** 2026-05-19
