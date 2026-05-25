---
estimated_steps: 7
estimated_files: 2
skills_used: []
---

# T03: Added inline IncludePathManager component with removable path chips, directory picker, and auto-reload on add/remove

**Why:** Currently include paths are only configurable via the IncludePathDialog during file open. Users need to view and edit include paths for the active file inline — and changing them should auto-reload the proto to give immediate feedback on import resolution.

**Do:**
1. Create `src/components/sidebar/IncludePathManager.tsx`: displays current include paths for the active file (read from tap.json store keyed by filePath). Shows each path as a removable chip/tag. Has an Add button that opens a directory picker (via @tauri-apps/plugin-dialog `open({ directory: true })`). On add/remove: save updated paths to tap.json store, then call reloadProto for the active file with the new paths.
2. Render IncludePathManager in FileSection below the file tabs, only when an active file is loaded.
3. On reload failure (bad include path): show parseError but keep old schema loaded — do not blank the form.
4. Update the existing IncludePathDialog flow in handleConfirm to also call `addRecentFile` after successful parse (ensures files opened via dialog appear in recent list).

**Done when:** `pnpm tsc --noEmit` passes; include paths display inline for active file; adding/removing a path triggers auto-reload.

## Inputs

- `src/components/sidebar/FileSection.tsx`
- `src/stores/useProtoStore.ts`
- `src/lib/ipc.ts`

## Expected Output

- `src/components/sidebar/IncludePathManager.tsx`
- `src/components/sidebar/FileSection.tsx`

## Verification

pnpm tsc --noEmit
