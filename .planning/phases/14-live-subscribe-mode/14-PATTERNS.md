# Phase 14: Live Subscribe Mode - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/subscribe.rs` | command (backend) | streaming, event-driven | `src-tauri/src/commands/consume.rs` | exact |
| `src-tauri/src/lib.rs` | config | request-response | `src-tauri/src/lib.rs` (existing) | self-extend |
| `src-tauri/Cargo.toml` | config | — | `src-tauri/Cargo.toml` (existing) | self-extend |
| `src/stores/useResponseStore.ts` | store | CRUD | `src/stores/useConnectionStore.ts` | exact |
| `src/lib/types.ts` | utility | — | `src/lib/types.ts` (existing) | self-extend |
| `src/lib/ipc.ts` | utility | request-response | `src/lib/ipc.ts` (existing `drainMessages`) | exact |
| `src/components/ui/toggle-group.tsx` | component | — | `src/components/ui/tabs.tsx` | role-match |
| `src/components/response/SubscribePanel.tsx` | component | streaming | `src/components/response/MessageFeedTab.tsx` | role-match |
| `src/components/response/MessageFeedTab.tsx` | component | request-response | `src/components/response/MessageFeedTab.tsx` (existing) | self-extend |
| `src/components/response/ResponseQueuePicker.tsx` | component | request-response | `src/components/response/ResponseQueuePicker.tsx` (existing) | self-extend |
| `src/stores/useResponseStore.test.ts` | test | — | `src/stores/useAmqpStore.test.ts` | exact |
| `src/components/response/SubscribePanel.test.tsx` | test | — | `src/components/response/MessageFeedTab.test.tsx` | exact |

---

## Pattern Assignments

### `src-tauri/src/commands/subscribe.rs` (command, streaming/event-driven)

**Analog:** `src-tauri/src/commands/consume.rs`

**Imports pattern** (consume.rs lines 1-9 + drain_messages imports):
```rust
use std::time::Duration;
use futures_util::StreamExt;
use lapin::options::{BasicAckOptions, BasicCancelOptions, BasicConsumeOptions, BasicQosOptions};
use lapin::types::FieldTable;
use tokio_util::sync::CancellationToken;
```

**AppState SubscribeState struct** (new; mirrors DescriptorPool slot pattern in lib.rs line 33):
```rust
pub struct SubscribeState {
    pub token: CancellationToken,
    pub handle: tokio::task::JoinHandle<()>,
}
```

**Connection + credential pattern** (consume.rs lines 268-297 — tight URI scope, drop(password) before await):
```rust
let (profile, password) =
    crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

let conn = {
    let uri = crate::profiles::build_amqp_uri(
        &profile.host,
        profile.port,
        &profile.vhost,
        &profile.username,
        &password,
    );
    drop(password);  // SECURITY: drop before any await
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        lapin::Connection::connect(&uri, lapin::ConnectionProperties::default()),
    )
    .await;
    result
        .map_err(|_| crate::error::AppError::AmqpError("Drain connection timed out (10s)".to_string()))?
        .map_err(|_| crate::error::AppError::AmqpError(
            "AMQP connection failed — check host, port, vhost, and credentials".to_string(),
        ))?
};
```

**Channel creation with conn.close on error** (consume.rs lines 299-308):
```rust
let channel = match conn.create_channel().await {
    Ok(ch) => ch,
    Err(e) => {
        tracing::warn!("subscribe: channel creation failed: {}", e);
        let _ = conn.close(0, "".into()).await;
        return Err(crate::error::AppError::AmqpError(
            "Failed to open AMQP channel — check broker permissions".to_string(),
        ));
    }
};
```

**Mutex lock → extract → drop guard before await** (consume.rs lines 260-266 — critical ordering):
```rust
// Clone/take value BEFORE any .await (MutexGuard is not Send)
let pool = {
    let guard = pool_state.lock().map_err(|_| { ... })?;
    guard.clone()
}; // guard drops here
```
Apply same pattern for subscribe_state slot: lock → take → drop → then spawn.

**Ack-before-decode per delivery** (consume.rs lines 344-352):
```rust
// ACK BEFORE DECODE (D-14: ack-before-decode — critical order)
if let Err(e) = channel
    .basic_ack(delivery_tag, lapin::options::BasicAckOptions::default())
    .await
{
    tracing::warn!("drain_messages: ack failed mid-loop: {}", e);
    partial_error = Some("Failed to acknowledge a message — partial results returned, message may be requeued".to_string());
    break;
}
```

**Decode candidate loop — first success wins** (consume.rs lines 355-409):
Reuse the entire `'candidates: for type_name in &message_type_names { ... }` block verbatim for per-delivery decode in the subscribe consumer loop. The loop iterates `decode_types`, tries each type, first success wins.

**DrainResult struct** (consume.rs lines 212-225) — reused unchanged as Channel payload:
```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainResult {
    pub routing_key: String,
    pub exchange: String,
    pub content_type: Option<String>,
    pub timestamp: Option<u64>,
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
    pub decoded_as: Option<String>,
}
```

**bytes_to_hex utility** (consume.rs lines 22-29) — reuse via `super::consume::bytes_to_hex` or move to a shared module.

**tauri::command signature** — follow existing per-command State convention (consume.rs line 37):
```rust
// Existing pattern (consume.rs line 37):
// pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>
// Follow same convention — no AppState struct needed unless planner chooses the refactor path.

#[tauri::command]
pub async fn start_subscribe(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    decode_types: Vec<String>,
    channel: tauri::ipc::Channel<crate::commands::consume::DrainResult>,
    subscribe_state: tauri::State<'_, std::sync::Mutex<Option<SubscribeState>>>,
) -> Result<(), crate::error::AppError>
```

**stop_subscribe: Mutex lock → take → drop → await JoinHandle** (RESEARCH.md Pattern 2):
```rust
#[tauri::command]
pub async fn stop_subscribe(
    subscribe_state: tauri::State<'_, std::sync::Mutex<Option<SubscribeState>>>,
) -> Result<(), crate::error::AppError> {
    let state = {
        let mut guard = subscribe_state.lock().unwrap();
        guard.take()  // take ownership, clearing the slot; drop guard immediately
    };  // guard dropped here — safe to await below
    if let Some(SubscribeState { token, handle }) = state {
        token.cancel();
        let _ = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            handle,
        ).await;
    }
    Ok(())
}
```

**Consumer loop with select!** (RESEARCH.md Pattern 1):
```rust
tauri::async_runtime::spawn(async move {
    // basic_qos BEFORE basic_consume (Pitfall 4)
    let _ = amqp_channel.basic_qos(20, BasicQosOptions::default()).await;
    let mut consumer = amqp_channel
        .basic_consume(&queue_name, &consumer_tag, BasicConsumeOptions::default(), FieldTable::default())
        .await
        .expect("basic_consume failed");
    loop {
        tokio::select! {
            delivery = consumer.next() => {
                match delivery {
                    Some(Ok(delivery)) => { /* ack + decode + channel.send */ }
                    Some(Err(e))       => { let _ = tauri_channel.send(error_result(e)); break; }
                    None               => { let _ = tauri_channel.send(broker_closed_result()); break; }
                }
            }
            _ = token.cancelled() => {
                let _ = amqp_channel.basic_cancel(&consumer_tag, BasicCancelOptions::default()).await;
                let _ = conn.close(200, "normal shutdown").await;
                break;
            }
        }
    }
});
```
NOTE: Use `tauri::async_runtime::spawn`, NOT `tokio::spawn` (CLAUDE.md constraint; Tauri issue #10289).

**Inline test pattern** (consume.rs lines 434-513 — `#[cfg(test)] mod tests` with struct constructors):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    // Tests for SubscribeState construction, error sentinel construction
}
```

---

### `src-tauri/src/lib.rs` (config, self-extend)

**Analog:** `src-tauri/src/lib.rs` (existing)

**AppState extension pattern — primary approach** (lib.rs line 33 — add sibling .manage() call):
```rust
// Existing (lib.rs line 33):
.manage(Mutex::new(Option::<prost_reflect::DescriptorPool>::None))

// Add sibling .manage() for subscribe state (zero refactoring, matches existing convention):
.manage(Mutex::new(Option::<commands::subscribe::SubscribeState>::None))
```
State is then accessed in subscribe.rs commands as:
`subscribe_state: tauri::State<'_', std::sync::Mutex<Option<SubscribeState>>>`
This matches the existing `pool_state` parameter style in consume.rs line 37 exactly.

**Optional: AppState struct** (RESEARCH.md Pattern 3 — only if planner prefers a struct refactor):
If the planner consolidates all managed state into one struct, consume.rs line 37 must also be updated to use the struct instead of the per-parameter approach. This is a broader refactor; use only if justified. The per-.manage() approach above is preferred for zero-churn.

**invoke_handler registration pattern** (lib.rs lines 38-53):
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::subscribe::start_subscribe,
    commands::subscribe::stop_subscribe,
])
```

---

### `src-tauri/Cargo.toml` (config, self-extend)

**Analog:** `src-tauri/Cargo.toml` (existing)

**CRITICAL changes** (RESEARCH.md Standard Stack — both required before compilation):
```toml
# Change 1: Add "sync" feature to existing tokio entry (currently line 32):
# From:
tokio = { version = "1", features = ["rt", "time"] }
# To:
tokio = { version = "1", features = ["rt", "time", "sync"] }

# Change 2: Add explicit tokio-util dependency (currently only transitive):
tokio-util = { version = "0.7", features = ["rt"] }
```

---

### `src/stores/useResponseStore.ts` (store, CRUD, self-extend)

**Analog:** `src/stores/useConnectionStore.ts` (for INITIAL_STATE + action patterns)

**INITIAL_STATE extension pattern** (useConnectionStore.ts lines 24-33 — `as const` + typed fields):
```typescript
// From useConnectionStore.ts:
const INITIAL_STATE = {
  connectionStatus: "disconnected" as ConnectionStatus,
  connectionError: null as string | null,
  // ...
} as const;
```

**New fields to add** (extend useResponseStore.ts INITIAL_STATE at lines 37-46):
```typescript
// Add to INITIAL_STATE in useResponseStore.ts:
const INITIAL_STATE: Pick<ResponseStore, ... | "subscribeStatus" | "subscribeError"> = {
  // ... existing fields ...
  subscribeStatus: "Idle" as SubscribeStatus,
  subscribeError: null as string | null,
};
```

**New action pattern** (useConnectionStore.ts line 40 — setConnectionStatus with optional arg):
```typescript
// From useConnectionStore.ts (lines 38-40):
setConnectionStatus: (status, error = null) =>
  set({ connectionStatus: status, connectionError: error }),

// Subscribe equivalent:
setSubscribeStatus: (status: SubscribeStatus, error?: string) =>
  set({ subscribeStatus: status, subscribeError: error ?? null }),
```

**Reset pattern** (useResponseStore.ts line 75 — spread INITIAL_STATE):
```typescript
reset: () => set({ ...INITIAL_STATE }),
// Works unchanged since new fields are in INITIAL_STATE
```

---

### `src/lib/types.ts` (utility, self-extend)

**Analog:** `src/lib/types.ts` (existing type alias conventions)

**Type alias pattern** (types.ts line 79 — string literal union):
```typescript
// Existing:
export type ConnectionStatus = "connected" | "error" | "disconnected";

// New type alias to add (Phase 14 section):
export type SubscribeStatus = "Idle" | "Running" | "Stopping" | "Error";
```

---

### `src/lib/ipc.ts` (utility, request-response, self-extend)

**Analog:** `src/lib/ipc.ts` (`drainMessages` wrapper, lines 121-133)

**drainMessages IPC wrapper pattern** (ipc.ts lines 121-133):
```typescript
export async function drainMessages(
  profileName: string,
  queueName: string,
  messageTypeNames: string[],
  count: number,
): Promise<DrainOutcome> {
  return invoke<DrainOutcome>("drain_messages", {
    profileName,
    queueName,
    messageTypeNames,
    count,
  });
}
```

**New wrappers to add** (RESEARCH.md Verified Pattern — IPC Wrappers):
```typescript
import { Channel, invoke } from "@tauri-apps/api/core";
import type { DrainResult } from "./types";

export function startSubscribe(
  profileName: string,
  queueName: string,
  decodeTypes: string[],
  channel: Channel<DrainResult>,
): Promise<void> {
  return invoke("start_subscribe", { profileName, queueName, decodeTypes, channel });
}

export function stopSubscribe(): Promise<void> {
  return invoke("stop_subscribe");
}
```
NOTE: `Channel` is imported from `@tauri-apps/api/core`, NOT `@tauri-apps/api`. Check existing import line (ipc.ts line 1) — it uses `@tauri-apps/api/core`.

---

### `src/components/ui/toggle-group.tsx` (component, shadcn wrapper)

**Analog:** `src/components/ui/tabs.tsx` (exact same shadcn wrapper shape for a Radix UI primitive)

**Import + primitive alias pattern** (tabs.tsx lines 1-4):
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
```

Apply same pattern for ToggleGroup:
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
```
VERIFIED: `radix-ui` 1.4.3 umbrella exports `ToggleGroup` — confirmed via `node_modules/.pnpm/radix-ui@1.4.3_.../src/index.ts`: `export * as ToggleGroup from '@radix-ui/react-toggle-group'`.

**cva variant pattern** (tabs.tsx lines 25-38):
```typescript
const tabsListVariants = cva(
  "inline-flex items-center justify-center rounded-lg ...",
  {
    variants: { variant: { default: "bg-muted", ... } },
    defaultVariants: { variant: "default" },
  }
)
```
Apply same pattern for ToggleGroup root and item variants.

**Wrapper component pattern** (tabs.tsx lines 40-53 — `data-slot`, spread `...props`):
```typescript
function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}
```

**Export pattern** (tabs.tsx line 88):
```typescript
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
// For toggle-group:
export { ToggleGroup, ToggleGroupItem }
```

---

### `src/components/response/SubscribePanel.tsx` (component, streaming)

**Analog:** `src/components/response/MessageFeedTab.tsx`

**Imports pattern** (MessageFeedTab.tsx lines 1-16):
```typescript
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { startSubscribe, stopSubscribe } from "@/lib/ipc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// + Channel from @tauri-apps/api/core
```

**Store subscription pattern** (MessageFeedTab.tsx lines 22-33):
```typescript
const { connectionStatus, activeProfileName } = useConnectionStore();
const {
  selectedQueue,
  selectedDecodeTypes,
  subscribeStatus,
  subscribeError,
  appendMessages,
  setSubscribeStatus,
} = useResponseStore();
```

**Async IPC call with try/catch/finally** (MessageFeedTab.tsx lines 36-71):
```typescript
const handleStart = async () => {
  if (!isConnected || !activeProfileName || !selectedQueue.trim()) return;
  const ch = new Channel<DrainResult>()
  ch.onmessage = (message) => {
    appendMessages([message])
  }
  setSubscribeStatus('Running')
  try {
    await startSubscribe(activeProfileName, selectedQueue, selectedDecodeTypes, ch)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    setSubscribeStatus('Error', message)
    toast.error(`Subscribe failed: ${message}`)
  }
}

const handleStop = async () => {
  setSubscribeStatus('Stopping')
  try {
    await stopSubscribe()
    setSubscribeStatus('Idle')
  } catch (err: unknown) {
    setSubscribeStatus('Error', String(err))
  }
}
```

**Status badge with colored dot** (ResponseQueuePicker.tsx lines 172-194 — Live/Manual badge):
```typescript
// From ResponseQueuePicker.tsx (lines 174-186):
{isLiveMode ? (
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

// Subscribe status badge — same shape, 4 states:
const STATUS_DOT: Record<SubscribeStatus, string> = {
  Idle:     "bg-muted-foreground",
  Running:  "bg-emerald-500",
  Stopping: "bg-amber-500",
  Error:    "bg-destructive",
}
<Badge variant="outline" className="text-xs gap-1">
  <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[subscribeStatus])} />
  {subscribeStatus}
</Badge>
```

**Auto-stop useEffect** (ResponseQueuePicker.tsx lines 61-87 — useEffect with cancelled flag):
```typescript
// Mirrors queue-fetch useEffect in ResponseQueuePicker.tsx (lines 61-87)
const prevProfileRef = useRef(activeProfileName)
useEffect(() => {
  if (subscribeStatus === 'Running' || subscribeStatus === 'Stopping') {
    if (connectionStatus !== 'connected' || activeProfileName !== prevProfileRef.current) {
      void handleStop()
    }
  }
  prevProfileRef.current = activeProfileName
}, [activeProfileName, connectionStatus])
// NOTE: connectionStatus check uses lowercase "connected" matching ConnectionStatus type
```

**Channel cleanup on unmount** (return from useEffect):
```typescript
// Set channel.onmessage = null in cleanup to prevent callbacks after unmount
useEffect(() => {
  return () => {
    if (channelRef.current) {
      channelRef.current.onmessage = null
    }
  }
}, [])
```

---

### `src/components/response/MessageFeedTab.tsx` (component, self-extend)

**Analog:** `src/components/response/MessageFeedTab.tsx` (existing)

Mode toggle integration point (MessageFeedTab.tsx line 79):
```typescript
// Current:
<ResponseQueuePicker onDrain={(count) => void handleDrain(count)} />

// Extended — add mode state + conditional render:
const [mode, setMode] = useState<'drain' | 'subscribe'>('drain')
// ...
<ModeToggle value={mode} onValueChange={setMode} disabled={subscribeStatus === 'Running' || subscribeStatus === 'Stopping'} />
{mode === 'drain' ? (
  <ResponseQueuePicker onDrain={(count) => void handleDrain(count)} />
) : (
  <SubscribePanel />
)}
```
NOTE: Mode toggle is disabled while `subscribeStatus` is `"Running"` or `"Stopping"` (D-06).

---

### `src/components/response/ResponseQueuePicker.tsx` (component, self-extend)

**Analog:** `src/components/response/ResponseQueuePicker.tsx` (existing)

The Queue picker and Decode-as combobox are shared between Drain and Subscribe modes. Per D-04, in Subscribe mode the drain count input and Drain button are hidden. The mode prop or context controls this:
```typescript
// Add optional prop:
interface ResponseQueuePickerProps {
  onDrain: (count: number) => void;
  mode?: 'drain' | 'subscribe'; // controls drain-only controls visibility
}
// In render: only show drain count + Drain button when mode === 'drain'
```

---

### `src/stores/useResponseStore.test.ts` (test, store)

**Analog:** `src/stores/useAmqpStore.test.ts`

**Test file structure** (useAmqpStore.test.ts lines 1-15):
```typescript
import { describe, beforeEach, test, expect, vi } from "vitest";
import { useResponseStore } from "./useResponseStore";

beforeEach(() => {
  useResponseStore.getState().reset();
  vi.clearAllMocks();
});

describe("subscribeStatus initial state", () => {
  test("subscribeStatus is 'Idle' by default", () => {
    expect(useResponseStore.getState().subscribeStatus).toBe("Idle");
  });
});
```

**AAA test pattern** (useAmqpStore.test.ts lines 48-58):
```typescript
test("setSubscribeStatus('Running') → status is Running, error is null", () => {
  // Arrange — reset is done in beforeEach
  // Act
  useResponseStore.getState().setSubscribeStatus('Running')
  // Assert
  const s = useResponseStore.getState()
  expect(s.subscribeStatus).toBe('Running')
  expect(s.subscribeError).toBeNull()
})
```

---

### `src/components/response/SubscribePanel.test.tsx` (test, component)

**Analog:** `src/components/response/MessageFeedTab.test.tsx`

**IPC mock pattern** (MessageFeedTab.test.tsx lines 4-11):
```typescript
const { mockStartSubscribe, mockStopSubscribe } = vi.hoisted(() => ({
  mockStartSubscribe: vi.fn(),
  mockStopSubscribe: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  startSubscribe: mockStartSubscribe,
  stopSubscribe: mockStopSubscribe,
  fetchQueues: vi.fn().mockRejectedValue(new Error("no management")),
  fetchQueueDepth: vi.fn().mockResolvedValue(0),
}));
```

**Channel mock** (new — not yet in codebase):
```typescript
vi.mock("@tauri-apps/api/core", () => ({
  Channel: vi.fn().mockImplementation(() => ({
    onmessage: null,
    send: vi.fn(),
  })),
  invoke: vi.fn(),
}));
```

**Store setState pattern** (MessageFeedTab.test.tsx lines 66-87):
```typescript
const SUBSCRIBE_STATE = {
  selectedQueue: "test-queue",
  selectedDecodeTypes: ["MyMessage"],
  subscribeStatus: "Idle" as const,
  subscribeError: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useResponseStore.setState(SUBSCRIBE_STATE);
  useConnectionStore.setState({ connectionStatus: "connected", activeProfileName: "test-profile" });
});
```

**Render + fireEvent + waitFor pattern** (MessageFeedTab.test.tsx lines 122-136):
```typescript
test("Start button calls startSubscribe and sets status Running", async () => {
  mockStartSubscribe.mockResolvedValueOnce(undefined);
  render(<SubscribePanel />);
  fireEvent.click(screen.getByRole("button", { name: /start/i }));
  await waitFor(() => {
    expect(mockStartSubscribe).toHaveBeenCalledWith(
      "test-profile",
      "test-queue",
      ["MyMessage"],
      expect.any(Object), // Channel instance
    );
  });
});
```

---

## Shared Patterns

### Mutex lock → extract → drop guard before await (Rust)
**Source:** `src-tauri/src/commands/consume.rs` lines 260-266
**Apply to:** `subscribe.rs` `start_subscribe` and `stop_subscribe` — any access to `AppState.subscribe_state`
```rust
// PATTERN: lock → extract → drop guard BEFORE await
let value = {
    let mut guard = state.subscribe_state.lock().unwrap();
    guard.take()
}; // guard dropped here — safe to await below
if let Some(s) = value {
    s.handle.await.ok();
}
```

### Password drop before await (Rust Security)
**Source:** `src-tauri/src/commands/consume.rs` lines 280-297
**Apply to:** `subscribe.rs` `start_subscribe`
```rust
let uri = crate::profiles::build_amqp_uri(..., &password);
drop(password); // SECURITY: dropped before first await
let conn = lapin::Connection::connect(&uri, ...).await??;
// uri also dropped after connect block
```

### tauri::async_runtime::spawn (not tokio::spawn)
**Source:** CLAUDE.md + Tauri issue #10289
**Apply to:** `subscribe.rs` consumer task spawning
```rust
tauri::async_runtime::spawn(async move { /* consumer loop */ });
// NEVER: tokio::spawn(async move { ... }) — panics on Windows in Tauri 2.x
```

### Store INITIAL_STATE + reset
**Source:** `src/stores/useResponseStore.ts` lines 27-46 + line 75
**Apply to:** `useResponseStore.ts` extension
```typescript
const INITIAL_STATE: Pick<ResponseStore, ... | "subscribeStatus" | "subscribeError"> = {
  // all default values here
  subscribeStatus: "Idle" as SubscribeStatus,
  subscribeError: null as string | null,
};
// reset:
reset: () => set({ ...INITIAL_STATE }),
```

### useEffect with cancelled flag (React)
**Source:** `src/components/response/ResponseQueuePicker.tsx` lines 61-87
**Apply to:** `SubscribePanel.tsx` auto-stop useEffect
```typescript
useEffect(() => {
  let cancelled = false;
  // ... async work with cancelled guard ...
  return () => { cancelled = true; };
}, [activeProfileName, connectionStatus]);
```

### IPC wrapper function (TypeScript)
**Source:** `src/lib/ipc.ts` lines 121-133
**Apply to:** `ipc.ts` `startSubscribe` and `stopSubscribe`
```typescript
export async function funcName(arg: Type): Promise<ReturnType> {
  return invoke<ReturnType>("rust_command_name", { arg });
}
```

### vi.hoisted + vi.mock for IPC (Vitest)
**Source:** `src/components/response/MessageFeedTab.test.tsx` lines 4-11
**Apply to:** `SubscribePanel.test.tsx`
```typescript
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock("@/lib/ipc", () => ({ functionName: mockFn }));
```

### shadcn component wrapper (React + radix-ui)
**Source:** `src/components/ui/tabs.tsx` lines 1-88
**Apply to:** `src/components/ui/toggle-group.tsx`
```typescript
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
// data-slot, cva, cn, spread props — same shape as tabs.tsx
```

---

## No Analog Found

All Phase 14 files have analogs. No files require falling back to RESEARCH.md examples exclusively.

| File | Note |
|------|------|
| `subscribe.rs` consumer `select!` loop | No existing lapin Consumer (stream) loop in project — use RESEARCH.md Pattern 1 verbatim alongside consume.rs structural patterns |
| `toggle-group.tsx` ToggleGroup item disabled state | No existing disabled-toggle pattern — use Radix UI docs via tabs.tsx shape as structural template |

---

## Metadata

**Analog search scope:** `src-tauri/src/commands/`, `src/stores/`, `src/lib/`, `src/components/response/`, `src/components/ui/`, `node_modules/radix-ui/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-05-21

**Key facts for planner:**
- `badge.tsx` already exists — no creation needed (A3 in RESEARCH.md Open Questions resolved: check `ls src/components/ui/` output shows `badge.tsx 1.8K`)
- `toggle-group.tsx` does NOT yet exist — must be created; radix-ui 1.4.3 umbrella exports `ToggleGroup` as `@radix-ui/react-toggle-group` re-export (verified via `node_modules` inspection)
- `tokio-util` and `tokio/sync` Cargo.toml changes are blocking for Wave 0 — must precede all Rust implementation
- `connectionStatus` string in frontend is lowercase `"connected"` (types.ts line 79), not `"Connected"` — critical for auto-stop useEffect condition
- Consumer tag: a static tag such as `"tap-subscriber"` is safe because `start_subscribe` returns an error (D-08) if the state slot is already occupied — preventing duplicate consumers. If the planner wants UUID-based tags, that requires adding the `uuid` crate to Cargo.toml (not currently present); the static tag is sufficient and requires no new dependency.
