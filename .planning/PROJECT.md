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

- ✓ Batch drain mode — `drain_messages` Rust command, multi-type first-success protobuf decode (decodedAs), FIFO-500 accordion feed with per-row hex viewer, queue depth badge, Decode-as multi-select combobox — v1.4 (Phase 13)
- ✓ Live subscribe mode — persistent AMQP consumer, streaming via Tauri Channel, scrollable feed with expandable rows, auto-stop on profile/connection change, retry from Error state — v1.4 (Phase 14)
- ✓ Feed filtering — routing key substring + content-type dropdown filters (AND intersection), "X of Y messages" count label — v1.4 (Phase 15)
- ✓ JSON export — native OS save dialog, `{ exportedAt, messageCount, messages[] }` shape, `dialog:allow-save` + `fs:allow-write-text-file` Tauri capabilities — v1.4 (Phase 15)
- ✓ Tauri security hardening — strict CSP replacing `null`, `fs:scope` narrowed to `$HOME/**`, unused `fs:default` and `fs:allow-read-text-file` permissions removed — v1.4 (s1j)

- ✓ GitHub Actions release pipeline: signed + notarized Universal .dmg and Linux AppImage on every `v*` tag push, Rust build cache, Entitlements.plist with all required WebView entitlements — v1.5 (Phases 16–17)
- ✓ macOS Developer ID code signing + `notarytool` notarization; `spctl --assess` Gatekeeper gate in CI; release verified on clean Mac — v1.5 (Phase 17)
- ✓ In-app auto-update: `tauri-plugin-updater` startup check, Sonner toast with Install & Relaunch, "Check for Updates..." in macOS native menu bar, sidebar button for Windows/Linux — v1.5 (Phase 18)
- ✓ Linux AppImage built on ubuntu-22.04, passes on Ubuntu 22.04 + 24.04; `docs/linux-keychain.md` for libsecret prerequisite — v1.5 (Phase 18)

- ✓ Plan data model — `Plan` / `PlanStep` types, `usePlanStore` CRUD with `plans.json` persistence via tauri-plugin-store, schema_version for forward compat — v1.6 (Phase 19)
- ✓ Plan library view — full-screen plan list panel, plan CRUD UI (create / rename / delete), navigation from sidebar — v1.6 (Phase 20)
- ✓ Step editor — step authoring with all proto + target + response-mode fields, drag-and-drop reorder (dnd-kit), import from send history and block library — v1.6 (Phase 21)
- ✓ Plan runner — sequential JS runner loop, all three response modes (no-wait / correlation-id / first-arrival), run controls (Run / Stop), live step status badges, new Rust commands (execute_plan_step, stop_plan) — v1.6 (Phase 22)
- ✓ Response view — decoded protobuf reply shown inline per step (StepReplyView), shared scrollable Reply Feed tab (PlanReplyFeedTab, FIFO-500), reply dot indicator on step rows, ms-precision timestamps — v1.6 (Phase 23)
- ✓ Proto auto-load — plans remember their proto paths; selecting a plan silently re-opens any .proto files not already loaded, using saved include paths — v1.6 (Phase 23 bonus)

## Backlog (future milestones)

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
- v1.4 added batch drain mode, live subscribe mode, feed filtering, and JSON export. +20,585 / -2,161 LOC, 50 commits, 3 phases, 8 plans. Tauri security hardened (strict CSP, narrowed fs:scope). Project renamed from Proto Sender to Tap.
- Tech stack: Tauri 2.x, Rust (protox 0.9 + prost-reflect 0.16, lapin 4.x, reqwest 0.13, tokio-util 0.7), React (next-themes 0.x, react-hook-form 7.x, zod 3.24.2, zustand 5.x, shadcn/ui nova, Tailwind 4.x, @uiw/react-codemirror 4.25.9, @codemirror/lang-json 6.x, dnd-kit 6.x).
- This is a developer productivity tool, analogous to Postman but for RabbitMQ + protobuf.
- The proto parsing must happen at runtime (no pre-compilation step) — developers drop in `.proto` files.
- Tauri gives a native desktop window with a Rust backend handling AMQP and proto encoding; React handles the form UI.
- Team use means packaging/distribution matters — distributed via signed GitHub Releases (macOS: notarized .dmg; Linux: .AppImage + .deb + .rpm).
- v1.5 shipped 2026-05-23. Distribution pipeline complete: signed notarized macOS releases, Linux AppImage, in-app auto-update with native macOS menu integration. Repository is public.
- v1.6 (Plan Runner) in progress. Phase 21 complete: step editor authoring — full step CRUD, drag-and-drop reorder (@dnd-kit/sortable), StepFieldEditor (isolated form, auto-save debounce), import from history and block library. Plans: 4, commits: ~14.

**Known issues / tech debt at v1.5:**
- No E2E test for cross-restart theme persistence (requires full Tauri app + tauri-plugin-store integration — manual UAT is the check).
- JSON mode + map field round-trip (Flow 4) has no automated test — FormPanel.test.tsx uses scalar-only schema.
- oneof / WellKnownType / map fields not eligible for block apply (skipped with toast) — complex field type support deferred to future milestone.
- No automated browser-level DnD test for dnd-kit drag gestures — manual UAT is the current coverage.
- Phase 13 live-broker UAT deferred (8 items): ack-before-decode, AMQP metadata, multi-type decode, queue depth badge, accordion UX, RightPanel auto-switch, FIFO-500 cap, partial-error toast.
- Export format is JSON only (CSV deferred to future milestone).
- Auto-update requires public GitHub repository; no solution for teams wanting private distribution.
- Windows distribution not yet supported (no EV/OV certificate + Authenticode signing strategy).

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
| cs.allow-unsigned-executable-memory restored in Entitlements.plist | WKWebView JIT requires this under Hardened Runtime; app crashes at launch without it despite passing notarization | ✓ Good — critical fix; removing it was a false positive from security review |
| Repository made public for auto-update | tauri-plugin-updater makes unauthenticated HTTP requests; private repo causes silent 404 | ✓ Good — release artifacts contain no secrets; acceptable for a team dev tool |
| runUpdateCheck({ manual }) extracted from UpdateChecker | Startup check should be silent on failure; manual trigger should surface errors | ✓ Good — clean separation; user gets feedback from manual check, not disruptive error on startup |
| macOS menu built in setup() with #[cfg(target_os = "macos")] | Native menu item placement is the macOS convention for Check for Updates | ✓ Good — Tauri MenuBuilder + on_menu_event emits Tauri event; frontend listener calls runUpdateCheck |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

## Current Milestone: v1.6 Plan Runner

**Goal:** Let developers define, save, and execute ordered sequences of protobuf messages — each step with its own schema, target, and response config — and monitor all replies inline and in a shared feed.

**Target features:**
- Plan library: named plans saved to disk, accessible via a dedicated full-screen view
- Step editor: ordered list of steps; each step picks its own .proto file + message type, fills field values, selects a target queue/exchange, and configures response behaviour (wait for correlationId match / wait for first arrival on reply queue / no-wait with configurable delay before next step)
- Step authoring: compose from scratch, import from message history, or pull from the block library
- Plan runner: sequential execution with per-step status (Pending → Sending → WaitingResponse → Done / Error) and Run / Pause / Stop controls
- Response view: decoded response shown inline under each step that received one, plus a shared scrollable feed of all messages arriving on watched queues during the run
- Plan CRUD: create, rename, duplicate, delete; steps reorderable via drag-and-drop

---

## Current State

v1.0 shipped 2026-05-18. All 30 v1 requirements delivered across 4 phases (18 plans). The app is fully functional as a local dev tool: load a `.proto` file, fill out the form, connect to RabbitMQ, publish a binary-encoded protobuf message, and read back response messages from a reply queue.

v1.1 shipped 2026-05-18. Phase 5 (dark-mode) delivered all 4 DRK requirements. Dark mode is complete across all UI surfaces.

v1.2 shipped 2026-05-19. All 15 requirements delivered: bytes field (BFLD-01–04), map field (MFLD-01–05), JSON override toggle (JSON-01–06). The form renderer now covers all practical proto field types. One regression (MFLD-03 send-block) was introduced by a code review finding and fixed by quick task 260519-q01.

The app is feature-complete for v1 scope: all major proto field types, full send/receive cycle, connection profiles, message history, and dark mode. Next focus area to be defined in `/gsd-new-milestone`.

v1.3 shipped 2026-05-20. All 16 requirements delivered across 4 phases (11 plans): routing key autocomplete from RabbitMQ exchange bindings (PUBL-01–04), per-send delivery outcome badges (PUBL-05–08), block library with CodeMirror editor and persistence (BLK-01–05), and drag-and-drop block apply to form (BLK-06–08). The HTML5 DnD API was replaced mid-execution with dnd-kit after discovering WKWebView's dataTransfer limitation.

The app is feature-rich for the v1 scope. All proto field types supported, full send/receive cycle, connection profiles with OS keychain, message history, dark mode, block library.

v1.4 shipped 2026-05-21. All 11 requirements delivered across 3 phases (8 plans): batch drain with multi-type decode (CONS-01–04, CONS-08), live subscribe via Tauri Channel (CONS-05–07), feed filtering by routing key + content-type (FILT-01–02), and JSON export via native save dialog (XPRT-01). Tauri security hardened: strict CSP, narrowed fs:scope, unused permissions removed. Project renamed from Proto Sender to Tap.

The app now has a full consume experience: drain, subscribe, filter, and export. 8 Phase 13 live-broker verification items deferred (require running RabbitMQ instance).

Phase 16 complete 2026-05-21. Release pipeline foundation delivered: `macos-latest` runner, `Swatinem/rust-cache@v2` on both build jobs, Hardened Runtime Entitlements.plist (4 cs.* WebView keys), version bumped to 1.5.0 across all 3 config files. Two green workflow_dispatch dry-runs confirm pipeline structure (CICD-02, CICD-03 ✓). Phase 17 (macOS signing + notarization) unblocked.

---
Phase 17 complete 2026-05-23. macOS signing + notarization pipeline operational: Developer ID cert imported in CI, notarytool submits to Apple notary service, `spctl --assess` Gatekeeper gate in CI, draft release on tag push. Tag v1.5.5 verified: `accepted source=Notarized Developer ID` on clean Mac, no quarantine warning. `cs.allow-unsigned-executable-memory` restored in Entitlements.plist (was removed by WR-03; required for WKWebView JIT under Hardened Runtime). docs/release-setup.md added with 8-secret setup checklist.

v1.5 shipped 2026-05-23. All 12 distribution requirements delivered across 3 phases (8 plans): signed/notarized macOS releases, Linux AppImage, in-app auto-update with live UAT confirmed, libsecret docs, and "Check for Updates..." in macOS native menu bar. Repository is now public. Current release: v1.5.7.

Phase 19 complete 2026-05-23. Plan data contract established: `Plan`, `PlanStep`, `StepStatus`, `PublishTarget`, `ResponseMode` types exported from `src/lib/types.ts`; `usePlanStore` with CRUD + `plans.json` persistence (mirrors useBlockStore pattern exactly); 21 Vitest tests covering all D-14 conditions. Phases 20–23 can import from this foundation immediately.

Phase 22 complete 2026-05-24. Sequential plan runner delivered: `execute_step` Rust command (protobuf encode → AMQP publish → optional reply wait with correlation-ID or first-arrival matching), `usePlanRunner` hook with stop-on-error and cancellation support, `usePlanExecutionStore` Zustand store (Pending → Sending → WaitingResponse → Done/Error per step), `PlanRunBar` (Run/Stop controls + summary line), and `StepListPanel` / `StepStatusBadge` UI. Two BLOCKER gaps closed in plan 22-05: IPC field name (step_id → stepId) and inverted cancel break condition. All 9 RUN/RESP requirements satisfied.

*Last updated: 2026-05-24 after Phase 22 (Plan Runner — Sequential Execution)*
