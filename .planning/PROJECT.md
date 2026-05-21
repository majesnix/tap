# Tap

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
- ✓ Bytes field with RFC 4648 base64 input, UTF-8 text helper, inline validation error for URL-safe chars, and byte count label — v1.2 (Phase 06)
- ✓ Map field (`map<K, V>`) rendered as typed key-value rows with duplicate-key blocking (send disabled) and correct binary protobuf encoding via Value::Map path — v1.2 (Phase 07)
- ✓ JSON override toggle — switch between form view and CodeMirror JSON editor with two-way sync, invalid JSON error banner, and unknown-field warning — v1.2 (Phase 08)

- ✓ Routing key autocomplete — RoutingKeyCombobox with live bindings from Management API, exchange type badges, silent fallback for fanout/headers and API unavailability — v1.3 (Phase 09)
- ✓ Publisher confirms badge — mandatory=true on all publishes, tokio timeout guard, ephemeral ACK/Returned/NACK/Timeout badge with per-outcome auto-dismiss (3s/5s/5s/manual) — v1.3 (Phase 10)
- ✓ Message block library — collapsible panel, CodeMirror editor, AlertDialog delete, optimistic rollback on persistence failure — v1.3 (Phase 11)
- ✓ Block persistence — tauri-plugin-store persistence with hydration gate (`blocksLoaded` flag) — v1.3 (Phase 11)
- ✓ Apply block by drag-and-drop — dnd-kit PointerSensor, dirtyFields guard, BLK-08 Sonner warning toast for unmatched keys — v1.3 (Phase 12)

## Current Milestone: v1.4 Response Stream

**Goal:** Replace the one-at-a-time basic_get reader with a full consume experience — drain mode, live subscribe mode, filtering, queue depth visibility, and export.

**Target features:**
- Drain mode — fetch up to N messages in one shot, display all at once
- Live subscribe mode — persistent consumer, messages arrive in a scrollable list (newest on top), each row expandable
- Ack immediately on consume in both modes
- Queue depth indicator — show message count before consuming
- Filter received messages by routing key or content-type in the live feed
- Export received messages to JSON or CSV

### Active (v1.4)

- ✓ Drain mode — drain up to 500 messages with multi-type first-success decode (decodedAs), FIFO-500 accordion feed, Decode-as multi-select combobox — v1.4 (Phase 13)
- ✓ Live subscribe mode — persistent AMQP consumer, streaming messages via Tauri Channel, scrollable feed with expandable rows, auto-stop on profile/connection change, retry from Error state — v1.4 (Phase 14, complete 2026-05-21)
- ✓ Filter and export — routing key substring filter, content-type dropdown filter (AND intersection), JSON export of visible feed via native save dialog, "X of Y messages" count label — v1.4 (Phase 15, complete 2026-05-21)

### Backlog (future milestones — candidates for v1.4+)

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
- v1.2 added bytes field, map field, and JSON override toggle. +10,173 LOC, 83 commits, 3 phases, 7 plans.
- v1.3 added routing key autocomplete, publisher confirms badge, block library with DnD. +17,550 / -853 LOC, 50 commits, 4 phases, 11 plans, 92 files changed.
- Tech stack: Tauri 2.x, Rust (protox 0.9 + prost-reflect 0.16, lapin 4.x, reqwest 0.13), React (next-themes 0.x, react-hook-form 7.x, zod 3.24.2, zustand 5.x, shadcn/ui nova, Tailwind 4.x, @uiw/react-codemirror 4.25.9, @codemirror/lang-json 6.x, dnd-kit 6.x).
- This is a developer productivity tool, analogous to Postman but for RabbitMQ + protobuf.
- The proto parsing must happen at runtime (no pre-compilation step) — developers drop in `.proto` files.
- Tauri gives a native desktop window with a Rust backend handling AMQP and proto encoding; React handles the form UI.
- Team use means packaging/distribution matters — the app should be distributable as a binary.

**Known issues / tech debt at v1.3:**
- Linux keychain (libsecret) install documentation needed for distribution.
- No CI/CD pipeline — builds are manual.
- No app distribution pipeline (notarization, signing) — binary not yet packaged for team.
- No E2E test for cross-restart theme persistence (requires full Tauri app + tauri-plugin-store integration — manual UAT is the check).
- JSON mode + map field round-trip (Flow 4) has no automated test — FormPanel.test.tsx uses scalar-only schema.
- oneof / WellKnownType / map fields not eligible for block apply (skipped with toast) — complex field type support deferred to future milestone.
- No automated browser-level DnD test for dnd-kit drag gestures — manual UAT is the current coverage.

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
| Map rows stored as `Array<{key, value}>` via `useFieldArray` (not `Record<K,V>`) | JS object keys deduplicate silently — two rows with the same key would merge on form state read | ✓ Good — explicit row array with duplicate detection via useWatch+useMemo |
| ProtoFormRenderer switch FROZEN; new field types as pre-dispatch branches | Switch body already has 10+ cases; modification risk outweighs benefit | ✓ Good — BytesField and MapField both added as pre-dispatch branches without touching the switch |
| `register(name, { validate }) + trigger(name)` for virtual guard fields | `setError` on unregistered fields does not reliably affect `formState.isValid` in RHF `mode: onChange` — learned from MFLD-03 regression | ✓ Good — restored in quick task 260519-q01; 180/180 tests pass |
| JSON toggle reuses `setPendingReplayValues` signal (not direct `resetRef`) | `resetRef.current` is null until ProtoFormRenderer remounts — direct call would throw | ✓ Good — HIST-02 replay path already handles form reset correctly |
| JSON mode state is local React state (not Zustand) | JSON mode is a session-only power-user override; no cross-component sharing needed | ✓ Good — simple, no store pollution |
| percent-encode both vhost and resource name in Management API URLs | RabbitMQ API requires full URL encoding of path segments | ✓ Good — NON_ALPHANUMERIC encoding worked for all vhost characters |
| mandatory=true unconditionally on every basic_publish | Dev tool should always confirm delivery — per-send toggle deferred | ✓ Good — aligns with RabbitMQ confirm-mode best practice |
| Timeout outcome as Ok(PublishOutcome { status: 'timeout' }) not Err | Timeout is a delivery outcome, not a command error | ✓ Good — clean separation of IPC errors vs delivery outcomes |
| dnd-kit PointerSensor over HTML5 DnD | WKWebView (macOS Tauri) breaks HTML5 dataTransfer API | ✓ Good — confirmed necessary; PointerSensor worked correctly in production window |
| DndContext + DragOverlay mounted at AppLayout level | Overlay needs to escape DOM subtree for correct z-index | ✓ Good — prevents clipping inside nested scroll containers |
| applyBlockRef contract (not store-integrated dirtyFields) | ProtoFormRenderer switch is frozen; ref wiring is the safe extension point | ✓ Good — no switch changes needed; form-level drop zone wires the ref |
| Two-view local state (PanelView list/editor) in BlockLibraryPanel | Panel view is local UI state, not shared across components | ✓ Good — kept Zustand stores focused on persistent data |

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

v1.1 shipped 2026-05-18. Phase 5 (dark-mode) delivered all 4 DRK requirements. Dark mode is complete across all UI surfaces.

v1.2 shipped 2026-05-19. All 15 requirements delivered: bytes field (BFLD-01–04), map field (MFLD-01–05), JSON override toggle (JSON-01–06). The form renderer now covers all practical proto field types. One regression (MFLD-03 send-block) was introduced by a code review finding and fixed by quick task 260519-q01.

The app is feature-complete for v1 scope: all major proto field types, full send/receive cycle, connection profiles, message history, and dark mode. Next focus area to be defined in `/gsd-new-milestone`.

v1.3 shipped 2026-05-20. All 16 requirements delivered across 4 phases (11 plans): routing key autocomplete from RabbitMQ exchange bindings (PUBL-01–04), per-send delivery outcome badges (PUBL-05–08), block library with CodeMirror editor and persistence (BLK-01–05), and drag-and-drop block apply to form (BLK-06–08). The HTML5 DnD API was replaced mid-execution with dnd-kit after discovering WKWebView's dataTransfer limitation.

The app is feature-rich for the v1 scope. All proto field types supported, full send/receive cycle, connection profiles with OS keychain, message history, dark mode, block library. Next milestone scope to be defined via `/gsd-new-milestone`.

---
*Last updated: 2026-05-20 — Milestone v1.4 started*
