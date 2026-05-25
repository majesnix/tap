---
id: T04
parent: S02
milestone: M001
key_files:
  - src/stores/__tests__/useProtoStore-reload.test.ts
  - src/components/sidebar/__tests__/FileSection-reload.test.tsx
  - src/components/sidebar/__tests__/IncludePathManager.test.tsx
key_decisions:
  - Fresh store mock objects created per beforeEach instead of shared hoisted object — prevents mock state leakage between tests
  - Store tests use direct getState()/setState() pattern consistent with existing useAmqpStore.test.ts
  - Component tests use vi.hoisted() for invoke/open mocks but per-test factory for store get/set/save to isolate side effects from useEffect hooks
duration: 
verification_result: passed
completed_at: 2026-05-25T19:57:02.425Z
blocker_discovered: false
---

# T04: Added 18 unit and integration tests covering reload, recent files, and include path management

**Added 18 unit and integration tests covering reload, recent files, and include path management**

## What Happened

Created three test files covering the new S02 functionality:

1. **useProtoStore-reload.test.ts** (11 tests): Tests addRecentFile (dedup, cap at 10, prepend order), updateFileSchema (preserves selectedMessageType when type exists, falls back to first message or null otherwise, no-ops for non-active files and unknown paths), reloadRequested counter increment, and setRecentFiles replacement.

2. **FileSection-reload.test.tsx** (7 tests): Mocks IPC (invoke), tauri-plugin-store (load/get/set/save), and tauri-plugin-dialog (open). Tests reload button visibility (shown when files open, hidden when empty), reloadProto IPC called with correct filePaths and includePaths args, recent files rendering, filtering of currently-open files from recent list, stale file entries rendered as disabled, and Cmd+R shortcut triggering reload via the reloadRequested counter.

3. **IncludePathManager.test.tsx** (4 tests): Mocks same Tauri modules. Tests include path chips rendering from saved paths, fallback to parent dir when no saved paths, remove path triggering reload, and add path opening directory picker then triggering reload (with cancelled-picker no-op test).

Key implementation detail: Each test creates fresh store mock objects per `beforeEach` to prevent mock state leakage between tests — the shared-object pattern caused subtle failures where `store.get` retained configured return values across tests.

## Verification

Ran `pnpm vitest run` — all 557 tests pass (42 test files), including 18 new tests across 3 files. No regressions in existing test suite.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm vitest run` | 0 | pass | 5960ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/stores/__tests__/useProtoStore-reload.test.ts`
- `src/components/sidebar/__tests__/FileSection-reload.test.tsx`
- `src/components/sidebar/__tests__/IncludePathManager.test.tsx`
