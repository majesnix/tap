# Retrospective: Proto Sender

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

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 | v1.2 |
|--------|------|------|------|
| Phases | 4 | 1 | 3 |
| Plans | 18 | 3 | 7 |
| Commits | 50 | 36 | 83 |
| LOC added | ~42,800 | +3,234 | +10,173 |
| Requirements delivered | 30/30 | 4/4 | 15/15 |
| GAP/quick-task fixes | 2 | 0 | 1 |
| Duration | 1 day | ~3 hours | ~7 hours |
| Regression from code review | 0 | 0 | 1 (MFLD-03) |
