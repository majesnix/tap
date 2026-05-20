# Phase 12: Block Library — Drag-and-Drop Layer - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the drag-and-drop interaction layer to the existing block library. Users drag a block card from `BlockLibraryPanel` onto the form area; the drop merges the block's JSON values into top-level scalar/enum fields that the user has not yet edited (BLK-06, BLK-07). Block keys that have no matching fillable field trigger a warning toast listing the skipped names (BLK-08).

Phase 11 delivered the store, editor, and persistence foundation. Phase 12 delivers only the DnD interaction on top of that foundation — no new panels, no store changes.

**Requirements in scope:** BLK-06, BLK-07, BLK-08

</domain>

<decisions>
## Implementation Decisions

### DnD Mechanism (BLK-06)
- **D-01:** Use **native HTML5 drag-and-drop** — no `@dnd-kit` or other DnD library dependency. `draggable="true"` and `onDragStart` on block list cards; `onDragOver` + `onDrop` + `onDragLeave` on the form scroll area.
- **D-02:** **Block ID only** in the drag payload — `dataTransfer.setData('blockId', block.id)`. Drop handler looks up block content from `useBlockStore.getState().blocks` by ID. Content is always fresh from the store, never stale from a mid-drag serialization.

### Empty-Field Detection (BLK-07)
- **D-03:** A field is **empty (fillable)** when `formState.dirtyFields[fieldName]` is falsy — react-hook-form's built-in user-interaction tracker. A field with a default value that has never been touched is fillable; a field the user edited (even if they typed the default value back) is protected.
- **D-04:** Access `useForm()` internals via the **`applyBlockRef` pattern** — a sibling ref alongside the existing `resetRef`. `ProtoFormRenderer` wires `ref.current` in a `useEffect([applyBlockRef, methods])` to: `(blockValues: Record<string, unknown>): string[]` — applies block values to unfilled fields and returns the list of skipped field names. `FormPanel` holds the ref, calls it on drop, and passes the returned list to the warning toast.

### Field Matching Scope (BLK-08)
- **D-05:** **Top-level scalar and enum fields only.** A block key that matches a nested message field, map field, or repeated field is treated the same as a completely absent key — it is not applied to the form and is included in the BLK-08 warning.
- **D-06:** **BLK-08 warning toast** fires when any block key has no matching top-level scalar/enum field in the current schema. Uses `toast.warning()` (already imported via `sonner`). Wording: `"N field(s) from block not in form: [fieldA, fieldB, …]"`. A dirty (user-edited) field that blocks filling is NOT listed — that is intentional behavior, not a warning.

### Drop Zone UX
- **D-07:** **Drop target = FormPanel's scrollable form area** (the `<ScrollArea>` wrapping `ProtoFormRenderer`). Not the full FormPanel div — prevents accidental drops on the header, JSON editor toggle, or JSON editor itself. The JSON editor mode is explicitly excluded (block drag only applies in form mode).
- **D-08:** **Visual feedback** during drag: `isDraggingOver` local state on the drop-zone element. `onDragOver` sets it `true`; `onDragLeave` and `onDrop` clear it. Applied class: `ring-2 ring-primary/50` on the scroll area div. Subtle and informative — no overlay that obscures field labels.
- **D-09:** **Block card drag hint:** add `cursor-grab` to block list item rows. The native `draggable` attribute already provides browser cursor feedback; the explicit class makes discoverability clear.

### Claude's Discretion
- Whether to disable drag from the editor view (only list view exposes draggable cards — editor view shows no block items, so this is naturally handled).
- Error handling for `JSON.parse` failure on block content at apply time (should be unreachable since Save validated JSON, but a silent no-op on parse failure is fine).
- Test strategy for native HTML5 DnD: use `fireEvent.dragStart`, `fireEvent.dragOver`, `fireEvent.drop` with a minimal `DataTransfer` mock (jsdom does not implement DataTransfer natively — same pattern as `fireEvent.change` over `userEvent` in fake-timer tests).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Message Blocks — BLK-06, BLK-07, BLK-08 definitions and acceptance criteria

### Drag Source
- `src/components/blocks/BlockLibraryPanel.tsx` — block list view (list item rows become drag sources); `useBlockStore` already imported; `toast` already imported

### Drop Zone + Form Access
- `src/components/form/FormPanel.tsx` — holds `resetRef`; drop zone `onDrop`/`onDragOver`/`onDragLeave` handlers go here; `applyBlockRef` owned here
- `src/components/form/ProtoFormRenderer.tsx` — owns `useForm()` + `formState.dirtyFields`; `resetRef` wiring is the exact template for `applyBlockRef`; **ProtoFormRenderer switch is FROZEN — do not modify the dispatch table**

### Block Data
- `src/stores/useBlockStore.ts` — `Block` type + `useBlockStore()` / `getState().blocks` for ID lookup on drop

### Types
- `src/lib/types.ts` — `FieldSchema`, `MessageSchema` types; `field.kind.type` determines scalar/enum eligibility

### Phase 11 Prior Context (structural decisions that this phase builds on)
- `.planning/phases/11-block-library-store-editor-persistence/11-CONTEXT.md` — D-11 (block content as raw JSON string, parse at apply time), D-03 (toggle button placement), D-04 (panel open/closed as local state)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toast.warning()` from `sonner` — already imported in `BlockLibraryPanel.tsx`; use for BLK-08 warning
- `resetRef` pattern in `ProtoFormRenderer.tsx` + `FormPanel.tsx` — exact template for `applyBlockRef`: `React.MutableRefObject<((values: Record<string, unknown>) => string[]) | null>`
- `useBlockStore` — `getState().blocks.find(b => b.id === blockId)` for ID→content lookup on drop
- `formState.dirtyFields` — RHF built-in, available inside `methods` in `ProtoFormRenderer`
- `methods.getValues()` and `methods.setValue(path, value)` — RHF APIs for read and targeted write

### Established Patterns
- **ProtoFormRenderer switch is FROZEN** — `applyBlock` logic uses only RHF method calls (`getValues`, `dirtyFields`, `setValue`); it does not add a new field type or touch the dispatch table.
- **resetRef wiring pattern** — `useEffect([applyBlockRef, methods])` in `ProtoFormRenderer`; sets `ref.current = fn`; cleanup sets `ref.current = null` on unmount. `applyBlockRef` follows this exactly.
- **`setValue()` over `reset()` for partial updates** — `reset()` resets the entire form and clears dirty state; individual `setValue(path, value)` calls preserve dirty state on other fields (critical for BLK-07 correctness).
- **`fireEvent.change` over `userEvent.type` for tests with fake timers** — same applies to DnD: use `fireEvent.dragStart/dragOver/drop` with a mock DataTransfer object rather than trying to use `userEvent.pointer`.

### Integration Points
- `BlockLibraryPanel.tsx` list view: add `draggable="true"`, `onDragStart`, `cursor-grab` class to each block row `<div>`
- `FormPanel.tsx`: add `applyBlockRef` (same shape as `resetRef`); wire `onDrop`/`onDragOver`/`onDragLeave` to the `<ScrollArea>` or its inner div; call `applyBlockRef.current(parsedBlockValues)` on drop
- `ProtoFormRenderer.tsx`: add `applyBlockRef` prop alongside `resetRef`; wire in a new `useEffect`

</code_context>

<specifics>
## Specific Ideas

- `applyBlockRef.current` signature: `(blockValues: Record<string, unknown>): string[]` — takes parsed block JSON, returns array of skipped field names (for the warning toast). The function internally reads `methods.getValues()`, iterates block keys, checks `formState.dirtyFields[key]`, checks `schema.fields` for top-level scalar/enum match, calls `methods.setValue(key, value)` for fillable fields.
- `toast.warning(\`${n} field(s) from block not in form: ${skipped.join(', ')}\`)` — fires only when `skipped.length > 0`.
- `isDraggingOver` is local `useState<boolean>` on the FormPanel scroll area — not in Zustand store (session-only drag state).
- DnD should be **disabled in JSON editor mode** — if `FormPanel` is in JSON mode (showing `JsonEditor`), the `<ScrollArea>` wrapping `ProtoFormRenderer` is not rendered, so there is naturally no drop target. No explicit guard needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-block-library-drag-and-drop-layer*
*Context gathered: 2026-05-19*
