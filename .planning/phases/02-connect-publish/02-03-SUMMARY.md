---
phase: 02-connect-publish
plan: "03"
subsystem: publish-bar
tags: [rust, tauri, reqwest, management-api, react, publish, zustand, shadcn]
dependency_graph:
  requires: [02-02-PLAN.md]
  provides: [publish-bar, live-queue-exchange-picker, management-api-fetch, management-auth-error]
  affects:
    - src-tauri/Cargo.toml
    - src-tauri/src/error.rs
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/stores/useConnectionStore.ts
    - src/components/publish/PublishBar.tsx
    - src/components/layout/AppLayout.tsx
    - src/components/ui/tooltip.tsx
    - src/components/publish/__tests__/PublishBar.test.tsx
tech_stack:
  added: [reqwest@0.13]
  patterns:
    - reqwest basic_auth (Authorization header, NOT URL-embedded credentials)
    - 401/404/connection-refused disambiguation in Rust commands
    - Management API error surfaces as destructive badge (not silent Manual fallback)
    - shadcn Select live dropdown with Input fallback pattern
    - RadioGroup segmented control with sr-only radio items + label click
key_files:
  created:
    - src/components/publish/PublishBar.tsx
    - src/components/publish/__tests__/PublishBar.test.tsx
    - src/components/ui/tooltip.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/error.rs
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/stores/useConnectionStore.ts
    - src/components/layout/AppLayout.tsx
decisions:
  - "reqwest 0.13 feature is 'rustls' not 'rustls-tls' — feature was renamed between 0.12 and 0.13"
  - "ManagementApiAuthFailed display message fixed to exact string required by frontend: 'Management API authentication failed: wrong credentials (HTTP 401)'"
  - "Auth error test must mock fetch_queues rejection (not just seed store state) — useEffect fires on mount and would clear pre-seeded error on successful fetch"
  - "RadioGroup items use sr-only pattern with htmlFor label for accessible radio role detection in tests"
  - "setManagementAuthError(null) called only on successful fetch or on port/404 fallback — NOT proactively at fetch start"
metrics:
  duration: "~5 min"
  completed: "2026-05-17"
  tasks_completed: 3
  files_changed: 10
---

# Phase 02 Plan 03: PublishBar — Live Queue/Exchange Picker (Vertical Slice 3) Summary

**One-liner:** PublishBar with live Management API queue/exchange dropdown, silent Manual fallback for port/404 errors, and destructive auth-error badge for 401 (never a silent fallback).

## What Was Built

Vertical slice 3 of the connect-publish system. Users can:
1. See a persistent PublishBar above the form panel
2. Toggle between Queue and Exchange target modes (RadioGroup segmented control)
3. When Management API is reachable: shadcn Select populated with live queue/exchange names + "Live" green badge
4. When Management API is unreachable (port blocked, 404): plain text Input + "Manual" amber badge (silent fallback)
5. When Management API returns 401: destructive badge with full error message — NOT the silent "Manual" badge
6. In Exchange mode: routing key text input appears; hidden in Queue mode
7. Send button disabled with tooltip "Connect to a RabbitMQ profile to send." when no active connection

## Tasks

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Failing vitest test for PublishBar — RED phase | c49c8f2 | Complete |
| 2 | Rust backend — reqwest dep, fetch_queues + fetch_exchanges commands | 740e67f | Complete |
| 3 | Frontend — IPC functions, PublishBar component, App.tsx wired, tests green | 91fe919 | Complete |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] reqwest 0.13 feature renamed from `rustls-tls` to `rustls`**

- **Found during:** Task 2 (cargo build)
- **Issue:** Plan specified `features = ["json", "rustls-tls"]` but reqwest 0.13 renamed the feature to `rustls`. Cargo failed to select a version with the `rustls-tls` feature.
- **Fix:** Changed to `features = ["json", "rustls"]` — confirmed from cargo's available features list.
- **Files modified:** src-tauri/Cargo.toml
- **Commit:** 740e67f

**2. [Rule 1 - Bug] ManagementApiAuthFailed display message was wrong (pre-existing from slice 2)**

- **Found during:** Task 2 (reading error.rs)
- **Issue:** The variant was added in slice 2 with message `"Management API authentication failed"` (missing `: wrong credentials (HTTP 401)` suffix). The plan required the exact string `"Management API authentication failed: wrong credentials (HTTP 401)"` for frontend substring discrimination.
- **Fix:** Updated the `#[error(...)]` attribute to include the full message.
- **Files modified:** src-tauri/src/error.rs
- **Commit:** 740e67f

**3. [Rule 1 - Bug] Auth error test must mock IPC rejection, not just seed store state**

- **Found during:** Task 3 (test run — 5/6 passed)
- **Issue:** The test for "shows auth error message when Management API returns 401" seeded `managementAuthError` directly into the Zustand store. However, the `useEffect` in PublishBar fires on mount with `activeProfileName = "Local"`, calls `fetchQueues`, and on success (mock returns `[]`) calls `setManagementAuthError(null)` — clearing the pre-seeded error.
- **Fix:** Updated the test to mock `invoke("fetch_queues", ...)` to reject with the auth error message, and used `waitFor` to await the async state update. The test now validates the real async flow.
- **Files modified:** src/components/publish/__tests__/PublishBar.test.tsx
- **Commit:** 91fe919

**4. [Rule 2 - Missing functionality] setManagementAuthError should not clear on fetch start**

- **Found during:** Task 3 (debugging test failure)
- **Issue:** Original plan code called `setManagementAuthError(null)` at the very start of `fetchTargets()` before any async operation. This would cause a visible flicker (error badge → gone → reappears) if the auth error persists.
- **Fix:** Moved `setManagementAuthError(null)` to be called only on successful fetch completion (and on port/404 fallback path). This prevents the premature clear.
- **Files modified:** src/components/publish/PublishBar.tsx
- **Commit:** 91fe919

**5. [Rule 1 - Bug] ExchangeApiInfo `exchange_type` field unused dead code warning**

- **Found during:** Task 2 (cargo build — warning)
- **Issue:** The `exchange_type` field in `ExchangeApiInfo` was deserialized from JSON but not used in filter logic (only `internal` and `name` are checked).
- **Fix:** Added `#[allow(dead_code)]` annotation and explanatory comment. The field is kept to document the full API response shape.
- **Files modified:** src-tauri/src/commands/connection.rs
- **Commit:** 740e67f

## Verification

| Check | Result |
|-------|--------|
| `cargo build` exits 0 | PASS (0 errors, 0 warnings) |
| `npm test -- PublishBar.test.tsx` 6/6 | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| `grep "basic_auth" connection.rs \| wc -l` >= 2 | PASS (6) |
| `grep "ManagementApiAuthFailed" connection.rs \| wc -l` >= 2 | PASS (3) |
| `grep "authentication failed" error.rs \| wc -l` >= 1 | PASS (2 — comment + display string) |
| `grep "starts_with.*amq" connection.rs \| wc -l` >= 1 | PASS (1) |
| `grep "fetch_queues" lib.rs \| wc -l` >= 1 | PASS (1) |
| `grep "Routing key" PublishBar.tsx \| wc -l` >= 1 | PASS (4) |
| `grep "Manual" PublishBar.tsx \| wc -l` >= 1 | PASS (5) |
| `grep "Live" PublishBar.tsx \| wc -l` >= 1 | PASS (2) |
| `grep "Connect to a RabbitMQ" PublishBar.tsx \| wc -l` >= 1 | PASS (1) |
| `grep "authentication failed" PublishBar.tsx \| wc -l` >= 1 | PASS (3) |
| `grep "managementAuthError" PublishBar.tsx \| wc -l` >= 2 | PASS (3) |
| `grep "setManagementAuthError(null)" PublishBar.tsx \| wc -l` >= 1 | PASS (3) |
| 401 path does NOT call setManagementStatus("manual") | PASS (0 matches in grep) |

## Security Verification (Threat Model)

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-10: Management API credentials in HTTP request | `basic_auth()` sets Authorization header — NOT URL-embedded | `grep "basic_auth" connection.rs \| wc -l` = 6; no credentials in URL format strings |
| T-02-14: 401 vs 404/connection-refused disambiguation | 401 → `ManagementApiAuthFailed` with exact display message surfaced as destructive badge | Code review confirms; tests verify auth error badge vs Manual badge distinction |

## Known Stubs

**1. `handleSend` in PublishBar.tsx is a no-op placeholder**

- File: `src/components/publish/PublishBar.tsx`
- Content: `const handleSend = async () => { // TODO: wired in slice 4 (02-04-PLAN.md) }`
- Reason: Intentional — slice 4 (02-04-PLAN.md) implements the actual publish_message IPC call. This stub enables UI development and testing of the Send button disabled state without the full publish flow.

## Threat Flags

None — all new network surface (Management API HTTP GET) is in the plan's threat model (T-02-10 through T-02-14).

## Self-Check

- [x] src/components/publish/PublishBar.tsx exists: FOUND
- [x] src/components/publish/__tests__/PublishBar.test.tsx exists: FOUND
- [x] src/components/ui/tooltip.tsx exists: FOUND
- [x] src-tauri/src/commands/connection.rs contains fetch_queues: FOUND
- [x] src-tauri/src/commands/connection.rs contains fetch_exchanges: FOUND
- [x] src/lib/ipc.ts contains fetchQueues + fetchExchanges: FOUND
- [x] src/stores/useConnectionStore.ts contains managementAuthError: FOUND
- [x] commit c49c8f2 exists: FOUND
- [x] commit 740e67f exists: FOUND
- [x] commit 91fe919 exists: FOUND

## Self-Check: PASSED
