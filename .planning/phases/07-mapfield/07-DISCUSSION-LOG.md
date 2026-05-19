# Phase 7: MapField - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 7-MapField
**Areas discussed:** Rust schema shape, Duplicate key validation, Value sub-renderer approach, Bool key rendering

---

## Rust Schema Shape

### Q1: FieldKind::Map value type info

| Option | Description | Selected |
|--------|-------------|----------|
| `Map { key_type: ScalarKind, value_kind: FieldKind }` | Frontend gets complete type info — same FieldKind enum reused for value. Clean IPC contract. | ✓ |
| `Map { key_type: ScalarKind, value_schema: FieldSchema }` | Wraps FieldKind in a full FieldSchema. Mostly noise — value_schema.repeated is always false. | |

**User's choice:** `Map { key_type: ScalarKind, value_kind: FieldKind }` (recommended)

### Q2: repeated flag on map FieldSchema

| Option | Description | Selected |
|--------|-------------|----------|
| `repeated: false` | MapField handles its own row array. Avoids double-wrapping by RepeatedField. | ✓ |
| `repeated: true` | Matches prost-reflect raw output. Requires ProtoFormRenderer to check kind.type === "map" before repeated check. | |

**User's choice:** `repeated: false` (recommended)

---

## Duplicate Key Validation

### Q1: Where duplicate key validation lives

| Option | Description | Selected |
|--------|-------------|----------|
| MapField component state | Local hasDuplicates check on key onChange. Shows inline error. Sets hidden RHF guard. | ✓ |
| zod `.refine()` on array field | Fires at submit/resolver time — UX feels delayed, not inline. | |

**User's choice:** MapField component state (recommended)

### Q2: Error display style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline under key input | `<p className="text-xs text-destructive" role="alert">` — consistent with existing pattern. | ✓ |
| Banner at top of map field | Single warning above all rows. Less localized. | |

**User's choice:** Inline under key input (recommended)

### Q3: Send button blocking mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden RHF Controller with zod rule | `formState.isValid` becomes false when hasDuplicates — no store coupling. | ✓ |
| Zustand store flag | MapField writes hasDuplicates to store; PublishBar reads it. Couples form-local state to global store. | |

**User's choice:** Hidden RHF Controller (recommended)

---

## Value Sub-renderer Approach

### Q1: How MapField renders values

| Option | Description | Selected |
|--------|-------------|----------|
| `renderValue: RenderFieldFn` prop | Same pattern as RepeatedField's renderItem. No circular imports. | ✓ |
| Inline switch inside MapField | Imports field components directly. Reintroduces circular import risk. | |

**User's choice:** `renderValue` prop (recommended)

### Q2: Synthetic FieldSchema shape for value renderer

| Option | Description | Selected |
|--------|-------------|----------|
| `{ name: \`${field.name}[${index}].value\`, label: "Value", kind: field.kind.value_kind, repeated: false }` | Minimal inline construction. Consistent with RepeatedField's row shape. | ✓ |
| Expose full FieldSchema for value in FieldKind::Map from Rust | Removes frontend synthesis but adds Rust complexity for trivial gain. | |

**User's choice:** Inline synthetic FieldSchema (recommended)

---

## Bool Key Rendering

### Q1: Bool map key input

| Option | Description | Selected |
|--------|-------------|----------|
| Select with "true"/"false" options | Consistent with EnumField's Select approach. Only valid bool keys selectable. | ✓ |
| Checkbox | Compact but semantically unclear as a map key. Needs extra label. | |

**User's choice:** Select with "true"/"false" (recommended)

### Q2: Integer key types

| Option | Description | Selected |
|--------|-------------|----------|
| `type="number"` input | Same approach as ScalarField int/uint scalars. 64-bit uses type="text" + regex. | ✓ |
| `type="text"` for all int key types | Simpler uniform handling but loses native number keyboard constraint. | |

**User's choice:** `type="number"` for 32-bit, `type="text"` + regex for 64-bit (recommended)

---

## Claude's Discretion

- Row layout (key | value | remove button alignment)
- Badge label for map fields (e.g., "map" badge with key/value type info)
- Default value for a new row's key on Add
- Header row structure (field name + "map" badge)

## Deferred Ideas

None — discussion stayed within phase scope.
