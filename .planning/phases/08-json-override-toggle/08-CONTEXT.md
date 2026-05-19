# Phase 8: JSON Override Toggle - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a JSON Override Toggle in the form header — a mode switch that lets power users bulk-edit the current form state as raw JSON, then switch back to form mode with values applied. Phase is frontend-only (no Rust changes).

Scope:
1. **Toggle button** in the `FormPanel` header — switches between form mode (ProtoFormRenderer) and JSON edit mode (CodeMirror editor)
2. **JSON snapshot** — on enter JSON mode, pre-fill editor with `JSON.stringify(latestValues, null, 2)`
3. **JSON → form sync** — on exit JSON mode with valid JSON, apply via `resetRef.current(parsedValues)`
4. **Error UX** — on exit JSON mode with invalid JSON, show inline error banner with "Fix JSON" / "Discard changes" buttons
5. **Unknown fields warning** — sonner toast listing field names present in JSON but absent from proto schema
6. **Editor** — CodeMirror via `@uiw/react-codemirror` with `@codemirror/lang-json` extension + dark mode via `resolvedTheme`

Requirements covered: JSON-01, JSON-02, JSON-03, JSON-04, JSON-05, JSON-06.

</domain>

<decisions>
## Implementation Decisions

### Mode State Ownership
- **D-01:** `isJsonMode` lives as local `useState` in `FormPanel` — not in ProtoFormRenderer and not in Zustand. The toggle button renders in the existing `<div className="px-4 py-3 border-b border-border">` header alongside the message name.
- **D-02:** When `isJsonMode` is true, `FormPanel` unmounts `<ProtoFormRenderer>` entirely and renders `<JsonEditor>` inside `<ScrollArea>` in its place. No CSS-hidden approach — ProtoFormRenderer is simply not rendered.
- **D-03:** JSON snapshot for the editor is read from `latestValues` in Zustand (already kept in sync by `handleValuesChange` / `useWatch`). No additional ref pattern needed.
- **D-04:** Switching back to form mode calls `resetRef.current(parsedValues)` — the same `resetRef` pattern already used for message replay (HIST-02). ProtoFormRenderer must remain mounted (re-mounts) for `resetRef.current` to be valid before calling it.

### Fix JSON / Discard UX (JSON-04)
- **D-05:** When the user clicks the toggle button (JSON → form) and JSON is invalid, **do not switch modes**. Instead, an inline error banner appears below the CodeMirror editor showing the parse error message and two action buttons:
  - **"Fix JSON"** — dismiss the banner, stay in JSON mode, cursor returns to editor
  - **"Discard changes"** — switch to form mode, call `resetRef.current(latestValues)` using the Zustand snapshot (the form values captured when the user entered JSON mode, i.e., the values at the moment `isJsonMode` was set to `true`)
- **D-06:** "Discard" restores to the `latestValues` snapshot captured at JSON mode entry — not `buildDefaultValues`. User loses only the JSON edits, not pre-existing form state.

### Unknown Fields Warning (JSON-05)
- **D-07:** Unknown field names (keys in parsed JSON not matching any field in `message.fields`) produce a **sonner toast** (already wired in App.tsx). Format: `"2 unknown fields ignored: foo, bar"`. The form populates with the known fields anyway — warning is non-blocking.
- **D-08:** Unknown field detection runs after successful JSON parse and before calling `resetRef.current`. Unknown keys are stripped from the object passed to `reset()`.

### JSON Snapshot Format
- **D-09:** The JSON editor shows the **raw react-hook-form internal values** via `JSON.stringify(latestValues, null, 2)`. No transformation, no metadata, no comment headers. The RHF shape is the round-trip format:
  - oneof fields: `{ _selected: "branch_name", branch_name: { ... } }`
  - map fields: `[{ key: ..., value: ... }]` arrays
  - repeated fields: standard arrays

### Claude's Discretion
- Toggle button label/icon (e.g., `{ }` icon vs "JSON" text vs a toggle icon)
- Exact inline error banner layout and Tailwind classes
- Whether to debounce JSON parse validation on keystroke (or only on toggle-back click)
- JSON editor height within ScrollArea (fill available height recommended — CodeMirror handles its own scroll)
- Error banner position (below editor, above editor, or floating at bottom of the scroll area)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §JSON Override — JSON-01 through JSON-06 (authoritative acceptance criteria)
- `.planning/REQUIREMENTS.md` §Out of Scope — confirms: no persistent JSON mode, no canonical proto JSON conversion

### Existing Form Architecture (read before implementing)
- `src/components/form/FormPanel.tsx` — shell component; toggle button and `isJsonMode` state go here; `resetRef` and `latestValues` already wired
- `src/components/form/ProtoFormRenderer.tsx` — dispatch layer; no changes needed for this phase (FROZEN)

### UI and State Infrastructure
- `src/components/ui/sonner.tsx` — toast component; `toast()` import from "sonner" used for unknown fields warning
- `src/stores/useProtoStore.ts` — `latestValues` (current form values) lives here; read with `useProtoStore(s => s.latestValues)`

### Stack Constraints (from STATE.md)
- Editor library: `@uiw/react-codemirror ^4.25.9` + `@codemirror/lang-json ^6.0.x` — only new npm packages for this phase
- Dark mode: `next-themes resolvedTheme` prop (already used in Phase 5 for theme detection)
- JSON → form sync: `reset()` not `setValue()` — `setValue` bypasses `useFieldArray` internal refs (confirmed in STATE.md)
- `latestValues` in Zustand: kept current by `useWatch` → `handleValuesChange` → `setLatestValues` chain in FormPanel; no debounce on the write path (debounce is only for `encodeMessage` call)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FormPanel.tsx:resetRef` — `MutableRefObject<((values: Record<string, unknown>) => void) | null>` — already wired for replay; same mechanism for JSON→form sync
- `useProtoStore` `latestValues` — point-in-time snapshot of form state; read on toggle-to-JSON to pre-fill editor
- `src/components/ui/sonner.tsx` — Sonner toaster; `import { toast } from "sonner"` for unknown fields warning
- `src/components/ui/button.tsx` — "Fix JSON" / "Discard changes" buttons in inline error banner

### Established Patterns
- `resetRef` pattern (FormPanel ↔ ProtoFormRenderer) — `resetRef.current(values)` triggers `methods.reset(values)` inside ProtoFormRenderer; same pattern used for HIST-02 replay
- `latestValues` in Zustand — single source of truth for current form values; set via `onValuesChange` callback from ProtoFormRenderer
- `mode: onBlur` on `useForm` — field-level validation fires on blur; `reset()` bypasses validation and rebuilds state directly
- Local `useState` for transient UI state (e.g., popover open in BytesField, draft state in AmqpPropertiesSheet) — same pattern for `isJsonMode`

### Integration Points
- `FormPanel.tsx` — add `isJsonMode` state, toggle button in header, conditional render of `<ProtoFormRenderer>` vs `<JsonEditor>` inside `<ScrollArea>`
- `ProtoFormRenderer.tsx` — **no changes** (frozen dispatch layer)
- New file: `src/components/form/JsonEditor.tsx` (or similar) — CodeMirror editor with inline error banner, Fix/Discard buttons

</code_context>

<specifics>
## Specific Ideas

- "Discard" reverts to `latestValues` snapshot at JSON mode entry — not schema defaults, not an empty form
- Unknown fields stripped from parsed JSON before passing to `reset()` — not silently merged
- The inline error banner should show the actual JSON parse error message (e.g., "Unexpected token at position 42") alongside the two buttons
- `JSON.stringify(latestValues, null, 2)` — 2-space indented, human-readable format for editor pre-fill

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 8-JSON Override Toggle*
*Context gathered: 2026-05-19*
