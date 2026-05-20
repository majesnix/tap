# Phase 13: Message Feed Foundation + Drain Mode - Research

**Researched:** 2026-05-20
**Domain:** Rust lapin AMQP drain loop, Zustand message feed store, shadcn Accordion row rendering
**Confidence:** HIGH

---

## Summary

Phase 13 replaces the single-message `ResponseTab` (one `basic_get` → `lastResult`) with a
scrollable accordion feed backed by a `messages: FeedMessage[]` store. Three areas require
research and verification:

1. **Rust drain loop** — how to access AMQP metadata (routing key, exchange, content_type,
   timestamp) from a `basic_get` result in lapin 4.7.4, and how to handle partial failures
   mid-loop.

2. **Store migration** — how `useResponseStore` should evolve: `lastResult` → `messages[]`,
   FIFO-500 cap, stable row identifiers.

3. **Frontend accordion feed** — shadcn `Accordion type="single" collapsible` is not yet
   installed in the project; `ResponseHexSection` must be refactored to accept props (it
   currently reads from the store directly, incompatible with per-row rendering).

**Primary recommendation:** Install `accordion` via `npx shadcn@latest add accordion`, refactor
`ResponseHexSection` to accept `hexString` + `decoded` props, add `id: string` field to
`FeedMessage` (generated at append time via `crypto.randomUUID()`), and implement
`drain_messages` as a single Rust command returning `Vec<DrainResult>` with a top-level
`partial_error: Option<String>` for mid-loop failures.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Drain count: number input pre-filled with 10, range 1–500. Lives in toolbar.
- **D-02:** Drain fewer than N when queue is smaller — stop silently.
- **D-03:** Empty queue (0 messages returned): `toast.info("Queue is empty")`. Feed unchanged.
- **D-04:** "Read" button removed entirely. "Drain" button replaces it.
- **D-05:** Each drain appends new messages to the top of the feed; old messages persist until FIFO-500 drops them.
- **D-06:** Clear button (trash icon, feed header) wipes the in-memory list only.
- **D-07:** Collapsed row shows all 4 AMQP metadata fields on one line: `routing_key • exchange • content-type • timestamp`.
- **D-08:** Expanded row reuses `ResponseDecodedView` + `ResponseHexSection` directly. (See pitfall below — HexSection needs prop refactor.)
- **D-09:** `Accordion type="single" collapsible` — one row open at a time.
- **D-10:** Initial state placeholder: `"Select a queue and click Drain"`.
- **D-11:** Decode error in expanded view: error message inline + raw hex. No error badge on collapsed row.
- **D-12:** Queue-empty result: Sonner toast (see D-03). Feed unchanged.
- **D-13:** New `drain_messages` Rust command loops `basic_get` up to N times, returns `Vec<DrainResult>`. Contains: `routing_key`, `exchange`, `content_type`, `timestamp`, `decoded`, `hex_string`, `error`.
- **D-14:** Ack-before-decode per message, consistent with existing D-10.
- **D-15:** Existing `consume_message` command is kept (not removed). Frontend migrates to `drain_messages`.
- **D-16:** `useResponseStore`: `lastResult` → `messages: FeedMessage[]`. `lastReadAt` retained. `isLoading` retained.
- **D-17:** FIFO-500 cap in `appendMessages` Zustand action: prepend + slice. `FEED_MAX_SIZE = 500`.

### Claude's Discretion

- Exact drain input widget style (spinbox vs plain `<input type="number">`)
- Drain button label ("Drain" vs "Fetch" vs "Get N")
- Row separator style, padding, hover highlight
- Timestamp format (relative "2s ago" vs absolute "14:32:05")
- Feed header layout (message count label, Clear button placement)
- `DrainResult` exact field naming in Rust (snake_case per serde convention)
- Whether `DrainResult` reuses/extends the existing `ConsumeResult` struct or is a new type

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONS-01 | User can see AMQP metadata (routing key, exchange, content-type, timestamp) on each consumed message row | lapin `Delivery` struct exposes `routing_key`, `exchange` (both `ShortString`); AMQP properties expose `content_type()` → `&Option<ShortString>` and `timestamp()` → `&Option<u64>` |
| CONS-02 | User can view consumed messages in a FIFO-500 scrollable list — newest on top, each row expandable to decoded payload and raw hex | shadcn `Accordion type="single" collapsible`; FIFO via `appendMessages` prepend+slice; `ScrollArea` already present |
| CONS-03 | User can drain up to N messages from a queue in one shot (single Rust command) | Single `drain_messages` Rust command looping `basic_get`; returns `Vec<DrainResult>` |
| CONS-04 | User can see the current queue depth before and during consumption | `queueDepth` already in store; `setLastReadAt` triggers refresh in `ResponseQueuePicker`; `message_count` field on `BasicGetMessage` is a bonus alternate source |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drain N messages from queue | Rust backend | — | AMQP I/O must stay in Rust; single command avoids N round-trips over IPC |
| AMQP metadata extraction | Rust backend | — | Metadata lives on the `Delivery` / `BasicProperties` structs; must be extracted before connection closes |
| Protobuf decode | Rust backend | — | `prost-reflect` pool already available; decode stays with encoding stack |
| Feed state management | Frontend (Zustand) | — | In-memory FIFO with UI-side render; no persistence needed |
| Row expand/collapse | Frontend (React) | — | Pure UI state, not shared across components |
| Queue depth refresh | Frontend (useEffect) | — | Already implemented; `setLastReadAt` signals `ResponseQueuePicker` |
| Empty-queue toast | Frontend (Sonner) | — | User feedback only; Rust returns empty Vec, frontend decides to toast |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `lapin` | 4.7.4 | AMQP client — `basic_get` loop, ack, connection close | [VERIFIED: Cargo.lock] |
| `zustand` | 5.0.13 | Message feed store — `appendMessages`, `clearMessages` | [VERIFIED: package.json] |
| `shadcn/ui Accordion` | (Radix-backed) | Row expand/collapse, `type="single" collapsible` | [VERIFIED: shadcn docs] — **NOT YET INSTALLED** |
| `shadcn/ui ScrollArea` | installed | Feed scroll container | [VERIFIED: src/components/ui/scroll-area.tsx] |
| `sonner` | 2.0.7 | Empty-queue toast (`toast.info`) | [VERIFIED: package.json] |

### Installation Required

```bash
npx shadcn@latest add accordion
```

This is the **only new install** required for Phase 13. No new Cargo dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Drain"
        │
        ▼
ResponseQueuePicker (toolbar)
  drain count input (D-01)
  Drain button click
        │
        ▼ invoke("drain_messages", {profileName, queueName, messageTypeName, count})
        │
        ▼
Rust: drain_messages command
  ┌─ open 1 AMQP connection
  │   loop i in 0..count:
  │     basic_get(queue)
  │       → None:  break (queue empty)
  │       → Err:   record partial_error, break
  │       → Some(msg):
  │           extract routing_key, exchange, content_type, timestamp
  │           ack (D-14: ack before decode)
  │           decode (prost-reflect DynamicMessage)
  │           push DrainResult to Vec
  │   close connection
  └─ return DrainOutcome { messages: Vec<DrainResult>, partial_error: Option<String> }
        │
        ▼
Frontend receives DrainOutcome
  if messages.empty && !partial_error → toast.info("Queue is empty")
  appendMessages(messages) → Zustand (prepend + slice FIFO-500)
  setLastReadAt(Date.now()) → triggers queue depth refresh (CONS-04)
        │
        ▼
MessageFeedTab renders
  ScrollArea (flex-1)
    Accordion type="single" collapsible
      AccordionItem value={msg.id} (for each message, newest first)
        AccordionTrigger: routing_key • exchange • content-type • timestamp
        AccordionContent:
          ResponseDecodedView(decoded, error)
          ResponseHexSection(hexString, decoded)   ← props-based after refactor
```

### Recommended File Structure Changes

```
src/
├── components/response/
│   ├── MessageFeedTab.tsx         # NEW — replaces ResponseTab.tsx
│   ├── MessageFeedRow.tsx         # NEW — single accordion row (collapsed + expanded)
│   ├── ResponseQueuePicker.tsx    # MODIFIED — rename Read→Drain, add count input
│   ├── ResponseDecodedView.tsx    # UNCHANGED — already takes props
│   ├── ResponseHexSection.tsx     # MODIFIED — add hexString+decoded props (see Pitfall 1)
│   └── ResponseTab.tsx            # REMOVED or repurposed as re-export
├── stores/
│   └── useResponseStore.ts        # MODIFIED — lastResult→messages, appendMessages, clearMessages
└── lib/
    └── ipc.ts                     # MODIFIED — add drainMessages(), keep consumeMessage()

src-tauri/src/commands/
├── consume.rs                     # MODIFIED — add drain_messages, DrainResult, DrainOutcome
└── (lib.rs)                       # MODIFIED — register drain_messages in invoke_handler!
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion expand/collapse | Custom state + CSS height animation | shadcn `Accordion` (Radix) | WAI-ARIA, keyboard nav, ResizeObserver-based transitions |
| FIFO cap | Complex splice/shift logic | `prepend + slice(0, FEED_MAX_SIZE)` in Zustand action | Two-line immutable operation; named constant documents intent |
| Unique row IDs | Hash of timestamp+content | `crypto.randomUUID()` at append time | Collisions in hash-based IDs; UUID is correct primitive |
| Toast notifications | Custom alert UI | `sonner` (already wired) | Already in App.tsx; zero new setup |

---

## Critical Pitfalls

### Pitfall 1: ResponseHexSection reads from store — BLOCKS D-08 implementation

**What goes wrong:** `ResponseHexSection` currently reads `useResponseStore((s) => s.lastResult)`
directly. After the store migration (D-16), `lastResult` no longer exists. The component cannot
be "reused directly" inside an accordion row without receiving the specific message's data.

**Root cause:** The component was designed for a single-message world where the store held one result.

**How to fix:** Add explicit props to `ResponseHexSection`:

```tsx
interface ResponseHexSectionProps {
  hexString: string;
  decoded: Record<string, unknown> | null;
}

export function ResponseHexSection({ hexString, decoded }: ResponseHexSectionProps) {
  // ... same logic, use props instead of store read
}
```

The store-read path (`useResponseStore((s) => s.lastResult)`) is removed entirely.

**Test impact:** `ResponseHexSection.test.tsx` currently seeds `useResponseStore.setState({ lastResult: ... })`.
All three test cases must be migrated to pass props directly. [VERIFIED: src/components/response/ResponseHexSection.test.tsx]

**Warning signs:** TypeScript will error on `lastResult` read if store migration happens without this refactor.

---

### Pitfall 2: FeedMessage needs stable unique ID — Accordion value collision

**What goes wrong:** shadcn `Accordion type="single"` uses the `AccordionItem value` prop to
track which row is open. React's `key` also needs stability. Using `timestamp` as the ID is
insufficient — AMQP `timestamp` is: (a) set by the publisher in seconds (may not be set at all),
(b) not unique if multiple messages arrive in the same second.

**Root cause:** D-16 defines `FeedMessage` fields but does not assign a unique ID field.

**How to fix:** Add `id: string` to `FeedMessage`, generated via `crypto.randomUUID()` inside
`appendMessages` at insert time:

```typescript
export interface FeedMessage {
  id: string;                        // crypto.randomUUID() at append time
  routingKey: string;
  exchange: string;
  contentType: string | null;
  timestamp: number | null;          // seconds since epoch, from AMQP properties (may be null)
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

Use `msg.id` as both `key` and `AccordionItem value`.

**Warning signs:** Accordion opens the wrong row when two messages share a timestamp.

---

### Pitfall 3: AMQP timestamp is optional — display policy needed for null

**What goes wrong:** `properties.timestamp()` returns `&Option<u64>`. Publishers may not set it
(most dev-time producers do not). If the frontend expects a timestamp string and receives `null`,
a render crash or "undefined" display results.

**Root cause:** AMQP spec treats timestamp as optional; D-16 doesn't specify null handling.

**How to fix:**
- Rust: serialize `timestamp: Option<u64>` — never fabricate a timestamp.
- Frontend: when `timestamp === null`, display `—` (em dash) in the collapsed row metadata.
- Do NOT fall back to `Date.now()` as a substitute — that would show a misleading time.

[VERIFIED: AMQPProperties API docs — `timestamp()` returns `&Option<u64>`]

---

### Pitfall 4: drain_messages mid-loop error — partial result policy

**What goes wrong:** D-13 specifies the command stops when `basic_get` returns `None` (empty).
It does not specify what happens if `basic_get` returns `Err` on iteration 7 of 10 — e.g., a
network blip mid-drain. Failing the whole command discards the 6 already-acked messages.

**Root cause:** D-13 defines the happy path but leaves the error case unspecified.

**Recommendation:** Return partial results via a wrapper type:

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainOutcome {
    pub messages: Vec<DrainResult>,
    pub partial_error: Option<String>,
}
```

If `basic_get` errors mid-loop: stop looping, close connection, return the partial `messages`
collected so far plus the error in `partial_error`. Frontend appends whatever arrived and shows
a toast for the error.

This ensures already-acked messages are surfaced to the user, not silently lost.

[ASSUMED — CONTEXT.md does not specify partial failure behavior; this fills the gap]

---

### Pitfall 5: BasicGetMessage.message_count is "remaining after this message"

**What goes wrong:** `BasicGetMessage` has a `message_count: MessageCount` field alongside
`delivery`. This is the count of messages remaining **after** the one just fetched, not the
total queue depth. If the planner considers using this to skip `fetchQueueDepth`, the off-by-one
difference could confuse users.

**Recommendation:** Keep `setLastReadAt(Date.now())` to trigger the existing `fetchQueueDepth`
Management API call — it returns the authoritative post-drain count. Document `message_count`
as available but not used for CONS-04 (avoids off-by-one confusion).

[VERIFIED: BasicGetMessage docs — `message_count` field confirmed]

---

### Pitfall 6: consume_message retain vs remove from invoke_handler

**What goes wrong:** D-15 says `consume_message` is "kept," but if it stays registered in
`lib.rs` and `ipc.ts`, future developers may inadvertently call it. If it's removed from
`invoke_handler!` but kept in Rust source, it silently becomes dead Rust code.

**Recommendation:** Keep `consume_message` registered in `lib.rs` and exported from `ipc.ts`
as intentional retained API (for tests and future extension). Add a doc comment:

```rust
/// Retained for compatibility. The UI uses drain_messages; this command is
/// preserved for testing and potential scripting use.
```

---

### Pitfall 7: AMQP ShortString → Rust String conversion

**What goes wrong:** `msg.routing_key` and `msg.exchange` on `Delivery` are `ShortString` types.
The existing code accesses `msg.delivery_tag` (a `u64`) without conversion. `ShortString` does
not automatically coerce to `String`.

**How to fix:** Use `.to_string()` or `.as_str()` when building `DrainResult`:

```rust
routing_key: msg.routing_key.to_string(),
exchange: msg.exchange.to_string(),
content_type: msg.properties.content_type().as_ref().map(|s| s.to_string()),
timestamp: *msg.properties.timestamp(),
```

[VERIFIED: lapin Delivery struct — ShortString type confirmed]

---

### Pitfall 8: Test file migration footprint (4 files)

The following test files assert on `lastResult` or the "Read" button label, and must be updated
during the store migration:

| File | Change Required |
|------|----------------|
| `ResponseTab.test.tsx` | Replace with `MessageFeedTab.test.tsx`; seed `messages[]` not `lastResult`; **behavioral shift**: current Test 2 asserts DOM text "Queue empty" — new behavior is Sonner toast; migrate to toast mock assertion |
| `ResponseHexSection.test.tsx` | Migrate from `setState({lastResult})` to prop-based rendering |
| `ResponseQueuePicker.test.tsx` | Update "Read" button assertions to "Drain"; add drain count input test |
| `ResponseDecodedView.test.tsx` | No change required — already prop-based |

[VERIFIED: all four test files exist in src/components/response/]

---

## Code Examples

### lapin: Extracting AMQP metadata from basic_get result

```rust
// Source: docs.rs/lapin/latest/lapin/message/struct.BasicGetMessage.html
// BasicGetMessage derefs to Delivery — msg.routing_key is valid via Deref
let msg: lapin::message::BasicGetMessage = /* basic_get result */;

let routing_key = msg.routing_key.to_string();
let exchange = msg.exchange.to_string();
let content_type = msg
    .properties
    .content_type()
    .as_ref()
    .map(|s| s.to_string());
let timestamp: Option<u64> = *msg.properties.timestamp();
let payload: Vec<u8> = msg.data.clone();
let delivery_tag = msg.delivery_tag;
```

### DrainResult and DrainOutcome Rust structs

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainResult {
    pub routing_key: String,
    pub exchange: String,
    pub content_type: Option<String>,
    pub timestamp: Option<u64>,          // seconds since epoch; None if publisher didn't set it
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainOutcome {
    pub messages: Vec<DrainResult>,
    pub partial_error: Option<String>,   // set if basic_get errored mid-loop
}
```

### drain_messages command skeleton

```rust
// Source: Extends consume.rs pattern (ack-before-decode per message)
#[tauri::command]
pub async fn drain_messages(
    app: tauri::AppHandle,
    profile_name: String,
    queue_name: String,
    message_type_name: String,
    count: u32,   // valid range 1–500; validated frontend-side AND backend-side
    // CLAUDE.md: validate at system boundaries — Rust must reject count == 0 or count > 500
    // with AppError::InvalidInput before opening the connection
    pool_state: tauri::State<'_, std::sync::Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<DrainOutcome, crate::error::AppError> {
    // 1. Clone pool before any .await (MutexGuard is not Send)
    // 2. Load credentials — load_profile_with_password (same as consume_message)
    // 3. Open one connection with tokio::time::timeout(Duration::from_secs(10), ...)
    //    SECURITY: URI scope + password drop before inspect (mirrors consume.rs)
    // 4. Loop 0..count:
    //      basic_get → None: break (queue empty)
    //      basic_get → Err:  set partial_error, break
    //      Some(msg): extract routing_key/exchange/content_type/timestamp → ack → decode → push DrainResult
    //      DECODE: must mirror consume.rs SerializeOptions:
    //        .use_proto_field_name(true)       — preserve .proto snake_case names
    //        .stringify_64_bit_integers(true)  — JS precision safety for int64/uint64
    // 5. Close connection (even on partial error)
    // 6. Return DrainOutcome { messages, partial_error }
}
```

### FeedMessage TypeScript interface

```typescript
// Source: CONTEXT.md D-16 + Pitfall 2 (unique ID addition)
export interface FeedMessage {
  id: string;                              // crypto.randomUUID() at append time
  routingKey: string;
  exchange: string;
  contentType: string | null;
  timestamp: number | null;               // seconds since epoch; null = not set by publisher
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

### Zustand appendMessages action (FIFO-500)

```typescript
// Source: CONTEXT.md D-17
const FEED_MAX_SIZE = 500;

appendMessages: (incoming: FeedMessage[]) =>
  set((state) => {
    const combined = [...incoming, ...state.messages];
    return { messages: combined.slice(0, FEED_MAX_SIZE) };
  }),
```

### ResponseHexSection props refactor

```tsx
// Source: Pitfall 1 — component must accept props, not read from store
interface ResponseHexSectionProps {
  hexString: string;
  decoded: Record<string, unknown> | null;
}

export function ResponseHexSection({ hexString, decoded }: ResponseHexSectionProps) {
  // Same copy logic as before, using props instead of store read
  if (!hexString) return null;
  // ...
}
```

### shadcn Accordion usage for message feed

```tsx
// Source: ui.shadcn.com/docs/components/accordion (verified 2026-05-20)
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

## Integration Points

| Touch Point | Change | Notes |
|-------------|--------|-------|
| `src-tauri/src/commands/consume.rs` | Add `DrainResult`, `DrainOutcome`, `drain_messages` | Keep `ConsumeResult` + `consume_message` |
| `src-tauri/src/lib.rs` | Register `commands::consume::drain_messages` in `invoke_handler!` | Alongside existing `consume_message` |
| `src/lib/ipc.ts` | Add `drainMessages()` function | Keep `consumeMessage()` (D-15) |
| `src/lib/types.ts` | Add `DrainResult`, `DrainOutcome`, `FeedMessage` interfaces | Keep `ConsumeResult` |
| `src/stores/useResponseStore.ts` | Replace `lastResult` with `messages: FeedMessage[]`; add `appendMessages`, `clearMessages` | Keep `lastReadAt`, `isLoading`, `queueDepth` |
| `src/components/response/ResponseHexSection.tsx` | Add props (`hexString`, `decoded`); remove store read | Breaking change — all callers must pass props |
| `src/components/response/ResponseQueuePicker.tsx` | Rename Read→Drain; add drain count `<input type="number">` | Prop renamed `onDrain: (count: number) => void` |
| `src/components/response/ResponseTab.tsx` | Replace with `MessageFeedTab.tsx` (or refactor in-place) | New component renders accordion feed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DrainOutcome` with `partial_error` field is the correct partial-failure shape | Pitfall 4, Code Examples | MEDIUM — **conflicts with D-13 which specifies `Vec<DrainResult>` return type**. Needs user confirmation before planner commits to DrainOutcome shape. Alternative: fail fast (return `Err`) on any mid-loop error |
| A2 | Radix Accordion works in jsdom without portal mocking (unlike Select/Popover) | Standard Stack | Low — ResizeObserver already polyfilled; if issues arise, add `vi.mock` for Accordion content as escape hatch |

---

## Open Questions (RESOLVED)

1. **Timestamp display format (Claude's Discretion)**
   - What we know: `timestamp` is `Option<u64>` seconds since epoch; `null` when not set.
   - What's unclear: Show absolute "14:32:05" vs relative "2s ago" for non-null values.
   - RESOLVED: Use absolute `HH:MM:SS` format via `new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })`. Relative formats require a running timer; absolute is simpler and sufficient for a dev tool. UI-SPEC.md §Accordion Feed confirms this choice.

2. **Drain button label (Claude's Discretion)**
   - RESOLVED: Label is **"Drain"** — matches the `drain_messages` command name and CONTEXT.md D-04 terminology. Confirmed in UI-SPEC.md §Copywriting Contract.

3. **Count input widget style (Claude's Discretion)**
   - RESOLVED: Plain `<input type="number" min={1} max={500} defaultValue={10}>` with class `w-12 h-9 text-sm text-center rounded-md border border-input bg-background px-1`. No spinbox library needed. Confirmed in UI-SPEC.md §Toolbar Layout.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config changes only. The AMQP broker and Tauri runtime are pre-existing dependencies already verified by earlier phases.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single `lastResult` in store | `messages: FeedMessage[]` FIFO-500 | Enables multi-message display and Phase 14 (live subscribe) extension |
| `consumeMessage()` single-get | `drainMessages()` batch loop | Eliminates N IPC round-trips; single connection lifecycle |
| `ResponseHexSection` reads store | `ResponseHexSection` receives props | Required for per-row rendering in accordion; enables reuse |

---

## Sources

### Primary (HIGH confidence)
- lapin 4.7.4 `Delivery` struct — `routing_key: ShortString`, `exchange: ShortString`, `properties: BasicProperties` [VERIFIED: docs.rs/lapin/latest/lapin/message/struct.Delivery.html]
- lapin `BasicGetMessage` — `delivery: Delivery`, `message_count: MessageCount`, Deref to Delivery [VERIFIED: docs.rs/lapin/latest/lapin/message/struct.BasicGetMessage.html]
- lapin `AMQPProperties` — `content_type() → &Option<ShortString>`, `timestamp() → &Option<u64>` [VERIFIED: docs.rs/lapin/latest/lapin/protocol/basic/struct.AMQPProperties.html]
- shadcn Accordion — `type="single" collapsible`, `AccordionItem value`, `AccordionTrigger`, `AccordionContent` [VERIFIED: ui.shadcn.com/docs/components/accordion]
- Existing codebase — `consume.rs`, `useResponseStore.ts`, `ResponseHexSection.tsx`, `ResponseTab.tsx`, `lib.rs`, `ipc.ts`, all four test files [VERIFIED: direct file reads]

### Secondary (MEDIUM confidence)
- `crypto.randomUUID()` browser API for stable row IDs [ASSUMED — standard Web Crypto API, available in Tauri WKWebView/WebView2]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all locked libs are in existing lock files; only Accordion needs install
- Architecture (Rust drain loop): HIGH — lapin API verified; pattern extends existing consume.rs directly
- Architecture (store migration): HIGH — store shape derived from CONTEXT.md D-16/D-17 + verified codebase
- Pitfalls: HIGH — Pitfalls 1–3 and 7–8 are verified against actual code; Pitfall 4 is ASSUMED

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable stack — lapin 4.x, shadcn, Zustand 5)
