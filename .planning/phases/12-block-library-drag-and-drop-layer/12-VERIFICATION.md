---
phase: 12-block-library-drag-and-drop-layer
verified: 2026-05-20T18:37:50Z
status: human_needed
score: 17/17
overrides_applied: 0
human_verification:
  - test: "Drag a block row from the Block Library panel onto the form ScrollArea"
    expected: "The form's ScrollArea shows a ring-2 ring-primary/50 outline while the block is held over it, and disappears when the block is dropped or leaves the area"
    why_human: "jsdom fireEvent.dragOver does not move the mouse cursor or trigger CSS :hover/:active states — the visual ring is verified in code but not observable in a headless environment"
  - test: "Drop a block whose keys all match top-level scalar/enum form fields (none of the fields have been edited)"
    expected: "All matching form fields are filled with values from the block; no toast appears; a second drop of a different block overwrites the first block's values (proving shouldDirty=false was respected)"
    why_human: "The native HTML5 drag payload and real ProtoFormRenderer mount in the Tauri window cannot be simulated end-to-end in jsdom — the integration path requires a running app"
  - test: "Drop a block while at least one matching field has already been edited by the user"
    expected: "The dirty field retains the user's value; all other non-dirty matching fields are filled from the block; no warning toast appears for the dirty field"
    why_human: "formState.dirtyFields semantics in a running app may differ from jsdom (input events, blur, RHF mode: 'onBlur') — human test confirms the field protection works in practice"
  - test: "Drop a block that contains keys with no matching form fields (e.g. keys not present in the current .proto message)"
    expected: "A toast.warning appears with the message: 'N field(s) from block not in form: fieldname1, fieldname2' using correct singular/plural copy; the form fields that DO match are still filled"
    why_human: "The sonner toast is mocked in tests; the human test confirms the actual toast UI surfaces in the production app with correct copy and styling"
---

# Phase 12: Block Library Drag-and-Drop Layer — Verification Report

**Phase Goal:** Add HTML5 drag-and-drop so users can drag a block from the block library panel onto the form area to apply it — filling non-dirty fields with block values and warning (BLK-08) when block keys don't match any form field.
**Verified:** 2026-05-20T18:37:50Z
**Status:** HUMAN_NEEDED — all automated checks pass; 4 human tests confirm the end-to-end drag UX in the live app
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ProtoFormRenderer accepts an applyBlockRef prop alongside resetRef | VERIFIED | `ProtoFormRenderer.tsx:36` — `applyBlockRef?: React.MutableRefObject<((blockValues: Record<string, unknown>) => string[]) \| null>` in `ProtoFormRendererProps` |
| 2 | applyBlockRef.current is populated with a callable function after mount | VERIFIED | `ProtoFormRenderer.tsx:146-173` — `useEffect` sets `applyBlockRef.current` to the merge function; test `applyBlockRef.current is set after ProtoFormRenderer mounts` passes (8/8 tests green) |
| 3 | Calling applyBlockRef.current fills top-level scalar/enum fields that are not dirty | VERIFIED | `ProtoFormRenderer.tsx:155-167` — eligible set filtered to non-repeated scalar/enum; `methods.setValue` called; test `fills a non-dirty scalar field and returns []` passes |
| 4 | Calling applyBlockRef.current skips fields marked dirty in formState.dirtyFields | VERIFIED | `ProtoFormRenderer.tsx:158` — `else if (methods.formState.dirtyFields[key])` branch silently skips; test `does not overwrite a dirty field and does not add it to skipped` passes |
| 5 | Calling applyBlockRef.current skips keys that have no matching top-level scalar/enum field | VERIFIED | `ProtoFormRenderer.tsx:150-154` — `eligibleFields` set excludes repeated, message, map, oneof, well_known; tests for unknown key, message-kind, repeated field all pass |
| 6 | applyBlockRef.current returns the array of skipped field names | VERIFIED | `ProtoFormRenderer.tsx:149,168` — `skipped: string[]` built and returned; test `returns skipped array for unknown key` passes |
| 7 | FormPanel's ScrollArea has onDragOver, onDragLeave, onDrop handlers | VERIFIED | `FormPanel.tsx:284-296` — `<ScrollArea onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>` |
| 8 | onDragOver calls e.preventDefault() so onDrop can fire | VERIFIED | `FormPanel.tsx:198-203` — `e.preventDefault()` inside `handleDragOver`; FormPanel test `dragOver on scroll area adds ring class` passes (proves preventDefault + state) |
| 9 | onDragLeave uses relatedTarget containment guard to prevent child-element flicker | VERIFIED | `FormPanel.tsx:205-209` — `!e.currentTarget.contains(e.relatedTarget as Node \| null)` guard; test `dragLeave on scroll area removes ring class` passes |
| 10 | onDrop reads blockId from dataTransfer, looks up block from store, calls applyBlockRef.current | VERIFIED | `FormPanel.tsx:211-236` — `getData('blockId')`, `useBlockStore.getState().blocks.find(...)`, `applyBlockRef.current(blockValues)`; drop tests pass |
| 11 | isDraggingOver local state drives ring-2 ring-primary/50 class on the ScrollArea | VERIFIED | `FormPanel.tsx:52,285` — `useState<boolean>(false)` + template literal `ring-2 ring-primary/50`; visual ring requires human verification in the running app |
| 12 | toast.warning fires with correct copy when skipped.length > 0 | VERIFIED | `FormPanel.tsx:232-236` — grammatically correct plural: `'${n} ${label} from block not in form: ${skipped.join(', ')}'`; both singular/plural toast tests pass |
| 13 | Drop zone is structurally absent in JSON editor mode (no explicit guard needed) | VERIFIED | `FormPanel.tsx:271-296` — `<ScrollArea>` with DnD handlers is inside the `else` branch of the `isJsonMode` ternary; no guard needed by construction |
| 14 | applyBlockRef is passed to ProtoFormRenderer | VERIFIED | `FormPanel.tsx:294` — `<ProtoFormRenderer ... applyBlockRef={applyBlockRef} />` |
| 15 | Block list rows in BlockLibraryPanel have draggable='true' | VERIFIED | `BlockLibraryPanel.tsx:195` — `draggable="true"` on block row `<div>`; test `block list row has draggable attribute` passes |
| 16 | Block list row onDragStart sets dataTransfer.setData('blockId', block.id) | VERIFIED | `BlockLibraryPanel.tsx:196-198` — `e.dataTransfer.setData('blockId', block.id)` in `onDragStart`; test `dragStart on block row calls dataTransfer.setData with blockId` passes |
| 17 | Block list rows show cursor-grab affordance | VERIFIED | `BlockLibraryPanel.tsx:199` — `cursor-grab active:cursor-grabbing` in className; test `block list row has cursor-grab class` passes |

**Score:** 17/17 truths verified

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/form/ProtoFormRenderer.tsx` | applyBlockRef prop + useEffect wiring with apply logic | VERIFIED | File exists; 277 lines; `applyBlockRef` appears 8 times; useEffect with `[applyBlockRef, methods, message]` dependency array at line 173 |
| `src/components/form/__tests__/ProtoFormRenderer.test.tsx` | TDD tests for applyBlockRef behavior | VERIFIED | File exists; `describe('applyBlockRef')` block at line 77; 6 applyBlockRef tests + 2 pre-existing = 8 total, all passing |
| `src/components/form/FormPanel.tsx` | DnD drop zone on ScrollArea + applyBlockRef declaration + onDrop handler + BLK-08 toast | VERIFIED | File exists; 300 lines; `applyBlockRef`, `isDraggingOver`, `handleDragOver`, `handleDragLeave`, `handleDrop` all present; `ring-2 ring-primary/50` at line 285; toast copy at line 235 |
| `src/components/form/__tests__/FormPanel.test.tsx` | Tests for drop zone events and BLK-08 warning toast | VERIFIED | File exists; `describe('Drop zone (DnD)')` at line 362; 5 tests; singular toast `'1 field from block not in form: ghost'` at line 403; plural at line 421 |
| `src/components/blocks/BlockLibraryPanel.tsx` | Drag source on block list rows: draggable, onDragStart, cursor-grab class | VERIFIED | File exists; `draggable="true"` at line 195; `setData('blockId', block.id)` at line 197; `cursor-grab active:cursor-grabbing` at line 199 |
| `src/components/blocks/BlockLibraryPanel.test.tsx` | Tests for drag source behavior | VERIFIED | File exists; `describe('Drag source')` at line 370; 4 tests covering draggable attr, cursor-grab class, setData call, second-block correctness; all 34 BlockLibraryPanel tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ProtoFormRendererProps` | `applyBlockRef` prop | `applyBlockRef?: React.MutableRefObject<...>` | WIRED | Line 36 in ProtoFormRenderer.tsx — type matches contract |
| `applyBlockRef.current` | `methods.setValue` | `forEach on eligible, non-dirty block keys` | WIRED | Lines 155-167 in ProtoFormRenderer.tsx — `methods.setValue(key, value)` inside the loop |
| `FormPanel onDrop` | `applyBlockRef.current` | `useRef` stored in `applyBlockRef`, populated by ProtoFormRenderer's `useEffect` | WIRED | `FormPanel.tsx:231` calls `applyBlockRef.current(blockValues)` after null-check at line 216 |
| `applyBlockRef.current result` | `toast.warning` | `skipped.length > 0` check in onDrop handler | WIRED | `FormPanel.tsx:232-235` — `'${n} ${label} from block not in form: ...'` |
| `isDraggingOver` | `ScrollArea className` | `conditional ring-2 ring-primary/50 class` | WIRED | `FormPanel.tsx:285` — template literal `\`flex-1 min-h-0${isDraggingOver ? ' ring-2 ring-primary/50' : ''}\`` |
| `block list row div` | `dataTransfer.setData('blockId', block.id)` | `onDragStart handler` | WIRED | `BlockLibraryPanel.tsx:196-198` — `onDragStart` calls `e.dataTransfer.setData('blockId', block.id)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FormPanel.tsx` onDrop handler | `blockValues` (from `block.content`) | `useBlockStore.getState().blocks.find(b => b.id === blockId)` — live Zustand store lookup | Yes — reads from in-memory store populated at block save time | FLOWING |
| `ProtoFormRenderer.tsx` applyBlockRef | `eligibleFields` Set | `message.fields.filter(...)` — live MessageSchema prop | Yes — message.fields is the parsed proto schema | FLOWING |
| `ProtoFormRenderer.tsx` applyBlockRef | `methods.formState.dirtyFields` | `react-hook-form` internal state | Yes — RHF tracks field mutations from user input events | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ProtoFormRenderer 8 tests pass | `npm test -- ProtoFormRenderer` | 8/8 passed | PASS |
| FormPanel 20 tests pass (incl. 5 DnD) | `npm test -- FormPanel` | 20/20 passed | PASS |
| BlockLibraryPanel 34 tests pass (incl. 4 drag source) | `npm test -- BlockLibraryPanel` | 34/34 passed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| BLK-06 | 12-02-PLAN.md, 12-03-PLAN.md | User can apply a block by dragging it from the block library panel and dropping it onto the form | SATISFIED | Drag source on BlockLibraryPanel rows (Plan 03); drop zone on FormPanel ScrollArea (Plan 02); applyBlockRef merge engine (Plan 01). Human test required for end-to-end flow verification. |
| BLK-07 | 12-01-PLAN.md | Block merge fills only empty (not-dirty) form fields — never overwrites a field the user has already edited | SATISFIED | `ProtoFormRenderer.tsx:158` — `formState.dirtyFields[key]` guard; test `does not overwrite a dirty field` passes; `shouldDirty: false` on setValue preserves re-droppability |
| BLK-08 | 12-02-PLAN.md | User sees a warning toast listing field names from the block that had no matching field in the current form | SATISFIED | `FormPanel.tsx:232-235` — `toast.warning(...)` with `'from block not in form'` copy; singular/plural tests pass. Human test required to verify toast UI in production sonner |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `FormPanel.tsx` | 224-228 | `toast.warning('Block content is not valid JSON — could not apply')` — plan specified `return; // silent no-op` for the JSON.parse catch; implementation chose a defensive toast instead | Info | No functional impact; the author justified this as a defensive improvement. Plan declared this "unreachable" (block.content validated at save time). Not tested. Acceptable deviation. |
| `FormPanel.tsx` | 199-202 | `handleDragOver` adds early-return guard `if (!e.dataTransfer.types.includes('blockid')) return;` BEFORE `e.preventDefault()` — plan did not specify this guard | Info | Beneficial enhancement: ScrollArea only acts as a drop target for drags carrying a blockId. HTML5 spec lowercases dataTransfer keys (`blockId` → `blockid`); FormPanel.test.tsx `createDataTransfer` was updated to lowercase keys to match. Consistent and correct. |

No blockers. No PLACEHOLDER, TODO/FIXME, or stub patterns found in the modified files.

---

### Human Verification Required

#### 1. Drag Ring Visual Feedback

**Test:** Open the app with a .proto file loaded. Open the Block Library panel. Create at least one block if none exist. Start dragging a block row. Move the pointer over the form ScrollArea without releasing.
**Expected:** The form ScrollArea develops a visible ring outline (ring-2 ring-primary/50 — a faint primary-color border) while the dragged block is held over it. The ring disappears when the pointer leaves the ScrollArea boundary (not when it passes over child form fields). The cursor changes to the grab cursor during drag.
**Why human:** jsdom `fireEvent.dragOver` does not render CSS transitions or the OS cursor. The ring class is wired to `isDraggingOver` state (verified in code and tests), but the visual appearance in Tauri requires a running renderer.

#### 2. Drop Applies Non-Dirty Fields

**Test:** Load a .proto message with at least two scalar string fields, e.g. `name` and `email`. Leave both fields empty. Create a block with content `{"name": "Alice", "email": "alice@example.com"}`. Drag and drop the block onto the form.
**Expected:** Both `name` and `email` fields are filled with the block values. No toast appears. Drag the same block again — both fields are overwritten again (proving block-filled fields do not become dirty). Now manually type a different value in `name`, then drag and drop again.
**Expected (second drop):** `email` is filled by the block; `name` retains the user's typed value. No warning toast for the dirty `name` field.
**Why human:** `formState.dirtyFields` detection depends on RHF's mode (`onBlur`), actual DOM input events, and the real ProtoFormRenderer mounting. jsdom covers the unit logic (6 passing tests); a real Tauri window verifies the end-to-end user flow.

#### 3. BLK-08 Warning Toast in Production Sonner

**Test:** Create a block with content `{"ghost_field": "test", "another_ghost": 42}` (fields that do not exist in the current proto message). Drag and drop the block onto the form.
**Expected:** A `toast.warning` appears in the Sonner toast region with the exact message: `2 fields from block not in form: ghost_field, another_ghost`. The toast is the warning variant (amber/yellow styling per sonner). No form fields are modified.
**Why human:** `toast.warning` is mocked in tests (the mock is asserted to have been called with correct copy). The human test confirms the actual Sonner toast renders, has the correct warning variant, and the copy is readable.

#### 4. Drop Zone Absent in JSON Mode

**Test:** Click the "Edit as JSON" button to enter JSON mode. Attempt to drag a block from the Block Library panel and hover over the editor area.
**Expected:** No ring outline appears on the JSON editor area. The drag does not trigger any form change. The JSON editor is unaffected.
**Why human:** The `<ScrollArea>` with DnD handlers is inside the `else` branch of the `isJsonMode` ternary (verified in code), but the actual layout in the running app should confirm the JSON editor has no drop target behavior.

---

### Implementation Notes

**Deviation from Plan 02 task 1:** `handleDragOver` in `FormPanel.tsx` (line 199-202) adds `if (!e.dataTransfer.types.includes('blockid')) return;` before `e.preventDefault()`. The plan did not specify this guard. The implementation is a correct enhancement — it restricts the drop zone to drags that carry a blockId payload. HTML5 spec lowercases `dataTransfer.setData` keys, so `'blockId'` becomes `'blockid'` in `types`; `FormPanel.test.tsx`'s `createDataTransfer` helper was updated to lowercase keys to match. This deviation is internally consistent and does not reduce BLK-06 functionality.

**Deviation from Plan 02 task 1 (JSON.parse catch):** `handleDrop` fires `toast.warning('Block content is not valid JSON — could not apply')` on JSON.parse failure instead of the plan's `return; // silent no-op`. The plan labeled this branch "unreachable (Save validated JSON at write time)." The implementation adds a defensive toast. No test covers this path; it is safe and does not affect any requirement.

**Test selector difference:** `FormPanel.test.tsx` uses `container.querySelector('[data-slot="scroll-area"]')` instead of the plan's suggested `[class*="min-h-0"]` selector. The summary explains this avoids false matches on the outer flex div. The selector targets the shadcn ScrollArea component's data attribute — more precise and correct.

---

### Gaps Summary

None. All 17 observable truths are VERIFIED in code. All 3 requirement IDs (BLK-06, BLK-07, BLK-08) are satisfied by the implementation. All 62 automated tests pass (8 ProtoFormRenderer + 20 FormPanel + 34 BlockLibraryPanel). The phase is blocked from `passed` status only because the drag-and-drop UX goal requires human confirmation in a live Tauri app — jsdom cannot exercise native HTML5 DnD rendering, cursor changes, or the Sonner toast production UI.

---

_Verified: 2026-05-20T18:37:50Z_
_Verifier: Claude (gsd-verifier)_
