# Requirements: Proto Sender

**Defined:** 2026-05-18
**Milestone:** v1.1 Dark Mode
**Core Value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## v1.1 Requirements

### Theme

- [ ] **DRK-01**: App detects the OS dark/light preference (`prefers-color-scheme`) on startup and applies the corresponding theme automatically when the user's mode is set to "system"
- [ ] **DRK-02**: User can switch between three theme modes — system, light, and dark — via a toggle control in the app UI
- [ ] **DRK-03**: The selected theme mode persists across app restarts (stored via tauri-plugin-store, same mechanism as connection profiles)
- [ ] **DRK-04**: All existing UI surfaces render correctly in dark mode — form panel, connection sidebar, publish bar, AMQP properties sheet, message history panel, response tab, modals, and all shadcn/ui components

## Future Requirements

*(Carry-forward from v1.0 v2 candidates — not in scope for v1.1)*

### Form Editor

- **FORM-V2-01**: Bytes field with base64 input and UTF-8 text helper button
- **FORM-V2-02**: Map field (`map<K, V>`) rendered as dynamic key-value row list
- **FORM-V2-03**: JSON override toggle — switch between form view and raw JSON edit mode

### Publishing

- **PUBL-V2-01**: Routing key autocomplete from exchange binding table
- **PUBL-V2-02**: Publisher confirms mode with per-message acknowledgment status

### History

- **HIST-V2-01**: Export history entries to JSON or CSV
- **HIST-V2-02**: Full-text search across historical message field values

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-component theme overrides | One global theme is sufficient for a dev tool |
| High-contrast / accessibility themes | Out of scope for v1.1 |
| Theme synced via connection profiles | Theme is a local UI preference, not a profile setting |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRK-01 | Phase 5 | Pending |
| DRK-02 | Phase 5 | Pending |
| DRK-03 | Phase 5 | Pending |
| DRK-04 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 4 total
- Mapped to phases: 4
- Unmapped: 0

---
*Requirements defined: 2026-05-18*
