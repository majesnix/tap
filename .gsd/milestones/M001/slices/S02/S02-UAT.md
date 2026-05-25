# S02: Proto File Management — UAT

**Milestone:** M001
**Written:** 2026-05-25T19:59:08.384Z

# S02: Proto File Management — UAT

**Milestone:** M001
**Written:** 2026-05-25

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All functionality is behind IPC commands and React components testable via unit/integration tests; no live RabbitMQ or runtime proto parsing needed for UAT — Rust commands verified via cargo check, UI behavior verified via 18 component/store tests

## Preconditions

- Project builds without errors (`pnpm tsc --noEmit` passes)
- All 557 tests pass (`pnpm vitest run`)
- Rust backend compiles (`cargo check` in src-tauri)

## Smoke Test

Load a `.proto` file, verify Reload button appears in FileSection header. Click it — schema should re-parse without reopening the file picker.

## Test Cases

### 1. Reload Proto File

1. Load a `.proto` file via the file picker
2. Click the Reload button (or press Cmd+R)
3. **Expected:** Schema re-parses from disk; form regenerates with current field definitions; no file picker opens

### 2. Recent Files List

1. Load 3 different `.proto` files in sequence
2. Check the recent files area in FileSection
3. **Expected:** All 3 files appear in the recent list, most recent first; clicking any entry re-loads that file

### 3. Stale File Detection

1. Load a `.proto` file, note it appears in recent files
2. Move or delete the file on disk
3. Re-mount or trigger stale check
4. **Expected:** The moved/deleted file appears as disabled with visual indicator; clicking it does not attempt to load

### 4. Include Path Management — Add

1. Load a `.proto` file that imports from another directory
2. Click the add button in IncludePathManager
3. Select the directory containing the imported `.proto` files
4. **Expected:** Path appears as a chip; proto file auto-reloads with imports resolved

### 5. Include Path Management — Remove

1. With include paths already added, click the X on a path chip
2. **Expected:** Path is removed; proto file auto-reloads (may show import errors if path was needed)

### 6. Include Path — Duplicate Prevention

1. Try to add an include path that is already in the list
2. **Expected:** Toast notification indicates the path already exists; no duplicate chip added

## Edge Cases

### Recent Files Cap at 10

1. Load 12 different `.proto` files in sequence
2. **Expected:** Only the 10 most recent appear; oldest 2 are evicted from the list

### Reload with No Files Open

1. Without any proto file loaded, press Cmd+R
2. **Expected:** No crash; reload is a no-op since there are no files to reload

## Failure Signals

- Reload button click causes error toast but no schema update
- Recent files list doesn't persist after app restart
- Stale files appear as clickable (not disabled)
- Include path add/remove does not trigger auto-reload
- TypeScript or Rust compilation errors

## Not Proven By This UAT

- Actual proto parsing correctness with real `.proto` files (requires live Tauri runtime)
- Cross-platform behavior (Windows/Linux file path handling)
- Performance with large numbers of include paths or proto files

## Notes for Tester

- Stale detection relies on `checkPathsExist` IPC which checks real filesystem — in test environment this is mocked
- Auto-reload calls `reloadProto` which rebuilds the full DescriptorPool — verify no partial state on failure
