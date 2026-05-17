# Phase 2: Connect + Publish - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 12 new/modified files
**Analogs found:** 8 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/stores/useConnectionStore.ts` | store | request-response | `src/stores/useProtoStore.ts` | exact |
| `src/components/sidebar/ConnectionSection.tsx` | component | request-response | `src/components/sidebar/FileSection.tsx` + `src/components/sidebar/Sidebar.tsx` L28–48 | exact (composite) |
| `src/components/sidebar/Sidebar.tsx` (modified) | component | — | self (L52) | exact |
| `src/components/connection/ProfileManagementModal.tsx` | component | request-response | `src/components/include-paths/IncludePathDialog.tsx` | exact |
| `src/components/connection/ConnectionTestResult.tsx` | component | request-response | none | no analog |
| `src/components/publish/PublishBar.tsx` | component | request-response | none | no analog |
| `src/lib/ipc.ts` (modified) | utility | request-response | self (L1–16) | exact |
| `src/lib/types.ts` (modified) | types | — | self (L1–60) | exact |
| `src-tauri/src/commands/connection.rs` | command | request-response | `src-tauri/src/commands/proto.rs` | exact |
| `src-tauri/src/commands/publish.rs` | command | request-response | `src-tauri/src/commands/encode.rs` | exact |
| `src-tauri/src/profiles/mod.rs` | model | CRUD | `src-tauri/src/schema/types.rs` | role-match |
| `src-tauri/src/error.rs` (modified) | utility | — | self (L1–20) | exact |
| `src-tauri/src/lib.rs` (modified) | config | — | self (L1–21) | exact |

---

## File Layout Note

RESEARCH.md proposes two alternative structures for new Rust modules. The planner must choose one:

**Option A (RESEARCH.md, recommended):**
```
src-tauri/src/
├── commands/connection.rs   # save_profile, test_connection, activate_profile, fetch_queues, fetch_exchanges
├── commands/publish.rs      # publish_message
└── profiles/mod.rs          # ConnectionProfile struct + keyring + store helpers
```

**Option B (CONTEXT.md, flatter):**
```
src-tauri/src/
├── amqp/                    # lapin AMQP client module
├── management_api.rs        # reqwest HTTP client
└── keychain.rs              # keyring-core OS keychain
```

Option A is preferred: it follows the existing `commands/` and `schema/` module separation already in the codebase.

---

## Pattern Assignments

### `src/stores/useConnectionStore.ts` (store, request-response)

**Analog:** `src/stores/useProtoStore.ts`

**Imports pattern** (`src/stores/useProtoStore.ts` lines 1–2):
```typescript
import { create } from "zustand";
import type { ProtoSchema } from "@/lib/types";
```

**Interface + INITIAL_STATE pattern** (`src/stores/useProtoStore.ts` lines 4–27):
```typescript
interface ProtoStore {
  activeFilePath: string | null;
  schema: ProtoSchema | null;
  selectedMessageType: string | null;
  hexPreview: string;
  isEncoding: boolean;
  encodeError: string | null;

  setFile: (filePath: string, schema: ProtoSchema) => void;
  setSelectedType: (messageType: string) => void;
  setHexPreview: (hex: string) => void;
  setEncoding: (isEncoding: boolean) => void;
  setEncodeError: (error: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  activeFilePath: null,
  schema: null,
  selectedMessageType: null,
  hexPreview: "",
  isEncoding: false,
  encodeError: null,
} as const;
```

**create() pattern** (`src/stores/useProtoStore.ts` lines 29–52):
```typescript
export const useProtoStore = create<ProtoStore>((set) => ({
  ...INITIAL_STATE,

  setFile: (filePath, schema) =>
    set({
      activeFilePath: filePath,
      schema,
      selectedMessageType:
        schema.messages.length > 0 ? schema.messages[0].full_name : null,
      hexPreview: "",
      encodeError: null,
    }),

  setEncodeError: (error) => set({ encodeError: error }),

  reset: () => set({ ...INITIAL_STATE }),
}));
```

**Adaptation notes:**
- Replace `ProtoStore` interface with `ConnectionStore` interface
- State: `profiles: ConnectionProfile[]`, `activeProfileName: string | null`, `connectionStatus: "connected" | "error" | "disconnected"`, `connectionError: string | null`, `managementStatus: "live" | "manual" | "unknown"`, `queues: string[]`, `exchanges: string[]`
- Password NEVER in store — only in Rust keyring
- Actions: `setProfiles`, `setActiveProfile`, `setConnectionStatus`, `setQueues`, `setExchanges`

---

### `src/components/sidebar/ConnectionSection.tsx` (component, request-response)

**Analog A — IPC + store + dialog trigger:** `src/components/sidebar/FileSection.tsx`

**Imports pattern** (`src/components/sidebar/FileSection.tsx` lines 1–7):
```typescript
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { Button } from "@/components/ui/button";
import { IncludePathDialog } from "@/components/include-paths/IncludePathDialog";
import { parseProto } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";
```

**Modal open pattern** (`src/components/sidebar/FileSection.tsx` lines 29–58):
```typescript
const [dialogOpen, setDialogOpen] = useState(false);

const handleOpenFile = async () => {
  // ...
  setDialogOpen(true);
};
// Dialog rendered at bottom: <IncludePathDialog open={dialogOpen} ... />
```

**Error display pattern** (`src/components/sidebar/FileSection.tsx` lines 115–119):
```typescript
{parseError && (
  <p className="text-xs text-destructive" role="alert">
    {parseError}
  </p>
)}
```

**Analog B — Select dropdown + section label:** `src/components/sidebar/Sidebar.tsx` lines 28–49
```typescript
{schema && schema.messages.length > 0 && (
  <>
    <Separator />
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Message Type</label>
      <Select
        value={selectedMessageType ?? ""}
        onValueChange={setSelectedType}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select message..." />
        </SelectTrigger>
        <SelectContent>
          {schema.messages.map((msg) => (
            <SelectItem key={msg.full_name} value={msg.full_name}>
              {msg.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </>
)}
```

**Muted hint pattern (D-03 "Add connection")** (`src/components/sidebar/Sidebar.tsx` lines 18–21):
```typescript
<p className="text-xs text-muted-foreground">
  Load a .proto file to get started
</p>
```

**Adaptation notes:**
- When `profiles.length === 0`: render muted hint with `text-xs text-muted-foreground` (same class as Sidebar.tsx L19)
- When profiles exist: render `<Select>` (same pattern as Message Type, Sidebar.tsx L33–48) + status dot (`<span>` with `bg-green-500` / `bg-red-500` / `bg-gray-400` based on `connectionStatus`) + gear `<Button variant="ghost" size="sm">` that sets `dialogOpen = true`
- Gear button opens `<ProfileManagementModal>` (same modal-trigger pattern as FileSection.tsx L29–31)

---

### `src/components/sidebar/Sidebar.tsx` (modified)

**Exact change location** (`src/components/sidebar/Sidebar.tsx` line 52):
```typescript
// BEFORE (line 52):
<div className="flex-1" />

// AFTER:
<ConnectionSection />
```

**Import to add** (top of file, alongside existing imports):
```typescript
import { ConnectionSection } from "@/components/sidebar/ConnectionSection";
```

---

### `src/components/connection/ProfileManagementModal.tsx` (component, request-response)

**Analog:** `src/components/include-paths/IncludePathDialog.tsx`

**Imports pattern** (`src/components/include-paths/IncludePathDialog.tsx` lines 1–11):
```typescript
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

**Dialog shell pattern** (`src/components/include-paths/IncludePathDialog.tsx` lines 57–101):
```typescript
// Props interface pattern (lines 13–18):
interface IncludePathDialogProps {
  open: boolean;
  initialPaths: string[];
  onConfirm: (paths: string[]) => void;
  onCancel: () => void;
}

// Dialog open/onOpenChange/close (lines 58–59):
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Configure include paths</DialogTitle>
    </DialogHeader>
    {/* body */}
    <DialogFooter className="gap-2">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Discard path changes
      </Button>
      <Button type="button" onClick={() => onConfirm(paths)}>
        Load file
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**useEffect re-init on open pattern** (`src/components/include-paths/IncludePathDialog.tsx` lines 40–44):
```typescript
useEffect(() => {
  if (isOpen) {
    setPaths(initialPaths);
  }
}, [isOpen, initialPaths]);
```

**Adaptation notes:**
- Replace `IncludePathDialogProps` with `ProfileManagementModalProps { open: boolean; onClose: () => void; }`
- Replace path list with profile list (name + edit/delete buttons)
- "+ New Profile" button shows inline form (local `useState` for form mode: `"list" | "create"`)
- Form fields: host, port, vhost, username, password (masked `<Input type="password">`), managementPort
- On save: call `saveProfile` IPC, then show `<ConnectionTestResult>` inline below form
- Async action follows the `handleConfirm` async pattern from FileSection.tsx lines 60–88

---

### `src/lib/ipc.ts` (modified)

**Analog:** `src/lib/ipc.ts` — existing file (self-reference)

**Existing pattern** (`src/lib/ipc.ts` lines 1–16):
```typescript
import { invoke } from "@tauri-apps/api/core";
import type { ProtoSchema } from "./types";

export async function parseProto(
  filePath: string,
  includePaths: string[]
): Promise<ProtoSchema> {
  return invoke<ProtoSchema>("parse_proto", { filePath, includePaths });
}

export async function encodeMessage(
  messageType: string,
  formValues: unknown
): Promise<number[]> {
  return invoke<number[]>("encode_message", { messageType, formValues });
}
```

**New functions to add (copy pattern exactly):**
```typescript
// Append to src/lib/ipc.ts — do not restructure existing functions
import type { ConnectionProfile } from "./types";

export async function saveProfile(profile: ConnectionProfile): Promise<void> {
  return invoke<void>("save_profile", { profile });
}

export async function testConnection(profileName: string): Promise<void> {
  return invoke<void>("test_connection", { profileName });
}

export async function fetchQueues(profileName: string): Promise<string[]> {
  return invoke<string[]>("fetch_queues", { profileName });
}

export async function fetchExchanges(profileName: string): Promise<string[]> {
  return invoke<string[]>("fetch_exchanges", { profileName });
}

export async function publishMessage(
  exchange: string,
  routingKey: string,
  payload: number[]
): Promise<void> {
  return invoke<void>("publish_message", { exchange, routingKey, payload });
}
```

---

### `src/lib/types.ts` (modified)

**Analog:** `src/lib/types.ts` — existing file (self-reference)

**Existing type definition style** (`src/lib/types.ts` lines 1–60):
- String literal unions for variant types (e.g., `"bool" | "string" | ...`)
- `interface` for object shapes with named fields
- `export interface` for IPC data contracts

**New types to append:**
```typescript
// Append to src/lib/types.ts

export interface ConnectionProfile {
  name: string;
  host: string;
  port: number;         // default 5672
  vhost: string;        // default "/"
  username: string;
  managementPort: number; // default 15672
  // password NOT included — retrieved from OS keychain by Rust backend only
}

export type ConnectionStatus = "connected" | "error" | "disconnected";
export type ManagementStatus = "live" | "manual" | "unknown";
```

---

### `src-tauri/src/commands/connection.rs` (command, request-response)

**Analog:** `src-tauri/src/commands/proto.rs`

**Imports pattern** (`src-tauri/src/commands/proto.rs` lines 1–3):
```rust
use crate::error::AppError;
use crate::schema::{extractor, types::ProtoSchema};
use std::sync::Mutex;
```

**Tauri command signature pattern** (`src-tauri/src/commands/proto.rs` lines 5–23):
```rust
#[tauri::command]
pub async fn parse_proto(
    file_path: String,
    include_paths: Vec<String>,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<ProtoSchema, AppError> {
    let mut compiler = protox::Compiler::new(&include_paths)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    // ...
    Ok(schema)
}
```

**Adaptation notes:**
- New commands: `save_profile`, `test_connection`, `activate_profile`, `fetch_queues`, `fetch_exchanges`
- Replace `pool_state: tauri::State<'_, ...>` with `store: tauri::State<'_, tauri_plugin_store::StoreState>` if using managed store, or use `tauri_plugin_store::StoreCollection` — verify exact Tauri plugin-store API
- Error variants: `AppError::AmqpError(String)`, `AppError::KeyringError(String)`, `AppError::ManagementApiError(String)`, `AppError::ManagementApiUnavailable` — add to `error.rs`
- Use `tauri::async_runtime::spawn` for any fire-and-forget background tasks; commands themselves are `async fn` and can `.await` directly

---

### `src-tauri/src/commands/publish.rs` (command, request-response)

**Analog:** `src-tauri/src/commands/encode.rs`

**Imports pattern** (`src-tauri/src/commands/encode.rs` lines 1–6):
```rust
use crate::error::AppError;
use prost_reflect::prost::Message;
use prost_reflect::{DynamicMessage, FieldDescriptor, Kind, MessageDescriptor, Value};
use serde_json::Value as JsonValue;
use std::sync::Mutex;
```

**Command + error mapping pattern** (`src-tauri/src/commands/encode.rs` lines 7–39):
```rust
#[tauri::command]
pub async fn encode_message(
    message_type: String,
    form_values: JsonValue,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<Vec<u8>, AppError> {
    let pool_guard = pool_state.lock().unwrap();
    let pool = pool_guard.as_ref().ok_or_else(|| {
        AppError::EncodeError {
            field: "<root>".to_string(),
            message: "No proto file has been parsed yet".to_string(),
        }
    })?;
    // ...
    Ok(buf)
}
```

**Test structure pattern** (`src-tauri/src/commands/encode.rs` lines 329–433):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_scalar_flat_message() {
        // Arrange
        let pool = make_pool_with_schema(...);
        // Act
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();
        // Assert
        assert!(!buf.is_empty(), "encoded bytes should not be empty");
    }
}
```

**Adaptation notes:**
- `publish_message` command signature: `exchange: String, routing_key: String, payload: Vec<u8>` — no `tauri::State` needed (ephemeral connection strategy from RESEARCH.md)
- Fetch active profile credentials from `profiles/mod.rs` helpers (not from managed state)
- Return `Result<(), AppError>` not `Result<Vec<u8>, AppError>`

---

### `src-tauri/src/profiles/mod.rs` (model, CRUD)

**Analog:** `src-tauri/src/schema/types.rs`

**Struct + derive pattern** (`src-tauri/src/schema/types.rs` lines 1–8):
```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProtoSchema {
    pub messages: Vec<MessageSchema>,
    pub message_map: HashMap<String, MessageSchema>,
}
```

**serde rename pattern** (`src-tauri/src/schema/types.rs` lines 27–35):
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldKind {
    Scalar { scalar: ScalarKind },
    Message { full_name: String },
    // ...
}
```

**Adaptation notes:**
- `ConnectionProfile` struct: `name: String`, `host: String`, `port: u16`, `vhost: String`, `username: String`, `management_port: u16`
- Password NOT in struct — only retrieved from keyring
- Add `KEYRING_SERVICE: &str = "dev.protosender.app"` constant
- Helper functions: `store_password(profile_name: &str, password: &str)`, `get_password(profile_name: &str)`, `delete_password(profile_name: &str)`

---

### `src-tauri/src/error.rs` (modified)

**Analog:** self (`src-tauri/src/error.rs`)

**Existing variants + Serialize impl** (`src-tauri/src/error.rs` lines 1–20):
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

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

**New variants to add (copy existing pattern exactly):**
```rust
#[error("AMQP error: {0}")]
AmqpError(String),
#[error("Keyring error: {0}")]
KeyringError(String),
#[error("Management API error: {0}")]
ManagementApiError(String),
#[error("Management API unavailable (HTTP {0})")]
ManagementApiUnavailable(u16),
#[error("Management API authentication failed")]
ManagementApiAuthFailed,
```

---

### `src-tauri/src/lib.rs` (modified)

**Analog:** self (`src-tauri/src/lib.rs`)

**Existing plugin + handler registration** (`src-tauri/src/lib.rs` lines 1–21):
```rust
use std::sync::Mutex;

mod commands;
mod error;
mod schema;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(Option::<prost_reflect::DescriptorPool>::None))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::proto::parse_proto,
            commands::encode::encode_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Changes required:**
1. Add `mod profiles;` after `mod schema;`
2. Add `commands::connection::save_profile`, `commands::connection::test_connection`, `commands::connection::activate_profile`, `commands::connection::fetch_queues`, `commands::connection::fetch_exchanges`, `commands::publish::publish_message` inside `tauri::generate_handler![]`
3. Add keyring store initialization block before `tauri::Builder::default()`:
```rust
// Platform-specific keyring store registration (call before Builder)
#[cfg(target_os = "linux")]
{ /* set_default_store(dbus_secret_service_keyring_store::Store::new()?) */ }
#[cfg(target_os = "macos")]
{ /* set_default_store(apple_native_keyring_store::Store::new()?) */ }
#[cfg(target_os = "windows")]
{ /* set_default_store(windows_native_keyring_store::Store::new()?) */ }
```

---

### `src-tauri/src/commands/mod.rs` (modified)

**Analog:** self (`src-tauri/src/commands/mod.rs` line 1–2):
```rust
pub mod encode;
pub mod proto;
```

**Changes required (append):**
```rust
pub mod connection;
pub mod publish;
```

---

## Shared Patterns

### Tauri IPC: invoke + typed return
**Source:** `src/lib/ipc.ts` lines 1–16
**Apply to:** All new functions in `src/lib/ipc.ts`
```typescript
import { invoke } from "@tauri-apps/api/core";

export async function functionName(arg: ArgType): Promise<ReturnType> {
  return invoke<ReturnType>("command_name", { arg });
}
```

### Error handling: unknown narrowing
**Source:** `src/components/sidebar/FileSection.tsx` lines 74–87
**Apply to:** All async handlers in `ConnectionSection.tsx`, `ProfileManagementModal.tsx`, `PublishBar.tsx`
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  setError(message);
}
```

### Tauri command: AppError + ? operator
**Source:** `src-tauri/src/commands/proto.rs` lines 11–18
**Apply to:** All new `#[tauri::command]` functions in `connection.rs` and `publish.rs`
```rust
let result = some_operation()
    .map_err(|e| AppError::SomeVariant(e.to_string()))?;
```

### Rust struct: Debug + Serialize + Deserialize + Clone
**Source:** `src-tauri/src/schema/types.rs` lines 4–8
**Apply to:** `ConnectionProfile` struct in `profiles/mod.rs`
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StructName {
    pub field: FieldType,
}
```

### Dialog shell: Dialog + DialogContent + DialogHeader + DialogFooter
**Source:** `src/components/include-paths/IncludePathDialog.tsx` lines 57–101
**Apply to:** `ProfileManagementModal.tsx`
```typescript
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
    {/* body */}
    <DialogFooter className="gap-2">
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Zustand: typed interface + INITIAL_STATE + create
**Source:** `src/stores/useProtoStore.ts` lines 4–52
**Apply to:** `useConnectionStore.ts`
```typescript
const INITIAL_STATE = { /* typed fields */ } as const;
export const useStore = create<StoreInterface>((set) => ({
  ...INITIAL_STATE,
  actionName: (arg) => set({ field: arg }),
}));
```

### tauri-plugin-store: load + get/set + save
**Source:** `src/components/sidebar/FileSection.tsx` lines 48–69
**Apply to:** Profile non-secret field persistence in `connection.rs` (Rust side)
```typescript
const store = await load(STORE_PATH);
const saved = await store.get<T>(KEY);
await store.set(KEY, value);
await store.save();
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/connection/ConnectionTestResult.tsx` | component | request-response | No inline spinner/checkmark/error result component exists in the codebase |
| `src/components/publish/PublishBar.tsx` | component | request-response | No horizontal toolbar component exists; no RadioGroup usage yet; no toast/sonner usage yet |
| `src-tauri/src/profiles/mod.rs` (keyring helpers) | model | CRUD | No OS keychain integration exists; use RESEARCH.md Pattern 3 (keyring-core Entry API) |
| AMQP client functions in `connection.rs` / `publish.rs` | service | request-response | No lapin AMQP code exists; use RESEARCH.md Pattern 1 (ephemeral connection) and Pattern 2 (URI encoding) |
| Management API queries in `connection.rs` | service | request-response | No reqwest HTTP client code exists; use RESEARCH.md Pattern 4 (reqwest + serde + status disambiguation) |

---

## Metadata

**Analog search scope:** `src/`, `src-tauri/src/` (full tree)
**Files scanned:** 27 source files
**Pattern extraction date:** 2026-05-17
