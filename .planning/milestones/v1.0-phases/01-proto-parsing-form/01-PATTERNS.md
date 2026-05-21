# Phase 1: Proto Parsing + Form — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 35 (all new — greenfield project)
**Analogs found:** 0 / 35 — no existing source files

> This is a greenfield project. Zero source files exist in the repository.
> There are no codebase analogs to excerpt. All pattern references point to
> concrete numbered patterns in RESEARCH.md or direct library docs.
> "Pattern Source" rows replace the "Analog" column used in projects with
> existing code.

---

## Global Constraints (apply to every file)

These anti-patterns are confirmed traps in this exact tech stack. Every plan action
inherits them:

| # | Constraint | Applies to |
|---|------------|------------|
| G-1 | NO `#[tokio::main]` in `main.rs` — Tauri manages the runtime | `main.rs` |
| G-2 | NO `tokio::spawn` — use `tauri::async_runtime::spawn` | All Rust async code |
| G-3 | NO `&str` parameters in `#[tauri::command]` — use `String` | `commands/proto.rs`, `commands/encode.rs` |
| G-4 | NO `prost` pinned to 0.13.x — let protox 0.9.1 + prost-reflect 0.16.3 resolve to 0.14.0 | `Cargo.toml` |
| G-5 | NO `zod` v4 — pin `"zod": "^3.24.2"` in package.json | `package.json`, all form components |
| G-6 | NO `field.index` as React key in `useFieldArray` — always use `field.id` | `RepeatedField.tsx` |
| G-7 | NO `tailwind.config.js` — Tailwind 4 uses `@import "tailwindcss"` CSS directive | `index.css`, `vite.config.ts` |
| G-8 | NO `google.protobuf.Any` handling in Phase 1 — render as plain string input | `WellKnownTypeField.tsx` |
| G-9 | NO `setValue("nestedKey", { subfield })` — target specific nested paths | All form value-setting code |

---

## File Classification

### Rust Backend — `src-tauri/src/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src-tauri/src/main.rs` | entrypoint | N/A | RESEARCH.md Anti-Patterns §G-1; RESEARCH.md Pattern 1 lib.rs snippet |
| `src-tauri/src/lib.rs` | config / bootstrap | N/A | RESEARCH.md Pattern 1 (lib.rs block) |
| `src-tauri/src/error.rs` | utility | N/A | RESEARCH.md Standard Stack → `thiserror` 2.0.18 |
| `src-tauri/src/commands/mod.rs` | config | N/A | Rust module re-export convention |
| `src-tauri/src/commands/proto.rs` | command (controller) | request-response | RESEARCH.md Pattern 1 |
| `src-tauri/src/commands/encode.rs` | command (controller) | request-response | RESEARCH.md Pattern 1 |
| `src-tauri/src/schema/mod.rs` | config | N/A | Rust module re-export convention |
| `src-tauri/src/schema/types.rs` | model | transform | RESEARCH.md Pattern 2 (Rust side) |
| `src-tauri/src/schema/extractor.rs` | service | transform | RESEARCH.md Pattern 2 + prost-reflect docs |

### Rust Config & Capabilities

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src-tauri/Cargo.toml` | config | N/A | RESEARCH.md Standard Stack table + Pitfall 1 (prost version) |
| `src-tauri/capabilities/default.json` | config | N/A | RESEARCH.md Pattern 7 |
| `src-tauri/gen/apple/PrivacyInfo.xcprivacy` | config | N/A | RESEARCH.md Pattern 7 (XML block) |
| `src-tauri/tauri.conf.json` | config | N/A | RESEARCH.md Pattern 7 (macOS entitlement block) |

### React Frontend — `src/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/main.tsx` | entrypoint | N/A | Standard Vite+React scaffold |
| `src/App.tsx` | component (layout root) | N/A | RESEARCH.md Architecture Diagram + UI-SPEC Layout Contract |
| `src/index.css` | config | N/A | RESEARCH.md Pattern 8 (Tailwind 4 `@import`) |
| `src/vite.config.ts` | config | N/A | RESEARCH.md Pattern 8 (`@tailwindcss/vite` plugin + `@` alias) |
| `package.json` | config | N/A | RESEARCH.md Installation block |

### Layout Components — `src/components/layout/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/components/layout/Sidebar.tsx` | component | N/A | UI-SPEC Layout Contract (sidebar spec) |
| `src/components/layout/MainPanel.tsx` | component | N/A | UI-SPEC Layout Contract (main panel spec) |

### Sidebar Components — `src/components/sidebar/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/components/sidebar/FileSection.tsx` | component | event-driven | UI-SPEC Interaction Contracts; RESEARCH.md Pattern 6 |
| `src/components/sidebar/MessageTypeSelect.tsx` | component | event-driven | RESEARCH.md Pattern 2 (schema shape); UI-SPEC (Select component) |
| `src/components/sidebar/ConnectionPlaceholder.tsx` | component | N/A | UI-SPEC Copywriting ("RabbitMQ — available in Phase 2") |

### Include Path Dialog — `src/components/include-paths/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/components/include-paths/IncludePathDialog.tsx` | component | event-driven | RESEARCH.md Pattern 6 (store API); UI-SPEC Include Path Dialog spec |

### Form Components — `src/components/form/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/components/form/ProtoFormRenderer.tsx` | component | transform | RESEARCH.md Pattern 2 (schema walking); RESEARCH.md Pitfall 5 (depth cap) |
| `src/components/form/ScalarField.tsx` | component | request-response | RESEARCH.md Form Validation Strategy; UI-SPEC Component Inventory |
| `src/components/form/NestedMessageField.tsx` | component | transform | RESEARCH.md Pattern 2 (Kind::Message recursive); UI-SPEC Form Area spec |
| `src/components/form/RepeatedField.tsx` | component | transform | RESEARCH.md Pattern 3 |
| `src/components/form/EnumField.tsx` | component | request-response | RESEARCH.md Phase Requirements FORM-04; UI-SPEC (Select) |
| `src/components/form/OneofField.tsx` | component | event-driven | RESEARCH.md Pattern 4 |
| `src/components/form/WellKnownTypeField.tsx` | component | transform | RESEARCH.md FORM-09 section; UI-SPEC WellKnownType Note |
| `src/components/form/DepthCapPlaceholder.tsx` | component | N/A | RESEARCH.md Pitfall 5; UI-SPEC Copywriting ("Nesting limit reached") |

### Preview Component — `src/components/preview/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/components/preview/HexPreviewStrip.tsx` | component | request-response | RESEARCH.md Pattern 5 |

### State & Utilities — `src/stores/`, `src/hooks/`, `src/lib/`

| File | Role | Data Flow | Pattern Source |
|------|------|-----------|----------------|
| `src/stores/useProtoStore.ts` | store | N/A | RESEARCH.md Architecture Responsibility Map (Zustand entry) |
| `src/hooks/useDebounce.ts` | hook | N/A | RESEARCH.md Pattern 5 (debounce snippet) |
| `src/lib/types.ts` | model | N/A | RESEARCH.md Pattern 2 (TypeScript mirror block) |
| `src/lib/ipc.ts` | utility | request-response | RESEARCH.md Pattern 1 (invoke wrappers) |

---

## Pattern Assignments

### `src-tauri/src/main.rs` (entrypoint)

**Pattern source:** RESEARCH.md Anti-Patterns §G-1; RESEARCH.md Pattern 1 (`lib.rs` block)

Critical rules:
- `main.rs` calls exactly one function: `proto_sender_lib::run()`
- No `#[tokio::main]` macro — causes nested runtime panic at startup
- No logic in `main.rs` itself

```rust
// Correct shape — do not add anything else
fn main() {
    proto_sender_lib::run()
}
```

---

### `src-tauri/src/lib.rs` (bootstrap)

**Pattern source:** RESEARCH.md Pattern 1 (`lib.rs` block, lines 313–324)

- Plugin registration order: store → dialog → fs
- `invoke_handler` lists all `#[tauri::command]` functions
- Pattern is fully specified in RESEARCH.md Pattern 1 — copy it verbatim

---

### `src-tauri/src/error.rs` (AppError)

**Pattern source:** RESEARCH.md Standard Stack → `thiserror` 2.0.18

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Proto parse error: {0}")]
    ParseError(String),
    #[error("Encode error at field '{field}': {message}")]
    EncodeError { field: String, message: String },
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// Required: Tauri commands must serialize errors to strings for IPC
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

Apply to: both `commands/proto.rs` and `commands/encode.rs` as the return error type.

---

### `src-tauri/src/commands/proto.rs` (Tauri command, request-response)

**Pattern source:** RESEARCH.md Pattern 1 (full code block)

Key requirements:
- `#[tauri::command]` + `pub async fn` signature
- All parameters must be owned types (`String`, `Vec<String>`) — no `&str`
- Returns `Result<ProtoSchema, AppError>`
- `protox::Compiler::new(&include_paths).include_imports(true).open_file(&file_path)`
- Filter top-level messages with `.filter(|m| m.parent_message().is_none())`
- Full implementation in RESEARCH.md Pattern 1 — copy the code block

---

### `src-tauri/src/commands/encode.rs` (Tauri command, request-response)

**Pattern source:** RESEARCH.md Architecture Diagram (Rust encode step); RESEARCH.md Standard Stack → `prost-reflect` 0.16.3

Key requirements:
- `#[tauri::command]` + `pub async fn encode_message(message_type: String, form_values: serde_json::Value) -> Result<Vec<u8>, AppError>`
- Uses `prost_reflect::DynamicMessage::new(message_descriptor)`
- Populates fields from `form_values` JSON
- Returns `prost::Message::encode_to_vec()` result as `Vec<u8>`
- On field-level error: return `AppError::EncodeError { field, message }` for React to call `setError()` on the named path

---

### `src-tauri/src/schema/types.rs` (model, transform)

**Pattern source:** RESEARCH.md Pattern 2 (TypeScript mirror block — the Rust side is the inverse of this)

All types must derive `serde::Serialize` and `serde::Deserialize` for IPC.

Key structs to implement:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ProtoSchema {
    pub messages: Vec<MessageSchema>,
    pub message_map: HashMap<String, MessageSchema>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageSchema {
    pub name: String,
    pub full_name: String,
    pub fields: Vec<FieldSchema>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldSchema {
    pub name: String,
    pub label: String,
    pub kind: FieldKind,
    pub repeated: bool,
    pub oneof_group: Option<String>,
    pub default_value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldKind {
    Scalar { scalar: ScalarKind },
    Message { full_name: String },
    Enum { values: Vec<EnumValue> },
    Oneof { branches: Vec<Vec<FieldSchema>> },
    WellKnown { wkt: String },
}
```

The TypeScript mirror in `src/lib/types.ts` must exactly match the serde output of these types.

---

### `src-tauri/src/schema/extractor.rs` (service, transform)

**Pattern source:** RESEARCH.md Pattern 2 (full schema bridge design); RESEARCH.md Phase Requirements FORM-01 through FORM-09 (field types to handle)

- Walks `prost_reflect::FieldDescriptor` → `FieldSchema`
- Maps `Kind` enum: `Kind::Bool` → `FieldKind::Scalar { scalar: "bool" }`, etc.
- Detects WellKnownTypes via `MessageDescriptor.full_name()` == `"google.protobuf.Timestamp"` / `"google.protobuf.Duration"` (RESEARCH.md FORM-09)
- Groups oneof fields: `FieldDescriptor.containing_oneof()` → `FieldKind::Oneof`
- Serializes `FieldDescriptor.default_value()` to `serde_json::Value`
- `fixed32`/`sfixed32`/`fixed64`/`sfixed64` render identical to `int32`/`uint32`/`int64`/`uint64` respectively (RESEARCH.md Open Question 1 resolution)

---

### `src-tauri/capabilities/default.json` (config)

**Pattern source:** RESEARCH.md Pattern 7 (full JSON block)

Copy the JSON block from RESEARCH.md Pattern 7 verbatim. Required permissions:
`core:default`, `dialog:default`, `dialog:allow-open`, `fs:default`, `fs:allow-read-text-file`, `fs:scope allow **/*`, `store:default`, store CRUD permissions.

---

### `src-tauri/gen/apple/PrivacyInfo.xcprivacy` (config)

**Pattern source:** RESEARCH.md Pattern 7 (XML block)

Copy the XML block from RESEARCH.md Pattern 7 verbatim. Required for macOS file timestamp access entitlement.

---

### `src/vite.config.ts` (config)

**Pattern source:** RESEARCH.md Pattern 8 (vite.config.ts code block)

Copy the block from RESEARCH.md Pattern 8 verbatim:
- `plugins: [react(), tailwindcss()]` — `tailwindcss()` is from `@tailwindcss/vite`
- `resolve.alias: { "@": path.resolve(__dirname, "./src") }`
- `server: { port: 1420, strictPort: true }` — required for Tauri dev mode

---

### `src/index.css` (config)

**Pattern source:** RESEARCH.md Pattern 8 (CSS block); RESEARCH.md Pitfall 3

```css
@import "tailwindcss";
/* shadcn/ui theme variables generated by `shadcn init` follow here */
```

Do NOT create `tailwind.config.js`. Do NOT use `@tailwind base/components/utilities` directives.

---

### `src/lib/types.ts` (model)

**Pattern source:** RESEARCH.md Pattern 2 (TypeScript mirror block — lines 333–366 in RESEARCH.md)

Copy the TypeScript type block from RESEARCH.md Pattern 2 verbatim. This is the load-bearing IPC contract between Rust schema serialization and the React form renderer.

Critical field: `oneof` form values convention (discriminated structure with `_selected` key) — specified in RESEARCH.md Pattern 2 "Form values convention for oneof" block.

---

### `src/lib/ipc.ts` (utility, request-response)

**Pattern source:** RESEARCH.md Pattern 1 (invoke wrappers concept); RESEARCH.md Architecture Diagram

Wraps `invoke()` from `@tauri-apps/api`:
```typescript
import { invoke } from "@tauri-apps/api/core";
import type { ProtoSchema } from "./types";

export async function parseProto(filePath: string, includePaths: string[]): Promise<ProtoSchema> {
  return invoke<ProtoSchema>("parse_proto", {
    filePath,       // Tauri camelCase → snake_case auto-conversion
    includePaths,
  });
}

export async function encodeMessage(messageType: string, formValues: unknown): Promise<number[]> {
  return invoke<number[]>("encode_message", { messageType, formValues });
}
```

All components call these wrappers, never raw `invoke()`. This isolates the IPC boundary.

---

### `src/stores/useProtoStore.ts` (store)

**Pattern source:** RESEARCH.md Architecture Responsibility Map (Global state row); RESEARCH.md Architecture Diagram (schema + selectedType state flow)

State shape:
```typescript
interface ProtoStore {
  // File state
  activeFilePath: string | null;
  schema: ProtoSchema | null;
  // Selection
  selectedMessageType: string | null;
  // Preview
  hexPreview: string | null;
  isEncoding: boolean;
  encodeError: string | null;
  // Actions
  setFile: (path: string, schema: ProtoSchema) => void;
  setSelectedType: (typeName: string) => void;
  setHexPreview: (hex: string | null) => void;
  reset: () => void;
}
```

Use Zustand `create<ProtoStore>()` with selector pattern. Each component subscribes to only the slice it needs to avoid re-renders.

---

### `src/hooks/useDebounce.ts` (hook)

**Pattern source:** RESEARCH.md Pattern 5 (debounce hook snippet)

Copy the `useDebounce<T>` implementation from RESEARCH.md Pattern 5 verbatim. Standard `useState` + `useEffect` + `clearTimeout` pattern. No external library needed.

---

### `src/App.tsx` (layout root, component)

**Pattern source:** UI-SPEC Layout Contract (Window Shell ASCII diagram)

```tsx
// Structure only — styling follows UI-SPEC spacing and color contracts
export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar className="w-[240px] shrink-0" />
      <MainPanel className="flex-1 min-w-0" />
    </div>
  );
}
```

---

### `src/components/layout/Sidebar.tsx` (component)

**Pattern source:** UI-SPEC Layout Contract (sidebar spec); UI-SPEC Copywriting Contract

Phase 1 sidebar contents (top to bottom):
1. App title
2. `FileSection` (filename display + "Open .proto file" button)
3. `Separator`
4. `MessageTypeSelect` (dropdown)
5. `Separator`
6. `ConnectionPlaceholder` (muted, non-interactive)

Fixed width: 240px (D-02). No resize handle.

---

### `src/components/sidebar/FileSection.tsx` (component, event-driven)

**Pattern source:** RESEARCH.md Pattern 6 (include path store API); RESEARCH.md Architecture Diagram (user action flow); UI-SPEC Interaction Contracts

Flow on "Open .proto file" click:
1. `open()` from `@tauri-apps/plugin-dialog` with `.proto` filter
2. `loadIncludePaths(filePath)` from `lib/ipc.ts` or local store helper
3. Open `IncludePathDialog` (modal) with pre-populated paths
4. On confirm: `saveIncludePaths(filePath, paths)` then `parseProto(filePath, paths)`
5. On success: `useProtoStore.setFile(path, schema)`
6. On cancel: do nothing (sidebar stays in previous state per UI-SPEC)

Error surface: inline error below the button with copy from UI-SPEC Copywriting ("Could not parse .proto file…").

---

### `src/components/sidebar/MessageTypeSelect.tsx` (component, event-driven)

**Pattern source:** RESEARCH.md Phase Requirements FORM-01 + D-11/D-12; RESEARCH.md Pitfall 6

On type selection:
1. `useProtoStore.setSelectedType(typeName)`
2. Call `react-hook-form` `reset(buildDefaultValues(newSchema))` — see Pitfall 6

Only top-level messages shown (D-11). Switching discards form values without confirmation (D-12).

---

### `src/components/include-paths/IncludePathDialog.tsx` (component, event-driven)

**Pattern source:** RESEARCH.md Pattern 6 (store API); UI-SPEC Include Path Dialog spec; UI-SPEC Copywriting Contract

Uses shadcn `Dialog` component. Row pattern: `<Input readOnly value={path} /> <Button variant="ghost" onClick={() => remove(i)}><Trash2 /></Button>`.

Copy text verbatim from UI-SPEC Copywriting Contract (title: "Configure include paths", body, button labels: "Add path", "Load file", "Discard path changes").

---

### `src/components/form/ProtoFormRenderer.tsx` (component, transform)

**Pattern source:** RESEARCH.md Pattern 2 (schema walking); RESEARCH.md Pitfall 5 (depth cap); RESEARCH.md Phase Requirements FORM-02 through FORM-09

This is the recursive dispatcher. Props: `{ schema: FieldSchema | MessageSchema, fieldPath: string, depth: number }`.

Dispatch logic:
```typescript
function renderField(field: FieldSchema, path: string, depth: number) {
  if (depth >= 5) return <DepthCapPlaceholder />;
  switch (field.kind.type) {
    case "scalar":  return <ScalarField ... />;
    case "message": return <NestedMessageField ... depth={depth + 1} />;
    case "enum":    return <EnumField ... />;
    case "oneof":   return <OneofField ... />;
    case "well_known": return <WellKnownTypeField ... />;
  }
  if (field.repeated) return <RepeatedField ... />;
}
```

The `depth` prop is threaded through every level. At `depth >= 5` render `<DepthCapPlaceholder />` (RESEARCH.md FORM-08 / D-15).

---

### `src/components/form/ScalarField.tsx` (component, request-response)

**Pattern source:** RESEARCH.md Form Validation Strategy; UI-SPEC Component Inventory; RESEARCH.md Open Questions 2 and 3

Scalar-to-control mapping:
- `bool` → shadcn `Checkbox`
- `string` → shadcn `Input type="text"`
- `int32`/`sint32`/`sfixed32` → `Input type="number"` + zod `z.number().int().min(-2147483648).max(2147483647)`
- `uint32`/`fixed32` → `Input type="number"` + zod `z.number().int().min(0).max(4294967295)`
- `int64`/`sint64`/`sfixed64`/`uint64`/`fixed64` → `Input type="text"` (regex `^-?\d+$` or `^\d+$`) — JS cannot represent int64 precisely
- `float`/`double` → `Input type="number"` + zod `z.number()`
- `bytes` → `Input type="text"` with `Badge` annotation "bytes (base64)" (RESEARCH.md Open Question 3 recommendation)

Each field wraps in `Controller` from `react-hook-form`. Label uses shadcn `Label` + `Badge` showing the scalar type name.

---

### `src/components/form/NestedMessageField.tsx` (component, transform)

**Pattern source:** RESEARCH.md Pattern 2 (Kind::Message recursive rendering); UI-SPEC Form Area spec (shadcn Collapsible)

- Wraps content in shadcn `Collapsible` (default expanded)
- Indented 16px per depth level (UI-SPEC spacing: `md` = 16px)
- Renders `<ProtoFormRenderer schema={resolvedMessage} fieldPath={fieldPath} depth={depth + 1} />`
- Depth increment happens here, not in ProtoFormRenderer

---

### `src/components/form/RepeatedField.tsx` (component, transform)

**Pattern source:** RESEARCH.md Pattern 3 (full code block)

Copy the `useFieldArray` pattern from RESEARCH.md Pattern 3 verbatim. Critical rules:
- Always use `field.id` as React key, never `index` (G-6)
- `append(getDefaultItem())` uses `field.default_value` from schema
- Remove button: `variant="destructive"` per UI-SPEC Color (destructive accent for remove-item only)

---

### `src/components/form/EnumField.tsx` (component, request-response)

**Pattern source:** RESEARCH.md Phase Requirements FORM-04

Uses shadcn `Select`. Options from `field.kind.values` (array of `{ name, number }`). Display value name string, store enum number as form value. Value is sent to Rust as `number` (validated against descriptor at encode time).

---

### `src/components/form/OneofField.tsx` (component, event-driven)

**Pattern source:** RESEARCH.md Pattern 4 (full code block)

Copy the `Controller` + `useWatch` + `unregister` pattern from RESEARCH.md Pattern 4 verbatim. Key behavior:
- `_selected` field tracks the active branch
- `useEffect` on `selected` change calls `unregister` on all non-selected branches
- Only the selected branch component is rendered (conditional mount, not CSS hide)

---

### `src/components/form/WellKnownTypeField.tsx` (component, transform)

**Pattern source:** RESEARCH.md FORM-09 section; UI-SPEC WellKnownType Note

Detection function (from RESEARCH.md FORM-09):
```typescript
function isWellKnownType(fullName: string): "Timestamp" | "Duration" | null {
  if (fullName === "google.protobuf.Timestamp") return "Timestamp";
  if (fullName === "google.protobuf.Duration") return "Duration";
  return null;
}
```

- `Timestamp`: `<input type="datetime-local">` — ISO 8601 string sent to Rust; Rust converts to `seconds + nanos`
- `Duration`: `<Input>` with placeholder `e.g. 1h30m`, validated against `^(\d+h)?(\d+m)?(\d+(\.\d+)?s)?$`
- All other WKTs: plain `<Input type="text">` with `<Badge>` showing the WKT full_name (G-8)

---

### `src/components/form/DepthCapPlaceholder.tsx` (component)

**Pattern source:** RESEARCH.md FORM-08 / D-15; UI-SPEC Copywriting Contract

Non-interactive, muted style. Exact copy text: `"Nesting limit reached (5 levels). Expand in code."` Compact vertical padding: 8px (UI-SPEC Spacing exceptions).

---

### `src/components/preview/HexPreviewStrip.tsx` (component, request-response)

**Pattern source:** RESEARCH.md Pattern 5 (full debounce + invoke pattern)

```typescript
// Copy from RESEARCH.md Pattern 5 — hex display logic:
.then(bytes => setHex(bytes.map(b => b.toString(16).padStart(2, "0")).join(" ")))
```

- Uses `useDebounce(formValues, 200)` (D-05: 200ms debounce)
- Collapsible strip, **expanded by default** when a file is loaded (D-07)
- Font: JetBrains Mono (UI-SPEC Typography — Code role)
- Format: `0a 05 68 65 6c 6c 6f …` hex pairs separated by spaces (D-06)
- Loading state: "Encoding…"; error state: "Encoding failed — check field values" (UI-SPEC Copywriting)

---

### `src/components/sidebar/ConnectionPlaceholder.tsx` (component)

**Pattern source:** UI-SPEC Layout Contract (connection panel placeholder); UI-SPEC Copywriting Contract

Static, non-interactive element. Muted text: `"RabbitMQ — available in Phase 2"`. No onClick, no hover state, no shadcn interactive component. Visible but inactive (D-03).

---

## Shared Patterns

### Tauri Command Shape (applies to all `#[tauri::command]` functions)

**Apply to:** `commands/proto.rs`, `commands/encode.rs`

```rust
#[tauri::command]
pub async fn command_name(
    param: String,              // owned types only — no &str
    param2: Vec<String>,
) -> Result<ReturnType, AppError> {
    // ...
    Ok(result)
}
```

`AppError` must implement `serde::Serialize` (see `error.rs` pattern above).

---

### IPC Type Mirroring (Rust ↔ TypeScript)

**Apply to:** `schema/types.rs` (Rust) and `lib/types.ts` (TypeScript) — these two files must be kept in sync

Rust `serde` with `#[serde(tag = "type", rename_all = "snake_case")]` on enums produces tagged discriminated unions that map exactly to TypeScript's discriminated union syntax. Any change to `FieldKind` in Rust must be mirrored in `types.ts`.

---

### Zustand Selector Pattern (applies to all components reading global state)

**Apply to:** All React components that access `useProtoStore`

```typescript
// CORRECT: Subscribe to only the needed slice
const schema = useProtoStore(state => state.schema);

// WRONG: Subscribe to entire store (triggers re-renders on any state change)
const store = useProtoStore();
```

---

### react-hook-form Context Pattern (applies to all form sub-components)

**Apply to:** All `*Field.tsx` components

```typescript
// Sub-components use useFormContext(), NOT top-level useForm()
// useForm() is called once in the parent that owns the form
const { control, register, watch } = useFormContext();
```

This avoids prop-drilling the `control` object through the recursive component tree.

---

### Depth Prop Threading (applies to all recursive form components)

**Apply to:** `ProtoFormRenderer.tsx`, `NestedMessageField.tsx`, `RepeatedField.tsx`, `OneofField.tsx`

Every form component that can recurse must accept and pass through `depth: number`. The depth check (`depth >= 5`) lives in `ProtoFormRenderer` as the single gate. No other component checks depth.

---

### Include Path Persistence (applies to file loading flow)

**Apply to:** `FileSection.tsx`, `IncludePathDialog.tsx`

```typescript
// Pattern source: RESEARCH.md Pattern 6
import { load } from "@tauri-apps/plugin-store";
const STORE_PATH = "tap.json";
// Key format: `include_paths:${absoluteFilePath}`
```

---

## Test File Stubs

**Note:** Upstream artifacts (CONTEXT.md, RESEARCH.md) do not specify test files. Global CLAUDE.md rules mandate 80% minimum coverage and TDD (write tests first). The planner must allocate tasks for these test files — they are not optional.

| Test File | Tests | Pattern Source |
|-----------|-------|----------------|
| `src-tauri/src/schema/extractor_test.rs` | `MessageSchema` from fixture proto; field kinds; WKT detection; depth cap; oneof grouping | Rust `#[cfg(test)]` module pattern; use protox to compile a fixture `.proto` |
| `src-tauri/src/commands/proto_test.rs` | parse valid file; parse with missing import; parse with bad include paths | Tauri command unit tests with `tauri::test` harness |
| `src-tauri/src/commands/encode_test.rs` | encode scalar message; encode nested; encode repeated; encode oneof; encode error cases | Same harness |
| `src/components/form/ProtoFormRenderer.test.tsx` | renders scalar; renders nested at depth 4; renders depth cap at depth 5; renders repeated; renders oneof | React Testing Library + vitest |
| `src/components/form/RepeatedField.test.tsx` | add item appends with default; remove item uses field.id (not index) | React Testing Library + vitest |
| `src/components/form/OneofField.test.tsx` | selecting branch unmounts siblings; unregister called on branch switch | React Testing Library + vitest |
| `src/components/preview/HexPreviewStrip.test.tsx` | debounce triggers encode after 200ms; error state displays copy; expanded by default | React Testing Library + vitest + fake timers |
| `src/lib/ipc.test.ts` | invoke wrappers call correct command names with correct param shape | vitest mock of `@tauri-apps/api` |
| `src/stores/useProtoStore.test.ts` | setFile populates schema; setSelectedType updates; reset clears all | vitest + zustand testing pattern |
| `src/hooks/useDebounce.test.ts` | debounced value updates after delay; no update before delay | vitest + fake timers |

---

## No Analog Found

All files are new. No existing codebase analogs exist anywhere in the repository.

The RESEARCH.md patterns (Pattern 1 through Pattern 8) serve as the canonical reference for the planner. Where RESEARCH.md provides a complete code block, the planner should direct executors to copy it verbatim rather than re-derive it.

---

## Metadata

**Analog search scope:** Entire `src-tauri/` and `src/` directory trees — both are empty (greenfield)
**Files scanned:** 0 (no source files exist)
**All pattern references resolve to:** `.planning/phases/01-proto-parsing-form/01-RESEARCH.md`
**Pattern extraction date:** 2026-05-17
