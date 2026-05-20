---
status: partial
phase: 10-publisher-confirms-badge
source: [10-VERIFICATION.md]
started: 2026-05-19T21:00:00Z
updated: 2026-05-19T21:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ACK badge from real broker
expected: After a successful send to a queue with an active binding, a green ACK badge appears in PublishBar and auto-dismisses after 3 seconds. No toast notification appears.
result: [pending]

### 2. Returned badge (mandatory=true, no binding match)
expected: When sending to an exchange with no matching binding for the routing key, an amber "Returned" badge appears in PublishBar and auto-dismisses after 5 seconds. The message is not silently dropped.
result: [pending]

### 3. Timeout badge
expected: When the broker does not respond within 5 seconds (simulated by disconnecting/slow broker), a gray "Timeout" badge appears with a manual dismiss (×) button. The badge does NOT auto-dismiss. After dismissal, the badge is gone.
result: [pending]

### 4. Send-over-send badge replacement (D-09)
expected: When a new send is initiated while a badge is still visible, the prior badge is immediately cleared before the new send completes. No stale badge remains from the previous send.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
