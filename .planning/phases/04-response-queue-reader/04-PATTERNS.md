# Phase 4: Response Queue Reader — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 11 (7 new, 4 modified)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/commands/consume.rs` | command/service | request-response (AMQP consume) | `src-tauri/src/commands/publish.rs` | exact (same ephemeral-connection pattern) |
| `src-tauri/src/commands/mod.rs` | config/registry | — | `src-tauri/src/commands/mod.rs` (self) | self-extend |
| `src-tauri/src/lib.rs` | config/registry | — | `src-tauri/src/lib.rs` (self) | self-extend |
| `src/stores/useResponseStore.ts` | store | event-driven (user action → state) | `src/stores/useConnectionStore.ts` | exact (typed interface + INITIAL_STATE + create) |
| `src/lib/ipc.ts` | utility | request-response | `src/lib/ipc.ts` (self) | self-extend |
| `src/lib/types.ts` | utility | — | `src/lib/types.ts` (self) | self-extend |
| `src/components/response/ResponseTab.tsx` | component | event-driven | `src/components/history/MessageHistoryPanel.tsx` | role-match (panel container) |
| `src/components/response/ResponseQueuePicker.tsx` | component | request-response | `src/components/publish/PublishBar.tsx` | exact (Live/Manual picker + disabled button + tooltip) |
| `src/components/response/ResponseDecodedView.tsx` | component | transform (JSON → tree) | `src/components/form/fields/NestedMessageField.tsx` | role-match (collapsible tree with Collapsible/ChevronDown) |
| `src/components/response/ResponseHexSection.tsx` | component | transform (display + copy) | `src/components/preview/HexPreviewPanel.tsx` | exact (hex string display, copy-to-clipboard pattern) |
| `src/components/layout/RightPanel.tsx` | component | event-driven | `src/components/layout/RightPanel.tsx` (self) | self-extend |

---

## Pattern Assignments

### `src-tauri/src/commands/consume.rs` (command, request-response)

**Analog:** `src-tauri/src/commands/publish.rs`

**Imports pattern** (publish.rs lines 1-9):
```rust
use lapin::{
    options::{BasicPublishOptions, ConfirmSelectOptions},
    BasicProperties, Connection, ConnectionProperties,
};
use std::time::Duration;
use tauri::AppHandle;

use crate::error::AppError;
use crate::profiles::build_amqp_uri;
```
For `consume.rs`, replace `BasicPublishOptions`/`ConfirmSelectOptions`/`BasicProperties` with `BasicAckOptions`/`BasicGetOptions` from `lapin::options`. Add `prost_reflect::DynamicMessage`, `prost_reflect::prost::Message`, `serde::Serialize`, and `std::sync::Mutex`.

**Return type pattern** — new struct, analogous to `Ok(())` in publish:
```rust
#[derive(Serialize)]
pub struct ConsumeResult {
    pub empty: bool,
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
}
```

**Security: tight URI scope + credential drop** (publish.rs lines 50-73):
```rust
let conn = {
    let uri = build_amqp_uri(
        &profile.host,
        profile.port,
        &profile.vhost,
        &profile.username,
        &password,
    );
    drop(password);
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        Connection::connect(&uri, ConnectionProperties::default()),
    )
    .await;
    result
        .map_err(|_| AppError::AmqpError("Publish connection timed out (10s)".to_string()))?
        .map_err(|_| AppError::AmqpError("AMQP connection failed — check host, port, vhost, and credentials".to_string()))?
};
```
Copy this block verbatim into `consume_message`; change the error message prefix from "Publish" to "Consume".

**Channel creation with close-on-error** (publish.rs lines 77-83):
```rust
let channel = match conn.create_channel().await {
    Ok(ch) => ch,
    Err(e) => {
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }
};
```
Copy verbatim.

**DescriptorPool clone before await** — pattern from `encode.rs` lines 7-20 (CRITICAL: do this BEFORE the async connect block):
```rust
let pool = {
    let guard = pool_state.lock().unwrap();
    guard.as_ref().ok_or_else(|| AppError::EncodeError {
        field: "<root>".to_string(),
        message: "No proto file loaded".to_string(),
    })?.clone() // O(1) Arc-backed
}; // guard drops here — safe to .await below
```

**Error handling pattern** — `AppError` variants used in `publish.rs`:
- `AppError::AmqpError(e.to_string())` for AMQP failures
- `AppError::EncodeError { field, message }` for pool/decode failures
- Pattern from `error.rs` lines 1-37: `impl serde::Serialize for AppError` serializes as string to frontend

**Unit test pattern** (publish.rs lines 159-185):
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn some_invariant() {
        // Document-style test — asserts a constant or conversion
        let value = "";
        assert!(value.is_empty());
    }
}
```
For `consume.rs` tests: test `bytes_to_hex` pure function and `ConsumeResult` construction (no broker needed).

---

### `src-tauri/src/commands/mod.rs` (config, self-extend)

**Analog:** `src-tauri/src/commands/mod.rs` lines 1-4 (self)

**Existing pattern:**
```rust
pub mod connection;
pub mod encode;
pub mod proto;
pub mod publish;
```
**Add one line:**
```rust
pub mod consume;
```

---

### `src-tauri/src/lib.rs` (config, self-extend)

**Analog:** `src-tauri/src/lib.rs` lines 38-49 (self)

**Existing invoke_handler pattern:**
```rust
.invoke_handler(tauri::generate_handler![
    commands::proto::parse_proto,
    commands::encode::encode_message,
    // ... other commands
    commands::publish::publish_message,
])
```
**Add one entry:**
```rust
commands::consume::consume_message,
```
No other changes to `lib.rs`.

---

### `src/stores/useResponseStore.ts` (store, event-driven)

**Analog:** `src/stores/useConnectionStore.ts` (exact match — typed interface + INITIAL_STATE + `create`)

**Full pattern from useConnectionStore.ts lines 1-47:**
```typescript
import { create } from "zustand";
import type { ConnectionProfile, ConnectionStatus, ManagementStatus } from "@/lib/types";

interface ConnectionStore {
  // fields...
  reset: () => void;
}

const INITIAL_STATE = {
  profiles: [] as ConnectionProfile[],
  activeProfileName: null as string | null,
  // ...typed null/empty casts for each field
} as const;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...INITIAL_STATE,
  setProfiles: (profiles) => set({ profiles }),
  // ...one-liner setters
  reset: () => set({ ...INITIAL_STATE }),
}));
```
Apply the same structure: named `interface`, `INITIAL_STATE as const`, `create<Interface>((set) => ({...}))`, one-liner setters, `reset: () => set({ ...INITIAL_STATE })`.

**Fields for `useResponseStore`** (from RESEARCH.md Pattern 5):
```typescript
interface ResponseStore {
  queueList: string[];
  isLiveMode: boolean;
  selectedQueue: string;
  isLoading: boolean;
  lastResult: ResponseResult | null;
  lastReadAt: number | null;
  // setters + reset
}
const INITIAL_STATE = {
  queueList: [] as string[],
  isLiveMode: false,
  selectedQueue: "",
  isLoading: false,
  lastResult: null as ResponseResult | null,
  lastReadAt: null as number | null,
} as const;
```

---

### `src/lib/ipc.ts` (utility, self-extend)

**Analog:** `src/lib/ipc.ts` lines 64-83 (self — `publishMessage` is the template)

**Existing IPC wrapper pattern:**
```typescript
export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[],
  amqpProps?: AmqpPropsIpc
): Promise<void> {
  return invoke<void>("publish_message", {
    profileName,
    exchange,
    routingKey,
    payload,
    // flat args matching Rust parameter names
  });
}
```
**Apply for `consumeMessage`:**
```typescript
export async function consumeMessage(
  profileName: string,
  queueName: string,
  messageTypeName: string,
): Promise<ConsumeResult> {
  return invoke<ConsumeResult>("consume_message", {
    profileName,
    queueName,
    messageTypeName,
  });
}
```
Note: `invoke` already imported at line 1 of `ipc.ts`. Import `ConsumeResult` from `"./types"`.

---

### `src/lib/types.ts` (utility, self-extend)

**Analog:** `src/lib/types.ts` lines 63-79 (self — Phase 2 connection types section)

**Existing additive pattern** (lines 62-63):
```typescript
// ── Phase 2: Connection types ────────────────────────────────────────────────
export interface ConnectionProfile { ... }
```
**Add a Phase 4 section at the bottom:**
```typescript
// ── Phase 4: Response queue reader types ─────────────────────────────────────
export interface ConsumeResult {
  empty: boolean;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

---

### `src/components/response/ResponseTab.tsx` (component, event-driven)

**Analog:** `src/components/history/MessageHistoryPanel.tsx`

**Container structure pattern** (MessageHistoryPanel.tsx lines 103-134):
```tsx
return (
  <div className="flex flex-col h-full">
    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
      {/* header content */}
    </div>
    <ScrollArea className="flex-1">
      {/* content */}
    </ScrollArea>
  </div>
);
```
`ResponseTab` follows the same `flex flex-col h-full` container with `border-b` header section and `ScrollArea` body.

**Idle state placeholder pattern** (HexPreviewPanel.tsx lines 32-34):
```tsx
{!encodeError && !hexPreview && (
  <p className="text-xs text-muted-foreground">
    Fill in the form fields to see binary encoding
  </p>
)}
```
For `ResponseTab`, show "Select a reply queue and click Read" when `lastResult === null`. Show "Queue empty" inline text when `lastResult.empty === true`.

**Imports needed:**
```tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResponseStore } from "@/stores/useResponseStore";
import { ResponseQueuePicker } from "./ResponseQueuePicker";
import { ResponseDecodedView } from "./ResponseDecodedView";
import { ResponseHexSection } from "./ResponseHexSection";
```

---

### `src/components/response/ResponseQueuePicker.tsx` (component, request-response)

**Analog:** `src/components/publish/PublishBar.tsx` — exact match for Live/Manual picker + disabled button + tooltip

**Live/Manual queue fetch pattern** (PublishBar.tsx lines 86-125):
```tsx
useEffect(() => {
  if (!activeProfileName) return;

  const fetchTargets = async () => {
    try {
      const qs = await fetchQueues(activeProfileName);
      setManagementAuthError(null);
      setQueues(qs);
      setManagementStatus("live");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("authentication failed")) {
        setManagementAuthError(errMsg);
      } else {
        setManagementAuthError(null);
        setManagementStatus("manual");
      }
    }
  };
  fetchTargets();
}, [activeProfileName, mode]);
```
`ResponseQueuePicker` calls `fetchQueues` on tab focus (via `useEffect` with `activeProfileName` dep), writes to `useResponseStore` (`setQueueList`, `setIsLiveMode`). No `mode` — queue only.

**Live dropdown vs Manual text input** (PublishBar.tsx lines 262-309):
```tsx
{managementStatus === "live" ? (
  <Select value={selectedQueue} onValueChange={setSelectedQueue}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder="Select queue…" />
    </SelectTrigger>
    <SelectContent position="popper" className="max-h-60">
      {queues.map((name) => (
        <SelectItem key={name} value={name}>{name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
) : (
  <Input
    placeholder="Queue name"
    className="w-48"
    value={selectedQueue}
    onChange={(e) => setSelectedQueue(e.target.value)}
  />
)}
```

**Live/Manual/Auth-error badge pattern** (PublishBar.tsx lines 293-308):
```tsx
{managementAuthError ? (
  <Badge variant="destructive" className="text-xs">{managementAuthError}</Badge>
) : managementStatus === "live" ? (
  <Badge variant="outline" className="text-xs gap-1">
    <span className="w-2 h-2 rounded-full bg-emerald-500" />
    Live
  </Badge>
) : (
  <Badge variant="outline" className="text-xs gap-1">
    <span className="w-2 h-2 rounded-full bg-amber-500" />
    Manual
  </Badge>
)}
```

**Disabled button + tooltip pattern** (PublishBar.tsx lines 330-359):
```tsx
{isConnected ? (
  <Button variant="default" disabled={!canSend || isSending} onClick={handleRead}>
    {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
    Read
  </Button>
) : (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button variant="default" disabled>Read</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Connect to a RabbitMQ profile to read.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

**Imports needed:**
```tsx
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { fetchQueues, consumeMessage } from "@/lib/ipc";
```

---

### `src/components/response/ResponseDecodedView.tsx` (component, transform)

**Analog:** `src/components/form/fields/NestedMessageField.tsx` — collapsible tree with `Collapsible`/`ChevronDown`

**Collapsible section pattern** (NestedMessageField.tsx lines 46-63):
```tsx
<Collapsible open={open} onOpenChange={setOpen} className="ml-4 border-l border-border pl-3 mb-2">
  <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground py-1 cursor-pointer">
    {open ? (
      <ChevronDown className="w-4 h-4" />
    ) : (
      <ChevronRight className="w-4 h-4" />
    )}
    {field.label}
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* children */}
  </CollapsibleContent>
</Collapsible>
```
`ResponseDecodedView` renders `serde_json::Value` (received as `Record<string, unknown>`) as a recursive tree. Object values get a collapsible section (same pattern). Scalar values render as `key: value` read-only rows.

**Inline error pattern** (HexPreviewPanel.tsx lines 23-25):
```tsx
{encodeError && (
  <div className="text-xs text-destructive font-mono break-all">
    {encodeError}
  </div>
)}
```
Use for `lastResult.error !== null` case: "Decode failed: [reason]. Showing raw bytes."

**Imports needed:**
```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
```

---

### `src/components/response/ResponseHexSection.tsx` (component, transform)

**Analog:** `src/components/preview/HexPreviewPanel.tsx` — exact match for hex string display

**Hex display pattern** (HexPreviewPanel.tsx lines 5-42):
```tsx
export function HexPreviewPanel() {
  const { hexPreview, isEncoding, encodeError } = useProtoStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Hex Preview</h2>
      </div>
      <ScrollArea className="flex-1 p-4">
        {!encodeError && hexPreview && (
          <pre className="text-xs font-mono break-all whitespace-pre-wrap text-foreground">
            {hexPreview}
          </pre>
        )}
        {!encodeError && !hexPreview && (
          <p className="text-xs text-muted-foreground">
            Fill in the form fields to see binary encoding
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
```
`ResponseHexSection` reads `lastResult?.hexString` from `useResponseStore`. Adds a "Copy hex" button.

**Copy to clipboard pattern** — `navigator.clipboard.writeText()` already used in the project. Pattern:
```tsx
<Button
  variant="ghost"
  size="sm"
  className="text-xs"
  onClick={() => void navigator.clipboard.writeText(hexString)}
>
  Copy hex
</Button>
```

**Imports needed:**
```tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useResponseStore } from "@/stores/useResponseStore";
```

---

### `src/components/layout/RightPanel.tsx` (component, self-extend)

**Analog:** `src/components/layout/RightPanel.tsx` (self)

**Existing activeTab type** (RightPanel.tsx line 9):
```tsx
const [activeTab, setActiveTab] = useState<"hex" | "history">("hex");
```
**Widen to:**
```tsx
const [activeTab, setActiveTab] = useState<"hex" | "history" | "response">("hex");
```
Also update `onValueChange` cast on line 39:
```tsx
onValueChange={(v) => setActiveTab(v as "hex" | "history" | "response")}
```

**Existing lastSendAt edge-detection pattern** (RightPanel.tsx lines 11-23):
```tsx
const lastSendAt = useProtoStore((s) => s.lastSendAt);
const prevLastSendAt = useRef<number | null>(null);

useEffect(() => {
  if (lastSendAt !== null && lastSendAt !== prevLastSendAt.current) {
    prevLastSendAt.current = lastSendAt;
    setActiveTab("history");
  }
}, [lastSendAt]);
```
**Add analogous block for `lastReadAt`:**
```tsx
const lastReadAt = useResponseStore((s) => s.lastReadAt);
const prevLastReadAt = useRef<number | null>(null);

useEffect(() => {
  if (lastReadAt !== null && lastReadAt !== prevLastReadAt.current) {
    prevLastReadAt.current = lastReadAt;
    setActiveTab("response");
  }
}, [lastReadAt]);
```

**Existing tab JSX pattern** (RightPanel.tsx lines 40-56):
```tsx
<TabsList className="w-full rounded-none border-b border-border justify-start px-2">
  <TabsTrigger value="hex" className="text-xs">Hex</TabsTrigger>
  <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
</TabsList>
<TabsContent value="hex" className="flex-1 overflow-hidden m-0 p-0">
  <HexPreviewPanel />
</TabsContent>
<TabsContent value="history" className="flex-1 overflow-hidden m-0 p-0">
  <MessageHistoryPanel />
</TabsContent>
```
**Add 3rd tab:**
```tsx
<TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
// ...
<TabsContent value="response" className="flex-1 overflow-hidden m-0 p-0">
  <ResponseTab />
</TabsContent>
```

**New imports needed at top of RightPanel.tsx:**
```tsx
import { useResponseStore } from "@/stores/useResponseStore";
import { ResponseTab } from "@/components/response/ResponseTab";
```

---

## Shared Patterns

### Ephemeral AMQP Connection (Rust)
**Source:** `src-tauri/src/commands/publish.rs` lines 50-83
**Apply to:** `consume.rs`
- Tight URI scope (drop password and URI before inspecting result)
- `tokio::time::timeout(Duration::from_secs(10), ...)` for connection
- `conn.close(0, "".into()).await` on ALL error paths and after success
- Order for consume: get → ack → close (NOT: get → close → ack)

### DescriptorPool Clone Before Await (Rust)
**Source:** `src-tauri/src/commands/encode.rs` lines 13-20 (sync version); `consume.rs` needs async-safe version
**Apply to:** `consume.rs`
```rust
let pool = {
    let guard = pool_state.lock().unwrap();
    guard.as_ref().ok_or_else(|| AppError::EncodeError { ... })?.clone()
}; // guard drops before any .await
```

### AppError Variants (Rust)
**Source:** `src-tauri/src/error.rs` lines 4-28
**Apply to:** `consume.rs`
- `AppError::AmqpError(String)` for all AMQP failures
- `AppError::EncodeError { field: String, message: String }` for pool/decode failures
- `AppError::ProfileNotFound(String)` from `load_profile_with_password`

### Zustand Typed Interface + INITIAL_STATE
**Source:** `src/stores/useConnectionStore.ts` lines 1-47
**Apply to:** `src/stores/useResponseStore.ts`
```typescript
// Pattern: interface → INITIAL_STATE as const → create<Interface>((set) => ({ ...INITIAL_STATE, setters, reset }))
const INITIAL_STATE = { ... } as const;
export const useStore = create<Interface>((set) => ({
  ...INITIAL_STATE,
  setter: (val) => set({ field: val }),
  reset: () => set({ ...INITIAL_STATE }),
}));
```

### Disabled Button + Tooltip (React)
**Source:** `src/components/publish/PublishBar.tsx` lines 330-359
**Apply to:** `src/components/response/ResponseQueuePicker.tsx`
```tsx
// When !isConnected: wrap disabled Button in TooltipProvider > Tooltip > TooltipTrigger(asChild) > span
// The span wrapper is CRITICAL — disabled buttons don't fire mouse events for tooltips
<TooltipTrigger asChild>
  <span>
    <Button variant="default" disabled>Read</Button>
  </span>
</TooltipTrigger>
```

### Loading Spinner on Async Action
**Source:** `src/components/publish/PublishBar.tsx` lines 334-337
**Apply to:** `src/components/response/ResponseQueuePicker.tsx`
```tsx
{isLoading ? (
  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
) : null}
```

### Edge-Detection useEffect for Tab Auto-Switch
**Source:** `src/components/layout/RightPanel.tsx` lines 14-23
**Apply to:** `src/components/layout/RightPanel.tsx` (new `lastReadAt` signal)
```tsx
// CRITICAL: Use explicit timestamp (Date.now()), NOT derived from lastResult !== null
// Derived signal doesn't re-trigger on same-shaped second result
const prevRef = useRef<number | null>(null);
useEffect(() => {
  if (signal !== null && signal !== prevRef.current) {
    prevRef.current = signal;
    setActiveTab("target");
  }
}, [signal]);
```

### Collapsible Section (React)
**Source:** `src/components/form/fields/NestedMessageField.tsx` lines 46-63
**Apply to:** `src/components/response/ResponseDecodedView.tsx`
```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// Collapsible is from "radix-ui" (see src/components/ui/collapsible.tsx line 3)
// Usage: <Collapsible open={open} onOpenChange={setOpen}>
```

### Inline Error Display
**Source:** `src/components/preview/HexPreviewPanel.tsx` lines 23-25
**Apply to:** `ResponseDecodedView.tsx` and `ResponseTab.tsx`
```tsx
<div className="text-xs text-destructive font-mono break-all">
  {errorMessage}
</div>
```

### Copy to Clipboard
**Source:** Used in project (clipboard API confirmed); `navigator.clipboard.writeText(value)`
**Apply to:** `ResponseHexSection.tsx` ("Copy hex"), `ResponseDecodedView.tsx` ("Copy decoded JSON")
```tsx
onClick={() => void navigator.clipboard.writeText(value)}
```
For "Copy decoded JSON": `JSON.stringify(decoded, null, 2)`.

---

## No Analog Found

All files have close analogs. No gaps.

---

## Metadata

**Analog search scope:** `src/`, `src-tauri/src/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-05-18
