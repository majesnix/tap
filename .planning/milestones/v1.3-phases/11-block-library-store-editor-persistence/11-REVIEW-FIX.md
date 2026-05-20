---
phase: 11-block-library-store-editor-persistence
fixed_at: 2026-05-19T21:36:50Z
review_path: .planning/phases/11-block-library-store-editor-persistence/11-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-05-19T21:36:50Z
**Source review:** .planning/phases/11-block-library-store-editor-persistence/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### WR-02: Validate deserialized Block objects at load

**Files modified:** `src/stores/useBlockStore.ts`, `src/stores/useBlockStore.test.ts`
**Commit:** d0157fc
**Applied fix:** Added `isBlock(value: unknown): value is Block` type guard. Changed `store.get<Block[]>(BLOCKS_KEY)` to `store.get<unknown>(BLOCKS_KEY)` and filtered with `Array.isArray(saved) ? saved.filter(isBlock) : []`. Added test covering mixed valid/malformed input (5 malformed + 1 valid entry → only valid survives).

### CR-02 + WR-04: Functional set with rollback on persistence failure

**Files modified:** `src/stores/useBlockStore.ts`, `src/stores/useBlockStore.test.ts`
**Commit:** fed8a65
**Applied fix:** Combined CR-02 (rollback) and WR-04 (functional set) into a single atomic change. Each write operation (addBlock, updateBlock, deleteBlock) now captures `previous` and `updated` inside `set((state) => ...)` — ensuring the latest state is always seen at commit time. On `persistBlocks` failure, state is rolled back to `previous` and the error is rethrown for callers to handle. Added 3 rollback tests (one per write op) using `mockSave.mockRejectedValueOnce(...)`.

**Note:** CR-02 involves rollback logic (a logic-correctness concern, not just syntax). Status: fixed: requires human verification.

### CR-01: Disable Save button while store not loaded

**Files modified:** `src/components/blocks/BlockLibraryPanel.tsx`, `src/components/blocks/BlockLibraryPanel.test.tsx`
**Commit:** 5fe3827
**Applied fix:** Added `disabled={!blocksLoaded}` and conditional text `{blocksLoaded ? "Save block" : "Loading…"}` to the Save button in the editor view. The button keeps `aria-label="Save block"` so existing tests continue to find it by accessible name. Added test: editor view with `blocksLoaded: false` → button is disabled and shows "Loading…".

### WR-01: Surface persistence errors in BlockLibraryPanel

**Files modified:** `src/components/blocks/BlockLibraryPanel.tsx`, `src/components/blocks/BlockLibraryPanel.test.tsx`
**Commits:** 3600918, 167c584
**Applied fix:** Replaced `void addBlock(...)` and `void updateBlock(...)` with a `.then(() => setView("list")).catch((err) => setSaveError(...))` chain — the view only transitions to list after the operation resolves successfully. For `deleteBlock` in the list view AlertDialog, replaced `void deleteBlock(...)` with `.catch((err) => toast.error(...))` since `setSaveError` is editor-view state only (consistent with the FormPanel sonner pattern). Added `vi.mock("sonner", ...)` to the test file and updated the two "returns to list" tests to use `waitFor` for the async view transition.

A follow-up commit (167c584) introduced `saveErrorKind` state ("validation" | "json-parse" | "persistence") to fix a UX bug where routing persistence errors through `setSaveError` caused the banner header to display "Invalid JSON" for disk/permission errors. The banner now shows "Invalid JSON" as the header only for json-parse errors; validation and persistence errors show `saveError` directly as the header. The persistence-failure test asserts the header is NOT "Invalid JSON".

**Deviation from fix_scope:** The fix_scope suggested using `setSaveError(...)` for deleteBlock. This was not possible because `setSaveError` is editor-view state and deleteBlock fires from list view. Used `toast.error` instead, consistent with the FormPanel pattern already in the codebase. Documented here.

### WR-03: Move role=alert to error container div

**Files modified:** `src/components/blocks/BlockLibraryPanel.tsx`, `src/components/blocks/BlockLibraryPanel.test.tsx`
**Commit:** 76388ba
**Applied fix:** Moved `role="alert"` from the inner `<p>` (JSON-parse branch only) to the outer `<div>` container, which renders for all three error cases. Removed `role="alert"` from the inner `<p>`. Added assertions for `screen.getByRole("alert")` in the "Name is required" and "JSON must be an object" test cases.

### IN-01: Remove unused onClose prop from BlockLibraryPanel

**Files modified:** `src/components/blocks/BlockLibraryPanel.tsx`
**Commit:** a8e5879
**Applied fix:** Removed the `BlockLibraryPanelProps` interface and the `{ onClose: _onClose }` destructure. Changed function signature to `export function BlockLibraryPanel()`. `AppLayout.tsx` already passes no props — no update required there.

---

_Fixed: 2026-05-19T21:36:50Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
