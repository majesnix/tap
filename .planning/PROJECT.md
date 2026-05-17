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

### Active
- [ ] Keep a message history log with ability to replay/resend past messages

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

Phase 02 (connect-publish) complete — named connection profiles with OS keychain password storage, Test Connection flow, live queue/exchange picker via Management API with silent fallback, binary protobuf publish with form retention after send. Two UAT gap fixes shipped: edit-mode Test Connection button and modal scroll for many profiles. Phase 03 (full-feature-set) is next.

---
*Last updated: 2026-05-18 after Phase 02 completion*
