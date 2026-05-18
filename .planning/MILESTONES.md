# Milestones: Proto Sender

---

## v1.0 MVP

**Shipped:** 2026-05-18
**Phases:** 4 (Phases 1–4) | **Plans:** 18 | **Requirements:** 30/30

**Delivered:** Full-stack Tauri desktop app — load `.proto` files, compose protobuf messages in a dynamic form, publish to RabbitMQ, and read back response messages from a reply queue, all without writing any code.

**Key accomplishments:**
1. Complete Tauri 2.x + Rust scaffold with runtime proto parsing (protox + prost-reflect) — no protoc required, user drops in `.proto` files at runtime
2. Type-aware dynamic form renderer covering all 16 scalar kinds, nested messages, repeated fields (add/remove), enums, oneofs, and WellKnownTypes (Timestamp, Duration)
3. RabbitMQ connection profiles with OS keychain password storage, live queue/exchange discovery via Management API, and binary protobuf publish to queues and exchanges with full AMQP properties support
4. Message history with FIFO-capped persistence (survives restarts), hex payload preview, filter by type/target, and replay/resend from any history entry
5. Response queue reader — consume one message from a reply queue, decode binary protobuf payload against the loaded schema, display in a collapsible key-value tree with raw hex, copy-to-clipboard, and ack to remove from queue

**Stats:**
- Timeline: 2026-05-18 (single day, ~15 hours)
- Commits: 50
- LOC: ~42,800 (TypeScript + Rust)
- Files: 55 changed (+9,832 / -125)

**Archive:** [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---
