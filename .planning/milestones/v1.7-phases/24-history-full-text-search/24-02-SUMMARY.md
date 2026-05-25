---
phase: 24-history-full-text-search
plan: "02"
subsystem: history-filter
tags: [ui, react, state, search, filter]
dependency_graph:
  requires: [24-01]
  provides: [HistoryFilterBar-searchInput, MessageHistoryPanel-searchQuery]
  affects: [HistoryFilterBar, MessageHistoryPanel, HistoryTable]
tech_stack:
  added: []
  patterns: [controlled-component, useMemo-dependency, derived-boolean]
key_files:
  created: []
  modified:
    - src/components/history/HistoryFilterBar.tsx
    - src/components/history/MessageHistoryPanel.tsx
decisions:
  - "D-01: Search input row above type+target row — full-width, flex-col wrapper for single root"
  - "D-02: Optional props with safe defaults (searchQuery='', onSearchChange=()=>{}) for backward compat"
  - "D-04: isFiltered derived var extracted before return — used for both header count and HistoryTable prop"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 24 Plan 02: UI Wiring — Search Input + MessageHistoryPanel State Summary

**One-liner:** Search input row added to HistoryFilterBar above type+target row; searchQuery state wired through MessageHistoryPanel to filterHistoryEntries and header count label.

## What Was Built

### `HistoryFilterBar.tsx` — Search Input Row

Extended the props interface with optional `searchQuery?: string` and `onSearchChange?: (query: string) => void`. Both default to safe values (`searchQuery = ""`, `onSearchChange = () => {}`) so existing call sites compile without changes.

The JSX now renders two rows wrapped in a `<div className="flex flex-col">`:
1. **New search row** (first): `className="px-3 pt-2 pb-0 border-b border-border"` containing a full-width Input with `placeholder="Search…"` (unicode ellipsis), `className="h-7 text-xs w-full"` — per D-01 and D-02.
2. **Existing type+target row** (unchanged below): `className="flex items-center gap-2 px-3 py-2 border-b border-border"` with two `flex-1` inputs.

### `MessageHistoryPanel.tsx` — State Wiring

Five targeted changes to connect the search input to the filter algorithm from Plan 01:

1. **New state**: `const [searchQuery, setSearchQuery] = useState("")` added after targetFilter state line.
2. **useMemo updated**: `filterHistoryEntries(entries, typeFilter, targetFilter, searchQuery)` with `searchQuery` added to the dependency array `[entries, typeFilter, targetFilter, searchQuery]`.
3. **isFiltered derived**: `const isFiltered = !!(typeFilter || targetFilter || searchQuery)` computed before the return statement — accounts for all three filters per D-04.
4. **Header count conditional**: `{isFiltered ? \`${filteredEntries.length} of ${entries.length} / 100\` : \`${entries.length} / 100\`}` — shows filtered count when any filter is active.
5. **HistoryFilterBar and HistoryTable updated**: searchQuery+onSearchChange passed to HistoryFilterBar; HistoryTable receives `isFiltered={isFiltered}` (the derived boolean).

## Verification

```
npx tsc --noEmit
TypeScript: No errors found (exit 0)

npm run test
Test Files  1 failed | 67 passed (68)
     Tests  1 failed | 953 passed (954)
```

The 1 failing test (`PublishBar.test.tsx`) is the pre-existing worktree path artifact documented in 24-01-SUMMARY.md — unrelated to this plan's changes.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data flows are wired: searchQuery state → HistoryFilterBar input (controlled) → filterHistoryEntries 4th arg → filteredEntries → HistoryTable entries + isFiltered.

## Threat Flags

No new security-relevant surface introduced. Search input is a controlled React input; value used only for in-memory substring comparison in filterHistoryEntries — not persisted, not sent to backend, not rendered as HTML.

## Self-Check: PASSED

- [x] `src/components/history/HistoryFilterBar.tsx` modified — searchQuery/onSearchChange optional props, new search row above type+target row
- [x] `src/components/history/MessageHistoryPanel.tsx` modified — searchQuery state, updated useMemo, isFiltered derived var, header count, HistoryFilterBar + HistoryTable props updated
- [x] Commit `19b5218` exists (Task 1 — HistoryFilterBar)
- [x] Commit `7039fd3` exists (Task 2 — MessageHistoryPanel)
- [x] TypeScript compilation exits 0
- [x] Full test suite: 953 passed, 1 pre-existing failure unrelated to this plan
