---
plan: 12-02
phase: 12-block-library-drag-and-drop-layer
status: complete
executor: orchestrator-inline
tasks_completed: 2
tasks_total: 2
key_files_created:
  - src/components/form/FormPanel.tsx
  - src/components/form/__tests__/FormPanel.test.tsx
commits:
  - feat(12-02): add applyBlockRef, isDraggingOver, and DnD handlers to FormPanel
  - test(12-02): add drop zone tests to FormPanel.test.tsx
---

## Summary

Plan 12-02 complete. FormPanel now has a fully wired HTML5 drag-and-drop drop zone on its ScrollArea, delivering the drop-zone half of BLK-06 and the BLK-08 warning toast.

## What Was Built

### Task 1: FormPanel drop zone (FormPanel.tsx)

- **`applyBlockRef`** declared as `useRef<((blockValues: Record<string, unknown>) => string[]) | null>(null)` — sibling to the existing `resetRef` pattern
- **`isDraggingOver`** declared as `useState<boolean>(false)` — drives `ring-2 ring-primary/50` visual feedback on the ScrollArea
- **`handleDragOver`** — calls `e.preventDefault()` (required for `onDrop` to fire) and sets `isDraggingOver(true)`
- **`handleDragLeave`** — uses `e.currentTarget.contains(e.relatedTarget as Node)` containment guard to prevent flickering when the pointer moves between child elements
- **`handleDrop`** — reads `blockId` from `dataTransfer`, looks up block from `useBlockStore.getState().blocks`, parses content, calls `applyBlockRef.current(blockValues)`, fires `toast.warning` with grammatically correct pluralization when `skipped.length > 0`
- **ScrollArea** receives `onDragOver`, `onDragLeave`, `onDrop` and conditional `ring-2 ring-primary/50` class
- **ProtoFormRenderer** receives `applyBlockRef={applyBlockRef}` — wired to the ref populated by plan 12-01's `useEffect`
- Drop zone is structurally absent in JSON editor mode (ScrollArea is inside the `else` branch of the `isJsonMode` ternary — no explicit guard needed)

Toast copy: `"N field from block not in form: ..."` / `"N fields from block not in form: ..."` — proper pluralization matching existing FormPanel.tsx convention (line ~157)

### Task 2: Drop zone tests (FormPanel.test.tsx)

Added `describe('Drop zone (DnD)')` block with 5 tests:
1. `dragOver` adds `ring-2` class (proves `preventDefault` called and state updated)
2. `dragLeave` with `relatedTarget: document.body` removes `ring-2` (containment guard works)
3. Drop fires `toast.warning` with correct singular copy: `'1 field from block not in form: ghost'`
4. Drop fires `toast.warning` with correct plural copy: `'2 fields from block not in form: ghost, phantom'`
5. Drop with unknown `blockId` is silent no-op

Implementation notes:
- `createDataTransfer` helper for jsdom (no native DataTransfer in jsdom v29)
- `vi.mock("@/stores/useBlockStore")` with `vi.mocked(useBlockStore.getState).mockReturnValue(...)` in DnD `beforeEach`
- `vi.useRealTimers()` in DnD `beforeEach` (fake timers deadlock `async act` flushing for effect-wired refs)
- Selector `[data-slot="scroll-area"]` from shadcn ScrollArea (avoids false match on outer `flex-1 flex-col min-h-0` div)

## Deviations

None. All acceptance criteria met as specified.

## Self-Check: PASSED

- [x] `FormPanel.tsx` contains `applyBlockRef`, `isDraggingOver`, `handleDragOver`, `handleDragLeave`, `handleDrop`
- [x] `FormPanel.tsx` contains `ring-2 ring-primary/50` in ScrollArea className expression
- [x] `FormPanel.tsx` contains `from block not in form` (no `(s)` suffix)
- [x] `FormPanel.tsx` contains `applyBlockRef={applyBlockRef}` on ProtoFormRenderer
- [x] `FormPanel.test.tsx` contains `Drop zone (DnD)` describe block
- [x] `FormPanel.test.tsx` contains `'1 field from block not in form: ghost'` (singular)
- [x] `FormPanel.test.tsx` contains `'2 fields from block not in form: ghost, phantom'` (plural)
- [x] All 20 FormPanel tests pass
- [x] `tsc --noEmit` exits 0
