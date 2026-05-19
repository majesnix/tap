# Requirements: Proto Sender v1.3

**Defined:** 2026-05-19
**Core Value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## v1.3 Requirements

### Publishing Enhancements

- [ ] **PUBL-01**: User can see routing key suggestions populated from live RabbitMQ exchange bindings when an exchange is selected in the publish bar
- [ ] **PUBL-02**: User sees no routing key suggestions for `headers` and `fanout` exchanges (autocomplete suppressed — routing key is always empty for these types)
- [ ] **PUBL-03**: Topic exchange wildcard binding patterns (e.g. `orders.*.created`) are shown in suggestions labeled as patterns so the user knows to edit before sending
- [ ] **PUBL-04**: Routing key input falls back to plain free-text when the Management API is unavailable — no error state shown
- [ ] **PUBL-05**: User sees a green ACK badge in the publish bar after the broker confirms delivery; badge auto-dismisses after 3 seconds
- [ ] **PUBL-06**: User sees an amber Returned badge when a published message has no route (mandatory=true, no binding match); badge auto-dismisses after 5 seconds
- [ ] **PUBL-07**: User sees a red NACK badge when the broker negatively acknowledges a message; badge auto-dismisses after 5 seconds
- [ ] **PUBL-08**: User sees a gray Timeout badge when broker confirmation does not arrive within 5 seconds; badge requires manual dismiss

### Message Blocks

- [ ] **BLK-01**: User can open and close a block library panel from a toggle button in the FormPanel header
- [ ] **BLK-02**: User can create a named block by entering a name and writing a JSON object (key-value pairs) in a CodeMirror editor
- [ ] **BLK-03**: User can edit an existing block's name and JSON content
- [ ] **BLK-04**: User can delete a block with a confirmation prompt
- [ ] **BLK-05**: Blocks persist across app restarts (saved via tauri-plugin-store)
- [ ] **BLK-06**: User can apply a block to the current form by dragging it from the block library panel and dropping it onto the form
- [ ] **BLK-07**: Block merge fills only empty (unmodified/not-dirty) form fields — never overwrites a field the user has already edited
- [ ] **BLK-08**: User sees a warning toast listing field names from the block that had no matching field in the current form

## Future Requirements

### Publishing

- **PUBL-F-01**: Routing key autocomplete suggestions for exchanges accessible only through Management API pagination (> 100 bindings)
- **PUBL-F-02**: Publisher confirms timeout duration configurable per connection profile

### Message Blocks

- **BLK-F-01**: Save current form state as a block (capture-from-form shortcut)
- **BLK-F-02**: Block tagging / categories for organizing large block libraries
- **BLK-F-03**: Import / export blocks as JSON file

## Out of Scope

| Feature | Reason |
|---------|--------|
| Type-safe blocks scoped to a proto message type | Research showed global/type-agnostic with field-name matching meets the need; typed blocks add schema-coupling complexity without clear benefit for a dev tool |
| `mandatory: false` as user toggle in v1.3 | Defaulting to `true` is the right behavior; per-send toggle can be added in a future milestone if teams need it |
| Block merge override (overwrite existing values) | Fill-empty-only is the safe default; an override mode can be added later if teams request it |
| Per-field drop targets in the form | Single form-level drop zone is sufficient; per-field DnD adds complexity without clear UX benefit |
| Real-time binding updates (live refresh on exchange selection) | Fetch-once-on-selection is sufficient; binding tables rarely change during a session |

## Traceability

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

**Coverage:**
- v1.3 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 after initial definition*
