---
phase: 08-json-override-toggle
plan: "02"
subsystem: frontend
status: complete
tags: [json-toggle, formPanel, tdd, codemirror, zustand, react, sonner]
dependency_graph:
  requires: [JsonEditor, buildDefaultValues-export]
  provides: [FormPanel-json-toggle, JSON-01, JSON-02, JSON-03, JSON-04, JSON-05]
  affects: [FormPanel]
tech_stack:
  added: []
  patterns: [tdd-red-green, pendingReplayValues-signal, snapshot-capture, unknown-field-detection]
key_files:
  created: []
  modified:
    - src/components/form/FormPanel.tsx
    - src/components/form/__tests__/FormPanel.test.tsx
decisions:
  - "Handler functions (handleToggle, handleFixJson, handleDiscard) placed AFTER message variable assignment (post-early-return guards) so they can reference message.fields without closure issues"
  - "setPendingReplayValues signal reused for JSON→form merge — never calls resetRef.current() directly (Pitfall 1: ref is null until ProtoFormRenderer remounts)"
  - "entrySnapshot captured from latestValues ?? {} at toggle entry moment — handleDiscard always restores this snapshot, never re-reads latestValues"
  - "useTheme from next-themes called at top of FormPanel — always executed before conditional returns (React hooks rule)"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-19T12:00:38Z"
  tasks_completed: 1
  files_changed: 2
---

# Phase 08 Plan 02: Extend FormPanel with JSON Toggle (TDD) Summary

**One-liner:** JSON Override Toggle in FormPanel — Braces button, entrySnapshot capture, CodeMirror mode, invalid JSON banner with Fix/Discard, unknown-field sonner toast, all via pendingReplayValues signal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing JSON Override Toggle tests | 0e06332 | src/components/form/__tests__/FormPanel.test.tsx |
| 1 (GREEN) | Implement JSON toggle in FormPanel | a437399 | src/components/form/FormPanel.tsx |

## What Was Built

**Task 1: JSON Override Toggle (TDD)**

**RED phase (commit 0e06332):** Extended `FormPanel.test.tsx` with 9 failing tests:
- Added mocks: `@uiw/react-codemirror` (textarea stub with `data-testid="codemirror-stub"`), `next-themes` (`useTheme` vi.fn()), `sonner` (toast.warning via vi.hoisted)
- Added `useTheme` import at file top; `vi.mocked(useTheme).mockReturnValue(...)` in beforeEach
- 9 test cases covering all behaviors: toggle visibility, JSON mode entry/exit, snapshot pre-fill, aria-label switching, valid/invalid JSON handling, Discard restore, unknown field toast, Fix JSON clears banner

**GREEN phase (commit a437399):** Updated `FormPanel.tsx`:
- New imports: `useState`, `JsonEditor`, `buildDefaultValues`, `toast`, `Braces`, `Button`, `useTheme`
- State variables: `isJsonMode`, `entrySnapshot`, `jsonDraft`, `parseError` (all local React state, not Zustand)
- `useTheme` hook call at top of component (before early-return guards — React hooks rule)
- `handleToggle`: FORM→JSON captures `latestValues ?? {}` as `entrySnapshot`, sets `jsonDraft`; JSON→FORM parses draft with try/catch, detects unknown top-level keys (singular/plural toast), strips unknowns, merges with `buildDefaultValues`, signals via `setPendingReplayValues(mergedValues)`
- `handleFixJson`: clears `parseError`, stays in JSON mode
- `handleDiscard`: calls `setPendingReplayValues(entrySnapshot)` (the snapshot at entry — not current `latestValues`), clears error, exits JSON mode
- Handler functions placed after `message` variable assignment so they can reference `message.fields`
- Header div updated: flex layout with Braces `Button` (ghost/icon-sm, aria-pressed, aria-label, bg-muted active state)
- Body: conditional render — `isJsonMode` shows `JsonEditor` in plain div; otherwise `ScrollArea` + `ProtoFormRenderer`

## TDD Gate Compliance

- RED gate: Commit `0e06332` — 9 new tests added, all failing (FormPanel lacks toggle button, JSON mode, etc.)
- GREEN gate: Commit `a437399` — implementation added, all 11 FormPanel tests pass (2 existing debounce + 9 new JSON toggle)

## Deviations from Plan

**1. [Rule 2 - Structural] Moved handler functions after message variable**
- **Found during:** GREEN phase — handlers reference `message.fields` (from `schema.message_map[selectedMessageType]`) which is declared after early-return guards
- **Issue:** Plan placed handlers before early returns; `message` is not in scope there
- **Fix:** Placed `handleToggle`, `handleFixJson`, `handleDiscard` after `const message = ...` assignment (post-guard section). These are regular functions, not hooks — safe to place anywhere in component body after hooks
- **Files modified:** src/components/form/FormPanel.tsx

**2. Worktree path safety correction**
- **Found during:** Initial test run — Read/Write tool calls defaulted to main repo path (`/Users/majesnix/gits/proto-sender/src/...`) instead of worktree path
- **Fix:** Identified discrepancy, rewrote worktree files at correct absolute paths, restored main repo files to their original state
- **Files modified:** Worktree files corrected; main repo files restored

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| FormPanel.test.tsx (worktree) | 11 | 11 | 0 |
| Full worktree suite | 180 | 179 | 1 (pre-existing MapField) |

Pre-existing failure: `MapField > formState.isValid is false while duplicates exist` — documented in Plan 01 summary as out-of-scope.

## Known Stubs

None — all toggle behavior is wired to real Zustand state and real React state. No placeholder values flow to the UI.

## Threat Flags

No new security surface beyond what was documented in the plan's threat register:
- T-08-02-01 (mitigate): JSON.parse wrapped in try/catch; unknown keys stripped before setPendingReplayValues — implemented
- T-08-02-02 (accept): parse error message shown in banner — local dev tool, no transmission
- T-08-02-03 (accept): no mitigation needed

## Checkpoint Status

**Stopped at:** Task 2 — `checkpoint:human-verify`

The full JSON Override Toggle feature is implemented and all automated tests pass. Human verification of the live application behavior is required before this plan is marked complete.

## Self-Check: PASSED

- [x] `src/components/form/FormPanel.tsx` (worktree) — FOUND, contains `isJsonMode`
- [x] `src/components/form/__tests__/FormPanel.test.tsx` (worktree) — FOUND, contains JSON Override Toggle describe block
- [x] Commit `0e06332` (RED test commit) — FOUND in git log
- [x] Commit `a437399` (GREEN implementation commit) — FOUND in git log
- [x] `isJsonMode` present in FormPanel.tsx — CONFIRMED
- [x] `setPendingReplayValues(mergedValues)` in handleToggle — CONFIRMED
- [x] `setPendingReplayValues(entrySnapshot)` in handleDiscard — CONFIRMED
- [x] `aria-pressed` on toggle button — CONFIRMED
- [x] `toast.warning` for unknown fields — CONFIRMED
- [x] All 11 FormPanel tests pass — CONFIRMED (pnpm vitest run with --root worktree)
- [x] No new regressions (1 pre-existing MapField failure unchanged) — CONFIRMED
- [x] TypeScript clean — CONFIRMED (pnpm run build: tsc exits 0)
