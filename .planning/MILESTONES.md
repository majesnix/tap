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

## v1.2 Form Improvements

**Shipped:** 2026-05-19
**Phases:** 3 (Phases 6–8) | **Plans:** 7 | **Requirements:** 15/15

**Delivered:** Extended the form renderer with bytes fields (RFC 4648 base64 + UTF-8 helper), map fields (typed key-value rows, duplicate-key blocking, binary wire format), and a JSON override toggle (two-way form ↔ CodeMirror sync, invalid-JSON error banner, unknown-field toast).

**Key accomplishments:**
1. BytesField — RFC 4648 base64 input with two-layer zod validation, UTF-8 text helper popover, byte count label, and inline error for URL-safe characters; ScalarField bytes handling removed (clean separation)
2. MapField Rust layer — `FieldKind::Map` variant, `is_map()` extractor guard (precedes `is_list()`), `Value::Map(HashMap<MapKey, Value>)` encoder, `json_to_map_key` helper for all key types, 4 Rust unit tests
3. MapField React component — `useFieldArray` rows, type-constrained key inputs (number / text+regex / Select), duplicate-key detection via `useWatch+useMemo`, `register+trigger` guard field keeps `formState.isValid` false while duplicates exist, `renderValue` delegates to `ProtoFormRenderer.renderField` for full value-type support; human UAT confirmed enum and message-valued map entries encode correctly
4. JSON Override Toggle — Braces button in FormPanel header, CodeMirror editor with syntax highlighting and dark/light theme (reuses `resolvedTheme` from next-themes), point-in-time snapshot capture, two-way sync via `setPendingReplayValues` signal, Fix JSON / Discard choice for invalid JSON, unknown-field toast warning
5. MFLD-03 regression fix (quick task 260519-q01) — restored `register+trigger` guard field after Phase 7 code review incorrectly replaced it with `setError`; added `!encodeError` to `PublishBar.canSend` for two-layer duplicate blocking

**Stats:**
- Timeline: 2026-05-19 (single day)
- Commits: 83
- Files changed: 57 (+10,173 / −93)
- Known deferred items at close: 2 (see STATE.md Deferred Items — both false positives from audit-open tool)

**Archive:** [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) | [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

---
