# Feature Landscape: Plan Runner (v1.6)

**Domain:** Scenario/collection runner for developer messaging tools (RabbitMQ + protobuf)
**Researched:** 2026-05-23
**Downstream consumer:** Requirements author

---

## Research Basis

No direct RabbitMQ-specific sequence/plan runner tool exists in the ecosystem. The RabbitMQ tooling landscape for this use case is: PerfTest (load/throughput testing), RabbitTestTool (correctness experiments at scale), and GUI tools like RabbitGUI / Qu Desktop (inspection and dead-letter management) — none provide an ordered scenario runner with request-reply tracking. Tap is building into a genuine gap.

The closest comparables are HTTP API collection runners: Postman Collection Runner, Hoppscotch Runner, Insomnia Collection Runner, and Bruno Collection Runner. These are the primary UX pattern reference base. All research below treats those as analogues, adjusted for the RabbitMQ + protobuf domain.

**Confidence:** HIGH for HTTP runner UX patterns (Postman/Hoppscotch/Insomnia/Bruno all verified via official docs). HIGH for RabbitMQ RPC/correlationId pattern (RabbitMQ official tutorial + direct-reply-to docs). LOW for "what RabbitMQ-specific tools do" — confirmed sparse, none found with this capability.

---

## Existing Tap Features (Dependencies Map)

Every plan runner capability builds on already-shipped Tap features. The requirements author must not re-specify these; they are integration points only.

| Plan Runner Need | Existing Tap Feature | Phase |
|---|---|---|
| Per-step proto schema + message type selection | Multi-file proto tabs | Phase 03 (v1.0) |
| Per-step field value entry | Dynamic form + JSON override toggle | Phase 01 (v1.0), Phase 08 (v1.2) |
| Compose step from saved message | Block library (pull a block into a step) | Phase 11 (v1.3) |
| Compose step from past send | Message history + replay | Phase 03 (v1.0) |
| Per-step target queue/exchange + routing key | PublishBar + routing key autocomplete | Phase 02 (v1.0), Phase 09 (v1.3) |
| Per-step AMQP properties (correlationId, reply-to) | AMQP properties sheet | Phase 03 (v1.0) |
| Delivery confirmation per step | Publisher confirms badge | Phase 10 (v1.3) |
| Wait for reply on a queue | Live subscribe (Tauri Channel streaming) | Phase 14 (v1.4) |
| Decode response payload | Protobuf decode tree + hex viewer | Phase 04 (v1.0) |
| Shared response feed across watched queues | Feed filtering + scrollable feed | Phase 15 (v1.4) |
| Plan persistence to disk | tauri-plugin-store (blocks, history, theme use it) | Phase 11 (v1.3) |
| Step drag-and-drop reorder | dnd-kit PointerSensor pattern | Phase 12 (v1.3) |

---

## Table Stakes

Features users coming from Postman/Insomnia/Bruno will expect. Missing = plan runner feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependency on Existing Feature |
|---|---|---|---|
| **Ordered step list with named steps** | Every runner shows the execution sequence before the run starts | Low | None new — UI list component |
| **Run / Stop controls** | Postman, Hoppscotch, Bruno, Insomnia all have Run + Stop. Users must be able to abort failed or slow runs. | Low | None new |
| **Per-step execution status badge** | Pending -> Sending -> (WaitingResponse) -> Done / Error. Bruno uses spinner/green-check/red-X. Users need at-a-glance run progress. | Low | None new |
| **Sequential execution (one step at a time)** | All HTTP runners default to sequential; users expect this as the baseline before considering parallel | Low | None new |
| **Configurable delay between steps** | Postman, Hoppscotch, Insomnia, Bruno all offer millisecond delay between requests. Required when the target system needs processing time before the next message. | Low | None new |
| **Inline response display per step** | After execution, clicking a step shows what was received. Users need to inspect what came back without leaving the run view. | Medium | Existing decode tree + hex viewer (Phase 04) |
| **Plan CRUD: create, rename, delete** | Every library feature in Tap has this (block library is the pattern precedent). | Low | Block library CRUD pattern (Phase 11) |
| **Plan persistence (survives app restart)** | Block library and message history both persist. Plans must too. | Low | tauri-plugin-store already in use |
| **Step reorder via drag-and-drop** | PROJECT.md explicitly specifies this; dnd-kit pattern already established in Tap | Medium | dnd-kit PointerSensor (Phase 12) |
| **Step authoring: fill fields manually** | The Tap form system is the authoring UI. A step is a saved form state + target + wait config. | Medium | Dynamic form + JSON override (Phase 01, 08) |
| **Per-step target configuration (queue/exchange/routing key)** | Steps in a multi-step scenario may each target different queues — this is the core value over single-message send | Low | PublishBar + queue picker (Phase 02) |
| **Run summary on completion** | Postman shows pass/fail counts. Users need "3 of 4 steps succeeded" at a glance after the run. | Low | None new |

---

## Differentiators

Features that only make sense in Tap's domain (RabbitMQ + protobuf + dev-tool). Not present in HTTP runners, but genuinely valuable here.

| Feature | Value Proposition | Complexity | Dependency |
|---|---|---|---|
| **Per-step independent proto schema + message type** | HTTP runners share one endpoint schema. RabbitMQ steps may each use a different proto file and message type — e.g., step 1 sends CreateOrder (orders.proto), step 2 sends ConfirmPayment (payments.proto). No HTTP runner supports this. | High | Multi-file proto tabs (Phase 03); requires per-step proto context isolated from the global active tab |
| **CorrelationId-based response matching** | Waits on a reply queue and matches the response by correlationId (RabbitMQ Tutorial 6 pattern). Advances step only when the matched reply arrives. Requires: auto-generate UUID correlationId per step, set reply-to queue, open an AMQP consumer on that queue, filter by correlationId, timeout guard. | High | Live subscribe / Tauri Channel (Phase 14); AMQP properties sheet (Phase 03); publisher confirms (Phase 10) |
| **First-arrival wait mode** | Waits for whatever message arrives first on a named reply queue, without correlationId matching. Useful when the system under test does not echo back a correlationId. Simpler but less precise in concurrent environments. | Medium | Live subscribe / Tauri Channel (Phase 14) |
| **No-wait with configurable delay** | Send and don't wait for a response; advance after N ms. Required for fire-and-forget steps (e.g., "publish an event, wait 500ms, then send the next"). | Low | None new beyond configurable delay |
| **Response timeout per step** | Each wait-for-response step needs a user-configurable timeout (10s default; Spring AMQP uses 30s). After timeout: mark step Error and continue or stop. | Medium | None new — Rust timeout via tokio time |
| **Inline decoded protobuf response** | Received reply decoded using the step's matching proto schema, shown as the collapsible key-value tree Tap already has. HTTP runners show raw JSON/text. Tap shows structured proto fields. | Medium | Decode tree + hex viewer (Phase 04) |
| **Shared response feed across all watched queues** | During a plan run, all reply queues being monitored stream into a single chronological feed — enables seeing cross-step message flow in one place. | High | Feed filtering + live subscribe (Phase 14, 15); requires concurrent multi-queue AMQP consumers merged into one feed |
| **Compose step from block library** | Pull a saved block (pre-filled message) directly into a plan step. No HTTP runner has a block library concept. | Medium | Block library drag-and-drop (Phase 12) |
| **Compose step from message history** | Import a past send as a plan step — "replay this exact message as step 3." | Medium | Message history replay (Phase 03) |
| **Plan duplicate** | Clone an existing plan and modify for a variation test. | Low | None new |
| **Per-step delivery confirmation badge** | Each step shows its publish outcome (ACK/NACK/Returned/Timeout) inline, using the existing confirms badge pattern. | Low | Publisher confirms badge (Phase 10) |
| **Pause control mid-run** | Pause after the current step completes, inspect state, then resume. Not present in any HTTP runner researched. Uniquely useful in messaging: pausing lets the developer check broker queue depth before proceeding. | Medium | None new beyond run-state machine |

---

## Anti-Features

Features to explicitly NOT build in v1.6. Many are Postman capabilities; excluding them keeps scope manageable and aligns with the PROJECT.md Out of Scope declaration ("Request scripting / automation — Postman-style scripting adds scope without core value").

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Pre-request / post-response scripts (JavaScript)** | PROJECT.md Out of Scope. Scripting requires a sandboxed JS runtime, massive scope expansion, and ongoing maintenance surface. | Use declarative fields only. Auto-generated UUID correlationId covers the most common scripting use case (dynamic ID injection). |
| **Variable/environment substitution across steps** | Extracting a field from step 1's response and injecting it into step 2's payload requires scripting (pm.environment.set) or a template engine. Both depend on the scripting system excluded above. | Defer to v2. Step payloads are static in v1.6. |
| **Conditional branching (if-step-fails-go-to)** | Postman's postman.setNextRequest() allows skipping or jumping to any step. Complex control flow is a scripting primitive — not declarative. | v1.6 offers two options only: Stop on Error (halt run) or Continue on Error (mark Error, keep going). These cover ~95% of dev-tool use cases. |
| **Parallel / concurrent step execution** | PROJECT.md specifies sequential execution. Concurrent steps create non-deterministic response matching and more complex state management. | Sequential only in v1.6. |
| **Iteration / data-file driven runs** | Postman's multi-iteration with CSV/JSON data file requires the variable substitution system excluded above. | Defer to v2. Single-pass run only in v1.6. |
| **Test assertions / field-level pass-fail criteria** | Postman's pm.test() is a full test framework. v1.6 success means: message sent (ACK received) + response arrived within timeout. No field-level assertion. | Defer to v2. |
| **Plan import/export (Postman collection format)** | Mapping Postman's JSON schema to Tap's proto-centric model requires significant translation work for limited benefit. | Defer to v2. Plans are Tap-native only in v1.6. |
| **Scheduled runs / monitors** | Tap is a desktop dev tool, not a monitoring service. Scheduled execution requires a background daemon. | Out of scope indefinitely. |
| **Shared/team plans (cloud sync)** | PROJECT.md: each developer manages their own data locally. Cloud sync requires auth infrastructure. | Out of scope. Plans are local like profiles and blocks. |
| **Auto-retry on error** | Auto-retry adds non-determinism to scenario replay in a messaging context. Dev tools benefit from explicit user control. | Manual: user fixes the issue and hits Run again. |
| **Direct reply-to (amq.rabbitmq.reply-to) as default** | The amq.rabbitmq.reply-to pseudo-queue has at-most-once delivery, limits one consumer per channel, and provides no observable queue for debugging. | Use named exclusive reply queues (user specifies a queue name, or Tap auto-generates one per run). Tap's existing queue picker handles this. |

---

## Feature Dependencies (Execution Order Constraints)

```
Plan CRUD (create / rename / duplicate / delete)
  └─ Plan persistence (tauri-plugin-store)
       └─ Step editor (per-step: schema + target + wait config)
            ├─ Proto schema + type selection  -> multi-file proto tabs (Phase 03)
            ├─ Field values                   -> dynamic form + JSON override (Phase 01, 08)
            ├─ Target picker                  -> PublishBar + queue list (Phase 02)
            ├─ Import from block              -> block library (Phase 11)
            └─ Import from history            -> message history (Phase 03)

Plan runner execution
  ├─ Sequential send loop     -> publisher confirms + AMQP properties (Phase 10, 03)
  ├─ CorrelationId-wait mode  -> live subscribe / Tauri Channel (Phase 14)
  ├─ First-arrival-wait mode  -> live subscribe / Tauri Channel (Phase 14)
  ├─ No-wait mode             -> no new dependency
  └─ Shared response feed     -> feed filtering + multi-queue subscribe (Phase 14, 15)

Step DnD reorder              -> dnd-kit PointerSensor (Phase 12)
```

---

## UX Patterns from Comparable Tools

### Execution View Layout (synthesized from Postman, Hoppscotch, Bruno, Insomnia)

All four tools use a two-panel pattern during execution:

- **Left / top panel:** Ordered step list. Each item shows step name and per-step status badge (idle / spinner / green-check / red-X). The active step is highlighted. Clicking a completed step reveals its detail.
- **Right / bottom panel:** Detail view for the selected step — sent payload, received response (if any), timing, status reason.

During a run, the list scrolls to follow the active step. After completion, all steps remain visible with final statuses; the user can click any step to review it.

### Per-Step Status Lifecycle

Derived from Bruno (most explicit in docs) and Postman behaviour:

```
Pending -> Sending -> [WaitingResponse] -> Done
                                       -> Error (timeout / NACK / Returned / connection failure)
```

"Pending" is the pre-run idle state. "Sending" is active publish. "WaitingResponse" is the correlationId or first-arrival wait (absent in no-wait steps). "Done" means message ACKed (and response received, if configured). "Error" shows inline with a reason string.

### Run Controls Pattern

All four HTTP runner tools provide Run + Stop. Hoppscotch adds Restart (same config) and New Run (reconfigure). Postman adds Run Again. PROJECT.md specifies Run / Pause / Stop — "Pause" is not in any HTTP runner researched. It is a Tap-specific addition: pausing mid-run lets the developer inspect broker queue depth or decoded responses before proceeding. Architecturally this means the execution loop checks a pause-gate flag between steps.

### Delay Between Steps

All four HTTP runners offer millisecond delay between requests (Postman labels it "Delay"). For Tap this is especially important: messaging systems commonly need 200-500ms for downstream consumers to process a message before the next step's probe arrives. Default of 0ms is acceptable; 200ms is a sensible suggested default for RabbitMQ scenarios.

### Response Persistence Per Step

Postman makes response persistence optional ("may impact performance for large collections"). For Tap, responses should always be stored per step for the duration of the run — the dataset is small (one decoded protobuf per step) and dev-tool users need to review every response inline after the run completes.

### Multi-Queue Simultaneous Monitoring

No RabbitMQ GUI tool found with explicit multi-queue side-by-side streaming. The RabbitMQ Management Console shows all queues in a table (message counts, rates) but not concurrent live message feeds. Tap's plan runner shared feed pattern is novel: during a run, open concurrent AMQP consumers on each reply queue configured across the plan's steps, and stream all arriving messages into a single chronological feed. Architecturally this extends Phase 14's single-queue Tauri Channel pattern to N channels merged into one feed component.

### CorrelationId Request-Reply Pattern (RabbitMQ Tutorial 6)

Standard pattern confirmed by official RabbitMQ docs and Spring AMQP reference:

1. For each step, generate a UUID correlationId.
2. Set correlation_id and reply_to in AMQP message properties (both already exist in Tap's AMQP sheet, Phase 03).
3. Open an exclusive consumer on the reply queue named in reply_to.
4. Publish the message (awaiting publisher ACK via existing confirms system, Phase 10).
5. Consumer receives messages on the reply queue; discards any whose correlation_id does not match.
6. On match: decode response, mark step Done, close consumer.
7. On timeout: mark step Error with reason "Response timeout after Xs", close consumer.

**First-arrival mode** skips step 5's correlationId check — the first message on the reply queue is accepted. Simpler but unsafe if multiple concurrent requests share a reply queue.

**Direct reply-to note:** amq.rabbitmq.reply-to eliminates queue declaration but has at-most-once delivery and one-consumer-per-channel limits. Use named exclusive queues instead for observability.

---

## MVP Recommendation

### Phase 1 of v1.6: Core Plan Runner (no response-waiting)

1. Plan CRUD (create, rename, duplicate, delete) with tauri-plugin-store persistence
2. Full-screen Plan Library view, analogous to block library but for plans
3. Step editor: per-step proto schema + message type, field values (reuse existing form), target queue/exchange, no-wait mode with delay config
4. Plan runner: sequential execution, no-wait mode only, Run/Stop controls, per-step Pending -> Sending -> Done/Error status badges
5. Run summary (N of M steps succeeded)

This delivers working end-to-end plan execution with zero new response-waiting infrastructure.

### Phase 2 of v1.6: Response Waiting + Step DnD

6. CorrelationId-based wait mode: auto-generate UUID, set AMQP properties, open reply-queue consumer, match by correlationId, configurable timeout
7. First-arrival wait mode: simpler variant of the above
8. Inline decoded protobuf response per step (reuse existing decode tree)
9. Step DnD reorder (dnd-kit PointerSensor, same pattern as Phase 12)
10. Pause/Resume control

### Phase 3 of v1.6: Composition + Shared Feed

11. Shared response feed (concurrent multi-queue AMQP consumers merged into one feed during run)
12. Compose step from block library
13. Compose step from message history

### Defer to v2

- Variable extraction and chaining between steps
- Iteration / data-file driven runs
- Test assertions / field-level pass-fail criteria
- Plan import/export
- Conditional branching

---

## Sources

- Postman Collection Runner: https://learning.postman.com/docs/collections/running-collections/intro-to-collection-runs/
- Hoppscotch Runner docs: https://docs.hoppscotch.io/documentation/features/runner
- Insomnia / Kong Collection Runner: https://developer.konghq.com/how-to/use-the-collection-runner/
- Bruno Collection Runner (DeepWiki): https://deepwiki.com/usebruno/bruno/3.5-collection-runner
- RabbitMQ RPC Tutorial 6 (Go): https://www.rabbitmq.com/tutorials/tutorial-six-go
- RabbitMQ Direct Reply-To docs: https://www.rabbitmq.com/docs/direct-reply-to
- Spring AMQP Request/Reply (timeout reference): https://docs.spring.io/spring-amqp/reference/amqp/request-reply.html
- RabbitMQ Management UI: https://www.rabbitmq.com/docs/management
- RabbitGUI: https://rabbitgui.com/
