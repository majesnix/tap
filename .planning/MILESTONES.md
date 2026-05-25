# Milestones: Tap

## v1.6 Plan Runner (Shipped: 2026-05-24)

**Phases completed:** 5 phases (19–23), 15 plans | **Requirements:** 23/23 (PLAN-01–06, STEP-01–06, RUN-01–06, RESP-01–05)

**Key accomplishments:**

1. Plan data model — `Plan` / `PlanStep` / `StepStatus` type contract, `usePlanStore` CRUD with `plans.json` tauri-plugin-store persistence, schema_version for forward compat (Phase 19)
2. Plan library view — full-screen plan panel with list sidebar, CRUD UI (create / rename / delete with AlertDialog), navigation button in sidebar; no global router needed (Phase 20)
3. Step editor — complete step authoring covering proto file + message type + all target modes + all three response modes; drag-and-drop reorder via dnd-kit PointerSensor; import from send history and block library (Phase 21)
4. Plan runner — JS runner loop with live step status badges (idle/running/done/error), all three response modes (no-wait / correlation-id / first-arrival), Run/Stop controls, `execute_plan_step` and `stop_plan` Rust commands with `CancellationToken` (Phase 22)
5. Response view — `StepReplyView` shows decoded protobuf reply inline per step; `PlanReplyFeedTab` renders a shared FIFO-500 accordion feed with ms-precision timestamps; reply dot indicator on step rows with toggle click (Phase 23)
6. Proto auto-load — selecting a plan silently re-opens any `.proto` files referenced by its steps using saved include paths; no manual re-open needed between sessions (Phase 23 bonus)
7. Scroll fix — `TabsContent` wrappers added in Phase 23 were missing `flex flex-col`, breaking `ScrollArea`'s `flex-1 min-h-0` height chain; fixed during live UAT (debug session)

**Archive:** .planning/phases/23-response-view-inline-and-shared-feed/

---

## v1.5 Distribution (Shipped: 2026-05-23)

**Phases completed:** 3 phases (16–18), 8 plans | **Requirements:** 12/12 (CICD-01–03, SIGN-01–03, PKG-01, UPD-01–04, DOC-01)
**Git range:** fc9b859..HEAD — ~50 commits, 106 files, +4,390 / −158 lines

**Key accomplishments:**

1. GitHub Actions release pipeline — signed + notarized Universal .dmg and Linux AppImage on every `v*` tag push; Rust build cache cuts macOS cold-build from ~20 min to ~5 min (Phase 16)
2. Apple Developer ID code signing + `notarytool` notarization; `spctl --assess` Gatekeeper gate in CI; first notarized release (v1.5.5) verified on clean Mac — no quarantine warning (Phase 17)
3. Ed25519 auto-update keypair wired end-to-end: tauri-plugin-updater on startup, Sonner toast with Install & Relaunch action; live UAT confirmed update installs and relaunches correctly (Phase 18)
4. Linux AppImage passes smoke test on Ubuntu 22.04 and 24.04; `docs/linux-keychain.md` covers libsecret install for Debian/Ubuntu and Fedora/RHEL (Phase 18)
5. "Check for Updates..." in macOS native menu bar (Tap application menu); sidebar button for Windows/Linux; `runUpdateCheck({ manual })` shows visible error / "up to date" toast (bonus — this session)
6. Version mislabelling fix: all binaries were shipping as 1.5.0 despite tags v1.5.1–v1.5.6; corrected by bumping Cargo.toml, tauri.conf.json, and package.json to 1.5.7

**Known deferred items at close:** 8 (see STATE.md Deferred Items — Phase 13 live-broker UAT, carried from v1.4)

**Archive:** [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) | [milestones/v1.5-REQUIREMENTS.md](milestones/v1.5-REQUIREMENTS.md)

---

## v1.4 Response Stream (Shipped: 2026-05-21)

**Phases completed:** 3 phases, 8 plans | **Requirements:** 11/11 (CONS-01–08, FILT-01–02, XPRT-01)
**Git range:** 1e6b3a4..fc0bf36 — 50 commits, 206 files, +20,585 / -2,161 lines

**Key accomplishments:**

1. Batch drain mode — `drain_messages` Rust command with multi-type first-success protobuf decode, FIFO-500 accordion feed with per-row hex viewer and queue depth badge (Phase 13)
2. Persistent AMQP consumer streaming to UI via Tauri Channel with `CancellationToken` stop control and ack-before-decode semantics (Phase 14)
3. Subscribe/Drain mode toggle with Idle/Running/Stopping/Error status badge and auto-stop on profile change or connection loss (Phase 14)
4. Routing-key substring + content-type dropdown filters (AND intersection) with "X of Y messages" count label (Phase 15)
5. JSON export of visible feed via native OS save dialog — `{ exportedAt, messageCount, messages[] }` shape, `dialog:allow-save` + `fs:allow-write-text-file` Tauri capabilities (Phase 15)
6. Tauri security hardening — strict CSP replacing `null`, `fs:scope` narrowed to `$HOME/**`, unused `fs:default` and `fs:allow-read-text-file` permissions removed (s1j)

**Known deferred items at close:** 8 (see STATE.md Deferred Items — Phase 13 live-broker UAT)

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

## v1.3 Publishing UX + Message Blocks

**Shipped:** 2026-05-20
**Phases:** 4 (Phases 9–12) | **Plans:** 11 | **Requirements:** 16/16

**Delivered:** Routing key autocomplete from live RabbitMQ exchange bindings, per-send delivery outcome badges (ACK/Returned/NACK/Timeout), a reusable named message block library with CodeMirror editor and tauri-plugin-store persistence, and drag-and-drop to merge block values into form fields.

**Key accomplishments:**

1. Routing key autocomplete — RoutingKeyCombobox pulls live bindings from `fetch_bindings` (RabbitMQ Management API), suppresses autocomplete for fanout/headers exchanges, shows exchange type badges, falls back silently to free-text when Management API is unavailable (PUBL-01–04)
2. Publisher confirms badge — mandatory=true on every publish, tokio timeout guard, Confirmation match on ACK/NACK/Returned, ephemeral badge with per-outcome auto-dismiss timers (3s ACK, 5s Returned/NACK, manual Timeout) (PUBL-05–08)
3. Block library store + editor — useBlockStore (Zustand 5.x with hydration gate + tauri-plugin-store persistence), BlockLibraryPanel two-view component (list ↔ editor), CodeMirror JSON editor, AlertDialog delete confirmation, optimistic state rollback on persistence failure (BLK-01–05)
4. Drag-and-drop block apply — dnd-kit replaces HTML5 DnD (WKWebView restriction), applyBlockRef contract on ProtoFormRenderer, dirtyFields guard prevents overwriting user-edited fields, BLK-08 Sonner warning toast for unmatched keys (BLK-06–08)
5. Phase 12 HTML5→dnd-kit mid-execution migration — HTML5 dataTransfer broken in macOS Tauri WKWebView; pivoted to dnd-kit PointerSensor after discovering the platform constraint during human UAT

**Stats:**

- Timeline: 2026-05-19 → 2026-05-20 (2 days)
- Commits: 50
- Files changed: 92 (+17,550 / -853)

**Archive:** [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) | [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)

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
