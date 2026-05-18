---
phase: 02-connect-publish
plan: GAP
subsystem: connection-ui
tags: [gap-closure, uat, connection-profiles, test-connection, edit-mode]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [test-connection-button, retest-button, edit-profile]
  affects: [ProfileManagementModal, ConnectionSection]
tech_stack:
  added: []
  patterns: [TDD-RED-GREEN, handleTestOnly-pattern, edit-mode-form]
key_files:
  created:
    - src/components/connection/__tests__/ProfileManagementModal.test.tsx
  modified:
    - src/components/connection/ProfileManagementModal.tsx
    - src/components/sidebar/ConnectionSection.tsx
    - src/components/connection/__tests__/ConnectionSection.test.tsx
decisions:
  - "handleTestOnly does NOT call setActiveProfile/setConnectionStatus — profile is saved but not activated"
  - "handleRetest DOES update global connectionStatus — re-test is authoritative for active profile"
  - "Test Connection button hidden in edit mode — avoids testing a half-edited unsaved profile"
  - "Blank password guard in handleSave (frontend) required because Rust save_profile always writes to keychain unconditionally"
  - "Profile Name field is read-only in edit mode — name is the upsert key in backend"
  - "Pencil icon from lucide-react for Edit button in profile list rows"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-17T21:12:29Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 02 Plan GAP: UAT Gap Fix — Test Connection + Edit Mode Summary

GAP fix surfacing the existing `test_connection` Rust command through two UI affordances and adding edit mode for saved profiles. All three UAT-blocking gaps are now closed with full test coverage.

## What Was Built

1. **Standalone "Test Connection" button** in ProfileManagementModal create form — saves profile, runs connection test inline, shows spinner → checkmark/red-X. Does NOT activate the profile or close the modal.

2. **Re-test button** in ConnectionSection sidebar — tests the currently active profile on demand, shows ConnectionTestResult inline, updates global connectionStatus.

3. **Edit mode** for saved connection profiles — Edit button (Pencil icon) in each profile list row, pre-populates all fields, name field read-only, blank-password guard blocks save with clear error message.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Add standalone Test Connection button to ProfileManagementModal | ef4d928 (test), da68a62 (feat) | ProfileManagementModal.tsx, ProfileManagementModal.test.tsx |
| 2 | Add re-test button to ConnectionSection for saved profiles | 3f8fd65 (test), 504fd63 (feat) | ConnectionSection.tsx, ConnectionSection.test.tsx |
| 3 | Add edit mode to ProfileManagementModal for saved profiles | 822dbd8 (test), c25906c (feat) | ProfileManagementModal.tsx, ProfileManagementModal.test.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed camelCase field access in handleShowEditForm**
- **Found during:** Task 3 implementation, surfaced by TypeScript check
- **Issue:** Plan's `handleShowEditForm` snippet used `profile.managementPort` and `profile.managementSsl` (camelCase), but `ConnectionProfile` type uses `management_port` and `management_ssl` (snake_case). Both reads would have been `undefined`, silently using fallback values (15672 / false) and losing the user's saved management settings on edit.
- **Fix:** Used `profile.management_port` and `profile.management_ssl` (snake_case) matching the TypeScript type definition and existing `handleSave` pattern.
- **Files modified:** `src/components/connection/ProfileManagementModal.tsx`
- **Commit:** c25906c

**2. [Rule 1 - Bug] Fixed TypeScript type error in test setState calls**
- **Found during:** Task 1 TypeScript check
- **Issue:** `useConnectionStore.setState` type narrowing rejected partial state objects with mocked action fns. Used `as unknown as Parameters<typeof useConnectionStore.setState>[0]` cast to bypass the type mismatch in test-only code.
- **Fix:** Added `as unknown as` type assertion in two test setState calls.
- **Files modified:** `src/components/connection/__tests__/ProfileManagementModal.test.tsx`
- **Commit:** da68a62

## TDD Gate Compliance

All three tasks followed the RED/GREEN sequence:

- Task 1: `ef4d928` (test — RED) → `da68a62` (feat — GREEN)
- Task 2: `3f8fd65` (test — RED) → `504fd63` (feat — GREEN)
- Task 3: `822dbd8` (test — RED) → `c25906c` (feat — GREEN)

## Test Results

- **72 tests pass** across 11 test files
- **0 TypeScript errors** (`npx tsc --noEmit`)
- **New tests added:** 7 (handleTestOnly) + 3 (handleRetest) + 5 (edit mode) = 15 new tests

## Known Stubs

None — all implemented behaviors are fully wired to IPC calls.

## Threat Flags

No new threat surface beyond plan's `<threat_model>`. T-GAP-04 mitigated: blank-password guard in `handleSave` prevents empty-string overwrite of OS keychain entry in edit mode.

## Self-Check: PASSED
