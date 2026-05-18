---
status: partial
phase: 03-full-feature-set
source: [03-VERIFICATION.md]
started: 2026-05-18T00:00:00.000Z
updated: 2026-05-18T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Multi-file tab state isolation
expected: Open two different .proto files, switch between tabs — each tab maintains its own selected message type independently; switching tabs does not reset or bleed the other tab's selection

result: [pending]

### 2. AMQP properties at the broker
expected: Set delivery_mode=1 (non-persistent) and add a custom header (e.g. x-test=hello), publish a message, then verify in the RabbitMQ Management UI that the message arrived with those exact AMQP properties

result: [pending]

### 3. History auto-tab-switch timing
expected: After a successful publish, the right panel immediately switches from Hex Preview to the History tab, and the new entry appears at the top of the history table

result: [pending]

### 4. Replay pre-fill
expected: Click any history entry row — the form populates with the historical field values and switches to the correct proto file tab that was active when the message was originally sent

result: [pending]

### 5. Resend for Failed entries
expected: A Failed history entry (e.g. from a disconnected broker) has a Resend button; clicking it republishes the raw stored payload bytes without requiring the form to be valid; the new outcome is appended as a new history entry

result: [pending]

### 6. History persistence across restart
expected: Publish several messages, quit the app completely, reopen it — the history entries from the previous session are still present in the History tab (loaded from history.json)

result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
