---
id: T04
parent: S01
milestone: M001
key_files:
  - src/__tests__/keyboard-shortcuts.test.tsx
key_decisions:
  - Used native KeyboardEvent dispatch with explicit `code` property instead of fireEvent.keyDown — react-hotkeys-hook v5 uses e.code for key tracking and silently ignores events without it
  - Used ctrlKey (not metaKey) in tests since jsdom user agent is non-Mac, matching the mod→ctrl mapping
  - Mocked heavy leaf components (Sidebar, PublishBar, HexPreviewPanel, etc.) but kept real AppLayout/FormPanel/RightPanel/ScalarField/CopyButton for true integration coverage
  - Verified tab switching via Radix data-state='active' attribute on tab triggers rather than checking content panel visibility
duration: 
verification_result: passed
completed_at: 2026-05-25T19:31:50.710Z
blocker_discovered: false
---

# T04: Added integration test exercising all keyboard shortcuts (Cmd+Enter send, Cmd+Shift+R clear, Cmd+O open, Cmd+1/2/3 tab switch) and CopyButton clipboard flow end-to-end through AppLayout

**Added integration test exercising all keyboard shortcuts (Cmd+Enter send, Cmd+Shift+R clear, Cmd+O open, Cmd+1/2/3 tab switch) and CopyButton clipboard flow end-to-end through AppLayout**

## What Happened

Created `src/__tests__/keyboard-shortcuts.test.tsx` — an integration test that renders the full AppLayout component tree with mocked leaf components (Sidebar, PublishBar, HexPreviewPanel, etc.) but real shortcut-handling components (AppLayout, FormPanel, RightPanel, ScalarField, CopyButton). Uses the real zustand stores for state verification.

Key challenge: react-hotkeys-hook v5 uses `e.code` (not `e.key`) for key tracking via its internal `hotkeys-js` engine. Standard `fireEvent.keyDown` and even `new KeyboardEvent` without a `code` property silently fail. Built a `pressKey` helper that dispatches both `keydown` and `keyup` events with proper `code` values (e.g., `KeyO`, `Digit1`, `Enter`).

jsdom's user agent is non-Mac, so `mod` maps to `ctrl` — all shortcut events use `ctrlKey: true`, which correctly tests the cross-platform path.

12 tests cover: Cmd+Enter send (from document and form input), Cmd+Shift+R clear (verifies setPendingReplayValues called with defaults), Cmd+O open file (verifies openFileRequested incremented), Cmd+1/2/3 tab switching (verifies active tab via data-state attribute), CopyButton rendering on ScalarField, clipboard.writeText invocation, and green check icon feedback with timer.

Full suite: 534 tests pass, tsc clean, zero regressions.

## Verification

Ran `pnpm tsc --noEmit` (clean, exit 0) and `pnpm vitest run` (534 tests pass across 39 files, exit 0). Integration test file passes all 12 tests. No regressions in existing tests.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 4000ms |
| 2 | `pnpm vitest run` | 0 | pass — 534 tests, 39 files, 0 failures | 5160ms |
| 3 | `pnpm vitest run src/__tests__/keyboard-shortcuts.test.tsx` | 0 | pass — 12/12 tests | 938ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/__tests__/keyboard-shortcuts.test.tsx`
