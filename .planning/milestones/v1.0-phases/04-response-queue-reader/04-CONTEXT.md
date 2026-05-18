# Phase 4: Response Queue Reader - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 completes the request/reply loop: the user selects a reply/response queue, clicks "Read" to consume one incoming message, sees the binary payload decoded into readable field values and raw hex, and the message is acknowledged (permanently removed from the queue) — all without leaving the app.

Delivers RESP-01 through RESP-05. Phase 4 does not add multi-message streaming, real-time monitoring, or persistent history of consumed messages — those remain out of scope.

</domain>

<decisions>
## Implementation Decisions

### UI Placement — Response Tab

- **D-01:** The response reader lives as the **3rd tab in `RightPanel`** ("Response"), alongside the existing History and Hex tabs from Phase 3. No `AppLayout.tsx` changes needed.
- **D-02:** Within the Response tab, the layout is **stacked vertically**: collapsible decoded field tree on top, raw hex string below. "Side by side" in RESP-05 is interpreted as co-located in the same panel (not literal horizontal columns) — vertical stacking fits the narrow panel width.
- **D-03:** **Idle state**: muted placeholder text ("Select a reply queue and click Read"). After an empty-queue read: inline "Queue empty" text replaces the placeholder — no toast notification.
- **D-04:** Multiple reads **replace** the previous result. Response tab always shows the most recently consumed message only. There is no accumulation.

### Reply Queue Picker

- **D-05:** The reply queue picker lives **inside the Response tab** (self-contained). Layout top-to-bottom: queue picker + Read button → decoded result. No changes to `PublishBar`.
- **D-06:** Queue list populates **on Response tab focus**, reusing the existing `fetch_queues` IPC call. Same Live/Manual fallback as PUBL-03: live dropdown when Management API is available, plain text input with "Manual" badge when unavailable.
- **D-07:** Selected reply queue is **session-only** (Zustand state in a new `useResponseStore`). Not persisted to `tauri-plugin-store`. Resets on app restart.
- **D-08:** Read button is **disabled + tooltip** when no active connection profile is set: "Connect to a RabbitMQ profile to read." Mirrors Phase 2 Send button behavior (D-12 from `02-CONTEXT.md`).
- **D-16:** Read button shows a **loading spinner** and is disabled while the `consume_message` IPC call is in flight. Prevents double-reads during the async operation.

### Deserialization

- **D-09:** Always deserialize using the **active form message type** (currently selected in the form panel). No separate message type selector in the Response tab. Matches RESP-03 spec exactly.
- **D-10:** When decode fails (schema mismatch or corrupt payload): **show raw hex + inline error** ("Decode failed: [reason]. Showing raw bytes."). The message is **always ack'd regardless of decode outcome** — this is a deliberate override of RESP-04's "after successful deserialization" clause. The planner must note this deviation in the plan's must_haves.
- **D-11:** Decoded fields rendered as a **collapsible key-value tree** — hierarchical, nested messages are collapsible, read-only labels only (no form inputs). Not JSON pretty-print.
- **D-12:** After a successful read, the app **auto-switches to the Response tab** (mirrors Phase 3 behavior: auto-switch to History tab after a successful send, via `lastReadAt` ref signal).

### History Integration

- **D-13:** History stays **send-only**. Consumed messages are NOT added to `useHistoryStore`. The Response tab is the only record of the most recently consumed message.
- **D-14:** Response tab provides **two copy actions**: "Copy hex" (raw hex string) + "Copy decoded JSON" (decoded fields serialized to JSON, copied to clipboard).
- **D-15:** Response tab is **read-only**. No "Load into form" / replay action.

### Claude's Discretion

- Rust command name and signature for the consume operation (`consume_message` or similar): use `basic_get` (non-blocking, returns `None` on empty queue — matches RESP-02's non-blocking requirement). Ephemeral connection pattern from `publish_message` (connect → channel → basic_get → close).
- Return type from Rust: a struct with `{ payload: Vec<u8>, message_tag: u64 }` — tag needed for ack; payload forwarded to prost-reflect for decode.
- `useResponseStore` shape: `{ queueList, isLiveMode, selectedQueue, isLoading, lastResult: { decoded, hexString, error } | null }` — following the Zustand typed interface + INITIAL_STATE pattern.
- Decoded JSON copy uses `JSON.stringify(decoded, null, 2)` on the prost-reflect output mapped to plain JS object.
- Component names: `ResponseTab`, `ResponseQueuePicker`, `ResponseDecodedView`, `ResponseHexSection`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 Requirements and Scope
- `.planning/REQUIREMENTS.md` — RESP-01 through RESP-05 (full spec text for each requirement)
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria (SC-1 through SC-5), requirement mapping
- `.planning/PROJECT.md` — Project constraints; note "Message consumption" was Out of Scope until Phase 4 addition

### Technology Decisions
- `CLAUDE.md` — Full tech stack with crate versions, version constraints. Critical for Phase 4:
  - `lapin` 4.x: `basic_get` API for non-blocking consume; `basic_ack` for acknowledgment
  - `prost-reflect`: `DynamicMessage` for runtime deserialization from binary payload
  - `tauri::async_runtime::spawn` — NEVER bare `tokio::spawn`
  - `reqwest` — `fetch_queues` IPC already implemented in connection.rs

### Prior Phase Context
- `.planning/phases/03-full-feature-set/03-CONTEXT.md` — D-01 (history via tauri-plugin-store), RightPanel dual-tab structure, `lastSendAt` auto-switch ref pattern, `useHistoryStore` pattern
- `.planning/phases/02-connect-publish/02-CONTEXT.md` — D-12 (disabled Send button + tooltip pattern), D-11 (Live/Manual Management API badge), PublishBar queue picker pattern

### Critical Existing Source Files
- `src/components/layout/RightPanel.tsx` — Add "Response" as 3rd tab here
- `src/stores/useConnectionStore.ts` — Pattern for `useResponseStore` (typed interface + INITIAL_STATE + create)
- `src/stores/useHistoryStore.ts` — Pattern for store hydration; history stays send-only (D-13)
- `src-tauri/src/commands/connection.rs` — `fetch_queues` (reuse for RESP-01 queue picker), `load_profile_with_password` (use in consume command)
- `src-tauri/src/commands/publish.rs` — Ephemeral connection pattern to replicate in `consume_message`
- `src-tauri/src/lib.rs` — Register new `consume_message` Tauri command here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/commands/connection.rs::fetch_queues` — Already implements the Management API queue listing with Live/Manual fallback (RESP-01). Reuse directly; no new Rust code for queue listing.
- `src-tauri/src/commands/connection.rs::load_profile_with_password` — Used in `publish_message`; reuse in `consume_message` to load credentials for the ephemeral consume connection.
- `src-tauri/src/commands/publish.rs` — The entire ephemeral connection pattern (connect → create_channel → operation → close) is the template for `consume_message`.
- `src/components/publish/PublishBar.tsx` — PublishBar queue picker (Live/Manual badge, dropdown, fallback text input) is the visual and behavioral template for the Response tab queue picker (D-05, D-06).
- `src/stores/useAmqpStore.ts` / `useConnectionStore.ts` — Zustand typed interface + INITIAL_STATE + `create()` pattern for `useResponseStore`.
- `src/components/history/` — Existing history panel components for patterns (list rendering, status badges, copy-to-clipboard).

### Established Patterns
- Zustand: typed interface + `INITIAL_STATE` constant + `create<Interface>((set, get) => ({...}))` in `src/stores/`
- Ephemeral AMQP: connect → create_channel → operation → close in each command; never hold persistent channel state
- Management API fallback: `fetch_queues` → if `ManagementApiUnavailable` → switch to manual text input with "Manual" badge
- Disabled button + tooltip: shadcn `Button disabled` + `Tooltip` from `@radix-ui/react-tooltip` (pattern from PublishBar Send button)
- Auto-tab-switch: edge-detection ref (`prevLastReadAt`) in `RightPanel.useEffect` — same mechanism as `lastSendAt` for History auto-switch
- Copy to clipboard: `navigator.clipboard.writeText()` — already used in the Hex section of Phase 3

### Integration Points
- `src/components/layout/RightPanel.tsx` → Add value `"response"` to `<Tabs>` + new `<TabsTrigger value="response">Response</TabsTrigger>` + `<TabsContent value="response"><ResponseTab /></TabsContent>`
- `src-tauri/src/lib.rs` → Add `consume_message` to `invoke_handler!` macro (same as `publish_message`, `fetch_queues`)
- `src-tauri/src/commands/mod.rs` → Add new module for consume command (or add to existing `publish.rs` if small enough)
- `src/lib/ipc.ts` → Add `consumeMessage(profileName, queueName)` typed IPC wrapper
- `src/lib/types.ts` → Add `ConsumeResult { decoded: Record<string, unknown>; hexString: string; error?: string }` type

</code_context>

<specifics>
## Specific Ideas

- The Response tab's queue picker header matches the PublishBar queue picker: shows "Live" (green dot) or "Manual" (yellow dot) badge — same `fetch_queues` error handling logic.
- `basic_get` Rust API: `channel.basic_get(queue_name, BasicGetOptions::default()).await` — returns `Option<GetMessage>`. `None` → return a sentinel to the frontend to show "Queue empty". `Some(msg)` → extract `msg.data`, call `basic_ack`, then decode payload with prost-reflect.
- Decode with prost-reflect: use the existing `DescriptorPool` pattern from Phase 1 (`parse_proto` command). The `consume_message` command receives the `messageTypeName` from the frontend (the active form's selected type) and uses `pool.get_message_by_name()` → `DynamicMessage::decode()`.
- "Copy decoded JSON": The Rust-decoded `DynamicMessage` is serialized to `serde_json::Value` before returning to the frontend (the same approach as the encode preview in Phase 1). The frontend's "Copy decoded JSON" button calls `navigator.clipboard.writeText(JSON.stringify(decoded, null, 2))`.
- Ack always happens: even on decode failure, the message is removed from the queue (D-10). This prevents a poison-pill message from blocking the queue. The error is shown inline so the user knows decoding failed but the message is gone.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-response-queue-reader*
*Context gathered: 2026-05-18*
