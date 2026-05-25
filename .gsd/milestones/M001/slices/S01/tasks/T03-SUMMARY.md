---
id: T03
parent: S01
milestone: M001
key_files:
  - src/stores/useProtoStore.ts
  - src/components/layout/AppLayout.tsx
  - src/components/layout/RightPanel.tsx
  - src/components/sidebar/FileSection.tsx
  - src/components/layout/__tests__/RightPanel.test.tsx
key_decisions:
  - Used openFileRequested monotonic counter in useProtoStore (matching sendRequested pattern) to avoid prop-drilling handleOpenFile through Sidebar
  - Used setActiveTabRef mutable ref prop on RightPanel to expose setActiveTab without lifting local state to global store — preserves Pitfall 6 invariant
  - Used title attribute for tab shortcut tooltips (consistent with CopyButton and Clear button patterns from T01/T02)
duration: 
verification_result: passed
completed_at: 2026-05-25T19:24:39.016Z
blocker_discovered: false
---

# T03: Wired Cmd+O file open and Cmd+1/2/3 tab switch shortcuts in AppLayout, with platform-correct tooltips on RightPanel tabs

**Wired Cmd+O file open and Cmd+1/2/3 tab switch shortcuts in AppLayout, with platform-correct tooltips on RightPanel tabs**

## What Happened

Added `openFileRequested` monotonic counter signal to useProtoStore (matching the established `sendRequested` pattern from T02) so AppLayout can trigger file open without prop-drilling through Sidebar. FileSection subscribes to the counter via useEffect and calls handleOpenFile when it increments.

RightPanel now accepts a `setActiveTabRef` prop — a mutable ref that AppLayout populates with the `setActiveTab` setter. This lets AppLayout switch tabs without lifting local state to the global store (preserving the Pitfall 6 invariant). Exported `RightPanelTab` type for shared use.

AppLayout registers four useHotkeys handlers: `mod+o` (file open), `mod+1` (Hex tab), `mod+2` (History tab), `mod+3` (Response tab). All use `enableOnFormTags: true` and `preventDefault: true`.

RightPanel tab triggers now show platform-correct shortcut tooltips (⌘1/⌘2/⌘3 on Mac, Ctrl+1/2/3 on other platforms) via the usePlatformLabel hook.

## Verification

TypeScript type check (`pnpm tsc --noEmit`) passed with no errors. New RightPanel test file (2 tests) passed: tooltip format verification and external ref tab switching. Existing test suite (52 tests across FormPanel, ScalarField, JsonEditor) passed with no regressions.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 8000ms |
| 2 | `pnpm vitest run src/components/layout/__tests__/RightPanel.test.tsx` | 0 | pass (2 tests) | 626ms |
| 3 | `pnpm vitest run src/components/form/__tests__/FormPanel.test.tsx src/components/form/__tests__/ScalarField.test.tsx src/components/form/__tests__/JsonEditor.test.tsx` | 0 | pass (52 tests, no regressions) | 1200ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/stores/useProtoStore.ts`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/sidebar/FileSection.tsx`
- `src/components/layout/__tests__/RightPanel.test.tsx`
