---
id: T01
parent: S03
milestone: M001
key_files:
  - src/stores/useDraftStore.ts
  - src/App.tsx
key_decisions:
  - Key format uses `${filePath}::${messageType}` with :: as safe separator per plan
  - getDraft updates accessedAt synchronously (no disk persist) to keep it a pure getter — LRU ordering is refreshed in memory and persisted on next saveDraft
  - LRU eviction runs on saveDraft only (not on getDraft) to avoid unnecessary disk writes on reads
duration: 
verification_result: passed
completed_at: 2026-05-25T20:10:50.241Z
blocker_discovered: false
---

# T01: Created useDraftStore with tauri-plugin-store persistence, LRU eviction at 50 entries, and App.tsx mount loading

**Created useDraftStore with tauri-plugin-store persistence, LRU eviction at 50 entries, and App.tsx mount loading**

## What Happened

Created `src/stores/useDraftStore.ts` following the useHistoryStore pattern exactly: explicit `load()` from tauri-plugin-store, manual `.save()` calls, no autoSave. The store manages a `Record<string, DraftEntry>` keyed by `${filePath}::${messageType}`. Core operations: `saveDraft` adds/updates an entry and runs LRU eviction when entries exceed 50 (sorted by `accessedAt`, oldest dropped); `getDraft` returns the entry and updates its `accessedAt` timestamp (read = access per plan); `clearDraft` removes a single entry. Both `saveDraft` and `clearDraft` guard against writes before `draftsLoaded` is true, matching the useHistoryStore race-condition prevention pattern. Added `loadDrafts()` call in App.tsx's mount useEffect alongside existing `loadPlans()` call.

## Verification

Ran `pnpm tsc --noEmit` — exited cleanly with no errors, confirming the store compiles and all imports resolve correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 4000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/stores/useDraftStore.ts`
- `src/App.tsx`
