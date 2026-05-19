# Phase 11: Block Library — Store, Editor, Persistence - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the block library panel: a fixed-width panel that slides into the left side of the center `<main>` column, showing a list of named JSON blocks. Users can create, edit, delete, and persist blocks across restarts. Phase 12 handles the DnD application mechanism (BLK-06, BLK-07, BLK-08) — this phase is the foundation layer only.

**Requirements in scope:** BLK-01, BLK-02, BLK-03, BLK-04, BLK-05

</domain>

<decisions>
## Implementation Decisions

### Panel Placement and Layout (BLK-01)
- **D-01:** The block library panel appears as a **left-side column inside `<main>`** when open. `AppLayout`'s `<main>` becomes a flex row: `[BlockLibraryPanel 256px][FormPanel flex-1]`. The panel is conditionally rendered (open/closed state), not always mounted — it slides in by toggling the render.
- **D-02:** Panel width: **fixed 256px** (`w-64`). FormPanel keeps `flex-1` so it expands back to full width when panel is closed.
- **D-03:** Toggle button is placed on the **right side of the FormPanel header**, beside the existing JSON toggle (Braces) button. FormPanel header right side: `[BlockLibrary icon button][Braces icon button]`.
- **D-04:** Panel open/closed state is **local React state in AppLayout** (or FormPanel, depending on where the toggle button lives). It is a session-only UI state — not persisted.

### Block Editor Workflow (BLK-02, BLK-03)
- **D-05:** The panel has **two internal views**: a **list view** (default — shows all saved block names with Edit/Delete actions) and an **editor view** (name field + CodeMirror editor). Clicking a block name or the "+ New Block" button switches to editor view. A Back/Cancel button returns to list view.
- **D-06:** When **creating a new block**, the CodeMirror editor is pre-filled with `{}` (empty JSON object). Block name field starts empty.
- **D-07:** When **editing an existing block**, the editor is pre-filled with the block's current JSON content and the name field shows the existing name.
- **D-08:** The editor view has an **explicit Save button**. Save validates that the name is non-empty and that the JSON is a valid object (not array/primitive). Invalid JSON shows an error message inline (same pattern as `JsonEditor.tsx`). Cancel/Back discards unsaved changes — consistent with the `AmqpPropertiesSheet` local draft pattern.

### Delete Confirmation (BLK-04)
- **D-09:** Delete confirmation uses a **shadcn `AlertDialog`** (modal). The delete button in the block list triggers an AlertDialog with a title, short description, Cancel, and a destructive Delete button. Consistent with standard shadcn destructive action pattern.

### Persistence (BLK-05)
- **D-10:** Blocks are stored via **`tauri-plugin-store`** in a `blocks.json` file, following the exact same pattern as `useHistoryStore.ts`: `load(path)` → `store.set(key, blocks)` → `store.save()`. Load on app mount; save on every create/edit/delete.
- **D-11:** Block data shape: `Array<{ id: string, name: string, content: string }>` where `id` is `crypto.randomUUID()`, `name` is user-defined, `content` is the raw JSON string (not parsed — parse only at apply time in Phase 12).
- **D-12:** A new Zustand store `useBlockStore.ts` owns the block list, `blocksLoaded` boolean (hydration gate), and CRUD actions — mirrors `useHistoryStore` structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Message Blocks — BLK-01 through BLK-05 definitions and acceptance criteria

### Layout Integration (primary structural change point)
- `src/components/layout/AppLayout.tsx` — current layout structure; `<main>` becomes flex row with conditional panel column
- `src/components/form/FormPanel.tsx` — FormPanel header (toggle button goes here, right side beside Braces button); `FormPanel` wraps the block toggle state or receives `onToggle` prop

### Existing Code to Reuse
- `src/components/form/JsonEditor.tsx` — CodeMirror pattern to reuse for block editor (same `@uiw/react-codemirror` usage, same dark/light theme, same parse error pattern)
- `src/stores/useHistoryStore.ts` — tauri-plugin-store pattern; `useBlockStore.ts` follows this exactly
- `src/components/ui/badge.tsx` — available for block list item styling if needed
- `src/components/ui/alert-dialog.tsx` — AlertDialog for delete confirmation (BLK-04)
- `src/components/ui/scroll-area.tsx` — for scrollable block list

### Design System
- `src/components/ui/` — shadcn components available: Button, Input, ScrollArea, AlertDialog, Badge

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `JsonEditor.tsx` — CodeMirror + parse error banner pattern; block editor reuses the same structure (value, onChange, resolvedTheme, parseError props)
- `useHistoryStore.ts` — exact tauri-plugin-store pattern for `useBlockStore.ts`: `load()`, `store.set()`, `store.save()`, hydration guard, async CRUD actions
- `AmqpPropertiesSheet` local draft pattern — explicit Save/Cancel for editor view (D-08); don't auto-save on every keystroke
- `useTheme()` / `resolvedTheme` from `next-themes` — already threaded through `FormPanel`; pass to block editor for dark/light CodeMirror theme

### Established Patterns
- **ProtoFormRenderer switch is FROZEN** — not relevant to this phase (block library is a new panel)
- **`historyLoaded` hydration gate** — block store needs the same `blocksLoaded` boolean guard before any write
- **`crypto.randomUUID()`** for IDs — no uuid dep needed (used in history store)
- **Local draft state (not Zustand) for edit forms** — `AmqpPropertiesSheet` precedent: keep editor draft in local `useState` until Save is clicked; only then commit to the store

### Integration Points
- `AppLayout.tsx` — add conditional `<BlockLibraryPanel>` as the first child inside `<main>`, controlled by a state variable (open/closed). No other files need layout changes.
- `FormPanel.tsx` header — add a second icon button (e.g., `<Library>` or `<LayoutList>` from lucide-react) to the right side, alongside the existing Braces button
- `App.tsx` — add `useBlockStore().loadBlocks()` call on mount (same as `loadHistory()`)

</code_context>

<specifics>
## Specific Ideas

- Panel is a **left-side column** in `<main>`: `[BlockLibraryPanel w-64][FormPanel flex-1]`. Not an overlay, not a Sheet — a real column so form stays fully usable alongside it.
- Panel has **two views**, not a separate route or modal: list view (block names + Edit/Delete) and editor view (name field + CodeMirror). Back button in editor view returns to list.
- Block `content` stored as raw **JSON string** (not parsed object) — parsing only happens at apply time in Phase 12 (DnD merge).
- Save button in editor validates: non-empty name AND valid JSON object. Error shown inline, stay in editor.
- New block starts with `{}` — clean slate, not seeded from form.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-block-library-store-editor-persistence*
*Context gathered: 2026-05-19*
