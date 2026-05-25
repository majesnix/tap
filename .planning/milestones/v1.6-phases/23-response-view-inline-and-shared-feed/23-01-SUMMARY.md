---
phase: "23"
plan: "01"
subsystem: state
tags: [zustand, store, reply-tracking, pane-mode, feed]
dependency_graph:
  requires: [22-05]
  provides: [stepReplies, planReplyFeed, paneMode, setStepReply, appendReplyFeedEntry, setPaneMode]
  affects: [src/stores/usePlanExecutionStore.ts, src/hooks/usePlanRunner.ts]
tech_stack:
  added: []
  patterns: [FIFO-500-cap, immutable-record-spread, prepend-slice, pane-mode-reset-before-step]
key_files:
  created: []
  modified:
    - src/stores/usePlanExecutionStore.ts
    - src/hooks/usePlanRunner.ts
    - src/stores/usePlanExecutionStore.test.ts
    - src/hooks/usePlanRunner.test.ts
decisions:
  - "D-09: INITIAL_STATE extended with stepReplies:{}, planReplyFeed:[], paneMode:'editor'"
  - "D-11: appendReplyFeedEntry uses prepend+slice(0,500) FIFO-500 cap"
  - "D-13: setStepReply uses immutable record spread"
  - "D-04: setPaneMode('editor') called before each executeStep; setPaneMode('reply') inside reply block"
  - "D-12: appendReplyFeedEntry guarded by result.reply !== null — no-wait steps produce zero feed entries"
  - "Pitfall 3: setRunning resets stepReplies:{}, planReplyFeed:[], paneMode:'editor' inline"
metrics:
  duration_seconds: 553
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_changed: 4
---

# Phase 23 Plan 01: Store Reply Tracking and Runner Wire-Up Summary

## One-liner

Extended usePlanExecutionStore with stepReplies/planReplyFeed/paneMode state and wired usePlanRunner to dispatch reply actions after reply-bearing steps.

## What Was Built

### Task 1: Extend usePlanExecutionStore

Extended `src/stores/usePlanExecutionStore.ts` with three new state fields and three new actions:

**New state fields (added to PlanExecutionState interface and INITIAL_STATE):**
- `stepReplies: Record<string, ReplyMessage>` — decoded reply keyed by step ID (D-13)
- `planReplyFeed: FeedMessage[]` — shared FIFO-500 feed for all reply-bearing steps (D-11)
- `paneMode: 'editor' | 'reply'` — controls which pane the split view shows (D-04)

**New actions (added to PlanExecutionActions interface and store implementation):**
- `setStepReply(stepId, reply)` — immutable record spread; stores reply keyed by step ID
- `appendReplyFeedEntry(entry)` — prepends entry and slices to 500 (FIFO cap)
- `setPaneMode(mode)` — scalar set for pane switching

**INITIAL_STATE updated:** All three new fields with correct initial values. `clearRun()` picks them up automatically via `set({ ...INITIAL_STATE })`.

**setRunning updated:** Resets `stepReplies: {}`, `planReplyFeed: []`, `paneMode: 'editor'` inline alongside existing summary/isCancelling resets (Pitfall 3 prevention).

**Imports:** Added `ReplyMessage` and `FeedMessage` to the import from `../lib/types`.

### Task 2: Wire usePlanRunner

Extended `src/hooks/usePlanRunner.ts` with three new store action calls:

**Destructure:** Added `setStepReply`, `setPaneMode`, `appendReplyFeedEntry` to the destructure block from `usePlanExecutionStore()`.

**Before each `executeStep` call:** Added `setPaneMode('editor')` to reset the pane before each step starts (D-04 implementation).

**Inside the `result.status === 'done'` branch:** Added `if (result.reply !== null)` guard containing:
1. `setStepReply(step.id, result.reply)` — store the reply
2. `setPaneMode('reply')` — switch pane to show reply
3. `appendReplyFeedEntry({ id: crypto.randomUUID(), exchange: '', error: null, ...reply fields })` — push to shared feed

`succeeded++` is incremented after the reply dispatch block (not inside it).

**No-wait steps:** The `result.reply === null` guard ensures they contribute zero entries to `planReplyFeed` (D-10, D-12).

## Test Results

- `usePlanExecutionStore.test.ts`: 81 tests pass (37 new + 44 existing)
- `usePlanRunner.test.ts`: 43 tests pass (27 new + 16 existing)
- `npx tsc --noEmit`: exits 0, no type errors

## Commits

| Hash    | Type    | Description                                           |
|---------|---------|-------------------------------------------------------|
| b045a28 | test    | test(23-01): add failing tests for store reply tracking (RED) |
| 23ff3f8 | feat    | feat(23-01): extend usePlanExecutionStore with reply tracking (GREEN) |
| 3aebc93 | test    | test(23-01): add failing tests for runner reply dispatch (RED) |
| d691776 | feat    | feat(23-01): wire usePlanRunner to dispatch reply actions (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree Vitest alias resolution**
- **Found during:** Task 2 GREEN phase
- **Issue:** Vitest's `@/` alias in `vite.config.ts` resolves to the main project's `src/`, not the worktree's src. This caused the runner hook and its tests to use different store instances — the hook used the main project's old store (without new fields), while the test imported the worktree's updated store via relative path.
- **Fix:** Changed all imports in `usePlanRunner.ts` and `usePlanRunner.test.ts` from `@/...` to relative paths (`../...`). This ensures both files use the same worktree store instance during tests. Functionally equivalent when merged to main.
- **Files modified:** `src/hooks/usePlanRunner.ts`, `src/hooks/usePlanRunner.test.ts`
- **Commit:** d691776

**Note:** The plan listed "four new actions" but only defined three (`setStepReply`, `appendReplyFeedEntry`, `setPaneMode`). Implemented the three listed — the must_haves/truths confirm only three are required.

## Verification

All plan verification conditions pass:
1. `npx tsc --noEmit` exits 0 — confirmed
2. `grep "stepReplies: {}"` — 2 matches (INITIAL_STATE + setRunning) — confirmed
3. `grep "planReplyFeed: \[\]"` — 2 matches (INITIAL_STATE + setRunning) — confirmed
4. `grep "paneMode: 'editor'"` — 3 matches (interface, INITIAL_STATE, setRunning) — confirmed
5. `grep "slice(0, 500)"` — 1 match in appendReplyFeedEntry — confirmed
6. `grep "result.reply !== null"` — 1 match inside done branch — confirmed
7. `grep "setPaneMode"` — 2 action calls ('editor' before executeStep, 'reply' inside reply block) — confirmed

## Known Stubs

None. All new state fields are properly initialized and all new actions have full implementations.

## Threat Flags

No new security surface introduced. Changes are entirely within ephemeral in-memory Zustand state — no persistence, no network endpoints, no new trust boundaries. Matches threat model disposition `accept` for T-23-01 (in-memory ephemeral store).

## Self-Check: PASSED

- `src/stores/usePlanExecutionStore.ts` — exists, contains all required fields and actions
- `src/hooks/usePlanRunner.ts` — exists, contains all required dispatches
- Commit b045a28 — exists (test RED for store)
- Commit 23ff3f8 — exists (feat GREEN for store)
- Commit 3aebc93 — exists (test RED for runner)
- Commit d691776 — exists (feat GREEN for runner)
