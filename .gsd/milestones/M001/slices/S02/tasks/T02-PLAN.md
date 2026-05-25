---
estimated_steps: 8
estimated_files: 4
skills_used: []
---

# T02: Wired reloadProto/checkPathsExist IPC, recent files store with stale detection, Reload button in FileSection, and Cmd+R shortcut

**Why:** The frontend needs IPC wrappers for the new Rust commands, a persisted recent-files list for quick re-open, stale-file detection to disable moved/deleted entries, and a Reload button so users can refresh schema without the file picker.

**Do:**
1. Add `reloadProto(filePaths: string[], includePaths: string[][])` and `checkPathsExist(paths: string[])` to `src/lib/ipc.ts`.
2. In `src/stores/useProtoStore.ts`: add `recentFiles: string[]` (max 10, persisted via tap.json key `recent_files`), `addRecentFile(path: string)` action (deduplicates, prepends, trims to 10), `reloadRequested: number` counter, and `requestReload()` action. Load recent files from store on first access.
3. In `src/components/sidebar/FileSection.tsx`: add a Reload button (RefreshCw icon) next to Open button — calls reloadProto for the active file using saved include paths. Add a recent files list below the open tabs showing file names with full path tooltip. Stale files (detected via checkPathsExist on mount/reload) rendered as disabled with strikethrough. Clicking a non-stale recent file calls parseProto with its saved include paths.
4. On successful reload: update the openFiles entry schema in useProtoStore (new `updateFileSchema(filePath, schema)` action). Preserve selectedMessageType if it still exists in the new schema; fall back to first message type otherwise.
5. Add `Cmd+R` shortcut in `src/components/layout/AppLayout.tsx` using useHotkeys (same pattern as Cmd+O) that increments `reloadRequested`. FileSection listens to the counter and triggers reload.

**Done when:** `pnpm tsc --noEmit` passes; reload button triggers IPC and updates schema; recent files list renders; Cmd+R shortcut wired.

## Inputs

- `src/lib/ipc.ts`
- `src/stores/useProtoStore.ts`
- `src/components/sidebar/FileSection.tsx`
- `src/components/layout/AppLayout.tsx`
- `src-tauri/src/commands/proto.rs`

## Expected Output

- `src/lib/ipc.ts`
- `src/stores/useProtoStore.ts`
- `src/components/sidebar/FileSection.tsx`
- `src/components/layout/AppLayout.tsx`

## Verification

pnpm tsc --noEmit
