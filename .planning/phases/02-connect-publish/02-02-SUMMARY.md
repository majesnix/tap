---
phase: 02-connect-publish
plan: "02"
subsystem: connection-test
tags: [rust, tauri, lapin, amqp, percent-encoding, react, connection, security]
dependency_graph:
  requires: [02-01-PLAN.md]
  provides: [amqp-connection-test, profile-activation, connection-status-dot]
  affects:
    - src-tauri/Cargo.toml
    - src-tauri/src/profiles/mod.rs
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/components/connection/ConnectionTestResult.tsx
    - src/components/connection/ProfileManagementModal.tsx
    - src/components/sidebar/ConnectionSection.tsx
    - src/components/connection/__tests__/ConnectionSection.test.tsx
tech_stack:
  added: [lapin@4, percent-encoding@2]
  patterns:
    - ephemeral lapin connection (connect → channel → close) for test_connection
    - tokio::time::timeout 10s on AMQP connect to prevent indefinite hang
    - ConnectionTestResult: idle→testing→success/error inline display pattern
    - profileName camelCase IPC arg naming convention (consistent with save_profile)
key_files:
  created:
    - src/components/connection/ConnectionTestResult.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/profiles/mod.rs
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/components/connection/ProfileManagementModal.tsx
    - src/components/sidebar/ConnectionSection.tsx
    - src/components/connection/__tests__/ConnectionSection.test.tsx
decisions:
  - "lapin Connection::close() takes ShortString not &str — must use .into() for string literal"
  - "test_connection assertion !uri.contains('//') fails because 'amqp://' always has '//' — check port segment instead"
  - "Multiple 'Connected' texts found in test (ConnectionTestResult + status dot) — use getAllByText for spinner test"
  - "Default mockInvoke in beforeEach must return [] for list_profiles to prevent profiles.length crash on undefined"
  - "Select mock (native <select>) added to test file — Radix UI portal/pointer events incompatible with jsdom"
  - "activateProfile IPC call uses { profileName } not { name } — plan test code had wrong arg name, fixed"
metrics:
  duration: "~8 min"
  completed: "2026-05-17"
  tasks_completed: 2
  files_changed: 9
---

# Phase 02 Plan 02: Connection Test + Activation (Vertical Slice 2) Summary

**One-liner:** Ephemeral lapin AMQP connection test with 10s timeout, inline spinner→green/red result in ProfileManagementModal, and sidebar status dot updated on profile switch via activate_profile command.

## What Was Built

Vertical slice 2 of the connection system. Users can:
1. Click "Save & Connect" → profile is saved, then tested inline:
   - Spinner appears below the form fields ("Testing connection…")
   - Green checkmark + "Connected" on success → status dot turns green, modal shows result
   - Red X + error message on failure → modal stays open, user can correct and retry
2. Switch profiles in the sidebar dropdown → `activate_profile` command is invoked → status dot turns green (connected) or red (error)

The connection test is ephemeral: opens a lapin connection, creates a channel (validates credentials + vhost), then closes the connection. No persistent AMQP state is held in Tauri managed state.

## Tasks

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Rust backend — lapin dep, build_amqp_uri, test_connection + activate_profile | f5860cd | Complete |
| 2 | Frontend — IPC functions, ConnectionTestResult, ProfileManagementModal + ConnectionSection | f5d2c9b | Complete |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lapin Connection::close() requires ShortString, not &str**

- **Found during:** Task 1 (cargo build)
- **Issue:** Plan code used `conn.close(0, "")` but lapin 4.7.4 `close()` signature is `close(&self, reply_code: ReplyCode, reply_text: ShortString)`. Bare `""` is `&str`, not `ShortString`.
- **Fix:** Changed to `conn.close(0, "".into())` — `Into<ShortString>` is implemented for `&str`.
- **Files modified:** src-tauri/src/commands/connection.rs
- **Commit:** f5860cd

**2. [Rule 1 - Bug] URI test assertion `!uri.contains("//")` false positive**

- **Found during:** Task 1 (cargo test)
- **Issue:** Plan's test asserted `!uri.contains("//")` to verify vhost encoding, but `amqp://` always contains `//`. The test panicked on the first assertion run (1 passed, 1 failed).
- **Fix:** Changed assertion to check the port-segment tail: `!after_port.starts_with("5672//")` which correctly verifies the vhost path segment is encoded without false matching the scheme's `//`.
- **Files modified:** src-tauri/src/profiles/mod.rs
- **Commit:** f5860cd

**3. [Rule 1 - Bug] Plan test code had wrong arg name for activate_profile IPC call**

- **Found during:** Task 2 (test implementation review, per advisor)
- **Issue:** Plan's test 3 asserted `toHaveBeenCalledWith("activate_profile", { name: "Staging" })` but the IPC binding uses `{ profileName }` (camelCase, consistent with save/delete/test commands).
- **Fix:** Changed assertion to `{ profileName: "Staging" }`.
- **Files modified:** src/components/connection/__tests__/ConnectionSection.test.tsx
- **Commit:** f5d2c9b

**4. [Rule 1 - Bug] Multiple "Connected" texts cause `getByText` to fail**

- **Found during:** Task 2 (test run)
- **Issue:** After `testConnection` succeeds, `setConnectionStatus("connected")` updates the sidebar which renders `STATUS_TEXT.connected = "Connected"`. The modal also renders `ConnectionTestResult` with "Connected". Two elements match `getByText("Connected")` → TestingLibraryElementError.
- **Fix:** Changed assertion to `getAllByText("Connected")` and asserted `length > 0` — valid since at least one "Connected" is always the ConnectionTestResult inline display.
- **Files modified:** src/components/connection/__tests__/ConnectionSection.test.tsx
- **Commit:** f5d2c9b

**5. [Rule 3 - Blocking] Default mockInvoke must return [] for list_profiles to avoid crash**

- **Found during:** Task 2 (test run — `Cannot read properties of undefined (reading 'length')`)
- **Issue:** After `vi.clearAllMocks()`, `mockInvoke` returned `undefined` by default. `ConnectionSection.useEffect` calls `listProfiles()` on mount; the resolved value was `undefined`, and `setProfiles(undefined)` caused `profiles.length` to crash.
- **Fix:** Added a default `mockInvoke.mockImplementation` in `beforeEach` that returns `[]` for `list_profiles`.
- **Files modified:** src/components/connection/__tests__/ConnectionSection.test.tsx
- **Commit:** f5d2c9b

**6. [Rule 1 - Bug] Radix Select mock missing from test file**

- **Found during:** Task 2 (per advisor + test plan review)
- **Issue:** The existing test for profile switching uses `fireEvent.change(select, ...)` on a Radix Select, which is incompatible with jsdom (portal rendering, pointer event simulation). The STATE.md notes this pattern was resolved in slice 1 but the mock was not in the test file.
- **Fix:** Added `vi.mock("@/components/ui/select", ...)` replacing Radix Select with a native `<select>` element that fires native change events.
- **Files modified:** src/components/connection/__tests__/ConnectionSection.test.tsx
- **Commit:** f5d2c9b

## Verification

| Check | Result |
|-------|--------|
| `cargo build` exits 0 | PASS (1 dead-code warning for future ManagementApi variants, no errors) |
| `cargo test -- profiles` exits 0 | PASS (3 tests: 1 existing serialization test + 2 new URI encoding tests) |
| `npm test -- ConnectionSection.test.tsx` 7/7 | PASS |
| `npx tsc --noEmit` exits 0 | PASS |

## Security Verification (Threat Model)

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-06: AMQP URI in test_connection | `let uri` scoped inside async fn; never logged | `grep "tracing" commands/connection.rs | grep "password\|uri\|URI"` = 0 |
| T-02-07: DoS via unreachable broker | `tokio::time::timeout(Duration::from_secs(10), Connection::connect(...))` | Code review confirms; times out with AmqpError("Connection timed out (10s)") |
| T-02-08: lapin error includes host:port | Accepted — host is user-entered data, not a secret | No password in lapin error strings |
| T-02-09: Stale profile after rename | Accepted — no auth token/session involved | N/A |

## Known Stubs

None. The connection test flow is fully wired:
- `test_connection` command → lapin ephemeral connection → real AMQP handshake
- `activate_profile` delegates to `test_connection`
- Frontend displays real async test result inline
- Status dot reflects real connection state from Zustand store

## Threat Flags

None — no new network endpoints beyond the AMQP connection test already in the plan's threat model.

## Self-Check

- [x] src/components/connection/ConnectionTestResult.tsx exists: FOUND
- [x] src-tauri/src/commands/connection.rs contains test_connection: FOUND
- [x] src-tauri/src/commands/connection.rs contains activate_profile: FOUND
- [x] src-tauri/src/profiles/mod.rs contains build_amqp_uri: FOUND
- [x] src/lib/ipc.ts contains testConnection and activateProfile: FOUND
- [x] commit f5860cd exists: FOUND
- [x] commit f5d2c9b exists: FOUND

## Self-Check: PASSED
