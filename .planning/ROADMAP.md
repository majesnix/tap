# Roadmap: Proto Sender

**Milestone:** v1 MVP
**Granularity:** Coarse
**Mode:** mvp
**Created:** 2026-05-17
**Requirements:** 25 v1 requirements mapped across 3 phases

---

## Phases

- [x] **Phase 1: Proto Parsing + Form** — Load a `.proto` file, fill out a dynamic form, and see the binary-encoded result — no network required (completed 2026-05-17)
- [x] **Phase 2: Connect + Publish** — Connect to RabbitMQ via saved profiles and actually send encoded messages (completed 2026-05-17)
- [ ] **Phase 3: Full Feature Set** — Message history, advanced properties, WellKnownType controls, multi-file support, live queue listing

---

## Phase Details

### Phase 1: Proto Parsing + Form
**Goal:** User can load a `.proto` file, see a fully rendered type-aware form, fill in values, and inspect the resulting binary-encoded protobuf payload — entirely offline, no RabbitMQ required.
**Mode:** mvp
**Depends on:** Nothing
**Requirements:**
- PROT-01: User can open a `.proto` file via a file picker dialog at runtime (no pre-compilation step)
- PROT-02: User can configure include paths so relative imports resolve correctly across project directory trees
- FORM-01: Form renders all scalar field types with appropriate input types and constraints
- FORM-02: Form renders nested message fields as expandable inline sub-forms
- FORM-03: Form renders repeated fields as a list with add/remove item controls
- FORM-04: Form renders enum fields as dropdowns showing value names
- FORM-05: Form renders oneof fields as a radio group; selecting a branch clears all sibling branches
- FORM-06: App validates field values before send and surfaces errors inline
- FORM-07: Form pre-populates sensible zero-value defaults on load
- FORM-08: App caps nested message expansion at 5 levels deep and shows a collapse placeholder below that
- FORM-09: WellKnownType fields use purpose-built controls (datetime picker for Timestamp, human-readable for Duration)

**Success Criteria** (what must be TRUE):
1. User opens a `.proto` file with nested imports and sees a fully rendered form within 2 seconds — no terminal, no compilation step.
2. Every field type (scalar, nested message, repeated, enum, oneof) renders correctly and accepts or rejects input according to proto type constraints.
3. Filling out the form and clicking "Encode" produces a hex or binary preview of the protobuf wire bytes that changes when field values change.
4. Recursive message types do not crash or infinitely expand the form — the renderer stops at 5 levels deep and shows a collapse indicator.

**Plans:** 6/6 plans complete

**Wave 1** — Foundation (must complete before Wave 2 begins)
- [x] 01-01-PLAN.md — Walking Skeleton: scaffold, full Rust backend (parse_proto + encode_message + extractor for all kinds), app layout, file open flow, string scalar + hex preview

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Scalar field coverage: all 16 scalar kinds, zod validation, zero-value defaults
- [x] 01-03-PLAN.md — Nested + Repeated + Depth cap: NestedMessageField (collapsible, depth), RepeatedField (useFieldArray add/remove), DepthCapPlaceholder at 5 levels
- [x] 01-04-PLAN.md — Enum + Oneof: EnumField (Select, name/number split), OneofField (RadioGroup, conditional mount, unregister)
- [x] 01-05-PLAN.md — WellKnownType controls + include path persistence: WellKnownTypeField (Timestamp/Duration/fallback), FileSection + IncludePathDialog with tauri-plugin-store persistence

**Wave 3** — Gap Closure *(blocked on Wave 2 completion)*
- [x] 01-06-PLAN.md — Gap closure: fix broken debounce gate in FormPanel (useState reactive source + useEffect encoding pipeline)

**Cross-cutting constraints:**
- All Tauri IPC commands use `tauri::async_runtime::spawn` — never bare `tokio::spawn`
- `FieldKind` discriminated union in `src-tauri/src/schema/types.rs` and `src/lib/types.ts` must stay in sync
- Recursive depth cap (5 levels) enforced via `depth` prop threaded through all form components
- zod pinned to `^3.24.2` — do not upgrade to v4

**UI hint:** yes

---

### Phase 2: Connect + Publish
**Goal:** User can create and save a RabbitMQ connection profile, connect to a live broker, select a queue or exchange, and successfully publish the encoded protobuf message.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:**
- CONN-01: User can create and save named connection profiles (host, port, vhost, username, password, management API port)
- CONN-02: User can switch between saved connection profiles with a single click
- CONN-03: App tests connection reachability and credential validity when the user saves a profile
- CONN-04: Passwords are stored in the OS keychain — never in plain config files
- PUBL-01: User can publish a message directly to a named queue (via the default exchange)
- PUBL-02: User can publish a message to a named exchange with a user-specified routing key
- PUBL-03: User can select target queues and exchanges from a live dropdown populated from the Management API; falls back to manual text input when Management API is unavailable

**Success Criteria** (what must be TRUE):
1. User creates a connection profile, saves it, and the app immediately verifies the connection — showing a clear success or failure message without leaving the form.
2. Switching between saved profiles reconnects to the correct broker and the queue/exchange picker reflects that broker's live data.
3. User fills out the proto form, selects a queue, clicks Send, and the message arrives in the RabbitMQ queue — verifiable via the Management UI or a consumer.
4. Passwords never appear in any config file, log output, or application state visible to the frontend.
5. When the Management API is unreachable, the queue/exchange picker falls back gracefully to a manual text input with a visible status indicator.

**Plans:** 6/6 plans complete

**Wave 1** — Profile save + keychain (no connection test yet)
- [x] 02-01-PLAN.md — Profile management: keyring-core + tauri-plugin-store, save/list/delete commands, ConnectionSection sidebar, ProfileManagementModal

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Connection test + activation: lapin ephemeral connect, test_connection + activate_profile commands, ConnectionTestResult inline display, status dot activation

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Queue/exchange listing + PublishBar: reqwest + Management API, fetch_queues/fetch_exchanges, PublishBar with Live/Manual badge + mode toggle

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Publish message: publish_message lapin command, handleSend wired, Sonner toasts (success + error), Toaster mounted

**Cross-cutting constraints:**
- Passwords NEVER in store, IPC response, frontend state, or logs — OS keychain (keyring crate) only
- `tauri::async_runtime::spawn` for all async Rust — never bare `tokio::spawn`
- `load_profile_with_password` is `pub(crate)` — internal only, not exposed via IPC
- 401 from Management API surfaces as auth error — NOT silent fallback to Manual mode

---

### Phase 3: Full Feature Set
**Goal:** User has access to the complete v1 feature set: message history with replay, advanced AMQP properties, WellKnownType form controls, multi-proto-file support, and recursive depth limiting.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:**
- PROT-03: Tool renders WellKnownTypes (Timestamp, Duration, Any, etc.) with purpose-built form controls
- PROT-04: User can have multiple `.proto` files open simultaneously and switch between message types within one session
- PUBL-04: User can set AMQP message properties before sending (content-type, delivery-mode, TTL, correlation-id, reply-to, custom headers)
- HIST-01: App logs all sent messages (timestamp, queue or exchange/routing-key, message type name, send status)
- HIST-02: User can click any history entry to re-populate the form with its original field values and resend
- HIST-03: User can view the binary payload of any history entry as a hex string
- HIST-04: User can filter the history log by message type name or by queue/exchange name

**Success Criteria** (what must be TRUE):
1. Every message sent via Phase 2 appears in the history log with correct timestamp, target, type name, and status — and persists after the app is restarted.
2. Clicking a history entry restores the exact field values into the form and the user can resend with one more click.
3. User can filter the history list by message type name and by queue/exchange name, reducing visible entries to only matching rows.
4. User can open two different `.proto` files and switch between their message types within one session without reloading.
5. User can set AMQP properties (at minimum content-type, delivery-mode, and correlation-id) before sending and those properties are present on the received message.

**Plans:** 2/4 plans executed

**Wave 1** — Foundation (parallel, no overlap)
- [x] 03-01-PLAN.md — Multi-file tabs (PROT-03/04): useProtoStore expansion + FileSection Tabs + FormPanel signals
- [x] 03-02-PLAN.md — AMQP properties (PUBL-04): useAmqpStore + AmqpPropertiesSheet + publish.rs extension

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 03-03-PLAN.md — Message history (HIST-01/03): useHistoryStore + RightPanel Hex/History tabs + PublishBar history recording

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 03-04-PLAN.md — History replay + filter (HIST-02/04): HistoryFilterBar + Replay/Resend handlers + FormPanel pendingReplayValues consumer

**UI hint:** yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Proto Parsing + Form | 6/6 | Complete   | 2026-05-17 |
| 2. Connect + Publish | 6/6 | Complete   | 2026-05-17 |
| 3. Full Feature Set | 2/4 | In Progress|  |

---

## Coverage

| Requirement | Phase |
|-------------|-------|
| PROT-01 | Phase 1 |
| PROT-02 | Phase 1 |
| FORM-01 | Phase 1 |
| FORM-02 | Phase 1 |
| FORM-03 | Phase 1 |
| FORM-04 | Phase 1 |
| FORM-05 | Phase 1 |
| FORM-06 | Phase 1 |
| FORM-07 | Phase 1 |
| FORM-08 | Phase 1 |
| FORM-09 | Phase 1 |
| CONN-01 | Phase 2 |
| CONN-02 | Phase 2 |
| CONN-03 | Phase 2 |
| CONN-04 | Phase 2 |
| PUBL-01 | Phase 2 |
| PUBL-02 | Phase 2 |
| PUBL-03 | Phase 2 |
| PROT-03 | Phase 3 |
| PROT-04 | Phase 3 |
| PUBL-04 | Phase 3 |
| HIST-01 | Phase 3 |
| HIST-02 | Phase 3 |
| HIST-03 | Phase 3 |
| HIST-04 | Phase 3 |

**Total v1 mapped:** 25/25
