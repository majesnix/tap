# Phase 3: Full Feature Set - Research

**Researched:** 2026-05-18
**Domain:** Message history persistence, AMQP message properties, multi-proto file tabs, WellKnownType form controls
**Confidence:** HIGH (stack locked from prior phases; API specifics verified via docs.rs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Message History Storage**
- D-01: History is persisted via `tauri-plugin-store` on the frontend — the same layer used for connection profiles. No new Rust commands required for history I/O.
- D-02: History is capped at 100 entries (FIFO). When the cap is hit, the oldest entry is dropped.
- D-03: Each history entry stores both the JSON field values object (for HIST-02 form replay via `reset()`) and the raw binary bytes (for HIST-03 hex view). Replay does not require re-encoding.

```ts
interface HistoryEntry {
  id: string;
  timestamp: string;       // ISO string (local)
  messageTypeName: string;
  exchange: string;
  routingKey: string;
  status: "sent" | "failed";
  errorMessage?: string;
  fieldValues: Record<string, unknown>;
  payloadBytes: number[];
}
```

**AMQP Properties State**
- D-04: AMQP properties are session-only — they reset to defaults on app restart.
- D-05: AMQP properties state lives in a new `useAmqpStore` Zustand store following the typed interface + `INITIAL_STATE` + `create()` pattern.

**Multi-Proto File Tabs**
- D-06: When switching tabs and returning, the Message Type selector resets to the first message type.
- D-07: `useProtoStore` is expanded to hold multiple open files as an array with an active index:
  ```ts
  openFiles: Array<{ filePath: string; schema: ProtoSchema }>;
  activeIndex: number;
  ```
  `setFile()` becomes `addOrActivateFile(filePath, schema)`.

**Rust Backend Extension (PUBL-04)**
- D-08: Existing `publish_message` command is extended with optional AMQP properties (not a new command): `content_type: Option<String>`, `delivery_mode: Option<u8>`, `ttl: Option<u32>`, `correlation_id: Option<String>`, `reply_to: Option<String>`, `headers: Option<Vec<(String, String)>>`.

### Claude's Discretion

None explicitly stated. Per-implementation ambiguities resolved in research.

### Deferred Ideas (OUT OF SCOPE)

- Response queue / consumer listening — explicitly out of scope for v1.
- Dark/light mode theme switcher — not in Phase 3 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROT-03 | Tool renders WellKnownTypes with purpose-built form controls | Existing `WellKnownTypeField.tsx` fallback branch only needs placeholder text update and badge text clarification — minimal delta |
| PROT-04 | User can have multiple `.proto` files open simultaneously | `useProtoStore` expansion pattern verified; shadcn Tabs component to add |
| PUBL-04 | User can set AMQP message properties before sending | `lapin::BasicProperties` builder API verified via amq-protocol-types docs.rs; sheet/store pattern established |
| HIST-01 | App logs all sent messages | `tauri-plugin-store` persistence pattern matches existing profiles storage; shadcn Table to add |
| HIST-02 | User can click any history entry to re-populate the form with original field values and resend | `react-hook-form` `reset()` confirmed available; message-type-not-loaded guard needed |
| HIST-03 | User can view the binary payload of any history entry as a hex string | Binary bytes stored as `number[]` in entry; hex format conversion mirrors existing `hexPreview` format |
| HIST-04 | User can filter the history log by message type name or by queue/exchange name | Client-side substring filter over history entries in Zustand/derived state |
</phase_requirements>

---

## Summary

Phase 3 completes the v1 feature set by adding four capability clusters on top of the Phase 1/2 foundation. The stack is fully established — no new Rust crates and no new npm packages beyond three shadcn component installs. All decisions are locked in CONTEXT.md and the approved UI-SPEC.

**Primary recommendation:** The planner should treat this phase as integration and wiring work. Every primitive is already present: `tauri-plugin-store` for history persistence, `lapin::BasicProperties` for AMQP properties, `react-hook-form` `reset()` for form replay, `shadcn Tabs` for multi-file support, and `shadcn Table/Sheet` for history and properties UI. No new dependencies need to be sourced or evaluated.

The highest-risk integration points are: (1) the `publish_message` command extension — TTL is a `ShortString` in AMQP even though the UI exposes it as a number; (2) the `Vec<(String, String)>` serialization for custom headers (see Code Examples); (3) the history entry payload capture point; and (4) the HIST-02 guard for replaying entries whose message type is no longer loaded.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| History persistence | Frontend (tauri-plugin-store) | — | D-01: no new Rust commands; store is accessed from JS |
| History UI (log, filter, replay) | Frontend (React components) | — | Client-side; Zustand state + shadcn Table |
| AMQP properties state | Frontend (Zustand useAmqpStore) | — | Session-only (D-04); no persistence needed |
| AMQP properties encoding | Rust backend (publish_message) | — | `lapin::BasicProperties` lives in Rust; frontend passes raw values |
| Multi-proto tab state | Frontend (useProtoStore) | — | Pure UI/schema state; no Rust involvement |
| WellKnownType field rendering | Frontend (WellKnownTypeField.tsx) | — | Minimal delta — placeholder text only |
| Hex view of history entry | Frontend (HexViewDialog) | — | Client-side byte→hex formatting; no IPC needed |

---

## Standard Stack

### Core (inherited — no changes)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `lapin` | 4.x (4.7.4 in prod) | AMQP client; `BasicProperties` builder for PUBL-04 | [VERIFIED: CLAUDE.md + Cargo.toml] |
| `tauri-plugin-store` | 2.x (2.4.3 in prod) | Frontend persistence for history entries (D-01) | [VERIFIED: Cargo.toml + package.json] |
| `react-hook-form` | 7.x (7.76.0 in prod) | `reset()` for HIST-02 form replay | [VERIFIED: package.json] |
| `zustand` | 5.x (5.0.13 in prod) | `useAmqpStore` (D-05), `useProtoStore` expansion (D-07) | [VERIFIED: package.json] |
| `sonner` | 2.x (2.0.7 in prod) | Toast notifications for resend success/failure | [VERIFIED: package.json] |
| `shadcn/ui` | current | UI primitives | [VERIFIED: package.json + components.json] |

### New shadcn Components to Install (Phase 3)

| Component | Install Command | Required For |
|-----------|----------------|--------------|
| `table` | `npx shadcn add table` | History log (HIST-01, HIST-04) |
| `sheet` | `npx shadcn add sheet` | AMQP Properties panel (PUBL-04) |
| `tabs` | `npx shadcn add tabs` | Multi-proto tabs (PROT-04) + RightPanel dual-tab |
| `switch` | `npx shadcn add switch` | Delivery-mode toggle (PUBL-04) |
| `textarea` | `npx shadcn add textarea` | Custom headers entry (PUBL-04) |
| `popover` | `npx shadcn add popover` | Add-header inline form (PUBL-04) |

All components are from the shadcn official registry — no safety gate required per UI-SPEC. [VERIFIED: 03-UI-SPEC.md Registry Safety section]

### Supporting Rust Types (for PUBL-04 extension)

| Type | Crate | Notes |
|------|-------|-------|
| `BasicProperties` | `lapin` (re-export of `amq-protocol`) | Builder-pattern; already imported in `publish.rs` |
| `ShortString` | `amq-protocol-types` | From trait for `&str` and `String` |
| `FieldTable` | `amq-protocol-types` | Map<ShortString, AMQPValue>; insert via `.insert(ShortString, AMQPValue)` |
| `AMQPValue::LongString` | `amq-protocol-types` | Variant for string header values |
| `LongString` | `amq-protocol-types` | From<B: Into<Vec<u8>>>; accepts &str, String |

[CITED: docs.rs/amq-protocol-types/latest — ShortString, FieldTable, AMQPValue, LongString docs pages verified]

---

## Architecture Patterns

### System Architecture Diagram

```
User sends form
       │
       ▼
PublishBar.handleSend()
  ├── hexToBytes(hexPreview) → number[]  ← CAPTURE THIS for payloadBytes
  ├── useAmqpStore.getState() → AmqpProperties
  ├── invoke('publish_message', { ...args, ...amqpProps })
  │       └── Rust: publish_message()
  │               ├── load_profile_with_password()
  │               ├── BasicProperties builder chain (content_type, delivery_mode, expiration, etc.)
  │               ├── lapin channel.basic_publish()
  │               └── Ok(()) | Err(AppError)
  ├── On success: appendHistoryEntry({ status: "sent", payloadBytes })
  └── On failure: appendHistoryEntry({ status: "failed", errorMessage })

History entry write (frontend only, no IPC)
  ├── load('history.json') → store
  ├── store.get('history') → HistoryEntry[]
  ├── prepend new entry, drop oldest if > 100
  ├── store.set('history', entries)
  └── store.save()

History panel reads
  ├── useHistoryStore (Zustand, mirror of persisted data)
  ├── Filter: substring match on messageTypeName + routingKey/exchange
  └── Row click → useProtoStore.setSelectedType() + form.reset(entry.fieldValues)
```

### Recommended Component Structure (new files only)

```
src/
├── stores/
│   ├── useAmqpStore.ts          # D-05: AMQP properties (new)
│   └── useHistoryStore.ts       # History state + persistence helpers (new)
├── components/
│   ├── layout/
│   │   └── RightPanel.tsx       # Tabs wrapper: Hex | History (new)
│   ├── history/
│   │   ├── MessageHistoryPanel.tsx   # Container (new)
│   │   ├── HistoryFilterBar.tsx      # Two filter inputs (new)
│   │   ├── HistoryTable.tsx          # shadcn Table (new)
│   │   └── HexViewDialog.tsx         # Dialog for HIST-03 (new)
│   └── publish/
│       └── AmqpPropertiesSheet.tsx   # Sheet + form (new)
```

Modified files:
- `src/stores/useProtoStore.ts` — expand for D-07
- `src/components/layout/AppLayout.tsx` — mount RightPanel
- `src/components/sidebar/FileSection.tsx` — replace with Tabs (PROT-04)
- `src/components/form/fields/WellKnownTypeField.tsx` — placeholder update (PROT-03)
- `src/components/publish/PublishBar.tsx` — wire useAmqpStore + history append
- `src/lib/ipc.ts` — update publishMessage signature
- `src-tauri/src/commands/publish.rs` — extend signature (D-08)

### Pattern 1: useAmqpStore (mirrors useConnectionStore)

```typescript
// Source: src/stores/useConnectionStore.ts (established pattern)
interface AmqpProperties {
  contentType: string;
  deliveryMode: 1 | 2;
  ttl: string;        // empty = not set
  correlationId: string;
  replyTo: string;
  headers: Array<{ key: string; value: string }>;
}

interface AmqpStore {
  properties: AmqpProperties;
  setProperties: (props: AmqpProperties) => void;
  reset: () => void;
}

const INITIAL_STATE: AmqpProperties = {
  contentType: "application/octet-stream",
  deliveryMode: 2,
  ttl: "",
  correlationId: "",
  replyTo: "",
  headers: [],
};

export const useAmqpStore = create<AmqpStore>((set) => ({
  properties: INITIAL_STATE,
  setProperties: (props) => set({ properties: props }),
  reset: () => set({ properties: INITIAL_STATE }),
}));
```

[VERIFIED: pattern from src/stores/useConnectionStore.ts]

### Pattern 2: useProtoStore expansion (D-07)

The existing `setFile()` is replaced by `addOrActivateFile()`. The `activeFilePath`, `schema`, and `selectedMessageType` fields become computed from `openFiles[activeIndex]`.

```typescript
// Expanded interface (new fields)
interface ProtoStore {
  openFiles: Array<{ filePath: string; schema: ProtoSchema }>;
  activeIndex: number;
  // Existing transient state (reset on tab switch)
  selectedMessageType: string | null;
  hexPreview: string;
  isEncoding: boolean;
  encodeError: string | null;

  addOrActivateFile: (filePath: string, schema: ProtoSchema) => void;
  closeFile: (index: number) => void;
  setActiveIndex: (index: number) => void;
  setSelectedType: (messageType: string) => void;
  // ...rest unchanged
}
```

Key behaviour: `addOrActivateFile` — if `filePath` already in `openFiles`, just set `activeIndex`; otherwise push and set `activeIndex` to new length - 1. Always reset `selectedMessageType`, `hexPreview`, `encodeError` on index change.

[VERIFIED: pattern from src/stores/useProtoStore.ts; behaviour from CONTEXT.md D-06/D-07]

### Pattern 3: History persistence (tauri-plugin-store)

```typescript
// Source: existing FileSection.tsx pattern (load → get → set → save)
const HISTORY_STORE_PATH = "history.json";  // separate from proto-sender.json
const HISTORY_KEY = "history";

async function appendHistoryEntry(entry: HistoryEntry): Promise<void> {
  const store = await load(HISTORY_STORE_PATH, { autoSave: false });
  const existing = (await store.get<HistoryEntry[]>(HISTORY_KEY)) ?? [];
  const updated = [entry, ...existing].slice(0, 100);  // FIFO cap at 100
  await store.set(HISTORY_KEY, updated);
  await store.save();
}
```

Note: The existing code uses `proto-sender.json` for include paths and profiles, **not** `profiles.json` as mentioned in earlier docs. History goes in its own `history.json` per D-01. [VERIFIED: FileSection.tsx line 9]

### Pattern 4: BasicProperties extension in Rust (D-08)

```rust
// Source: src-tauri/src/commands/publish.rs (existing pattern to extend)
// amq-protocol-types verified via docs.rs

#[tauri::command]
pub async fn publish_message(
    app: AppHandle,
    profile_name: String,
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
    // PUBL-04 optional properties
    content_type: Option<String>,
    delivery_mode: Option<u8>,
    ttl: Option<u32>,       // CRITICAL: lapin wants ShortString, not u32 — convert before use
    correlation_id: Option<String>,
    reply_to: Option<String>,
    headers: Option<Vec<AmqpHeader>>,  // or Vec<(String,String)> — see Pitfall 2
) -> Result<(), AppError> {
    // ...existing connection setup unchanged...

    let mut props = BasicProperties::default()
        .with_content_type(
            content_type
                .unwrap_or_else(|| "application/octet-stream".to_string())
                .into()
        );

    if let Some(dm) = delivery_mode {
        props = props.with_delivery_mode(dm);
    }
    if let Some(t) = ttl {
        // CRITICAL: AMQP TTL is ShortString (milliseconds as decimal string), not u32
        props = props.with_expiration(t.to_string().into());
    }
    if let Some(cid) = correlation_id {
        if !cid.is_empty() { props = props.with_correlation_id(cid.into()); }
    }
    if let Some(rt) = reply_to {
        if !rt.is_empty() { props = props.with_reply_to(rt.into()); }
    }
    if let Some(hdrs) = headers {
        let mut table = lapin::types::FieldTable::default();
        for h in hdrs {
            table.insert(
                h.key.into(),
                lapin::types::AMQPValue::LongString(h.value.into()),
            );
        }
        props = props.with_headers(table);
    }

    channel.basic_publish(
        exchange.as_str().into(),
        routing_key.as_str().into(),
        BasicPublishOptions::default(),
        &payload,
        props,
    )
    // ...rest unchanged...
}
```

[CITED: docs.rs/amq-protocol-types — ShortString::from, LongString::from, FieldTable::insert, AMQPValue variants]

### Pattern 5: Entry ID — use crypto.randomUUID()

```typescript
const entry: HistoryEntry = {
  id: crypto.randomUUID(),  // available in Tauri webview; no new dep needed
  timestamp: new Date().toISOString(),
  // ...
};
```

`crypto.randomUUID()` is available in all modern browsers and Tauri's WebView (Chrome 92+/WebKit). No `uuid` npm package required. [ASSUMED — based on Web Crypto API availability in Tauri webview]

### Pattern 6: HIST-02 form replay

```typescript
// In row-click handler
const handleReplay = async (entry: HistoryEntry) => {
  const { schema } = useProtoStore.getState();
  if (!schema) {
    toast.error("No proto file loaded. Open a .proto file to replay.");
    return;
  }
  const typeExists = schema.messages.some(
    m => m.full_name === entry.messageTypeName
  );
  if (!typeExists) {
    toast.error(
      `Message type "${entry.messageTypeName}" is not in the current proto file.`
    );
    return;
  }
  useProtoStore.getState().setSelectedType(entry.messageTypeName);
  // form.reset() called from FormPanel via useEffect watching selectedMessageType
  // then inject fieldValues
  formRef.reset(entry.fieldValues);
  // Switch right panel to Hex tab to show re-encoded preview
  setActiveTab("hex");
};
```

The form.reset() injection requires the consuming component to hold a ref to the RHF `reset` function. The store approach: `useProtoStore` gains a `pendingReplayValues: Record<string, unknown> | null` field consumed by `FormPanel` via `useEffect`. [ASSUMED — implementation detail; planner chooses mechanism]

### Anti-Patterns to Avoid

- **Re-encoding on replay:** Do not call `encode_message` IPC to re-derive `payloadBytes` during resend. Use the stored `payloadBytes` directly (D-03).
- **Storing hex string instead of bytes:** Store `payloadBytes: number[]` (D-03). The hex conversion (`bytes.map(b => b.toString(16).padStart(2,'0')).join(' ')`) happens at display time in `HexViewDialog`.
- **Mutating history entries in-place:** Always spread to create new arrays when updating history (immutability rule per global coding-style.md).
- **Using `tauri::spawn` instead of `tauri::async_runtime::spawn`:** Not applicable to new Rust code in Phase 3 since D-08 is a synchronous extension of an existing command, but enforce if new async tasks are added.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent key-value storage | Custom file I/O or SQLite | `tauri-plugin-store` | Already in deps; handles atomic writes, app data dir, cross-platform |
| UUID generation | Custom ID | `crypto.randomUUID()` | Browser-native, no dep |
| Data table with sorting | Custom HTML table | `shadcn/ui Table` | Accessible, styled, consistent |
| Slide-out panel | Custom CSS panel | `shadcn/ui Sheet` | Accessibility, animation, backdrop already handled |
| Tab switching | Custom tab component | `shadcn/ui Tabs` | Already used for RightPanel in UI-SPEC |
| AMQP property encoding | Custom byte manipulation | `lapin::BasicProperties` builder | Wire format complexity handled by lapin |

**Key insight:** All primitives for Phase 3 are already declared in `Cargo.toml` and `package.json`. The phase is wiring and UI composition, not dependency selection.

---

## Common Pitfalls

### Pitfall 1: TTL is a ShortString in AMQP, not a numeric type

**What goes wrong:** Passing `ttl` as `u32` or `i64` to `with_expiration` fails to compile — the method expects `ShortString`.

**Why it happens:** AMQP 0-9-1 spec defines `expiration` as a "shortstr" (decimal milliseconds as ASCII), not an integer. `lapin` faithfully models this.

**How to avoid:** Convert in Rust: `props.with_expiration(ttl_ms.to_string().into())`. The IPC boundary can still accept `Option<u32>` from the frontend for type safety; the conversion is a one-liner in Rust.

**Warning signs:** Compiler error: "expected `ShortString`, found `u32`".

[VERIFIED: amq-protocol-types docs.rs — with_expiration signature is `ShortString`]

### Pitfall 2: IPC serialization of `Vec<(String, String)>` (tuple list)

**What goes wrong:** Serde serializes Rust tuples `(String, String)` as JSON arrays `["k","v"]`, but the TypeScript/frontend Zustand store holds `Array<{key: string; value: string}>` objects. This mismatch causes a Tauri IPC deserialization panic.

**Why it happens:** Serde's default tuple serialization is `["a","b"]`, not `{"key":"a","value":"b"}`.

**How to avoid (recommended):** Define a named struct in Rust and use it instead of a raw tuple:
```rust
#[derive(serde::Deserialize)]
pub struct AmqpHeader {
    pub key: String,
    pub value: String,
}
// In command: headers: Option<Vec<AmqpHeader>>
```
Frontend sends: `[{ key: "X-Source", value: "proto-sender" }]` — matches the struct.

This is a one-line change over D-08's original `Vec<(String, String)>` and avoids the mapping step entirely.

**Warning signs:** Tauri IPC error: "invalid type: sequence, expected struct AmqpHeader" or similar deserialization error at runtime.

[ASSUMED — based on Serde's tuple serialization behavior; standard Rust/Tauri pattern]

### Pitfall 3: History payload capture point

**What goes wrong:** Re-encoding from `hexPreview` after a successful send gets a stale value if the user edited a field between sending and the async callback returning.

**Why it happens:** `hexPreview` in the store is updated by `encode_message` calls triggered by form field changes. In the gap between `publishMessage()` call and its `.then()`, the user could change a field.

**How to avoid:** Capture `hexToBytes(hexPreview)` synchronously at the top of `handleSend`, before the `await publishMessage(...)` call. Pass the captured `payload` value into the history entry, not re-derive it from `hexPreview` in the callback.

```typescript
const handleSend = async () => {
  const payload = hexToBytes(hexPreview);  // capture now, before any await
  const fieldValues = getValues();         // RHF snapshot — also capture now
  // ...await publishMessage(...)...
  appendHistoryEntry({ payloadBytes: payload, fieldValues, status: "sent" });
};
```

[VERIFIED: PublishBar.tsx lines 146-150 confirm current capture pattern uses hexPreview pre-await; this extends that pattern]

### Pitfall 4: Resend — message type no longer loaded

**What goes wrong:** User opens File A, sends a message, closes File A, opens File B, then clicks Resend on the File-A history entry. `setSelectedType("FileA.MessageType")` succeeds in the store, but the form can't render an unknown type → blank form or crash.

**Why it happens:** History persists across sessions; the referenced message type may not be in the current loaded schema.

**How to avoid:** Guard before replay:
1. Check if `entry.messageTypeName` exists in `useProtoStore.getState().openFiles[activeIndex].schema.messages`.
2. If not found: show error toast "Message type not in current proto file — open the original .proto file to replay."
3. If not connected (for Resend): `disabled` with tooltip "Connect to RabbitMQ to resend."

UI-SPEC shows both Resend-disabled states. [VERIFIED: 03-UI-SPEC.md Resend Button interaction states]

### Pitfall 5: Last-tab-close leaves undefined active schema

**What goes wrong:** When the last proto file tab is closed, `openFiles` becomes empty and `openFiles[activeIndex]` is `undefined`. Any code that reads `schema`, `selectedMessageType`, etc. will crash with "Cannot read properties of undefined".

**Why it happens:** Phase 1/2 always had a file loaded after first open; closing all tabs is a new state in Phase 3.

**How to avoid:** After `closeFile()`:
- If `openFiles.length === 0`, set `activeIndex = -1`, `selectedMessageType = null`, `hexPreview = ""`, `encodeError = null`.
- All consumers of `useProtoStore` that access `schema` must guard: `if (!schema) return <EmptyState />`.
- `FormPanel` already conditionally renders based on `schema` — verify the guard is present.

[ASSUMED — derived from Phase 3 UI-SPEC multi-tab close behavior; FormPanel empty state not observed in code review]

### Pitfall 6: `userManualTab` state location

**What goes wrong:** If `userManualTab` boolean (for auto-switch-to-History behavior) is stored in a Zustand store, it persists across renders and can cause the auto-switch to fire unexpectedly.

**Why it happens:** The UI-SPEC specifies "track `userManualTab` boolean in local state; auto-switch only when `userManualTab === false`."

**How to avoid:** Implement as `useState` in `RightPanel.tsx` — local component state, not global. Reset to `false` on fresh page load; set to `true` when user manually clicks Hex tab. Auto-switch to History on successful send sets it back to `false` only after the switch completes.

[CITED: 03-UI-SPEC.md — "track `userManualTab` boolean in local state"]

---

## Code Examples

### AMQP FieldTable with string headers

```rust
// Source: verified against docs.rs/amq-protocol-types (ShortString, LongString, FieldTable, AMQPValue)
use lapin::types::{AMQPValue, FieldTable, LongString, ShortString};

let mut table = FieldTable::default();
for h in headers {
    // key: ShortString::from(&str) or String::into()
    // value: AMQPValue::LongString(LongString::from(String)) — string header values use LongString variant
    table.insert(
        ShortString::from(h.key.as_str()),
        AMQPValue::LongString(LongString::from(h.value)),
    );
}
props = props.with_headers(table);
```

### BasicProperties full builder chain

```rust
// Source: amq-protocol-types docs.rs + existing publish.rs pattern
let props = BasicProperties::default()
    .with_content_type("application/octet-stream".into())  // ShortString::from(&str)
    .with_delivery_mode(2u8)                               // ShortShortUInt = u8; 2 = persistent
    .with_expiration("60000".into())                       // CRITICAL: string "60000", not 60000u32
    .with_correlation_id("req-abc-123".into())
    .with_reply_to("reply-queue".into())
    .with_headers(table);                                  // FieldTable
```

### History entry write

```typescript
// Source: tauri-plugin-store pattern from FileSection.tsx + CONTEXT.md D-01/D-02/D-03
import { load } from "@tauri-apps/plugin-store";

async function appendHistoryEntry(entry: HistoryEntry): Promise<void> {
  const store = await load("history.json", { autoSave: false });
  const existing = (await store.get<HistoryEntry[]>("history")) ?? [];
  const updated = [entry, ...existing].slice(0, 100);
  await store.set("history", updated);
  await store.save();
}
```

### History load on startup

```typescript
async function loadHistory(): Promise<HistoryEntry[]> {
  const store = await load("history.json", { autoSave: false });
  return (await store.get<HistoryEntry[]>("history")) ?? [];
}
```

### Hex conversion for HexViewDialog

```typescript
// Source: mirrors existing hexToBytes in PublishBar.tsx; reverse direction
function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, "0")).join(" ");
}
```

### publishMessage IPC — extended signature

```typescript
// ipc.ts — extend existing function
export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[],
  amqpProps?: {
    contentType?: string;
    deliveryMode?: number;
    ttl?: number;
    correlationId?: string;
    replyTo?: string;
    headers?: Array<{ key: string; value: string }>;
  }
): Promise<void> {
  return invoke<void>("publish_message", {
    profileName,
    exchange,
    routingKey,
    payload,
    contentType: amqpProps?.contentType ?? null,
    deliveryMode: amqpProps?.deliveryMode ?? null,
    ttl: amqpProps?.ttl ?? null,
    correlationId: amqpProps?.correlationId ?? null,
    replyTo: amqpProps?.replyTo ?? null,
    headers: amqpProps?.headers ?? null,
  });
}
```

---

## Project Constraints (from CLAUDE.md)

| Constraint | Enforcement in Phase 3 |
|------------|----------------------|
| Tauri 2.x — all plugins must be v2 branch | shadcn adds are UI-only; no new Tauri plugins needed |
| `tauri::async_runtime::spawn` not `tokio::spawn` | `publish_message` is an existing command; no new spawns unless adding background tasks |
| `prost` versions must match between `protox` and `prost-reflect` | No new proto crates added in Phase 3 |
| Binary protobuf wire format only (not JSON) | Payload captured as `number[]` from `hexToBytes(hexPreview)`; never re-serialized as JSON |
| Passwords never in store / IPC response / logs | No new commands touch passwords; AMQP URI remains dropped after use |
| 401 from Management API = auth error, not silent fallback | Unchanged from Phase 2 |
| zod pinned to `^3.24.2` | No new zod schemas in Phase 3 (history/AMQP store use TypeScript types, not zod schemas) |
| Node 20 LTS; Tailwind 4.x requires Node 18+ | Unchanged |
| No `#[tokio::main]` in `main.rs` | Unchanged |

**Coding style enforcement** (from global rules):
- Immutable updates in Zustand: always spread into new objects/arrays (`[entry, ...existing]` not `existing.unshift(entry)`)
- Functions under 50 lines; files under 800 lines — history components split per UI-SPEC
- `unknown` not `any` for error handling; `instanceof Error` guard pattern
- No `console.log` — use `tracing::debug!` on Rust side

---

## Open Questions

1. **HIST-02: Resend — should Resend re-populate only or re-populate + send immediately?**
   - What we know: UI-SPEC "Resend Button" says it "calls `handleResend(entry)` which re-populates form AND dispatches send immediately." Row-click (anywhere except action buttons) triggers "HIST-02 re-populate behavior" only.
   - What's clear: Row click = populate only. Resend button = populate + send. These are distinct.
   - Recommendation: Implement as specified. Planner should create two distinct handlers: `handleReplay(entry)` (row click) and `handleResend(entry)` (button click = handleReplay + send).

2. **HIST-02: Resend when message type not in active schema**
   - What we know: CONTEXT.md says "show an error toast"; UI-SPEC shows Resend button as `disabled` when no connection.
   - What's unclear: Should Resend be disabled (static) or trigger a toast (dynamic) when the type is missing from the current schema?
   - Recommendation: Disable Resend button with tooltip when no active connection (per UI-SPEC). For missing-type, show an error toast (per CONTEXT.md) since the button cannot know at render time which types will be present.

3. **`pendingReplayValues` mechanism for form.reset() injection**
   - What we know: `react-hook-form` `reset()` is called from a component holding the `useForm` instance (`FormPanel`). History replay is triggered from `MessageHistoryPanel` which is in a different component subtree.
   - What's unclear: How does `MessageHistoryPanel` reach `FormPanel`'s `reset()` function?
   - Recommendation: Add `pendingReplayValues: Record<string, unknown> | null` to `useProtoStore`. `FormPanel` watches this via `useEffect` and calls `form.reset(pendingReplayValues)` then clears it. [ASSUMED]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Tauri v1 plugin store | Tauri v2 `tauri-plugin-store` (already in use) | `load()` function API, not class constructor |
| AMQP expiration as integer | AMQP 0-9-1: expiration is always ShortString | Must convert u32 → String in Rust before passing to `with_expiration` |
| `shadcn/ui` Tailwind config | Tailwind 4.x uses CSS `@import`, no `tailwind.config.js` | shadcn components added via CLI work; CSS import approach already in use |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is available in Tauri 2.x's WebView without polyfill | Code Examples (Pattern 5) | Low: fallback is `Date.now() + Math.random()` or add `uuid` npm dep |
| A2 | Serde serializes `(String, String)` tuple as `["k","v"]` causing IPC mismatch with TS `{key,value}` object | Common Pitfalls (Pitfall 2) | High: if wrong, raw tuples work fine and named struct is unnecessary overhead |
| A3 | `FormPanel` gates on `schema !== null` — empty-state already handled | Common Pitfalls (Pitfall 5) | Medium: if not guarded, last-tab-close crashes FormPanel |
| A4 | `pendingReplayValues` store field is the cleanest cross-component `reset()` injection mechanism | Open Questions #3 | Medium: alternative (React context, callback prop, event emitter) also viable |
| A5 | Profile store file is `proto-sender.json` (observed in FileSection.tsx) not `profiles.json` (mentioned in earlier docs) | Architecture Patterns (Pattern 3) | Low: only affects store key isolation; `history.json` is separate regardless |

---

## Security Domain

> `security_enforcement` key absent from `.planning/config.json` — treated as enabled per role spec.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged from Phase 2 — no auth additions |
| V3 Session Management | no | No sessions; ephemeral AMQP connections (local dev tool) |
| V4 Access Control | no | Local dev tool; no multi-user model |
| V5 Input Validation | yes | Validate AMQP property bounds on frontend before IPC: header key length, TTL range, delivery mode enum |
| V6 Cryptography | no | No crypto added in Phase 3 |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversize header key/value crashes `ShortString` | DoS | Frontend validates `key.len() <= 255` and `value.len() <= 65535` before `invoke()`; Rust side will panic on truncation otherwise |
| Untrusted `history.json` `fieldValues` replayed into RHF | Tampering | Treat as untrusted on replay; `form.reset()` silently ignores unknown keys — safe by default; do not `eval()` or JSON-inject into DOM |
| Negative or non-numeric TTL input | Tampering | Frontend input constrains to positive integer (`type="number" min="0" max="4294967295"`); TypeScript `Option<u32>` in IPC rejects out-of-range values at deserialization |
| Cleartext password leak via toast / `errorMessage` in history entry | Information Disclosure | `AppError` strings must never include the AMQP URI or password (verified in Phase 2); resend error paths must reuse the same `AppError` enum — do not add raw `format!("{}", err)` strings that could expose connection details |

[CITED: Phase 2 security patterns from CLAUDE.md and existing `publish.rs` — passwords are cleared from memory after use, never logged, `load_profile_with_password` is `pub(crate)` only]

---

## Sources

### Primary (HIGH confidence)
- `src/stores/useConnectionStore.ts` — pattern for `useAmqpStore`
- `src/stores/useProtoStore.ts` — store to expand for D-07
- `src-tauri/src/commands/publish.rs` — command to extend for D-08
- `src/components/publish/PublishBar.tsx` — payload capture point, send flow
- `src/components/sidebar/FileSection.tsx` — store key `proto-sender.json`, tauri-plugin-store pattern
- `.planning/phases/03-full-feature-set/03-CONTEXT.md` — all locked decisions D-01 through D-08
- `.planning/phases/03-full-feature-set/03-UI-SPEC.md` — all UI/interaction decisions (approved 2026-05-18)
- `CLAUDE.md` — project constraints and tech stack

### Secondary (MEDIUM-HIGH confidence)
- `docs.rs/amq-protocol-types` — `ShortString`, `FieldTable::insert`, `AMQPValue`, `LongString` API verified via WebFetch
- `docs.rs/amq-protocol-types` — `with_expiration` confirmed to be `ShortString` (not numeric)
- `tauri-plugin-store` v2 docs (v2.tauri.app) — `load()` / `set()` / `save()` API confirmed via WebSearch

### Tertiary (LOW confidence — marked ASSUMED)
- `crypto.randomUUID()` Tauri webview availability — [ASSUMED] based on Chromium/WebKit support
- Serde tuple serialization mismatch — [ASSUMED] based on Serde documentation behavior
- `pendingReplayValues` store mechanism — [ASSUMED] design recommendation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in Cargo.toml / package.json; no new selections
- Architecture: HIGH — patterns locked in CONTEXT.md + UI-SPEC; code examples verified from existing files
- Lapin API specifics: MEDIUM-HIGH — confirmed via `amq-protocol-types` docs.rs pages; no live compile test
- Pitfalls: HIGH (Pitfall 1 lapin TTL, Pitfall 3 payload capture) / MEDIUM (Pitfalls 2, 4, 5, 6 — reasoned from code review and spec)
- Security domain: HIGH — Phase 3 introduces no new auth/crypto; threat patterns derived from existing Phase 2 security constraints

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable stack; lapin and tauri-plugin-store are not fast-moving)
