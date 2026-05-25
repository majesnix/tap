---
estimated_steps: 11
estimated_files: 1
skills_used: []
---

# T04: Added integration test exercising all keyboard shortcuts (Cmd+Enter send, Cmd+Shift+R clear, Cmd+O open, Cmd+1/2/3 tab switch) and CopyButton clipboard flow end-to-end through AppLayout

Why: Individual task tests verify units in isolation. This task adds a focused integration test that exercises the full shortcut suite and copy flow together, catching wiring bugs (e.g. double-fire on Cmd+Enter, wrong tab index mapping, tooltip rendering). Also runs the full test suite to catch regressions in existing tests.

Do:
1. Create `src/__tests__/keyboard-shortcuts.test.tsx` — integration test that:
   - Renders AppLayout (or minimal shell) with mocked Tauri IPC
   - Fires mod+enter and asserts handleSend was called
   - Fires mod+shift+r and asserts form values reset
   - Fires mod+1, mod+2, mod+3 and asserts tab panel switches
   - Renders a ScalarField, hovers, clicks copy icon, asserts clipboard.writeText called
   - Asserts tooltips render with correct platform symbols
2. Run full test suite: `pnpm vitest run` to verify no regressions.

Done when: Integration test passes, full suite green, tsc clean, zero regressions.

## Inputs

- `src/components/layout/AppLayout.tsx`
- `src/components/form/FormPanel.tsx`
- `src/components/form/JsonEditor.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/CopyButton.tsx`
- `src/hooks/usePlatformLabel.ts`

## Expected Output

- `src/__tests__/keyboard-shortcuts.test.tsx`

## Verification

pnpm tsc --noEmit && pnpm vitest run
