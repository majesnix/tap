---
phase: 13-message-feed-foundation-drain-mode
plan: "03"
subsystem: response-ui
tags: [message-feed, drain, store-migration, accordion, decode-as-combobox]
dependency_graph:
  requires: ["13-01", "13-02"]
  provides: ["MessageFeedTab", "MessageFeedRow", "Decode-as-combobox", "useResponseStore-v2"]
  affects: ["src/stores/useResponseStore.ts", "src/components/response/", "src/components/layout/RightPanel.tsx"]
tech_stack:
  added: []
  patterns:
    - "Zustand store migration: lastResult → messages[] with FIFO-500 cap"
    - "TDD: RED/GREEN commit cadence per task"
    - "Popover+Command pattern for multi-select combobox (from RoutingKeyCombobox)"
    - "Accordion type=single collapsible for scrollable feed rows"
key_files:
  created:
    - src/components/response/MessageFeedTab.tsx
    - src/components/response/MessageFeedRow.tsx
    - src/components/response/MessageFeedTab.test.tsx
  modified:
    - src/stores/useResponseStore.ts
    - src/components/response/ResponseQueuePicker.tsx
    - src/components/response/ResponseQueuePicker.test.tsx
    - src/components/layout/RightPanel.tsx
  deleted:
    - src/components/response/ResponseTab.tsx
    - src/components/response/ResponseTab.test.tsx
decisions:
  - "Select mock changed to role=listbox in MessageFeedTab tests to avoid role conflict with Decode-as combobox (role=combobox)"
  - "isLoading removed from MessageFeedTab destructuring — ResponseQueuePicker reads it directly from store"
  - "beforeEach store seed updated per task: Task 1 uses old schema, Task 2 migrates to new schema"
  - "INITIAL_STATE typed with Pick<ResponseStore,...> instead of as const to avoid array literal type narrowing"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-20"
  tasks_completed: 3
  files_changed: 8
  files_deleted: 2
---

# Phase 13 Plan 03: Message Feed + Drain UI Summary

Migrated response store to FIFO-500 message feed, deleted legacy ResponseTab, and built the complete drain UI: MessageFeedRow accordion rows with per-message metadata, MessageFeedTab with handleDrain + clear + toasts, and Decode-as multi-select combobox in ResponseQueuePicker.

## Tasks Completed

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Rename onRead→onDrain + drain count input | aaf4263, 7a59e25 | DONE |
| 2 | Migrate useResponseStore, delete ResponseTab, stub MessageFeedTab | bb5024f | DONE |
| 3 | Full MessageFeedTab + MessageFeedRow + Decode-as combobox | 219fb54, 7621a34 | DONE |

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors)
- `npx vitest run src/components/response/`: PASS (24/24 tests, 4 test files)
- `grep -c "lastResult" src/stores/useResponseStore.ts`: 1 (comment only, 0 non-comment references)
- `grep -c "selectedDecodeTypes" src/stores/useResponseStore.ts`: 4 (>= 3)
- `grep -c "decodedAs" src/components/response/MessageFeedRow.tsx`: 1
- `grep -c "unknown" src/components/response/MessageFeedRow.tsx`: 1 ("[unknown]" fallback)
- `ls src/components/response/ResponseTab.tsx`: error — file deleted
- `grep -c "FEED_MAX_SIZE" src/stores/useResponseStore.ts`: 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Select mock role conflict with Decode-as combobox**
- **Found during:** Task 3 test design
- **Issue:** The existing Select mock used `role="combobox"` — same as the new Decode-as Popover trigger button. After Task 3, `screen.getByRole("combobox")` would throw "found multiple elements."
- **Fix:** Changed Select mock `role="combobox"` → `role="listbox"` in both test files. The `role="listbox"` is semantically correct for a native `<select>` element.
- **Files modified:** `src/components/response/ResponseQueuePicker.test.tsx`, `src/components/response/MessageFeedTab.test.tsx`
- **Commit:** 219fb54

**2. [Rule 2 - Missing critical] fetchQueueDepth mock missing in MessageFeedTab.test.tsx**
- **Found during:** Task 3 test design
- **Issue:** ResponseQueuePicker's queue-depth `useEffect` fires when `selectedQueue` is truthy (seeded to "test-queue"). Without a mock, it would make real IPC calls in tests.
- **Fix:** Added `fetchQueueDepth: vi.fn().mockResolvedValue(0)` to the `vi.mock("@/lib/ipc", ...)` block.
- **Files modified:** `src/components/response/MessageFeedTab.test.tsx`
- **Commit:** 219fb54

**3. [Rule 1 - Bug] beforeEach store seed updated in two phases**
- **Found during:** Task 2 tsc gate
- **Issue:** The plan scheduled `beforeEach` seed updates only in Task 3, but Task 2 removes `lastResult` from the store type — causing a TypeScript error in the existing test seed before Task 3 ran.
- **Fix:** Task 1 reverted to old schema seed; Task 2 commit updated to new schema (messages[], selectedDecodeTypes[]) in the same refactor commit. No separate tsc-failing intermediate state.
- **Files modified:** `src/components/response/ResponseQueuePicker.test.tsx`
- **Commits:** bb5024f

**4. [Rule 1 - Bug] isLoading unused variable in MessageFeedTab**
- **Found during:** Task 3 tsc verification
- **Issue:** `isLoading` was destructured from `useResponseStore()` in MessageFeedTab but never used (ResponseQueuePicker reads it directly from the store).
- **Fix:** Removed `isLoading` from destructuring.
- **Files modified:** `src/components/response/MessageFeedTab.tsx`
- **Commit:** 7621a34

## Known Stubs

None — MessageFeedTab is fully wired: drainMessages IPC call, appendMessages to store, setLastReadAt for queue depth refresh, clearMessages, all toasts.

## Threat Flags

No new security-relevant surface introduced. All data flows documented in plan's threat model:
- Drain count frontend clamp [1,500] on blur (T-13-03-01)
- selectedDecodeTypes from proto type names only (T-13-03-02)
- AMQP message content displayed as text (T-13-03-03)
- FEED_MAX_SIZE = 500 enforced (T-13-03-04)

## Self-Check: PASSED

Files verified:
- `src/components/response/MessageFeedTab.tsx`: FOUND
- `src/components/response/MessageFeedRow.tsx`: FOUND
- `src/components/response/MessageFeedTab.test.tsx`: FOUND
- `src/stores/useResponseStore.ts`: FOUND (contains messages[], selectedDecodeTypes[], appendMessages, FEED_MAX_SIZE)
- `src/components/response/ResponseTab.tsx`: MISSING (confirmed deleted)

Commits verified:
- aaf4263: FOUND (test: rename onRead→onDrain)
- 7a59e25: FOUND (feat: rename onRead→onDrain implementation)
- bb5024f: FOUND (refactor: store migration + ResponseTab deletion)
- 219fb54: FOUND (test: MessageFeedTab tests + combobox test)
- 7621a34: FOUND (feat: MessageFeedRow + full MessageFeedTab + combobox)
