---
id: T02
parent: S02
milestone: M001
key_files:
  - src/lib/ipc.ts
  - src/stores/useProtoStore.ts
  - src/components/sidebar/FileSection.tsx
  - src/components/layout/AppLayout.tsx
key_decisions:
  - Recent files persisted via tap.json key 'recent_files' alongside existing include_paths entries — consistent with D-08/D-09 store pattern
  - Reload sends all open files to reloadProto (not just the active one) to rebuild the full DescriptorPool atomically
  - Stale detection runs on mount and whenever recentFiles array changes — lightweight batch check via checkPathsExist IPC
  - TooltipProvider wraps each tooltip usage locally, following the established project pattern (e.g. PublishBar, PlanRunBar)
duration: 
verification_result: passed
completed_at: 2026-05-25T19:49:17.667Z
blocker_discovered: false
---

# T02: Wired reloadProto/checkPathsExist IPC, recent files store with stale detection, Reload button in FileSection, and Cmd+R shortcut

**Wired reloadProto/checkPathsExist IPC, recent files store with stale detection, Reload button in FileSection, and Cmd+R shortcut**

## What Happened

Implemented all four deliverables specified in the task plan:

1. **IPC wrappers** (`src/lib/ipc.ts`): Added `reloadProto(filePaths, includePaths)` and `checkPathsExist(paths)` functions wrapping the Rust commands from T01.

2. **Store extensions** (`src/stores/useProtoStore.ts`): Added `recentFiles: string[]` (max 10, deduplicated, prepend-on-add), `addRecentFile()`, `setRecentFiles()`, `reloadRequested` monotonic counter with `requestReload()`, and `updateFileSchema(filePath, schema)` which updates the openFiles entry and preserves `selectedMessageType` if it still exists in the new schema.

3. **FileSection UI** (`src/components/sidebar/FileSection.tsx`): Added RefreshCw Reload button next to Open button with tooltip showing "Reload schema (Cmd+R)". Reload calls `reloadProto` for all open files using their persisted include paths, then updates the active file's schema via `updateFileSchema`. Added Recent Files section below open tabs — shows file names of recently opened files not currently open, with full path tooltip. Stale files (detected via `checkPathsExist` on mount and when recent files change) rendered disabled with strikethrough and "File not found" tooltip. Clicking a non-stale recent file with saved include paths opens it directly; without saved paths, opens the IncludePathDialog. Recent files persisted to tap.json under `recent_files` key.

4. **Keyboard shortcut** (`src/components/layout/AppLayout.tsx`): Added `mod+r` (Cmd+R on Mac, Ctrl+R elsewhere) via useHotkeys following the established monotonic counter pattern — increments `reloadRequested`, FileSection listens and triggers reload.

## Verification

Ran `pnpm tsc --noEmit` — passed with zero errors. All new types, interfaces, and function signatures are consistent across IPC, store, and component layers.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

None

## Known Issues

None

## Files Created/Modified

- `src/lib/ipc.ts`
- `src/stores/useProtoStore.ts`
- `src/components/sidebar/FileSection.tsx`
- `src/components/layout/AppLayout.tsx`
