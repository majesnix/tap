# Roadmap: Tap

**Last Milestone:** v1.6 Plan Runner — SHIPPED 2026-05-24
**Current:** v1.7 Block Apply Completeness + History Search — Roadmap created 2026-05-25

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-05-18)
- ✅ **v1.1 Dark Mode** — Phase 5 (shipped 2026-05-18)
- ✅ **v1.2 Form Improvements** — Phases 6–8 (shipped 2026-05-19)
- ✅ **v1.3 Publishing UX + Message Blocks** — Phases 9–12 (shipped 2026-05-20)
- ✅ **v1.4 Response Stream** — Phases 13–15 (shipped 2026-05-21)
- ✅ **v1.5 Distribution** — Phases 16–18 (shipped 2026-05-23)
- ✅ **v1.6 Plan Runner** — Phases 19–23 (shipped 2026-05-24)
- 🚧 **v1.7 Block Apply Completeness + History Search** — Phases 24–26 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-05-18</summary>

- [x] **Phase 1: Proto Parsing + Form** — 6/6 plans — completed 2026-05-17
- [x] **Phase 2: Connect + Publish** — 6/6 plans — completed 2026-05-17
- [x] **Phase 3: Full Feature Set** — 4/4 plans — completed 2026-05-18
- [x] **Phase 4: Response Queue Reader** — 2/2 plans — completed 2026-05-18

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.1 Dark Mode (Phase 5) — SHIPPED 2026-05-18</summary>

- [x] **Phase 5: Dark Mode** — 3/3 plans — completed 2026-05-18

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.2 Form Improvements (Phases 6–8) — SHIPPED 2026-05-19</summary>

- [x] **Phase 6: BytesField** — 1/1 plans — completed 2026-05-19
- [x] **Phase 7: MapField** — 4/4 plans — completed 2026-05-19
- [x] **Phase 8: JSON Override Toggle** — 2/2 plans — completed 2026-05-19

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.3 Publishing UX + Message Blocks (Phases 9–12) — SHIPPED 2026-05-20</summary>

- [x] **Phase 9: Routing Key Autocomplete** — 3/3 plans — completed 2026-05-19
- [x] **Phase 10: Publisher Confirms Badge** — 2/2 plans — completed 2026-05-19
- [x] **Phase 11: Block Library — Store, Editor, Persistence** — 3/3 plans — completed 2026-05-19
- [x] **Phase 12: Block Library — Drag-and-Drop Layer** — 3/3 plans — completed 2026-05-20

See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.4 Response Stream (Phases 13–15) — SHIPPED 2026-05-21</summary>

- [x] **Phase 13: Message Feed Foundation + Drain Mode** — 3/3 plans — completed 2026-05-20
- [x] **Phase 14: Live Subscribe Mode** — 3/3 plans — completed 2026-05-21
- [x] **Phase 15: Filter + Export** — 1/1 plans — completed 2026-05-21

See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.5 Distribution (Phases 16–18) — SHIPPED 2026-05-23</summary>

- [x] **Phase 16: Pipeline Foundation** — 2/2 plans — completed 2026-05-21
- [x] **Phase 17: macOS Signing + Notarization** — 2/2 plans — completed 2026-05-23
- [x] **Phase 18: Auto-Update + Linux + Docs** — 4/4 plans — completed 2026-05-23

See [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.6 Plan Runner (Phases 19–23) — SHIPPED 2026-05-24</summary>

- [x] **Phase 19: Plan Data Model and Persistence** — Type contract, `usePlanStore` CRUD, `plans.json` persistence — no UI (completed 2026-05-23)
- [x] **Phase 20: Plan View Shell and Navigation** — Full-screen plan library view, plan list panel, CRUD UI, nav button (completed 2026-05-23)
- [x] **Phase 21: Step Editor (Authoring)** — Step authoring, drag-and-drop reorder, import from history + block library (completed 2026-05-23)
- [x] **Phase 22: Plan Runner — Sequential Execution** — JS runner loop, all three response modes, run controls, new Rust commands (completed 2026-05-24)
- [x] **Phase 23: Response View — Inline and Shared Feed** — Decoded response per step, shared scrollable plan execution feed (completed 2026-05-24)

See [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

### v1.7 Block Apply Completeness + History Search (Phases 24–26) — IN PROGRESS

- [x] **Phase 24: History Full-Text Search** - Search bar across type name, target, and field names; AND logic with existing filters (completed 2026-05-25)
- [ ] **Phase 25: Block Apply — WKT + Map Empty Case** - Two-phase applyBlockRef architecture; WKT fill and empty-map replace
- [ ] **Phase 26: Block Apply — Conflict Prompt + Oneof** - Batched conflict dialog; map collision; oneof branch-switch

---

## Phase Details

### Phase 13: Message Feed Foundation + Drain Mode

**Goal**: Users can drain messages from a queue and see them all in a scrollable, expandable list with full AMQP metadata and queue depth
**Depends on**: Phase 12
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04, CONS-08
**Success Criteria** (what must be TRUE):

  1. User can see routing key, exchange, content-type, and timestamp on each consumed message row in the list
  2. User can expand any message row to reveal the decoded protobuf payload and raw hex
  3. User can drain up to N messages from a queue in one shot and see all of them appear in the list
  4. User can see the current queue message count before clicking drain, and the count updates after draining
  5. The list displays newest messages at the top and older messages are dropped when the list reaches capacity
  6. User can select one or more candidate message types for decoding; the first type that decodes without error is used and shown on each row

**Plans**: 3 plans
Plans:

- [x] 13-01-PLAN.md — Rust drain_messages command + TypeScript IPC contract (DrainResult, DrainOutcome, FeedMessage types; drainMessages() IPC function)
- [x] 13-02-PLAN.md — Accordion install + ResponseHexSection props refactor (TS compilation bridge)
- [x] 13-03-PLAN.md — Store evolution + Drain UI + MessageFeedTab/Row + test migration

**UI hint**: yes

### Phase 14: Live Subscribe Mode

**Goal**: Users can start a persistent subscribe session that streams messages into the feed continuously until they stop it, with a visible status badge and automatic shutdown on profile change
**Depends on**: Phase 13
**Requirements**: CONS-05, CONS-06, CONS-07
**Success Criteria** (what must be TRUE):

  1. User can click Start and messages published to the selected queue arrive in the feed in real time without manual polling
  2. User can click Stop and the stream halts cleanly with no further messages arriving
  3. User can see a status badge showing Running, Stopping, Idle, or Error reflecting the current subscribe state
  4. When the user switches to a different connection profile, any running subscribe session stops automatically

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 14-01-PLAN.md — Rust backend: Cargo.toml changes + subscribe.rs (SubscribeState, start_subscribe, stop_subscribe) + lib.rs + mod.rs wiring
- [x] 14-02-PLAN.md — Frontend foundation: SubscribeStatus type + IPC wrappers + useResponseStore extensions + toggle-group.tsx

**Wave 2**

- [x] 14-03-PLAN.md — UI integration: SubscribePanel + MessageFeedTab mode toggle + ResponseQueuePicker mode prop

**UI hint**: yes

### Phase 15: Filter + Export

**Goal**: Users can narrow the message feed by routing key or content-type and export the current feed to a JSON file
**Depends on**: Phase 14
**Requirements**: FILT-01, FILT-02, XPRT-01
**Success Criteria** (what must be TRUE):

  1. User can type a routing key substring and the feed list narrows to only matching messages without clearing the underlying data
  2. User can select a content-type from a dropdown and the feed shows only messages with that content-type
  3. User can click Export and receive a JSON file containing all messages currently visible in the feed

**Plans**: 1 plan
Plans:

- [x] 15-01-PLAN.md — Tauri capability permissions + filter state/visibleMessages/export handler in MessageFeedTab + tests

**UI hint**: yes

### Phase 19: Plan Data Model and Persistence

**Goal**: The plan data contract is defined, testable, and persists correctly — every subsequent phase builds on this foundation
**Depends on**: Nothing (first phase of v1.6 milestone)
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):

  1. `usePlanStore` create / rename / delete / duplicate operations round-trip through `plans.json` and reload correctly after app restart
  2. Hydration gate (`plansLoaded` flag) prevents any write operation from executing before the store has loaded from disk — identical pattern to `useHistoryStore` and `useBlockStore`
  3. `Plan`, `PlanStep`, and `StepStatus` TypeScript types are defined with a `schema_version` field for migration safety
  4. `field_values` stored as a serialized JSON string per step (not `Record<string, unknown>`) so `undefined` to `null` coercion cannot corrupt saved plans

**Plans**: 1 plan
Plans:

- [x] 19-01-PLAN.md — Plan/PlanStep/StepStatus types in lib/types.ts + usePlanStore CRUD + plans.json persistence + tests (Complete 2026-05-23)

### Phase 20: Plan View Shell and Navigation

**Goal**: Users can access a dedicated full-screen plan library view, see their plans listed, and perform all plan CRUD actions from the UI
**Depends on**: Phase 19
**Requirements**: PLAN-06
**Success Criteria** (what must be TRUE):

  1. A Plans nav button in the sidebar switches the entire app to a full-screen plan library view (`viewMode: "main" | "plans"` switcher at `App.tsx`) without a route change
  2. The plan list panel shows all saved plans; user can create, rename, duplicate, and delete plans (with confirmation dialog on delete) from this view
  3. Navigating back to the main form and returning to the plan view preserves plan list state; Zustand stores persist across view switches

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 20-01-PLAN.md — PlanView + PlanListPanel + PlanDetailPanel components (dropdown-menu install, inline CRUD, kebab menu, AlertDialog)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02-PLAN.md — App.tsx viewMode state + loadPlans at mount + conditional render; AppLayout/Sidebar prop threading; Plans nav button

**UI hint**: yes

### Phase 21: Step Editor (Authoring)

**Goal**: Users can fully author plan steps — composing field values, picking targets, configuring response modes, reordering, and importing from history or blocks
**Depends on**: Phase 20
**Requirements**: STEP-01, STEP-02, STEP-03, STEP-04, STEP-05, STEP-06
**Success Criteria** (what must be TRUE):

  1. User can add a step to a plan: select a `.proto` file and message type, fill field values using an isolated step form editor (StepFieldEditor — not ProtoFormRenderer), choose a target queue/exchange and routing key, and set a response mode (no-wait / correlationId / first-arrival)
  2. User can import a step from message history — the step form pre-fills with field values from the selected past send
  3. User can import a step from the block library — the step form pre-fills with field values from the selected saved block
  4. User can rename, duplicate, and delete individual steps within a plan
  5. User can reorder steps via drag-and-drop within the plan detail panel (plan-scoped DndContext, not AppLayout DndContext)

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 21-01-PLAN.md — usePlanStore step actions (addStep/updateStep/deleteStep/duplicateStep/reorderSteps) + HistoryEntry.protoPath + PublishBar protoPath capture

**Wave 2**

- [x] 21-02-PLAN.md — @dnd-kit/sortable install + PlanDetailPanel sub-split + StepListPanel (DnD, inline rename, AlertDialog) + StepFieldEditor stub

**Wave 3** *(parallel with each other, blocked on Wave 2)*

- [x] 21-03-PLAN.md — StepFieldEditor full implementation (isolated form, auto-save debounce, field primitives, target + response mode sections)
- [x] 21-04-PLAN.md — StepHistoryPicker + StepBlockPicker + wire into StepListPanel

**UI hint**: yes

### Phase 22: Plan Runner — Sequential Execution

**Goal**: Users can run a plan end-to-end — steps execute sequentially with live status feedback, all three response modes work correctly, and the run can be stopped at any time
**Depends on**: Phase 21
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RESP-01, RESP-02, RESP-03
**Success Criteria** (what must be TRUE):

  1. User can press Run on a plan and watch steps execute sequentially, each step transitioning through Pending → Sending → WaitingResponse (if applicable) → Done / Error status badges in real time
  2. No-wait steps fire the publish and advance after the configured per-step delay (default 200 ms; 0 = immediate) — no reply consumer opened
  3. CorrelationId steps publish with a generated UUID `correlation_id` + `reply_to` AMQP property, open a consumer before publishing, and match the reply; step gets Error status if no matching reply arrives within the configured timeout (default 10 s)
  4. First-arrival steps open a consumer on the specified reply queue and accept the first message that arrives; step gets Error status on timeout (default 10 s)
  5. User can stop a running plan at any time; the run halts cleanly and the backend plan-run session is torn down
  6. A run summary is shown on completion: how many steps succeeded and how many failed; per-plan stop-on-error vs continue-on-error setting is respected

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 22-01-PLAN.md — TypeScript foundation: Plan type + IPC wrappers + updatePlan store action
- [x] 22-02-PLAN.md — Rust backend: execute_step (3 response modes) + cancel_plan_run + PlanRunState

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-03-PLAN.md — Execution store + usePlanRunner hook + StepStatusBadge component

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-04-PLAN.md — UI integration: PlanRunBar + PlanDetailPanel + StepListPanel step badges

**Research**: Strongly recommend `/gsd-discuss-phase 22` before `/gsd-plan-phase 22` — riskiest phase in the milestone. Only phase with new Rust code (`run_plan` / `stop_plan` commands, `PlanRunState` managed state, one persistent AMQP connection per plan run — intentional deviation from the "ephemeral connection per operation" Key Decision in PROJECT.md). Critical pitfalls: consumer-must-start-before-publish ordering (#59), selective NACK for non-matching correlationId replies (#60), read `correlation_id` from AMQP properties not headers (#58), separate `PlanRunState` slot from `SubscribeState` (#68), three-branch `tokio::select!` for timeout/delivery/cancellation (#70).
**UI hint**: yes

### Phase 23: Response View — Inline and Shared Feed

**Goal**: Users can see decoded protobuf responses inline under each step that received one, and monitor all messages arriving on watched reply queues in a single chronological feed
**Depends on**: Phase 22
**Requirements**: RESP-04, RESP-05
**Success Criteria** (what must be TRUE):

  1. Steps that received a reply show the decoded protobuf response inline below the step — collapsible key-value tree reusing the existing response decode component
  2. A shared scrollable feed shows all messages arriving on watched reply queues during the plan run in chronological order
  3. The feed is FIFO-capped to prevent unbounded memory growth at high message volume

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 23-01-PLAN.md — usePlanExecutionStore extension (stepReplies, planReplyFeed, paneMode) + usePlanRunner reply dispatch

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — New components: StepReplyView + PlanReplyFeedTab

**Wave 3** *(blocked on Waves 1 and 2)*

- [x] 23-03-PLAN.md — UI integration: PlanDetailPanel tab strip + StepListPanel reply dot and toggle

**UI hint**: yes

### Phase 24: History Full-Text Search

**Goal**: Users can search across history entries by typing a query that matches message type name, queue/exchange target, or field names — in addition to the existing type and target filter controls
**Depends on**: Nothing (independent of block apply phases; first phase of v1.7 milestone)
**Requirements**: HIST-FT-01, HIST-FT-02, HIST-FT-03, HIST-FT-04, HIST-FT-05, HIST-FT-06, HIST-FT-07
**Success Criteria** (what must be TRUE):

  1. A search input appears in the history panel alongside the existing message type and target filter controls — typing in it immediately narrows the visible entry list
  2. Typing a query matches history entries whose message type name contains the query (case-insensitive substring)
  3. Typing a query matches history entries whose queue/exchange target contains the query (case-insensitive substring)
  4. Typing a query matches history entries whose field names (keys in `fieldValues`) contain the query; `_selected` discriminator keys and RHF internal fields are excluded from matching
  5. The search filter works together with the existing type and target filters using AND logic — narrowing all three simultaneously further reduces results
  6. An empty search query returns the full unfiltered list; the "X of Y messages" count label updates to reflect the current combined filter result
**Plans**: 2 plans
Plans:

**Wave 1**

- [x] 24-01-PLAN.md — collectFieldNames helper + filterHistoryEntries searchQuery extension (TDD)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-02-PLAN.md — HistoryFilterBar search row + MessageHistoryPanel state wiring

**UI hint**: yes

### Phase 25: Block Apply — WKT + Map Empty Case

**Goal**: Users can apply a block to WellKnownType fields and to empty map fields — the two-phase plan/commit architecture is in place and the dirty-field guard works correctly for these field types
**Depends on**: Phase 24 (independent, but Phase 24 ships first per milestone ordering)
**Requirements**: BLK-EXT-01, BLK-EXT-02, BLK-EXT-07
**Success Criteria** (what must be TRUE):

  1. Dragging a block onto the form fills WellKnownType fields (Timestamp, Duration) that were empty; fields that already have user-entered values are left unchanged
  2. Dragging a block onto the form replaces an entirely empty map field with the block's map rows; the replacement is visible immediately as rendered key-value rows
  3. A second block drag after form values exist does not silently overwrite already-filled WKT or scalar fields — the dirty-field guard still applies for any subsequent drops
  4. The block apply logic is separated into a pure plan step (returns what would change and what conflicts exist) and a commit step (writes to form) — enabling the conflict dialog in Phase 26 without duplicating logic
**Plans**: TBD
**UI hint**: yes

### Phase 26: Block Apply — Conflict Prompt + Oneof

**Goal**: Users see a single batched dialog listing all conflicts when a block targets fields that already have values or requires a oneof branch switch; they can choose to overwrite or skip each conflict before values are applied
**Depends on**: Phase 25
**Requirements**: BLK-EXT-03, BLK-EXT-04, BLK-EXT-05, BLK-EXT-06
**Success Criteria** (what must be TRUE):

  1. When a block targets a map field that already has rows, user sees a single dialog listing each key collision with an overwrite / skip choice per row before any values are written
  2. When a block targets the same oneof branch that is currently active, non-dirty branch sub-fields are filled and dirty sub-fields are listed as conflicts in the batched dialog
  3. When a block targets a different oneof branch than the active one, user sees a confirmation prompt; confirming switches the branch and applies block values after the new branch mounts
  4. All conflicts from a single block drag — regardless of field type — appear in one dialog, not a chain of per-field modals; the dialog has Apply and Cancel actions
  5. Conflict rows default to skip (not overwrite), preventing accidental data loss if the user clicks Apply without reviewing each row
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Proto Parsing + Form | v1.0 | 6/6 | Complete | 2026-05-17 |
| 2. Connect + Publish | v1.0 | 6/6 | Complete | 2026-05-17 |
| 3. Full Feature Set | v1.0 | 4/4 | Complete | 2026-05-18 |
| 4. Response Queue Reader | v1.0 | 2/2 | Complete | 2026-05-18 |
| 5. Dark Mode | v1.1 | 3/3 | Complete | 2026-05-18 |
| 6. BytesField | v1.2 | 1/1 | Complete | 2026-05-19 |
| 7. MapField | v1.2 | 4/4 | Complete | 2026-05-19 |
| 8. JSON Override Toggle | v1.2 | 2/2 | Complete | 2026-05-19 |
| 9. Routing Key Autocomplete | v1.3 | 3/3 | Complete | 2026-05-19 |
| 10. Publisher Confirms Badge | v1.3 | 2/2 | Complete | 2026-05-19 |
| 11. Block Library — Store, Editor, Persistence | v1.3 | 3/3 | Complete | 2026-05-19 |
| 12. Block Library — Drag-and-Drop Layer | v1.3 | 3/3 | Complete | 2026-05-20 |
| 13. Message Feed Foundation + Drain Mode | v1.4 | 3/3 | Complete | 2026-05-20 |
| 14. Live Subscribe Mode | v1.4 | 3/3 | Complete | 2026-05-21 |
| 15. Filter + Export | v1.4 | 1/1 | Complete | 2026-05-21 |
| 16. Pipeline Foundation | v1.5 | 2/2 | Complete | 2026-05-21 |
| 17. macOS Signing + Notarization | v1.5 | 2/2 | Complete | 2026-05-23 |
| 18. Auto-Update + Linux + Docs | v1.5 | 4/4 | Complete | 2026-05-23 |
| 19. Plan Data Model and Persistence | v1.6 | 1/1 | Complete | 2026-05-23 |
| 20. Plan View Shell and Navigation | v1.6 | 2/2 | Complete | 2026-05-23 |
| 21. Step Editor (Authoring) | v1.6 | 4/4 | Complete | 2026-05-23 |
| 22. Plan Runner — Sequential Execution | v1.6 | 5/5 | Complete | 2026-05-24 |
| 23. Response View — Inline and Shared Feed | v1.6 | 3/3 | Complete | 2026-05-24 |
| 24. History Full-Text Search | v1.7 | 2/2 | Complete    | 2026-05-25 |
| 25. Block Apply — WKT + Map Empty Case | v1.7 | 0/TBD | Not started | - |
| 26. Block Apply — Conflict Prompt + Oneof | v1.7 | 0/TBD | Not started | - |

---

## Coverage

**v1.0 — all 30 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROT-01 | Phase 1 | ✅ Complete |
| PROT-02 | Phase 1 | ✅ Complete |
| PROT-03 | Phase 3 | ✅ Complete |
| PROT-04 | Phase 3 | ✅ Complete |
| FORM-01 through FORM-09 | Phase 1 | ✅ Complete |
| CONN-01 through CONN-04 | Phase 2 | ✅ Complete |
| PUBL-01 through PUBL-03 | Phase 2 | ✅ Complete |
| PUBL-04 | Phase 3 | ✅ Complete |
| HIST-01 through HIST-04 | Phase 3 | ✅ Complete |
| RESP-01 through RESP-05 | Phase 4 | ✅ Complete |

**v1.1 — all 4 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRK-01 | Phase 5 | ✅ Complete |
| DRK-02 | Phase 5 | ✅ Complete |
| DRK-03 | Phase 5 | ✅ Complete |
| DRK-04 | Phase 5 | ✅ Complete |

**v1.2 Form Improvements — all 15 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| BFLD-01 | Phase 6 | ✅ Complete |
| BFLD-02 | Phase 6 | ✅ Complete |
| BFLD-03 | Phase 6 | ✅ Complete |
| BFLD-04 | Phase 6 | ✅ Complete |
| MFLD-01 | Phase 7 | ✅ Complete |
| MFLD-02 | Phase 7 | ✅ Complete |
| MFLD-03 | Phase 7 + quick-260519-q01 | ✅ Complete |
| MFLD-04 | Phase 7 | ✅ Complete |
| MFLD-05 | Phase 7 | ✅ Complete |
| JSON-01 | Phase 8 | ✅ Complete |
| JSON-02 | Phase 8 | ✅ Complete |
| JSON-03 | Phase 8 | ✅ Complete |
| JSON-04 | Phase 8 | ✅ Complete |
| JSON-05 | Phase 8 | ✅ Complete |
| JSON-06 | Phase 8 | ✅ Complete |

**v1.3 Publishing UX + Message Blocks — all 16 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUBL-01 | Phase 9 | ✅ Complete |
| PUBL-02 | Phase 9 | ✅ Complete |
| PUBL-03 | Phase 9 | ✅ Complete |
| PUBL-04 | Phase 9 | ✅ Complete |
| PUBL-05 | Phase 10 | ✅ Complete |
| PUBL-06 | Phase 10 | ✅ Complete |
| PUBL-07 | Phase 10 | ✅ Complete |
| PUBL-08 | Phase 10 | ✅ Complete |
| BLK-01 | Phase 11 | ✅ Complete |
| BLK-02 | Phase 11 | ✅ Complete |
| BLK-03 | Phase 11 | ✅ Complete |
| BLK-04 | Phase 11 | ✅ Complete |
| BLK-05 | Phase 11 | ✅ Complete |
| BLK-06 | Phase 12 | ✅ Complete |
| BLK-07 | Phase 12 | ✅ Complete |
| BLK-08 | Phase 12 | ✅ Complete |

**v1.4 Response Stream — 11 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONS-01 | Phase 13 | ✅ Complete |
| CONS-02 | Phase 13 | ✅ Complete |
| CONS-03 | Phase 13 | ✅ Complete |
| CONS-04 | Phase 13 | ✅ Complete |
| CONS-08 | Phase 13 | ✅ Complete |
| CONS-05 | Phase 14 | ✅ Complete |
| CONS-06 | Phase 14 | ✅ Complete |
| CONS-07 | Phase 14 | ✅ Complete |
| FILT-01 | Phase 15 | ✅ Complete |
| FILT-02 | Phase 15 | ✅ Complete |
| XPRT-01 | Phase 15 | ✅ Complete |

**v1.5 Distribution — 12/12 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| CICD-02 | Phase 16 | ✅ Complete |
| CICD-03 | Phase 16 | ✅ Complete |
| SIGN-03 | Phase 16 | ✅ Complete |
| CICD-01 | Phase 17 | ✅ Complete |
| SIGN-01 | Phase 17 | ✅ Complete |
| SIGN-02 | Phase 17 | ✅ Complete |
| PKG-01 | Phase 18 | ✅ Complete |
| UPD-01 | Phase 18 | ✅ Complete |
| UPD-02 | Phase 18 | ✅ Complete — live UAT 2026-05-23 |
| UPD-03 | Phase 18 | ✅ Complete — live UAT 2026-05-23 |
| UPD-04 | Phase 18 | ✅ Complete |
| DOC-01 | Phase 18 | ✅ Complete |

- Total v1.5: 12
- Mapped: 12
- Delivered: 12/12

**v1.6 Plan Runner — 23/23 requirements delivered**

See [milestones/v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md) for full traceability.

- Total v1.6: 23
- Mapped: 23/23 ✓
- Delivered: 23/23 ✓

**v1.7 Block Apply Completeness + History Search — 7/14 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIST-FT-01 | Phase 24 | Shipped |
| HIST-FT-02 | Phase 24 | Shipped |
| HIST-FT-03 | Phase 24 | Shipped |
| HIST-FT-04 | Phase 24 | Shipped |
| HIST-FT-05 | Phase 24 | Shipped |
| HIST-FT-06 | Phase 24 | Shipped |
| HIST-FT-07 | Phase 24 | Shipped |
| BLK-EXT-01 | Phase 25 | Pending |
| BLK-EXT-02 | Phase 25 | Pending |
| BLK-EXT-07 | Phase 25 | Pending |
| BLK-EXT-03 | Phase 26 | Pending |
| BLK-EXT-04 | Phase 26 | Pending |
| BLK-EXT-05 | Phase 26 | Pending |
| BLK-EXT-06 | Phase 26 | Pending |

- Total v1.7: 14
- Mapped: 14/14 ✓
- Delivered: 0/14
