---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 3 context gathered
last_updated: "2026-05-18T00:02:39.717Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 16
  completed_plans: 12
  percent: 75
---

# Project State: Proto Sender

## Current Phase

Phase 2 — Connect + Publish
Status: Ready to execute

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17)

**Core value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.
**Current focus:** Phase 02 — connect-publish

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

---

## Performance Metrics

- Plans completed: 11
- Requirements delivered: FORM-01 (fully), FORM-06, FORM-07 delivered by plan 01-02; FORM-02, FORM-03, FORM-08 delivered by plan 01-03; FORM-04, FORM-05 delivered by plan 01-04; FORM-09, PROT-02 delivered by plan 01-05; FORM-01 (debounce gate) delivered by plan 01-06; CONN-01, CONN-04 delivered by plan 02-01; CONN-02, CONN-03 delivered by plan 02-02; PUBL-03 delivered by plan 02-03; PUBL-01, PUBL-02 delivered by plan 02-04; CONN-01 (UAT gap closure) delivered by plan 02-GAP
- Phases completed: 2/3

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

### Active TODOs

- Phase 02 complete — all 4 slices + UAT gap fix done; ready for Phase 03

### Blockers

(none)

### Research Flags

- shadcn/ui + Tailwind 4 Vite config: VERIFIED — @tailwindcss/vite plugin works, no tailwind.config.js
- macOS arbitrary file read entitlements: Entitlements.plist approach confirmed (bundle.macOS.entitlements path string)
- Linux keychain (libsecret): still needs install notes for distribution

## Session Continuity

Last updated: 2026-05-17 (plan 02-GAP2 complete)
Stopped at: Phase 3 context gathered
Next action: Phase 03 — next phase planning
