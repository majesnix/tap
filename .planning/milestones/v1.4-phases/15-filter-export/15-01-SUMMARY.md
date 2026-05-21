---
phase: 15-filter-export
plan: "01"
subsystem: response-feed
tags: [filter, export, useMemo, tauri-capabilities]
dependency_graph:
  requires: [Phase 14 MessageFeedTab, tauri-plugin-dialog, tauri-plugin-fs]
  provides: [FILT-01, FILT-02, XPRT-01]
  affects: [MessageFeedTab.tsx, default.json]
tech_stack:
  added: []
  patterns: [useMemo-derived-filter, three-state-sentinel, dialog-save-pattern]
key_files:
  created: []
  modified:
    - src-tauri/capabilities/default.json
    - src/components/response/MessageFeedTab.tsx
    - src/components/response/MessageFeedTab.test.tsx
decisions:
  - "Use getAllByRole('listbox')[0] not [1] for content-type Select in tests — isLiveMode=false keeps ResponseQueuePicker in Input mode, making the content-type filter the only Select"
  - "Exported 1 messages (not 'Exported 1 message') — matches D-13 spec exactly; test asserts this exact string"
  - "handleExport placed after all derived state (contentTypeOptions, visibleMessages) so closure captures current values"
metrics:
  duration: "~18 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 15 Plan 01: Filter and Export Summary

## One-Liner

Client-side routing-key and content-type filtering with AND logic, plus JSON export of visible messages via native Tauri save dialog — all three requirements delivered as pure frontend changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add missing Tauri capability permissions | 4665fc4 | src-tauri/capabilities/default.json |
| 2 | Implement filter state, visibleMessages, export handler | 9c30918 | src/components/response/MessageFeedTab.tsx |
| 3 | Extend MessageFeedTab tests | 8fe2e95 | src/components/response/MessageFeedTab.test.tsx |

## What Was Built

### Task 1 — Capability Permissions

Added `"dialog:allow-save"` and `"fs:allow-write-text-file"` to `src-tauri/capabilities/default.json`. Both Tauri plugins were already initialized in `lib.rs` (lines 36-37) but the runtime capability gating would silently block `save()` and `writeTextFile()` without these entries.

### Task 2 — MessageFeedTab Implementation

- **Filter state**: `filterRoutingKey` (string) and `filterContentType` (string | null) — local only, not persisted (D-03)
- **contentTypeOptions**: derived via `useMemo` from distinct `msg.contentType` values in `messages[]`, sorted alphabetically with null last
- **visibleMessages**: `useMemo` with AND combination — routing key case-insensitive `includes()` plus three-state content-type sentinel (`null` = All, `"__none__"` = match null, string = exact match)
- **Count label**: updated to `"X of Y messages"` when any filter is active; falls back to existing `"N messages"` / `"1 message"` / `"No messages"` logic
- **handleExport**: generates `feed-export-{ISO-T--}.json` default path, calls `save()`, silently returns on null, calls `writeTextFile()` with D-12 envelope, fires `toast.success` on success, narrows error for `toast.error`
- **Filter row JSX**: always-visible row with Input + Select + Export button (variant="outline", size="sm")
- **Feed body**: added `visibleMessages.length === 0` branch showing "No messages match filter"; Accordion now maps `visibleMessages` instead of `messages`

### Task 3 — Tests

Extended `MessageFeedTab.test.tsx` with 14 new test cases covering all behaviors:
- FILT-01: routing key substring filter (case-insensitive)
- FILT-02: content-type select with `__none__` sentinel
- D-05: AND intersection logic
- UI-SPEC: "X of Y messages" count label, "No messages match filter" empty state
- XPRT-01: Export disabled states, cancel silence, success toast, JSON shape (D-10/D-11/D-12), defaultPath pattern (D-07), visible-only export (D-09)

All 21 tests pass (7 original + 14 new).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Select index in content-type filter tests**
- **Found during:** Task 3 implementation
- **Issue:** The plan specified `screen.getAllByRole("listbox")[1]` for the content-type filter Select, assuming the queue picker Select would be `[0]`. However, in the test environment `fetchQueues` is mocked to reject, which keeps `isLiveMode = false`, causing `ResponseQueuePicker` to render an `<Input>` (not a `<Select>`) for queue name. As a result, the content-type filter is the only `listbox` rendered — index `[0]`, not `[1]`.
- **Fix:** Used `getAllByRole("listbox")[0]` in all three content-type filter tests, with a comment explaining the reason.
- **Files modified:** src/components/response/MessageFeedTab.test.tsx
- **Commit:** 8fe2e95

## Known Stubs

None — all filter and export functionality is fully wired with real state.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`. The two capability permissions added (T-15-02, T-15-03) are exactly as planned:
- `dialog:allow-save`: gated behind OS native dialog — no silent write
- `fs:allow-write-text-file`: user must confirm path via dialog before write

## Self-Check: PASSED

- [x] `src-tauri/capabilities/default.json` contains `"dialog:allow-save"` and `"fs:allow-write-text-file"`
- [x] `src/components/response/MessageFeedTab.tsx` contains all filter state, derived state, export handler, filter row JSX, updated count label, "No messages match filter" empty state
- [x] `src/components/response/MessageFeedTab.test.tsx` contains 14 new tests in "Filter and Export" describe block
- [x] All 21 tests pass
- [x] TypeScript: no errors
- [x] Commits: 4665fc4, 9c30918, 8fe2e95 all exist
