# Feature Research

**Domain:** AMQP developer tool — Advanced Response Consumer (v1.4)
**Researched:** 2026-05-20
**Confidence:** HIGH

---

## Context: What Already Exists

v1.3 shipped a one-at-a-time `basic_get` consumer. The store and picker are already partially scaffolded for v1.4:

- `useResponseStore` declares `isLiveMode`, `queueDepth`, `queueList` (with live flag), and `queueDepth`
- `ResponseQueuePicker` already renders the queue depth pill, Live/Manual badge, and calls `fetchQueueDepth`
- `fetchQueueDepth` IPC call already exists

This means "queue depth indicator" is primarily a refresh-cadence and display feature — not greenfield — and the complexity estimates below reflect that.

The existing `ConsumeResult` shape (`empty`, `decoded`, `hexString`, `error`) carries **no AMQP metadata**. Every feature that needs routing key or content-type filtering requires extending this type first. That is the foundational prerequisite for v1.4.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a developer using this tool as their RabbitMQ test harness assumes exist. Missing these makes the tool feel incomplete relative to even the RabbitMQ Management UI's built-in "Get Messages" panel.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drain mode (batch basic_get up to N) | "Get Messages" in the native RabbitMQ Management UI offers a count field; every developer who has used that UI expects the same | MEDIUM | Bounded, returns then stops; distinct from live subscribe. N can be implemented via N×basic_get or basic_consume auto-cancel at N — either works; user just sets a number |
| Live subscribe mode (persistent consumer, streaming list) | Any tool that "reads from a queue" eventually grows this; gRPC tools (Postman, BloomRPC) all offer streaming views for push-based protocols; basic_consume is the correct AMQP primitive | HIGH | Requires background Tauri async task, Tauri Channel for stream delivery to frontend, Consumer tag management for stop/cancel |
| Scrollable message list (newest on top) | Postman gRPC, Postman WebSocket, and every REPL-style dev tool displays messages in reverse-chronological order (latest on top) | MEDIUM | Extends existing ResponseTab; list replaces single-result display; existing ResponseDecodedView and ResponseHexSection are reused inside expanded rows |
| Per-row expand/collapse | Each message is one row; expanding reveals the decoded key-value tree and hex payload — same views as current v1.3 consumer | MEDIUM | Component extraction of ResponseDecodedView + ResponseHexSection into a reusable MessageRow |
| Message list capacity cap (FIFO eviction) | A dev tool that accumulates unbounded messages will eventually freeze; the existing history store has a FIFO-100 precedent | LOW | Recommended default: 500 messages; oldest evicted automatically; no config UI needed at v1 |
| Stop subscribe button | Every streaming tool has a clear "End stream" or "Stop" control; a subscribe session with no stop is a resource leak | LOW | Calls basic_cancel on the consumer tag; closes the AMQP connection/channel; resets UI to idle |
| Ack-immediately on all received messages | Existing D-10 decision: ack before decode, always; users of a dev tool do not want to re-deliver a poison-pill message | LOW | Carry D-10 forward; no nack/reject/requeue UI needed |
| Queue depth refresh after drain | After draining N messages the depth should update to reflect the new count | LOW | Already scaffolded: lastReadAt dep in useEffect triggers depth refresh |
| AMQP metadata per message (routing key, exchange, content-type, timestamp) | Developers diagnosing routing or content-type issues need to see message properties, not just payload | MEDIUM | Requires extending ConsumeResult with delivery metadata; this is a prerequisite for filter features |

### Differentiators (Competitive Advantage)

Features that raise the tool above the RabbitMQ Management UI's basic "Get Messages" panel and give it a reason to exist.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Filter received messages by routing key (client-side) | In a shared topic/fanout setup multiple routing keys arrive on one queue; developer only wants to inspect messages for `order.created`, not every key | MEDIUM | Client-side display filter on the feed array; not broker-side (AMQP 0-9-1 has no selective-pull from an arbitrary queue); substring or exact match on routing_key field |
| Filter received messages by content-type (client-side) | A mixed-type queue (proto + JSON + legacy binary) makes it hard to spot the relevant messages; filtering by content-type reduces noise | LOW | Same filter bar, additional field; LOW because routing_key filter does the structural work; content-type is one more predicate |
| Export received messages to JSON | Developer wants to diff two captures, file a bug report with a real payload sample, or replay in a test fixture | LOW | Array of `{metadata, decoded, hexString}` as pretty-printed JSON; browser-level File API / Tauri fs plugin; straightforward |
| Export received messages to CSV | Data team or QA team wants to paste payload fields into a spreadsheet; CSV is the lowest common denominator for non-technical consumers | MEDIUM | Nested proto fields must be flattened; recommended approach: emit a `decoded_json` column as a JSON string rather than attempting to fully normalize nested objects; state this decision explicitly so there is no ambiguity about column structure |
| Queue depth live refresh cadence in subscribe mode | While the consumer is running the depth indicator should tick down as messages are consumed, giving the developer a real-time drain progress indicator | LOW | Poll fetchQueueDepth on a timer while subscribe is active (e.g., every 2s); stop polling on stop |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like a natural next step but would break scope, create implementation debt, or blur the product identity. Call these out explicitly so they do not creep in during phase planning.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Persist received messages across app restarts | Developers like to review old captures after restart | Monitoring product feature, not a dev-tool feature; adds storage schema complexity and competes with RabbitMQ's own message store; explicitly excluded in PROJECT.md "Out of Scope" ("Real-time message monitoring or stream subscription — different product") | The existing send history covers "what did I send?" — the receive log is session-only, explicitly ephemeral |
| Consume from multiple queues simultaneously | Some workflows fan out across queues | Multiplies Rust connection/channel management complexity; introduces queue-selector UX that duplicates the existing profile + queue picker; no clear priority over other backlog items | Consume one queue at a time; user switches if needed |
| Broker-side filter / selective consume by routing key | Developers assume you can tell RabbitMQ "give me only messages with routing key X" | AMQP 0-9-1 has no such operation on an existing queue; routing key filtering must be post-delivery on the client | Client-side display filter (implemented above); educate via tooltip in UI |
| Nack / reject / requeue controls | Developer wants to push a bad message back | Contradicts D-10 (ack-before-decode, always); adding nack introduces a stateful UI that tracks unacked messages and complicates the Rust command model | Ack always; developer re-publishes manually if needed |
| Prefetch tuning UI (QoS slider or input) | Advanced users know about prefetch | Adds a UI element whose wrong value (e.g., prefetch = 1000 on a 10k-message queue) can overwhelm the app; sensible hidden default (10–50) is sufficient for a dev tool | Hardcode a safe prefetch; expose only if a concrete user complaint arises |
| Regex or JSONPath search over message bodies | Power users want "find messages where field X contains Y" | JSONPath over prost-reflect output requires a runtime expression evaluator not yet in the stack; regex over hex is useless; this is 20% of use cases at 80% of implementation cost | Substring match on decoded JSON string is sufficient for v1.4 |
| Timeseries / rate graph / queue drain forecast | RabbitGUI offers this; looks impressive | Metrics/monitoring product feature; requires accumulating stats over time; orthogonal to the core "send a proto message and see the response" loop | Queue depth badge + depth refresh cadence is sufficient signal |
| Alarm / threshold / notification when queue drains | Operations workflow | This app is a developer test harness, not an operations tool; notification plumbing (system tray, desktop notification) is out of scope | Queue depth badge is visible while app is open |
| Multi-tab receive sessions | Keep two different queue captures open | UI complexity multiplies; existing multi-tab model is for proto files, not receive sessions | One active receive session at a time; existing proto tabs are for the send side |

---

## Feature Dependencies

```
[AMQP metadata in ConsumeResult]
    └──required-by──> [Filter by routing key]
    └──required-by──> [Filter by content-type]
    └──required-by──> [Per-message metadata display in row]
    └──required-by──> [Export (metadata columns)]

[Scrollable message list + MessageRow component]
    └──required-by──> [Filter (renders filtered list)]
    └──required-by──> [Export (iterates list)]
    └──required-by──> [Capacity cap (applied to list)]

[Live subscribe (Tauri Channel + background task)]
    └──required-by──> [Stop subscribe button]
    └──required-by──> [Queue depth live refresh cadence]
    └──enhances──>    [Filter (filter applied to incoming stream)]

[Drain mode]
    └──requires──>    [AMQP metadata in ConsumeResult] (same extension)
    └──independent-of──> [Live subscribe mode]

[Existing ResponseQueuePicker]
    └──extended-by──> [Drain N input + Drain button]
    └──extended-by──> [Subscribe / Stop buttons]
    └──extended-by──> [Filter bar]

[Existing ResponseDecodedView + ResponseHexSection]
    └──reused-in──>   [MessageRow expanded view]
```

### Dependency Notes

- **AMQP metadata extension is Phase 1 prerequisite.** Everything else builds on having `routing_key`, `exchange`, `content_type`, `timestamp`, and `delivery_tag` available per message on the frontend.
- **Drain and subscribe are parallel tracks after the metadata extension.** They do not depend on each other and can land in separate phases.
- **Filter bar depends on message list, not on subscribe.** Filtering works identically whether the list was populated by drain or by subscribe.
- **Export depends on message list.** No additional Rust work needed — it is a frontend-only serialization of the feed array.

---

## Phase Recommendations for Roadmap

### Phase 1: Message feed foundation + drain mode

What it addresses:
- AMQP metadata extension (`ConsumeResult` gains `routing_key`, `exchange`, `content_type`, `timestamp`)
- Scrollable message list with FIFO-500 cap
- MessageRow component (per-row expand/collapse, reusing ResponseDecodedView + ResponseHexSection)
- Drain mode (batch basic_get up to N with extended ConsumeResult)
- Queue depth refresh after drain

Why first: The metadata extension and the list component are the substrate for every other v1.4 feature. Drain is the simpler of the two consume modes (no background task, no channel management) and proves out the new `ConsumeResult` shape and list component without introducing Tauri streaming complexity.

Existing scaffolding to wire up: `useResponseStore.queueDepth`, `ResponseQueuePicker` depth pill, `isLiveMode` flag.

### Phase 2: Live subscribe mode + Stop

What it addresses:
- Tauri Channel for streaming deliveries to frontend
- Background `tauri::async_runtime::spawn` consumer task (lapin `Consumer` stream)
- Consumer tag storage for cancel
- Subscribe / Stop buttons in ResponseQueuePicker
- Queue depth live refresh on timer while subscribed
- Subscribe auto-stop on disconnect / profile switch (consistent with "ephemeral lapin connections per operation" Key Decision)

Why second: Depends on the list and MessageRow from Phase 1. Introduces the async streaming complexity in isolation.

Open question resolved: Subscribe mode auto-stops on profile disconnect or profile switch — follows the existing "ephemeral lapin connections per operation" decision and prevents a dangling background task after the user switches context.

### Phase 3: Filter + Export

What it addresses:
- Filter bar (routing key substring match, content-type match)
- Export to JSON
- Export to CSV (`decoded_json` column as JSON string for nested fields)

Why third: Pure frontend work on top of the populated feed. No new Rust commands. Routing key and content-type filter predicates are applied to the feed array in the store or in a selector. Export serializes the same array.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AMQP metadata in ConsumeResult | HIGH | LOW | P1 |
| Scrollable message list + FIFO cap | HIGH | MEDIUM | P1 |
| MessageRow expand/collapse | HIGH | MEDIUM | P1 |
| Drain mode (batch up to N) | HIGH | MEDIUM | P1 |
| Queue depth refresh after drain | MEDIUM | LOW | P1 |
| Live subscribe mode + Stop | HIGH | HIGH | P1 |
| Queue depth live refresh in subscribe | LOW | LOW | P2 |
| Filter by routing key (client-side) | HIGH | MEDIUM | P2 |
| Filter by content-type (client-side) | MEDIUM | LOW | P2 |
| Export to JSON | MEDIUM | LOW | P2 |
| Export to CSV | MEDIUM | MEDIUM | P2 |
| Ack-immediately carry-forward (D-10) | HIGH | NONE | P1 (invariant) |

**Priority key:**
- P1: Must have for v1.4
- P2: Should have in v1.4, defer only if scope is tight

---

## UX Reference: Postman Streaming Message Log Pattern

The most established reference pattern for this type of tool is Postman's gRPC / WebSocket message log. Key conventions confirmed:

- **Reverse-chronological order** — newest message on top; developer sees the latest arrival without scrolling
- **Per-row expand/collapse** — each row is collapsed by default showing a one-line summary; expanding reveals full content
- **Type/direction filter dropdown** — filter visible rows by category (for v1.4: routing key prefix or content-type)
- **Text search** — substring match on message content to find a specific payload value
- **Clear** — clears displayed rows from view (messages already acked, not requeued)
- **End stream / Stop** — terminates the active consumer session
- **Connection status badge** — shows whether subscriber is active; maps to Live/Manual badge already in ResponseQueuePicker

---

## Stated Design Decisions

These are stated choices that should not be revisited during phase planning without a concrete reason:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Filter location | Client-side, applied to received feed | AMQP 0-9-1 has no broker-side selective pull from an arbitrary queue; routing key is a delivery property, not a queue-side selector |
| Ack behavior in drain and subscribe | Ack immediately (D-10 extended) | Consistent with v1.0 decision; no nack/requeue UI needed |
| CSV export nested fields | Emit `decoded_json` as a string column, not flattened dot-notation | Flattening proto oneofs and repeated fields into CSV columns is undefined; string column is lossless and practical |
| Message feed cap | FIFO-500 (oldest evicted) | Prevents memory growth; consistent with FIFO-100 precedent in message history |
| Subscribe auto-stop condition | Profile disconnect or profile switch auto-cancels consumer | Consistent with "ephemeral lapin connections per operation" Key Decision; prevents dangling background tasks |
| Tauri streaming mechanism | Channel API (not Event) | Tauri docs confirm Channel is for ordered high-throughput streaming; Event system is not designed for per-message delivery at message-stream rates |
| Consumer prefetch | Hardcoded safe default (10–50) | No tuning UI; wrong user-set value can overwhelm the app; expose only on concrete complaint |

---

## Sources

- RabbitMQ Consumers docs (basic_consume vs basic_get): https://www.cloudamqp.com/blog/rabbitmq-basic-consume-vs-rabbitmq-basic-get.html
- Lapin Consumer (Stream trait, basic_cancel, consumer tag): https://docs.rs/lapin/latest/lapin/struct.Consumer.html
- Tauri v2 Calling Frontend (emit, Channel API): https://v2.tauri.app/develop/calling-frontend/
- Postman WebSocket message log UX: https://learning.postman.com/docs/sending-requests/websocket/work-with-websocket-messages
- Postman gRPC streaming interface (reverse-chron, expand-row, filter): https://learning.postman.com/docs/sending-requests/grpc/grpc-request-interface
- RabbitGUI (spy / drain-time features): https://rabbitgui.com/blog/a-better-rabbitmq-ui
- Qu Desktop (browse, sort, export): https://qu.barbaleon.co.uk/
- RabbitMQ management plugin capabilities: https://www.rabbitmq.com/docs/management

---
*Feature research for: Advanced Response Consumer (v1.4 — Proto Sender)*
*Researched: 2026-05-20*
