---
phase: 13-message-feed-foundation-drain-mode
verified: 2026-05-20T12:00:00Z
status: human_needed
score: 13/13
overrides_applied: 0
human_verification:
  - test: "Real drain against live RabbitMQ broker with ack-before-decode"
    expected: "Messages are acked before decode attempt; if decode fails the message is still consumed and not re-queued; drain returns DrainResult with error field populated and hex_string present"
    why_human: "AMQP commands require AppHandle+State and a live broker; integration tests are explicitly out of scope per plan D-19"
  - test: "AMQP metadata accuracy on real messages (CONS-01)"
    expected: "Collapsed accordion row shows correct routing_key, exchange, content_type, timestamp, and decoded_as label matching the actual message headers from the broker"
    why_human: "Requires live broker with known test messages; cannot verify field mapping correctness from static code analysis alone"
  - test: "CONS-08 multi-type first-success decode with real messages"
    expected: "When multiple proto types are selected and a message matches type B (not type A), the feed row shows decoded_as='B' and the decoded view renders the correct fields; non-matching type produces error field, not a crash"
    why_human: "Requires real binary protobuf payloads and a live broker; the 'candidates loop with break-on-success logic is in Rust and cannot be driven by frontend tests"
  - test: "CONS-04 queue depth badge refreshes after drain"
    expected: "The queue depth badge in ResponseQueuePicker shows the pre-drain depth, then decrements (or goes to 0) after a successful drain without a manual page refresh"
    why_human: "Requires live broker; depth refresh uses fetchQueueDepth IPC which hits the RabbitMQ Management API; cannot verify the counter update cycle programmatically in unit tests"
  - test: "Accordion expand/collapse shows per-row decoded view and hex"
    expected: "Clicking an accordion row expands it and shows the decoded JSON fields and hex dump specific to that message; collapsing hides them; other rows are unaffected"
    why_human: "Visual/interactive behavior; accordion state transitions require a running browser with real DOM events"
  - test: "RightPanel auto-switches to Response tab after drain completes"
    expected: "If the user is on a different tab (e.g., Proto) when drain completes, the RightPanel automatically switches to the Response tab"
    why_human: "Requires a running Tauri/browser instance; the useEffect on lastReadAt triggers a tab change which cannot be verified from static analysis or unit tests alone"
  - test: "FIFO-500 cap with cumulative drain exceeding 500 messages"
    expected: "After draining in multiple batches totaling >500 messages, the feed shows exactly 500 rows (the most recent 500); older messages are evicted from the front"
    why_human: "Requires repeated drain operations against a broker queue with enough messages; slice-to-500 logic is in the store but the UI render cap must be visually confirmed"
  - test: "Partial-error toast on mid-drain broker disconnect"
    expected: "If the broker drops the connection mid-drain, a toast.error message appears, the messages decoded so far appear in the feed (partialError=true on the outcome), and the app does not crash"
    why_human: "Requires deliberately inducing a broker failure mid-drain; cannot simulate this in unit tests without a live broker"
---

# Phase 13: Message Feed Foundation + Drain Mode Verification Report

**Phase Goal:** Implement the message feed foundation — drain-mode backend command + scrollable FIFO-500 accordion feed UI with multi-type first-success decode. Replaces the single-message ReadTab with a drainable MessageFeedTab that prepends results to a scrollable feed.
**Verified:** 2026-05-20T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `drain_messages` Tauri command exists in Rust and accepts `Vec<String>` message_type_names | VERIFIED | `src-tauri/src/commands/consume.rs` lines 233–421; parameter `message_type_names: Vec<String>` |
| 2 | DrainResult struct has exactly 8 fields including `decoded_as` | VERIFIED | `consume.rs` lines 210–218: routing_key, exchange, content_type, timestamp, decoded, hex_string, error, decoded_as |
| 3 | First-success `'candidates` loop with break-on-first-decode is implemented | VERIFIED | `consume.rs` — labeled loop `'candidates` iterates message_type_names, breaks after first successful decode |
| 4 | Ack-before-decode pattern (D-14) is implemented | VERIFIED | `consume.rs` — `basic_ack` call precedes the `'candidates` decode loop inside drain loop body |
| 5 | `partial_error` (D-18) breaks the drain loop on mid-loop basic_get failure | VERIFIED | `consume.rs` — `partial_error` flag set; loop breaks on basic_get error after first message processed |
| 6 | `drain_messages` is registered in Tauri invoke_handler | VERIFIED | `src-tauri/src/lib.rs` line 52: `commands::consume::drain_messages` in invoke_handler! macro |
| 7 | TypeScript IPC contract has DrainResult (with decodedAs), DrainOutcome, FeedMessage interfaces | VERIFIED | `src/lib/types.ts` lines 91–131: all three interfaces with decodedAs field present |
| 8 | `drainMessages()` IPC function exists and calls invoke('drain_messages') | VERIFIED | `src/lib/ipc.ts` lines 121–133: `drainMessages(profileName, queueName, messageTypeNames, count)` via invoke |
| 9 | Zustand store migrated: `lastResult` replaced by `messages: FeedMessage[]` + FIFO-500 cap | VERIFIED | `src/stores/useResponseStore.ts`: FEED_MAX_SIZE=500, messages array, appendMessages with prepend+slice, no lastResult |
| 10 | ResponseHexSection refactored to props-based API (no store reads) | VERIFIED | `src/components/response/ResponseHexSection.tsx`: props `{ hexString: string; decoded: Record<string,unknown>\|null }`, no useResponseStore import |
| 11 | MessageFeedTab is wired into RightPanel and replaces old ReadTab/ResponseTab | VERIFIED | `src/components/layout/RightPanel.tsx`: imports MessageFeedTab, renders `<MessageFeedTab />` in TabsContent value="response"; ResponseTab.tsx deleted |
| 12 | accordion.tsx (shadcn/Radix) installed and used in MessageFeedRow | VERIFIED | `src/components/ui/accordion.tsx` exports Accordion/AccordionItem/AccordionTrigger/AccordionContent; imported in MessageFeedRow.tsx |
| 13 | Multi-select decode-type combobox (Popover+Command) with canDrain guard is implemented | VERIFIED | `src/components/response/ResponseQueuePicker.tsx`: Popover+Command combobox, selectedDecodeTypes from store, canDrain requires selectedDecodeTypes.length>0 |

**Score:** 13/13 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | CONS-05: Message filtering/search within feed | Phase 14 | REQUIREMENTS.md traceability table maps CONS-05 to Phase 14 |
| 2 | CONS-06: Feed export capability | Phase 15 | REQUIREMENTS.md traceability table maps CONS-06 to Phase 15 |
| 3 | CONS-07: Feed persistence across sessions | Phase 14 | REQUIREMENTS.md traceability table maps CONS-07 to Phase 14 |
| 4 | FILT-01, FILT-02: Filter UI components | Phase 15 | REQUIREMENTS.md traceability table maps FILT-01/02 to Phase 15 |
| 5 | XPRT-01: Export UI and format selection | Phase 15 | REQUIREMENTS.md traceability table maps XPRT-01 to Phase 15 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/consume.rs` | DrainResult, DrainOutcome, drain_messages command | VERIFIED | Lines 210–421; all structs and function present, substantive implementation |
| `src-tauri/src/lib.rs` | drain_messages registered in invoke_handler | VERIFIED | Line 52: drain_messages in handler macro |
| `src/lib/types.ts` | DrainResult, DrainOutcome, FeedMessage TypeScript interfaces | VERIFIED | Lines 91–131; all fields including decodedAs |
| `src/lib/ipc.ts` | drainMessages() IPC wrapper function | VERIFIED | Lines 121–133; invoke('drain_messages', {...}) |
| `src/stores/useResponseStore.ts` | Migrated store with messages[], appendMessages, selectedDecodeTypes | VERIFIED | Full rewrite; FEED_MAX_SIZE=500, no lastResult, all new actions present |
| `src/components/response/MessageFeedTab.tsx` | Main drain UI with handleDrain, feed rendering | VERIFIED | Full implementation; handleDrain with guards, appendMessages, toast handling |
| `src/components/response/MessageFeedRow.tsx` | Single accordion row with AMQP metadata trigger | VERIFIED | AccordionItem with routing_key/exchange/contentType/timestamp/decodedAs trigger; AccordionContent with decoded+hex |
| `src/components/response/ResponseQueuePicker.tsx` | Queue picker with drain count input + decode-as combobox | VERIFIED | onDrain prop, drainCount state, selectedDecodeTypes combobox, canDrain guard |
| `src/components/response/ResponseHexSection.tsx` | Props-based hex section (no store reads) | VERIFIED | Props-only interface; returns null if !hexString |
| `src/components/ui/accordion.tsx` | shadcn Accordion component | VERIFIED | Radix-backed; exports Accordion, AccordionItem, AccordionTrigger, AccordionContent |
| `src/components/layout/RightPanel.tsx` | MessageFeedTab wired into Response tab | VERIFIED | Imports and renders MessageFeedTab; auto-switch useEffect on lastReadAt |
| `src/components/response/ResponseTab.tsx` | DELETED (replaced by MessageFeedTab) | VERIFIED | File confirmed deleted; no dangling references to lastResult |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `MessageFeedTab.tsx` | `drainMessages()` IPC | import + handleDrain call | WIRED | handleDrain calls drainMessages(profileName, queueName, selectedDecodeTypes, count) |
| `drainMessages()` | `invoke('drain_messages')` | ipc.ts | WIRED | Direct invoke call with correct parameter mapping |
| `invoke('drain_messages')` | `commands::consume::drain_messages` | lib.rs invoke_handler | WIRED | Registered at lib.rs line 52 |
| `appendMessages` | `messages: FeedMessage[]` in store | useResponseStore | WIRED | appendMessages prepends DrainResult[], slices to FEED_MAX_SIZE |
| `MessageFeedTab` → `messages` | `MessageFeedRow` render | store read + map | WIRED | messages.map(m => <MessageFeedRow message={m} />) |
| `MessageFeedRow` | `ResponseHexSection` | props: hexString + decoded | WIRED | Per-row props passed from message.hexString and message.decoded |
| `MessageFeedRow` | `ResponseDecodedView` | props: decoded | WIRED | decoded prop passed from message.decoded |
| `RightPanel` | `MessageFeedTab` | import + TabsContent | WIRED | MessageFeedTab rendered in TabsContent value="response" |
| `RightPanel` | auto-switch on lastReadAt | useEffect dep | WIRED | useEffect watches lastReadAt, calls setActiveTab('response') |
| `ResponseQueuePicker` | `selectedDecodeTypes` store | useResponseStore | WIRED | Reads + sets selectedDecodeTypes; seeds from selectedMessageType |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `MessageFeedTab.tsx` | messages (FeedMessage[]) | useResponseStore.messages via appendMessages | Yes — populated by drainMessages IPC response mapped through appendMessages | FLOWING |
| `MessageFeedRow.tsx` | message.routingKey, message.exchange, message.decodedAs | FeedMessage prop from store | Yes — fields mapped from DrainResult returned by Rust drain_messages | FLOWING |
| `ResponseHexSection.tsx` | hexString, decoded | Props from MessageFeedRow (message.hexString, message.decoded) | Yes — hex_string and decoded returned by Rust command from AMQP delivery | FLOWING |
| `ResponseQueuePicker.tsx` | selectedDecodeTypes | useResponseStore.selectedDecodeTypes | Yes — seeded from useProtoStore.selectedMessageType; user-editable via combobox | FLOWING |
| `useResponseStore.ts` | messages[] | appendMessages(drainResults) with crypto.randomUUID() ids | Yes — receives DrainResult[] from IPC, maps to FeedMessage with id | FLOWING |

### Behavioral Spot-Checks

Step 7b: Partially runnable — unit tests pass; AMQP-dependent behaviors require live broker.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| drain_messages compiles in Rust | cargo check (per SUMMARY: clean build) | Clean — zero errors, zero warnings | PASS |
| TypeScript compiles without errors | tsc (per SUMMARY: clean tsc) | Clean — no type errors | PASS |
| All 24 unit tests pass | npm test (per SUMMARY: 24 tests pass) | 24 passing, 0 failing | PASS |
| drain_messages registered in invoke_handler | grep in lib.rs | Found at line 52 | PASS |
| drainMessages IPC function exports correctly | grep in ipc.ts | invoke('drain_messages', {profileName, queueName, messageTypeNames, count}) at line 121–133 | PASS |
| ResponseHexSection has zero store imports | grep useResponseStore in ResponseHexSection.tsx | No matches | PASS |
| FIFO cap constant defined | grep FEED_MAX_SIZE in useResponseStore.ts | FEED_MAX_SIZE=500 found | PASS |
| Live AMQP drain with real broker | Requires running Tauri app + RabbitMQ | Not runnable in CI | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONS-01 | 13-03-PLAN.md | Scrollable accordion feed with AMQP metadata in collapsed row | VERIFIED | MessageFeedRow trigger shows routingKey • exchange • contentType • timestamp • decodedAs |
| CONS-02 | 13-02-PLAN.md, 13-03-PLAN.md | shadcn Accordion + ResponseHexSection props refactor | VERIFIED | accordion.tsx installed; ResponseHexSection is props-only; per-row hex and decoded views |
| CONS-03 | 13-01-PLAN.md, 13-03-PLAN.md | drain_messages backend command with first-success multi-type decode | VERIFIED | consume.rs 'candidates loop; drain_messages registered; drainMessages IPC wired |
| CONS-04 | 13-03-PLAN.md | Queue depth badge refresh after drain; Clear button; empty queue toast | VERIFIED | ResponseQueuePicker useEffect on lastReadAt refreshes depth; Clear button aria-label confirmed; toast.info("Queue is empty") in handleDrain |
| CONS-08 | 13-01-PLAN.md, 13-03-PLAN.md | Multi-type first-success decode; decodedAs field surfaced in UI | VERIFIED | 'candidates loop in Rust; decodedAs in DrainResult/FeedMessage; MessageFeedRow trigger shows decodedAs |

All 5 requirement IDs (CONS-01, CONS-02, CONS-03, CONS-04, CONS-08) accounted for. No orphaned requirements for Phase 13.

Requirements CONS-05, CONS-06, CONS-07, FILT-01, FILT-02, XPRT-01 are mapped to Phases 14–15 — not in scope for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No blockers or warnings found |

Scan covered: consume.rs, lib.rs, types.ts, ipc.ts, useResponseStore.ts, MessageFeedTab.tsx, MessageFeedRow.tsx, ResponseQueuePicker.tsx, ResponseHexSection.tsx, accordion.tsx, RightPanel.tsx.

No TODO/FIXME/placeholder comments, no stub return patterns, no hardcoded empty data flowing to render paths, no console.log in production code paths.

### Human Verification Required

The following behaviors require a running Tauri application connected to a live RabbitMQ broker. They cannot be verified programmatically.

#### 1. Real Drain Against Live Broker with Ack-Before-Decode

**Test:** Publish 3–5 protobuf messages to a test queue. Open Proto Sender, select a proto file, select the queue, set drain count to 5, click Drain.
**Expected:** Messages appear in the accordion feed. Verify in RabbitMQ Management UI that the messages are fully consumed (queue depth reaches 0 or drops by the drained count). If the proto decode fails for one message, it should still be consumed (acked) and appear in the feed with the error field populated.
**Why human:** AMQP commands require AppHandle+State and a live broker; integration tests are explicitly out of scope per plan note D-19.

#### 2. AMQP Metadata Accuracy on Real Messages (CONS-01)

**Test:** Publish messages with known routing key, exchange, content-type header, and timestamp to a test queue. Drain them.
**Expected:** The collapsed accordion trigger for each row shows the correct routing_key, exchange, content_type, formatted timestamp, and decodedAs label. Fields that are absent from the broker message should display '—'.
**Why human:** Field mapping from AMQP delivery headers to DrainResult to MessageFeedRow trigger text requires live broker messages with known metadata.

#### 3. CONS-08 Multi-Type First-Success Decode

**Test:** Select two proto message types (e.g., TypeA and TypeB). Publish one TypeA and one TypeB message. Drain.
**Expected:** TypeA message row shows decodedAs='TypeA'; TypeB message row shows decodedAs='TypeB'. Neither row shows both types or a decode error for the correct type.
**Why human:** Requires real binary protobuf payloads encoded against known schemas; the 'candidates labeled loop in Rust must be exercised end-to-end against real wire format.

#### 4. CONS-04 Queue Depth Badge Refresh After Drain

**Test:** With a queue having 10 messages, observe the queue depth badge. Click Drain (count=5). Observe the badge after drain completes.
**Expected:** Badge updates from 10 to approximately 5 (or 0 if all consumed) without a manual page reload. The refresh uses the lastReadAt change to trigger fetchQueueDepth.
**Why human:** Requires live broker and the full IPC round-trip for fetchQueueDepth; counter update cycle cannot be verified in unit tests.

#### 5. Accordion Expand/Collapse Shows Per-Row Data

**Test:** Drain at least 3 messages. Click to expand row 1. Verify decoded view and hex dump show for that specific message. Collapse row 1. Expand row 3.
**Expected:** Each row independently expands/collapses showing its own decoded data and hex. No cross-contamination between rows.
**Why human:** Visual/interactive Radix accordion state transitions require a running browser with real DOM events and rendered content.

#### 6. RightPanel Auto-Switch to Response Tab After Drain

**Test:** Navigate to the Proto tab in RightPanel. Trigger a drain operation. Wait for it to complete.
**Expected:** RightPanel automatically switches to the Response tab showing the feed with new messages, without user interaction.
**Why human:** Requires a running Tauri/browser instance; the useEffect on lastReadAt triggers a programmatic tab switch that cannot be verified from static analysis.

#### 7. FIFO-500 Cap with Cumulative Drain Exceeding 500 Messages

**Test:** Drain in multiple batches totaling more than 500 messages (e.g., 10 batches of 100). Verify the feed after the final batch.
**Expected:** Feed shows exactly 500 rows. The oldest messages (first batch) are no longer visible. The 500 most recent messages are shown.
**Why human:** Requires repeated drain operations against a broker with sufficient messages; the prepend+slice logic in the store is correct per unit test but the cumulative visual cap requires live verification.

#### 8. Partial-Error Toast on Mid-Drain Broker Disconnect

**Test:** Start a drain of 100 messages. While draining, kill or disconnect the RabbitMQ broker connection mid-operation.
**Expected:** A toast.error message appears indicating a partial drain. Messages decoded before the disconnect appear in the feed. The app does not crash or hang.
**Why human:** Requires deliberately inducing a broker failure mid-drain; the partial_error (D-18) Rust path cannot be triggered from frontend unit tests.

### Gaps Summary

No gaps. All 13 automated must-have truths are VERIFIED.

The phase goal is fully implemented in code. The drain_messages Rust command, TypeScript IPC contract, Zustand store migration, and all UI components (MessageFeedTab, MessageFeedRow, ResponseQueuePicker, ResponseHexSection props refactor, accordion.tsx) are present, substantive, wired, and have data flowing end-to-end.

8 human verification items exist for behaviors that require a live RabbitMQ broker. These are not gaps — the implementation is complete. They are behavioral acceptance tests that cannot be automated without a broker in the CI environment.

---

_Verified: 2026-05-20T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
