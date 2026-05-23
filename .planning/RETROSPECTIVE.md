# Retrospective: Tap

---

## Milestone: v1.5 — Distribution

**Shipped:** 2026-05-23
**Phases:** 3 (16–18) | **Plans:** 8

### What Was Built

- GitHub Actions release pipeline: signed + notarized Universal .dmg and Linux AppImage on every `v*` tag push, with Rust build cache cutting cold-build from ~20 min to ~5 min
- Apple Developer ID code signing + `notarytool` notarization; `spctl --assess` Gatekeeper gate in CI; verified on clean Mac
- Ed25519 auto-update keypair end-to-end: startup check, Sonner toast with Install & Relaunch, live UAT confirmed
- Linux AppImage passing on Ubuntu 22.04 + 24.04; `docs/linux-keychain.md` for libsecret
- "Check for Updates..." in macOS native menu bar + sidebar button for Windows/Linux (bonus, this session)

### What Worked

- Wave-based execution kept signing (Phase 17) blocked on infrastructure (Phase 16) properly — no wasted work
- Human one-time secrets setup documented upfront (docs/release-setup.md checklist) — no back-and-forth during execution
- Silent/visible error split in `runUpdateCheck({ manual })`: startup swallows failures, manual trigger surfaces them — clean UX

### What Was Inefficient

- Version mislabelling went undetected for 6 releases (v1.5.1–v1.5.6 all shipped as 1.5.0) — no automated check that Cargo.toml / tauri.conf.json / package.json match the git tag
- Root cause of update check failure (private repo) not diagnosed until user tested with installed binary — would have been caught by curling the endpoint without auth
- REQUIREMENTS.md traceability table never updated during execution; all requirements stayed "Pending" — misleading state mid-milestone
- ROADMAP.md Phase 17/18 checkboxes not updated during execution — same tracking drift

### Patterns Established

- `runUpdateCheck({ manual })` shared async function; caller controls error visibility — reusable for future triggers
- macOS native menu via `#[cfg(target_os = "macos")]` in `setup()` + `on_menu_event` emitting Tauri events to frontend
- `cs.allow-unsigned-executable-memory` is required for WKWebView JIT under Hardened Runtime — do not remove in security reviews

### Key Lessons

1. Verify release artifact URL is accessible without auth before declaring pipeline complete — curl from unauthenticated context
2. Bump version atomically across all three files (Cargo.toml, tauri.conf.json, package.json) and verify the built binary reports the correct version
3. Keep REQUIREMENTS.md traceability up-to-date during execution — stale "Pending" rows create false alarms on readiness checks
4. Distribution milestone acceptance: test on a clean machine with no cached credentials, not just CI green

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-18
**Phases:** 4 | **Plans:** 18

### What Was Built

1. **Phase 01** — Full Tauri + Rust walking skeleton with runtime proto parsing, React dynamic form renderer covering all 16 scalar kinds, nested messages, repeated fields, enums, oneofs, WellKnownTypes, and zod validation with inline error display
2. **Phase 02** — RabbitMQ connection profiles with OS keychain password storage, connection test/activation, live queue/exchange discovery via Management API, binary protobuf publish to queues and exchanges
3. **Phase 03** — Multi-file proto tabs, AMQP properties sheet (content-type, delivery-mode, TTL, correlation-id, reply-to, custom headers), FIFO-capped message history with persistence, hex payload preview, filter + replay/resend
4. **Phase 04** — Response queue reader: consume one message from a RabbitMQ queue, decode binary protobuf payload against the loaded schema, display in a collapsible key-value tree with raw hex, copy-to-clipboard, and ack to remove

### What Worked

- **Wave-based plan structure** — each phase split into sequential waves with clear blocking dependencies made execution predictable; no plan started before its dependency delivered
- **TDD on pure functions** — extracting testable pure functions (buildPublishArgs, filterHistoryEntries, findReplayTabIndex) before writing component code made tests reliable and fast to write
- **Accumulated Context in STATE.md** — recording every surprising decision (lapin ShortString, reqwest feature rename, zod version pin, Radix jsdom workaround) meant no decision was relitigated in later plans
- **Parallel doc gathering** — research phase identified correct crate versions (protox 0.9.1, prost-reflect 0.16.3, lapin 4.7.4) upfront, avoiding mid-plan version surprises
- **shadcn/ui source-copy model** — components could be patched freely (e.g., sr-only radio pattern for jsdom) without fighting a library abstraction

### What Was Inefficient

- **REQUIREMENTS.md traceability table** never updated during development — it was stale at milestone close, showing "Pending" for requirements delivered weeks earlier; this created reconciliation work at the end
- **GAP plans** (02-GAP, 02-GAP2) added after UAT revealed missed edge cases — better UAT spec upfront would have caught modal scroll and test connection edit mode issues earlier
- **Radix UI jsdom incompatibility** discovered late in testing — a documented workaround exists but wasn't in the initial test setup guidance, causing rework across multiple test files

### Patterns Established

- `vi.hoisted()` for Vitest module-scope mock factories — required whenever `vi.mock()` factory references a variable defined at module scope
- Native `<select>` shim for Radix Select in jsdom — copy from the first test file that establishes this pattern to all subsequent ones
- `tauri::async_runtime::spawn` (not `tokio::spawn`) in all Tauri Rust code — enforced as a cross-cutting constraint in every phase plan
- `useEffect([activeProfileName])` for data-fetching tabs — mount-on-tab-focus pattern reused across PublishBar and ResponseQueuePicker
- Local draft state in sheets (AmqpPropertiesSheet) — Apply commits, dismiss discards, never reactive to store; prevents accidental mid-edit state pollution

### Key Lessons

- **Lock the IPC contract early** — `FieldKind` discriminated union had to stay in sync between Rust and TypeScript across 4 phases; a breaking change mid-milestone would have been very expensive
- **Keyring crate API surface is small but sharp** — `delete_credential()` (not `delete_password()`), `features = ["keychain"]` on macOS, `Arc<CredentialStore>` return type — these are not documented prominently; test against real OS keychain early
- **reqwest feature flag renames between minor versions** — `rustls-tls` → `rustls` between 0.12 and 0.13; always verify feature names against docs.rs for the pinned version
- **ack-before-decode is the right default for dev tools** — simpler Rust code, no re-delivery edge cases; if the decode fails the user simply retries with a new message
- **zod v4 is a breaking change for @hookform/resolvers** — pin to `^3.24.2` and document this constraint prominently; the breakage is silent (resolver returns wrong type)

### Cost Observations

- Model mix: primary Sonnet 4.6 (main execution)
- Sessions: 1 day, ~15 hours
- Notable: 50 commits, 4 complete phases, 30 requirements — all delivered in a single session; the pre-built tech stack research (CLAUDE.md) and wave-based plan structure minimized per-plan setup overhead

---

---

## Milestone: v1.1 — Dark Mode

**Shipped:** 2026-05-18
**Phases:** 1 (Phase 5) | **Plans:** 3

### What Was Built

1. **Plan 05-01** — next-themes ThemeProvider wrapping App root (`attribute="class"`, `enableSystem`), ThemeBootstrap component bridging tauri-plugin-store to next-themes localStorage with race guard via `bootstrapped` boolean flag. 4 unit tests covering load-saved, null-check, race guard, and mirror-write cases.
2. **Plan 05-02** — ThemeToggle icon cycle button (Monitor/Sun/Moon) in sidebar footer. CYCLE_ORDER drives stateless progression. Mounted guard returns disabled Button placeholder to prevent layout shift.
3. **Plan 05-03** — Human visual UAT checkpoint: walkthrough of all UI surfaces (30+ items) in dark mode. Approved.

### What Worked

- **Dark CSS variables already complete** — index.css had a full `.dark {}` block from the original build; dark mode was an integration task (wire next-themes to apply the `.dark` class on `<html>`), not a CSS authoring task. This made the scope extremely tight and predictable.
- **ThemeBootstrap pattern was clean** — the child-of-ThemeProvider pattern with a one-shot mount effect mirrors the existing useHistoryStore bootstrap pattern; no novel architecture needed.
- **Pitfall 6 documented in research** — the race condition (mirror effect writing stale localStorage to tauri-plugin-store before async read completes) was identified in the research phase and solved by design (bootstrapped flag), not discovered during testing.
- **Code review caught real issues** — 5 review findings (WR-01 through WR-03, CR-01, IN-01/IN-02) were all fixed before merging; none were regressions.

### What Was Inefficient

- **REQUIREMENTS.md traceability table left stale** — same pattern as v1.0: requirements stayed "Pending" throughout development and were only reconciled at milestone close. A post-plan hook to update the traceability table would eliminate this.
- **36 commits for 3 plans** — many are docs/review/fix commits. The review-fix cycle added ~8 commits that could have been squashed.

### Patterns Established

- **ThemeBootstrap pattern**: child of ThemeProvider, reads tauri-plugin-store on mount, gates mirror writes on `bootstrapped` flag — reusable for any async store bootstrap that must override a synchronous localStorage default
- **Mounted guard for Radix/next-themes**: return disabled same-size placeholder on pre-mount to prevent layout shift; reuse this for any component that depends on `useTheme()` or similar context that isn't available on first render

### Key Lessons

- **next-themes is the right default** — if Tailwind dark mode is configured via `class` strategy, next-themes wires everything automatically (OS preference, localStorage, class application). Do not reach for custom matchMedia code first.
- **DRK-04 (visual UAT) required no code** — the plan was a human checklist gate, not a coding task. This is the right model for visual regression checks when no snapshot testing framework is set up.
- **Race conditions in bootstrap bridges are predictable** — any component that reads an async store on mount to override a synchronous default (localStorage) needs a guard. Document this as a standard pitfall for any future store bootstrap.

### Cost Observations

- Model mix: primary Sonnet 4.6 (main execution)
- Sessions: ~3 hours (evening session, same day as v1.0)
- Notable: 1 phase, 3 plans, 4 requirements, 36 commits — a focused feature addition with no new Rust backend changes

---

## Milestone: v1.2 — Form Improvements

**Shipped:** 2026-05-19
**Phases:** 3 (Phases 6–8) | **Plans:** 7

### What Was Built

1. **Phase 06** — BytesField component with RFC 4648 base64 validation, UTF-8 text helper popover, byte count label, inline error for URL-safe chars; ProtoFormRenderer pre-dispatch branch; ScalarField bytes handling removed
2. **Phase 07** — MapField full-stack: Rust `FieldKind::Map` + `Value::Map` encoder (4 unit tests), TypeScript FieldKind union + ProtoFormRenderer pre-dispatch branch, MapField React component (useFieldArray rows, typed key dispatch, duplicate-key detection, renderValue delegation), human UAT (enum + message value types confirmed)
3. **Phase 08** — JSON Override Toggle: JsonEditor (CodeMirror + dark/light theme), FormPanel Braces button + entrySnapshot capture + invalid-JSON error banner + unknown-field toast, two-way sync via pendingReplayValues signal
4. **Quick task 260519-q01** — MFLD-03 regression fix: restore `register+trigger` guard field in MapField, add `!encodeError` to PublishBar canSend

### What Worked

- **Wave-based plan structure (again)** — Phase 07's 4-wave plan (Rust → TS wiring → React component → Human UAT) ensured no frontend was written against unverified Rust encoding
- **Pre-dispatch branch pattern** — established in Phase 06, reused verbatim in Phase 07; new field types added without touching the frozen switch
- **Reusing pendingReplayValues signal** — JSON-to-form sync reused the existing HIST-02 replay path; no new signal mechanism needed; recognized from prior research
- **Two-layer validation on bytes** — char-set regex rejects URL-safe chars explicitly; `.refine()` catches structural invalidity; `safeParse().success` gate before `atob()` prevents InvalidCharacterError during typing
- **Human UAT for visual + end-to-end** — enum-valued and message-valued map encoding could not be proven by unit test; human UAT gave fast coverage of the path that automated tests couldn't reach

### What Was Inefficient

- **MFLD-03 regression introduced by code review** — the Phase 7 REVIEW-FIX IN-04 finding was incorrect: `setError` on an unregistered field does not reliably keep `formState.isValid = false`. The reviewer's claim "no Controller is needed" was wrong. This cost a full quick-task cycle (planning + execution + test run). The root lesson: trust the test, not the review finding — the failing test was visible in the phase run output.
- **REQUIREMENTS.md traceability stale again** — third milestone in a row where all requirements stayed "Pending" throughout development. Pattern is clear: REQUIREMENTS.md is a pre-milestone artifact only; it is never updated during execution.
- **07-VERIFICATION.md not updated after human UAT** — the verifier wrote the VERIFICATION.md before human UAT ran, with a correct `human_needed` status, but the status was never updated to `passed` after the human UAT resolved everything. The audit-milestone step caught this, but it added cleanup work at close.

### Patterns Established

- **`register(name, { validate }) + trigger(name)` is the correct RHF pattern for virtual guard fields** — `setError` on unregistered fields is unreliable in `mode: onChange`; always use the registered validate rule + trigger approach for any guard field that must keep `formState.isValid` false
- **Two-layer blocking gate** — RHF `formState.isValid` gate (frontend) + Rust encode error gate (`encodeError` in `canSend`) — neither layer alone is sufficient; both are needed for robust blocking
- **Pre-dispatch branch before frozen switch** — adding new proto field type renderers goes in a pre-dispatch `if` block before ProtoFormRenderer's switch body; switch is FROZEN
- **entrySnapshot pattern** — capture `latestValues ?? {}` at toggle entry; Discard always restores the entry snapshot, not current state; prevents "infinite undo" confusion

### Key Lessons

- **When a test fails and a code review says "not needed" — trust the test** — MFLD-03: the test `formState.isValid is false while duplicates exist` was failing. The reviewer said the Controller was not needed. The test was right; the review was wrong. A failing test is primary evidence; a review claim is secondary.
- **VERIFICATION.md should be written in two passes** — initial automated pass, then a follow-up pass after human UAT resolves the `human_needed` items. Writing it in one pass forces a stale status into the file.
- **CodeMirror + jsdom needs a stub** — `@uiw/react-codemirror` uses DOM APIs not available in jsdom; always stub it as a `<textarea data-testid="codemirror-stub">` in test environments
- **React hooks rule is a real runtime error** — `useTheme` called inside a conditional early-return block in FormPanel caused a runtime error; always call hooks at the top of the component, before any early returns

### Cost Observations

- Model mix: primary Sonnet 4.6
- Sessions: 1 day (~7 hours)
- Notable: 3 phases + 1 quick-task fix, 15 requirements, 83 commits — similar velocity to v1.0; the GSD workflow overhead is low relative to execution time

---

## Milestone: v1.3 — Publishing UX + Message Blocks

**Shipped:** 2026-05-20
**Phases:** 4 (Phases 9–12) | **Plans:** 11

### What Was Built

1. **Phase 09** — RoutingKeyCombobox component with live bindings from `fetch_bindings` Rust command, ExchangeSummary struct for type-aware display, exchange type badges, silent fallback for fanout/headers and Management API unavailability
2. **Phase 10** — PublishOutcome Rust struct (ack/nack/returned/timeout), mandatory=true on all publishes, tokio 5s timeout guard, ephemeral ACK/Returned/NACK/Timeout badge in PublishBar with per-outcome auto-dismiss timers
3. **Phase 11** — useBlockStore (Zustand 5.x + tauri-plugin-store persistence + hydration gate), BlockLibraryPanel two-view component (list ↔ CodeMirror editor), AlertDialog delete confirmation, optimistic state rollback on persistence failure, AppLayout integration with FormPanel toggle button
4. **Phase 12** — applyBlockRef contract on ProtoFormRenderer, FormPanel drop zone with dnd-kit DndContext + DragOverlay at AppLayout level, dirtyFields guard for BLK-07, BLK-08 Sonner warning toast for unmatched keys; pivoted from HTML5 DnD to dnd-kit mid-execution due to WKWebView platform constraint

### What Worked

- **Mid-execution technology pivot** — discovered HTML5 dataTransfer is broken in WKWebView (macOS Tauri) during human UAT on Phase 12; replaced with dnd-kit PointerSensor in a single fix commit without revisiting the plan structure. The fact that applyBlockRef was a separate concern from the DnD mechanism made the swap clean.
- **applyBlockRef as a decoupled contract** — wiring the block apply capability as a ref on ProtoFormRenderer (not a store action or prop drilling) kept the frozen switch untouched and the FormPanel drop zone independently testable
- **Research front-loaded platform risks** — Phase 12 RESEARCH.md documented the WKWebView DnD issue; the fix was expected, just needed to be triggered by live UAT
- **Optimistic rollback pattern (Phase 11)** — applying the pattern from the code review (WR-04) before shipping made the store's persistence contract correct from day one; no user would have seen a state desync

### What Was Inefficient

- **REQUIREMENTS.md traceability stale again** — fourth milestone in a row. PUBL-01–04 and BLK-06–08 remained "Pending" throughout all of Phases 9 and 12. The pattern is completely consistent: REQUIREMENTS.md is a pre-milestone artifact; it is never updated during execution. Should be either eliminated (rely on ROADMAP.md coverage table) or auto-updated by the execution hook.
- **DnD pivot cost** — replacing HTML5 DnD with dnd-kit after execution cost ~2 fix commits and a Phase 12 code review pass. The WKWebView limitation was documented in RESEARCH.md and MEMORY.md but not caught before execution started. A platform-specific DnD smoke test in the wave gating could have triggered the pivot earlier.
- **Shadcn close button in DragOverlay** — required a separate fix commit (a21e99c) after the overlay was wired. The close button's z-index interacts with the DragOverlay in a non-obvious way; this should be a documented pitfall for future DnD work.

### Patterns Established

- **dnd-kit PointerSensor pattern for Tauri/WKWebView** — use dnd-kit (not HTML5 DnD) for all drag-and-drop in Tauri apps; mount DndContext + DragOverlay at the layout root; use useDraggable/useDroppable in leaf components
- **applyBlockRef pattern** — expose a `ref` on a frozen renderer component to wire external mutation capabilities (block apply, future: AI-fill) without modifying the frozen switch
- **Optimistic CRUD with rollback** — apply store mutation optimistically, catch persistence errors, rollback to previous state and surface error UI; pattern is now established in useBlockStore and reusable for any store with tauri-plugin-store backend
- **DragOverlay at layout root** — mount DndContext and DragOverlay at the AppLayout level (not inside a scroll container) to avoid z-index clipping; pass drag state down to leaf components via context

### Key Lessons

- **Platform-specific DnD constraints must be tested in the real Tauri window, not just jsdom** — HTML5 `dataTransfer.setData()` appears to work in jsdom/browser but is silently broken in WKWebView. Add a manual DnD smoke test to Phase UAT for any drag-related feature in Tauri.
- **The REQUIREMENTS.md staleness pattern is now structural, not accidental** — four consecutive milestones with the same issue. The right fix is probably to remove the live-update expectation from the workflow and treat REQUIREMENTS.md as a pre-milestone definition artifact only, updated at archive time.
- **dnd-kit DragOverlay must escape scroll container subtrees** — if DndContext is mounted inside a ScrollArea, the DragOverlay clips to the scroll boundary. Always mount at the layout root.

### Cost Observations

- Model mix: primary Sonnet 4.6
- Sessions: 2 days (2026-05-19 → 2026-05-20)
- Notable: 50 commits, 4 phases, 11 plans, 16 requirements — the block library (Phases 11–12) was the densest work; Phase 12 had a mid-execution platform pivot but recovered cleanly within the same day

---

---

## Milestone: v1.4 — Response Stream

**Shipped:** 2026-05-21
**Phases:** 3 (Phases 13–15) | **Plans:** 8

### What Was Built

1. **Phase 13** — Batch drain mode: `drain_messages` Rust command with ack-before-decode semantics, multi-type first-success protobuf decode (`decodedAs`), FIFO-500 accordion feed with per-row hex viewer, queue depth badge, Decode-as multi-select combobox
2. **Phase 14** — Live subscribe mode: `start_subscribe`/`stop_subscribe` Rust commands with `CancellationToken`, Tauri Channel streaming, `SubscribePanel` component with Idle/Running/Stopping/Error badge, auto-stop on profile change/disconnect, 3 UAT-discovered gap fixes (Error retry, Response-panel stay, profile-change Error→Idle reset)
3. **Phase 15** — Feed filtering (routing key substring + content-type dropdown, AND logic, "X of Y messages" count), JSON export via native OS save dialog (`dialog:allow-save` + `fs:allow-write-text-file`), strict CSP security hardening, `fs:scope` narrowed to `$HOME/**`
4. **Project rename** — "Proto Sender" → "Tap" across all source files, Tauri config, AMQP consumer tag, tauri-plugin-store path, and ~90 planning docs

### What Worked

- **Tauri Channel pattern** — `Channel<DrainResult>` from `@tauri-apps/api 2.11.0` was the right mechanism for streaming subscribe events; no custom event system needed; the mock pattern (`mockImplementation(function(cb){this.cb=cb})`) was identified early and reused
- **Phase 14 UAT gap closure** — 3 UAT gaps (GAP-1 Error recovery, GAP-2 panel navigation, GAP-3 Error-state profile switch) were caught in human UAT and fixed in a dedicated plan (14-04) before close; the tight feedback loop kept gaps from becoming tech debt
- **Security quick task** — the pre-close audit surfaced a pending security hardening task (s1j) that the plan had become stale on. Adjusted implementation kept Phase 15's `writeTextFile` usage while removing the genuinely unused permissions.
- **Wave-based parallel plan execution** — all 3 v1.4 phases had well-isolated waves; no cross-plan blocking issues

### What Was Inefficient

- **Phase 13 live-broker UAT deferred** — 8 verification items require a live RabbitMQ broker and were deferred to close. These are the only items without human sign-off. A RabbitMQ Docker Compose setup in the repo would eliminate this recurring blocker.
- **Stale security plan** — the s1j security task was authored before Phase 15 added `writeTextFile` usage. The plan called for removing the entire `tauri-plugin-fs` plugin, which would have broken export. The discrepancy required investigation and a scope adjustment before execution.
- **Project rename scope** — renaming ~90+ planning docs required a bulk `find | xargs sed` pass and manual targeted edits for source files. A `project.name` field in `config.json` propagated to all templates would have avoided this.
- **tauri-plugin-store path rename is breaking** — renaming `proto-sender.json` to `tap.json` means existing users lose their saved data (connection profiles, theme). This was accepted but should have been flagged as a migration concern earlier.

### Patterns Established

- **`Channel<DrainResult>` mock pattern** — `mockImplementation(function(cb){this.cb=cb})` for Tauri Channel constructor in Vitest; allows `channel.cb({...})` to drive streaming events in tests
- **`prevProfileRef` for profile-change auto-stop** — both `activeProfileName` (store) and `profileName` (prop) resolve to the same value in the same render (co-update); ref tracks the previous value across renders for reliable transition detection
- **SubscribePanel Start/Stop mutually exclusive** — Stop button replaces Start when Running/Stopping; cleaner than disabling Start (disabling creates confusion about why the button is unresponsive)
- **Three-state sentinel for nullable filter** — `null` = All, `"__none__"` = messages with null content-type, string = exact match; avoids overloading a nullable value with two different semantics

### Key Lessons

- **Tauri capability permissions are not verifiable programmatically** — `dialog:allow-save` and `fs:allow-write-text-file` can be checked statically, but runtime enforcement only fires in a built Tauri app. Tests that mock both plugins cannot catch missing capability declarations. Keep a manual "capability smoke test" in the UAT plan for any new Tauri plugin usage.
- **GAP plans are cheaper than tech debt** — Phase 14's 3 UAT gaps were each a 20-line targeted fix. Shipping without fixing them would have created confusing user-facing bugs (Start button dead in Error state, Response tab navigating away during subscribe). The UAT-gap-as-phase pattern is worth the overhead.
- **Security plans must be versioned with the milestone they were written for** — s1j was written before Phase 15 existed. A security plan that lists "remove plugin X" without knowing the next phase uses it will create regressions if applied blindly.

### Cost Observations

- Model mix: primary Sonnet 4.6
- Sessions: 1 day (2026-05-21)
- Notable: 50 commits, 3 phases, 8 plans, 11 requirements, +20,585 / -2,161 LOC; project renamed mid-close; security hardening applied in parallel with milestone archival

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 | v1.2 | v1.3 | v1.4 |
|--------|------|------|------|------|------|
| Phases | 4 | 1 | 3 | 4 | 3 |
| Plans | 18 | 3 | 7 | 11 | 8 |
| Commits | 50 | 36 | 83 | 50 | 50 |
| LOC added | ~42,800 | +3,234 | +10,173 | +17,550 | +20,585 |
| Requirements delivered | 30/30 | 4/4 | 15/15 | 16/16 | 11/11 |
| GAP/quick-task fixes | 2 | 0 | 1 | 0 | 1+3 (s1j + Phase 14 gaps) |
| Duration | 1 day | ~3 hours | ~7 hours | 2 days | 1 day |
| Regression from code review | 0 | 0 | 1 (MFLD-03) | 0 | 0 |
| Mid-execution pivot | 0 | 0 | 0 | 1 (HTML5→dnd-kit) | 0 |
| Deferred live-broker UAT | — | — | — | — | 8 (Phase 13) |
