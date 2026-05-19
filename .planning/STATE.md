---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Form Improvements
status: planning
stopped_at: Phase 7 context gathered
last_updated: "2026-05-19T07:41:06.683Z"
last_activity: 2026-05-19
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 100
---

# Project State: Proto Sender

## Current Phase

Phase: 7
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-19

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-18 after v1.1 milestone)

**Core value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.
**Current focus:** Phase 06 — bytesfield

## Phase History

- Plan 01-01 (Walking Skeleton): COMPLETE — commits 875defd, 96393ae, 878339e
- Plan 01-02 (ScalarField Full Implementation): COMPLETE — commits caff256, f5fda9f
- Plan 01-03 (NestedMessageField + RepeatedField): COMPLETE — commits a7c0614, 783a5bf
- Plan 01-04 (EnumField + OneofField): COMPLETE — commits d4d8acf, 16405ff, 908f55b, fd0c914, 9e7dd5a
- Plan 01-05 (WellKnownTypeField + Include Path Persistence): COMPLETE — commits 60ee94e, ff7a8e3
- Plan 01-06 (FormPanel Debounce Fix): COMPLETE — commits e230aff, 2e9bd3f
- Plan 02-01 (Connection Profiles — Slice 1): COMPLETE — commits 7253b00, b00613b, b3b608c
- Plan 02-02 (Connection Test + Activation — Slice 2): COMPLETE — commits f5860cd, f5d2c9b
- Plan 02-03 (PublishBar — Live Queue/Exchange Picker — Slice 3): COMPLETE — commits c49c8f2, 740e67f, 91fe919
- Plan 02-04 (Publish Message — Slice 4): COMPLETE — commits 8729375, b6b3ff6
- Plan 02-GAP (UAT Gap Fix — Test Connection + Edit Mode): COMPLETE — commits ef4d928, da68a62, 3f8fd65, 504fd63, 822dbd8, c25906c
  - Plan 02-GAP2 (UAT Gap Fix — Modal Scroll Layout): COMPLETE — commit 1398733
- Plan 03-01 (Multi-file Tabs + Store Signal Fields): COMPLETE — commits 1e6ab26, be6f0e4, 2e9cf6c
- Plan 03-02 (AMQP Properties): COMPLETE — commits ed583c8, bbb5ae5, 1ea0ad9
- Plan 03-03 (Message History): COMPLETE — commits 7d02068, 5fb9aa5, d3ca824, e63736b
- Plan 03-04 (History Filter + Replay/Resend): COMPLETE — commits c3d0d8d, a651885, 5141d6a
- Plan 04-01 (Response Queue Reader — Core Slice): COMPLETE — consume_message Rust command + useResponseStore + ResponseTab + RightPanel 3rd tab
- Plan 04-02 (Response Queue Reader — UX Polish): COMPLETE — ResponseQueuePicker (Live/Manual) + ResponseDecodedView (collapsible tree) + ResponseHexSection (copy buttons) + ResponseTab composition

---

## Performance Metrics

- Plans completed: 15
- Requirements delivered: FORM-01 (fully), FORM-06, FORM-07 delivered by plan 01-02; FORM-02, FORM-03, FORM-08 delivered by plan 01-03; FORM-04, FORM-05 delivered by plan 01-04; FORM-09, PROT-02 delivered by plan 01-05; FORM-01 (debounce gate) delivered by plan 01-06; CONN-01, CONN-04 delivered by plan 02-01; CONN-02, CONN-03 delivered by plan 02-02; PUBL-03 delivered by plan 02-03; PUBL-01, PUBL-02 delivered by plan 02-04; CONN-01 (UAT gap closure) delivered by plan 02-GAP; PROT-03, PROT-04 delivered by plan 03-01; PUBL-04 delivered by plan 03-02; HIST-01, HIST-03 delivered by plan 03-03; HIST-02, HIST-04 delivered by plan 03-04
- Phases completed: 0/3 (v1.2 not yet started)

## Accumulated Context

### Key Decisions Logged

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

### Roadmap Evolution

- Phase 4 added (2026-05-18): Response Queue Reader — select reply queue, consume + deserialize incoming protobuf message, ack to remove from queue (RESP-01 to RESP-05)
- Phases 6-8 added (2026-05-19): v1.2 Form Improvements — BytesField (Phase 6), MapField (Phase 7), JSON Override Toggle (Phase 8)

### Active TODOs

- Run `/gsd-plan-phase 6` to begin planning Phase 6 (BytesField)

### Blockers

(none)

### Research Flags

- shadcn/ui + Tailwind 4 Vite config: VERIFIED — @tailwindcss/vite plugin works, no tailwind.config.js
- macOS arbitrary file read entitlements: Entitlements.plist approach confirmed (bundle.macOS.entitlements path string)
- Linux keychain (libsecret): still needs install notes for distribution
- v1.2 stack additions: @uiw/react-codemirror v4.x (CodeMirror 6 wrapper) + @codemirror/lang-json ^6.0.x — verified HIGH confidence on GitHub releases March 2025

## Session Continuity

Last updated: 2026-05-19 (v1.2 roadmap created)
Stopped at: Phase 7 context gathered
Next action: `/gsd-plan-phase 6`

## Current Position

Phase: 06 (bytesfield) — EXECUTING
Plan: 1 of 1
Status: Executing Phase 06
Last activity: 2026-05-19 -- Phase 06 execution started
