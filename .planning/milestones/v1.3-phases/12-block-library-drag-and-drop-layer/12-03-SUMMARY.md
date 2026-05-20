---
phase: 12-block-library-drag-and-drop-layer
plan: "03"
subsystem: block-library
tags: [drag-and-drop, block-library, react, testing]
dependency_graph:
  requires: []
  provides: [drag-source-on-block-rows]
  affects: [BlockLibraryPanel]
tech_stack:
  added: []
  patterns: [native-html5-drag-and-drop, dataTransfer-setData, fireEvent-dragStart]
key_files:
  created: []
  modified:
    - src/components/blocks/BlockLibraryPanel.tsx
    - src/components/blocks/BlockLibraryPanel.test.tsx
decisions:
  - D-01: native HTML5 drag-and-drop used (no @dnd-kit or other library)
  - D-02: block ID only in dataTransfer payload (content looked up from store on drop)
  - D-09: cursor-grab active:cursor-grabbing class for discoverability
metrics:
  duration: "~10 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  files_modified: 2
---

# Phase 12 Plan 03: Drag Source on BlockLibraryPanel Block Rows Summary

**One-liner:** Native HTML5 drag source on block list rows with blockId payload and cursor-grab affordance, verified by 4 new jsdom DnD tests.

## What Was Built

Added the drag-source half of BLK-06 to `BlockLibraryPanel.tsx`. Each block list row in list view now has:
- `draggable="true"` attribute
- `onDragStart` handler that calls `e.dataTransfer.setData('blockId', block.id)`
- `cursor-grab active:cursor-grabbing` appended to the row's className

The editor view (`view === 'editor'`) is structurally unaffected — it renders a CodeMirror editor and form inputs, not block list rows.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add drag source to BlockLibraryPanel block list rows | 6cb7575 | src/components/blocks/BlockLibraryPanel.tsx |
| 2 | Add drag source tests to BlockLibraryPanel.test.tsx | 47b799a | src/components/blocks/BlockLibraryPanel.test.tsx |

## Test Results

- All 34 BlockLibraryPanel tests pass (30 pre-existing + 4 new drag source tests)
- `npx tsc --noEmit` exits 0 (no TypeScript errors)

### New Drag Source Tests

Four tests added in `describe('Drag source')`:
1. Block list row has `draggable` attribute set to "true"
2. Block list row has `cursor-grab` class
3. `dragStart` on a block row calls `dataTransfer.setData` with `('blockId', block.id)`
4. `dragStart` on second block sets correct blockId (not first block's id)

Helper added: `createDataTransfer(data = {})` — jsdom-compatible DataTransfer mock with `vi.fn()` on `setData` for assertion.

## Deviations from Plan

None — plan executed exactly as written. The implementation is a verbatim application of the three-attribute change specified in the plan's `<action>` block. Tests follow the `<action>` block verbatim.

## Known Stubs

None. All drag source attributes are wired to live data (`block.id` from the Zustand store). No placeholder values.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's `<threat_model>`. The `block.id` (UUID string) placed in the dataTransfer payload was already modeled as T-12-03-01 (disposition: accept — UUID from in-memory store, not executed or rendered as HTML, drop handler does bounds-checked lookup).

## Self-Check: PASSED

- [x] `src/components/blocks/BlockLibraryPanel.tsx` exists and contains `draggable="true"`, `setData('blockId', block.id)`, `cursor-grab active:cursor-grabbing`
- [x] `src/components/blocks/BlockLibraryPanel.test.tsx` exists and contains `describe('Drag source'` and `createDataTransfer`
- [x] Commit 6cb7575 exists (Task 1: feat)
- [x] Commit 47b799a exists (Task 2: test)
- [x] All 34 tests pass
