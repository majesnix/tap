# Requirements: Proto Sender

**Defined:** 2026-05-20
**Milestone:** v1.4 — Advanced Response Consumer
**Core Value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## v1.4 Requirements

### Message Feed Foundation

- [ ] **CONS-01**: User can see AMQP metadata (routing key, exchange, content-type, timestamp) on each consumed message row
- [ ] **CONS-02**: User can view consumed messages in a FIFO-500 scrollable list — newest on top, each row expandable to decoded payload and raw hex
- [ ] **CONS-03**: User can drain up to N messages from a queue in one shot (single Rust command, streams into the list)
- [ ] **CONS-04**: User can see the current queue depth (message count) before and during consumption
- [ ] **CONS-08**: User can select one or more candidate message types (from loaded `.proto` files) for decoding consumed messages; the system tries them in the selected order and uses the first type that decodes without error

### Live Subscribe

- [ ] **CONS-05**: User can start a live subscribe session that delivers messages continuously until stopped
- [ ] **CONS-06**: User can see the current subscribe status (Running / Stopping / Idle / Error) via a status badge
- [ ] **CONS-07**: Live subscribe auto-stops when the active connection profile changes or disconnects

### Filter

- [ ] **FILT-01**: User can filter the message feed by routing key (text match, client-side)
- [ ] **FILT-02**: User can filter the message feed by content-type (dropdown, client-side)

### Export

- [ ] **XPRT-01**: User can export all messages in the current feed to a JSON file

## Future Requirements

### Export (deferred)

- **XPRT-02**: User can export messages to CSV (decoded_json string column for nested proto fields)

### History (carried from v1.3 backlog)

- **HIST-V2-01**: User can export history entries to JSON or CSV
- **HIST-V2-02**: User can full-text search across historical message field values

## Out of Scope

| Feature | Reason |
|---------|--------|
| Broker-side filtering | AMQP 0-9-1 has no selective-pull by routing key — architectural constraint |
| Real-time monitoring as separate product | Different product surface, not core to the send-test loop |
| Dead-letter queue inspector | Future milestone scope |
| Message replay from consumed feed | Use existing history replay — no duplication needed |
| OAuth / team-shared credentials | Each user manages their own profiles locally |
| Non-proto message formats | Binary protobuf wire format only in v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONS-01 | Phase 13 | Pending |
| CONS-02 | Phase 13 | Pending |
| CONS-03 | Phase 13 | Pending |
| CONS-04 | Phase 13 | Pending |
| CONS-05 | Phase 14 | Pending |
| CONS-06 | Phase 14 | Pending |
| CONS-07 | Phase 14 | Pending |
| FILT-01 | Phase 15 | Pending |
| FILT-02 | Phase 15 | Pending |
| XPRT-01 | Phase 15 | Pending |

**Coverage:**
- v1.4 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 after initial v1.4 definition*
