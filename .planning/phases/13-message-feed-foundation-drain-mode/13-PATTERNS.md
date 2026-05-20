# Phase 13: Message Feed Foundation + Drain Mode - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/consume.rs` | command | request-response | `src-tauri/src/commands/publish.rs` | role-match |
| `src-tauri/src/lib.rs` | config | configuration | `src-tauri/src/lib.rs` (existing) | exact |
| `src/lib/ipc.ts` | utility | request-response | `src/lib/ipc.ts` (existing) | exact |
| `src/lib/types.ts` | type-def | data-structure | `src/lib/types.ts` (existing) | exact |
| `src/stores/useResponseStore.ts` | store | state-management | `src/stores/useProtoStore.ts` | exact |
| `src/components/response/MessageFeedTab.tsx` | component | UI-rendering | `src/components/response/ResponseTab.tsx` | refactor-base |
| `src/components/response/MessageFeedRow.tsx` | component | UI-rendering | `src/components/response/ResponseDecodedView.tsx` | role-match |
| `src/components/response/ResponseQueuePicker.tsx` | component | UI-interaction | `src/components/response/ResponseQueuePicker.tsx` (existing) | extension |
| `src/components/response/ResponseHexSection.tsx` | component | UI-rendering | `src/components/response/ResponseHexSection.tsx` (existing) | refactor-base |
| Test files (4) | test | unit-testing | `src/components/response/ResponseTab.test.tsx` | refactor-base |

---

## Pattern Assignments

### `src-tauri/src/commands/consume.rs` (command, request-response)

**Analog:** `src-tauri/src/commands/consume.rs` (extend existing)

This file is extended with a new `drain_messages` command alongside the existing `consume_message`. The drain loop follows the same connection/channel/ack-before-decode pattern.

**Imports pattern** (lines 1-9):
```rust
use std::time::Duration;

/// Result type returned to the frontend.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsumeResult {
    pub empty: bool,
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
}
```

**Utility function (already exists, reuse)** (lines 23-29):
```rust
/// Convert a byte slice to a space-separated lowercase hex string.
/// Example: [0x0a, 0x05] → "0a 05"
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<_>>()
        .join(" ")
}
```

**Connection and ack-before-decode pattern** (lines 56-147):
```rust
// Step 2: Load credentials (sync, no await)
let (profile, password) =
    crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

// Step 3: Connect in tight URI scope (SECURITY: password dropped before result inspection)
let conn = {
    let uri = crate::profiles::build_amqp_uri(
        &profile.host,
        profile.port,
        &profile.vhost,
        &profile.username,
        &password,
    );
    drop(password);
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        lapin::Connection::connect(&uri, lapin::ConnectionProperties::default()),
    )
    .await;
    result
        .map_err(|_| crate::error::AppError::AmqpError("Consume connection timed out (10s)".to_string()))?
        .map_err(|_| crate::error::AppError::AmqpError("AMQP connection failed — check host, port, vhost, and credentials".to_string()))?
};

// Step 4: Create channel (close conn on error)
let channel = match conn.create_channel().await {
    Ok(ch) => ch,
    Err(e) => {
        let _ = conn.close(0, "".into()).await;
        return Err(crate::error::AppError::AmqpError(e.to_string()));
    }
};

// Step 7: ACK BEFORE CLOSE — D-10: always ack, even if decode fails later
if let Err(e) = channel
    .basic_ack(
        delivery_tag,
        lapin::options::BasicAckOptions::default(),
    )
    .await
{
    let _ = conn.close(0, "".into()).await;
    return Err(crate::error::AppError::AmqpError(format!("Ack failed: {}", e)));
}

// Step 8: Close connection AFTER ack
let _ = conn.close(0, "".into()).await;
```

**Decode pattern with prost-reflect** (lines 150-203):
```rust
// Step 9: Decode (synchronous — pool already cloned)
let msg_desc = match pool.get_message_by_name(&message_type_name) {
    Some(d) => d,
    None => {
        return Ok(ConsumeResult {
            empty: false,
            decoded: None,
            hex_string,
            error: Some(format!("Message type '{}' not found in loaded schema", message_type_name)),
        })
    }
};

match prost_reflect::DynamicMessage::decode(msg_desc, payload.as_ref()) {
    Ok(dyn_msg) => {
        let mut buf = Vec::new();
        let mut ser = serde_json::Serializer::new(&mut buf);
        let opts = prost_reflect::SerializeOptions::new()
            .use_proto_field_name(true)
            .stringify_64_bit_integers(true);
        dyn_msg
            .serialize_with_options(&mut ser, &opts)
            .map_err(|e| crate::error::AppError::EncodeError {
                field: "<root>".to_string(),
                message: e.to_string(),
            })?;
        let decoded: serde_json::Value = serde_json::from_slice(&buf).map_err(|e| {
            crate::error::AppError::EncodeError {
                field: "<root>".to_string(),
                message: e.to_string(),
            }
        })?;
        Ok(ConsumeResult {
            empty: false,
            decoded: Some(decoded),
            hex_string,
            error: None,
        })
    }
    Err(e) => {
        // D-10: message was already acked above. Return error inline — do NOT propagate as Err.
        Ok(ConsumeResult {
            empty: false,
            decoded: None,
            hex_string,
            error: Some(format!("Decode failed: {}. Showing raw bytes.", e)),
        })
    }
}
```

**Key pattern insights:**
- Pool is cloned FIRST (before any .await) because MutexGuard is not Send
- Connection URI scope is tight: password dropped before result inspection (security pattern)
- Connection is explicitly closed even on errors (prevents TCP leaks)
- Ack happens BEFORE channel close, decode happens AFTER channel close
- Decode errors return Ok (not Err) with error string populated (D-10: already-acked messages surfaced)

---

### `src-tauri/src/lib.rs` (config, configuration)

**Analog:** `src-tauri/src/lib.rs` (existing, extension point)

**Command registration pattern** (lines 38-52):
```rust
.invoke_handler(tauri::generate_handler![
    commands::proto::parse_proto,
    commands::encode::encode_message,
    commands::connection::save_profile,
    commands::connection::list_profiles,
    commands::connection::delete_profile,
    commands::connection::test_connection,
    commands::connection::activate_profile,
    commands::connection::fetch_queues,
    commands::connection::fetch_queue_depth,
    commands::connection::fetch_exchanges,
    commands::connection::fetch_bindings,
    commands::publish::publish_message,
    commands::consume::consume_message,
])
```

**Add `drain_messages` to this list** after `consume_message`:
```rust
commands::consume::drain_messages,
```

---

### `src/lib/ipc.ts` (utility, request-response)

**Analog:** `src/lib/ipc.ts` (existing, extension point)

**IPC function signature pattern** (lines 104-114):
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

**Add drainMessages function alongside** (follows same pattern):
```typescript
export async function drainMessages(
  profileName: string,
  queueName: string,
  messageTypeName: string,
  count: number,
): Promise<DrainOutcome> {
  return invoke<DrainOutcome>("drain_messages", {
    profileName,
    queueName,
    messageTypeName,
    count,
  });
}
```

---

### `src/lib/types.ts` (type-def, data-structure)

**Analog:** `src/lib/types.ts` (existing, extension point)

**Existing types section** (lines 84-89):
```typescript
export interface ConsumeResult {
  empty: boolean;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

**Add new types alongside** (follows same interface pattern):
```typescript
export interface DrainResult {
  routingKey: string;
  exchange: string;
  contentType: string | null;
  timestamp: number | null;           // seconds since epoch; None if publisher didn't set it
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}

export interface DrainOutcome {
  messages: DrainResult[];
  partialError: string | null;        // set if basic_get errored mid-loop
}

export interface FeedMessage {
  id: string;                          // crypto.randomUUID() at append time
  routingKey: string;
  exchange: string;
  contentType: string | null;
  timestamp: number | null;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

---

### `src/stores/useResponseStore.ts` (store, state-management)

**Analog:** `src/stores/useProtoStore.ts`

**Zustand store pattern with INITIAL_STATE** (lines 49-62 of useProtoStore):
```typescript
const INITIAL_STATE = {
  openFiles: [] as OpenFileEntry[],
  activeIndex: -1,
  activeFilePath: null as string | null,
  schema: null as ProtoSchema | null,
  selectedMessageType: null as string | null,
  hexPreview: "",
  isEncoding: false,
  encodeError: null as string | null,
  latestValues: null as Record<string, unknown> | null,
  lastSendAt: null as number | null,
  pendingReplayValues: null as Record<string, unknown> | null,
};

export const useProtoStore = create<ProtoStore>((set) => ({
  ...INITIAL_STATE,
  // actions follow...
  reset: () => set({ ...INITIAL_STATE }),
}));
```

**Apply same pattern to useResponseStore for message feed evolution:**
- Replace `lastResult` with `messages: FeedMessage[]`
- Retain `lastReadAt` (used by queue depth refresh hook)
- Retain `isLoading`
- Retain `queueDepth`
- Add `appendMessages(incoming: FeedMessage[])` action
- Add `clearMessages()` action
- Respect immutability: `const combined = [...incoming, ...state.messages]; slice(0, 500)`

**Append action with FIFO cap** (from RESEARCH.md):
```typescript
const FEED_MAX_SIZE = 500;

appendMessages: (incoming: FeedMessage[]) =>
  set((state) => {
    const combined = [...incoming, ...state.messages];
    return { messages: combined.slice(0, FEED_MAX_SIZE) };
  }),
```

---

### `src/components/response/ResponseTab.tsx` → `MessageFeedTab.tsx` (component, UI-rendering)

**Analog:** `src/components/response/ResponseTab.tsx` (existing, replace with refactor)

**Current structure pattern** (lines 10-82):
```tsx
export function ResponseTab() {
  const { connectionStatus, activeProfileName } = useConnectionStore();
  const { selectedMessageType } = useProtoStore();
  const {
    selectedQueue,
    lastResult,
    setIsLoading,
    setLastResult,
    setLastReadAt,
  } = useResponseStore();

  const isConnected = connectionStatus === "connected";
  const canRead = isConnected && selectedQueue.trim().length > 0 && selectedMessageType !== null;

  const handleRead = async () => {
    if (!canRead || !activeProfileName || !selectedMessageType) return;
    setIsLoading(true);
    try {
      const result = await consumeMessage(/* ... */);
      setLastResult(/* ... */);
      if (!result.empty) {
        setLastReadAt(Date.now());
      }
    } catch (err: unknown) {
      // error handling
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ResponseQueuePicker onRead={() => void handleRead()} />
      <ScrollArea className="flex-1 overflow-hidden">
        {/* conditional rendering */}
      </ScrollArea>
    </div>
  );
}
```

**Apply to MessageFeedTab:**
- Replace `handleRead` with `handleDrain(count: number)` that calls `drainMessages(..., count)`
- Replace `setLastResult` with `appendMessages(outcome.messages)` from Zustand
- Handle empty-queue case: `if (outcome.messages.length === 0) toast.info("Queue is empty")`
- Always call `setLastReadAt(Date.now())` after drain (triggers queue depth refresh)
- Render `<MessageFeedRow>` inside accordion for each message in `messages[]`

**ScrollArea composition** (line 62):
```tsx
<ScrollArea className="flex-1 overflow-hidden">
  {/* content here */}
</ScrollArea>
```

---

### `src/components/response/MessageFeedRow.tsx` (component, UI-rendering)

**Analog:** `src/components/response/ResponseDecodedView.tsx`

**Collapsible pattern for nested objects** (ResponseDecodedView lines 20-36):
```tsx
function JsonTreeNode({ keyName, value, depth = 0 }: JsonTreeNodeProps) {
  const [open, setOpen] = useState(true); // all nodes start expanded

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return (
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="ml-4 border-l border-border pl-3 mb-1"
      >
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground py-0.5 cursor-pointer">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {keyName}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <JsonTreeNode key={k} keyName={k} value={v} depth={depth + 1} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }
  // ...
}
```

**Apply to MessageFeedRow:**
- Use shadcn `Accordion type="single" collapsible` (not Collapsible) for feed-level row management
- Pass `msg.id` as AccordionItem value for stable row identity
- Collapsed trigger shows: `routing_key • exchange • content-type • timestamp` (D-07, compact single-line format)
- Expanded content composes: `<ResponseDecodedView>` + `<ResponseHexSection>` (D-08)

**shadcn Accordion usage** (from RESEARCH.md):
```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

<Accordion type="single" collapsible className="w-full">
  {messages.map((msg) => (
    <AccordionItem key={msg.id} value={msg.id}>
      <AccordionTrigger className="px-4 py-2 text-xs font-mono">
        {msg.routingKey} • {msg.exchange} • {msg.contentType ?? "—"} • {formatTimestamp(msg.timestamp)}
      </AccordionTrigger>
      <AccordionContent>
        <ResponseDecodedView decoded={msg.decoded} error={msg.error} />
        <ResponseHexSection hexString={msg.hexString} decoded={msg.decoded} />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

---

### `src/components/response/ResponseQueuePicker.tsx` (component, UI-interaction)

**Analog:** `src/components/response/ResponseQueuePicker.tsx` (existing, extend in-place)

**Current button pattern** (lines 141-164):
```tsx
{connectionStatus === "connected" ? (
  <Button
    variant="default"
    disabled={!selectedQueue.trim() || isLoading}
    onClick={onRead}
  >
    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
    Read
  </Button>
) : (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button variant="default" disabled>
            Read
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Connect to a RabbitMQ profile to read.</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

**Apply to ResponseQueuePicker modifications:**
- Rename "Read" button to "Drain"
- Change `onRead` prop to `onDrain: (count: number) => void`
- Add drain count number input before the Drain button
- Extract count from input via local `useState<number>(10)`
- Pass count to `onDrain(count)` when button clicked
- Input pattern: `<Input type="number" min={1} max={500} defaultValue={10} />`

**Input component usage** (lines 109-114):
```tsx
<Input
  placeholder="Queue name"
  className="w-48"
  value={selectedQueue}
  onChange={(e) => setSelectedQueue(e.target.value)}
/>
```

---

### `src/components/response/ResponseHexSection.tsx` (component, UI-rendering)

**Analog:** `src/components/response/ResponseHexSection.tsx` (existing, refactor to props)

**Current store-read pattern** (lines 7-10):
```tsx
export function ResponseHexSection() {
  const lastResult = useResponseStore((s) => s.lastResult);

  if (!lastResult || lastResult.empty || !lastResult.hexString) return null;
```

**Refactor to props-based pattern** (matching ResponseDecodedView):
```tsx
interface ResponseHexSectionProps {
  hexString: string;
  decoded: Record<string, unknown> | null;
}

export function ResponseHexSection({ hexString, decoded }: ResponseHexSectionProps) {
  if (!hexString) return null;
```

**Copy logic remains unchanged** (lines 12-29):
```tsx
const handleCopyHex = async () => {
  try {
    await navigator.clipboard.writeText(lastResult.hexString);
    toast("Hex copied", { duration: 2000 });
  } catch {
    toast.error("Copy failed — clipboard access denied", { duration: 2000 });
  }
};

const handleCopyJson = async () => {
  if (!lastResult.decoded) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastResult.decoded, null, 2));
    toast("JSON copied", { duration: 2000 });
  } catch {
    toast.error("Copy failed — clipboard access denied", { duration: 2000 });
  }
};
```

Update references from `lastResult.hexString` → `hexString` and `lastResult.decoded` → `decoded`.

---

## Shared Patterns

### Ack-Before-Decode (Message Consumption Safety)

**Source:** `src-tauri/src/commands/consume.rs` (D-10 pattern)

**Apply to:** All drain message operations

```rust
// Step 7: ACK BEFORE DECODE
// CRITICAL ORDER: ack → close (acking after close silently fails)
if let Err(e) = channel
    .basic_ack(
        delivery_tag,
        lapin::options::BasicAckOptions::default(),
    )
    .await
{
    let _ = conn.close(0, "".into()).await;
    return Err(crate::error::AppError::AmqpError(format!("Ack failed: {}", e)));
}

// Step 8: Close connection AFTER ack
let _ = conn.close(0, "".into()).await;

// Step 9: Decode (synchronous — pool already cloned)
// Decode errors return Ok with error string (message already acked)
```

This pattern ensures already-acked messages are surfaced to the user even if decode fails.

---

### Zustand State Management (Immutable Updates)

**Source:** `src/stores/useProtoStore.ts` (immutable update pattern)

**Apply to:** All Zustand actions in `useResponseStore`

```typescript
set((state) => {
  // Never mutate state directly
  const combined = [...incoming, ...state.messages];
  return { messages: combined.slice(0, FEED_MAX_SIZE) };
})
```

Key principle: Create new objects, never modify in-place. Spread operator for immutable updates.

---

### Empty Queue Feedback (User-Facing Toast)

**Source:** `src/stores/useProtoStore.ts` (Sonner toast usage, line 90)

**Apply to:** MessageFeedTab drain handler

```typescript
import { toast } from "sonner";

// In handleDrain:
if (outcome.messages.length === 0) {
  toast.info("Queue is empty");
}
```

No warning or error — just informational toast (D-03). Queue depth badge already signals count before drain.

---

### IPC Function Signature Pattern

**Source:** `src/lib/ipc.ts` (lines 104-114, consumeMessage example)

**Apply to:** drainMessages function

```typescript
export async function drainMessages(
  profileName: string,
  queueName: string,
  messageTypeName: string,
  count: number,
): Promise<DrainOutcome> {
  return invoke<DrainOutcome>("drain_messages", {
    profileName,
    queueName,
    messageTypeName,
    count,
  });
}
```

All parameters are primitives. Return type is serializable from Rust (serde).

---

### Component Props Pattern

**Source:** `src/components/response/ResponseDecodedView.tsx` (lines 69-90)

**Apply to:** All new response components

```typescript
interface ResponseDecodedViewProps {
  decoded: Record<string, unknown> | null;
  error: string | null;
}

export function ResponseDecodedView({ decoded, error }: ResponseDecodedViewProps) {
  // implementation
}
```

Explicit named props interface, no store reads. Enables composition and testing with mocked data.

---

## Test File Updates Required

RESEARCH.md Pitfall 8 identifies four test files requiring updates:

| File | Change Required | Analog Pattern |
|------|-----------------|----------------|
| `ResponseTab.test.tsx` → `MessageFeedTab.test.tsx` | Replace with `MessageFeedTab.test.tsx`; seed `messages[]` not `lastResult`; **Test 2 behavior shift**: current assert DOM text "Queue empty" → new toast mock assertion | lines 1-63 setup pattern, lines 66-83 mock assertion pattern |
| `ResponseHexSection.test.tsx` | Migrate from `setState({lastResult})` to prop-based rendering via `{ hexString, decoded }` | lines 1-23 mock setup + props-based `render()` |
| `ResponseQueuePicker.test.tsx` | Update "Read" button assertions to "Drain"; add drain count input test | lines 1-50 existing test setup pattern |
| `ResponseDecodedView.test.tsx` | No change required — already prop-based | No changes needed |

**Test pattern from ResponseTab.test.tsx** (lines 1-63):
```typescript
import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockDrainMessages } = vi.hoisted(() => ({
  mockDrainMessages: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  drainMessages: mockDrainMessages,
}));

import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { MessageFeedTab } from "./MessageFeedTab";

beforeEach(() => {
  vi.clearAllMocks();

  // Reset response store with new messages[] field
  useResponseStore.setState({
    selectedQueue: "",
    isLoading: false,
    messages: [],
    lastReadAt: null,
    queueList: [],
    isLiveMode: false,
  });

  // Reset connection and proto stores (unchanged)
  // ...
});
```

---

## No Analog Found

None. All files have strong analogs in the codebase.

| File | Reason |
|------|--------|
| — | All files extend or refactor existing analogs; no greenfield code required |

---

## Metadata

**Analog search scope:** `/src-tauri/src/commands/`, `/src/stores/`, `/src/lib/`, `/src/components/response/`

**Files scanned:** 15+ existing files (Rust commands, TypeScript stores, React components)

**Pattern extraction date:** 2026-05-20

**Key insights:**
1. **Rust pattern:** consume.rs establishes all required patterns (connection lifecycle, ack-before-decode, pool cloning, URI security)
2. **Frontend pattern:** ResponseTab + useResponseStore + ResponseDecodedView form the base for MessageFeedTab + updated store + MessageFeedRow
3. **Store pattern:** useProtoStore INITIAL_STATE + immutable update actions provide the template for store evolution
4. **Component pattern:** ResponseDecodedView (prop-based) is the target refactoring model for ResponseHexSection
5. **Test pattern:** ResponseTab.test.tsx provides setup/mock/assertion patterns; toast assertions require Sonner mock addition

---

**Pattern mapping complete. Ready for planner consumption.**
