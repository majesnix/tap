---
phase: 02-connect-publish
plan: "01"
subsystem: connection-profiles
tags: [rust, tauri, keyring, zustand, react, connection, security]
dependency_graph:
  requires: []
  provides: [connection-profiles-crud, keyring-password-storage, connection-section-ui]
  affects: [src-tauri/src/profiles, src-tauri/src/commands/connection, src/stores/useConnectionStore, src/components/sidebar/ConnectionSection, src/components/connection/ProfileManagementModal, src/components/sidebar/Sidebar]
tech_stack:
  added: [keyring-core@1, apple-native-keyring-store@1, dbus-secret-service-keyring-store@1, windows-native-keyring-store@1]
  patterns: [keyring-core platform store init, Zustand store with INITIAL_STATE const, Tauri IPC command trio (save/list/delete)]
key_files:
  created:
    - src-tauri/src/profiles/mod.rs
    - src-tauri/src/commands/connection.rs
    - src/stores/useConnectionStore.ts
    - src/components/sidebar/ConnectionSection.tsx
    - src/components/connection/ProfileManagementModal.tsx
    - src/components/connection/__tests__/ConnectionSection.test.tsx
    - src/components/ui/alert-dialog.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/error.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/types.ts
    - src/lib/ipc.ts
    - src/components/sidebar/Sidebar.tsx
    - package.json
decisions:
  - "apple-native-keyring-store requires features=[keychain] on macOS (no default features)"
  - "Store::new() returns Arc<CredentialStore> — set_default_store() takes Arc<dyn CredentialStoreApi+Send+Sync>"
  - "keyring-core 1.x uses delete_credential() not delete_password()"
  - "3 post-test JSDOM cleanup errors (Radix UI portal teardown in jsdom) — do not affect 4/4 test pass"
metrics:
  duration: "~25 min"
  completed: "2026-05-17"
  tasks_completed: 3
  files_changed: 15
---

# Phase 02 Plan 01: Connection Profiles (Vertical Slice 1) Summary

**One-liner:** Named RabbitMQ connection profiles with OS keychain password storage, sidebar dropdown, and gear-button modal using keyring-core + tauri-plugin-store.

## What Was Built

Vertical slice 1 of the connection system. Users can:
1. Click the gear icon in the sidebar
2. Fill in 6 profile fields (name, host, port, vhost, username, password, management port)
3. Click "Save & Connect" — profile is persisted to tauri-plugin-store JSON (no password), password goes to OS keychain
4. See the saved profile in the sidebar dropdown

Status dot is gray (disconnected) — connection test comes in slice 2.

## Tasks

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Failing vitest test (RED) | 7253b00 | Complete |
| 2 | Rust backend (profiles, keyring, commands) | b00613b | Complete |
| 3 | Frontend (types, IPC, store, components) | b3b608c | Complete |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] apple-native-keyring-store requires explicit keychain feature**

- **Found during:** Task 2 (Cargo.toml verification before writing)
- **Issue:** Plan specified `apple-native-keyring-store = "1"` but the crate emits `compile_error!` unless `features = ["keychain"]` or `features = ["protected"]` is enabled. No default features.
- **Fix:** Added `features = ["keychain"]` to the macOS dependency entry.
- **Files modified:** src-tauri/Cargo.toml
- **Commit:** b00613b

**2. [Rule 3 - Blocking] keyring-core set_default_store() takes Arc, not Store::default()**

- **Found during:** Task 2 (API verification against keyring-core 1.0.0 source)
- **Issue:** Plan code used `Store::default()` but the `Store` type has no `Default` impl. `Store::new()` returns `Result<Arc<Self>>`. `set_default_store()` takes `Arc<CredentialStore>` (a dyn trait). The `Arc<Store>` from `Store::new()` coerces correctly.
- **Fix:** Used `Store::new().expect(...)` and passed the resulting `Arc` directly (type coercion works; no `.unwrap()` pattern needed).
- **Files modified:** src-tauri/src/lib.rs
- **Commit:** b00613b

**3. [Rule 3 - Blocking] No test script in package.json**

- **Found during:** Task 1 verification step
- **Issue:** `npm test` failed with "Missing script: test" — vitest was installed but no script defined.
- **Fix:** Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts to package.json.
- **Files modified:** package.json
- **Commit:** 7253b00

## Verification

| Check | Result |
|-------|--------|
| `cargo build` exits 0 | PASS (2 dead-code warnings, no errors) |
| `cargo test -- profiles::tests` exits 0 | PASS (1 test) |
| `npm test -- ConnectionSection.test.tsx` 4/4 | PASS |
| `npx tsc --noEmit` exits 0 | PASS |

## Security Verification (Threat Model)

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-01: password in ConnectionProfile struct | No `password` field in struct | `grep -E "pub password:" profiles/mod.rs` = 0 |
| T-02-01: password in TS ConnectionProfile | No `password` field in interface | `grep -c "password" src/lib/types.ts` = 0 |
| T-02-02: password in tracing logs | Only `profile.name` logged in save_profile | Code comment + review confirms |
| T-02-05: password in Zustand store | Store holds `ConnectionProfile[]` (no password) | ConnectionStore type has no password field |

## Known Stubs

- `handleProfileChange` in ConnectionSection.tsx: sets `setActiveProfile(name)` only — connection test not triggered. This is intentional per slice 1 scope; slice 2 adds AMQP connection.
- Status dot is always gray (disconnected) until slice 2 wires up AMQP test.

## Platform Notes

- Linux/Windows keyring store init blocks (`#[cfg(target_os = ...)]`) are correct in code but UNVERIFIED at compile time — macOS-only CI. The crate names and `Store::new()` API shape are verified from crates.io source for all three platforms.

## Threat Flags

None — no new network endpoints or trust boundaries introduced in this plan. All STRIDE threats are in the plan's `<threat_model>` and have been mitigated.

## Self-Check

- [x] src-tauri/src/profiles/mod.rs exists: FOUND
- [x] src-tauri/src/commands/connection.rs exists: FOUND
- [x] src/stores/useConnectionStore.ts exists: FOUND
- [x] src/components/sidebar/ConnectionSection.tsx exists: FOUND
- [x] src/components/connection/ProfileManagementModal.tsx exists: FOUND
- [x] commit 7253b00 exists: FOUND
- [x] commit b00613b exists: FOUND
- [x] commit b3b608c exists: FOUND

## Self-Check: PASSED
