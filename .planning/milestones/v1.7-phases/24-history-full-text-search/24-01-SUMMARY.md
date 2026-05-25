---
phase: 24-history-full-text-search
plan: "01"
subsystem: history-filter
tags: [tdd, pure-function, filter, search]
dependency_graph:
  requires: []
  provides: [collectFieldNames, filterHistoryEntries-searchQuery]
  affects: [MessageHistoryPanel, HistoryFilterBar]
tech_stack:
  added: []
  patterns: [chained-filter, recursive-traversal, optional-default-param]
key_files:
  created: []
  modified:
    - src/components/history/historyHelpers.ts
    - src/components/history/historyHelpers.test.ts
decisions:
  - "D-02: Backward-compat via default param (searchQuery='') — no existing callers changed"
  - "D-03: collectFieldNames excludes only _selected; numeric array index keys included by design"
  - "Null guard: value !== null before typeof check prevents Object.entries(null) crash"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 24 Plan 01: History Filter Core — collectFieldNames + searchQuery Extension Summary

**One-liner:** Recursive `collectFieldNames` helper and optional `searchQuery` 4th param on `filterHistoryEntries` with AND-chained case-insensitive field-key/type/target search.

## What Was Built

### `collectFieldNames` (new exported helper)

A pure recursive function in `historyHelpers.ts` that traverses a `Record<string, unknown>` and returns all non-`_selected` field name keys at every depth. Handles three structural cases:

- Plain nested objects: recursion via `collectFieldNames(value as Record<string, unknown>)`
- Arrays: iterates elements, recurses into each that is a plain object
- Primitives: pushes the key only, no recursion

The critical null guard (`value !== null && !Array.isArray(value) && typeof value === "object"`) prevents the JavaScript `typeof null === "object"` trap.

### `filterHistoryEntries` extension

The existing 3-arg function gained an optional 4th parameter `searchQuery = ""`. A third `.filter()` stage was chained after the existing type and target filters. The new stage:

1. Returns `true` immediately when `searchQuery` is empty (pass-all, backward compat)
2. Lowercases the query once (`q = searchQuery.toLowerCase()`)
3. Checks `messageTypeName`, `exchange`, and `routingKey` for substring match (OR within search stage)
4. Falls through to `collectFieldNames(e.fieldValues)` for field key matching

The search filter is AND-chained after the two existing filters (HIST-FT-05).

## TDD Gate Compliance

- **RED commit:** `7fa0a6b` — `test(24-01): add failing tests for collectFieldNames and searchQuery extension`
  - 14 new tests failing, 31 existing passing
- **GREEN commit:** `ab6cb57` — `feat(24-01): implement collectFieldNames and extend filterHistoryEntries with searchQuery`
  - All 45 tests passing (14 new + 31 existing)
- No REFACTOR step required — implementation was clean on first pass

## Verification

```
npm run test -- historyHelpers
Test Files  2 passed (2)
     Tests  45 passed (45)
```

Full suite: 936 passed, 1 pre-existing failure in `.claude/worktrees/agent-a83e858b07bc2e3aa/src/components/publish/__tests__/PublishBar.test.tsx` (unrelated to this plan — worktree path artifact from a different agent; verified to have been failing before these changes).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan is purely algorithmic — no UI stubs, no placeholder data.

## Threat Flags

No new security-relevant surface introduced. `collectFieldNames` traverses only in-memory data (field names as keys), performs no I/O, and has no network/filesystem access.

## Self-Check: PASSED

- [x] `src/components/history/historyHelpers.ts` exists and exports `collectFieldNames`, `filterHistoryEntries`, `findReplayTabIndex`
- [x] `src/components/history/historyHelpers.test.ts` exists with 45 tests (14 new)
- [x] Commit `7fa0a6b` exists (RED gate)
- [x] Commit `ab6cb57` exists (GREEN gate)
- [x] `collectFieldNames` exported
- [x] `filterHistoryEntries` has 4-parameter signature with `searchQuery = ""`
