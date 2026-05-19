# Roadmap: Proto Sender

**Last Milestone:** v1.2 Form Improvements — SHIPPED 2026-05-19
**Current:** v1.3 Publishing UX + Message Blocks — IN PROGRESS

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-05-18)
- ✅ **v1.1 Dark Mode** — Phase 5 (shipped 2026-05-18)
- ✅ **v1.2 Form Improvements** — Phases 6–8 (shipped 2026-05-19)
- 🔄 **v1.3 Publishing UX + Message Blocks** — Phases 9–12 (in progress)

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

### v1.3 Publishing UX + Message Blocks (Phases 9–12)

- [ ] **Phase 9: Routing Key Autocomplete** — 0/3 plans — not started
- [x] **Phase 10: Publisher Confirms Badge** — 0/2 plans — not started (completed 2026-05-19)
- [x] **Phase 11: Block Library — Store, Editor, Persistence** — 0/3 plans — not started (completed 2026-05-19)
- [ ] **Phase 12: Block Library — Drag-and-Drop Layer** — 0/? plans — not started

---

## Phase Details

### Phase 9: Routing Key Autocomplete
**Goal**: Users get live routing key suggestions from RabbitMQ exchange bindings when targeting an exchange, replacing the blank free-text input
**Depends on**: Phase 8 (foundation complete)
**Requirements**: PUBL-01, PUBL-02, PUBL-03, PUBL-04
**Success Criteria** (what must be TRUE):
  1. User selects an exchange and sees a populated suggestions list in the routing key input drawn from live RabbitMQ bindings
  2. User selects a `headers` or `fanout` exchange and the routing key input shows no suggestions (autocomplete suppressed)
  3. User sees topic exchange wildcard patterns (e.g. `orders.*.created`) displayed in the suggestions list with a visible label indicating they are patterns and must be edited before sending
  4. User has no active connection or the Management API is unreachable and the routing key input falls back to plain free-text entry with no error state shown
**Plans**: 3 plans
Plans:
- [x] 09-01-PLAN.md — Rust backend: ExchangeSummary struct + fetch_exchanges update + fetch_bindings command + lib.rs registration
- [x] 09-02-PLAN.md — Frontend contracts: install Command component, ExchangeSummary type, updated ipc.ts/store, RoutingKeyCombobox component + tests
- [x] 09-03-PLAN.md — PublishBar integration: exchange type badges, bindings useEffect, conditional combobox/input, hint text, updated tests
**UI hint**: yes

### Phase 10: Publisher Confirms Badge
**Goal**: Users receive an explicit per-send delivery outcome from the broker — ACK, Returned, NACK, or Timeout — displayed as an ephemeral badge in the publish bar
**Depends on**: Phase 9
**Requirements**: PUBL-05, PUBL-06, PUBL-07, PUBL-08
**Success Criteria** (what must be TRUE):
  1. User sends a message that the broker confirms delivered and sees a green ACK badge in the publish bar; the badge disappears automatically after 3 seconds
  2. User sends a message with no matching binding (mandatory=true, unroutable) and sees an amber Returned badge; the badge disappears automatically after 5 seconds
  3. User sends a message the broker negatively acknowledges and sees a red NACK badge; the badge disappears automatically after 5 seconds
  4. User sends a message and broker confirmation does not arrive within 5 seconds; user sees a gray Timeout badge that remains until manually dismissed
**Plans**: 2 plans
Plans:
**Wave 1**
- [x] 10-01-PLAN.md — Rust backend: PublishOutcome struct, mandatory=true, tokio timeout, Confirmation match

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md — Frontend: PublishOutcome type, ipc.ts return type, badge state + JSX + tests in PublishBar
**UI hint**: yes

### Phase 11: Block Library — Store, Editor, Persistence
**Goal**: Users can create, edit, delete, and persist named JSON message blocks, and apply them to the current form with a click
**Depends on**: Phase 10
**Requirements**: BLK-01, BLK-02, BLK-03, BLK-04, BLK-05
**Success Criteria** (what must be TRUE):
  1. User opens and closes the block library panel from a toggle button in the FormPanel header; the panel collapses and expands correctly
  2. User creates a new block by entering a name and writing a JSON object in the CodeMirror editor; the block appears in the library list
  3. User edits an existing block's name or JSON content and saves it; the updated block is reflected immediately in the library
  4. User deletes a block after confirming a prompt; the block is removed from the library
  5. User restarts the app and finds previously saved blocks still present in the library (persistence via tauri-plugin-store)
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 11-01-PLAN.md — useBlockStore: Block type, Zustand store, CRUD actions, blocksLoaded hydration gate, tauri-plugin-store persistence (TDD)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-02-PLAN.md — BlockLibraryPanel: two-view component (list + editor), CodeMirror editor, AlertDialog delete confirmation, validation, tests

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 11-03-PLAN.md — Integration: AppLayout flex restructure, FormPanel toggle button, App.tsx loadBlocks() mount call
**UI hint**: yes

### Phase 12: Block Library — Drag-and-Drop Layer
**Goal**: Users can drag a block from the library panel onto the form to merge its values into empty fields, with a warning when block keys have no matching form field
**Depends on**: Phase 11
**Requirements**: BLK-06, BLK-07, BLK-08
**Success Criteria** (what must be TRUE):
  1. User drags a block card from the block library panel and drops it onto the form; fields in the form that are empty are populated with matching values from the block
  2. User drags a block onto a form where some fields have already been edited; only unmodified (not-dirty) fields are filled — no field the user touched is overwritten
  3. User drops a block whose keys include fields not present in the current form schema; a warning toast appears listing the skipped field names
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
| 9. Routing Key Autocomplete | v1.3 | 0/3 | Not started | — |
| 10. Publisher Confirms Badge | v1.3 | 2/2 | Complete    | 2026-05-19 |
| 11. Block Library — Store, Editor, Persistence | v1.3 | 3/3 | Complete   | 2026-05-19 |
| 12. Block Library — Drag-and-Drop Layer | v1.3 | 0/? | Not started | — |

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

**v1.3 Publishing UX + Message Blocks — 16 requirements, 0 delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUBL-01 | Phase 9 | Pending |
| PUBL-02 | Phase 9 | Pending |
| PUBL-03 | Phase 9 | Pending |
| PUBL-04 | Phase 9 | Pending |
| PUBL-05 | Phase 10 | Pending |
| PUBL-06 | Phase 10 | Pending |
| PUBL-07 | Phase 10 | Pending |
| PUBL-08 | Phase 10 | Pending |
| BLK-01 | Phase 11 | Pending |
| BLK-02 | Phase 11 | Pending |
| BLK-03 | Phase 11 | Pending |
| BLK-04 | Phase 11 | Pending |
| BLK-05 | Phase 11 | Pending |
| BLK-06 | Phase 12 | Pending |
| BLK-07 | Phase 12 | Pending |
| BLK-08 | Phase 12 | Pending |

- Total v1.3: 16
- Mapped: 16
- Unmapped: 0 ✓
