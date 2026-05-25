# Requirements: Tap v1.8 UX Polish + Proto Ergonomics

**Milestone:** v1.8
**Status:** Active
**Last updated:** 2026-05-25

---

## v1.8 Requirements

### Keyboard Shortcuts (KB)

- [ ] **KB-01**: User can send the current form with Cmd+Enter (Ctrl+Enter on Windows/Linux) from anywhere in the app
- [ ] **KB-02**: User can open the native proto file picker with Cmd+O
- [ ] **KB-03**: User can clear all form fields to defaults with Cmd+Shift+R
- [ ] **KB-04**: User can navigate between main tabs with Cmd+1/2/3
- [ ] **KB-05**: Keyboard shortcuts are discoverable via tooltips on the corresponding buttons

### Form Ergonomics (FRM)

- [ ] **FRM-01**: User can clear all form fields to defaults with a single Clear button click
- [ ] **FRM-02**: User can copy any individual scalar/enum/bytes field value to clipboard via a hover-reveal copy icon
- [ ] **FRM-03**: User can fill all non-dirty fields with type-appropriate random values via a Randomize button
- [ ] **FRM-04**: Randomizer handles all proto field types correctly: enum (valid enum values only), bytes (standard-alphabet base64), int64/uint64 (as strings per IPC convention), WellKnownTypes (shaped objects), oneof (one branch set with `_selected`), nested messages (depth-capped at 5)

### Proto File Management (REL / RFC / IMP)

- [ ] **REL-01**: User can reload (re-parse) the currently loaded .proto file without re-opening the file picker
- [ ] **RFC-01**: App tracks the last 10 recently used .proto file paths, persisted across app restarts
- [ ] **RFC-02**: User can re-open a recent .proto file from a quick-access list in the file tab bar area
- [ ] **RFC-03**: Stale recent-file entries (file moved or deleted) are shown as disabled with a visual indicator
- [ ] **IMP-01**: User can view the current include paths for the loaded .proto file
- [ ] **IMP-02**: User can add or remove include paths for the current file without re-opening the file picker
- [ ] **IMP-03**: Changing include paths automatically triggers a reload of the current .proto file

### State & Navigation (CQS / DFT)

- [ ] **CQS-01**: User can switch between saved connection profiles from a compact dropdown in the publish bar, without opening the connections sidebar
- [ ] **CQS-02**: Connection quick-switch is blocked with a warning when a plan is actively running
- [ ] **DFT-01**: App auto-saves current form field values per `(filePath, messageTypeName)` on every change (debounced 200 ms)
- [ ] **DFT-02**: Draft is automatically restored when the user selects the same message type in the same proto file, including map/repeated/oneof fields
- [ ] **DFT-03**: Drafts survive app restart via tauri-plugin-store persistence
- [ ] **DFT-04**: User can explicitly clear the draft for the current message type
- [ ] **DFT-05**: Draft storage is capped at 50 message types with LRU eviction

### Schema Explorer (SCH)

- [ ] **SCH-01**: User can see the proto type, field number, and cardinality for any form field via an inline tooltip on hover
- [ ] **SCH-02**: User can open a schema explorer panel showing all messages, fields, and enums from the loaded .proto file as a collapsible tree
- [ ] **SCH-03**: Schema explorer handles recursive message types safely (depth cap + visited-set guard, no infinite render)

---

## Future Requirements (Deferred)

- Proto runtime extensions — add custom fields/messages to loaded schema at runtime without editing .proto on disk (v1.9)
- Auto-reload on file change using tauri-plugin-fs watch() (v1.9)
- Customizable keyboard shortcuts (v1.9+)
- CSV export for history entries (HIST-V2-01, future milestone)
- Recursive nested message randomization beyond depth cap (future)
- Jump-to-field from schema tree to form field (future)
- Import dependency tree visualization (future)
- Seeded PRNG for reproducible random values (future)
- JSON-mode draft persistence (DFT-06, stretch goal for Phase C)

---

## Out of Scope

- Windows distribution — no Authenticode signing strategy yet (separate milestone)
- OAuth / team-shared credentials — each developer manages their own profiles locally
- Non-proto message formats (JSON-only, Avro, etc.) in v1.x
- Real-time message monitoring beyond existing live subscribe — different product
- Postman-style request scripting / automation

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KB-01 through KB-05 | Phase 27 | — |
| FRM-01, FRM-02 | Phase 27 | — |
| FRM-03, FRM-04 | Phase 30 | — |
| REL-01, RFC-01 through RFC-03, IMP-01 through IMP-03 | Phase 28 | — |
| CQS-01, CQS-02, DFT-01 through DFT-05 | Phase 29 | — |
| SCH-01, SCH-02, SCH-03 | Phase 31 | — |

*Traceability filled after roadmap creation.*
