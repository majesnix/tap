# Proto Sender

## What This Is

A Tauri desktop application (Rust backend + React frontend) that lets developers load `.proto` files, generate a dynamic form from the schema, connect to RabbitMQ, send binary-encoded protobuf messages to a selected queue or exchange, and read back incoming response messages from a reply queue — all without writing any code. Built as a team dev-tool: each developer installs it locally and uses their own saved connection profiles.

## Core Value

Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

## Requirements

### Validated

- ✓ Load `.proto` files via file picker at runtime, with import resolution from the filesystem — v1.0 (Phase 01)
- ✓ Parse all proto features: nested messages, repeated fields, enums, oneof fields, WellKnownTypes — v1.0 (Phase 01)
- ✓ Generate a type-aware dynamic form from the parsed proto schema — v1.0 (Phase 01)
- ✓ Type-check and validate field values before send, surface errors inline — v1.0 (Phase 01)
- ✓ Connect to RabbitMQ with saved named connection profiles (host, port, vhost, user, password) stored with OS keychain — v1.0 (Phase 02)
- ✓ Fetch live queue list and exchange list from RabbitMQ Management API — v1.0 (Phase 02)
- ✓ Publish to a selected queue (direct) or exchange + routing key — v1.0 (Phase 02)
- ✓ Encode message as binary protobuf wire format before sending — v1.0 (Phase 02)
- ✓ Multi-file proto tabs — open multiple `.proto` files simultaneously, switch between them — v1.0 (Phase 03)
- ✓ AMQP message properties — set content-type, delivery mode, TTL, correlation ID, reply-to, custom headers — v1.0 (Phase 03)
- ✓ Message history with persistence — every send recorded, survives app restart, FIFO-capped at 100 — v1.0 (Phase 03)
- ✓ Hex payload preview — inspect binary wire-format bytes for any history entry — v1.0 (Phase 03)
- ✓ History filtering — filter by message type name and queue/exchange target — v1.0 (Phase 03)
- ✓ Replay + resend — re-fill form from history entry or republish raw bytes directly — v1.0 (Phase 03)
- ✓ Consume one message at a time from a selected RabbitMQ queue via basic_get — v1.0 (Phase 04)
- ✓ Decode binary protobuf payload using the loaded schema and display as a collapsible key-value tree — v1.0 (Phase 04)
- ✓ Display raw hex payload alongside decoded fields — v1.0 (Phase 04)
- ✓ Live queue dropdown from Management API with fallback to manual text input (consistent across PublishBar and ResponseTab) — v1.0 (Phase 04)
- ✓ Copy hex and decoded JSON to clipboard — v1.0 (Phase 04)
- ✓ Ack message after basic_get — v1.0 (Phase 04)
- ✓ OS dark/light preference (`prefers-color-scheme`) applied automatically on startup — v1.1 (Phase 05)
- ✓ In-app toggle cycling system / light / dark modes — immediate effect, no reload — v1.1 (Phase 05)
- ✓ Theme mode persists across app restarts via tauri-plugin-store — v1.1 (Phase 05)
- ✓ All UI surfaces render correctly in dark mode — form panel, connection sidebar, publish bar, AMQP sheet, history panel, response tab, modals, shadcn/ui components — v1.1 (Phase 05)
- ✓ Map field (`map<K, V>`) rendered as dynamic key-value row list with duplicate-key validation and binary protobuf encoding — v1.2 (Phase 07)

### Active (v1.2 — Form Improvements)

- [ ] Bytes field with base64 input and UTF-8 text helper button (FORM-V2-01)
- [ ] Map field (`map<K, V>`) rendered as dynamic key-value row list (FORM-V2-02) — Validated in Phase 07
- [ ] JSON override toggle — switch between form view and raw JSON edit mode with two-way sync (FORM-V2-03)

### Backlog (future milestones)

- [ ] Routing key autocomplete from exchange binding table (PUBL-V2-01)
- [ ] Publisher confirms mode with per-message acknowledgment status (PUBL-V2-02)
- [ ] Export history entries to JSON or CSV (HIST-V2-01)
- [ ] Full-text search across historical message field values (HIST-V2-02)

### Out of Scope

- Real-time message monitoring or stream subscription — different product, not core to the send-test loop
- OAuth or team-shared credentials — each user manages their own profiles locally
- Non-proto message formats (JSON-only, Avro, etc.) in v1
- Request scripting / automation — Postman-style scripting adds scope without core value

## Context

- Shipped v1.0 with ~42,800 LOC (TypeScript + Rust), 50 commits, 4 phases, 18 plans, delivered in a single day.
- v1.1 added dark mode: next-themes + ThemeBootstrap persistence bridge, ThemeToggle in sidebar, human UAT pass. +3,234 LOC, 36 commits, 3 plans.
- Tech stack: Tauri 2.x, Rust (protox 0.9 + prost-reflect 0.16, lapin 4.x, reqwest 0.13), React (next-themes 0.x, react-hook-form 7.x, zod 3.24.2, zustand 5.x, shadcn/ui nova, Tailwind 4.x).
- This is a developer productivity tool, analogous to Postman but for RabbitMQ + protobuf.
- The proto parsing must happen at runtime (no pre-compilation step) — developers drop in `.proto` files.
- Tauri gives a native desktop window with a Rust backend handling AMQP and proto encoding; React handles the form UI.
- Team use means packaging/distribution matters — the app should be distributable as a binary.

**Known issues / tech debt at v1.1:**
- Linux keychain (libsecret) install documentation needed for distribution.
- No CI/CD pipeline — builds are manual.
- No app distribution pipeline (notarization, signing) — binary not yet packaged for team.
- No E2E test for cross-restart theme persistence (requires full Tauri app + tauri-plugin-store integration — manual UAT is the check).

## Constraints

- **Tech stack**: Tauri 2.x + Rust backend + React frontend — chosen by user
- **Message format**: Binary protobuf wire format only in v1 (not JSON)
- **Proto parsing**: Runtime parsing of raw `.proto` files (not pre-compiled descriptors)
- **RabbitMQ**: Must support queues, exchanges + routing key, and virtual hosts
- **Distribution**: Should be cross-platform (macOS, Windows, Linux) since it's a team tool

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2.x over Electron | Lighter bundle, Rust backend handles proto encoding and AMQP natively | ✓ Good — native feel, no Node.js overhead in production binary |
| Binary proto wire format | Matches production consumer expectations | ✓ Good — prost-reflect encoding validated against real RabbitMQ consumers |
| Runtime .proto parsing (protox + prost-reflect) | No pre-compilation step — developer just drops in the file | ✓ Good — protox Compiler API handled include path resolution cleanly |
| Save named connection profiles | Team members connect to different RabbitMQ instances | ✓ Good — OS keychain storage never exposed passwords |
| reqwest + Management API for queue listing | AMQP 0-9-1 has no enumeration operation | ✓ Good — 401 surfaced as auth error not silent fallback |
| react-hook-form + zod (not RJSF) | Proto oneof/repeated don't map cleanly to JSON Schema | ✓ Good — useFieldArray handled repeated fields; zod pinned to ^3.24.2 |
| zustand 5.x for global state | Simpler than Redux for this scope | ✓ Good — 5 stores stayed manageable |
| shadcn/ui nova preset | Zero-dependency components, source-copied | ✓ Good — Tailwind 4 + @tailwindcss/vite plugin worked; Radix portals need jsdom mocking |
| tauri::async_runtime::spawn (not tokio::spawn) | tokio::spawn panics on Windows in Tauri 2 event listeners | ✓ Good — confirmed by Tauri issue #10289 |
| ack-before-decode for consume_message | Avoids re-delivery on decode error; acceptable for dev tool usage | ✓ Good — simpler Rust code; no re-delivery edge case issues |
| Ephemeral lapin connections per operation | No persistent AMQP connection state to manage in Tauri app | ✓ Good — simplified error handling, no reconnection logic needed |
| next-themes ThemeProvider (not custom CSS var solution) | Handles OS preference, hydration, class application automatically | ✓ Good — zero custom matchMedia code; dark CSS vars were already in index.css |
| ThemeBootstrap child-of-ThemeProvider pattern | Async tauri-plugin-store read requires component after context is ready | ✓ Good — race guard via bootstrapped flag prevented Pitfall 6 stale localStorage clobber |
| CYCLE_ORDER array for ThemeToggle progression | Stateless mode cycling — no state machine needed | ✓ Good — system → light → dark → system; no edge case where mode gets stuck |
| DRK-04 verified by manual visual UAT only | No automated snapshot/visual regression tool was set up | ✓ Good — human UAT approved; sufficient for a dev tool in this phase |

## Current Milestone: v1.2 Form Improvements

**Goal:** Extend the dynamic form renderer to cover the remaining proto field types and add a JSON override mode for power users.

**Target features:**
- Bytes field (FORM-V2-01) — base64 input with UTF-8 text helper button
- Map field (FORM-V2-02) — `map<K, V>` rendered as a dynamic key-value row list
- JSON override toggle (FORM-V2-03) — form ↔ raw JSON edit mode with two-way sync

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

## Current State

v1.0 shipped 2026-05-18. All 30 v1 requirements delivered across 4 phases (18 plans). The app is fully functional as a local dev tool: load a `.proto` file, fill out the form, connect to RabbitMQ, publish a binary-encoded protobuf message, and read back response messages from a reply queue.

v1.1 shipped 2026-05-18. Phase 5 (dark-mode) delivered all 4 DRK requirements: OS preference detection via next-themes (DRK-01), in-app icon cycle toggle in sidebar footer (DRK-02), cross-restart persistence via tauri-plugin-store with race guard (DRK-03), and human UAT sign-off across all UI surfaces (DRK-04). Dark mode is complete.

v1.2 in progress. Phase 6 (bytesfield) complete 2026-05-19 — BFLD-01 through BFLD-04 delivered. Phase 7 (mapfield) complete — MAP-01 through MAP-05 delivered. Phase 8 (json-override-toggle) complete 2026-05-19 — JSON-01 through JSON-06 delivered: Braces toggle button in FormPanel header, CodeMirror JSON editor with syntax highlighting and dark/light theme, point-in-time snapshot pre-fill, valid-JSON→form sync via pendingReplayValues signal, invalid-JSON error banner with Fix JSON / Discard, and unknown-field sonner toast warning.

The app now has 2 shipped milestones (v1.0, v1.1) and 1 complete milestone (v1.2 Form Improvements — all 3 phases done).

---
*Last updated: 2026-05-19 — Phase 8 (json-override-toggle) complete, v1.2 milestone finished*
