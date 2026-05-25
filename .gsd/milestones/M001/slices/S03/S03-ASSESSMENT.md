---
sliceId: S03
uatType: artifact-driven
verdict: PASS
date: 2026-05-25T22:31:00Z
---

# UAT Result — S03

## Preconditions

| Check | Result | Notes |
|-------|--------|-------|
| TypeScript compiles (`tsc --noEmit`) | PASS | Clean compilation, no errors |
| All 580 tests pass (`npx vitest run`) | PASS | 45 test files, 580 tests, 5.90s |
| S03-specific tests (23 tests) | PASS | 3 test files, 23 tests all green |

## Checks

| Check | Mode | Result | Notes |
|-------|------|--------|-------|
| Draft auto-save and restore on message type switch | artifact | PASS | `useDraftStore` implements `saveDraft`/`getDraft` with `${filePath}::${messageType}` key format. `FormPanel` restores via `setPendingReplayValues` on `selectedMessageType` change with `isRestoringRef` guard. 8 draft store tests + 5 FormPanel-drafts tests cover scalars, maps, oneof, and round-trip. |
| Draft survives app restart | artifact | PASS | `useDraftStore` uses `tauri-plugin-store` for persistence (`LazyStore`). `loadDrafts()` called on mount in `FormPanel` and `App.tsx`. Tests verify `getDraft` returns persisted values after store reload. |
| Clear draft | artifact | PASS | `clearDraft` removes the key from store and calls `store.save()`. FormPanel clear handler calls `clearDraft(activeFilePath, selectedMessageType)` alongside `setPendingReplayValues(buildDefaultValues(msg))`. Tested in FormPanel-drafts tests. |
| Connection quick-switch from PublishBar | artifact | PASS | PublishBar renders a `Select` dropdown with saved profiles. `onValueChange` calls `activateProfile(name)` via IPC. Status dot updates based on connection state (green/amber/red). 3 rendering tests + 1 activation test + 3 status dot tests cover this. |
| Plan-run guard blocks switching | artifact | PASS | Line 106-108 in PublishBar: `usePlanExecutionStore.getState().isRunning` check with `toast.warning("Cannot switch profile while a plan is running")`. Dedicated test verifies the guard blocks and shows toast. |
| LRU eviction at 50 entries | artifact | PASS | `MAX_DRAFTS = 50` constant. `evictLRU` function sorts by `lastAccessed` timestamp, removes oldest entries beyond limit. Test in useDraftStore.test.ts verifies eviction of 51st entry. |
| Single profile disables dropdown | artifact | PASS | `disabled={profiles.length <= 1}` at line 357 in PublishBar. Test "Select is disabled when only one profile exists" verifies. |
| Default/empty values not persisted | artifact | PASS | `saveDraft` checks for non-empty values before persisting. FormPanel auto-save skips when `isRestoringRef.current` is true (line 154). Tested in draft store tests. |
| Key file existence | artifact | PASS | `useDraftStore.ts` (2.7KB), `FormPanel.tsx` (18.8KB), `PublishBar.tsx` (22.4KB) all present |
| Draft key format uses `${filePath}::${messageType}` | artifact | PASS | Confirmed at line 23 of useDraftStore.ts: `` return `${filePath}::${messageType}` `` |
| isRestoringRef 300ms timeout guard | artifact | PASS | FormPanel line 196-198: sets `isRestoringRef.current = true`, then `setTimeout(() => { isRestoringRef.current = false; }, 300)` to prevent save-on-restore feedback loop |
| Connection status dot colors | artifact | PASS | 3 dedicated tests: green dot when connected, red dot on error, amber dot when disconnected |

## Overall Verdict

PASS — All 12 automatable checks passed. TypeScript compiles cleanly, all 580 tests pass (including 23 S03-specific tests), and artifact inspection confirms draft persistence with LRU eviction, connection quick-switch with plan-run guard, and status dot updates are all correctly implemented.

## Notes

- The `act()` warnings in test output are cosmetic (Radix component internals) as documented in the UAT spec — they do not affect test correctness.
- PublishBar-quickswitch tests mock Radix Select as plain HTML `<select>` due to jsdom limitations — this is intentional and documented.
- UAT spec lists mode as `artifact-driven` (all features testable via automated tests without live RabbitMQ), which matches the checks performed.
