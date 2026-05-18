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

## v1.1 Dark Mode

**Shipped:** 2026-05-18
**Phases:** 1 (Phase 5) | **Plans:** 3 | **Requirements:** 4/4

**Delivered:** Full dark mode support — OS-preference detection, in-app toggle cycling system / light / dark, cross-restart persistence via tauri-plugin-store, and manual visual UAT sign-off across all UI surfaces.

**Key accomplishments:**
1. next-themes ThemeProvider wrapping App root with OS preference detection (`enableSystem`) — no custom matchMedia code
2. ThemeBootstrap persistence bridge: reads tauri-plugin-store on startup, race guard via `bootstrapped` flag prevents stale localStorage clobber before async read completes (DRK-01, DRK-03)
3. ThemeToggle icon cycle button (Monitor/Sun/Moon) in sidebar footer — `CYCLE_ORDER` drives stateless progression, mounted guard prevents layout shift (DRK-02)
4. Human UAT approved — all 30+ UI surfaces (form panel, sidebar, publish bar, AMQP sheet, history panel, response tab, modals, shadcn/ui components) verified correct in dark mode (DRK-04)

**Stats:**
- Timeline: 2026-05-18 (~3 hours)
- Commits: 36
- LOC: +3,234 / −36

**Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

---
