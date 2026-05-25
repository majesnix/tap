---
estimated_steps: 12
estimated_files: 9
skills_used: []
---

# T02: Added Clear button with RotateCcw icon, Cmd+Shift+R clear shortcut, Cmd+Enter send shortcut (dual-registered for form + CodeMirror), copy icons on ScalarField/EnumField/BytesField, and Send button tooltip

Why: R001 (Cmd+Enter send), R003 (Cmd+Shift+R clear), R006 (Clear button), R007 (copy icons) are the core form-panel features. Clear button and Cmd+Shift+R both route through setPendingReplayValues(buildDefaultValues(message)). Cmd+Enter must work from both the form and CodeMirror via dual registration. Copy icons go on ScalarField, EnumField, BytesField.

Do:
1. FormPanel.tsx: Add RotateCcw Clear button in header button group (after existing buttons, line ~370). Tooltip shows platform-branched shortcut. On click: if isJsonMode, call setIsJsonMode(false) first, then setPendingReplayValues(buildDefaultValues(message)).
2. FormPanel.tsx: Add `useHotkeys('mod+shift+r', handler, { preventDefault: true, enableOnFormTags: true })` for clear. Same logic as button click.
3. FormPanel.tsx: Add `useHotkeys('mod+enter', handler, { preventDefault: true, enableOnFormTags: true })` for send. Handler checks `document.activeElement?.closest('.cm-editor')` — if true, skip (CodeMirror keymap handles it). Otherwise call handleSend (must receive via prop or invoke context).
4. JsonEditor.tsx: Add `onSubmit` callback prop. Add CodeMirror keymap extension: `keymap.of([{ key: 'Mod-Enter', run: () => { onSubmit?.(); return true; } }])` to extensions array.
5. ScalarField.tsx: Add `group` class to label row div. Add `<CopyButton value={String(rhfField.value)} />` after label text.
6. EnumField.tsx: Add `group` class to label row div. Add CopyButton with value = resolved enum name via `field.kind.values.find(v => v.number === rhfField.value)?.name ?? ''`.
7. BytesField.tsx: Add `group` class to label row div. Add CopyButton with value = `String(rhfField.value)` (base64 string).
8. PublishBar.tsx: Add Tooltip around Send button showing platform-branched shortcut label.
9. Write/update tests: FormPanel clear button renders and fires, CopyButton integrated in ScalarField, Cmd+Enter dual-registration logic.

Done when: Clear button visible in header, Cmd+Shift+R clears form, Cmd+Enter sends from form and CodeMirror, copy icons appear on hover for scalar/enum/bytes fields, tooltips show correct platform symbols, tests pass, tsc clean.

## Inputs

- `src/components/form/FormPanel.tsx`
- `src/components/form/JsonEditor.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/publish/PublishBar.tsx`
- `src/stores/useProtoStore.ts`
- `src/components/form/ProtoFormRenderer.tsx`
- `src/hooks/usePlatformLabel.ts`
- `src/components/form/fields/CopyButton.tsx`

## Expected Output

- `src/components/form/FormPanel.tsx`
- `src/components/form/JsonEditor.tsx`
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/publish/PublishBar.tsx`

## Verification

pnpm tsc --noEmit && pnpm vitest run src/components/form/__tests__/FormPanel.test.tsx src/components/form/__tests__/ScalarField.test.tsx src/components/form/__tests__/JsonEditor.test.tsx
