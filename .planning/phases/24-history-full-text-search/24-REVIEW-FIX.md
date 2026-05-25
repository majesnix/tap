---
phase: 24-history-full-text-search
fixed_at: 2026-05-25T10:05:00Z
review_path: .planning/phases/24-history-full-text-search/24-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-05-25T10:05:00Z
**Source review:** .planning/phases/24-history-full-text-search/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Silent catch swallows history-persistence failure in `handleResend`

**Files modified:** `src/components/history/MessageHistoryPanel.tsx`
**Commit:** 95f581d
**Applied fix:** Changed bare `catch {}` to `catch (err: unknown)` and added `console.error("[history] appendEntry after resend failed:", err)` so persistence failures are logged for diagnostics without surfacing a misleading "Resend failed" toast to the user.

---

### WR-02: `filterHistoryEntries` searches field names only — field values are never matched

**Files modified:** `src/components/history/historyHelpers.ts`, `src/components/history/historyHelpers.test.ts`
**Commit:** 6e65435
**Applied fix:** Added `collectSearchTokens` function alongside the existing `collectFieldNames`. The new function collects both field name keys and primitive values (string/number/boolean) from the fieldValues tree, enabling genuine full-text search. Updated `filterHistoryEntries` to call `collectSearchTokens` instead of `collectFieldNames`. Extended the test suite with a `collectSearchTokens` describe block and four value-matching tests (WR-02 label) covering top-level values, numeric values, nested object values, and primitive array element values.

---

### WR-03: No debounce on the search input — filter runs on every keystroke

**Files modified:** `src/components/history/MessageHistoryPanel.tsx`
**Commit:** 868c9fd
**Applied fix:** Added `debouncedSearch` state and a `useEffect` with a 200ms `setTimeout` that updates `debouncedSearch` whenever `searchQuery` changes. Updated `filteredEntries` useMemo and `isFiltered` to depend on `debouncedSearch` instead of `searchQuery` directly, so `filterHistoryEntries` only re-runs 200ms after the user stops typing.

---

### IN-01: Search input has no accessible label

**Files modified:** `src/components/history/HistoryFilterBar.tsx`
**Commit:** 1d336db
**Applied fix:** Added `aria-label="Full-text search"` to the search `<Input>` element so screen readers announce a meaningful field name per WCAG 1.3.1.

---

### IN-02: `searchQuery` / `onSearchChange` are optional in `HistoryFilterBarProps` but always provided by the parent

**Files modified:** `src/components/history/HistoryFilterBar.tsx`
**Commit:** 70f6c9c
**Applied fix:** Removed `?` from both `searchQuery` and `onSearchChange` in the `HistoryFilterBarProps` interface and removed the default values from the destructuring assignment. Both props are now required, letting the type system catch any future caller that forgets to pass them.

---

_Fixed: 2026-05-25T10:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
