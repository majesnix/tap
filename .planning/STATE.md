---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Plan Runner
status: planning
stopped_at: ""
last_updated: "2026-05-23T00:00:00.000Z"
last_activity: 2026-05-23
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Tap

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-23 — Milestone v1.6 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23 for v1.6)

**Core value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.
**Current focus:** v1.6 Plan Runner — defining requirements

## Phase History

*(v1.0–v1.5 phase history archived — see milestones/ directory)*

---

## Accumulated Context

### Key Decisions Logged (v1.0–v1.4 Archive)

- prevProfileRef pattern for profile-change auto-stop: both store activeProfileName and profileName prop update to same value in same render (co-update) — prop comparison always false; ref tracks previous value across renders
- SubscribePanel Start/Stop buttons mutually exclusive (Stop replaces Start when Running/Stopping) — cleaner UX than disabling Start
- Subscribe mode: ResponseQueuePicker always visible (queue/decode shared per D-04); SubscribePanel added as sub-row
- Channel<DrainResult> class mock in tests: must use mockImplementation(function(cb){this.cb=cb}) to support new Channel(cb) constructor syntax
- WellKnownTypeField prop kept as 'path' (not 'fieldPath') — ProtoFormRenderer dispatch is frozen
- Duration validation triggers on blur — mode: onBlur in both form and test wrapper
- load() without options — StoreOptions.defaults required when passing options, defaults suffice
- Include path key uses INCLUDE_PATH_KEY_PREFIX constant for DRY pattern
- Stack confirmed: protox + prost-reflect (Rust), lapin (AMQP), react-hook-form + zod + shadcn/ui (React)
- Import resolution: explicit include-path list (not auto-detect from file location)
- oneof rendering: radio group with conditional branch visibility
- Password storage: OS keychain via `keyring` crate — never in config files
- Recursive form depth: hard cap at 5 levels with collapse placeholder
- prost_reflect::prost::Message is the correct import (not bare prost::Message)
- DescriptorPool clone() is O(1) (Arc-backed internally)
- ProtoFormRenderer is FINAL in Wave 1 — Wave 2 replaces field component stubs only
- zod pinned to ^3.24.2 (not v4) — @hookform/resolvers incompatible with zod v4
- shadcn nova preset used (not zinc — CLI removed --preset=zinc in newer versions)
- macOS sandbox disabled in Entitlements.plist (required for arbitrary file read as dev tool)
- Single Controller pattern (not two Controllers) for input + error display in ScalarField
- mode: onBlur on useForm — required for blur-triggered per-field validation
- 64-bit int fields (int64/uint64/sint64/sfixed64/fixed64) use type="text" with regex (JS precision)
- Used path prop (not fieldPath) — ProtoFormRenderer dispatch is frozen and uses path
- Mocked shadcn Select with native <select> in tests — Radix UI portal/pointer events incompatible with jsdom
- useMemo with empty deps for branchNames — branches array is stable per field schema lifetime
- buildDefaultValues enum default: values[0].number (integer, not name string); oneof: first branch name
- useState (not useRef) for debounce input — ref mutation is invisible to React, state triggers re-renders
- encodeMessage in useEffect([debouncedValues]) not in handleValuesChange — separation of form capture vs IPC dispatch
- fireEvent.change over userEvent.type under vi.useFakeTimers — userEvent.type hangs in Vitest 4.x fake timer environment
- vi.clearAllMocks() required in beforeEach to isolate mock call counts across tests
- apple-native-keyring-store requires features=["keychain"] on macOS (no default features on macOS)
- keyring-core 1.x: Store::new() returns Arc<CredentialStore>; set_default_store takes Arc (not Store::default())
- keyring-core 1.x: delete_credential() method (not delete_password() from older keyring v3 API)
- lapin Connection::close() takes ShortString not &str — use "".into() for string literal arg
- URI test assertion must check path segment, not full URI — amqp:// always contains // in scheme
- activateProfile/testConnection IPC args use { profileName } camelCase (consistent with other connection commands)
- Default mockInvoke in beforeEach must return [] for list_profiles to prevent profiles.length crash
- getAllByText vs getByText when ConnectionTestResult + status dot both render "Connected"
- reqwest 0.13 feature is 'rustls' not 'rustls-tls' — feature was renamed between 0.12 and 0.13
- ManagementApiAuthFailed display message must be exact: 'Management API authentication failed: wrong credentials (HTTP 401)'
- Auth error test must mock IPC rejection (not just seed store state) — useEffect fires on mount and clears seeded error on successful fetch
- setManagementAuthError(null) only on successful fetch — not proactively at fetch start
- RadioGroup items use sr-only pattern with htmlFor label for accessible radio role in jsdom
- lapin basic_publish takes ShortString — use .into() on &str args (not &String or .as_str())
- vi.hoisted() required for toastMock — plain const at module scope fails Vitest hoisting
- buildPublishArgs exported as pure function for testable PUBL-01/PUBL-02 routing logic
- load_profile_with_password changed to pub(crate) for use from publish.rs
- handleTestOnly does NOT call setActiveProfile/setConnectionStatus (profile saved but not activated)
- handleRetest DOES update global connectionStatus (re-test is authoritative for active profile)
- Blank-password guard in handleSave (frontend) required because Rust save_profile always writes to keychain unconditionally
- ConnectionProfile type uses snake_case (management_port/management_ssl), not camelCase
- Plain stored activeFilePath + schema (not getters) — all mutating actions keep them in sync explicitly
- True no-op addOrActivateFile: return s unchanged when same file is already active (prevents spurious re-renders)
- latestValues lifted to Zustand store (D-07 / Option A) — FormPanel calls setLatestValues via getState()
- resetRef sibling approach for ProtoFormRenderer: optional prop, renderer wires methods.reset to it post-mount
- Close button as sibling of TabsTrigger (not nested) — avoids invalid nested button HTML
- 20-file cap enforced in addOrActivateFile with toast.error (T-03-01-03 mitigate)
- Local draft state in AmqpPropertiesSheet: Apply commits, dismiss discards (not reactive to store)
- TTL typed as number|null (not string sentinel) — matches Rust Option<u32> across IPC boundary
- Headers as Vec<(String,String)> in Rust / Array<[string,string]> in TS per D-08 (no AmqpHeader struct)
- Default content_type changed to application/octet-stream per D-04 (was application/x-protobuf)
- Delivery mode uses Switch component (not RadioGroup) per plan UI-SPEC
- InvalidInput AppError variant added for delivery_mode Rust validation
- activeTab is local state in RightPanel (not global store) — Pitfall 6 from plan
- lastSendAt only set on success — RightPanel auto-switch to History only fires on successful send
- Edge-detection refs (prevLastSendAt, prevPendingReplay) for useEffect signals in RightPanel
- historyLoaded boolean gate in appendEntry prevents pre-hydration race (T-03-03-06 mitigate)
- filterHistoryEntries and findReplayTabIndex extracted as pure functions for testability (not inline)
- Resend shown for ALL entries regardless of status — D-03 guarantees payloadBytes always captured
- Task 3 TDD executed before Task 1 to satisfy import dependency on historyHelpers
- ConsumeResult uses #[serde(rename_all = "camelCase")] — Tauri does not auto-convert return value fields; hex_string must serialize as hexString to match TS interface
- use_proto_field_name=true on SerializeOptions — users see .proto field names (snake_case), not lowerCamelCase transforms
- stringify_64_bit_integers=true — JS precision safety for int64/uint64 fields
- fetchQueues mock in ResponseTab.test.tsx uses mockRejectedValue to keep isLiveMode=false — preserves existing test assertions on Input "Queue name" placeholder
- Local useState for managementAuthError in ResponseQueuePicker (not useConnectionStore) — parallel impl pattern, not shared state
- ResponseQueuePicker: 401 auth error uses "authentication failed" substring match (same as PublishBar pattern)
- v1.2 architecture: ProtoFormRenderer dispatch is FROZEN — new field types added as pre-dispatch branches or new case in renderField switch
- v1.2 architecture: react-hook-form reset() not setValue() for JSON-to-form sync — setValue bypasses useFieldArray internal refs
- v1.2 architecture: zod bytes regex must use standard base64 alphabet (+/), not URL-safe (-_)
- v1.2 architecture: map rows stored as Array<{key, value}> via useFieldArray — never as Record<K,V> (silent JS deduplication)
- v1.2 architecture: next-themes resolvedTheme prop used for JSON editor dark mode (already in use for Phase 5)
- v1.2 stack: @uiw/react-codemirror ^4.25.9 + @codemirror/lang-json ^6.0.x — only new npm packages for the milestone
- dnd-kit PointerSensor over HTML5 DnD — WKWebView (macOS Tauri) breaks HTML5 dataTransfer API
- DndContext + DragOverlay mounted at AppLayout level — overlay needs to escape DOM subtree for correct z-index
- applyBlockRef contract (not store-integrated dirtyFields) — ProtoFormRenderer switch is frozen; ref wiring is the safe extension point
- Two-view local state (PanelView list/editor) in BlockLibraryPanel — panel view is local UI state, not shared across components

### Key Decisions for v1.5

- cs.allow-unsigned-executable-memory required in Entitlements.plist for WKWebView JIT under Hardened Runtime; removing it causes launch crash despite passing notarization
- Repository must be public for unauthenticated tauri-plugin-updater latest.json fetch; private repo causes silent 404
- runUpdateCheck({ manual }) extraction: startup auto-check stays silent on failure; manual trigger shows visible error/up-to-date toast
- macOS Check for Updates in native menu bar: built in setup() with #[cfg(target_os = "macos")], Tauri MenuBuilder, emits "check-for-updates" event to UpdateChecker listener
- Version must be bumped in Cargo.toml, tauri.conf.json, AND package.json — all three must match for releases to show correct version

### Roadmap Evolution

- Phases 16–18 added (2026-05-21): v1.5 Distribution — Pipeline Foundation, macOS Signing + Notarization, Auto-Update + Linux + Docs

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-19:

| Category | Item | Status | Note |
|----------|------|--------|------|
| uat_gaps | Phase 07: 07-HUMAN-UAT.md | resolved (0 pending scenarios) | False positive — UAT is resolved; SDK flags all HUMAN-UAT.md files |
| quick_tasks | 260519-q01-mfld03-send-block-fix | complete (commit 2d1a027) | SDK shows `missing` due to prefixed SUMMARY filename convention |

Items acknowledged and deferred at milestone close on 2026-05-21 (v1.4 Response Stream):

| Category | Item | Status | Note |
|----------|------|--------|------|
| verification_gaps | Phase 13: 13-VERIFICATION.md | human_needed — 8 items | Requires live RabbitMQ broker: ack-before-decode, AMQP metadata accuracy, multi-type decode, queue depth refresh, accordion UX, RightPanel auto-switch, FIFO-500 cap, partial-error toast |
| uat_gaps | Phase 14: 14-HUMAN-UAT.md | passed (SDK false positive) | SDK flags HUMAN-UAT.md files regardless of status |
| uat_gaps | Phase 15: 15-HUMAN-UAT.md | passed (SDK false positive) | SDK flags HUMAN-UAT.md files regardless of status |
| quick_tasks | 260519-s1j-harden-tauri-security-remove-unused-fs-p | complete (commit cf7bbc6) | SDK shows `missing` due to prefixed SUMMARY filename convention |

## Quick Tasks Completed

| ID | Slug | Description | Commit | Date |
|----|------|-------------|--------|------|
| 260519-q01 | mfld03-send-block-fix | Fix MFLD-03 — restore send-button blocking on duplicate map keys | 2d1a027 | 2026-05-19 |
| 260519-s1j | harden-tauri-security-remove-unused-fs-p | Narrow fs:scope to $HOME, add strict CSP, remove unused fs permissions | cf7bbc6 | 2026-05-21 |

## Session Continuity

Last updated: 2026-05-23 — Milestone v1.6 Plan Runner started
Stopped at: Requirements being defined
Next action: Complete requirements, then run `/gsd-plan-phase 19` to start execution
