---
status: diagnosed
phase: 14-live-subscribe-mode
source: [14-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

Human testing completed 2026-05-21.

## Tests

### 1. Real-time message delivery
expected: Publish to a live RabbitMQ queue while subscribed; messages appear in the feed within ~1 second without page refresh.
result: FAILED — when subscribe fails, status stays "Error" with no way to reset back to Idle. User cannot retry. Also: sending a message while on Response panel navigates away to "History" tab instead of staying on Response panel.

### 2. Status badge dot colors
expected: Idle shows grey dot, Running shows emerald-500 green, Stopping shows amber-500, Error shows destructive Badge variant — all survive the production build's Tailwind purge step.
result: PASSED

### 3. Profile-change auto-stop user flow
expected: Switch profiles while Running; consumer stops automatically and badge returns to Idle via the full Tauri IPC chain (prevProfileRef mechanism fires correctly).
result: PARTIAL — switching profiles while in Error state does not reset the error (auto-stop useEffect only guards Running/Stopping, not Error). Locked state persists across profile switches.

### 4. Mode toggle lock during active session
expected: While Running, clicking "Drain" in the ToggleGroup is disabled (Radix UI disabled prop prevents mode switch in the browser).
result: BLOCKED — could not test; subscribe is locked in Error state (dependent on gap 1 fix)

### 5. Cross-platform build
expected: Build and run on Windows and Linux; tauri::async_runtime::spawn prevents the Windows runtime panic (Tauri issue #10289).
result: SKIPPED

## Summary

total: 5
passed: 1
issues: 2
pending: 0
skipped: 1
blocked: 1

## Gaps

### GAP-1: Error state is unrecoverable — no reset path to Idle
status: failed
description: When subscribeStatus is "Error", the Start button is disabled (condition: subscribeStatus !== "Idle"), and there is no Reset/Retry button. The user is stuck and must reload the app to subscribe again. Fix: allow Start button when status is "Error" (change disabled condition), or add an explicit Reset button that calls setSubscribeStatus("Idle").
files: src/components/response/SubscribePanel.tsx

### GAP-2: Sending a message navigates away from Response panel to History
status: failed
description: When the user sends a message while on the Response panel (subscribe mode or drain mode), the app switches to "History" instead of remaining on the Response panel. This breaks the subscribe UX where the user expects to see arriving messages. Likely a pre-existing tab-switch on send behavior that needs to be guarded in subscribe/response mode.
files: src/components/response/MessageFeedTab.tsx, or the message-send handler that triggers the tab switch

### GAP-3: Profile switch while in Error state does not reset status
status: failed
description: The auto-stop useEffect guards on subscribeStatus === "Running" || "Stopping". When in Error state and user switches profiles, the error persists. The Error state should be cleared to Idle on profile change (since the session is already dead in Error state, a profile switch is a natural reset signal).
files: src/components/response/SubscribePanel.tsx
