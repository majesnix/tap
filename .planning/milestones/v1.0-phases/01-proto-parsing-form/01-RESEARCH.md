# Phase 1: Proto Parsing + Form — Research

**Researched:** 2026-05-17
**Domain:** Tauri 2 + Rust proto parsing (protox + prost-reflect) + React dynamic form (react-hook-form + zod)
**Confidence:** HIGH (core stack verified), MEDIUM (form schema design and shadcn/Tailwind 4 integration)

---

## Summary

Phase 1 bootstraps the entire application from scratch: Tauri 2 project shell, Rust backend for
runtime `.proto` file parsing and binary encoding, and a React frontend that renders a fully
type-aware dynamic form driven by the parsed descriptor. No RabbitMQ, no network.

The core technical challenge is the **Rust-to-React schema bridge**: protox+prost-reflect gives
us a typed descriptor tree in Rust; we must serialize that into a JSON schema that a recursive
React renderer can walk, handling scalars, nested messages, repeated fields, enums, oneofs, and
a depth cap. The form values flow back to Rust for binary encoding on each debounced change.

The secondary challenge is **Tauri setup from scratch**: scaffolding, plugin registration
(dialog, fs, store), capability grants for reading arbitrary user files, and Tailwind 4 +
shadcn/ui configuration in a Vite+Tauri context. Both are well-documented and have known
working patterns — the main risk is the ordering of setup steps during Wave 0.

**Primary recommendation:** Scaffold with `npm create tauri-app@latest` (React+TypeScript+Vite),
initialize shadcn with `pnpm dlx shadcn@latest init -t vite`, use `npm run tauri add` for each
plugin, and pin `zod` to `^3.24.2` (NOT zod 4 — active resolver type errors).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Phase 1 establishes the final persistent window structure — left sidebar + main content area. Phases 2 and 3 extend this structure; no layout rework needed.
**D-02:** Left sidebar is narrow (~240px fixed). No resizable split pane.
**D-03:** Sidebar content in Phase 1: proto file name display, message type dropdown, and an "Open file" button. Connection panel area is a placeholder (grayed out / empty) until Phase 2.
**D-04:** Binary encode preview lives in a collapsible bottom strip below the form in the main panel.
**D-05:** Preview updates live/reactively as field values change. Add debounce (e.g., 150–300ms) to avoid re-encoding on every keystroke.
**D-06:** Preview format: hex string only (e.g., `0a 05 68 65 6c 6c 6f …`). No byte count badge in Phase 1.
**D-07:** Preview panel is expanded by default when a proto file is loaded.
**D-08:** Include paths are configured via an inline dialog at file-open time. The dialog appears after the file picker closes, pre-populated with the proto file's parent directory. User can add/remove additional paths before loading.
**D-09:** Include paths are persisted per proto file path (keyed by absolute file path) using `tauri-plugin-store`. Reopening the same file pre-fills the previously used paths.
**D-10:** Message type selector is a dropdown in the left sidebar, rendered immediately below the proto file name.
**D-11:** Dropdown shows only top-level message types. Nested message types are only accessible as inline sub-forms within their parent — not as selectable root types.
**D-12:** Switching message type discards all current form values and resets to zero-value defaults. No confirmation dialog.
**D-13:** Stack: `protox` + `prost-reflect` (Rust proto parsing + dynamic encoding), `react-hook-form` + `zod` + `shadcn/ui` (form), Zustand (global state), Tailwind 4, `tauri-plugin-store`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`.
**D-14:** oneof fields: radio group with conditional branch visibility (selecting a branch clears sibling branches per proto wire semantics).
**D-15:** Recursive message depth: hard cap at 5 levels with a collapse placeholder below that. No infinite expansion.
**D-16:** Include path resolution: explicit list only — never auto-detect from the proto file's location (beyond pre-populating the dialog with the parent dir).
**D-17:** Binary protobuf wire format only. No JSON encoding in Phase 1.

### Claude's Discretion

None specified in CONTEXT.md — all key decisions were locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROT-01 | User can open a `.proto` file via a file picker dialog at runtime (no pre-compilation step) | Tauri dialog plugin `open()` API + `fs:scope allow **/*` capability + macOS entitlement documented in Environment section |
| PROT-02 | User can configure include paths (equivalent to `protoc -I`) so relative imports resolve correctly | `protox::Compiler::new(includes)` with user-supplied path list; `include_imports(true)`; Dialog UX defined in D-08/D-09 |
| FORM-01 | Form renders all scalar field types with appropriate inputs | `prost-reflect::Kind` enum: Bool/I32/I64/U32/U64/F32/F64/Sint32/Sint64/Fixed32/Fixed64/Sfixed32/Sfixed64/String/Bytes; React field renderer maps Kind → shadcn Input/Checkbox |
| FORM-02 | Form renders nested message fields as expandable inline sub-forms | `Kind::Message(MessageDescriptor)` recursive rendering, depth tracked by counter; shadcn Collapsible for expand/collapse |
| FORM-03 | Form renders repeated fields as list with add/remove controls | `Cardinality::Repeated` → `useFieldArray` hook; `append/remove` API confirmed |
| FORM-04 | Form renders enum fields as dropdowns showing value names | `Kind::Enum(EnumDescriptor)` → shadcn Select with `EnumValueDescriptor.name()` labels, `EnumValueDescriptor.number()` as value |
| FORM-05 | Form renders oneof fields as radio group; selecting branch clears siblings | `FieldDescriptor.containing_oneof()` → group fields under oneof name; shadcn RadioGroup; `useWatch` drives conditional unmount of sibling branches |
| FORM-06 | App validates field values before send and surfaces errors inline | Lightweight per-field zod scalars (int32 range, non-negative uint, etc.); Rust `encode_message` returns structured errors for structural failures |
| FORM-07 | Form pre-populates sensible zero-value defaults on load | `FieldDescriptor.default_value()` returns `Value`; Rust schema serialization includes `default_value` field; `react-hook-form` `defaultValues` set from schema |
| FORM-08 | App caps nested message expansion at 5 levels deep | Depth counter passed as prop during recursive render; at depth=5 render shadcn Collapsible placeholder with copy "Nesting limit reached (5 levels). Expand in code." |
| FORM-09 | WellKnownType fields use purpose-built controls (Timestamp + Duration for Phase 1) | Detect by `MessageDescriptor.full_name()` == "google.protobuf.Timestamp" / "google.protobuf.Duration"; render datetime picker / duration string input; all other WKTs render as plain string with type annotation |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Proto file picking | Frontend (Tauri IPC) | Rust backend (path returned) | Tauri dialog plugin runs natively; path returned to JS |
| Include path UX + persistence | Frontend (React) | Rust backend (state passed to parse command) | Include paths are UI state; persisted via tauri-plugin-store on JS side |
| Proto parsing + descriptor extraction | Rust backend | — | protox + prost-reflect are Rust-only; no JS proto parser considered |
| Form schema JSON generation | Rust backend | — | Rust owns field descriptors; serializes to JSON for IPC transfer |
| Dynamic form rendering | Frontend (React) | — | Recursive React component tree driven by JSON schema |
| Field validation | Frontend (zod per-field) | Rust backend (encode returns errors) | Lightweight scalars in JS for UX; structural validation at encode time |
| Binary encoding | Rust backend | — | prost-reflect `DynamicMessage.encode()` |
| Hex preview display | Frontend (React) | — | Byte array returned from Rust IPC, converted to hex string in JS |
| Global state (loaded file, schema, form) | Frontend (Zustand store) | — | State scoped to single window; no cross-process sharing needed |
| Include path persistence | Frontend (tauri-plugin-store) | — | tauri-plugin-store handles atomic writes, app-data dir, cross-platform |

---

## Standard Stack

### Core

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `tauri` (Rust) | 2.11.2 | App framework, IPC, window management | [VERIFIED: crates.io 2026-05-16] |
| `protox` (Rust) | 0.9.1 | Runtime `.proto` compilation → `FileDescriptorSet` | [VERIFIED: crates.io 2025-12-02] |
| `prost-reflect` (Rust) | 0.16.3 | Runtime message descriptors, `DynamicMessage`, encoding | [VERIFIED: crates.io 2025-12-01] |
| `prost-types` (Rust) | 0.14.0 | `FileDescriptorSet` type (shared handoff type) | [VERIFIED: from protox + prost-reflect Cargo.toml] |
| `react-hook-form` | 7.76.0 | Form state, `useFieldArray`, `Controller`, `useWatch` | [VERIFIED: npm registry 2026-05-17] |
| `zod` | 3.24.2 | Per-field validation schemas (MUST use v3, NOT v4) | [VERIFIED: npm registry; v4 has open resolver type errors] |
| `@hookform/resolvers` | 5.2.2 | Zod resolver adapter for RHF | [VERIFIED: npm registry 2026-05-17] |
| `zustand` | 5.0.13 | Global state (active file, schema, IPC results) | [VERIFIED: npm registry 2026-05-17] |
| `tailwindcss` | 4.3.0 | Utility CSS (Vite plugin approach, CSS `@import`) | [VERIFIED: npm registry 2026-05-17] |
| `@tauri-apps/api` | 2.11.0 | Tauri `invoke()`, IPC bridge | [VERIFIED: npm registry 2026-05-17] |
| `@tauri-apps/plugin-store` | 2.4.3 | Persist include paths per file path | [VERIFIED: npm registry 2026-05-17] |
| `@tauri-apps/plugin-dialog` | 2.7.1 | Native file picker for `.proto` files | [VERIFIED: npm registry 2026-05-17] |
| `@tauri-apps/plugin-fs` | 2.5.1 | Read `.proto` file content for future use | [VERIFIED: npm registry 2026-05-17] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `serde` (Rust) | 1.x | JSON serialization for IPC | All Tauri command parameters/returns |
| `serde_json` (Rust) | 1.0.149 | JSON encode/decode for form schema | Schema serialization |
| `thiserror` (Rust) | 2.0.18 | Error types for Tauri commands | All `#[tauri::command]` functions |
| `tracing` (Rust) | 0.1 | Structured logging | Backend debug output |
| `@tailwindcss/vite` | (bundled with tailwindcss) | Vite plugin for Tailwind 4 | Required in `vite.config.ts` |
| `lucide-react` | latest | Icons (trash, plus, chevron) | UI-SPEC mandated icon library |
| `shadcn/ui` components | via CLI | button, input, select, checkbox, radio-group, dialog, collapsible, scroll-area, badge, label, separator | See Component Inventory in UI-SPEC |

### Important Version Note

> **CLAUDE.md version constraint is stale:** CLAUDE.md Version Constraints table states "both should pull `prost` 0.13.x." This is INCORRECT as of 2026-05-17.
> Both `protox` 0.9.1 and `prost-reflect` 0.16.3 depend on **`prost = "0.14.0"`** (verified from their Cargo.toml on docs.rs).
> Do NOT pin prost to 0.13.x in Cargo.toml — it will conflict. [VERIFIED: docs.rs/protox/0.9.1, docs.rs/prost-reflect/0.16.3]

### Installation

```bash
# Scaffold project
npm create tauri-app@latest
# (select: React, TypeScript, Vite)

# Add Tauri plugins via CLI (auto-updates Cargo.toml + package.json)
npm run tauri add store
npm run tauri add dialog
npm run tauri add fs

# Install frontend deps
npm install react-hook-form @hookform/resolvers zod@^3.24.2 zustand
npm install @tailwindcss/vite

# Initialize shadcn/ui for Vite
pnpm dlx shadcn@latest init -t vite
# Select zinc preset, radius 0.5rem

# Add shadcn components (from UI-SPEC Component Inventory)
pnpm dlx shadcn@latest add button input select checkbox radio-group dialog \
  collapsible scroll-area badge label separator
```

---

## Architecture Patterns

### System Architecture Diagram

```
User action (click "Open .proto file")
    │
    ▼
[React: open() from @tauri-apps/plugin-dialog]
    │  returns file path (string)
    ▼
[React: show Include Path Dialog (modal)]
    │  load persisted paths from tauri-plugin-store
    │  user adds/removes paths
    ▼
[React: invoke("parse_proto", { file_path, include_paths })]
    │
    ▼
[Rust: parse_proto command]
    │  protox::Compiler::new(include_paths)
    │    .include_imports(true)
    │    .open_file(file_path)
    │  → FileDescriptorSet
    │  prost_reflect::DescriptorPool::from_file_descriptor_set(fds)
    │  → filter top-level messages
    │  → serialize ProtoSchema (Vec<MessageSchema>) to JSON
    │
    ▼
[React: receive ProtoSchema, populate sidebar dropdown]
    │
    ▼
[React: user selects message type]
    │  reset() form with zero-value defaults from schema
    ▼
[React: ProtoFormRenderer (recursive)]
    │  walks FieldSchema tree
    │  renders: ScalarField / NestedMessageField / RepeatedField / EnumField / OneofField
    │  tracks current depth (0–5)
    │
    ▼
[React: form field onChange (debounced 200ms)]
    │
    ▼
[React: invoke("encode_message", { message_type, form_values })]
    │
    ▼
[Rust: encode_message command]
    │  prost_reflect::DynamicMessage::new(message_descriptor)
    │  populate fields from form_values JSON
    │  prost::Message::encode_to_vec()
    │  → return Vec<u8> as hex string
    │
    ▼
[React: display hex bytes in bottom strip]
```

### Recommended Project Structure

```
proto-sender/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # Tauri builder, plugin registration, invoke_handler
│   │   ├── main.rs             # Entry point (DO NOT add #[tokio::main])
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── proto.rs        # parse_proto command
│   │   │   └── encode.rs       # encode_message command
│   │   ├── schema/
│   │   │   ├── mod.rs
│   │   │   ├── extractor.rs    # Descriptor → ProtoSchema serialization
│   │   │   └── types.rs        # Serde types: FieldSchema, MessageSchema, FieldKind
│   │   └── error.rs            # AppError (thiserror)
│   ├── capabilities/
│   │   └── default.json        # fs:scope allow **/* + dialog + store permissions
│   ├── gen/apple/
│   │   └── PrivacyInfo.xcprivacy   # macOS privacy manifest (file timestamp access)
│   └── Cargo.toml
├── src/
│   ├── main.tsx
│   ├── App.tsx                 # Root layout: Sidebar + MainPanel
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainPanel.tsx
│   │   ├── form/
│   │   │   ├── ProtoFormRenderer.tsx   # Recursive entry point
│   │   │   ├── ScalarField.tsx
│   │   │   ├── NestedMessageField.tsx  # Collapsible wrapper + recurse
│   │   │   ├── RepeatedField.tsx       # useFieldArray wrapper
│   │   │   ├── EnumField.tsx
│   │   │   ├── OneofField.tsx          # RadioGroup + conditional branch mount
│   │   │   ├── WellKnownTypeField.tsx  # Timestamp / Duration / fallback
│   │   │   └── DepthCapPlaceholder.tsx
│   │   ├── sidebar/
│   │   │   ├── FileSection.tsx
│   │   │   ├── MessageTypeSelect.tsx
│   │   │   └── ConnectionPlaceholder.tsx
│   │   ├── include-paths/
│   │   │   └── IncludePathDialog.tsx
│   │   └── preview/
│   │       └── HexPreviewStrip.tsx
│   ├── stores/
│   │   └── useProtoStore.ts    # Zustand: activeFile, schema, selectedType, hexPreview
│   ├── hooks/
│   │   └── useDebounce.ts      # 200ms debounce for hex encode trigger
│   └── lib/
│       ├── types.ts            # TypeScript mirror of Rust schema types
│       └── ipc.ts              # invoke wrappers: parseProto(), encodeMessage()
├── index.css                   # @import "tailwindcss";
└── vite.config.ts              # tailwindcss() plugin + @/* alias
```

### Pattern 1: Tauri Command Definition (Rust)

```rust
// Source: https://v2.tauri.app/develop/calling-rust/
// src-tauri/src/commands/proto.rs

use crate::schema::types::{MessageSchema, ProtoSchema};
use crate::error::AppError;

#[tauri::command]
pub async fn parse_proto(
    file_path: String,
    include_paths: Vec<String>,
) -> Result<ProtoSchema, AppError> {
    let mut compiler = protox::Compiler::new(&include_paths)?;
    compiler.include_imports(true);
    compiler.open_file(&file_path)?;
    let fds = compiler.file_descriptor_set();
    let pool = prost_reflect::DescriptorPool::from_file_descriptor_set(fds)?;
    // Filter to top-level messages only (no parent_message())
    let messages: Vec<MessageSchema> = pool
        .all_messages()
        .filter(|m| m.parent_message().is_none())
        .map(|m| MessageSchema::from_descriptor(&m, 0))
        .collect();
    Ok(ProtoSchema { messages })
}
```

CRITICAL: Register all commands in `lib.rs`:
```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::proto::parse_proto,
            commands::encode::encode_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Pattern 2: Form Schema JSON Design (Rust → React bridge)

This is the load-bearing interface. The Rust `extractor.rs` serializes field descriptors to this shape:

```typescript
// src/lib/types.ts — TypeScript mirror of Rust schema types

type ScalarKind =
  | "bool" | "string" | "bytes"
  | "int32" | "int64" | "uint32" | "uint64"
  | "sint32" | "sint64"
  | "fixed32" | "fixed64" | "sfixed32" | "sfixed64"
  | "float" | "double";

type FieldKind =
  | { type: "scalar"; scalar: ScalarKind }
  | { type: "message"; full_name: string }   // resolved by name in schema map
  | { type: "enum"; values: { name: string; number: number }[] }
  | { type: "oneof"; branches: FieldSchema[][] }  // indexed by branch
  | { type: "well_known"; wkt: "Timestamp" | "Duration" | string };

interface FieldSchema {
  name: string;          // proto field name (e.g., "first_name")
  label: string;         // display label (e.g., "first_name")
  kind: FieldKind;
  repeated: boolean;     // Cardinality::Repeated → true
  oneof_group?: string;  // populated for fields in a oneof; same value for all fields in the group
  default_value?: unknown; // zero-value for this field (from prost_reflect FieldDescriptor.default_value())
}

interface MessageSchema {
  name: string;          // short name (e.g., "Order")
  full_name: string;     // fully qualified (e.g., "com.example.Order")
  fields: FieldSchema[];
}

interface ProtoSchema {
  messages: MessageSchema[];
  message_map: Record<string, MessageSchema>; // full_name → MessageSchema for nested resolution
}
```

**Form values convention for oneof:**
```typescript
// oneof fields in form values use a discriminated structure
// For a message with: oneof payment { string card_number = 1; Crypto crypto = 2; }
// Form values shape:
{
  payment: {
    _selected: "card_number",  // which branch is active
    card_number: "",           // the active branch's value
    crypto: null               // inactive branches are null/absent
  }
}
```

This shape lets the Rust encoder know exactly which branch to encode.

### Pattern 3: react-hook-form useFieldArray for Repeated Fields

```typescript
// Source: https://react-hook-form.com/ (Context7 verified v7.76.0)
// src/components/form/RepeatedField.tsx

import { useFieldArray, useFormContext } from "react-hook-form";

interface RepeatedFieldProps {
  fieldSchema: FieldSchema;
  fieldPath: string;   // e.g., "order.items"
  depth: number;
}

export function RepeatedField({ fieldSchema, fieldPath, depth }: RepeatedFieldProps) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldPath,
  });

  const getDefaultItem = () => {
    // scalar → default scalar value; message → nested defaults object
    return fieldSchema.default_value ?? "";
  };

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.id}>  {/* ALWAYS use field.id, NOT index */}
          <ProtoFormRenderer
            schema={fieldSchema}
            fieldPath={`${fieldPath}.${index}`}
            depth={depth}
          />
          <Button variant="destructive" onClick={() => remove(index)}>Remove</Button>
        </div>
      ))}
      <Button onClick={() => append(getDefaultItem())}>Add item</Button>
    </div>
  );
}
```

### Pattern 4: oneof Fields with Conditional Visibility

```typescript
// src/components/form/OneofField.tsx
// Pattern: Controller for RadioGroup + useWatch for conditional branch mount

import { Controller, useWatch, useFormContext } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function OneofField({ fieldPath, branches, branchNames, depth }) {
  const { control, unregister } = useFormContext();
  const selected = useWatch({ control, name: `${fieldPath}._selected` });

  // When selected branch changes, unregister other branches to clear their data
  // This satisfies proto wire semantics: only one oneof field is set
  React.useEffect(() => {
    branchNames.forEach(name => {
      if (name !== selected) {
        unregister(`${fieldPath}.${name}`);
      }
    });
  }, [selected, fieldPath, unregister, branchNames]);

  return (
    <div>
      <Controller
        name={`${fieldPath}._selected`}
        control={control}
        render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange}>
            {branchNames.map(name => (
              <RadioGroupItem key={name} value={name} />
            ))}
          </RadioGroup>
        )}
      />
      {/* Only render the selected branch */}
      {branchNames.map(name =>
        selected === name ? (
          <ProtoFormRenderer
            key={name}
            schema={branches[name]}
            fieldPath={`${fieldPath}.${name}`}
            depth={depth}
          />
        ) : null
      )}
    </div>
  );
}
```

### Pattern 5: Hex Preview Debounce

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// In HexPreviewStrip.tsx:
const formValues = watch();  // react-hook-form watch() for all fields
const debouncedValues = useDebounce(formValues, 200);

useEffect(() => {
  if (!selectedMessageType || !debouncedValues) return;
  invoke<number[]>("encode_message", {
    messageType: selectedMessageType,
    formValues: debouncedValues,
  })
    .then(bytes => setHex(bytes.map(b => b.toString(16).padStart(2, "0")).join(" ")))
    .catch(() => setError(true));
}, [debouncedValues, selectedMessageType]);
```

### Pattern 6: Tauri Plugin Store for Include Paths

```typescript
// Source: https://v2.tauri.app/plugin/store
import { load } from "@tauri-apps/plugin-store";

const STORE_PATH = "proto-sender.json";

export async function loadIncludePaths(filePath: string): Promise<string[]> {
  const store = await load(STORE_PATH, { autoSave: false });
  const key = `include_paths:${filePath}`;
  return (await store.get<string[]>(key)) ?? [getParentDir(filePath)];
}

export async function saveIncludePaths(filePath: string, paths: string[]): Promise<void> {
  const store = await load(STORE_PATH, { autoSave: false });
  await store.set(`include_paths:${filePath}`, paths);
  await store.save();
}
```

### Pattern 7: Tauri Capabilities (fs arbitrary read)

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for Proto Sender",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "fs:default",
    "fs:allow-read-text-file",
    {
      "identifier": "fs:scope",
      "allow": [{ "path": "**/*" }]
    },
    "store:default",
    "store:allow-load",
    "store:allow-set",
    "store:allow-save",
    "store:allow-get"
  ]
}
```

```xml
<!-- src-tauri/gen/apple/PrivacyInfo.xcprivacy — macOS arbitrary file read -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

Also add macOS entitlement in `tauri.conf.json` for unrestricted file access:
```json
// inside tauri.conf.json → bundle → macOS → entitlements
"com.apple.security.temporary-exception.files.absolute-path.read-write": ["/"]
```
[VERIFIED: GitHub discussion tauri-apps/discussions#11792]

### Pattern 8: Tailwind 4 + shadcn/ui in Vite

```typescript
// vite.config.ts — Source: https://ui.shadcn.com/docs/installation/vite
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  // Tauri-specific: use process.env.TAURI_DEV_HOST or localhost
  server: { port: 1420, strictPort: true },
});
```

```css
/* src/index.css — Tailwind 4 uses CSS @import, not tailwind.config.js */
@import "tailwindcss";
/* shadcn/ui theme variables follow (generated by `shadcn init`) */
```

Note: Tailwind 4 does NOT use `tailwind.config.js`. The `@theme` directive in CSS replaces it. `shadcn init` generates the CSS variables automatically. [VERIFIED: ui.shadcn.com/docs/tailwind-v4, ui.shadcn.com/docs/installation/vite]

### Anti-Patterns to Avoid

- **`#[tokio::main]` in main.rs:** Tauri manages the async runtime. Adding `#[tokio::main]` creates a nested runtime conflict and panics at startup. [VERIFIED: CLAUDE.md, Tauri docs]
- **`tokio::spawn` in event listeners:** Use `tauri::async_runtime::spawn` instead — bare `tokio::spawn` panics on Windows in Tauri 2. [VERIFIED: GitHub tauri#10289]
- **`&str` parameters in `#[tauri::command]`:** Use `String` instead. Borrowed types are unsupported in async Tauri commands. [VERIFIED: v2.tauri.app/develop/calling-rust]
- **Pinning `prost` to 0.13.x:** protox 0.9.1 and prost-reflect 0.16.3 both require prost 0.14.0. Pinning 0.13.x breaks the build. [VERIFIED: docs.rs Cargo.toml files]
- **Installing zod v4:** Active type errors in @hookform/resolvers 5.2.x with zod 4. Pin `zod@^3.24.2`. [VERIFIED: GitHub resolvers#799, resolvers#813]
- **Using `field.index` as React key in useFieldArray:** Always use `field.id` — using the index causes incorrect re-renders when items are removed. [VERIFIED: react-hook-form docs]
- **`setValue("nestedKey", { subfield: value })` for nested fields:** Prefer targeting the specific nested path: `setValue("nestedKey.subfield", value)` for performance. [VERIFIED: react-hook-form docs]
- **WellKnownType `Any` in Phase 1:** Do NOT implement `google.protobuf.Any` handling — it is deferred to Phase 3 (PROT-03). If `Any` is encountered, render a plain string input with label annotation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `.proto` file compilation at runtime | Custom lexer/parser | `protox::Compiler` | Proto grammar is complex; import resolution, syntax variants (proto2/3) are error-prone |
| Binary protobuf encoding | Manual varint/wire-type encoding | `prost_reflect::DynamicMessage` + `prost::Message::encode_to_vec()` | Varint encoding, wire types, oneof semantics, repeated packing — all handled |
| File picker native dialog | Custom webview file UI | `@tauri-apps/plugin-dialog` `open()` | OS native picker; no sandbox bypass needed |
| App-data directory resolution | Hardcoded paths | `tauri-plugin-store` | Handles macOS `~/Library/Application Support`, Windows `%APPDATA%`, Linux `~/.local/share` |
| Form debounce | `setTimeout` per field | `useDebounce` hook (tiny, copy-paste) | Simple enough to hand-roll for one hook; no library needed |
| Atomic store writes | Custom file write | `tauri-plugin-store` with `store.save()` | Atomic writes, concurrent access safe |

**Key insight:** The protobuf encoding path has irreducible complexity — varint encoding, ZigZag for sint32/sint64, little-endian for fixed32/fixed64, packed repeated fields, oneof wire semantics. Do NOT attempt to re-implement any portion of this.

---

## FORM-09: WellKnownType Scope for Phase 1

Phase 1 implements FORM-09 for **Timestamp and Duration only**. The detection strategy:

```typescript
// In ProtoFormRenderer / WellKnownTypeField
function isWellKnownType(fullName: string): string | null {
  if (fullName === "google.protobuf.Timestamp") return "Timestamp";
  if (fullName === "google.protobuf.Duration") return "Duration";
  // All other WKTs: treat as generic, show plain string input with annotation
  return null;
}
```

**Timestamp control:**
- Date + time inputs (HTML `<input type="datetime-local">` or a minimal date-time picker)
- Output: ISO 8601 string sent to Rust backend, which converts to `seconds` + `nanos` fields of the nested `google.protobuf.Timestamp` message
- Rust encodes Timestamp as a nested message with `seconds: i64` and `nanos: i32`

**Duration control:**
- Text `<Input>` with placeholder `e.g. 1h30m` or `90s`
- Validated against pattern: `^(\d+h)?(\d+m)?(\d+(\.\d+)?s)?$` (lenient; Rust validates the parsed value)
- Rust parses the string to `seconds: i64` + `nanos: i32`

**Other WellKnownTypes (fallback, Phase 1):**
- Render as a plain `<Input type="text">` with a `<Badge>` annotation showing the WKT name (e.g., `google.protobuf.Any`)
- Do NOT block on WKT completeness — the UI-SPEC explicitly specifies this fallback
- PROT-03 (Phase 3) will replace these fallbacks with purpose-built controls

**Rust-side note:** WellKnownTypes are regular protobuf messages from the `google/protobuf/` standard library. `protox::Compiler` automatically includes them when `include_imports(true)` is set. `prost-reflect` handles them via the `ReflectMessage` trait implemented for `prost_types::Timestamp` and `prost_types::Duration`.

---

## Common Pitfalls

### Pitfall 1: prost Version Mismatch

**What goes wrong:** Cargo resolves a different version of `prost` or `prost-types` than what protox and prost-reflect expect. Build fails with trait implementation errors.
**Why it happens:** If Cargo.toml lists `prost = "0.13"` explicitly or another crate pulls in 0.13, Cargo may unify to the wrong version.
**How to avoid:** Do NOT specify `prost` directly in Cargo.toml. Let `protox` 0.9.1 and `prost-reflect` 0.16.3 determine the version (both will resolve to 0.14.0). Only add `prost-types = "0.14"` if you need it directly.
**Warning signs:** Compiler error "the trait `prost::Message` is implemented for..." with conflicting crate versions; `cargo tree | grep prost` shows multiple versions.

### Pitfall 2: zod v4 Type Errors with @hookform/resolvers

**What goes wrong:** `zodResolver(schema)` produces TypeScript type errors; form validation may not trigger correctly.
**Why it happens:** zod 4 changed internal types that @hookform/resolvers 5.x checked via `_def.typeName` — compatibility fixes were partially applied but type errors remain in certain patterns.
**How to avoid:** Pin `"zod": "^3.24.2"` in package.json. Do NOT run `npm install zod` without a version specifier — npm will resolve to 4.x.
**Warning signs:** TypeScript errors mentioning `Resolver<input<T>>` vs `Resolver<output<T>>` mismatch.

### Pitfall 3: Tailwind 4 Config Confusion

**What goes wrong:** Developer creates `tailwind.config.js` or uses `@tailwind base/components/utilities` directives — styles don't apply; build warnings appear.
**Why it happens:** Tailwind 4 replaced the config file with `@theme` CSS directive and the `@import "tailwindcss"` entry point.
**How to avoid:** Use `@import "tailwindcss"` in `index.css`. Let `shadcn init` generate the CSS variables. Do not create `tailwind.config.js`.
**Warning signs:** CSS classes not applying in development but no build errors; missing `@tailwindcss/vite` in `vite.config.ts`.

### Pitfall 4: Tauri fs Permission Denied for User-Selected Files

**What goes wrong:** App opens file picker, user selects a `.proto` file, read attempt returns `PermissionDenied`.
**Why it happens:** Tauri 2's capability system requires explicit scope grants. The default `fs:default` only grants access to application-specific directories, not arbitrary user paths.
**How to avoid:** Add `{ "identifier": "fs:scope", "allow": [{ "path": "**/*" }] }` to capabilities. On macOS, add `com.apple.security.temporary-exception.files.absolute-path.read-write` entitlement.
**Warning signs:** Error in Tauri log: `fs::read_to_string: PermissionDenied`; Rust command returns AppError with permission message.

### Pitfall 5: Recursive Proto Types Crashing the Renderer

**What goes wrong:** A proto message that contains itself as a field (e.g., `TreeNode { children: repeated TreeNode }`) causes infinite React recursion or stack overflow.
**Why it happens:** The recursive `ProtoFormRenderer` doesn't track depth.
**How to avoid:** Pass `depth: number` prop to `ProtoFormRenderer`. When `depth >= 5`, render `<DepthCapPlaceholder />` instead of recursing. This must apply regardless of whether the type is directly or indirectly recursive.
**Warning signs:** Browser tab freezing on load; React "Maximum call stack size exceeded" error.

### Pitfall 6: Form Reset on Message Type Switch

**What goes wrong:** After switching message type, old field names from the previous schema remain in form state and get sent to the encoder.
**Why it happens:** react-hook-form caches field values; `reset()` must be called with the new message type's zero-value defaults.
**How to avoid:** On message type selection, call `reset(buildDefaultValues(newSchema))` where `buildDefaultValues` recursively constructs the zero-value object matching the new schema's shape.
**Warning signs:** Rust encoder receives unexpected fields; encode command returns parse errors for fields not in the current schema.

### Pitfall 7: `#[tokio::main]` in Tauri main.rs

**What goes wrong:** App panics at startup with "Cannot start a runtime from within a runtime."
**Why it happens:** Tauri creates its own Tokio runtime. Adding `#[tokio::main]` creates a second one.
**How to avoid:** `main.rs` should only call `proto_sender_lib::run()`. No `#[tokio::main]` macro.
**Warning signs:** Immediate panic at app launch; no UI appears.

---

## Form Validation Strategy

Building a complete zod schema dynamically from the full descriptor tree is high complexity (nested discriminated unions for oneofs, recursive messages, repeated array shapes). The recommended strategy for Phase 1 is:

**Lightweight per-field validation (JavaScript/zod):**
- `int32`: `z.number().int().min(-2147483648).max(2147483647)`
- `uint32`: `z.number().int().min(0).max(4294967295)`
- `int64/uint64`: `z.string()` (JS number loses precision; send as string, Rust parses)
- `float/double`: `z.number()`
- `bool`: `z.boolean()`
- `string`: `z.string()`
- `enum`: `z.number().int()` (enum number is validated against descriptor in Rust)

**Structural validation at Rust boundary:**
- `encode_message` returns a structured `AppError` with field path + message when a value cannot be encoded
- React catches this error and displays it as an inline field error using `setError()` from react-hook-form

This approach avoids the complexity of generating full nested zod schemas while covering the most common user errors.

**Note on int64/uint64:** JavaScript `Number` loses precision for values > 2^53. Send int64/uint64 as strings from the form; Rust parses them with `str::parse::<i64>()`. This is the correct approach — do not attempt int64 as JS number.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prost` 0.13.x (CLAUDE.md) | prost 0.14.x (via protox + prost-reflect) | protox 0.9.1 released Dec 2025 | Do not pin 0.13 in Cargo.toml |
| Tailwind 3 `tailwind.config.js` | Tailwind 4 `@import "tailwindcss"` CSS directive | Tailwind 4.0 release | No config file needed; use `@tailwindcss/vite` plugin |
| zod 3.x resolver compatibility | zod 4 has open type errors with @hookform/resolvers | mid-2025 | Pin to `zod@^3.24.2` |
| shadcn `forwardRef` components | shadcn React 19 removes forwardRef, adds `data-slot` | shadcn Tailwind v4 update | New shadcn init generates React 19 compatible components |

---

## Open Questions (RESOLVED)

1. **fixed32 / sfixed32 / fixed64 / sfixed64 in Phase 1**
   - What we know: FORM-01 lists `sint32/sint64` but not `fixed/sfixed` variants. REQUIREMENTS.md FORM-01 says "string, int32, int64, uint32, uint64, sint32, sint64, float, double, bool" — omitting fixed types.
   - What's unclear: fixed32/sfixed32/fixed64/sfixed64 appear in real proto files. They map to `Value::U32`, `Value::I32`, `Value::U64`, `Value::I64` respectively (same underlying type as int variants, just different wire format). The renderer would be identical.
   - Recommendation: Render fixed/sfixed variants identically to their int/uint counterparts — same input, same validation. Include in FORM-01 scope implicitly. Planner should confirm before locking task scope.
   - RESOLVED: `fixed32`/`sfixed32`/`fixed64`/`sfixed64` variants render identically to their `int32`/`uint32` counterparts — included in `ScalarKind` in the plan. The Rust encoder handles all four via the same `Value::I32`/`Value::U32`/`Value::I64`/`Value::U64` arms (with different wire-type packing handled transparently by prost).

2. **int64/uint64 precision: string or BigInt?**
   - What we know: JS Number loses precision above 2^53. The recommended approach is to send as strings.
   - What's unclear: Should the UI show a plain text input or a BigInt-aware number input?
   - Recommendation: Plain text input (`<Input type="text">`) with regex validation `^-?\d+$` (or `^\d+$` for uint64). Rust parses as i64/u64. No BigInt library needed.
   - RESOLVED: `int64`/`uint64` fields use plain `<input type="text">` with regex validation (`/^-?\d+$/` for int64, `/^\d+$/` for uint64) — no BigInt library added in Phase 1. The Rust encoder's `str::parse::<i64>()` arm handles the string-to-integer conversion.

3. **bytes field in Phase 1**
   - What we know: REQUIREMENTS.md marks `bytes` as FORM-V2-01 (Phase 2). However, the proto `Kind::Bytes` will appear in real proto files.
   - What's unclear: Should Phase 1 render a disabled placeholder for bytes fields?
   - Recommendation: Render bytes as a plain text input with badge "bytes (base64)" and accept base64-encoded input. Send as raw bytes decoded in Rust. This avoids blocking while keeping v2 enhancements deferred (the v2 UX adds a UTF-8 helper button). Planner should confirm.
   - RESOLVED: `bytes` fields render as a disabled base64 `<input type="text">` with a `bytes (base64)` badge annotation — the input accepts base64-encoded text, which the Rust encoder decodes with `base64_decode_or_empty()`. The v2 UX improvement (UTF-8 helper button, hex view toggle) is deferred per FORM-V2-01 as confirmed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust / cargo | Tauri backend build | Yes | 1.95.0 (stable-aarch64-apple-darwin) | — |
| Node.js | Frontend build | Yes | v24.9.0 | — |
| npm | Package management | Yes | 11.6.0 | — |
| Tauri CLI (`@tauri-apps/cli`) | `npm run tauri *` commands | Not installed | — | Installed as dev dep during Wave 0 setup |
| `create-tauri-app` | Project scaffolding | Not installed | — | Run `npm create tauri-app@latest` (downloads on demand) |
| WebKit / WebView2 | Tauri window rendering | macOS system (WebKit bundled) | macOS 26.4.1 | — |
| `protoc` | Proto compilation | Not needed | — | protox does NOT shell out to protoc; fully self-contained |

**Missing dependencies with fallback:**
- Tauri CLI: `npm create tauri-app@latest` downloads `@tauri-apps/cli` as a dev dependency during scaffolding. No pre-install needed.

**Nothing blocking execution.** Rust, Node, and macOS WebKit are all available.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `com.apple.security.temporary-exception.files.absolute-path.read-write` entitlement grants read access to any user file on macOS | Environment Availability / Pattern 7 | macOS may reject entitlement; need to test during Wave 0 setup |
| A2 | `gen/apple/PrivacyInfo.xcprivacy` path is correct for Tauri 2 macOS app | Pattern 7 | Wrong path means macOS App Store submission fails (not a dev concern for Phase 1) |
| A3 | `protox::Compiler::new(include_paths).include_imports(true).open_file(path)` returns a `FileDescriptorSet` synchronously without spawning threads | Standard Stack / Pattern 1 | If async, must use `tauri::async_runtime::spawn`; command is already `async` so this is fine either way |
| A4 | `DescriptorPool::all_messages()` returns only message types (not enums or services) | Architecture Patterns | If it returns all types, need additional filter |
| A5 | `m.parent_message().is_none()` correctly identifies top-level messages (vs nested message types) | Pattern 1 | If nested messages inside oneofs have `parent_message() == None`, dropdown would show nested types |
| A6 | Duration string `e.g. 1h30m` parsing in Rust is straightforward with a regex | FORM-09 | May need a duration parsing crate; `humantime` crate covers this if regex is insufficient |

---

## Sources

### Primary (HIGH confidence)
- [protox Compiler API — docs.rs/protox/0.9.1](https://docs.rs/protox/latest/protox/struct.Compiler.html) — Compiler constructor, include_imports, open_file, file_descriptor_set
- [prost-reflect — docs.rs/prost-reflect/0.16.3](https://docs.rs/prost-reflect/latest/prost_reflect/) — DescriptorPool, MessageDescriptor, FieldDescriptor, DynamicMessage, Value enum, Cardinality enum, Kind enum
- [Tauri 2 IPC — v2.tauri.app/develop/calling-rust](https://v2.tauri.app/develop/calling-rust) — `#[tauri::command]`, async commands, `invoke_handler`
- [Tauri plugin-store — v2.tauri.app/plugin/store](https://v2.tauri.app/plugin/store) — `load()`, `set()`, `get()`, `save()` API
- [Tauri plugin-fs — v2.tauri.app/plugin/file-system](https://v2.tauri.app/plugin/file-system) — permissions, scope configuration, `fs:scope allow **/*`
- [Tauri plugin-dialog — v2.tauri.app/plugin/dialog](https://v2.tauri.app/plugin/dialog) — `open()` with file filters
- [shadcn/ui Tailwind v4 — ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — breaking changes, @theme directive, shadcn init for Tailwind 4
- [shadcn/ui Vite — ui.shadcn.com/docs/installation/vite](https://ui.shadcn.com/docs/installation/vite) — Vite-specific setup, `@tailwindcss/vite` plugin, path aliases
- [react-hook-form v7.76.0 — react-hook-form.com](https://react-hook-form.com/) — `useFieldArray`, `useWatch`, `Controller`, `setValue`, `reset`, `unregister`
- [Tauri arbitrary file access — github.com/orgs/tauri-apps/discussions/11792](https://github.com/orgs/tauri-apps/discussions/11792) — `fs:scope allow **/*` + macOS entitlement pattern
- [protox 0.9.1 Cargo.toml — docs.rs](https://docs.rs/crate/protox/0.9.1/source/Cargo.toml) — prost 0.14.0 dependency verified
- [prost-reflect 0.16.3 Cargo.toml — docs.rs](https://docs.rs/crate/prost-reflect/0.16.3/source/Cargo.toml) — prost 0.14.0 dependency verified

### Secondary (MEDIUM confidence)
- [GitHub tauri-apps/tauri#10289](https://github.com/tauri-apps/tauri/issues/10289) — tokio::spawn panic in Tauri 2 Windows event listeners
- [zod v4 resolver type errors — github.com/react-hook-form/resolvers/issues/799](https://github.com/react-hook-form/resolvers/issues/799) — active compatibility issues confirming pin to zod 3
- [Zustand 5.x — pmndrs/zustand](https://github.com/pmndrs/zustand) — create(), TypeScript typing, selector pattern

### Tertiary (LOW confidence — needs verification during Wave 0)
- macOS `com.apple.security.temporary-exception.files.absolute-path.read-write` behavior — sourced from GitHub discussion thread, not official Apple docs

---

## Metadata

**Confidence breakdown:**
- Standard stack + versions: HIGH — all package versions verified via npm registry and crates.io 2026-05-17
- protox + prost-reflect API: HIGH — docs.rs verified, Cargo.toml prost version confirmed (0.14.0 not 0.13.x)
- Tauri IPC + plugin patterns: HIGH — official docs verified via Context7 + WebFetch
- Form schema JSON design: MEDIUM — designed from first principles based on FieldDescriptor/Kind/Cardinality APIs; no prior art in codebase
- Tailwind 4 + shadcn/ui in Tauri: MEDIUM — shadcn docs verified; Tauri-specific integration needs Wave 0 validation
- zod v4 pitfall: HIGH — confirmed via multiple GitHub issues as open/unresolved

**Research date:** 2026-05-17
**Valid until:** ~2026-06-17 (npm versions); ~2026-07-17 (crate versions — slow-moving ecosystem)
