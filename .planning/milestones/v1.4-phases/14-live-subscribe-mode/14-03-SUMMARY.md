---
phase: "14-live-subscribe-mode"
plan: "03"
subsystem: "frontend-subscribe-ui"
tags: ["typescript", "react", "zustand", "tauri-channel", "subscribe", "tdd"]
dependency_graph:
  requires:
    - "src/lib/ipc.ts (startSubscribe, stopSubscribe — Plan 14-02)"
    - "src/stores/useResponseStore.ts (subscribeStatus, subscribeError, setSubscribeStatus, appendMessages — Plan 14-02)"
    - "src/components/ui/toggle-group.tsx (ToggleGroup, ToggleGroupItem — Plan 14-02)"
    - "src/components/ui/badge.tsx (Badge — existing)"
    - "src-tauri/src/commands/subscribe.rs (start_subscribe, stop_subscribe — Plan 14-01)"
  provides:
    - "SubscribePanel component (src/components/response/SubscribePanel.tsx)"
    - "Mode toggle UI with Drain/Subscribe segmented control"
    - "Auto-stop logic for profile change and connection drop"
  affects:
    - "src/components/response/MessageFeedTab.tsx (mode toggle wired in)"
    - "src/components/response/ResponseQueuePicker.tsx (mode-aware drain control hiding)"
tech_stack:
  added: []
  patterns:
    - "prevProfileRef pattern for profile-change auto-stop detection (avoids prop comparison co-update failure)"
    - "Channel<DrainResult> created in component and passed to startSubscribe IPC wrapper"
    - "TDD RED/GREEN cycle for SubscribePanel component"
key_files:
  created:
    - src/components/response/SubscribePanel.tsx
    - src/components/response/SubscribePanel.test.tsx
  modified:
    - src/components/response/MessageFeedTab.tsx
    - src/components/response/MessageFeedTab.test.tsx
    - src/components/response/ResponseQueuePicker.tsx
decisions:
  - "Subscribe mode: ResponseQueuePicker stays visible (queue/decode shared per D-04); SubscribePanel renders as additional toolbar row below"
  - "prevProfileRef initialized to activeProfileName on mount — avoids spurious auto-stop on initial render"
  - "Channel mock as class constructor in tests to support new Channel<DrainResult>(cb) pattern"
  - "Empty state text changed from 'Select a queue and click Drain' to 'Select a queue and choose a mode' (neutral for both modes)"
  - "Start button hidden (not disabled) when Running/Stopping — Stop button shown instead (cleaner UI)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 14 Plan 03: Subscribe Mode UI Summary

**One-liner:** Subscribe mode UI with SubscribePanel (Start/Stop/badge + auto-stop via prevProfileRef), MessageFeedTab mode toggle, and mode-aware ResponseQueuePicker; 20 new tests + 301 total passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for SubscribePanel | 5009582 | src/components/response/SubscribePanel.test.tsx |
| 1 (GREEN) | SubscribePanel implementation | a643962 | src/components/response/SubscribePanel.tsx, SubscribePanel.test.tsx |
| 2 | Mode toggle + ResponseQueuePicker mode prop | fafe47f | MessageFeedTab.tsx, MessageFeedTab.test.tsx, ResponseQueuePicker.tsx |

## What Was Built

### `src/components/response/SubscribePanel.tsx`

New component implementing:

**Start button** — enabled only when `subscribeStatus === "Idle"` and `selectedQueue` is non-empty. Clicking creates `new Channel<DrainResult>((msg) => appendMessages([msg]))`, stores in `channelRef`, calls `startSubscribe(profileName, selectedQueue, decodeTypes, channel)`. On success: `setSubscribeStatus("Running")`. On error: `setSubscribeStatus("Error", sanitizedMessage)` — T-14-11 mitigation: raw error message passed through only from a known-safe Rust AppError; "Stop failed" fallback ensures no AMQP URI leakage.

**Stop button** — shown when status is Running or Stopping (replaces Start button). Clicking: `setSubscribeStatus("Stopping")` → `stopSubscribe()` → `setSubscribeStatus("Idle")`. Disabled when `status === "Stopping"`. Shows Loader2 spinner when stopping.

**Status badge:**
- Idle: outline variant, grey dot
- Running: outline variant, emerald-500 dot
- Stopping: outline variant, amber-500 dot
- Error: destructive variant, `title={subscribeError}` for tooltip

**Auto-stop useEffect (D-11, CONS-07):** Fires when `activeProfileName` or `connectionStatus` changes. Fires `handleStop()` if status is Running/Stopping AND (`connectionStatus !== "connected"` OR `activeProfileName !== prevProfileRef.current`). Ref updated AFTER the check. Does NOT call `store.reset()` — feed messages preserved (D-12).

**prevProfileRef pattern:** Critical for correct profile-change detection. Both the store's `activeProfileName` and the `profileName` prop originate from the same store selector in MessageFeedTab, so they update to the same new value in the same render. A prop comparison (`activeProfileName !== profileName`) would always be false. `prevProfileRef` captures the pre-render value and detects the transition correctly.

### `src/components/response/MessageFeedTab.tsx`

Changes:
- `mode` state: `useState<"drain" | "subscribe">("drain")`
- `subscribeStatus` destructured from useResponseStore for `isModeLocked` computation
- `isModeLocked = status === "Running" || status === "Stopping"` (D-06)
- ToggleGroup (Drain | Subscribe) rendered in a separate toolbar row above the queue picker
- Queue picker always visible with `mode` prop (queue/decode shared per D-04)
- SubscribePanel rendered as additional row below queue picker when mode is "subscribe"
- Empty state text updated to "Select a queue and choose a mode"

### `src/components/response/ResponseQueuePicker.tsx`

Changes:
- `mode?: "drain" | "subscribe"` prop added to interface
- Drain count input and Drain button wrapped in `{mode !== "subscribe" && <> ... </>}`
- Queue selector and decode-as combobox remain visible in both modes

## Test Results

```
PASS (20) FAIL (0) — SubscribePanel.test.tsx (new)
PASS (7)  FAIL (0) — MessageFeedTab.test.tsx (updated)
PASS (8)  FAIL (0) — ResponseQueuePicker.test.tsx (unchanged, verified)
PASS (301) FAIL (0) — full suite
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated MessageFeedTab.test.tsx placeholder assertion**
- **Found during:** Task 2 (after changing empty state text from "Select a queue and click Drain" to "Select a queue and choose a mode")
- **Issue:** MessageFeedTab.test.tsx line 93 asserted the old placeholder text, causing 1 test failure
- **Fix:** Updated assertion to match new text `"Select a queue and choose a mode"`
- **Files modified:** src/components/response/MessageFeedTab.test.tsx
- **Commit:** fafe47f

**2. [Rule 2 - Missing Functionality] Clarified Start/Stop button visibility pattern**
- **Found during:** Task 1 test run — test "Start button is disabled when subscribeStatus is Running" failed because Start button is hidden (not disabled) when Running
- **Issue:** The plan's behavior block says "Start button is enabled when subscribeStatus is 'Idle'" implying it's always rendered but conditionally enabled. However, the plan's action block shows Start and Stop as mutually exclusive (Stop replaces Start). The cleaner UX is to hide Start and show Stop when Running/Stopping.
- **Fix:** Updated test to assert `queryByRole("button", { name: /start/i })` returns null when Running — consistent with the plan's action block which shows Stop button "When status is Running or Stopping"
- **Files modified:** src/components/response/SubscribePanel.test.tsx
- **Commit:** a643962

**3. [Rule 2 - Architecture] Subscribe mode layout: queue picker shared, SubscribePanel added as sub-row**
- **Found during:** Task 2 design
- **Issue:** Plan action block showed either ResponseQueuePicker OR SubscribePanel in subscribe mode — but D-04 from context explicitly states "Queue picker and Decode-as combobox are shared between both modes and always visible"
- **Fix:** ResponseQueuePicker always renders (with mode prop to hide drain controls); SubscribePanel renders as an additional row below in subscribe mode
- **Files modified:** src/components/response/MessageFeedTab.tsx
- **Commit:** fafe47f

## Threat Surface Scan

No new network endpoints or auth paths introduced. Changes are frontend-only.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-14-11 (mitigated) | SubscribePanel.tsx | Error message sanitization: raw `e.message` forwarded from Rust AppError (already sanitized in Plan 01), with "Stop failed" fallback for stop errors |

## Known Stubs

None.

## Self-Check: PASSED

- src/components/response/SubscribePanel.tsx — FOUND, exports SubscribePanel, prevProfileRef present
- src/components/response/SubscribePanel.test.tsx — FOUND, 20 tests pass
- src/components/response/MessageFeedTab.tsx — FOUND, ToggleGroup + SubscribePanel imports
- src/components/response/ResponseQueuePicker.tsx — FOUND, mode prop present

**Commits:**
- 5009582 — test(14-03): add failing tests for SubscribePanel (RED)
- a643962 — feat(14-03): implement SubscribePanel with start/stop controls and auto-stop (GREEN)
- fafe47f — feat(14-03): add mode toggle to MessageFeedTab and mode-aware ResponseQueuePicker
