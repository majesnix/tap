---
status: partial
phase: 14-live-subscribe-mode
source: [14-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-time message delivery
expected: Publish to a live RabbitMQ queue while subscribed; messages appear in the feed within ~1 second without page refresh.
result: [pending]

### 2. Status badge dot colors
expected: Idle shows grey dot, Running shows emerald-500 green, Stopping shows amber-500, Error shows destructive Badge variant — all survive the production build's Tailwind purge step.
result: [pending]

### 3. Profile-change auto-stop user flow
expected: Switch profiles while Running; consumer stops automatically and badge returns to Idle via the full Tauri IPC chain (prevProfileRef mechanism fires correctly).
result: [pending]

### 4. Mode toggle lock during active session
expected: While Running, clicking "Drain" in the ToggleGroup is disabled (Radix UI disabled prop prevents mode switch in the browser).
result: [pending]

### 5. Cross-platform build
expected: Build and run on Windows and Linux; tauri::async_runtime::spawn prevents the Windows runtime panic (Tauri issue #10289).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
