---
status: approved
phase: 04-response-queue-reader
source: [04-VERIFICATION.md]
started: 2026-05-18T15:52:00Z
updated: 2026-05-18T15:52:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Decoded field rendering
expected: After clicking Read with a queue containing a valid protobuf message matching the loaded schema, the Response tab shows decoded key-value pairs for every field in the message
result: approved

### 2. Tab auto-switch after successful read
expected: The active tab in RightPanel changes from whatever tab is active to 'Response' immediately after a non-empty read returns
result: approved

### 3. Queue empty state
expected: Clicking Read against an empty queue shows 'Queue empty' text inline in the Response tab; no toast, no error overlay, no application crash
result: approved

### 4. Ack removes message from queue (D-10 deviation — RESP-04)
expected: After clicking Read on a queue with a message, the message count in the RabbitMQ Management UI decreases by 1. This should also happen if decode fails (schema mismatch), confirming ack-before-decode.
result: approved

### 5. Decode failure — raw hex + inline error
expected: When the payload cannot be decoded against the loaded schema, the Response tab shows the error message in destructive style and the raw hex string below it. Message is no longer in the queue.
result: approved

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
