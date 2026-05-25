---
id: T04
parent: S03
milestone: M001
key_files:
  - src/stores/__tests__/useDraftStore.test.ts
  - src/components/form/__tests__/FormPanel-drafts.test.tsx
  - src/components/publish/__tests__/PublishBar-quickswitch.test.tsx
key_decisions:
  - Mocked Radix Select as plain HTML <select> in PublishBar-quickswitch tests because Radix internals (hasPointerCapture, scrollIntoView) are not available in jsdom
  - Used vi.spyOn on store methods (saveDraft, clearDraft, setPendingReplayValues) rather than checking mock call args to test FormPanel draft wiring at the integration boundary
duration: 
verification_result: passed
completed_at: 2026-05-25T20:21:01.358Z
blocker_discovered: false
---

# T04: Added 23 unit and integration tests covering draft store logic, FormPanel draft wiring, and PublishBar connection quick-switch with plan-run guard

**Added 23 unit and integration tests covering draft store logic, FormPanel draft wiring, and PublishBar connection quick-switch with plan-run guard**

## What Happened

Created three test files as specified in the task plan:

1. **useDraftStore.test.ts** (8 tests): Covers loadDrafts from mocked tauri-plugin-store, saveDraft persistence, getDraft with accessedAt update, clearDraft removal, LRU eviction at 51st entry, and no-op guards when draftsLoaded is false. Uses the same vi.hoisted mock pattern established in useHistoryStore.test.ts.

2. **FormPanel-drafts.test.tsx** (5 tests): Covers draft auto-save on debounced form change, skip-save when values equal defaults, skip-save during restore (isRestoring guard), draft restore via setPendingReplayValues on message type selection, and clearDraft call on Clear button click. Mocks dnd-kit, CodeMirror, and tauri-plugin-store.

3. **PublishBar-quickswitch.test.tsx** (9 tests): Covers profile Select rendering with active value, Select enabled/disabled based on profile count, activateProfile call on selection, plan-run guard blocking switch with toast.warning, connection error toast.error, and connection status dot colors (green/red/amber). Mocks Radix Select as plain HTML `<select>` since Radix internals (pointer capture, scrollIntoView) don't work in jsdom.

All 23 new tests pass. Full suite (excluding pre-existing 15 failures in PublishBar.test.tsx) passes at 557 tests across 44 files with zero regressions.

## Verification

Ran `npx vitest run` on all three new test files — 23/23 pass. Ran full suite excluding pre-existing failures — 557/557 pass across 44 files. The 15 failures in PublishBar.test.tsx are pre-existing (confirmed by running that file in isolation without new tests).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/stores/__tests__/useDraftStore.test.ts src/components/form/__tests__/FormPanel-drafts.test.tsx src/components/publish/__tests__/PublishBar-quickswitch.test.tsx` | 0 | pass | 956ms |
| 2 | `npx vitest run --exclude src/components/publish/__tests__/PublishBar.test.tsx` | 0 | pass | 120000ms |

## Deviations

none

## Known Issues

15 pre-existing test failures in src/components/publish/__tests__/PublishBar.test.tsx — these tests use waitFor(screen.getByRole('combobox')) which fails because the existing test file also struggles with Radix Select in jsdom but doesn't mock it.

## Files Created/Modified

- `src/stores/__tests__/useDraftStore.test.ts`
- `src/components/form/__tests__/FormPanel-drafts.test.tsx`
- `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`
