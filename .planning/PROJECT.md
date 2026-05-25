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
- ✓ History full-text search — search input above type/target filters, case-insensitive substring match on message type name, queue/exchange target, and `fieldValues` key names (`_selected` excluded); AND logic with existing filters; "X of Y / 100" count label — v1.7 (Phase 24)
- ✓ Block apply for WellKnownType (Timestamp etc.) and empty map fields — dirty-field guard only for WKT; mapReplaceRegistry useRef + two-phase `{ buildPlan, commitApply }` ref; block-filled fields stay non-dirty and are re-writable by subsequent block drags — v1.7 (Phase 25)
- ✓ Block apply conflict resolution — map-key collision dialog (per-row skip/overwrite), oneof branch-switch dialog, oneof dirty-subfield dialog; commitApply Phase B atomic merge; Pitfall D fix (shouldDirty:false on all block fills) — v1.7 (Phase 26)

- ✓ Keyboard shortcuts — Send (Cmd+Enter, dual-registered for CodeMirror), Open proto (Cmd+O), Clear form (Cmd+Shift+R), Tab navigation (Cmd+1/2/3), Reload proto (Cmd+R); discoverable via title attribute on buttons — v1.8 (S01, S02)
- ✓ Form ergonomics — Clear button (RotateCcw), hover-reveal CopyButton on scalar/enum/bytes fields (Copy → Check icon swap, 1500ms feedback), Randomize button (Dices) for fill-all-empty fields — v1.8 (S01, S04)
- ✓ Randomizer — type-aware generators for scalar/enum/bytes/int64-uint64/WellKnownTypes/oneof/nested/map/repeated with MAX_RECURSION_DEPTH=5; routes through setPendingReplayValues to honor mapReplaceRegistry — v1.8 (S04)
- ✓ Proto reload — `reload_proto` Rust command with atomic DescriptorPool rebuild; Cmd+R from anywhere — v1.8 (S02)
- ✓ Recent files — useProtoStore tracks last 10 paths persisted via `tap.json`; quick-access list in FileSection with stale-entry indicator via batch `check_paths_exist` IPC — v1.8 (S02)
- ✓ Include path manager — inline path chips in FileSection with add/remove (native directory picker); auto-reload of open files on path change — v1.8 (S02)
- ✓ Connection quick-switch — compact dropdown in PublishBar with status dot; blocked with toast warning while a plan is running (plan-run guard via imperative getState().isRunning) — v1.8 (S03)
- ✓ Draft persistence — useDraftStore on tauri-plugin-store LazyStore (`drafts.json`); 200ms debounced auto-save keyed by `${filePath}::${messageType}`; restore via setPendingReplayValues with isRestoringRef 300ms guard; LRU cap at 50 entries; explicit clearDraft on Clear — v1.8 (S03)
- ✓ Field tooltips — FieldTooltip wrapper showing proto type, field number (omitted when 0 = synthetic), and cardinality on hover; applied to all 8 field components — v1.8 (S04)
- ✓ Schema explorer — collapsible sidebar tree (messages, fields, top-level enums) with click-to-select message type; recursive safety via visited-set + MAX_DEPTH=5 hard cap; reads schema directly from useProtoStore — v1.8 (S05)

## Current State

**Shipped:** v1.8 UX Polish + Proto Ergonomics (2026-05-26)

Keyboard-first workflow is now the default: Cmd+Enter sends from anywhere (including CodeMirror), Cmd+O opens the file picker, Cmd+Shift+R clears the form, Cmd+1/2/3 swaps tabs, Cmd+R reloads the loaded `.proto`. Draft persistence per `(filePath, messageType)` survives restart via `drafts.json` with LRU eviction. Recent files (cap 10) and inline include-path management remove file-picker round-trips. Randomize fills empty fields with type-appropriate values; FieldTooltip surfaces proto type/field number/cardinality on hover; SchemaExplorer renders the full pool as a click-to-select tree with cycle-safe recursion. Live-runtime UAT user-approved on the running Tauri app (localhost:1420) on 2026-05-26.

## Backlog (future milestones)

- [ ] Export history entries to JSON or CSV (HIST-V2-01)

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
- v1.6 shipped 2026-05-24. Plan Runner delivered: named plans with ordered steps, StepFieldEditor (isolated form, auto-save debounce, all field/target/response-mode types), sequential JS runner loop, all three response modes (no-wait / correlation-id / first-arrival) with Rust `execute_step` + `stop_plan` commands, StepReplyView inline decoded replies, PlanReplyFeedTab FIFO-500 shared feed, proto auto-load on plan select. +24,262 / -328 LOC, 50 commits, 5 phases, 15 plans, 176 files changed.
- v1.7 shipped 2026-05-25. Block apply completed for all complex field types: two-phase `{ buildPlan, commitApply }` ApplyBlockRef architecture; WKT + empty-map fill; batched `BlockApplyConflictDialog` for map-key collisions and oneof conflicts (skip-default, per-row skip/overwrite RadioGroup); Pitfall D fix (`shouldDirty: false` on all block-apply `setValue` calls); history full-text search with AND logic. ~108 commits, 162 files changed, +10,509 / −10,463 lines, 506/506 tests passing.
- v1.8 shipped 2026-05-26. UX polish + proto ergonomics: keyboard-first workflow (Cmd+Enter dual-registered for CodeMirror, Cmd+O / Cmd+Shift+R / Cmd+1/2/3 / Cmd+R), hover-reveal CopyButton on scalar/enum/bytes, Clear + Randomize buttons in FormPanel; proto reload via atomic `reload_proto` DescriptorPool rebuild; recent-files list (cap 10, stale detection via batch `check_paths_exist` IPC) and inline include-path manager with auto-reload; useDraftStore (drafts.json, LRU 50) with 200ms debounced auto-save and isRestoringRef-guarded restore via setPendingReplayValues for map/repeated/oneof round-trip; PublishBar connection quick-switch with plan-run guard; FieldTooltip (proto type / field number / cardinality) on all 8 field components; SchemaExplorer sidebar tree with visited-set + MAX_DEPTH=5 recursion guard, top-level EnumSchema extraction via `pool.all_enums()`. 5 slices, 19 tasks, +16,056 / −120 LOC across 279 files. Live-runtime UAT user-approved on running Tauri app (localhost:1420).
- Current release: v1.8.0 (planned).

**Known issues / tech debt at v1.7:**
- No E2E test for cross-restart theme persistence (requires full Tauri app + tauri-plugin-store integration — manual UAT is the check).
- JSON mode + map field round-trip (Flow 4) has no automated test — FormPanel.test.tsx uses scalar-only schema.
- Block apply in JSON mode guarded off (`BLK-EXT-FUTURE-01`) — complex field type support in JSON override mode deferred.
- Recursive nested-message merge from a block (`BLK-EXT-FUTURE-02`) — requires schema-aware deep merge; deferred.
- Search field values (`HIST-FT-FUTURE-01`) — decoded scalar data search deferred; requires stripping RHF internals before indexing.
- `collectFieldNames` dead export in `historyHelpers.ts` — exported but unused at runtime; live code uses `collectSearchTokens`. Not a blocker.
- No automated browser-level DnD test for dnd-kit drag gestures — manual UAT is the current coverage.
- Phase 13 live-broker UAT deferred (8 items): ack-before-decode, AMQP metadata, multi-type decode, queue depth badge, accordion UX, RightPanel auto-switch, FIFO-500 cap, partial-error toast.
- Export format is JSON only (CSV deferred to future milestone).
- Auto-update requires public GitHub repository; no solution for teams wanting private distribution.
- Windows distribution not yet supported (no EV/OV certificate + Authenticode signing strategy).
- StepFieldEditor uses useEffect for step-switch reset — creates a two-render cycle; acceptable for a dev tool.
- Reply feed timestamp is frontend-assigned (JS Date.now()), not AMQP delivery timestamp — AMQP timestamp field is optional and often unset by brokers.

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
| `{ buildPlan, commitApply }` two-phase applyBlockRef (Phase 25) | Single-function ref couldn't return plan data needed to compute `skipped` in FormPanel | ✓ Good — FormPanel derives skipped inline from `plan.toApply + plan.conflicts`; clean separation |
| mapReplaceRegistry useRef pattern for empty-map fill (Phase 25) | ProtoFormRenderer switch is frozen; `useFieldArray.replace()` must be reached without touching the switch | ✓ Good — MapField registers its `replace` fn via `onRegisterReplace` stable callback; no switch changes |
| block-filled map fields treated as dirty after first fill (Phase 25) | RHF 7.76.1 `replace()` has no `shouldDirty: false` option — marks field dirty by design | Accepted — block-filled map is "user-owned" after first fill; Phase 26 conflict prompt handles re-drag |
| `ConflictItem` discriminated union with kind-tag (Phase 26) | Union of plain objects without a kind discriminant causes unsafe field access at runtime | ✓ Good — refactored to proper discriminated union; TypeScript guards `fieldName`, `key`, `blockBranch` access |
| Conflict rows default to skip (Phase 26) | Prevents accidental data loss if user clicks Apply without reviewing each row | ✓ Good — consistent with principle of least surprise; overwrite is always opt-in |
| `shouldDirty: false` on all block-apply `setValue` calls / Pitfall D (Phase 26) | Omitting causes block-filled fields to register as user-touched, triggering false conflicts on subsequent drags | ✓ Good — invariant enforced in both Phase A and Phase B; no false conflict triggers |
| react-hotkeys-hook@^5.3.2 over native `addEventListener` (v1.8 S01) | Integrates with React lifecycle; supports `enableOnFormTags`; avoids boilerplate cleanup | ✓ Good — works in production; jsdom limitation worked around via integration tests dispatching native `KeyboardEvent` |
| Dual-register Cmd+Enter with `.cm-editor` guard (v1.8 S01) | react-hotkeys-hook does not see events inside CodeMirror's contenteditable; needed both window and editor keymaps | ✓ Good — guard at FormPanel.tsx:161 prevents double-fire; live UAT confirmed Cmd+Enter fires from CodeMirror |
| Route all form fills through `setPendingReplayValues` (v1.8 S04) | Direct `resetRef.current()` corrupts map/repeated state — only setPendingReplayValues honors the Phase 25 mapReplaceRegistry | ✓ Good — Clear, draft restore, and Randomize all share the same fill path |
| Dedicated `drafts.json` (not `tap.json`) with LRU cap 50 (v1.8 S03) | Separation of concerns (history.json, blocks.json each own their domain); LRU keeps file size bounded | ✓ Good — restart-cycle UAT user-approved 2026-05-26; drafts.json artifact contains expected complex-field shape |
| `isRestoringRef` + 300ms guard for bidirectional store ↔ form sync (v1.8 S03) | Without the guard, draft restore triggers debounced save which then races with the next user edit | ✓ Good — heuristic timeout; flagged in summary as needing update if debounce timing changes |
| Atomic `DescriptorPool` rebuild in `reload_proto` (v1.8 S02) | protox/prost-reflect DescriptorPool is append-only — incremental update not supported | ✓ Good — simple correct approach for a dev tool; reload is fast on small `.proto` sets |
| `field_number: 0` sentinel for synthetic FieldSchema rows (v1.8 S04) | Synthesized oneof/map renderers have no real proto field number; FieldTooltip omits the line when 0 | ✓ Good — invariant: 0 = synthetic everywhere in the form layer |
| SchemaExplorer recursion guard: visited-set + MAX_DEPTH=5 (v1.8 S05) | Either alone is insufficient — visited-set misses non-cyclic deep nesting; depth cap misses cycles at shallow depth | ✓ Good — Level0→Level6 test fixture halts cleanly; user-confirmed against recursive proto in live Tauri app |
| Inline `paddingLeft` instead of dynamic Tailwind classes for tree indentation (v1.8 S05) | Tailwind 4 purges dynamically-computed class names like `pl-${depth*4}` | ✓ Good — surfaced only at prod build; inline style avoids the purge entirely |
| `title` attribute over Radix Tooltip for small affordances (v1.8 S01) | Radix Tooltip's portal rendering intercepts click events under jsdom, making tests unreliable | ✓ Good — reserved Radix Tooltip for richer FieldTooltip content; title attr handles single-word tooltips |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

## Current State

v1.8 shipped 2026-05-26. Keyboard-first workflow, draft persistence, proto reload + recent files + include path manager, connection quick-switch, randomizer, field tooltips, and schema explorer all delivered with passing validation and live-runtime UAT user-approval. Ready for next milestone — run `/gsd-new-milestone` to begin.

---

*Last updated: 2026-05-26 — v1.8 shipped*
