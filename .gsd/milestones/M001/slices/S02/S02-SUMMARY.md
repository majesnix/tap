---
id: S02
parent: M001
milestone: M001
provides:
  - reload_proto Rust command (atomic DescriptorPool rebuild)
  - check_paths_exist Rust command (batch file existence check)
  - Recent files list in useProtoStore (10 entries, persisted)
  - Include path manager UI in FileSection with auto-reload
  - Cmd+R keyboard shortcut for proto reload
requires:
  - slice: S01
    provides: Keyboard shortcut patterns (useHotkeys in FormPanel)
affects:
  - S03
key_files:
  - src-tauri/src/commands/proto.rs
  - src/lib/ipc.ts
  - src/stores/useProtoStore.ts
  - src/components/sidebar/FileSection.tsx
  - src/components/sidebar/IncludePathManager.tsx
key_decisions:
  - reload_proto builds entirely fresh DescriptorPool (append-only pool cannot be incrementally updated)
  - Recent files persisted via tap.json key 'recent_files' alongside existing include_paths — consistent with D-08/D-09 store pattern
  - Stale detection uses batch checkPathsExist IPC on mount and on recentFiles changes
  - IncludePathManager auto-reloads all open files on path change to keep shared DescriptorPool consistent
patterns_established:
  - Batch file existence check via IPC for stale detection
  - Inline path chip manager with add/remove and auto-reload side effects
observability_surfaces:
  - toast.error on reload failure preserves existing schema — user sees error without losing form state
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T04-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-25T19:59:08.383Z
blocker_discovered: false
---

# S02: Proto File Management

**Added proto reload command, recent files list with stale detection, and inline include path manager with auto-reload on path changes**

## What Happened

T01 added two new Rust commands — `reload_proto` (atomic DescriptorPool rebuild from scratch) and `check_paths_exist` (batch file existence verification) — registered in the Tauri invoke handler with `fs:allow-exists` capability.

T02 wired the IPC layer (`reloadProto`, `checkPathsExist` in `ipc.ts`), added recent files tracking to `useProtoStore` (10 entries, persisted via `tap.json`), built the Reload button in FileSection with a Cmd+R keyboard shortcut, and implemented stale-file detection that runs on mount and whenever the recent files array changes.

T03 created the `IncludePathManager` inline component with removable path chips, a native directory picker for adding paths, duplicate detection with toast feedback, and auto-reload of all open files on any include path change.

T04 added 18 unit and integration tests across 3 new test files covering store-level reload/recent-file logic, FileSection reload UI behavior, and IncludePathManager add/remove/duplicate flows. All tests use isolated mock state per test to prevent leakage.

## Verification

- `pnpm tsc --noEmit` — zero errors (type safety across IPC, store, and component layers)
- `pnpm vitest run` — 557 tests pass across 42 test files, including 18 new S02 tests, zero regressions
- `cargo check` in src-tauri — compiles successfully with zero errors and zero warnings
- All key source files verified present: proto.rs, ipc.ts, useProtoStore.ts, FileSection.tsx, IncludePathManager.tsx
- All test files verified present: useProtoStore-reload.test.ts, FileSection-reload.test.tsx, IncludePathManager.test.tsx

## Requirements Advanced

- R010 — reload_proto Rust command rebuilds DescriptorPool atomically; Reload button and Cmd+R shortcut in FileSection
- R011 — useProtoStore tracks last 10 recent files persisted via tap.json; addRecentFile/removeRecentFile actions
- R012 — Recent files rendered as clickable list items in FileSection tab bar area
- R013 — checkPathsExist IPC batch-checks file existence; stale entries shown as disabled with opacity and visual indicator
- R014 — IncludePathManager shows current include paths as removable chips inline in FileSection
- R015 — IncludePathManager provides directory picker to add paths and X button to remove; no file picker reopen needed
- R016 — IncludePathManager auto-reloads all open files via reloadProto on any path add or remove

## Requirements Validated

- R010 — reload_proto command verified via cargo check; Reload button and Cmd+R shortcut tested in FileSection-reload.test.tsx
- R011 — Recent files persistence tested in useProtoStore-reload.test.ts with store save mock verification
- R012 — FileSection-reload.test.tsx verifies recent file items render and are clickable
- R013 — useProtoStore-reload.test.ts verifies stale detection marks entries; FileSection-reload.test.tsx verifies disabled rendering
- R014 — IncludePathManager.test.tsx verifies path chips render for current include paths
- R015 — IncludePathManager.test.tsx verifies add via directory picker and remove via X button
- R016 — IncludePathManager.test.tsx verifies reloadProto IPC called after path add/remove

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

none

## Known Limitations

Recent files list is capped at 10 entries with simple FIFO eviction — no frecency or pinning. Include path manager does not validate that added directories actually contain .proto files.

## Follow-ups

none

## Files Created/Modified

- `src-tauri/src/commands/proto.rs` — Added reload_proto and check_paths_exist Rust commands
- `src-tauri/src/lib.rs` — Registered new commands in invoke_handler
- `src-tauri/capabilities/default.json` — Added fs:allow-exists capability
- `src/lib/ipc.ts` — Added reloadProto and checkPathsExist IPC wrappers
- `src/stores/useProtoStore.ts` — Added recentFiles state, addRecentFile, removeRecentFile, stale detection
- `src/components/sidebar/FileSection.tsx` — Added Reload button, Cmd+R shortcut, recent files list with stale indicators
- `src/components/sidebar/IncludePathManager.tsx` — New component — path chips, directory picker, auto-reload on change
- `src/components/layout/AppLayout.tsx` — Registered Cmd+R keyboard shortcut
- `src/stores/__tests__/useProtoStore-reload.test.ts` — 6 unit tests for reload and recent files store logic
- `src/components/sidebar/__tests__/FileSection-reload.test.tsx` — 7 integration tests for FileSection reload UI
- `src/components/sidebar/__tests__/IncludePathManager.test.tsx` — 5 integration tests for include path manager
