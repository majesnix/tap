# Phase 2: Connect + Publish - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers: connect Proto Sender to a live RabbitMQ broker via saved named connection profiles, select a target queue or exchange, and publish the binary-encoded protobuf message produced by Phase 1.

Specifically, Phase 2 completes requirements CONN-01 through CONN-04 (profile management + keychain password storage) and PUBL-01 through PUBL-03 (queue/exchange picker + message send). Message history, advanced AMQP properties, and multi-proto-file support are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Connection Sidebar Panel
- **D-01:** Sidebar connection section is compact — shows a profile dropdown (shadcn Select, same pattern as Message Type selector above it), a status dot, and a "Manage" gear button that opens the profile management modal.
- **D-02:** 3 connection states: Connected (green dot) / Error (red dot) / Not connected (gray dot). No separate "Testing" spinner state — testing happens synchronously during save inside the modal.
- **D-03:** First launch (no profiles saved): show a muted "Add connection" link/button — consistent with the "Load a .proto file to get started" hint style already in Sidebar.tsx.
- **D-04:** Profile switching via the sidebar dropdown (same shadcn Select pattern as Message Type). Switching connects to the selected profile.

### Profile Management Flow
- **D-05:** Profile management lives in a modal dialog (shadcn Dialog) — consistent with the IncludePathDialog pattern established in Phase 1. Lists saved profiles; a "+ New Profile" button opens an inline form within the modal.
- **D-06:** Connection test result shown inline below the form fields: spinner while testing → green checkmark + "Connected" on success, or red X + error message on failure. User can still close the modal after seeing the result.
- **D-07:** Saving a profile triggers the connection test. If the test passes, the new profile becomes the active connection immediately (save + test + activate in one action).
- **D-08:** All 6 profile fields always visible: host, port, vhost, username, password, management API port. Management API port pre-filled with 15672 (RabbitMQ default) but editable. No collapsible "Advanced" section.

### Publish Controls Placement
- **D-09:** A persistent publish bar at the top of the main panel, above the proto form. Layout: [Queue/Exchange radio toggle] [Queue or Exchange selector] [Routing key input — visible only in Exchange mode] [Send button]. User configures the target once, then iterates on the form below.
- **D-10:** Queue vs Exchange mode: radio toggle (two-option SegmentedControl). Selecting "Queue" shows the queue picker. Selecting "Exchange" shows the exchange picker + routing key text input.
- **D-11:** Management API availability indicator: status badge next to the picker — "Live" (green dot) when dropdown is populated from Management API, "Manual" (yellow dot) when Management API is unreachable and input switches to a plain text field.
- **D-12:** Send button is disabled (grayed out) when no active connection. Hovering shows tooltip: "Connect to a RabbitMQ profile to send."

### After-Send Feedback
- **D-13:** Successful send: shadcn/ui toast notification — "Message sent to [queue/exchange name]" — 3 seconds, non-blocking. Uses the existing Toaster infrastructure (shadcn/ui).
- **D-14:** Failed send: red/destructive toast variant — "Send failed: [error message]". Same location as success toast for consistency.
- **D-15:** Form retains all field values after a successful send. Users typically send the same message multiple times with small tweaks — no accidental data loss from an auto-reset.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements and Scope
- `.planning/PROJECT.md` — Project overview, core value, constraints, key decisions log
- `.planning/REQUIREMENTS.md` — Full v1 requirement list; Phase 2 covers CONN-01–CONN-04, PUBL-01–PUBL-03
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria (SC-1 through SC-5), and requirement mapping

### Technology Decisions
- `CLAUDE.md` — Complete tech stack with crate versions, alternatives considered, confidence levels, and version constraints. Critical for Phase 2: `lapin` 4.x (AMQP), `reqwest` + Management API (queue/exchange listing), `keyring` crate (OS keychain password storage), `tauri-plugin-store` (non-secret profile fields), `tauri::async_runtime::spawn` requirement (NOT bare `tokio::spawn`)

### Prior Phase Context
- `.planning/phases/01-proto-parsing-form/01-CONTEXT.md` — Layout decisions (D-01 through D-17) locked in Phase 1, particularly sidebar structure (D-01–D-03), established shadcn/ui nova preset, Zustand store pattern, IncludePathDialog modal pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/sidebar/Sidebar.tsx` — Has `<div className="flex-1" />` spacer (the connection section placeholder from D-03 in Phase 1 CONTEXT.md). Phase 2 replaces this with the connection panel (D-01–D-04).
- `src/stores/useProtoStore.ts` — Zustand store pattern to follow for a new `useConnectionStore`. Uses `create<Interface>((set) => ({...}))` with typed interface and `INITIAL_STATE` constant.
- `src/components/include-paths/IncludePathDialog.tsx` — Modal dialog pattern (shadcn Dialog) to reuse for profile management modal (D-05).
- `src/components/sidebar/FileSection.tsx` — Pattern for sections that invoke Tauri commands (dialog + IPC invoke) from sidebar sections.
- `src/components/ui/select.tsx` (shadcn Select) — Already used for Message Type dropdown; reuse for profile dropdown in sidebar (D-01, D-04).

### Established Patterns
- Zustand store: typed interface + `INITIAL_STATE` constant + `create()` in `src/stores/`
- Tauri IPC: `invoke('command_name', { ...args })` with typed return, error surfaced in store
- shadcn/ui nova preset + Tailwind 4 — no `tailwind.config.js`, uses `@tailwindcss/vite`
- `tauri-plugin-store` for persistent key-value data (already registered in `lib.rs`)
- `tauri::async_runtime::spawn` for any async Rust code spawned from Tauri commands — never bare `tokio::spawn`

### Integration Points
- `src-tauri/src/lib.rs` — Add new Tauri commands (`save_profile`, `test_connection`, `fetch_queues`, `fetch_exchanges`, `publish_message`) to `invoke_handler!`. Add new plugins (`tauri-plugin-shell` if needed; `keyring` crate is a pure Rust dep, not a Tauri plugin).
- `src-tauri/Cargo.toml` — Add: `lapin` 4.x, `reqwest` (with `json` + `rustls-tls` features), `keyring` crate for OS keychain.
- `src/App.tsx` — Add publish bar above `<FormPanel>` inside the main content area.
- `src/components/sidebar/Sidebar.tsx` — Replace `<div className="flex-1" />` with the connection section component.

</code_context>

<specifics>
## Specific Ideas

- The sidebar connection section mirrors the Message Type selector: a shadcn Select dropdown above a status + action row. Visually parallel and immediately familiar.
- The "Add connection" muted hint (D-03) should match the existing "Load a .proto file to get started" text style already in Sidebar.tsx (`text-xs text-muted-foreground`).
- Profile form inside the modal: host, port (default 5672), vhost (default "/"), username, password (masked input), management API port (default 15672). The defaults reduce friction for standard local RabbitMQ setups.
- The publish bar's radio toggle (Queue / Exchange) should default to "Queue" — most developers sending test messages target queues directly.
- Management API fallback: when the Management API port is unreachable, the dropdown silently becomes a text input with the "Manual" badge. No error dialog — just a clear affordance change.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Connect + Publish*
*Context gathered: 2026-05-17*
