---
phase: "14-live-subscribe-mode"
plan: "04"
subsystem: "response-ui"
tags: ["gap-closure", "subscribe-mode", "ux-fix", "react"]
dependency_graph:
  requires:
    - "14-01"
    - "14-02"
    - "14-03"
  provides:
    - "GAP-1: Start button retry from Error state"
    - "GAP-2: Tab-switch-on-send guard for Response panel"
    - "GAP-3: Error→Idle reset on profile change"
  affects:
    - "src/components/response/SubscribePanel.tsx"
    - "src/components/layout/RightPanel.tsx"
tech_stack:
  added: []
  patterns:
    - "prevProfileRef edge detection for profile change in useEffect"
    - "activeTab guard before setActiveTab in send useEffect"
key_files:
  created:
    - "src/components/layout/RightPanel.test.tsx"
  modified:
    - "src/components/response/SubscribePanel.tsx"
    - "src/components/response/SubscribePanel.test.tsx"
decisions:
  - "GAP-3 uses setSubscribeStatus('Idle') only — no stopSubscribe call because Error state has no active backend session"
  - "GAP-2 deps array includes activeTab — safe because prevLastSendAt guard prevents re-runs from tab changes alone"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-21"
  tasks: 2
  files_changed: 4
requirements:
  - "CONS-05"
  - "CONS-06"
  - "CONS-07"
---

# Phase 14 Plan 04: UAT Gap Closure Summary

**One-liner:** Three targeted bug fixes — Start-from-Error retry, tab-switch guard on send from Response panel, Error-to-Idle reset on profile change.

## Tasks Completed

| Task | Name | RED Commit | GREEN Commit | Files |
|------|------|-----------|-------------|-------|
| 1 | Fix SubscribePanel — GAP-1 and GAP-3 | d25f10c | 8e36a78 | SubscribePanel.tsx, SubscribePanel.test.tsx |
| 2 | Fix RightPanel tab-switch guard — GAP-2 | cf23e16 | 12c09c8 | RightPanel.tsx, RightPanel.test.tsx |

## What Was Built

### GAP-1: Start button enabled in Error state (SubscribePanel.tsx line 192)

Changed the Start button's `disabled` condition from:
```tsx
disabled={subscribeStatus !== "Idle" || !selectedQueue || isStartingRef.current}
```
to:
```tsx
disabled={(subscribeStatus !== "Idle" && subscribeStatus !== "Error") || !selectedQueue || isStartingRef.current}
```

Users can now retry the subscribe session after an error without reloading the app.

### GAP-3: Error→Idle reset on profile change (SubscribePanel.tsx line 132)

Added an `else if` branch in the auto-stop `useEffect`:
```tsx
} else if (subscribeStatus === "Error" && activeProfileName !== prevProfileRef.current) {
  setSubscribeStatus("Idle");
}
```

Profile switches while in Error state now clean up the dead session, returning the panel to Idle. `stopSubscribe` is intentionally NOT called — there is no active backend consumer in Error state.

### GAP-2: Tab-switch-on-send guard (RightPanel.tsx line 25-32)

Added `activeTab !== "response"` guard before `setActiveTab("history")` in the send auto-switch useEffect. Also added `activeTab` to the deps array (safe — `prevLastSendAt` edge guard prevents redundant re-runs from tab changes alone).

## Test Coverage

- **SubscribePanel.test.tsx**: 56 tests pass (50 existing + 6 new: 3 GAP-1 + 3 GAP-3)
- **RightPanel.test.tsx**: 2 tests pass (new file, both GAP-2 tests)
- **TypeScript**: `npx tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written. The stopSubscribe count concern (acceptance criterion 3) was met: the 5 grep hits include 2 in comment text; actual function calls remain at 2 (unchanged from before).

## TDD Gate Compliance

Both tasks followed RED → GREEN:
- Task 1: RED `d25f10c` (4 failing) → GREEN `8e36a78` (56 passing)
- Task 2: RED `cf23e16` (1 failing) → GREEN `12c09c8` (2 passing)

## Known Stubs

None.

## Threat Flags

None — changes are presentation-layer only. The Start-from-Error path reuses the same D-08 Rust-side guard (already returns `Err("Already running")` if session somehow active). No new network endpoints or auth paths introduced.

## Self-Check: PASSED

All created/modified files verified present. All 4 task commits verified in git log.
