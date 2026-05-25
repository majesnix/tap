# S01: Keyboard Shortcuts + Field Copy — Research

**Date:** 2026-05-25
**Depth:** Targeted research — known technology (react-hotkeys-hook), established codebase patterns, moderate integration complexity (CodeMirror dual-registration).

## Summary

S01 adds four keyboard shortcuts (Cmd+Enter send, Cmd+O open, Cmd+Shift+R clear, Cmd+1/2/3 tabs), a Clear button in the FormPanel header, and hover-reveal copy icons on scalar/enum/bytes fields. The codebase has no existing keyboard shortcut infrastructure — `react-hotkeys-hook` must be installed as a new dependency. All form reset paths must route through `setPendingReplayValues` (the established mandatory form-fill path from Phase 25). The primary risk is the Cmd+Enter dual-registration: CodeMirror captures key events before they reach the window, so both a window-level `useHotkeys` handler and a CodeMirror keymap extension are needed, with a `.cm-editor` guard to prevent double-firing.

The copy icon pattern is straightforward: hover-reveal via Tailwind `group/group-hover`, clipboard write via `navigator.clipboard.writeText()`, and a 1500ms icon swap (Copy → Check) for feedback. Three field components need the same pattern (ScalarField, EnumField, BytesField), differing only in copy format (string value, enum name, base64 string).

## Recommendation

1. **Install `react-hotkeys-hook@^5`** — lightweight, React-lifecycle-integrated, supports `enableOnFormTags` for inhibit control.
2. **Extract a shared `CopyButton` component** — identical pattern across 3 field types; extract to `src/components/form/fields/CopyButton.tsx` to avoid triple duplication.
3. **Extract a `usePlatformLabel` hook** — platform detection (`isMac`) is already in `Sidebar.tsx` line 21; extract to `src/hooks/usePlatformLabel.ts` for tooltip shortcut symbols (⌘ vs Ctrl).
4. **Expose `setActiveTab` from RightPanel** — current `activeTab` is local state; expose via callback prop or ref for Cmd+1/2/3.
5. **Expose `handleOpenFile` from FileSection** — either hoist to a store action or accept a trigger ref/callback for Cmd+O.

## Implementation Landscape

### Key Files

- `src/components/form/FormPanel.tsx` — Clear button location (header button group at line ~370), Cmd+Enter window handler, Cmd+Shift+R handler. Uses `setPendingReplayValues` + `buildDefaultValues(message)` for clear. Must set `isJsonMode(false)` BEFORE triggering clear (consume effect at line 154 exits early if JSON mode is true).
- `src/components/form/JsonEditor.tsx` — CodeMirror instance (line ~31). Needs new `onSubmit` callback prop + keymap extension injected via `extensions` array. Currently only has `[json()]` extension.
- `src/components/form/fields/ScalarField.tsx` — Label row at line ~131. Outer div needs `group` class; copy button with `ml-auto opacity-0 group-hover:opacity-100`. Copy format: `String(rhfField.value)`.
- `src/components/form/fields/EnumField.tsx` — Same label row pattern at line ~31. Copy format: resolve enum name via `field.kind.values.find(v => v.number === rhfField.value)?.name`.
- `src/components/form/fields/BytesField.tsx` — Same label row pattern at line ~89. Copy format: base64 string as-is (`rhfField.value`).
- `src/components/form/ProtoFormRenderer.tsx` — `buildDefaultValues()` already exported (line ~47). No changes needed. FROZEN switch (D-01).
- `src/stores/useProtoStore.ts` — `setPendingReplayValues` signal already exists (line ~175). No changes needed.
- `src/components/publish/PublishBar.tsx` — Send button at line ~489. Needs tooltip with platform-branched shortcut label. `handleSend` is the function Cmd+Enter must trigger.
- `src/components/layout/AppLayout.tsx` — Three-column layout. Cmd+O and Cmd+1/2/3 registration site. Needs to receive `setActiveTab` callback from RightPanel.
- `src/components/layout/RightPanel.tsx` — `activeTab` is local useState (line ~11). Tab values: `"hex"`, `"history"`, `"response"`. Must expose `setActiveTab` via callback prop for Cmd+1/2/3.
- `src/components/sidebar/FileSection.tsx` — `handleOpenFile()` at line ~40 uses `@tauri-apps/plugin-dialog` `open()`. Must be callable from Cmd+O shortcut.
- `src/components/sidebar/Sidebar.tsx` — Platform detection pattern at line 21: `const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent);`

### Build Order

**Phase 1 — Foundation (unblocks everything):**
1. Install `react-hotkeys-hook` dependency
2. Extract `usePlatformLabel` hook (used by all tooltips)
3. Extract `CopyButton` component (used by 3 field types)

**Phase 2 — Clear button + shortcut (lowest risk, proves pattern):**
4. Add Clear button to FormPanel header (RotateCcw icon, tooltip)
5. Add Cmd+Shift+R shortcut in FormPanel via `useHotkeys`

**Phase 3 — Copy icons (parallel across 3 files):**
6. Add CopyButton to ScalarField label row
7. Add CopyButton to EnumField label row
8. Add CopyButton to BytesField label row

**Phase 4 — Send shortcut (highest complexity):**
9. Add `onSubmit` prop + keymap extension to JsonEditor
10. Add Cmd+Enter window-level handler in FormPanel with `.cm-editor` guard
11. Add tooltip to Send button in PublishBar

**Phase 5 — Navigation shortcuts:**
12. Expose `handleOpenFile` from FileSection (hoist or ref)
13. Add Cmd+O shortcut in AppLayout
14. Expose `setActiveTab` from RightPanel via callback prop
15. Add Cmd+1/2/3 shortcuts in AppLayout
16. Add tooltips to tab triggers in RightPanel

### Natural Seams

- **CopyButton component** — fully independent; can be built and tested in isolation
- **Clear button + Cmd+Shift+R** — independent of other shortcuts; touches only FormPanel
- **Copy icons on 3 field types** — parallel work once CopyButton exists
- **Cmd+Enter dual registration** — touches FormPanel + JsonEditor; sequential dependency
- **Tab shortcuts** — touches RightPanel + AppLayout; independent of send/clear shortcuts
- **Cmd+O** — touches FileSection + AppLayout; independent of other shortcuts

### First Proof

**Clear button + Cmd+Shift+R** — lowest risk, fewest files, proves the `useHotkeys` + `setPendingReplayValues` pattern. If this works, the same pattern applies to all other shortcuts.

### Verification

- `pnpm tsc --noEmit` — type check after each task
- `pnpm vitest run` — existing test suite (ensure no regressions)
- Unit tests for: `CopyButton` icon swap, `usePlatformLabel` output, clear callback routing
- Manual verification: each shortcut fires correctly, copy works, tooltips show correct platform symbols

## Constraints & Gotchas

| Constraint | Impact |
|-----------|--------|
| `resetRef` is null until ProtoFormRenderer mounts | Clear must use `setPendingReplayValues`, never `resetRef.current()` directly |
| `isJsonMode` must be false before `setPendingReplayValues` | Consume effect (FormPanel line 154) exits early if JSON mode is true |
| CodeMirror captures Cmd+Enter before window | Dual registration required; window handler must check `.cm-editor` to avoid double-fire |
| ProtoFormRenderer switch is FROZEN (D-01) | No new field types; copy icon is added inside existing field components |
| `activeTab` in RightPanel is local state | Must expose callback for Cmd+1/2/3; hoisting state is more invasive |
| `handleOpenFile` is local to FileSection | Must expose for Cmd+O; options: store action, ref, or event |
| `navigator.clipboard.writeText()` may fail | Catch and show Sonner toast: "Copy failed — clipboard not available" |
| Platform tooltip symbols | Use established `isMac` pattern from Sidebar.tsx line 21; extract to shared hook |

## Existing Patterns to Follow

- **Tooltip pattern:** `PublishBar.tsx` lines 503–517 — `TooltipProvider > Tooltip > TooltipTrigger asChild > TooltipContent`
- **Button icon pattern:** FormPanel header buttons — `variant="ghost" size="icon"` with lucide icon
- **Platform detection:** `Sidebar.tsx` line 21 — `const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent)`
- **Form reset flow:** `setPendingReplayValues(buildDefaultValues(message))` — used in FormPanel line 237/250

## Skill Recommendations

- **`react-hotkeys-hook`** — not yet installed; `pnpm add react-hotkeys-hook@^5` needed. No agent skill needed; library is straightforward.
- **`shadcn`** skill already available — relevant for any new UI components (CopyButton tooltip wrapping).
- No additional skills needed for this slice. Technologies are React, Tailwind, CodeMirror, and clipboard API — all well-known.

## Requirements Coverage

| Req | Description | Approach |
|-----|------------|----------|
| R001 | Cmd+Enter send from anywhere including CodeMirror | Dual registration: `useHotkeys` in FormPanel + CodeMirror keymap in JsonEditor |
| R002 | Cmd+O opens file picker | `useHotkeys` in AppLayout, triggers FileSection's `handleOpenFile` |
| R003 | Cmd+Shift+R clears form | `useHotkeys` in FormPanel, calls `setPendingReplayValues(buildDefaultValues(message))` |
| R004 | Cmd+1/2/3 tab switching | `useHotkeys` in AppLayout, calls RightPanel's exposed `setActiveTab` |
| R005 | Shortcuts discoverable via tooltips | Platform-branched tooltips on Send, Clear, Open, Tab triggers |
| R006 | Clear button in form header | RotateCcw icon button in FormPanel header button group |
| R007 | Copy field value via hover-reveal icon | CopyButton component on ScalarField, EnumField, BytesField |
