---
phase: 11-block-library-store-editor-persistence
plan: "02"
subsystem: block-library-panel
tags: [react, zustand, tdd, shadcn, alertdialog, codemirror]
dependency_graph:
  requires:
    - useBlockStore (from plan 11-01)
  provides:
    - BlockLibraryPanel (two-view panel component: list + editor)
  affects:
    - src/components/blocks/BlockLibraryPanel.tsx
    - src/components/blocks/BlockLibraryPanel.test.tsx
tech_stack:
  added: []
  patterns:
    - Two-view local state pattern (PanelView "list" | "editor")
    - Lazy mount hydration (mirrors MessageHistoryPanel useEffect guard)
    - vi.mocked() with unknown cast for Zustand store in tests (not ReturnType<typeof vi.fn>)
    - AlertDialog outside ScrollArea — rendered at panel root level
    - Triple JSON validation guard (nameDraft.trim + JSON.parse try/catch + Array.isArray/null check)
key_files:
  created:
    - src/components/blocks/BlockLibraryPanel.tsx
    - src/components/blocks/BlockLibraryPanel.test.tsx
  modified: []
decisions:
  - vi.mocked(useBlockStore) with unknown cast instead of ReturnType<typeof vi.fn> — Zustand UseBoundStore type not directly compatible with vi.fn Mock type
  - HTML entity &quot; instead of typographic &ldquo;/&rdquo; — test regex matches straight double-quotes
  - AlertDialog rendered outside ScrollArea and outside editor conditional — always in tree per JSX structure plan
metrics:
  duration: "~8 minutes"
  completed: "2026-05-19T21:00:34Z"
  tasks_completed: 2
  files_created: 2
---

# Phase 11 Plan 02: BlockLibraryPanel — TDD RED/GREEN Summary

**One-liner:** Two-view panel (list + editor) consuming useBlockStore with lazy mount hydration, triple JSON save validation, and AlertDialog delete confirmation — fully tested with 28 cases.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write all failing tests for BlockLibraryPanel | bd76908 | src/components/blocks/BlockLibraryPanel.test.tsx |
| 2 (GREEN) | Implement BlockLibraryPanel to pass all tests | ad14f95 | src/components/blocks/BlockLibraryPanel.tsx, BlockLibraryPanel.test.tsx (TypeScript fix) |

## TDD Gate Compliance

- RED commit (`test(11-02)`): bd76908 — confirmed "Failed to resolve import" (module-not-found)
- GREEN commit (`feat(11-02)`): ad14f95 — all 28 tests pass (0 failures)

## Verification Results

- `grep -c "w-64" BlockLibraryPanel.tsx` → 2 (list view + editor view wrappers, both w-64)
- `grep -c "No blocks yet" BlockLibraryPanel.tsx` → 1
- `grep -c "Name is required" BlockLibraryPanel.tsx` → 3 (error check + display + condition)
- `grep -c "JSON must be an object" BlockLibraryPanel.tsx` → 3
- `grep -c "AlertDialog" BlockLibraryPanel.tsx` → 22 (all AlertDialog sub-components)
- `grep 'variant="destructive"' BlockLibraryPanel.tsx` → `variant="destructive"` on AlertDialogAction
- `grep "loadBlocks" BlockLibraryPanel.tsx` → mount effect with blocksLoaded guard
- `npx vitest run BlockLibraryPanel.test.tsx` → PASS (28) FAIL (0)
- `npx tsc --noEmit` → No errors
- Full suite → PASS (453) FAIL (1) — 1 pre-existing failure in PublishBar.test.tsx (Phase 9, unrelated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AlertDialog title quote characters**
- **Found during:** Task 2 (GREEN) — test regex assertion failure
- **Issue:** Used HTML typographic quotes (`&ldquo;`/`&rdquo;`) in AlertDialogTitle but test regex `/Delete "Alpha Block"\?/` matches straight double-quote characters
- **Fix:** Changed to `&quot;` HTML entity which renders as a straight double-quote
- **Files modified:** src/components/blocks/BlockLibraryPanel.tsx
- **Commit:** ad14f95

**2. [Rule 1 - Bug] Fixed TypeScript cast for mocked Zustand store**
- **Found during:** Task 2 (GREEN) — `npx tsc --noEmit` error TS2352
- **Issue:** `(useBlockStore as ReturnType<typeof vi.fn>)` fails TypeScript — `UseBoundStore<StoreApi<BlockStore>>` and `Mock<Procedure|Constructable>` don't overlap
- **Fix:** Changed to `vi.mocked(useBlockStore).mockReturnValue(... as unknown as ReturnType<typeof useBlockStore>)` — matches FormPanel.test.tsx pattern using `vi.mocked()`
- **Files modified:** src/components/blocks/BlockLibraryPanel.test.tsx
- **Commit:** ad14f95

## Known Stubs

None — BlockLibraryPanel is fully implemented. All store actions (addBlock, updateBlock, deleteBlock, loadBlocks) are wired to real useBlockStore calls. No placeholder data, no hardcoded content.

## Threat Flags

No new threat surface introduced. All threat model items from plan:
- T-11-02-01: Triple guard implemented exactly as specified: `!nameDraft.trim()` + JSON.parse try/catch + `typeof !== "object" || null || Array.isArray`
- T-11-02-02/03: React JSX auto-escapes block.name — no dangerouslySetInnerHTML used
- T-11-02-04: No network path for CodeMirror content — local editor only

## Pre-existing Test Failure (Out of Scope)

One test in `src/components/publish/__tests__/PublishBar.test.tsx` (Phase 9 — routing key autocomplete) fails in both the main repo and with the worktree config. This failure is pre-existing and unrelated to Plan 02 changes. Logged to deferred-items.

## Self-Check: PASSED

- [x] `src/components/blocks/BlockLibraryPanel.tsx` — exists, exports `BlockLibraryPanel`
- [x] `src/components/blocks/BlockLibraryPanel.test.tsx` — exists, 28 test cases
- [x] RED commit bd76908 — in git log
- [x] GREEN commit ad14f95 — in git log
- [x] Triple validation guard with Array.isArray — verified
- [x] AlertDialog with variant="destructive" — verified
- [x] loadBlocks() in useEffect with blocksLoaded guard — verified
- [x] w-64 fixed width on both views — verified
- [x] TypeScript check passes — verified (0 errors)
- [x] 28 tests pass — verified
