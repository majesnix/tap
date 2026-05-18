---
phase: 03-full-feature-set
plan: "04"
subsystem: history-filter-replay
tags: [history, filter, replay, resend, tdd, pure-functions]
dependency_graph:
  requires: [03-03]
  provides: [HIST-02, HIST-04]
  affects: [MessageHistoryPanel, HistoryTable, FormPanel, ProtoFormRenderer]
tech_stack:
  added: []
  patterns: [pure-functions, tdd, useMemo-filter, ref-based-reset]
key_files:
  created:
    - src/components/history/HistoryFilterBar.tsx
    - src/components/history/historyHelpers.ts
    - src/components/history/historyHelpers.test.ts
  modified:
    - src/components/history/HistoryTable.tsx
    - src/components/history/MessageHistoryPanel.tsx
decisions:
  - filterHistoryEntries and findReplayTabIndex extracted as pure functions for testability (not inline in component)
  - Resend shown for ALL entries regardless of status (D-03 guarantees payloadBytes always captured)
  - Task 2 (FormPanel pendingReplayValues consumer) was fully pre-implemented in Plan 03-01; no code changes needed
  - Task 3 TDD executed before Task 1 so historyHelpers.ts existed before MessageHistoryPanel imported it
metrics:
  duration: "8 minutes"
  completed: "2026-05-18T07:06:42Z"
  tasks_completed: 3
  files_changed: 5
---

# Phase 03 Plan 04: History Filter + Replay/Resend Summary

History filtering (HIST-04) and form replay/resend (HIST-02) implemented with TDD pure functions, completing all v1 history requirements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 3 RED | TDD — failing tests for historyHelpers | c3d0d8d | historyHelpers.test.ts |
| 3 GREEN | TDD — implement historyHelpers | a651885 | historyHelpers.ts |
| 1+REFACTOR | HistoryFilterBar, Resend, MessageHistoryPanel | 5141d6a | HistoryFilterBar.tsx, HistoryTable.tsx, MessageHistoryPanel.tsx |
| 2 | FormPanel pendingReplayValues consumer | (no-op) | pre-existing from Plan 03-01 |

## What Was Built

**HistoryFilterBar** (`src/components/history/HistoryFilterBar.tsx`): Controlled filter component with two Input fields — "Filter by type…" (message type name substring) and "Filter by queue/exchange…" (exchange or routingKey substring). Stateless — emits to parent.

**historyHelpers.ts** (`src/components/history/historyHelpers.ts`): Two pure exported functions:
- `filterHistoryEntries(entries, typeFilter, targetFilter)`: case-insensitive AND-logic filter
- `findReplayTabIndex(openFiles, messageTypeName)`: returns first openFiles index whose schema contains the type, or -1

**historyHelpers.test.ts** (`src/components/history/historyHelpers.test.ts`): 14 Vitest test cases covering all behaviors: empty filters, type filter (case-insensitive), target filter (exchange/routingKey), AND logic, empty input, multiple file scenarios.

**HistoryTable updates**: Added `onResend` prop and RotateCcw button in actions column. Added `isFiltered` prop for empty-state copy differentiation ("No entries match the current filter." vs "No messages sent yet."). Resend button visible for ALL entries (no status gate per D-03).

**MessageHistoryPanel updates**: Added `typeFilter`/`targetFilter` local state, `useMemo` filtered entries, HistoryFilterBar above ScrollArea, `handleReplay` (row-click pre-fill via setPendingReplayValues), `handleResend` (direct byte republish via publishMessage + history append).

**FormPanel/ProtoFormRenderer** (Task 2): Already fully implemented in Plan 03-01 — `resetRef` wired from ProtoFormRenderer to FormPanel, `useEffect` consuming `pendingReplayValues` and calling `resetRef.current()` then clearing the signal.

## Deviations from Plan

### Execution Order Reordering (Rule 3)

Task 3 (TDD) executed before Task 1 because Task 1's acceptance criteria required MessageHistoryPanel to import from `./historyHelpers` — but historyHelpers.ts didn't exist yet. Running Task 3 RED→GREEN first ensured the helpers module existed before Task 1 imported it.

Documented as: `[Rule 3 - Blocking] Task 3 executed before Task 1 to satisfy import dependency`

### Task 2 Pre-existing Implementation

FormPanel's `pendingReplayValues` useEffect consumer and ProtoFormRenderer's `resetRef` wiring were fully implemented in Plan 03-01 as forward-planning stubs. All Task 2 acceptance criteria passed without code changes. No commit generated (nothing to commit).

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | c3d0d8d `test(03-04)` | PASS |
| GREEN (feat) | a651885 `feat(03-04)` | PASS |
| REFACTOR | 5141d6a `feat(03-04)` Task 1 absorbed | PASS |

## Known Stubs

None. All history features fully wired.

## Threat Flags

None beyond the plan's threat model. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/components/history/HistoryFilterBar.tsx` exists
- [x] `src/components/history/historyHelpers.ts` exists
- [x] `src/components/history/historyHelpers.test.ts` exists
- [x] Commits c3d0d8d, a651885, 5141d6a exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] 130/130 vitest tests pass
