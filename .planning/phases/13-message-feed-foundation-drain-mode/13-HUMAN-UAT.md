---
status: partial
phase: 13-message-feed-foundation-drain-mode
source: [13-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real drain with ack-before-decode
expected: Messages are consumed even when decode fails; broker queue depth drops to confirm ack happened before decode attempt
result: [pending]

### 2. AMQP metadata accuracy (CONS-01)
expected: routing_key, exchange, content_type, timestamp, and decodedAs in accordion trigger match actual broker message headers
result: [pending]

### 3. Multi-type first-success decode (CONS-08)
expected: Publish TypeA and TypeB messages, each row shows the correct decodedAs label with no cross-decode contamination
result: [pending]

### 4. Queue depth badge refresh (CONS-04)
expected: Queue depth badge decrements after drain without a manual page reload
result: [pending]

### 5. Accordion expand/collapse per-row isolation
expected: Each row independently shows its own decoded view and hex; no cross-row contamination
result: [pending]

### 6. RightPanel auto-switch on drain
expected: Tab switches from Proto to Response automatically when drain completes
result: [pending]

### 7. FIFO-500 cumulative cap
expected: Drain >500 messages in multiple batches; feed holds exactly 500 (the most recent)
result: [pending]

### 8. Partial-error toast on mid-drain disconnect
expected: Kill broker mid-drain; toast.error appears and partial results are in the feed without a crash
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
