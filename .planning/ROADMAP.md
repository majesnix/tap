# Roadmap: Proto Sender

**Last Milestone:** v1.3 Publishing UX + Message Blocks — SHIPPED 2026-05-20
**Current:** v1.4 Advanced Response Consumer — In progress

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-05-18)
- ✅ **v1.1 Dark Mode** — Phase 5 (shipped 2026-05-18)
- ✅ **v1.2 Form Improvements** — Phases 6–8 (shipped 2026-05-19)
- ✅ **v1.3 Publishing UX + Message Blocks** — Phases 9–12 (shipped 2026-05-20)
- 🚧 **v1.4 Advanced Response Consumer** — Phases 13–15 (in progress)

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

### 🚧 v1.4 Advanced Response Consumer (In Progress)

**Milestone Goal:** Replace the one-at-a-time basic_get reader with a full consume experience — drain mode, live subscribe, filtering, queue depth visibility, and export.

- [ ] **Phase 13: Message Feed Foundation + Drain Mode** — Scrollable message list with AMQP metadata, queue depth indicator, and batch drain
- [ ] **Phase 14: Live Subscribe Mode** — Persistent consumer streaming messages into the feed with status badge and auto-stop on profile change
- [ ] **Phase 15: Filter + Export** — Client-side filtering by routing key and content-type, plus JSON export of the feed

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
- [ ] 13-03-PLAN.md — Store evolution + Drain UI + MessageFeedTab/Row + test migration
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
**Plans**: TBD
**UI hint**: yes

### Phase 15: Filter + Export
**Goal**: Users can narrow the message feed by routing key or content-type and export the current feed to a JSON file
**Depends on**: Phase 14
**Requirements**: FILT-01, FILT-02, XPRT-01
**Success Criteria** (what must be TRUE):
  1. User can type a routing key substring and the feed list narrows to only matching messages without clearing the underlying data
  2. User can select a content-type from a dropdown and the feed shows only messages with that content-type
  3. User can click Export and receive a JSON file containing all messages currently visible in the feed
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
| 13. Message Feed Foundation + Drain Mode | v1.4 | 2/3 | In Progress|  |
| 14. Live Subscribe Mode | v1.4 | 0/? | Not started | - |
| 15. Filter + Export | v1.4 | 0/? | Not started | - |

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

- Total v1.3: 16
- Mapped: 16
- Delivered: 16 ✓

**v1.4 Advanced Response Consumer — 10 requirements**

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONS-01 | Phase 13 | Pending |
| CONS-02 | Phase 13 | Pending |
| CONS-03 | Phase 13 | Pending |
| CONS-04 | Phase 13 | Pending |
| CONS-08 | Phase 13 | Pending |
| CONS-05 | Phase 14 | Pending |
| CONS-06 | Phase 14 | Pending |
| CONS-07 | Phase 14 | Pending |
| FILT-01 | Phase 15 | Pending |
| FILT-02 | Phase 15 | Pending |
| XPRT-01 | Phase 15 | Pending |

- Total v1.4: 11
- Mapped: 11
- Delivered: 0 (in progress)
