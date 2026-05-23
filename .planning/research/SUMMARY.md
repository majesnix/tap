# Research Summary — Tap v1.6 Plan Runner

**Project:** Tap
**Milestone:** v1.6 Plan Runner
**Domain:** Ordered scenario runner for RabbitMQ + protobuf messaging — no comparable tool exists
**Researched:** 2026-05-23
**Confidence:** HIGH

---

## Executive Summary

Tap v1.6 adds a Plan Runner: a full-screen view where developers define ordered sequences of protobuf message sends, each with its own schema, target queue/exchange, and response-waiting config. No RabbitMQ-specific tool does this today. The closest analogues are HTTP collection runners (Postman, Hoppscotch, Bruno, Insomnia), and those define the expected UX patterns — two-panel layout, per-step status badges, Run/Pause/Stop controls, configurable inter-step delay, inline response display per step, and a run summary at completion. Where HTTP runners stop, Tap adds domain-specific value: per-step independent proto schemas, correlationId-based reply matching (RabbitMQ Tutorial 6), first-arrival wait mode, and a shared feed of all messages arriving on watched reply queues during a run.

The stack requires exactly one new direct Rust dependency: `uuid` with the `v4` feature for correlationId generation. Every other capability — multi-queue streaming, cancellation, correlationId matching via tokio oneshot, persistent state via `tauri-plugin-store`, drag-and-drop step reordering, form state — is already present in v1.5. The architecture recommendation is JS-orchestrated step execution: the frontend calls existing commands (`encode_message`, `publish_message`, `drain_messages`) sequentially with `await`, managing per-step state transitions and pause/stop flags in a new ephemeral Zustand store. The only new Rust surface is a `run_plan` / `stop_plan` command pair that manages one persistent AMQP connection per plan run (one publish channel + one consumer channel per monitored reply queue), plus a separate `PlanRunState` managed state slot so plan-run consumers do not collide with the global subscribe session.

The most critical risks cluster around the runner engine: consumer-before-publish ordering (fast replies are missed if the consumer starts after publish), selective ack semantics (non-matching correlationId replies must NACK+requeue, not ack-then-discard as the rest of the codebase does), and using a persistent connection per plan run — an intentional deviation from the "ephemeral connection per operation" Key Decision recorded in PROJECT.md that must be explicitly documented. A secondary cluster covers plan storage: `field_values` must be stored as a serialized JSON string to avoid `undefined`→`null` corruption through `JSON.stringify`, and the standard write-before-hydration race must be guarded with a `plansLoaded` flag matching the pattern in `useHistoryStore` and `useBlockStore`. Phase D (runner engine) is the highest-risk phase and needs a dedicated research pass before implementation.

---

## Key Findings

### Stack Additions (from STACK.md)

The existing v1.5 stack covers everything. One new direct Rust dependency, zero new npm packages.

**New dependency:**
- `uuid = { version = "1", features = ["v4"] }` — correlationId generation per step. Already in `Cargo.lock` as a transitive dep at v1.23.1; promoting to direct makes intent explicit. UUID v4 is required over timestamps or counters because correlation IDs must be unique across concurrent runs and not collide with leftover queue messages from prior runs.

**Existing crates covering new capabilities without modification:**

| Capability | Existing primitive |
|---|---|
| Multi-queue streaming | `tauri::ipc::Channel<T>` (Clone + Send + Sync — clone per spawned consumer task) |
| CorrelationId reply matching | `tokio::sync::oneshot` + registry `HashMap<String, oneshot::Sender<Delivery>>` |
| Per-task cancellation | `tokio_util::sync::CancellationToken` child tokens (already in subscribe.rs) |
| Task collection and stop | `tokio::task::JoinSet` (in tokio "rt" feature already enabled) |
| No-wait step delay | `tokio::time::sleep` (in tokio "time" feature already enabled) |
| Plan/step persistence | `tauri-plugin-store` + `serde` (nested struct, identical to block storage) |
| Step DnD reorder | `@dnd-kit/core` 6.x with PointerSensor (already in project) |
| Runner state | Zustand 5.x discriminated union slice |

**AMQP connection topology deviation (load-bearing note):** PROJECT.md records "Ephemeral lapin connections per operation" as a validated Key Decision. The Plan Runner is the first feature where one user action spans N publishes plus M concurrent reply-queue consumers. The correct pattern is one `lapin::Connection` per plan run, with separate AMQP channels for publish and per-queue consumption. This is an intentional deviation from the recorded Key Decision and must be documented in implementation code and in PROJECT.md when the milestone closes.

### Feature Table Stakes (from FEATURES.md)

Features users coming from Postman/Hoppscotch/Bruno/Insomnia expect. Missing any of these makes the plan runner feel incomplete.

**Must have:**
- Ordered step list with named steps — every runner shows the sequence before execution
- Run / Stop controls — all four HTTP runners have both; users expect abort capability
- Per-step execution status badge — Pending / Sending / WaitingResponse / Done / Error lifecycle
- Sequential execution (one step at a time) — all HTTP runners default to this; expected baseline
- Configurable delay between steps — messaging systems need processing time; 0ms default, 200ms suggested for RabbitMQ scenarios
- Inline response display per step — click a completed step to see what was received
- Plan CRUD (create, rename, delete) — every library-style feature in Tap has this
- Plan persistence across restarts — blocks and history both persist; plans must too
- Step drag-and-drop reorder — specified in PROJECT.md; dnd-kit pattern already established
- Step authoring (fill fields manually) — the Tap form system is the authoring UI
- Per-step target config (queue/exchange/routing key) — steps may each target different queues
- Run summary on completion — "3 of 4 steps succeeded" at a glance

### Feature Differentiators (from FEATURES.md)

Features specific to Tap's domain — not present in HTTP runners, genuinely valuable here.

**Core RabbitMQ + protobuf differentiators:**
- Per-step independent proto schema and message type — step 1 may send `CreateOrder` (orders.proto), step 2 `ConfirmPayment` (payments.proto); no HTTP runner supports this
- CorrelationId-based response matching — RabbitMQ Tutorial 6 pattern; generates UUID per step, sets `reply_to` + `correlation_id` AMQP properties, opens exclusive consumer, matches by correlationId, configurable timeout
- First-arrival wait mode — accepts first message on reply queue without correlationId matching; simpler but less precise in concurrent environments
- No-wait with configurable delay — fire-and-forget steps; advance after N ms
- Response timeout per step — configurable; 10s default; marks step Error on timeout and continues or stops per run config
- Inline decoded protobuf response — reply decoded using step's schema as the collapsible key-value tree Tap already has
- Shared response feed across watched queues — concurrent AMQP consumers merged into one chronological feed during run
- Compose step from block library — pull a saved block directly into a plan step
- Compose step from message history — import a past send as a plan step
- Pause control mid-run — inspect broker queue depth before proceeding; not present in any HTTP runner researched

**Explicitly NOT building in v1.6:**
- Pre/post-request scripts (Postman-style): PROJECT.md Out of Scope; sandboxed JS runtime is massive scope
- Variable extraction across steps: depends on scripting system; defer to v2
- Conditional branching: defer to v2; v1.6 offers Stop on Error or Continue on Error only
- Parallel step execution: PROJECT.md specifies sequential
- Iteration / data-file driven runs: depends on variable substitution; defer to v2
- Test assertions / field-level pass-fail: defer to v2; v1.6 success = ACK received + response within timeout
- Plan import/export (Postman format): defer to v2
- Direct reply-to (amq.rabbitmq.reply-to): at-most-once delivery, one consumer per channel — use named exclusive queues instead

### Architecture Decisions (from ARCHITECTURE.md)

**Decision 1: JS-orchestrated step execution.** The runner loop lives in the frontend, calling existing commands (`encode_message` → `publish_message` → reply-wait logic) sequentially with `await`. A `run_plan` / `stop_plan` Rust command pair manages the persistent AMQP connection and plan-run session state. Pause and stop are frontend flags; the JS loop checks them between steps. This avoids duplicating existing command logic in Rust and keeps pause/stop control natural in React.

**Decision 2: Separate PlanRunState managed slot.** The existing `SubscribeState` slot in `lib.rs` handles the global subscribe session. The plan runner must register a completely separate `Mutex<Option<PlanRunState>>` entry. Reusing or extending SubscribeState would cause `stop_subscribe` to also stop the plan runner.

**Decision 3: Top-level view switcher at App.tsx.** A `viewMode: "main" | "plans"` local state conditionally renders `<AppLayout />` or `<PlanView />`. No `react-router-dom` — adding a router mid-project is disruptive, and this app has exactly two views. Zustand stores persist across view switches.

**Decision 4: Two Zustand stores — persistent and ephemeral.** `usePlanStore` (persistent, `plans.json`) holds plan definitions following the `useBlockStore` pattern. `usePlanExecutionStore` (ephemeral, never persisted) holds per-run step statuses, run control state, and the shared execution feed. Ephemeral state resets on every run start and does not survive navigation.

**Decision 5: StepFieldEditor is a new isolated component — not ProtoFormRenderer.** Mounting ProtoFormRenderer inside a plan step editor routes `onValuesChange` through `useProtoStore`, polluting global proto state and breaking the main form's `resetRef` / `applyBlockRef` refs (which can only hold one instance). StepFieldEditor calls `encode_message` directly and manages its own isolated form state.

**New components required:**
`PlanView`, `PlanListPanel`, `PlanDetailPanel`, `StepList`, `StepEditor`, `StepFieldEditor`, `PlanRunnerControls`, `PlanExecutionFeed`, `HistoryPickerModal`, `BlockPickerModal`, `usePlanStore`, `usePlanExecutionStore`

**Modified files (key):**
`App.tsx` (view switcher), `Sidebar.tsx` (Plans nav button), `AppLayout.tsx` (`onNavigatePlans` prop), `src-tauri/src/lib.rs` (PlanRunState managed state), `src/lib/types.ts` (Plan, PlanStep, StepStatus types)

**Frozen / unchanged:**
`ProtoFormRenderer.tsx` (switch body frozen — plan uses StepFieldEditor), `AppLayout` DndContext (plan view has its own), `useResponseStore` (plan runner has its own ephemeral feed), `useHistoryStore` and `useBlockStore` (read-only from picker modals)

### Critical Pitfalls for v1.6 (from PITFALLS.md)

The v1.6 pitfall section (#58–75) was researched against the actual v1.5.7 source tree with specific file and line citations. Top pitfalls:

**1. Consumer must start BEFORE publish (Pitfall #59 — Critical)**
Publishing first, then opening the reply consumer means fast replies (especially on localhost) arrive before `basic_consume` is active and are missed. The step times out despite a valid reply being delivered. Required order: (1) start consumer, (2) publish with correlationId, (3) await consumer with timeout, (4) close consumer.

**2. CorrelationId-matched consumer must NACK non-matching messages (Pitfall #60 — Critical)**
The rest of the codebase uses ack-before-decode everywhere. The plan runner's correlationId consumer must NOT follow this pattern. Non-matching messages must be NACKed with `requeue: true` so later steps' replies are not permanently discarded. Only ACK after confirming `delivery.properties.correlation_id()` matches the expected value.

**3. Read `correlation_id` from AMQP properties, not headers (Pitfall #58 — Critical)**
`publish.rs` sets correlationId via `props.with_correlation_id(cid.into())`. The consumer must read it with `delivery.properties.correlation_id().as_ref().map(|s| s.to_string())`. Reading a custom header or `message_id` causes every correlationId step to time out.

**4. One persistent connection per plan run — not ephemeral per operation (Pitfall #66 — Critical)**
The "ephemeral connection per operation" Key Decision cannot apply here. A correlationId step needs its consumer alive from before publish until after reply — spanning the full step duration. Use one `lapin::Connection` per plan run with separate channels for publish and consumer. Manage via `PlanRunState` in Tauri managed state.

**5. Store `field_values` as a JSON string, not `Record<string, unknown>` (Pitfall #61 — Critical)**
`JSON.stringify` (used by tauri-plugin-store) coerces `undefined` to `null`. On reload, null values cause zod validation errors in plans that ran successfully before saving. Store `field_values` as a pre-serialized string per step — identical to the `Block.content: string` pattern in `useBlockStore.ts` line 9.

**6. Write-before-hydration race in plan store (Pitfall #62 — Critical)**
A plan mutation that fires before `loadPlans()` completes overwrites all persisted plans. Add `plansLoaded: boolean` to `usePlanStore`. Gate every write with `if (!get().plansLoaded) return`. Identical pattern in `useHistoryStore.ts` line 47 and `useBlockStore.ts` line 52.

**Additional moderate pitfalls by phase:**

| Phase | Pitfall | Mitigation |
|-------|---------|-----------|
| Storage | load() with options requires `defaults` field (#63) | Use `load(path)` with no options — follow both existing stores |
| Step editor | ProtoFormRenderer leaks into useProtoStore (#64) | Route step `onValuesChange` to isolated local state only |
| Step import | fieldValues are form values not bytes; schema drift (#65) | Merge history fieldValues onto `buildDefaultValues(stepSchema)` baseline |
| Runner | Orphaned backend on plan view navigation (#67) | useEffect cleanup calling `stop_plan()` on PlanView unmount |
| Runner | PlanRunState collides with SubscribeState (#68) | Register separate `Mutex<Option<PlanRunState>>` in lib.rs |
| Runner | Step DnD DndContext conflicts with AppLayout DnD (#69) | Mount plan-scoped DndContext inside PlanView, not AppLayout |
| Runner | Per-step timeout has no cancellation branch (#70) | Three-branch `tokio::select!`: delivery / timeout / cancellation |
| Runner | `std::thread::sleep` blocks tokio executor (#71) | `tokio::time::sleep` + select! cancellation branch |
| Runner | DescriptorPool replaced mid-run breaks response decoding (#73) | Clone pool once at plan start, hold in PlanRunState |
| Performance | Feed re-render at high message volume (#74) | FIFO cap + `React.memo` on feed row components |
| Performance | Store rewrite latency for large plans (#75) | Debounce 200ms; soft caps: 50 plans, 100 steps |

---

## Implications for Roadmap

ARCHITECTURE.md established a strict 5-phase build order (A→B→C→D→E) grounded in v1.5.7 source analysis. FEATURES.md proposed a 3-sub-phase MVP decomposition. These map onto each other:

- FEATURES Phase 1 (core runner, no response-waiting) ≈ Architecture Phases A + B + C + Phase D no-wait mode
- FEATURES Phase 2 (response waiting + DnD) ≈ Architecture Phase D correlationId/firstArrival + Phase E inline response
- FEATURES Phase 3 (composition + shared feed) ≈ Architecture Phase E shared feed + pickers

The recommended roadmap follows the strict architectural dependency order. Deviating from it risks blocked phases.

### Phase A: Plan Data Model and Persistence

**Rationale:** Zero dependencies on UI or new Rust. Unblocks every subsequent phase. Get the data contract and persistence pattern right before building anything that renders or runs.
**Delivers:** `usePlanStore` with full CRUD + `plans.json` persistence; `Plan`, `PlanStep`, `StepStatus` TypeScript types; Zod schema with `schema_version: u32` field for migration safety.
**Addresses:** Plan CRUD, plan persistence (table stakes)
**Avoids:** field_values undefined→null (#61), write-before-hydration race (#62), load() options pitfall (#63)
**Research flag:** Standard pattern — mirrors `useBlockStore` exactly. No research phase needed.

### Phase B: Plan View Shell and Navigation

**Rationale:** Depends on Phase A (needs plan list to render). No new Rust. Establishes the full-screen view without any running capability — safe to test in isolation.
**Delivers:** `App.tsx` view switcher (`viewMode: "main" | "plans"`), `PlanView` full-screen container, `PlanListPanel` (list + create/rename/delete), Plans nav button in Sidebar.
**Addresses:** Full-screen plan library view, plan CRUD UI
**Avoids:** react-router-dom mid-project (#72), DndContext scope interference — plan-scoped DndContext inside PlanView, not AppLayout (#69)
**Research flag:** Standard view-switch UI. No research phase needed.

### Phase C: Step Editor (Authoring)

**Rationale:** Depends on A + B. Steps cannot be executed until authored. Pure frontend — no new Rust — but highest UI complexity in the milestone.
**Delivers:** `StepList` with drag-and-drop reorder (plan-scoped DndContext), `StepEditor` (per-step proto picker, target config, response mode config), `StepFieldEditor` (isolated form state, calls `encode_message` directly — NOT ProtoFormRenderer), `HistoryPickerModal`, `BlockPickerModal`; step import from history and from block library.
**Addresses:** Step authoring, step DnD reorder, import from history, import from block library (table stakes + differentiators)
**Avoids:** ProtoFormRenderer leaks into useProtoStore (#64), fieldValues vs bytes confusion + schema drift (#65), DndContext scope interference (#69)
**Research flag:** StepFieldEditor design needs targeted attention — it must reproduce per-step proto loading and encoding in isolation without touching useProtoStore. Read FormPanel.tsx, useProtoStore.ts, and the encode_message command signature before designing. Consider a short pre-phase research task rather than a full research phase.

### Phase D: Plan Runner — Sequential Execution (RISKIEST PHASE)

**Rationale:** Depends on A + B + C. The only phase with new Rust code. Contains correlationId matching, consumer lifecycle, and the JS orchestration loop. ARCHITECTURE.md explicitly flags this as the riskiest phase.
**Delivers:** `usePlanExecutionStore` (ephemeral execution state), JS runner loop (encode → publish → response-wait), all three response modes (correlationId, firstArrival, noWait), per-step status badges, Run / Pause / Stop controls, run summary, `run_plan` / `stop_plan` Rust commands, `PlanRunState` managed state, one persistent AMQP connection per plan run.
**Addresses:** Sequential execution, per-step status, run controls, correlationId wait, first-arrival wait, no-wait with delay, response timeout (table stakes + differentiators)
**Avoids:** Consumer before publish ordering (#59), correlationId NACK non-matching (#60), wrong AMQP property for correlationId (#58), ephemeral connection can't hold reply consumer (#66), orphaned backend on navigation (#67), PlanRunState separate from SubscribeState (#68), three-branch select! for timeout (#70), tokio::time::sleep for delay (#71), DescriptorPool clone at plan start (#73)
**Research flag:** NEEDS `/gsd-research-phase` before implementation. The runner engine spans new Rust command pair, persistent AMQP connection management, consumer-before-publish ordering, selective ack/NACK semantics, tokio::select! three-branch pattern, CancellationToken propagation, and JS↔Rust coordination for pause/stop. Pitfalls are documented but the interaction surface warrants a dedicated pre-phase research pass.

### Phase E: Response View — Inline and Shared Feed

**Rationale:** Additive on top of Phase D. Depends on execution state and feed messages from the runner. Pure frontend — no new Rust.
**Delivers:** Inline decoded protobuf response under each step that received one (reuses existing decode tree), `PlanExecutionFeed` (shared scrollable feed of all messages from plan-scoped consumers during run), feed filtering (reuse existing FilterBar patterns), FIFO cap on plan feed messages.
**Addresses:** Inline response display per step, shared response feed across watched queues (table stakes + differentiators)
**Avoids:** Feed re-render at high message volume (#74), store rewrite latency (#75)
**Research flag:** Standard extension of existing patterns. No research phase needed.

### Phase Ordering Rationale

- Phase A is first because all other phases depend on the plan data model being defined and testable.
- Phase B before C because the step editor needs the plan shell to render in.
- Phase C before D because the runner needs steps to execute.
- Phase D before E because response display needs execution state and feed messages to exist.
- Phase D is the only phase with new Rust — centralizing all backend risk into one identifiable phase makes scope management cleaner.
- Phase E is fully additive and can be deprioritized if Phase D runs over budget without losing core runner functionality.

### Research Flags

**Needs `/gsd-research-phase`:**
- Phase D (Runner Engine): broad AMQP interaction surface, three new interaction patterns (consumer-before-publish, selective ack/NACK, persistent connection per run), new Rust command pair. PITFALLS.md documents the patterns but the interaction surface across JS loop + Rust session state + Tauri Channel routing warrants dedicated research before writing any code.

**Needs targeted pre-phase attention (not full research phase):**
- Phase C (StepFieldEditor): read FormPanel.tsx, useProtoStore.ts, and the encode_message command chain before designing the isolated step form. The key question is how to call parse_proto + encode_message in a per-step context without touching useProtoStore.

**Standard patterns (skip research phase):**
- Phase A: mirrors useBlockStore exactly — well-documented internal pattern
- Phase B: simple React view switcher — no library research needed
- Phase E: extends existing decode tree and feed components — no new patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All crates confirmed via Cargo.lock; uuid already a transitive dep; Channel Clone/Send/Sync confirmed via docs.rs; zero npm additions verified feature-by-feature against existing deps |
| Features | HIGH | HTTP runner UX patterns verified across 4 official docs; RabbitMQ RPC pattern from official Tutorial 6 + direct-reply-to docs; no comparable RabbitMQ runner tool found (gap confirmed) |
| Architecture | HIGH | Derived entirely from v1.5.7 source code — specific file paths and line numbers cited throughout; no speculation |
| Pitfalls | HIGH | v1.6 pitfall section (#58–75) grounded in v1.5.7 source with file + line citations; correlationId property path confirmed against publish.rs; ack semantics confirmed against consume.rs and subscribe.rs |

**Overall confidence: HIGH**

### Gaps to Address

- **Windows distribution support:** PROJECT.md notes Windows distribution as unresolved (no EV/OV certificate). Plan Runner does not change this, but confirm that new Tauri capability entries for plan runner commands follow the existing pattern and do not introduce Windows-specific requirements.
- **Phase 13 live-broker UAT debt:** 8 deferred live-broker UAT items from v1.4 remain open. Phase D exercises the same consume infrastructure. Track these as known pre-existing debt that may surface during Phase D testing.
- **Step count soft caps:** PITFALLS.md recommends 50 plans / 100 steps with UI warnings. Validate these thresholds against actual tauri-plugin-store write latency with realistic plan sizes during Phase A testing before hardcoding the caps.

---

## Sources

### Primary (HIGH confidence — source code + official docs)

- Tap v1.5.7 source: `src-tauri/src/commands/subscribe.rs`, `publish.rs`, `consume.rs`, `lib.rs` — architecture baseline and pitfall evidence with line numbers
- Tap v1.5.7 source: `src/stores/useBlockStore.ts`, `useHistoryStore.ts`, `useResponseStore.ts` — persistence and store patterns
- Tap v1.5.7 source: `src/components/layout/AppLayout.tsx`, `App.tsx`, `FormPanel.tsx` — component tree and frozen contracts
- `tauri::ipc::Channel` Clone + Send + Sync: https://docs.rs/tauri/latest/tauri/ipc/struct.Channel.html
- `lapin::Consumer` Stream impl (Context7 verified): https://docs.rs/lapin/latest/src/lapin/consumer.rs.html
- RabbitMQ RPC Tutorial 6: https://www.rabbitmq.com/tutorials/tutorial-six-go
- RabbitMQ Direct Reply-To: https://www.rabbitmq.com/docs/direct-reply-to
- tokio feature flags: https://docs.rs/tokio/latest/tokio/#feature-flags
- uuid v1 crate: https://docs.rs/uuid/latest/uuid/

### Secondary (HIGH confidence — official third-party docs)

- Postman Collection Runner: https://learning.postman.com/docs/collections/running-collections/intro-to-collection-runs/
- Hoppscotch Runner: https://docs.hoppscotch.io/documentation/features/runner
- Insomnia Collection Runner: https://developer.konghq.com/how-to/use-the-collection-runner/
- Bruno Collection Runner (DeepWiki): https://deepwiki.com/usebruno/bruno/3.5-collection-runner
- Spring AMQP Request/Reply timeout reference: https://docs.spring.io/spring-amqp/reference/amqp/request-reply.html
- tokio-util CancellationToken: https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html

---

*Research completed: 2026-05-23*
*Ready for roadmap: yes*
