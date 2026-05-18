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

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 4 | 1 |
| Plans | 18 | 3 |
| Commits | 50 | 36 |
| LOC added | ~42,800 | +3,234 |
| Requirements delivered | 30/30 | 4/4 |
| GAP plans | 2 | 0 |
| Duration | 1 day | ~3 hours |
