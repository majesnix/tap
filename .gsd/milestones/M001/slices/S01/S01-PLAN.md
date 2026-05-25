# S01: Keyboard Shortcuts + Field Copy

**Goal:** User sends a message via Cmd+Enter from inside CodeMirror, clears form with Cmd+Shift+R, opens proto file with Cmd+O, switches tabs with Cmd+1/2/3, and copies a field value with hover-click showing checkmark feedback. All shortcuts show platform-correct symbols in tooltips.
**Demo:** User sends a message via Cmd+Enter from inside CodeMirror, clears form with Cmd+Shift+R, switches tabs with Cmd+1/2/3, and copies a field value with hover-click showing checkmark feedback

## Must-Haves

- 1. Cmd+Enter (Ctrl+Enter on non-Mac) triggers send from anywhere including CodeMirror editor\n2. Cmd+O opens file picker\n3. Cmd+Shift+R clears form to defaults\n4. Cmd+1/2/3 switches right panel tabs\n5. Tooltips show platform-correct shortcut labels (⌘ on Mac, Ctrl on Windows/Linux)\n6. Clear button with RotateCcw icon in FormPanel header\n7. Hover-reveal copy icon on ScalarField, EnumField, BytesField with checkmark feedback

## Proof Level

- This slice proves: This slice proves: integration. Real runtime required: yes (keyboard events, clipboard API). Human/UAT required: yes (shortcut feel, tooltip placement).

## Integration Closure

Upstream surfaces consumed: setPendingReplayValues + buildDefaultValues (useProtoStore), handleSend (PublishBar), handleOpenFile (FileSection), activeTab (RightPanel). New wiring: useHotkeys hooks in FormPanel and AppLayout, CodeMirror keymap in JsonEditor, setActiveTab callback prop on RightPanel, CopyButton shared component. What remains: S02-S05 features (proto management, drafts, randomizer, schema explorer).

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Installed react-hotkeys-hook, extracted usePlatformLabel hook from Sidebar.tsx, and created CopyButton component with clipboard + icon-swap feedback** `est:45m`
  Why: All shortcuts and copy icons depend on react-hotkeys-hook and shared utilities. The usePlatformLabel hook extracts the isMac pattern already in Sidebar.tsx line 21 into a reusable hook for tooltip labels. The CopyButton component encapsulates the identical hover-reveal copy icon pattern needed by 3 field types.
  - Files: `package.json`, `src/hooks/usePlatformLabel.ts`, `src/components/form/fields/CopyButton.tsx`, `src/components/sidebar/Sidebar.tsx`, `src/hooks/__tests__/usePlatformLabel.test.ts`, `src/components/form/__tests__/CopyButton.test.tsx`
  - Verify: pnpm tsc --noEmit && pnpm vitest run src/hooks/__tests__/usePlatformLabel.test.ts src/components/form/__tests__/CopyButton.test.tsx

- [x] **T02: Added Clear button with RotateCcw icon, Cmd+Shift+R clear shortcut, Cmd+Enter send shortcut (dual-registered for form + CodeMirror), copy icons on ScalarField/EnumField/BytesField, and Send button tooltip** `est:1h30m`
  Why: R001 (Cmd+Enter send), R003 (Cmd+Shift+R clear), R006 (Clear button), R007 (copy icons) are the core form-panel features. Clear button and Cmd+Shift+R both route through setPendingReplayValues(buildDefaultValues(message)). Cmd+Enter must work from both the form and CodeMirror via dual registration. Copy icons go on ScalarField, EnumField, BytesField.
  - Files: `src/components/form/FormPanel.tsx`, `src/components/form/JsonEditor.tsx`, `src/components/form/fields/ScalarField.tsx`, `src/components/form/fields/EnumField.tsx`, `src/components/form/fields/BytesField.tsx`, `src/components/publish/PublishBar.tsx`, `src/components/form/__tests__/FormPanel.test.tsx`, `src/components/form/__tests__/ScalarField.test.tsx`, `src/components/form/__tests__/JsonEditor.test.tsx`
  - Verify: pnpm tsc --noEmit && pnpm vitest run src/components/form/__tests__/FormPanel.test.tsx src/components/form/__tests__/ScalarField.test.tsx src/components/form/__tests__/JsonEditor.test.tsx

- [x] **T03: Wired Cmd+O file open and Cmd+1/2/3 tab switch shortcuts in AppLayout, with platform-correct tooltips on RightPanel tabs** `est:1h`
  Why: R002 (Cmd+O open) and R004 (Cmd+1/2/3 tabs) complete the keyboard-first navigation. Both live in AppLayout since they cross component boundaries. RightPanel's activeTab is local state that must be exposed via callback prop. FileSection's handleOpenFile must be callable from AppLayout.
  - Files: `src/components/layout/AppLayout.tsx`, `src/components/layout/RightPanel.tsx`, `src/components/sidebar/FileSection.tsx`, `src/components/layout/RightPanel.test.tsx`
  - Verify: pnpm tsc --noEmit && pnpm vitest run src/components/layout/RightPanel.test.tsx

- [x] **T04: Added integration test exercising all keyboard shortcuts (Cmd+Enter send, Cmd+Shift+R clear, Cmd+O open, Cmd+1/2/3 tab switch) and CopyButton clipboard flow end-to-end through AppLayout** `est:45m`
  Why: Individual task tests verify units in isolation. This task adds a focused integration test that exercises the full shortcut suite and copy flow together, catching wiring bugs (e.g. double-fire on Cmd+Enter, wrong tab index mapping, tooltip rendering). Also runs the full test suite to catch regressions in existing tests.
  - Files: `src/__tests__/keyboard-shortcuts.test.tsx`
  - Verify: pnpm tsc --noEmit && pnpm vitest run

## Files Likely Touched

- package.json
- src/hooks/usePlatformLabel.ts
- src/components/form/fields/CopyButton.tsx
- src/components/sidebar/Sidebar.tsx
- src/hooks/__tests__/usePlatformLabel.test.ts
- src/components/form/__tests__/CopyButton.test.tsx
- src/components/form/FormPanel.tsx
- src/components/form/JsonEditor.tsx
- src/components/form/fields/ScalarField.tsx
- src/components/form/fields/EnumField.tsx
- src/components/form/fields/BytesField.tsx
- src/components/publish/PublishBar.tsx
- src/components/form/__tests__/FormPanel.test.tsx
- src/components/form/__tests__/ScalarField.test.tsx
- src/components/form/__tests__/JsonEditor.test.tsx
- src/components/layout/AppLayout.tsx
- src/components/layout/RightPanel.tsx
- src/components/sidebar/FileSection.tsx
- src/components/layout/RightPanel.test.tsx
- src/__tests__/keyboard-shortcuts.test.tsx
