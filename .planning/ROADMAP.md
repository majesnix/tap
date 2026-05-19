# Roadmap: Proto Sender

**Current Milestone:** v1.2 Form Improvements
**Mode:** mvp

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-05-18)
- ✅ **v1.1 Dark Mode** — Phase 5 (shipped 2026-05-18)
- [ ] **v1.2 Form Improvements** — Phases 6–8 (active)

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

**v1.2 Form Improvements — Active**

- [ ] **Phase 6: BytesField** — Base64 input with UTF-8 helper and strict alphabet validation
- [ ] **Phase 7: MapField** — Dynamic key-value rows with typed inputs and correct wire encoding
- [ ] **Phase 8: JSON Override Toggle** — Form ↔ raw JSON editor with two-way sync

---

## Phase Details

### Phase 6: BytesField
**Goal**: Users can fill in bytes fields using standard base64 with immediate feedback on invalid input
**Depends on**: Nothing (self-contained frontend change, zero Rust changes)
**Requirements**: BFLD-01, BFLD-02, BFLD-03, BFLD-04
**Success Criteria** (what must be TRUE):
  1. User can type or paste a standard base64 string (RFC 4648 `+`/`/` alphabet) into a bytes field and it encodes correctly on send
  2. User can click "From text", type UTF-8 text, and the field is populated with the correct base64 representation in one action
  3. User sees an inline validation error when the input contains URL-safe base64 characters (`-` or `_`) — the input is not silently treated as empty bytes
  4. User sees a byte count label (e.g. "14 bytes") confirming the decoded length after a valid base64 value is entered
  5. User sees an error on send when the base64 value cannot be decoded — not silent empty bytes
**Plans**: 1 plan
Plans:
- [x] 06-01-PLAN.md — Create BytesField component (TDD), wire into ProtoFormRenderer, remove bytes branch from ScalarField
**UI hint**: yes

### Phase 7: MapField
**Goal**: Users can add, edit, and remove entries for `map<K, V>` proto fields, which render as typed key-value rows and encode as binary protobuf wire format
**Depends on**: Phase 6 (BytesField — establishes base64 alphabet convention for bytes-typed map values)
**Requirements**: MFLD-01, MFLD-02, MFLD-03, MFLD-04, MFLD-05
**Success Criteria** (what must be TRUE):
  1. User can add and remove rows for a `map<K, V>` field via Add/Remove buttons — the field does not render as a nested message sub-form
  2. User sees the key input constrained to the declared key type (numeric input for int32/int64/etc., text for string, checkbox/select for bool)
  3. User sees an inline duplicate-key error and the send button is blocked until all keys in the map are unique
  4. User can fill in map values using the same renderers as the rest of the form — scalar, enum, and nested message value types all work
  5. A `map<K, V>` field with entries encodes correctly as binary protobuf wire format when sent (Value::Map path in encode.rs, not Value::List)
**Plans**: 4 plans
Plans:
- [x] 07-01-PLAN.md — Rust layer: FieldKind::Map variant, is_map() extractor guard, Value::Map encoder + 4 unit tests (Wave 1)
- [x] 07-02-PLAN.md — TypeScript wiring: FieldKind map union member, ProtoFormRenderer pre-dispatch branch, buildDefaultValues case (Wave 2)
- [x] 07-03-PLAN.md — MapField component: full TDD implementation — useFieldArray rows, key dispatch, duplicate detection, hidden guard, renderValue prop (Wave 3)
- [x] 07-04-PLAN.md — Human verify: live app verification of all MFLD-01 through MFLD-05 requirements (Wave 4)
**UI hint**: yes

### Phase 8: JSON Override Toggle
**Goal**: Users can switch between form view and a raw JSON editor, with two-way sync that preserves repeated and map field row counts
**Depends on**: Phase 6 (base64 string shape in latestValues), Phase 7 (map as Record<string,unknown> in latestValues)
**Requirements**: JSON-01, JSON-02, JSON-03, JSON-04, JSON-05, JSON-06
**Success Criteria** (what must be TRUE):
  1. User can click a toggle button in the form header to switch to JSON mode, and the editor opens pre-filled with the current form values as a point-in-time snapshot
  2. Switching back to form mode with a repeated or map field having a different row count renders the correct number of rows — including fields added or removed while in JSON mode
  3. User sees an explicit error and a "Fix JSON / Discard" choice when switching back with invalid JSON — edits are never silently discarded
  4. User sees a non-blocking warning listing field names present in the JSON but absent from the proto schema before the values are applied
  5. JSON editor has syntax highlighting and respects the active dark/light theme
**Plans**: 2 plans
Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Install packages, export buildDefaultValues, implement JsonEditor component (TDD) (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — FormPanel JSON toggle integration (TDD) + human verify (Wave 2)
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
| 6. BytesField | v1.2 | 0/1 | Not started | - |
| 7. MapField | v1.2 | 0/4 | Not started | - |
| 8. JSON Override Toggle | v1.2 | 0/2 | Not started | - |

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

**v1.2 Form Improvements — 15 requirements, 0 completed**

| Requirement | Phase | Status |
|-------------|-------|--------|
| BFLD-01 | Phase 6 | Pending |
| BFLD-02 | Phase 6 | Pending |
| BFLD-03 | Phase 6 | Pending |
| BFLD-04 | Phase 6 | Pending |
| MFLD-01 | Phase 7 | Pending |
| MFLD-02 | Phase 7 | Pending |
| MFLD-03 | Phase 7 | Pending |
| MFLD-04 | Phase 7 | Pending |
| MFLD-05 | Phase 7 | Pending |
| JSON-01 | Phase 8 | Pending |
| JSON-02 | Phase 8 | Pending |
| JSON-03 | Phase 8 | Pending |
| JSON-04 | Phase 8 | Pending |
| JSON-05 | Phase 8 | Pending |
| JSON-06 | Phase 8 | Pending |
