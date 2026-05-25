# S02: Proto File Management

**Goal:** User edits a proto file externally, clicks Reload, sees updated schema; opens a recent file from the list; adds an include path and the file re-parses automatically
**Demo:** User edits a proto file externally, clicks Reload, sees updated schema; opens a recent file from the list; adds an include path and the file re-parses automatically

## Must-Haves

- 1. reload_proto IPC rebuilds pool from scratch and returns updated schema. 2. Recent files list persists across restarts (max 10), stale entries disabled. 3. Include paths visible inline, editable without file picker, auto-trigger reload on change. 4. Cmd+R shortcut triggers reload of active file.

## Proof Level

- This slice proves: contract + integration — Rust commands verified via cargo check, frontend verified via vitest with IPC mocks, keyboard shortcut verified via native KeyboardEvent dispatch

## Integration Closure

Upstream: S01 keyboard shortcut patterns (useHotkeys, monotonic counter). New wiring: reload_proto and check_paths_exist Rust commands registered in invoke_handler; fs:allow-exists capability added. Remaining for milestone: S03-S05 features (draft persistence, randomizer, schema explorer).

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Added reload_proto and check_paths_exist Rust commands with invoke_handler registration and fs:allow-exists capability** `est:45m`
  **Why:** The DescriptorPool is append-only — parse_proto skips already-present files (proto.rs:36). To reflect external .proto edits, we need a command that builds a fresh pool from scratch. check_paths_exist provides batch file existence checking for stale recent-file detection without requiring fs:allow-exists capability.
  - Files: `src-tauri/src/commands/proto.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
  - Verify: cd src-tauri && cargo check

- [x] **T02: Wired reloadProto/checkPathsExist IPC, recent files store with stale detection, Reload button in FileSection, and Cmd+R shortcut** `est:90m`
  **Why:** The frontend needs IPC wrappers for the new Rust commands, a persisted recent-files list for quick re-open, stale-file detection to disable moved/deleted entries, and a Reload button so users can refresh schema without the file picker.
  - Files: `src/lib/ipc.ts`, `src/stores/useProtoStore.ts`, `src/components/sidebar/FileSection.tsx`, `src/components/layout/AppLayout.tsx`
  - Verify: pnpm tsc --noEmit

- [x] **T03: Added inline IncludePathManager component with removable path chips, directory picker, and auto-reload on add/remove** `est:60m`
  **Why:** Currently include paths are only configurable via the IncludePathDialog during file open. Users need to view and edit include paths for the active file inline — and changing them should auto-reload the proto to give immediate feedback on import resolution.
  - Files: `src/components/sidebar/IncludePathManager.tsx`, `src/components/sidebar/FileSection.tsx`
  - Verify: pnpm tsc --noEmit

- [x] **T04: Added 18 unit and integration tests covering reload, recent files, and include path management** `est:75m`
  **Why:** Slice verification requires test coverage for the new IPC flows, store logic, and UI interactions. Tests prove the reload counter pattern works, recent files are managed correctly, and stale detection renders disabled entries.
  - Files: `src/stores/__tests__/useProtoStore-reload.test.ts`, `src/components/sidebar/__tests__/FileSection-reload.test.tsx`, `src/components/sidebar/__tests__/IncludePathManager.test.tsx`
  - Verify: pnpm vitest run

## Files Likely Touched

- src-tauri/src/commands/proto.rs
- src-tauri/src/lib.rs
- src-tauri/capabilities/default.json
- src/lib/ipc.ts
- src/stores/useProtoStore.ts
- src/components/sidebar/FileSection.tsx
- src/components/layout/AppLayout.tsx
- src/components/sidebar/IncludePathManager.tsx
- src/stores/__tests__/useProtoStore-reload.test.ts
- src/components/sidebar/__tests__/FileSection-reload.test.tsx
- src/components/sidebar/__tests__/IncludePathManager.test.tsx
