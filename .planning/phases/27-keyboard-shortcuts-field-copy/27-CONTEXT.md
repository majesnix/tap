# Phase 27: Keyboard Shortcuts + Field Copy - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can control the entire send workflow without touching the mouse: send (Cmd+Enter), open proto picker (Cmd+O), clear form (Cmd+Shift+R), and navigate main tabs (Cmd+1/2/3) via keyboard shortcuts. A Clear button in the form panel header provides a single-click alternative. Hovering over any scalar, enum, or bytes field reveals a copy icon; clicking it copies the field's current value to clipboard with a brief checkmark feedback.

**In scope:** KB-01, KB-02, KB-03, KB-04, KB-05, FRM-01, FRM-02
**Out of scope:** Randomizer (Phase 30), draft persistence (Phase 29), custom keybindings (deferred)

</domain>

<decisions>
## Implementation Decisions

### Keyboard Shortcut Library
- **D-01:** Use `react-hotkeys-hook@^5.3.2` — install via `pnpm add react-hotkeys-hook`. This is the designated dependency from research; no native addEventListener approach.

### Shortcut Inhibit Scope
- **D-02:** Cmd+Shift+R (clear) — inhibited when an `<input>`, `<textarea>`, or contenteditable has focus. Use `react-hotkeys-hook` default behavior (`enableOnFormTags: false`). Prevents accidental form clears while filling out fields.
- **D-03:** Cmd+1/2/3 (tab navigation) — same inhibit rule as Cmd+Shift+R. Blocked when the user is typing inside any form element.
- **D-04:** Cmd+Enter (send) — fires everywhere, including inside text inputs and CodeMirror. This is the exception; matches the locked requirement (KB-01) and STATE.md constraint.
- **D-05:** Cmd+O (open picker) — fires globally. It's a safe system-level shortcut with no text-entry conflict.

### CodeMirror + Cmd+Enter
- **D-06:** Dual registration required for Cmd+Enter: (1) window-level `useHotkeys` handler, (2) CodeMirror keymap extension injected into `JsonEditor`. The window handler must check `event.target.closest('.cm-editor')` to avoid double-firing. Architecture locked in STATE.md.

### Clear Button
- **D-07:** Clear button is placed in the form panel header, right side — alongside the existing JSON toggle and block library toggle buttons. Small icon button with tooltip showing `Cmd+Shift+R`.
- **D-08:** Clear behavior always: exit JSON override mode (if active) AND reset all form fields to `buildDefaultValues()`. Clear = clean slate regardless of current mode. Route through `setPendingReplayValues(buildDefaultValues(message))` — never call `resetRef.current()` directly.
- **D-09:** In JSON mode, Clear exits JSON mode (sets `isJsonMode = false`) then triggers `setPendingReplayValues`. The JSON draft string is discarded.

### Copy Field UX
- **D-10:** Copy icon is hover-reveal only — appears on field row hover using Tailwind `group/group-hover`. Never always-visible; keeps the form clean.
- **D-11:** Copy format: string representation as-is. int64 copies the string value (e.g. `"123456789012345"`), bool copies `"true"` or `"false"`, enum copies the string name (e.g. `"STATUS_OK"`), bytes copies the base64 string. Simple, predictable, no precision loss.
- **D-12:** Copy feedback: brief icon swap — copy icon flips to a lucide-react `Check` icon for ~1500ms, then reverts. No Sonner toast. Lightweight, non-intrusive.
- **D-13:** Copy applies to scalar, enum, and bytes fields (ScalarField + EnumField + BytesField). Does not apply to repeated, map, nested message, or oneof wrapper fields.

### Tooltip Discoverability (KB-05)
- **D-14:** Every button with a keyboard shortcut shows the shortcut in its tooltip. Use existing `Tooltip`/`TooltipContent` shadcn pattern. Format: `"Send (⌘↵)"` on macOS, `"Send (Ctrl+Enter)"` on Windows/Linux. Use `navigator.platform` or Tauri `os.platform()` to branch the label.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §KB-01–KB-05, §FRM-01–FRM-02 — Full requirement text for this phase

### Codebase Integration Points
- `src/components/form/FormPanel.tsx` — Clear button goes here; `setPendingReplayValues` and `isJsonMode` state live here; Cmd+Shift+R + Cmd+Enter registration point
- `src/components/form/JsonEditor.tsx` — CodeMirror instance; must receive a keymap extension prop for Cmd+Enter
- `src/components/form/fields/ScalarField.tsx` — Copy icon added here (hover-reveal, checkmark feedback)
- `src/components/form/ProtoFormRenderer.tsx` — The "switch is FROZEN" constraint; no new switch cases
- `src/stores/useProtoStore.ts` — `setPendingReplayValues` signal; `buildDefaultValues` import source

### Architecture Constraints (from STATE.md)
- `setPendingReplayValues` is the MANDATORY form-fill path — Clear, replay, and draft restore all go through this signal
- `ProtoFormRenderer` switch is FROZEN — no new cases; use pre-dispatch branches and read-only store access
- CodeMirror captures Cmd+Enter — dual registration required (window handler + CM keymap extension in JsonEditor)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/tooltip.tsx` — shadcn Tooltip; use for shortcut discoverability (KB-05)
- `lucide-react` — `Copy`, `Check`, `X`, `RotateCcw` icons available; use `Copy`→`Check` swap for copy feedback
- `src/components/form/ProtoFormRenderer.tsx` `buildDefaultValues()` — exported util; use for Clear reset target
- `useProtoStore.setPendingReplayValues` — mandatory reset path; already wired in FormPanel

### Established Patterns
- **Sonner toast** — used for BLK-08 warnings; NOT used for copy feedback (decided above, D-12)
- **`group/group-hover` Tailwind** — use for hover-reveal copy icon on field rows
- **`isJsonMode` local state** — in FormPanel; Clear must set this to `false` before resetting

### Integration Points
- `FormPanel.tsx` — registers global hotkeys, places Clear button, sets `isJsonMode = false` on clear
- `JsonEditor.tsx` — receives a `onSubmit` or `keymapExtension` prop to wire Cmd+Enter inside CodeMirror
- `ScalarField.tsx` / `EnumField.tsx` / `BytesField.tsx` — each gets hover-reveal copy icon appended to the field row
- Main app tab component (wherever Cmd+1/2/3 map to) — needs hotkey registration for tab switching

</code_context>

<specifics>
## Specific Ideas

- Icon swap duration: 1500ms (not too short to miss, not too long to annoy)
- Platform label branching for tooltip: `⌘` on macOS, `Ctrl+` on Windows/Linux
- Clear button icon: `RotateCcw` (lucide) with tooltip `"Clear form (⌘⇧R)"` or equivalent
- `enableOnFormTags: false` is the react-hotkeys-hook option for inhibiting in inputs (the default)

</specifics>

<deferred>
## Deferred Ideas

- Customizable keyboard shortcuts — v1.9+
- Copy for complex fields (repeated, map, nested) — could be a JSON copy, deferred to future polish
- Keyboard shortcut cheat sheet / help modal — future phase

</deferred>

---

*Phase: 27-keyboard-shortcuts-field-copy*
*Context gathered: 2026-05-25*
