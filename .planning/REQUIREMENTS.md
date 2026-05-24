# Requirements: Tap v1.6 Plan Runner

**Milestone:** v1.6 Plan Runner
**Status:** Active
**Created:** 2026-05-23

---

## v1 Requirements

### Plan Library

- [ ] **PLAN-01**: User can create a named plan in the dedicated plan library view
- [ ] **PLAN-02**: User can rename a plan
- [ ] **PLAN-03**: User can delete a plan (with confirmation dialog)
- [ ] **PLAN-04**: User can duplicate a plan with all its steps
- [ ] **PLAN-05**: Plans and their steps persist across app restarts
- [ ] **PLAN-06**: User accesses the plan library via a dedicated full-screen view (separate from the main form + tabs layout)

### Step Authoring

- [x] **STEP-01**: User can add a step to a plan by selecting a .proto file + message type, filling field values, choosing a target queue/exchange + routing key, and setting a response mode (no-wait / correlationId / first-arrival)
- [x] **STEP-02**: User can import a step from message history — field values pre-filled from a selected past send
- [x] **STEP-03**: User can import a step from the block library — field values pre-filled from a selected saved block
- [x] **STEP-04**: User can duplicate an existing step within the same plan
- [x] **STEP-05**: User can reorder steps in a plan via drag-and-drop
- [x] **STEP-06**: User can rename or delete individual steps

### Execution Engine

- [x] **RUN-01**: User can run a plan sequentially — steps execute one at a time in order
- [x] **RUN-02**: User can stop a running plan at any time
- [x] **RUN-03**: Each step shows a status badge throughout execution (Pending / Sending / WaitingResponse / Done / Error)
- [x] **RUN-04**: User can configure a per-plan setting: stop on first error, or continue to remaining steps
- [x] **RUN-05**: A run summary is shown on completion showing how many steps succeeded and how many failed
- [x] **RUN-06**: No-wait steps advance after a configurable per-step delay (default 200 ms, 0 = immediate)

### Response Handling

- [x] **RESP-01**: No-wait steps fire the publish and advance after the configured delay — no reply consumer opened
- [x] **RESP-02**: CorrelationId steps publish with a generated UUID `correlation_id` + `reply_to` AMQP property, wait for a matching reply on the configured reply queue (configurable timeout per step, default 10 s); step gets Error status on timeout
- [x] **RESP-03**: First-arrival steps open a consumer on a specified reply queue and accept the first message that arrives (configurable timeout per step, default 10 s); step gets Error status on timeout
- [ ] **RESP-04**: Steps that receive a reply show the decoded protobuf response inline below the step (same collapsible key-value tree as the existing Response tab)
- [ ] **RESP-05**: A shared scrollable feed shows all messages arriving on watched reply queues during the plan run, in chronological order

---

## Future Requirements

- [ ] Pause / Resume mid-run (inspect broker state before continuing) — not selected for v1.6
- [ ] Variable extraction and chaining across steps — depends on scripting engine; defer to v2
- [ ] Conditional step branching (if/else based on response content) — defer to v2
- [ ] Plan import/export (JSON format, Postman collection import) — defer to v2
- [ ] Test assertions / field-level pass-fail per step — defer to v2
- [ ] Iteration / data-file driven runs — depends on variable substitution; defer to v2
- [ ] Parallel step execution — sequential is the v1 default; parallel is a different use case

---

## Out of Scope

- **Pre/post-step scripts** (Postman-style `pm.test()` / `pm.environment.set()`): REQUEST SCRIPTING is explicitly Out of Scope in PROJECT.md. Sandboxed JS runtime is a different product.
- **Direct reply-to (`amq.rabbitmq.reply-to`)**: at-most-once delivery, one consumer per channel — use named exclusive queues for correlationId and first-arrival modes instead.
- **Plan execution scheduling** (run plan on cron / time trigger): distinct product scope.
- **Non-protobuf message types** (raw JSON, Avro): Out of Scope for v1 per PROJECT.md.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PLAN-01 | Phase 19 | Pending |
| PLAN-02 | Phase 19 | Pending |
| PLAN-03 | Phase 19 | Pending |
| PLAN-04 | Phase 19 | Pending |
| PLAN-05 | Phase 19 | Pending |
| PLAN-06 | Phase 20 | Pending |
| STEP-01 | Phase 21 | Complete |
| STEP-02 | Phase 21 | Complete |
| STEP-03 | Phase 21 | Complete |
| STEP-04 | Phase 21 | Complete |
| STEP-05 | Phase 21 | Complete |
| STEP-06 | Phase 21 | Complete |
| RUN-01 | Phase 22 | Complete |
| RUN-02 | Phase 22 | Complete |
| RUN-03 | Phase 22 | Complete |
| RUN-04 | Phase 22 | Complete |
| RUN-05 | Phase 22 | Complete |
| RUN-06 | Phase 22 | Complete |
| RESP-01 | Phase 22 | Complete |
| RESP-02 | Phase 22 | Complete |
| RESP-03 | Phase 22 | Complete |
| RESP-04 | Phase 23 | Pending |
| RESP-05 | Phase 23 | Pending |
