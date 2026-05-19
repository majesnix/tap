---
phase: 07-mapfield
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src-tauri/src/commands/encode.rs
  - src-tauri/src/schema/extractor.rs
  - src-tauri/src/schema/types.rs
  - src/components/form/__tests__/MapField.test.tsx
  - src/components/form/fields/MapField.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/lib/types.ts
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase implements `MapField` support end-to-end: schema extraction (`extractor.rs`), encode path (`encode.rs`), the React component (`MapField.tsx`), integration into `ProtoFormRenderer.tsx`, and shared types (`types.ts`, `schema/types.rs`).

The core logic is structurally sound. The `is_map()` guard before `is_list()` is correct. The `useFieldArray` + `useWatch` dupe-key detection pattern is defensible. No hardcoded secrets or injection vectors were found.

Six warnings require attention before shipping. None are data-loss risks in the normal UI path, but several become correctness failures when the encode command is called directly or when inputs are numerically out of range.

---

## Warnings

### WR-01: Rules-of-Hooks violation — early return between hook calls

**File:** `src/components/form/fields/MapField.tsx:93-102`

**Issue:** `useFormContext` is called on line 94, then the component conditionally returns `null` on line 96 before `useFieldArray` (line 99) and `useWatch` (line 102) are called. This violates the React Rules of Hooks ("don't call hooks after a conditional return"). In practice `ProtoFormRenderer` only mounts `MapField` when `field.kind.type === "map"`, so the branch never triggers at runtime — but the violation exists structurally and will trip React's hook-order linter/exhaustive checks. If `MapField` is ever reused in a context where the check fails (e.g., a story or test that passes the wrong schema), the hook call counts diverge across renders and React will throw.

**Fix:** Move the guard check before all hook calls, or remove it and rely exclusively on the TypeScript type narrowing that already happens at call sites:

```tsx
export function MapField({ field, path, depth, renderValue }: MapFieldProps): React.ReactNode {
  const { control, setError, clearErrors } = useFormContext();

  // Narrow the type — caller (ProtoFormRenderer) already guarantees map kind,
  // but this makes the guard structurally safe before subsequent hook calls.
  if (field.kind.type !== "map") return null;   // ← still here, but NOW before hooks
  // ^ Actually this is already first before hooks — re-check the current order.
  // The real fix: move useFieldArray/useWatch ABOVE the early return, OR move
  // the early return ABOVE all hook calls including useFormContext.
```

The cleanest approach is to remove the early-return guard entirely and trust the TypeScript type (`field.kind` is `{ type: "map"; ... }` at this call site):

```tsx
export function MapField({ field, path, depth, renderValue }: MapFieldProps): React.ReactNode {
  const { control, setError, clearErrors } = useFormContext();
  const { key_type, value_kind } = field.kind as Extract<FieldKind, { type: "map" }>;

  const { fields, append, remove } = useFieldArray({ control, name: path });
  const rows = useWatch({ control, name: path }) as Array<{ key: unknown }> | undefined;
  // ... rest of component, no early return needed
}
```

---

### WR-02: Silent duplicate-key overwrite on direct IPC encode calls

**File:** `src-tauri/src/commands/encode.rs:118-127`

**Issue:** `HashMap::insert` silently drops earlier values when a key appears more than once in the `rows` array. The UI validation (`__mapDuplicateGuard`) prevents this in normal use, but `encode_message` is a public Tauri IPC command that callers can invoke directly (e.g., replay history, scripted automation, fuzzing). A caller sending `[{key:"a",value:1},{key:"a",value:2}]` receives no error — the first entry is silently discarded.

```rust
for row in arr {
    let key_json = row.get("key").unwrap_or(&JsonValue::Null);
    let val_json = row.get("value").unwrap_or(&JsonValue::Null);
    let map_key = json_to_map_key(field, key_json)?;
    if let Some(val) = scalar_or_message_value_for_map_entry(field, val_json)? {
        map.insert(map_key, val);  // ← silently overwrites on dupe
    }
}
```

**Fix:** Reject duplicate keys at the encode layer:

```rust
if map.contains_key(&map_key) {
    return Err(AppError::EncodeError {
        field: field.name().to_string(),
        message: format!("duplicate map key: {:?}", map_key),
    });
}
map.insert(map_key, val);
```

---

### WR-03: Map value with null/missing JSON silently inserts zero-value entry

**File:** `src-tauri/src/commands/encode.rs:122-124`

**Issue:** `scalar_or_message_value_for_map_entry` routes through `scalar_or_message_value`. That function does NOT pre-check for `JsonValue::Null` (the null-check on line 102 only applies in `set_field_value`, not here). A map row like `{"key":"k"}` (missing `value`) will produce `val_json = &JsonValue::Null`, then `scalar_or_message_value` matches on the value field's Kind and returns `Some(Value::I32(0))` / `Some(Value::String(""))` etc. The map entry is inserted with a zero-value.

This may be intentional (proto3 zero-values are valid), but it is inconsistent with the list/repeated path which calls `scalar_or_message_value` and skips items only when the function returns `None` — which currently never happens for scalars.

**Fix:** Explicitly skip null value entries (matching the intent of the list path):

```rust
let val_json = row.get("value").unwrap_or(&JsonValue::Null);
if val_json.is_null() {
    continue;  // skip rows with no value set
}
let map_key = json_to_map_key(field, key_json)?;
```

Or, if zero-value insertion is intentional, add a comment making the design decision explicit.

---

### WR-04: Integer overflow silently truncates large numeric map keys

**File:** `src-tauri/src/commands/encode.rs:337-341` (`parse_i32`)

**Issue:** `v.as_i64().map(|n| n as i32)` wraps any value outside `[-2^31, 2^31)` silently. For example, JSON `{"key": 2147483648}` produces map key `I32(-2147483648)` with no error. The same applies to `parse_u32` (line 348). Since protobuf map keys must match their declared type precisely, this can encode an entry under the wrong key.

```rust
fn parse_i32(v: &JsonValue) -> Option<i32> {
    v.as_i64()
        .map(|n| n as i32)  // ← silent truncation
        .or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
}
```

**Fix:** Use checked narrowing:

```rust
fn parse_i32(v: &JsonValue) -> Option<i32> {
    v.as_i64()
        .and_then(|n| i32::try_from(n).ok())
        .or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
}

fn parse_u32(v: &JsonValue) -> Option<u32> {
    v.as_u64()
        .and_then(|n| u32::try_from(n).ok())
        .or_else(|| v.as_str().and_then(|s| s.parse::<u32>().ok()))
}
```

---

### WR-05: `append` injects `value: undefined` — uncontrolled-to-controlled warning

**File:** `src/components/form/fields/MapField.tsx:147`

**Issue:** `append({ key: defaultKeyValue(key_type), value: undefined })` sets the initial map value to `undefined`. When `renderValue` renders a controlled input (`ScalarField`, `EnumField`, etc.) whose internal `Controller` receives `undefined` then is updated to a string, React prints a warning: "A component is changing an uncontrolled input to be controlled." This does not break functionality but produces console noise and indicates a missing default.

```tsx
function handleAppend() {
  append({ key: defaultKeyValue(key_type), value: undefined });  // ← undefined value
}
```

**Fix:** Supply a sensible default based on `value_kind`, similar to how `buildDefaultValues` handles scalars in `ProtoFormRenderer`:

```tsx
function defaultValueForKind(kind: FieldKind): unknown {
  if (kind.type === "scalar") {
    if (kind.scalar === "bool") return false;
    if (["int64","uint64","sint64","fixed64","sfixed64"].includes(kind.scalar)) return "0";
    if (kind.scalar === "string" || kind.scalar === "bytes") return "";
    return 0;
  }
  return null;
}

function handleAppend() {
  append({ key: defaultKeyValue(key_type), value: defaultValueForKind(value_kind) });
}
```

---

### WR-06: `useEffect` with no dependency array runs cleanup on every render (misleading comment)

**File:** `src/components/form/ProtoFormRenderer.tsx:117-130`

**Issue:** The `useEffect` at line 117 has no dependency array, so its cleanup function runs before every re-render, not only on unmount. The comment on line 124 says "Nullify the ref when this component unmounts" — this is incorrect. The ref is set to `null` on every render's cleanup phase, then immediately re-populated by the effect body. In steady state this is harmless, but it means any caller that holds a reference and invokes `resetRef.current()` between the cleanup and the effect body (on a fast re-render cycle) will call `null` and throw.

**Fix:** Add a proper dependency array and explicit cleanup on unmount:

```tsx
useEffect(() => {
  if (resetRef) {
    resetRef.current = (values: Record<string, unknown>) => {
      methods.reset(values);
    };
  }
  return () => {
    if (resetRef) {
      resetRef.current = null;  // Only nullified on actual unmount
    }
  };
}, [resetRef, methods]);
```

---

## Info

### IN-01: Dead variable `oneof_names` collected and immediately discarded

**File:** `src-tauri/src/schema/extractor.rs:48-51, 97`

**Issue:** `oneof_names: Vec<String>` is built by collecting `.oneofs().map(|o| o.name())` and then suppressed with `let _ = oneof_names;` on line 97. The same data is recomputed in `oneof_field_names` (lines 54-59). Remove the dead collection.

**Fix:**
```rust
// Remove lines 48-51 (oneof_names collection) and line 97 (let _ = oneof_names;)
```

---

### IN-02: `unreachable!` panics on invalid descriptor pool shapes

**File:** `src-tauri/src/schema/extractor.rs:113, 121`

**Issue:** Two `unreachable!` branches trigger a panic if a malformed or externally-crafted `DescriptorPool` somehow produces a map field that is not of `Kind::Message`, or a map key field that is not `FieldKind::Scalar`. `protox` + `prost-reflect` enforce these invariants for well-formed protos, but a corrupt descriptor pool would crash the process.

**Fix (optional):** Convert to `return FieldSchema` with an error kind, or at minimum use `panic!` with a meaningful message. Low priority for a dev tool.

---

### IN-03: `key_type: ScalarKind` in `FieldKind::Map` allows float/double/bytes — proto3 prohibits these

**File:** `src/lib/types.ts:26` and `src-tauri/src/schema/types.rs:35`

**Issue:** `ScalarKind` (both Rust and TypeScript) includes `float`, `double`, and `bytes`, none of which are valid map key types in proto3. The extractor never emits them because `protoc`/`protox` rejects the source proto at compile time — but the type system permits them, and `json_to_map_key` would return an "unsupported map key kind" error at runtime if they ever appeared.

**Fix:** Define a separate `MapKeyKind` type restricted to the valid key types, used only in `FieldKind::Map`. This is a type-tightening refactor, not a bug fix.

---

### IN-04: Hidden guard Controller's `validate` rule is never triggered

**File:** `src/components/form/fields/MapField.tsx:269-277`

**Issue:** The `Controller` at line 269 registers a `validate` rule that reads `hasDuplicatesRef.current`. However, RHF only runs `validate` when the field's own value changes — and this synthetic guard field's value never changes (it has no input). The `setError`/`clearErrors` `useEffect` (lines 125-131) is the actual mechanism keeping `formState.isValid` false. The `Controller` is effectively decorative. The comment on line 266 is misleading ("validate rule reads hasDuplicatesRef.current... so it never accidentally clears the error").

**Fix:** Either remove the Controller entirely (relying solely on `setError`/`clearErrors`), or trigger validation explicitly after error state changes. Document the chosen mechanism clearly.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
