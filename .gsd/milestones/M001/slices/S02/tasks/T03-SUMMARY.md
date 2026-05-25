---
id: T03
parent: S02
milestone: M001
key_files:
  - src/components/sidebar/IncludePathManager.tsx
  - src/components/sidebar/FileSection.tsx
key_decisions:
  - IncludePathManager auto-reloads all open files (not just the active one) on path change to keep the shared DescriptorPool consistent — same pattern as handleReload in FileSection
  - On reload failure, toast.error is shown but existing schema is preserved — no form blanking on bad include path
  - Duplicate path detection with toast.info feedback to prevent accidental double-adds
duration: 
verification_result: passed
completed_at: 2026-05-25T19:51:08.399Z
blocker_discovered: false
---

# T03: Added inline IncludePathManager component with removable path chips, directory picker, and auto-reload on add/remove

**Added inline IncludePathManager component with removable path chips, directory picker, and auto-reload on add/remove**

## What Happened

Created `src/components/sidebar/IncludePathManager.tsx` — a new component that displays include paths for the active proto file as removable chip/tags. Each chip shows the directory name with a tooltip for the full path. An "Add include path" button opens the native directory picker via `@tauri-apps/plugin-dialog`. On add or remove, the component persists updated paths to `tap.json` store (keyed by `include_paths:{filePath}`), then calls `reloadProto` with all open files and their respective include paths to rebuild the DescriptorPool. On reload failure, a toast error is shown but the existing schema is preserved (updateFileSchema is only called on success).

Integrated `IncludePathManager` into `FileSection.tsx` — rendered below the file tabs and above the recent files list, only when an active file is loaded. The component reads its initial paths from the store on mount and re-reads when the active file changes (via the `filePath` prop keyed useEffect).

Verified that `handleConfirm` in FileSection already calls `addRecentFile` after successful parse (added in T02), so plan item 4 was already satisfied.

## Verification

Ran `pnpm tsc --noEmit` — passed with zero errors, confirming type safety of the new component, its integration in FileSection, and all IPC/store usage.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 5000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/components/sidebar/IncludePathManager.tsx`
- `src/components/sidebar/FileSection.tsx`
