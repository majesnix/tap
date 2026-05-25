---
id: S01
parent: M001
milestone: M001
provides:
  - react-hotkeys-hook integration pattern (useHotkeys in FormPanel, AppLayout)
  - Clear button in FormPanel header (RotateCcw icon, setPendingReplayValues path)
  - Copy icon pattern on scalar/enum/bytes fields (group/group-hover, icon swap via CopyButton)
  - usePlatformLabel shared hook for platform-correct shortcut labels
  - sendRequested/openFileRequested monotonic counter pattern in useProtoStore
  - setActiveTabRef mutable ref pattern for cross-component tab control
requires:
  []
affects:
  - S02
key_files:
  - src/hooks/usePlatformLabel.ts
  - src/components/form/fields/CopyButton.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/JsonEditor.tsx
  - src/components/form/fields/ScalarField.tsx
  - src/components/form/fields/EnumField.tsx
  - src/components/form/fields/BytesField.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/layout/RightPanel.tsx
  - src/components/publish/PublishBar.tsx
  - src/stores/useProtoStore.ts
  - src/__tests__/keyboard-shortcuts.test.tsx
key_decisions:
  - Dual-registered Cmd+Enter: window useHotkeys + CodeMirror keymap extension with .cm-editor guard to prevent double-fire
  - sendRequested/openFileRequested monotonic counters in useProtoStore as cross-component signal pattern (avoids prop-drilling)
  - setActiveTabRef mutable ref on RightPanel for tab control without lifting state to global store
  - title attribute instead of Radix Tooltip on CopyButton/Clear/tabs — simpler, avoids jsdom click interception
  - useWatch from react-hook-form for reactive field values in copy — avoids restructuring Controller/label layout
patterns_established:
  - Monotonic counter pattern in Zustand store for cross-component action signals (sendRequested, openFileRequested)
  - Mutable ref prop pattern for exposing child component setters without global state (setActiveTabRef)
  - CopyButton with hover-reveal group/group-hover + icon swap feedback pattern
  - Native KeyboardEvent dispatch with code property for testing react-hotkeys-hook v5
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T04-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-25T19:34:12.260Z
blocker_discovered: false
---

# S01: Keyboard Shortcuts + Field Copy

**Keyboard-first workflow with Cmd+Enter send (dual-registered for CodeMirror), Cmd+O file open, Cmd+Shift+R clear, Cmd+1/2/3 tab switch, Clear button, and hover-reveal copy icons on scalar/enum/bytes fields**

## What Happened

**T01** laid the foundation: installed react-hotkeys-hook v5, extracted `usePlatformLabel` from Sidebar.tsx into a shared hook, and created the `CopyButton` component with clipboard write + icon-swap feedback (Copy→Check for 1500ms). Used `title` attribute instead of Radix Tooltip to avoid jsdom click-interception issues in tests.

**T02** wired the core shortcuts and copy icons into the form: Cmd+Enter send (dual-registered as a useHotkeys window handler + CodeMirror keymap extension to handle CodeMirror's event capture), Cmd+Shift+R clear (routes through `setPendingReplayValues({})` to preserve map/repeated field integrity), and copy icons on ScalarField, EnumField, and BytesField using `useWatch` for reactive field values. Added the Clear button with RotateCcw icon in the FormPanel header. Installed `@codemirror/view` as a direct dependency for pnpm strict hoisting.

**T03** completed the shortcut surface: Cmd+O file open via `openFileRequested` counter in useProtoStore (matching the `sendRequested` pattern), and Cmd+1/2/3 tab switching in AppLayout using a `setActiveTabRef` mutable ref on RightPanel. Added platform-correct tooltip titles on all tab triggers.

**T04** added a comprehensive integration test (12 tests) exercising all keyboard shortcuts and the CopyButton clipboard flow end-to-end through AppLayout. Used native KeyboardEvent dispatch with explicit `code` property (required by react-hotkeys-hook v5) and `ctrlKey` for non-Mac jsdom environment.

## Verification

TypeScript type check (`pnpm tsc --noEmit`) passed with exit 0, no errors. Full test suite (`pnpm vitest run`) passed: 534 tests across 39 files, exit 0. Key test files: CopyButton.test.tsx (4 tests), usePlatformLabel.test.ts (3 tests), FormPanel.test.tsx (24 tests), ScalarField.test.tsx (19 tests), JsonEditor.test.tsx (9 tests), RightPanel.test.tsx (2 tests), keyboard-shortcuts.test.tsx (12 tests). No regressions in existing test suites.

## Requirements Advanced

- R001 — Cmd+Enter send wired with dual registration (window + CodeMirror keymap)
- R002 — Cmd+O file open wired via openFileRequested counter
- R003 — Cmd+Shift+R clear wired via setPendingReplayValues({})
- R004 — Cmd+1/2/3 tab switch wired via setActiveTabRef
- R005 — Title attributes on Send, Clear, and tab triggers with platform-correct labels
- R006 — Clear button with RotateCcw icon in FormPanel header
- R007 — CopyButton on ScalarField/EnumField/BytesField with hover-reveal and icon swap

## Requirements Validated

- R001 — Integration test verifies sendRequested increments on Ctrl+Enter dispatch; 534 tests pass
- R002 — Integration test verifies openFileRequested increments on Ctrl+O dispatch; 534 tests pass
- R003 — Integration test verifies form reset on Ctrl+Shift+R dispatch; 534 tests pass
- R004 — Integration test verifies tab data-state changes on Ctrl+1/2/3; 534 tests pass
- R005 — RightPanel test verifies tooltip format; title attributes on Send/Clear buttons verified in FormPanel/PublishBar tests
- R006 — FormPanel.test.tsx verifies Clear button renders and click resets form
- R007 — CopyButton.test.tsx verifies clipboard write and icon swap; ScalarField.test.tsx verifies copy icon integration

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

Used title attribute instead of Radix Tooltip on CopyButton, Clear button, and tab triggers. Radix Tooltip's portal rendering intercepts click events in jsdom, making tests unreliable. Title attribute provides equivalent UX for these simple single-word tooltips. Keyboard shortcut unit tests for useHotkeys could not be written as planned — react-hotkeys-hook v5's internal event listener does not fire in jsdom. Coverage was achieved through T04's integration tests using native KeyboardEvent dispatch instead.

## Known Limitations

react-hotkeys-hook useHotkeys does not fire in jsdom — keyboard shortcuts can only be verified via integration tests with native KeyboardEvent dispatch (not testing-library's fireEvent). Cross-platform shortcut behavior (Mac ⌘ vs Windows/Linux Ctrl) is only tested via the Ctrl path in jsdom's non-Mac environment.

## Follow-ups

S02 may add Cmd+R for proto reload using the same useHotkeys pattern established here.

## Files Created/Modified

- `package.json` — Added react-hotkeys-hook and @codemirror/view dependencies
- `src/hooks/usePlatformLabel.ts` — Extracted shared hook for platform-correct shortcut labels (⌘ vs Ctrl)
- `src/components/form/fields/CopyButton.tsx` — New component: hover-reveal copy icon with clipboard write + icon swap feedback
- `src/components/form/FormPanel.tsx` — Added Clear button, Cmd+Shift+R clear shortcut, Cmd+Enter send shortcut
- `src/components/form/JsonEditor.tsx` — Added CodeMirror keymap extension for Cmd+Enter send
- `src/components/form/fields/ScalarField.tsx` — Added CopyButton with useWatch for reactive field value
- `src/components/form/fields/EnumField.tsx` — Added CopyButton with useWatch for reactive field value
- `src/components/form/fields/BytesField.tsx` — Added CopyButton with useWatch for reactive field value
- `src/components/layout/AppLayout.tsx` — Added Cmd+O file open and Cmd+1/2/3 tab switch shortcuts
- `src/components/layout/RightPanel.tsx` — Added setActiveTabRef prop and tooltip titles on tab triggers
- `src/components/publish/PublishBar.tsx` — Added platform-correct tooltip on Send button
- `src/stores/useProtoStore.ts` — Added sendRequested and openFileRequested monotonic counters
- `src/components/sidebar/Sidebar.tsx` — Replaced inline platform detection with usePlatformLabel hook
- `src/components/sidebar/FileSection.tsx` — Added openFileRequested listener to trigger file picker
- `src/__tests__/keyboard-shortcuts.test.tsx` — Integration test: 12 tests covering all shortcuts and CopyButton flow
- `src/hooks/__tests__/usePlatformLabel.test.ts` — Unit tests for platform label hook
- `src/components/form/__tests__/CopyButton.test.tsx` — Unit tests for CopyButton component
- `src/components/layout/__tests__/RightPanel.test.tsx` — Tests for tooltip format and external ref tab switching
