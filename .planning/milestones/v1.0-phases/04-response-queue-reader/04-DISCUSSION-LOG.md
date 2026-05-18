# Phase 4: Response Queue Reader - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 4-response-queue-reader
**Areas discussed:** Response panel home, Reply queue picker placement, Deserialization schema, History integration

---

## Response panel home

| Option | Description | Selected |
|--------|-------------|----------|
| 3rd tab in RightPanel | Add "Response" tab alongside existing History + Hex tabs. No AppLayout changes needed. | ✓ |
| Section above/below PublishBar | Integrated into main center panel, adjacent to send controls. | |
| Floating/modal panel | Dismissible modal or popover. Keeps main layout unchanged. | |

**User's choice:** 3rd tab in RightPanel

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked vertically | Decoded fields on top, raw hex below. Works in narrow panel. | ✓ |
| Two sub-tabs (Decoded / Hex) | Mini tab strip inside the Response tab. | |

**User's choice:** Stacked vertically — "side by side" in RESP-05 interpreted as co-located, not literal horizontal columns.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Idle placeholder + inline empty-queue indicator | Muted hint before first read; "Queue empty" text after empty read — no toast. | ✓ |
| Only shows content after successful read | Blank until message arrives; empty-queue shown as toast. | |

**User's choice:** Inline indicator in both idle and empty-queue states.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Replace — latest message only | Read overwrites previous decoded view. | ✓ |
| Accumulate — most recent N reads | Short list of recent reads. | |

**User's choice:** Replace — latest message only.

---

## Reply queue picker placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the Response tab | Self-contained: picker and result in one panel. No PublishBar changes. | ✓ |
| In the PublishBar | Alongside send target. More complex PublishBar. | |
| In the sidebar | Below connection panel. | |

**User's choice:** Inside the Response tab.

---

| Option | Description | Selected |
|--------|-------------|----------|
| On Response tab focus | Fetches queues when tab is clicked; reuses fetch_queues IPC. | ✓ |
| Shared state with PublishBar | Both read from same queue list in shared store. | |
| On-demand via refresh button | User explicitly refreshes. | |

**User's choice:** On Response tab focus.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Session memory only | Zustand state; resets on restart. | ✓ |
| Persisted across restarts | Last-used queue saved to tauri-plugin-store. | |

**User's choice:** Session memory only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled + tooltip | Grayed out; tooltip "Connect to read." Mirrors Phase 2 Send button. | ✓ |
| Enabled — shows error on click | Stays active; shows inline error on click. | |

**User's choice:** Disabled + tooltip.

---

## Deserialization schema

| Option | Description | Selected |
|--------|-------------|----------|
| Active form message type only | Always use currently selected message type. Matches RESP-03. | ✓ |
| Separate message type selector | Response tab has its own independent message type dropdown. | |

**User's choice:** Active form message type only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Raw hex + error message (always ack) | Show hex regardless; inline error on failure; ack always happens. | ✓ |
| Error only, no ack | No ack on failure; user can retry with different type. | |
| Error + ack (no hex) | Ack but no hex shown on failure. | |

**User's choice:** Raw hex + error message; always ack. **Note:** deliberate override of RESP-04 "after successful deserialization" — ack happens regardless of decode outcome to prevent poison-pill messages blocking the queue.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible key-value tree | Hierarchical, nested messages collapsible, read-only labels. | ✓ |
| JSON pretty-print | Convert to JSON with syntax highlighting. | |
| You decide | Claude picks based on existing patterns. | |

**User's choice:** Collapsible key-value tree.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — auto-switch | RightPanel auto-focuses Response tab after successful read. | ✓ |
| No — stay on current tab | User must manually switch to Response tab. | |

**User's choice:** Yes — auto-switch on successful read.

---

## History integration

| Option | Description | Selected |
|--------|-------------|----------|
| No — keep history send-only | History only records sent messages. Consumed messages in Response tab only. | ✓ |
| Yes — add to history with 'received' status | Consumed messages appear in history with 'received' badge. | |

**User's choice:** History stays send-only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Copy hex only | Matches existing Hex tab pattern. | |
| Copy hex + Copy decoded JSON | Two copy actions: raw hex + JSON-serialized decoded fields. | ✓ |
| No copy action | User selects text manually. | |

**User's choice:** Copy hex + Copy decoded JSON.

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — Response tab is read-only | Display only; no form injection. | ✓ |
| Yes — add "Load into form" button | Inject decoded fields into active form (same as HIST-02 replay). | |

**User's choice:** No — Response tab is read-only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Loading spinner on Read button | Disabled + spinner while IPC in flight. Prevents double-reads. | ✓ |
| No loading state | Button stays enabled during call. | |

**User's choice:** Loading spinner on Read button.

---

## Claude's Discretion

- Rust command name/signature for consume: `consume_message(profileName, queueName, messageTypeName)` using `basic_get` (non-blocking)
- Return type from Rust: struct with `{ decoded: serde_json::Value, hex_string: String, message_tag: u64 }` — or error sentinel for empty queue
- `useResponseStore` internal shape: `{ queueList, isLiveMode, selectedQueue, isLoading, lastResult }` following Zustand typed interface pattern
- Component names: `ResponseTab`, `ResponseQueuePicker`, `ResponseDecodedView`, `ResponseHexSection`
- Decoded JSON copy implementation: `JSON.stringify(decoded, null, 2)` via `navigator.clipboard.writeText()`

## Deferred Ideas

None — discussion stayed within phase scope.
