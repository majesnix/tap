# Requirements: Proto Sender

**Defined:** 2026-05-17
**Core Value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## v1 Requirements

### Connection Management

- [x] **CONN-01**: User can create and save named connection profiles (host, port, vhost, username, password, management API port)
- [x] **CONN-02**: User can switch between saved connection profiles with a single click
- [x] **CONN-03**: App tests connection reachability and credential validity when the user saves a profile
- [x] **CONN-04**: Passwords are stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret) — never in plain config files

### Proto Loading

- [ ] **PROT-01**: User can open a `.proto` file via a file picker dialog at runtime (no pre-compilation step)
- [x] **PROT-02**: User can configure include paths (equivalent to `protoc -I`) so relative imports resolve correctly across project directory trees
- [ ] **PROT-03**: Tool renders WellKnownTypes (google.protobuf.Timestamp, Duration, Any, etc.) with purpose-built form controls (e.g. datetime picker for Timestamp)
- [ ] **PROT-04**: User can have multiple `.proto` files open simultaneously and switch between message types within one session

### Form Editor — Field Types

- [x] **FORM-01**: Form renders scalar fields (string, int32, int64, uint32, uint64, sint32, sint64, float, double, bool) with appropriate input types and constraints
- [ ] **FORM-02**: Form renders nested message fields as expandable inline sub-forms
- [ ] **FORM-03**: Form renders repeated fields as a list with add/remove item controls, including repeated nested messages
- [x] **FORM-04**: Form renders enum fields as dropdowns showing value names (not raw integer values)
- [x] **FORM-05**: Form renders oneof fields as a radio group; selecting a branch clears all sibling branches (correct proto wire semantics)

### Form Editor — Quality

- [ ] **FORM-06**: App validates field values before send and surfaces errors inline (e.g. out-of-range int32, invalid enum, missing required field in proto2)
- [ ] **FORM-07**: Form pre-populates sensible zero-value defaults on load (0 for numerics, empty string, first enum value)
- [ ] **FORM-08**: App caps nested message expansion at 5 levels deep and shows a collapse placeholder below that, preventing infinite rendering of recursive types
- [x] **FORM-09**: WellKnownType fields use purpose-built controls rather than raw field editors (datetime picker for Timestamp, human-readable string for Duration)

### Publishing

- [ ] **PUBL-01**: User can publish a message directly to a named queue (via the default exchange)
- [ ] **PUBL-02**: User can publish a message to a named exchange with a user-specified routing key
- [x] **PUBL-03**: User can select target queues and exchanges from a live dropdown populated from the RabbitMQ Management API; when the Management API is unavailable the dropdown falls back to a manual text input with a clear status indicator
- [ ] **PUBL-04**: User can set AMQP message properties before sending (content-type, delivery-mode, TTL, correlation-id, reply-to, custom headers as key-value pairs)

### Message History

- [ ] **HIST-01**: App logs all sent messages (timestamp, queue or exchange/routing-key, message type name, send status)
- [ ] **HIST-02**: User can click any history entry to re-populate the form with its original field values and resend
- [ ] **HIST-03**: User can view the binary payload of any history entry as a hex string
- [ ] **HIST-04**: User can filter the history log by message type name or by queue/exchange name

## v2 Requirements

### Form Editor

- **FORM-V2-01**: Bytes field with base64 input and UTF-8 text helper button
- **FORM-V2-02**: Map field (`map<K, V>`) rendered as dynamic key-value row list
- **FORM-V2-03**: JSON override toggle — switch between form view and raw JSON edit mode for any message

### Publishing

- **PUBL-V2-01**: Routing key autocomplete from exchange binding table
- **PUBL-V2-02**: Publisher confirms mode with per-message acknowledgment status

### History

- **HIST-V2-01**: Export history entries to JSON or CSV
- **HIST-V2-02**: Full-text search across historical message field values

## Out of Scope

| Feature | Reason |
|---------|--------|
| Message consumption / reading from queues | Send-only tool by design; reading changes scope significantly |
| Real-time queue monitoring / stream inspection | Different product, not core to the send-test loop |
| Team cloud sync / shared profiles | Each user manages local profiles; out of scope for v1 |
| OAuth or federated credential management | Email/password RabbitMQ auth sufficient for dev tool |
| Non-proto message formats (JSON-only, Avro, etc.) | Binary protobuf only in v1 |
| Request scripting / automation | Postman-style scripting adds scope without core value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 2 | Complete |
| CONN-02 | Phase 2 | Complete |
| CONN-03 | Phase 2 | Complete |
| CONN-04 | Phase 2 | Complete |
| PROT-01 | Phase 1 | Pending |
| PROT-02 | Phase 1 | Complete |
| PROT-03 | Phase 3 | Pending |
| PROT-04 | Phase 3 | Pending |
| FORM-01 | Phase 1 | Complete |
| FORM-02 | Phase 1 | Pending |
| FORM-03 | Phase 1 | Pending |
| FORM-04 | Phase 1 | Complete |
| FORM-05 | Phase 1 | Complete |
| FORM-06 | Phase 1 | Pending |
| FORM-07 | Phase 1 | Pending |
| FORM-08 | Phase 1 | Pending |
| FORM-09 | Phase 1 | Complete |
| PUBL-01 | Phase 2 | Pending |
| PUBL-02 | Phase 2 | Pending |
| PUBL-03 | Phase 2 | Complete |
| PUBL-04 | Phase 3 | Pending |
| HIST-01 | Phase 3 | Pending |
| HIST-02 | Phase 3 | Pending |
| HIST-03 | Phase 3 | Pending |
| HIST-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after roadmap creation*
