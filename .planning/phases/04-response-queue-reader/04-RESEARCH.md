# Phase 4: Response Queue Reader — Research

**Researched:** 2026-05-18
**Domain:** lapin basic_get / prost-reflect decode / Tauri IPC / React Zustand response tab
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**UI Placement — Response Tab**
- D-01: Response reader lives as the 3rd tab in `RightPanel` ("Response"), alongside existing History and Hex tabs. No `AppLayout.tsx` changes needed.
- D-02: Layout stacked vertically: collapsible decoded field tree on top, raw hex string below.
- D-03: Idle state: muted placeholder text ("Select a reply queue and click Read"). After empty-queue read: inline "Queue empty" text replaces placeholder — no toast.
- D-04: Multiple reads replace the previous result. Always shows most recently consumed message only.

**Reply Queue Picker**
- D-05: Reply queue picker lives inside the Response tab (self-contained). Layout: queue picker + Read button → decoded result.
- D-06: Queue list populates on Response tab focus, reusing existing `fetch_queues` IPC call. Live/Manual fallback same as PUBL-03.
- D-07: Selected reply queue is session-only (Zustand in `useResponseStore`). Not persisted. Resets on app restart.
- D-08: Read button disabled + tooltip when no active connection: "Connect to a RabbitMQ profile to read."
- D-16: Read button shows loading spinner and is disabled while `consume_message` IPC is in flight.

**Deserialization**
- D-09: Always deserialize using the active form message type (no separate selector in Response tab).
- D-10: Decode failure (schema mismatch / corrupt payload): show raw hex + inline error. Message is ALWAYS ack'd regardless of decode outcome. This overrides RESP-04's "after successful deserialization" clause. Planner MUST note this deviation.
- D-11: Decoded fields rendered as collapsible key-value tree. Read-only labels only, no form inputs.
- D-12: After successful read, app auto-switches to Response tab via `lastReadAt` ref signal (mirrors Phase 3 `lastSendAt` pattern).

**History Integration**
- D-13: History stays send-only. Consumed messages NOT added to `useHistoryStore`.
- D-14: Response tab provides two copy actions: "Copy hex" + "Copy decoded JSON".
- D-15: Response tab is read-only. No "Load into form" / replay action.

**Claude's Discretion**
- Rust command name: `consume_message`; ephemeral connection pattern from `publish_message`
- Return type from Rust: struct with `{ payload: Vec<u8>, message_tag: u64 }` — however, based on research (D-10 ack-always), ack happens INSIDE the Rust command before returning, so the tag does not need to be returned to the frontend. Return struct: `{ decoded: serde_json::Value, hex_string: String, error: Option<String> }` covering all outcomes.
- `useResponseStore` shape: `{ queueList, isLiveMode, selectedQueue, isLoading, lastResult: { decoded, hexString, error } | null, lastReadAt: number | null }`
- Component names: `ResponseTab`, `ResponseQueuePicker`, `ResponseDecodedView`, `ResponseHexSection`

### Claude's Discretion (from CONTEXT.md)
See "Deserialization" → return type and component names as above.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESP-01 | Select reply/response queue — live dropdown from Management API, fallback to manual text input | `fetch_queues` IPC already implemented in `connection.rs`; reused directly |
| RESP-02 | Read one message on "Read" click; non-blocking; clear "Queue empty" state | `basic_get` returns `Option<BasicGetMessage>` — `None` maps to "Queue empty"; inherently non-blocking |
| RESP-03 | Deserialize binary protobuf payload using active message type; display field values | `DynamicMessage::decode(descriptor, bytes)` from prost-reflect; pool cloned O(1) before await |
| RESP-04 | Acknowledge (basic.ack) consumed message after deserialization | `channel.basic_ack(delivery_tag, BasicAckOptions::default())` — OVERRIDDEN by D-10: ack always regardless of decode outcome |
| RESP-05 | Show decoded field values AND raw hex side by side | Two sections in ResponseTab: `ResponseDecodedView` (collapsible tree) + `ResponseHexSection` (hex string); copy buttons for both |
</phase_requirements>

---

## Summary

Phase 4 adds the response/consume side of the request-reply loop. On the Rust backend, a new `consume_message` command follows the same ephemeral connection pattern as `publish_message`: connect → create_channel → `basic_get` → `basic_ack` → close. The lapin `basic_get` method returns `Result<Option<BasicGetMessage>>`; `None` means the queue is empty (RESP-02 non-blocking guarantee). When a message arrives, the binary payload is decoded using `DynamicMessage::decode` from prost-reflect with the pool already held in Tauri's `State<Mutex<Option<DescriptorPool>>>`. The decoded message is serialized to `serde_json::Value` and returned to the frontend alongside the raw hex string.

On the React frontend, a new `useResponseStore` (Zustand, typed-interface + INITIAL_STATE pattern) holds the selected queue, loading state, and `lastResult`. A new `ResponseTab` component — registered as the 3rd tab in `RightPanel` — contains `ResponseQueuePicker` (mirroring PublishBar's Live/Manual pattern) and `ResponseDecodedView` + `ResponseHexSection`. The existing `lastSendAt` auto-switch pattern in `RightPanel` is extended with a `lastReadAt` signal that switches to the Response tab after a successful read.

**Primary recommendation:** Implement `consume_message` in a new `src-tauri/src/commands/consume.rs` file. Clone the `DescriptorPool` out of the Mutex lock before any `.await`, ack the message before attempting decode (D-10 always-ack), and return a unified result struct covering both success and decode-failure cases.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AMQP queue consumer (basic_get) | API/Backend (Rust) | — | AMQP protocol work belongs in backend; no browser AMQP client |
| Message deserialization (protobuf) | API/Backend (Rust) | — | `prost-reflect` is a Rust crate; raw bytes cannot be decoded in JS |
| Ack management | API/Backend (Rust) | — | AMQP channel must ack on same channel as get; backend owns the channel |
| Queue list fetch | API/Backend (Rust) | — | Existing `fetch_queues` command; Management API call |
| Response tab state | Frontend (React/Zustand) | — | Session-only state per D-07; no persistence |
| Decoded field display (tree) | Frontend (React) | — | UI rendering; reads JSON value from Rust |
| Raw hex display | Frontend (React) | — | Frontend receives hex string from Rust |
| Auto-tab-switch on read | Frontend (React) | — | `RightPanel` owns tab state; `lastReadAt` signal from store |

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Phase 4 Usage |
|---------|---------|---------|---------------|
| `lapin` | 4.7.4 [VERIFIED: crates.io] | AMQP client | `basic_get`, `basic_ack` |
| `prost-reflect` | 0.16.x [VERIFIED: Cargo.toml] | Dynamic protobuf | `DynamicMessage::decode()`, serialize to JSON |
| `serde_json` | 1.x [VERIFIED: Cargo.toml] | JSON encode/decode | `serde_json::to_value(&dyn_msg)` for IPC return |
| `tauri` | 2.x [VERIFIED: Cargo.toml] | IPC framework | New `consume_message` command |
| `zustand` | 5.x [VERIFIED: package.json] | Frontend state | `useResponseStore` |

No new dependencies required for Phase 4. All crates already present in `Cargo.toml`.

### No New Dependencies Needed

The `prost-reflect` crate already has `features = ["serde"]` in `Cargo.toml` [VERIFIED: line 30 of Cargo.toml]. This enables `serde_json::to_value(&dyn_msg)` without any further setup.

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Read"
        │
        ▼
ResponseTab (React)
  └─ ResponseQueuePicker (selectedQueue, Live/Manual badge)
  └─ [Read button] → consumeMessage(profileName, queueName, messageTypeName)
        │  via IPC (invoke)
        ▼
consume_message (Tauri command — consume.rs)
  └─ load_profile_with_password()
  └─ build_amqp_uri() → [tight scope, drop before await]
  └─ Connection::connect() [10s timeout]
  └─ create_channel()
  └─ basic_get(queue, BasicGetOptions { no_ack: false })
        │
        ├── None → return ConsumeResult { empty: true }
        │
        └── Some(msg) ──────────────────────────────────────────┐
              │                                                   │
              ├─ extract delivery_tag, payload bytes (msg.data)  │
              │                                                   │
              ├─ basic_ack(delivery_tag, BasicAckOptions::default()) ◄─ ALWAYS (D-10)
              │                                                   │
              ├─ conn.close()                                     │
              │                                                   │
              ├─ [clone DescriptorPool — O(1), Arc-backed]        │
              ├─ pool.get_message_by_name(message_type_name)      │
              ├─ DynamicMessage::decode(descriptor, &payload)     │
              │     ├── Ok(dyn_msg) → serde_json::to_value()      │
              │     └── Err(e)     → error string, hex only       │
              │                                                   │
              └─ return ConsumeResult { decoded?, hex_string, error? }
                                       │
        ┌──────────────────────────────┘
        ▼
consumeMessage IPC wrapper (ipc.ts) → ConsumeResult
        │
        ▼
useResponseStore.setLastResult(result)
useResponseStore.setLastReadAt(Date.now())
        │
        ▼
RightPanel.useEffect([lastReadAt])
  └─ edge-detection: prevLastReadAt → setActiveTab("response")
        │
        ▼
ResponseTab renders:
  ├─ ResponseDecodedView (collapsible key-value tree from decoded JSON)
  └─ ResponseHexSection (hex string + "Copy hex" button)
```

### Recommended Project Structure (new files for Phase 4)

```
src-tauri/src/commands/
├── consume.rs            # NEW: consume_message command
└── mod.rs                # ADD: pub mod consume;

src/stores/
└── useResponseStore.ts   # NEW: Zustand response state

src/components/response/  # NEW directory
├── ResponseTab.tsx        # Top-level tab component
├── ResponseQueuePicker.tsx # Queue picker + Read button
├── ResponseDecodedView.tsx # Collapsible decoded field tree
└── ResponseHexSection.tsx  # Hex string + copy button

src/lib/
├── ipc.ts                # ADD: consumeMessage() wrapper
└── types.ts              # ADD: ConsumeResult type
```

### Pattern 1: lapin basic_get (Non-Blocking Consume)

**What:** Polls one message from a queue. Returns `None` if queue is empty — never blocks.
**When to use:** On-demand single-message consume (RESP-02). NOT for streaming/monitoring.

```rust
// Source: https://docs.rs/lapin/latest/lapin/struct.Channel.html
use lapin::options::{BasicAckOptions, BasicGetOptions};

let result = channel
    .basic_get(queue_name.as_str().into(), BasicGetOptions::default())
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?;

match result {
    None => {
        // Queue is empty — return sentinel to frontend
        let _ = conn.close(0, "".into()).await;
        return Ok(ConsumeResult { empty: true, decoded: None, hex_string: String::new(), error: None });
    }
    Some(msg) => {
        let delivery_tag = msg.delivery_tag;
        let payload: Vec<u8> = msg.data.clone();

        // CRITICAL (D-10): Ack BEFORE decode. Always ack, even on decode failure.
        // CRITICAL: Ack BEFORE close — ack must happen on same channel before conn.close().
        channel
            .basic_ack(delivery_tag, BasicAckOptions::default())
            .await
            .map_err(|e| AppError::AmqpError(e.to_string()))?;

        // Close connection (after ack — order matters)
        let _ = conn.close(0, "".into()).await;

        // Now decode payload (no async work below — safe to lock Mutex)
        // ... decode_payload(&pool_state, &message_type_name, payload)
    }
}
```

**Key: `BasicGetOptions::default()` sets `no_ack: false`** — manual ack mode. This is the correct default; do NOT set `no_ack: true` as it would auto-ack before we can act on the message.

### Pattern 2: DescriptorPool Clone Before Await

**What:** The pool is in `Mutex<Option<DescriptorPool>>` (std::sync). The Mutex guard cannot be held across `.await`. Clone the pool before any async work.

```rust
// Source: encode.rs pattern + STATE.md line 71 ("DescriptorPool clone() is O(1)")
// [VERIFIED: STATE.md accumulated context]
pub async fn consume_message(
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
    // ... other args
) -> Result<ConsumeResult, AppError> {
    // Clone pool FIRST, before any async work
    let pool = {
        let guard = pool_state.lock().unwrap();
        guard.as_ref()
            .ok_or_else(|| AppError::EncodeError { field: "<root>".to_string(), message: "No proto file loaded".to_string() })?
            .clone() // O(1) — Arc-backed
    }; // guard drops here

    // Now safe to do async work (basic_get, ack, close)
    // ...
    
    // Then decode synchronously with the cloned pool
    let msg_desc = pool.get_message_by_name(&message_type_name)
        .ok_or_else(|| /* ... */)?;
    
    match DynamicMessage::decode(msg_desc, payload.as_ref()) {
        Ok(dyn_msg) => {
            let decoded = serde_json::to_value(&dyn_msg)
                .map_err(|e| AppError::EncodeError { field: "<root>".to_string(), message: e.to_string() })?;
            Ok(ConsumeResult { empty: false, decoded: Some(decoded), hex_string, error: None })
        }
        Err(e) => {
            // D-10: always return result even on decode failure (message was already acked)
            Ok(ConsumeResult { empty: false, decoded: None, hex_string, error: Some(e.to_string()) })
        }
    }
}
```

### Pattern 3: Rust Return Struct

```rust
// Source: CONTEXT.md D-10 / D-14 requirements
// [VERIFIED: established by context.md decisions]
use serde::Serialize;

#[derive(Serialize)]
pub struct ConsumeResult {
    pub empty: bool,              // true when queue had no messages
    pub decoded: Option<serde_json::Value>, // None on empty or decode failure
    pub hex_string: String,       // empty string when queue empty
    pub error: Option<String>,    // decode error message (message was acked)
}
```

### Pattern 4: Frontend ConsumeResult Type + IPC Wrapper

```typescript
// src/lib/types.ts addition
export interface ConsumeResult {
  empty: boolean;
  decoded: Record<string, unknown> | null;  // serde_json::Value → JSON object
  hexString: string;
  error: string | null;
}

// src/lib/ipc.ts addition
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

### Pattern 5: useResponseStore (Zustand typed interface + INITIAL_STATE)

```typescript
// src/stores/useResponseStore.ts
// [VERIFIED: matches useConnectionStore.ts pattern in project]
import { create } from "zustand";

export interface ResponseResult {
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}

interface ResponseStore {
  queueList: string[];
  isLiveMode: boolean;
  selectedQueue: string;
  isLoading: boolean;
  lastResult: ResponseResult | null;
  lastReadAt: number | null;

  setQueueList: (queues: string[], isLive: boolean) => void;
  setSelectedQueue: (queue: string) => void;
  setIsLoading: (loading: boolean) => void;
  setLastResult: (result: ResponseResult | null) => void;
  setLastReadAt: (ts: number | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  queueList: [] as string[],
  isLiveMode: false,
  selectedQueue: "",
  isLoading: false,
  lastResult: null as ResponseResult | null,
  lastReadAt: null as number | null,
} as const;

export const useResponseStore = create<ResponseStore>((set) => ({
  ...INITIAL_STATE,
  setQueueList: (queueList, isLiveMode) => set({ queueList, isLiveMode }),
  setSelectedQueue: (selectedQueue) => set({ selectedQueue }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLastResult: (lastResult) => set({ lastResult }),
  setLastReadAt: (lastReadAt) => set({ lastReadAt }),
  reset: () => set({ ...INITIAL_STATE }),
}));
```

### Pattern 6: RightPanel Extension — 3rd Tab + lastReadAt Auto-Switch

```typescript
// src/components/layout/RightPanel.tsx — additions to existing component
// [VERIFIED: existing RightPanel.tsx code read in this session]

// Widen type
const [activeTab, setActiveTab] = useState<"hex" | "history" | "response">("hex");

// New signal from useResponseStore
const lastReadAt = useResponseStore((s) => s.lastReadAt);
const prevLastReadAt = useRef<number | null>(null);

// CRITICAL: Use lastReadAt (explicit timestamp) — NOT derived from lastResult !== null.
// Derived signal does not re-trigger on second read with same-shaped result.
useEffect(() => {
  if (lastReadAt !== null && lastReadAt !== prevLastReadAt.current) {
    prevLastReadAt.current = lastReadAt;
    setActiveTab("response");
  }
}, [lastReadAt]);

// In JSX: add 3rd tab trigger and content
// <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
// <TabsContent value="response" className="flex-1 overflow-hidden m-0 p-0">
//   <ResponseTab />
// </TabsContent>
```

### Pattern 7: bytesToHex Helper (New Utility)

The frontend needs a `bytesToHex` helper. The codebase has `hexToBytes` (in PublishBar.tsx) but not the reverse. The Rust command returns a hex string directly, so the frontend does NOT need to convert — but the Rust command must produce it.

```rust
// In consume.rs — produce hex string from Vec<u8>
fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<_>>()
        .join(" ")
}
// Output format: "0a 05 68 65 6c 6c 6f" — matches existing HexPreviewPanel format
```

### Anti-Patterns to Avoid

- **Holding Mutex guard across .await:** Compiler will reject it, but the fix (clone pool before async work) is easy to miss. Clone first, then do all async.
- **Acking after close:** `basic_ack` requires the channel to be open. Order must be: get → ack → close.
- **Using `basic_consume` instead of `basic_get`:** `basic_consume` is a streaming subscription, not a one-shot poll. It returns a `Consumer` stream. RESP-02 requires non-blocking single-message poll — use `basic_get`.
- **Setting `no_ack: true` in `BasicGetOptions`:** Would auto-ack before extracting payload, making ack control impossible.
- **Trusting only decode success to ack:** D-10 explicitly overrides this. Always ack — even on decode failure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binary protobuf decode at runtime | Custom binary parser | `prost-reflect` `DynamicMessage::decode()` | Wire format has varint encoding, nested types, oneof; prost handles all edge cases |
| Bytes-to-JSON field value mapping | Manual field extraction loop | `serde_json::to_value(&dyn_msg)` | prost-reflect implements Serialize trait; handles all field kinds including nested messages, enums, repeated fields |
| Queue listing | Custom reqwest call | Reuse existing `fetch_queues` IPC | Already implemented with 401 discrimination and Live/Manual fallback |
| Clipboard write | Custom copy logic | `navigator.clipboard.writeText()` | Already used in HexPreviewPanel; no new dependency |

---

## Common Pitfalls

### Pitfall 1: Mutex Guard Across `.await` — Compile Error
**What goes wrong:** `consume_message` needs the `DescriptorPool` (behind `Mutex`) AND needs to call `basic_get(...).await`. Holding the MutexGuard across `.await` fails at compile time in Rust (`std::sync::MutexGuard` is not `Send`).
**Why it happens:** Async functions become state machines; holding a non-Send guard across a suspension point is a compile error.
**How to avoid:** Clone the `DescriptorPool` out of the lock, drop the guard, THEN proceed to async AMQP work. `DescriptorPool::clone()` is O(1) (Arc-backed, confirmed in STATE.md accumulated context).
**Warning signs:** Compiler error mentioning `MutexGuard` not being `Send` or `Sync`.

### Pitfall 2: Ack After Close
**What goes wrong:** The connection is closed before `basic_ack` is called. The ack silently fails or returns an error.
**Why it happens:** Copying publish.rs pattern blindly — publish has no ack, so close immediately after publish is correct. Consume requires ack first.
**How to avoid:** Order is: `basic_get` → `basic_ack` → `conn.close()`. Never reverse ack and close.
**Warning signs:** `basic_ack` returns an error like "channel closed" after `conn.close()` was called.

### Pitfall 3: prost-reflect JSON Field Name Format (lowerCamelCase vs snake_case)
**What goes wrong:** A proto field named `user_id` is serialized to JSON as `userId` (lowerCamelCase) by default. The collapsible tree shows `userId` to the user, but their `.proto` file says `user_id`.
**Why it happens:** `serde_json::to_value(&dyn_msg)` uses `SerializeOptions` defaults: `use_proto_field_name: false` (lowerCamelCase output).
**How to avoid:** Use `serialize_with_options` with `use_proto_field_name: true` to match exact proto field names. This is a product decision — see Open Questions.
**Warning signs:** Field names in the decoded tree don't match what the user typed in their `.proto` file.

### Pitfall 4: prost-reflect 64-bit Integers Serialized as Strings
**What goes wrong:** `int64` and `uint64` fields are serialized as JSON strings (`"9007199254740993"`) rather than numbers. Frontend receives a string, not a number.
**Why it happens:** Default `SerializeOptions`: `stringify_64_bit_integers: true` (prevents JS precision loss).
**How to avoid:** This is the correct behavior for a dev tool — display is string-based. Accept it and render the value verbatim in the decoded tree. Do NOT change the default unless the user complains.
**Warning signs:** Type confusion in frontend if code tries to do arithmetic on decoded 64-bit fields.

### Pitfall 5: lastReadAt Derived from lastResult Instead of Explicit Timestamp
**What goes wrong:** If auto-switch logic derives "read happened" from `lastResult !== null` transition, a second read returning the same-shaped result will not re-trigger the `useEffect` (no referential change).
**Why it happens:** Shallow dependency comparison in React's `useEffect`.
**How to avoid:** Use an explicit `lastReadAt: number | null` field (timestamp from `Date.now()`), updated on every successful read. Same pattern as `lastSendAt` in `useProtoStore`.
**Warning signs:** Auto-switch to Response tab works on first read but not on subsequent reads.

### Pitfall 6: RightPanel activeTab Type Not Widened
**What goes wrong:** `useState<"hex" | "history">` TypeScript cast in `onValueChange` fails when `"response"` value is set.
**Why it happens:** Existing type union doesn't include `"response"`.
**How to avoid:** Update the type to `"hex" | "history" | "response"` in `RightPanel.tsx`.
**Warning signs:** TypeScript error at `setActiveTab(v as "hex" | "history")`.

### Pitfall 7: basic_get Returns Empty — Close Connection Anyway
**What goes wrong:** On empty queue, the connection is created but never closed, leaking a TCP connection.
**Why it happens:** Early-return path forgets to close before returning the "empty" result.
**How to avoid:** `conn.close()` must be called on ALL exit paths — empty queue and success and error.

---

## Code Examples

### Full consume_message Command Skeleton

```rust
// Source: lapin docs.rs + existing publish.rs pattern [VERIFIED: both read in session]
// src-tauri/src/commands/consume.rs

use lapin::{Connection, ConnectionProperties, options::{BasicAckOptions, BasicGetOptions}};
use prost_reflect::DynamicMessage;
use prost_reflect::prost::Message;
use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;
use crate::error::AppError;
use crate::profiles::build_amqp_uri;

#[derive(Serialize)]
pub struct ConsumeResult {
    pub empty: bool,
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn consume_message(
    app: AppHandle,
    profile_name: String,
    queue_name: String,
    message_type_name: String,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<ConsumeResult, AppError> {
    // Step 1: Clone pool BEFORE any async work (MutexGuard not Send)
    let pool = {
        let guard = pool_state.lock().unwrap();
        guard.as_ref()
            .ok_or_else(|| AppError::EncodeError {
                field: "<root>".to_string(),
                message: "No proto file loaded".to_string(),
            })?
            .clone() // O(1) — Arc-backed
    }; // guard dropped here

    // Step 2: Load credentials (sync)
    let (profile, password) =
        crate::commands::connection::load_profile_with_password(&app, &profile_name)?;

    // Step 3: Connect (URI in tight scope, drop before inspect result)
    let conn = {
        let uri = build_amqp_uri(
            &profile.host, profile.port, &profile.vhost, &profile.username, &password,
        );
        drop(password);
        tokio::time::timeout(
            Duration::from_secs(10),
            Connection::connect(&uri, ConnectionProperties::default()),
        )
        .await
        .map_err(|_| AppError::AmqpError("Consume connection timed out (10s)".to_string()))?
        .map_err(|_| AppError::AmqpError("AMQP connection failed — check host, port, vhost, and credentials".to_string()))?
    };

    // Step 4: Create channel (close conn on error)
    let channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            let _ = conn.close(0, "".into()).await;
            return Err(AppError::AmqpError(e.to_string()));
        }
    };

    // Step 5: basic_get — non-blocking poll
    let get_result = channel
        .basic_get(queue_name.as_str().into(), BasicGetOptions::default())
        .await;

    let msg = match get_result {
        Err(e) => {
            let _ = conn.close(0, "".into()).await;
            return Err(AppError::AmqpError(e.to_string()));
        }
        Ok(None) => {
            // Queue empty — close and return empty sentinel
            let _ = conn.close(0, "".into()).await;
            return Ok(ConsumeResult { empty: true, decoded: None, hex_string: String::new(), error: None });
        }
        Ok(Some(msg)) => msg,
    };

    // Step 6: Extract payload and delivery tag
    let delivery_tag = msg.delivery_tag;
    let payload: Vec<u8> = msg.data.clone();
    let hex_string = bytes_to_hex(&payload);

    // Step 7: Ack BEFORE close (D-10: always ack, even if decode fails later)
    if let Err(e) = channel.basic_ack(delivery_tag, BasicAckOptions::default()).await {
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(format!("Ack failed: {}", e)));
    }

    // Step 8: Close connection (after ack)
    let _ = conn.close(0, "".into()).await;

    // Step 9: Decode — sync, no await, pool already cloned
    let msg_desc = match pool.get_message_by_name(&message_type_name) {
        Some(d) => d,
        None => {
            return Ok(ConsumeResult {
                empty: false,
                decoded: None,
                hex_string,
                error: Some(format!("Message type '{}' not found in loaded schema", message_type_name)),
            });
        }
    };

    match DynamicMessage::decode(msg_desc, payload.as_ref()) {
        Ok(dyn_msg) => {
            let decoded = serde_json::to_value(&dyn_msg)
                .map_err(|e| AppError::EncodeError {
                    field: "<root>".to_string(),
                    message: e.to_string(),
                })?;
            Ok(ConsumeResult { empty: false, decoded: Some(decoded), hex_string, error: None })
        }
        Err(e) => {
            // D-10: message was already acked. Return error inline.
            Ok(ConsumeResult {
                empty: false,
                decoded: None,
                hex_string,
                error: Some(format!("Decode failed: {}. Showing raw bytes.", e)),
            })
        }
    }
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<_>>()
        .join(" ")
}
```

### lib.rs Registration

```rust
// Add to invoke_handler! macro in src-tauri/src/lib.rs
// [VERIFIED: existing lib.rs pattern]
commands::consume::consume_message,
```

### mod.rs Addition

```rust
// src-tauri/src/commands/mod.rs — add:
pub mod consume;
```

---

## Integration Points

All changes are additive. No existing code is modified except:

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Add `commands::consume::consume_message` to `invoke_handler!` |
| `src-tauri/src/commands/mod.rs` | Add `pub mod consume;` |
| `src/components/layout/RightPanel.tsx` | Add `"response"` tab, import `useResponseStore`, add `lastReadAt` auto-switch effect |
| `src/lib/ipc.ts` | Add `consumeMessage()` wrapper |
| `src/lib/types.ts` | Add `ConsumeResult` interface |

New files (no existing code modified):

- `src-tauri/src/commands/consume.rs`
- `src/stores/useResponseStore.ts`
- `src/components/response/ResponseTab.tsx`
- `src/components/response/ResponseQueuePicker.tsx`
- `src/components/response/ResponseDecodedView.tsx`
- `src/components/response/ResponseHexSection.tsx`

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `basic_consume` (streaming) for one-shot reads | `basic_get` (non-blocking poll) | Non-blocking, no consumer cleanup needed, returns `None` on empty queue |
| Hold Mutex guard across async | Clone pool before await | Required for Rust Send safety |
| Separate "ack on success" + "ack on failure" error branches | Single ack before decode (D-10) | Simpler error handling, no poison-pill blocking |

---

## Open Questions

1. **Proto field names: snake_case vs lowerCamelCase in decoded tree**
   - What we know: `serde_json::to_value(&dyn_msg)` defaults to lowerCamelCase field names. `serialize_with_options` with `use_proto_field_name: true` preserves exact proto names.
   - What's unclear: Product decision — which display format is better for dev tool users?
   - Recommendation: Use `use_proto_field_name: true` for the dev tool context. Users see their `.proto` file names in the tree, not camelCased transformations. Implement via `serialize_with_options`. This is Claude's discretion per CONTEXT.md — planner should lock this choice.

2. **Collapsible tree implementation for ResponseDecodedView**
   - What we know: `serde_json::Value` returns a JSON object tree. The decoded view must render nested objects as collapsible sections.
   - What's unclear: No existing collapsible JSON tree component in the codebase. The decode may return nested objects for nested proto messages.
   - Recommendation: Build a simple recursive `JsonTreeNode` component using shadcn `Collapsible` + `CollapsibleContent`. Each object value gets a toggle; scalar values render as `key: value` rows.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 uses only existing project dependencies (lapin, prost-reflect, Tauri). No new external tools, services, or runtimes required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BasicGetMessage` implements `Deref<Target = Delivery>` — `msg.delivery_tag` and `msg.data` accessible directly | Code Examples | Compile error; would need `msg.delivery.delivery_tag` instead |

**A1 mitigation:** The docs.rs search result and the lapin docs confirmed that `BasicGetMessage` has a `delivery: Delivery` field and implements Deref to Delivery. Access via `msg.delivery_tag` and `msg.data` should compile. If Deref is not implemented, access via `msg.delivery.delivery_tag` and `msg.delivery.data`. Low risk.

All other claims in this research were verified by reading actual project source files or official docs.rs pages.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 4 |
|-----------|-------------------|
| Tauri 2.x + Rust backend + React frontend | Yes — new command in Rust, new components in React |
| Binary protobuf wire format only | Yes — `DynamicMessage::decode()` produces proto-native values |
| Runtime `.proto` parsing (not pre-compiled) | Yes — pool already in State<Mutex<Option<DescriptorPool>>> |
| `tauri::async_runtime` not bare `tokio::spawn` | Yes — `consume_message` is a `#[tauri::command]` so Tauri manages the runtime |
| No `#[tokio::main]` conflict | Yes — command is async fn, not main |
| `lapin` 4.x | Yes — using `basic_get` and `basic_ack` |
| `prost-reflect` + `protox` must share prost 0.13.x | Yes — no new crate versions introduced |
| shadcn/ui + Tailwind 4 for UI | Yes — ResponseTab uses same shadcn components as PublishBar/HistoryPanel |
| Zustand 5.x typed interface + INITIAL_STATE pattern | Yes — useResponseStore follows exact pattern |
| Immutability: new objects, never mutate | Yes — all store updates use spread |
| Error handling: explicit at every level | Yes — ConsumeResult covers all outcomes; Err variants for AMQP failures |
| No hardcoded secrets | Yes — credentials loaded from keychain via load_profile_with_password |
| AMQP URI dropped before error propagation (security) | Yes — tight block pattern from publish.rs replicated |
| 80%+ test coverage | Yes — unit tests for pure functions (bytes_to_hex, ConsumeResult construction logic), integration-style tests using pool built from inline proto string |

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/commands/publish.rs` — ephemeral connection pattern (VERIFIED: read in session)
- `src-tauri/src/commands/connection.rs` — `fetch_queues`, `load_profile_with_password` (VERIFIED: read in session)
- `src-tauri/src/commands/encode.rs` — `DynamicMessage` usage, pool access pattern (VERIFIED: read in session)
- `src-tauri/Cargo.toml` — prost-reflect features = ["serde"] confirmed (VERIFIED: read in session)
- `src/stores/useConnectionStore.ts` — Zustand typed interface + INITIAL_STATE pattern (VERIFIED: read in session)
- `src/components/layout/RightPanel.tsx` — existing tab structure, lastSendAt edge-detection pattern (VERIFIED: read in session)
- `.planning/STATE.md` accumulated context — DescriptorPool.clone() is O(1), pool pattern (VERIFIED: read in session)
- https://docs.rs/lapin/latest/lapin/struct.Channel.html — basic_get, basic_ack signatures (VERIFIED: WebFetch)
- https://docs.rs/prost-reflect/latest/prost_reflect/ — DynamicMessage::decode(), serde serialization (VERIFIED: WebFetch)
- https://docs.rs/prost-reflect/latest/prost_reflect/struct.SerializeOptions.html — use_proto_field_name, stringify_64_bit_integers (VERIFIED: WebFetch)
- https://docs.rs/lapin/latest/lapin/options/struct.BasicGetOptions.html — no_ack field (VERIFIED: WebFetch)
- https://docs.rs/lapin/latest/lapin/options/struct.BasicAckOptions.html — multiple field (VERIFIED: WebFetch)
- https://media-cloud-ai.gitlab.io/sdks/py_mcai_worker_sdk/lapin/message/struct.Delivery.html — Delivery struct fields (VERIFIED: WebFetch)

### Secondary (MEDIUM confidence)
- WebSearch confirmed `Delivery` struct has `delivery_tag: LongLongUInt` and `data: Vec<u8>` fields (MEDIUM — multiple sources agree)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all crates already in project, versions verified from Cargo.toml
- Architecture: HIGH — based on reading actual existing source files
- lapin API (basic_get / basic_ack): HIGH — verified from docs.rs signatures
- prost-reflect decode + serialize: HIGH — verified from docs.rs examples
- Pitfalls: HIGH — Mutex/await pitfall is a Rust language constraint; others verified from code patterns

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable ecosystem — lapin 4.x and prost-reflect 0.16 not in rapid flux)
