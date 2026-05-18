# Requirements: Proto Sender

**Defined:** 2026-05-19
**Core Value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## v1.2 Requirements

Requirements for the Form Improvements milestone. Each maps to roadmap phases.

### Bytes Field

- [ ] **BFLD-01**: User can enter a bytes field value as a standard base64 string (RFC 4648, `+`/`/` alphabet)
- [ ] **BFLD-02**: User can click a "From text" helper button to encode UTF-8 text into base64 in one action
- [ ] **BFLD-03**: User sees an inline validation error when the input contains non-standard base64 characters (e.g. URL-safe `-`/`_`)
- [ ] **BFLD-04**: User sees an error on send when the base64 value cannot be decoded — not silent empty bytes

### Map Field

- [ ] **MFLD-01**: User can add and remove key-value row entries for a `map<K, V>` field
- [ ] **MFLD-02**: User sees the key input constrained to the declared proto key type (numeric input for int keys, text for string, etc.)
- [ ] **MFLD-03**: User sees an inline duplicate-key error and cannot send until all keys are unique
- [ ] **MFLD-04**: User can fill in map values using the same field renderers as the rest of the form (scalar, enum, nested message)
- [ ] **MFLD-05**: User's map field encodes correctly as binary protobuf wire format when sent

### JSON Override

- [ ] **JSON-01**: User can toggle between form view and raw JSON edit mode via a button in the form header
- [ ] **JSON-02**: Switching to JSON mode pre-fills the editor with current form values (point-in-time snapshot, not a live feed)
- [ ] **JSON-03**: Switching back to form mode applies the edited JSON to all form fields including repeated/map rows
- [ ] **JSON-04**: User sees an error and explicit "Fix JSON / Discard" choice when switching back with invalid JSON — edits are never silently discarded
- [ ] **JSON-05**: User sees a non-blocking warning listing unknown field names when the JSON contains keys not in the proto schema
- [ ] **JSON-06**: JSON editor has syntax highlighting and dark mode support

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Publishing

- **PUBL-V2-01**: Routing key autocomplete from exchange binding table
- **PUBL-V2-02**: Publisher confirms mode with per-message acknowledgment status

### History

- **HIST-V2-01**: Export history entries to JSON or CSV
- **HIST-V2-02**: Full-text search across historical message field values

## Out of Scope

| Feature | Reason |
|---------|--------|
| URL-safe base64 input mode | Adds ambiguity; standard alphabet is what prost-reflect produces — keep one alphabet |
| Persistent JSON-mode state across app restarts | JSON mode is a session-only power-user override; not worth persisting |
| Bidirectional canonical proto JSON ↔ form conversion | Canonical proto JSON (camelCase, oneof by field name) differs from form-internal shape; round-trip via form shape is sufficient |
| Map value types that are maps or repeated | Proto3 prohibits nested maps and repeated map values by spec |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

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

**Coverage:**
- v1.2 requirements: 15 total
- Mapped to phases: 15 (Phase 6: 4, Phase 7: 5, Phase 8: 6)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 — traceability updated after roadmap creation*
