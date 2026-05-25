---
id: T02
parent: S01
milestone: M001
key_files:
  - src/components/form/FormPanel.tsx
  - src/components/form/JsonEditor.tsx
  - src/components/form/fields/ScalarField.tsx
  - src/components/form/fields/EnumField.tsx
  - src/components/form/fields/BytesField.tsx
  - src/components/publish/PublishBar.tsx
  - src/stores/useProtoStore.ts
  - package.json
key_decisions:
  - Used sendRequested monotonic counter in useProtoStore as the cross-component send signal — follows the existing pendingReplayValues/lastSendAt signal pattern, avoids prop-drilling handleSend across component boundaries
  - Installed @codemirror/view as direct dependency — pnpm strict hoisting prevents importing from nested node_modules; needed for keymap extension in JsonEditor
  - Used useWatch from react-hook-form in field components to get reactive field values for CopyButton — avoids restructuring the existing Controller/label layout
  - react-hotkeys-hook useHotkeys cannot be unit-tested in jsdom — the library's internal event registration does not fire in jsdom's KeyboardEvent dispatch; keyboard shortcut coverage deferred to T04 integration tests
duration: 
verification_result: passed
completed_at: 2026-05-25T19:21:22.576Z
blocker_discovered: false
---

# T02: Added Clear button with RotateCcw icon, Cmd+Shift+R clear shortcut, Cmd+Enter send shortcut (dual-registered for form + CodeMirror), copy icons on ScalarField/EnumField/BytesField, and Send button tooltip

**Added Clear button with RotateCcw icon, Cmd+Shift+R clear shortcut, Cmd+Enter send shortcut (dual-registered for form + CodeMirror), copy icons on ScalarField/EnumField/BytesField, and Send button tooltip**

## What Happened

Added a Clear button (RotateCcw icon) to the FormPanel header button group. Both the button click and `Cmd+Shift+R` shortcut route through `setPendingReplayValues(buildDefaultValues(message))` per MEM003. Added `Cmd+Enter` send shortcut in FormPanel via `useHotkeys` — the handler checks `document.activeElement?.closest('.cm-editor')` to skip when CodeMirror has focus (MEM002 dual-registration strategy). For CodeMirror, added an `onSubmit` callback prop to JsonEditor with a `keymap.of([{ key: 'Mod-Enter', run }])` extension. Both paths trigger send via a new `sendRequested` monotonic counter signal in useProtoStore (same pattern as `lastSendAt` and `pendingReplayValues`). PublishBar watches `sendRequested` via useEffect and calls `handleSend`.

Added CopyButton (from T01) to ScalarField, EnumField, and BytesField label rows. Each field component uses `useWatch` from react-hook-form to get the current value reactively. EnumField resolves the enum name via `values.find(v => v.number === watchedValue)?.name`. All three field containers have `group` class for hover-reveal via CopyButton's `opacity-0 group-hover:opacity-100`.

Added a Tooltip on the PublishBar Send button showing the platform-correct shortcut label (e.g., `⌘+Enter` on Mac).

Installed `@codemirror/view` as a direct dependency (was only nested in pnpm store via `@uiw/react-codemirror`) for the `keymap` import in JsonEditor.

Wrote 5 new tests: 3 for Clear button (renders, tooltip has shortcut symbol, clicking calls setPendingReplayValues with defaults), 1 for CopyButton integration in ScalarField, 1 for JsonEditor onSubmit prop. All 520 tests pass (515 existing + 5 new), zero regressions.

## Verification

Ran `pnpm tsc --noEmit` (clean, exit 0) and `pnpm vitest run` (520 tests, 37 files, all passing). Task-specific tests (`FormPanel.test.tsx` — 24 tests, `ScalarField.test.tsx` — 19 tests, `JsonEditor.test.tsx` — 9 tests) all pass. Keyboard shortcut tests for `useHotkeys` cannot be unit-tested in jsdom (react-hotkeys-hook's internal event registration doesn't fire in jsdom) — these require integration/E2E testing in T04.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 3000ms |
| 2 | `pnpm vitest run src/components/form/__tests__/FormPanel.test.tsx src/components/form/__tests__/ScalarField.test.tsx src/components/form/__tests__/JsonEditor.test.tsx` | 0 | pass (52 tests) | 1210ms |
| 3 | `pnpm vitest run` | 0 | pass (520 tests, 37 files, 0 regressions) | 5100ms |

## Deviations

Keyboard shortcut unit tests (Cmd+Enter, Cmd+Shift+R) could not be written as planned because react-hotkeys-hook v5's internal event listener does not fire in jsdom. The Clear button's click handler is tested directly instead. Full shortcut coverage is deferred to T04 integration tests.

## Known Issues

react-hotkeys-hook useHotkeys does not fire in jsdom — keyboard shortcuts require real browser or E2E testing for verification.

## Files Created/Modified

- `src/components/form/FormPanel.tsx`
- `src/components/form/JsonEditor.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/publish/PublishBar.tsx`
- `src/stores/useProtoStore.ts`
- `package.json`
