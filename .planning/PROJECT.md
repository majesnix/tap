# Proto Sender

## What This Is

A Tauri desktop application (Rust backend + React frontend) that lets developers load `.proto` files, generates a dynamic form from the schema, connects to RabbitMQ, and sends binary-encoded protobuf messages to a selected queue or exchange — without writing any code. Built as a team dev-tool: each developer installs it locally and uses their own saved connection profiles.

## Core Value

Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## Requirements

### Validated

- [x] Load `.proto` files via file picker at runtime, with import resolution from the filesystem — Validated in Phase 01: proto-parsing-form
- [x] Parse all proto features: nested messages, repeated fields, enums, oneof fields — Validated in Phase 01: proto-parsing-form
- [x] Generate a type-aware dynamic form from the parsed proto schema — Validated in Phase 01: proto-parsing-form
- [x] Type-check field values before send (string, int32/64, float, bool, bytes, enum) — Validated in Phase 01: proto-parsing-form

### Validated

- [x] Connect to RabbitMQ with saved named connection profiles (host, port, vhost, user, password) — Validated in Phase 02: connect-publish
- [x] Fetch live queue list and exchange list from RabbitMQ Management API — Validated in Phase 02: connect-publish
- [x] Publish to a selected queue (direct) or exchange + routing key — Validated in Phase 02: connect-publish
- [x] Encode message as binary protobuf wire format before sending — Validated in Phase 02: connect-publish

### Validated

- [x] Multi-file proto tabs — open multiple `.proto` files simultaneously, switch between them with independent form state — Validated in Phase 03: full-feature-set
- [x] AMQP message properties — set content-type, delivery mode, TTL, correlation ID, reply-to, custom headers — Validated in Phase 03: full-feature-set
- [x] Message history with persistence — every send recorded, survives app restart, FIFO-capped at 100 — Validated in Phase 03: full-feature-set
- [x] Hex payload preview — inspect binary wire-format bytes for any history entry — Validated in Phase 03: full-feature-set
- [x] History filtering — filter by message type name and queue/exchange target — Validated in Phase 03: full-feature-set
- [x] Replay + resend — re-fill form from history entry or republish raw bytes directly — Validated in Phase 03: full-feature-set

### Out of Scope

- Message consumption / reading from queues — send-only tool
- Real-time message monitoring or stream inspection
- OAuth or team-shared credentials — each user manages their own profiles
- Non-proto message formats (JSON-only, Avro, etc.) in v1

## Context

- This is a developer productivity tool, analogous to Postman but for RabbitMQ + protobuf
- The proto parsing must happen at runtime (no pre-compilation step) — developers drop in `.proto` files
- Proto files may import other `.proto` files; the tool must resolve relative imports from the filesystem
- Tauri gives a native desktop window with a Rust backend handling AMQP and proto encoding; React handles the form UI
- Team use means packaging/distribution matters — the app should be distributable as a binary

## Constraints

- **Tech stack**: Tauri 2.x + Rust backend + React frontend — chosen by user
- **Message format**: Binary protobuf wire format only in v1 (not JSON)
- **Proto parsing**: Runtime parsing of raw `.proto` files (not pre-compiled descriptors)
- **RabbitMQ**: Must support queues, exchanges + routing key, and virtual hosts
- **Distribution**: Should be cross-platform (macOS, Windows, Linux) since it's a team tool

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri over Electron | Lighter bundle, Rust backend handles proto encoding and AMQP natively | — Pending |
| Binary proto wire format | Matches production consumer expectations | — Pending |
| Runtime .proto parsing | No pre-compilation step — developer just drops in the file | — Pending |
| Save named connection profiles | Team members connect to different RabbitMQ instances | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
## Current State

Phase 03 (full-feature-set) complete — v1.0 milestone fully shipped. All core features delivered: multi-file proto tabs, AMQP properties sheet, persistent message history with hex preview, history filtering, form replay and raw resend. 130 frontend tests + 12 Rust tests passing. 3 code review findings (publisher confirm mode, connection leak on error, draft header cap) remain open for v1.1.

---
*Last updated: 2026-05-18 after Phase 03 completion*
