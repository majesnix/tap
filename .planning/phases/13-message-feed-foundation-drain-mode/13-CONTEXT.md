# Phase 13: Message Feed Foundation + Drain Mode - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current single-message ResponseTab (one `basic_get` → `lastResult`) with a scrollable message feed that supports:
1. AMQP metadata visible on each collapsed row (routing key, exchange, content-type, timestamp) — CONS-01
2. Scrollable FIFO-500 list, newest on top, each row expandable via accordion — CONS-02
3. Drain mode: a new `drain_messages` Rust command fetches up to N messages in one shot and appends them to the feed — CONS-03
4. Queue depth indicator (already partly implemented) — refreshes after each drain — CONS-04

The existing single "Read" button is **replaced entirely** by the Drain UI. This phase creates the feed foundation that Phase 14 (Live Subscribe) and Phase 15 (Filter + Export) will extend.

Requirements covered: CONS-01, CONS-02, CONS-03, CONS-04.

</domain>

<decisions>
## Implementation Decisions

### Drain Control
- **D-01:** Drain count is controlled by a **number input pre-filled with 10** (default). Valid range: 1–500 (the FIFO cap). Lives in the toolbar alongside the queue picker.
- **D-02:** When the queue has fewer messages than N, drain all available and stop silently. No warning — the queue depth badge already signals the message count before the user clicks.
- **D-03:** If the queue was empty (0 messages returned), show a **Sonner toast** (`toast.info("Queue is empty")`). The feed is unchanged.

### Single-Read Replacement
- **D-04:** The existing "Read" button is **removed**. The new "Drain" button replaces it entirely. Drain with N=1 is the equivalent of the old single-read. No coexistence mode.
- **D-05:** Each drain **appends** new messages to the top of the feed. Old messages persist until the FIFO-500 cap drops them. There is no implicit clear-on-drain.
- **D-06:** A **Clear button** (trash icon, small, in the feed header area) lets the user wipe all messages from the feed and start fresh. Clears the in-memory list only — no server-side effect.

### Row Layout
- **D-07:** Collapsed row shows **all 4 AMQP metadata fields on one line**: `routing_key • exchange • content-type • timestamp`. Compact, scannable, similar to a log line.
- **D-08:** Expanded row reuses **`ResponseDecodedView` + `ResponseHexSection`** directly. No new expanded-detail component needed — the existing Phase 4 components are composed inside the accordion expanded panel.
- **D-09:** Accordion expand/collapse — **one row open at a time**. Clicking an already-open row closes it; clicking a different row closes the current one and opens the new one. Use shadcn `Accordion` with `type="single"` and `collapsible`.

### Empty / Error States
- **D-10:** Initial state (no messages yet): text placeholder — `"Select a queue and click Drain"`. Carries forward the existing pattern.
- **D-11:** Decode error on a message: collapsed row shows AMQP metadata normally (no badge). Expanded view shows the error message inline (`"Decode failed: …"`) followed by the raw hex. Consistent with existing D-10 ack-before-decode pattern in `consume.rs`.
- **D-12:** Queue-empty result (0 messages from drain): Sonner toast — see D-03. Feed unchanged.

### Rust Command
- **D-13:** A new `drain_messages` command loops `basic_get` up to N times within a single AMQP connection+channel, collecting results. Returns `Vec<DrainResult>` where each `DrainResult` contains: `routing_key`, `exchange`, `content_type`, `timestamp`, `decoded`, `hex_string`, `error`. The command stops early when `basic_get` returns `None` (queue empty).
- **D-14:** Ack-before-decode applies per message inside the loop — consistent with the existing `consume_message` D-10 decision. Each message is acked before its decode is attempted.
- **D-15:** The existing `consume_message` command is **kept** (it may still be used in tests or referenced elsewhere), but the ResponseTab no longer calls it. The frontend migrates to `drain_messages`.

### Store Evolution
- **D-16:** `useResponseStore` evolves: `lastResult` field is replaced by `messages: FeedMessage[]`. `FeedMessage` adds AMQP metadata fields (`routingKey`, `exchange`, `contentType`, `timestamp`) to the existing `decoded`, `hexString`, `error` fields. `lastReadAt` is retained (queue depth refresh hook depends on it). `isLoading` is retained.
- **D-17:** FIFO-500 cap is enforced in the Zustand `appendMessages` action: prepend new items to the array, then slice to 500 if over cap. Cap is a named constant `FEED_MAX_SIZE = 500`.

### Return Type (resolved during planning)
- **D-18:** `drain_messages` returns **`DrainOutcome { messages: Vec<DrainResult>, partial_error: Option<String> }`** instead of the bare `Vec<DrainResult>` specified in D-13. The wrapper handles mid-loop AMQP errors without discarding already-acked messages: if `basic_get` errors on iteration 7 of 10, the 6 already-acked messages are returned with `partial_error` set. D-13 is superseded by this decision.

### Claude's Discretion
- Exact drain input widget style (spinbox vs plain `<input type="number">`)
- Drain button label ("Drain" vs "Fetch" vs "Get N")
- Row separator style, padding, hover highlight
- Timestamp format (relative "2s ago" vs absolute "14:32:05")
- Feed header layout (message count label, Clear button placement)
- `DrainResult` exact field naming in Rust (snake_case per serde convention)
- Whether `DrainResult` reuses/extends the existing `ConsumeResult` struct or is a new type

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Message Feed Foundation — CONS-01 through CONS-04 (authoritative acceptance criteria)
- `.planning/REQUIREMENTS.md` §Out of Scope — confirms: broker-side filtering, DLQ inspector, message replay from feed are all out of scope
- `.planning/ROADMAP.md` §Phase 13 — success criteria and phase goal

### Existing Response Architecture (read before implementing)
- `src/components/response/ResponseTab.tsx` — component being replaced; understand its structure before deleting/replacing
- `src/components/response/ResponseQueuePicker.tsx` — toolbar component being extended (add drain count input + rename Read→Drain); also contains the existing queue depth refresh logic via `lastReadAt` dep
- `src/components/response/ResponseDecodedView.tsx` — reused inside expanded accordion row (D-08)
- `src/components/response/ResponseHexSection.tsx` — reused inside expanded accordion row (D-08)
- `src/stores/useResponseStore.ts` — store to evolve: `lastResult` → `messages: FeedMessage[]` (D-16, D-17)

### Rust Backend (read before implementing)
- `src-tauri/src/commands/consume.rs` — existing `consume_message` and `ConsumeResult`; new `drain_messages` follows the same ack-before-decode pattern (D-14); `bytes_to_hex` utility can be reused
- `src/lib/ipc.ts` — IPC layer; add `drainMessages` function alongside existing `consumeMessage`

### Stack Constraints
- `tauri::async_runtime::spawn` (not `tokio::spawn`) — STATE.md pitfall, confirmed by Tauri issue #10289
- FIFO-500 cap from day one — STATE.md pitfall; enforce in `appendMessages` Zustand action (D-17)
- Single `drain_messages` Rust command (not a frontend loop calling `consume_message` N times) — STATE.md pitfall
- `Channel<T>` from `@tauri-apps/api 2.11.0` is available if streaming progress is needed, but Phase 13 drain is a single-shot command returning `Vec<DrainResult>` — no streaming needed in this phase
- shadcn `Accordion` with `type="single"` and `collapsible` — for row expand/collapse (D-09)
- Sonner toast (`import { toast } from "sonner"`) — already wired in App.tsx; use for D-03 empty-queue feedback

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/response/ResponseDecodedView.tsx` — collapsible decoded key-value tree; compose inside expanded accordion panel (D-08)
- `src/components/response/ResponseHexSection.tsx` — hex display with copy buttons; compose inside expanded accordion panel (D-08)
- `src-tauri/src/commands/consume.rs::bytes_to_hex` — pub utility; reuse in `drain_messages` loop
- `src/components/ui/sonner.tsx` + `toast` from `"sonner"` — already wired; use for D-03 queue-empty toast
- `src/components/ui/scroll-area.tsx` (ScrollArea) — already used in ResponseTab; carry forward for the feed scroll container
- `useResponseStore.setLastReadAt` — triggers queue depth refresh in ResponseQueuePicker useEffect; keep this side effect when drain completes

### Established Patterns
- Ephemeral lapin connections per operation — each `drain_messages` call opens one connection, loops N basic_get calls, acks each, then closes
- Ack-before-decode per message (D-10 from consume.rs) — D-14 extends this to each iteration of the drain loop
- `tauri::async_runtime::spawn` not `tokio::spawn` — must be respected in any new async Rust commands
- Zustand `INITIAL_STATE` const + spread reset pattern — follow for any new fields in `useResponseStore`
- `isLiveMode` / `setQueueList` pattern in ResponseQueuePicker — retained as-is; only the consume action changes

### Integration Points
- `ResponseTab.tsx` → replace with new `MessageFeedTab.tsx` (or refactor in-place) that renders the accordion feed + feed header (clear button, message count)
- `ResponseQueuePicker.tsx` → extend: rename "Read" button to "Drain", add drain count number input alongside it
- `useResponseStore.ts` → add `messages: FeedMessage[]`, `appendMessages`, `clearMessages` actions; remove `lastResult`, `setLastResult`
- `src-tauri/src/commands/consume.rs` → add `drain_messages` command; register it in `lib.rs`
- `src/lib/ipc.ts` → add `drainMessages(profileName, queueName, messageTypeName, count): Promise<DrainResult[]>`

</code_context>

<specifics>
## Specific Ideas

- The accordion uses shadcn `Accordion` component (`type="single"` + `collapsible`) — consistent with shadcn patterns already in the codebase
- Collapsed row: compact single-line format with bullet/dot separators between the 4 metadata fields
- Drain count input: a small `<input type="number">` with min=1 max=500, default 10, in the toolbar row
- Queue depth badge already exists in ResponseQueuePicker and refreshes on `lastReadAt` change — just ensure `setLastReadAt(Date.now())` is called after each drain (same as the existing `setLastReadAt` call after `consumeMessage`)
- FIFO-500 constant: `const FEED_MAX_SIZE = 500` in `useResponseStore.ts`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-Message Feed Foundation + Drain Mode*
*Context gathered: 2026-05-20*
