---
phase: 03-full-feature-set
plan: "03"
subsystem: history
tags: [history, zustand, tauri-plugin-store, react, typescript]
dependency_graph:
  requires:
    - "03-01"  # useProtoStore signal fields (lastSendAt, pendingReplayValues)
    - "03-02"  # useAmqpStore, PublishBar baseline
  provides:
    - useHistoryStore with FIFO-capped appendEntry and historyLoaded race guard
    - RightPanel with Hex/History tabs and auto-switch behavior
    - HistoryTable with replay callback and HexViewDialog
    - Full send outcome recording in PublishBar
  affects:
    - src/components/layout/AppLayout.tsx (swapped HexPreviewPanel for RightPanel)
    - src/components/publish/PublishBar.tsx (added history recording + setLastSendAt signal)
tech_stack:
  added:
    - shadcn/ui table component (src/components/ui/table.tsx)
  patterns:
    - Zustand store backed by tauri-plugin-store (separate history.json)
    - FIFO cap with slice(0, MAX_ENTRIES)
    - historyLoaded boolean gate to prevent pre-hydration writes
    - Edge-detection refs (prevLastSendAt, prevPendingReplay) for useEffect signals
    - e.stopPropagation() to decouple row-click and icon-button actions
key_files:
  created:
    - src/stores/useHistoryStore.ts
    - src/stores/useHistoryStore.test.ts
    - src/components/history/HexViewDialog.tsx
    - src/components/history/HistoryTable.tsx
    - src/components/history/MessageHistoryPanel.tsx
    - src/components/layout/RightPanel.tsx
  modified:
    - src/components/layout/AppLayout.tsx
    - src/components/publish/PublishBar.tsx
    - src/components/ui/table.tsx (installed via shadcn)
decisions:
  - "load() called without options — StoreOptions.defaults required when passing options (same as prior plans)"
  - "activeTab is local state in RightPanel (not global store) — per Pitfall 6 in plan"
  - "lastSendAt only set on success — RightPanel auto-switch to History only fires on successful send"
  - "Edge-detection refs for both lastSendAt and pendingReplayValues — prevents spurious re-triggers"
metrics:
  duration_minutes: 7
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 7
  files_modified: 2
---

# Phase 03 Plan 03: Message History Summary

**One-liner:** Persistent message history store with FIFO-capped Zustand store, tabbed right panel with auto-switch behavior, hex payload viewer dialog, and full send outcome recording in PublishBar.

## Tasks Completed

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Create useHistoryStore + install shadcn table | 7d02068 (chore), 5fb9aa5 (test), d3ca824 (feat) | DONE |
| 2 | Build RightPanel, history components, update AppLayout and PublishBar | e63736b (feat) | DONE |

## Commits

- `7d02068` — chore(03-03): install shadcn table component
- `5fb9aa5` — test(03-03): add failing tests for useHistoryStore (RED)
- `d3ca824` — feat(03-03): implement useHistoryStore with FIFO cap and historyLoaded race guard
- `e63736b` — feat(03-03): build history UI components and wire AppLayout + PublishBar

## What Was Built

### useHistoryStore (src/stores/useHistoryStore.ts)

Zustand store backed by `tauri-plugin-store` at `history.json` (separate from `tap.json`).

Key behaviors:
- `appendEntry` prepends new entries (newest-first), caps at 100 via `slice(0, MAX_ENTRIES)` (D-02)
- `historyLoaded` boolean gate in `appendEntry`: early return if `false` — prevents race where `appendEntry` fires before `loadHistory()` resolves, which would silently lose the entry when `loadHistory()` eventually overwrites state (T-03-03-06 mitigate)
- `clearHistory` empties state and persists empty array to disk
- `loadHistory` reads from tauri-plugin-store and sets `historyLoaded=true`
- `load()` called without options — passing `{ autoSave: false }` requires `defaults` field in `StoreOptions`

### RightPanel (src/components/layout/RightPanel.tsx)

Tabs component (Hex / History) replacing the previous `HexPreviewPanel` in `AppLayout`.

Auto-switch behavior via edge-detection refs:
- `lastSendAt` effect: any non-null value that differs from `prevLastSendAt.current` → switch to "history"
- `pendingReplayValues` effect: null→non-null transition only → switch to "hex"; clearing back to null does NOT re-trigger

### HistoryTable (src/components/history/HistoryTable.tsx)

Table with columns: Time (HH:mm:ss), Type (last dotted segment), Target (exchange → key or just key), Status (Badge), Actions (Binary icon).

Critical interaction separation:
- Row `onClick` → calls `onReplay?(entry)` (pre-fill form, no dialog)
- Binary icon `onClick` with `e.stopPropagation()` → opens `HexViewDialog` (hex view, no form pre-fill)

Status badge:
- "Sent": `bg-emerald-500/10 text-emerald-500 border-emerald-500/20`
- "Failed": `variant="destructive"`

### HexViewDialog (src/components/history/HexViewDialog.tsx)

Dialog with all four required UI-SPEC elements:
- `DialogTitle`: "Binary Payload — {messageTypeName}"
- `DialogDescription`: "{HH:mm:ss} → {target}"
- `<pre>` hex block with `text-xs font-mono break-all whitespace-pre-wrap bg-muted rounded p-4 max-h-80 overflow-auto`
- `DialogFooter` with "Close" button (`variant="outline"`)

### PublishBar updates (src/components/publish/PublishBar.tsx)

In `handleSend`:
1. Captures `latestValues` and `selectedMessageType` synchronously via `useProtoStore.getState()` before the `await`
2. On success: `void appendEntry({ status: "sent", ... })` + `setLastSendAt(Date.now())`
3. On failure: `void appendEntry({ status: "failed", errorMessage: message, ... })`

`setLastSendAt` is only called on success — this ensures RightPanel only auto-switches to History tab on successful sends (failures also land in history but don't yank user focus).

## Verification

- `npx tsc --noEmit`: exit 0 (TypeScript clean)
- `npx vitest run`: 116 tests pass (14 test files, includes 8 new useHistoryStore tests)
- TDD gate: RED commit (5fb9aa5) before GREEN commit (d3ca824)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed StoreOptions.defaults TypeScript error**
- **Found during:** Task 2 TypeScript check
- **Issue:** `load(HISTORY_STORE_PATH, { autoSave: false })` fails with TS2345 — StoreOptions requires `defaults` field when passing options
- **Fix:** Changed to `load(HISTORY_STORE_PATH)` without options (same pattern as other stores per STATE.md decision)
- **Files modified:** `src/stores/useHistoryStore.ts`
- **Commit:** Included in `d3ca824`

## TDD Gate Compliance

- RED: `test(03-03)` commit `5fb9aa5` — 8 failing tests (module not found)
- GREEN: `feat(03-03)` commit `d3ca824` — 8 passing tests

## Known Stubs

None — all history UI is wired to real store data. Replay (onReplay callback) is plumbed as a prop to HistoryTable but MessageHistoryPanel does not yet pass an onReplay handler — this is intentional per plan scope. The next plan (03-04) will wire replay behavior from HistoryTable through to useProtoStore.setPendingReplayValues.

## Self-Check

- [x] src/stores/useHistoryStore.ts exists
- [x] src/stores/useHistoryStore.test.ts exists (8 tests pass)
- [x] src/components/history/HexViewDialog.tsx exists
- [x] src/components/history/HistoryTable.tsx exists
- [x] src/components/history/MessageHistoryPanel.tsx exists
- [x] src/components/layout/RightPanel.tsx exists
- [x] src/components/ui/table.tsx exists
- [x] AppLayout.tsx uses RightPanel (not HexPreviewPanel)
- [x] PublishBar.tsx has 2 appendEntry calls + 1 setLastSendAt call
- [x] All 4 commits exist in git log
- [x] 116 tests pass, TypeScript clean
