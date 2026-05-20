---
status: complete
phase: 13-message-feed-foundation-drain-mode
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Real drain with ack-before-decode
expected: Messages are consumed even when decode fails; broker queue depth drops to confirm ack happened before decode attempt
result: pass

### 2. AMQP metadata accuracy (CONS-01)
expected: routing_key, exchange, content_type, timestamp, and decodedAs in accordion trigger match actual broker message headers
result: pass

### 3. Multi-type first-success decode (CONS-08)
expected: Publish TypeA and TypeB messages, each row shows the correct decodedAs label with no cross-decode contamination
result: pass

### 4. Queue depth badge refresh (CONS-04)
expected: Queue depth badge decrements after drain without a manual page reload
result: pass

### 5. Accordion expand/collapse per-row isolation
expected: Each row independently shows its own decoded view and hex; no cross-row contamination
result: pass

### 6. RightPanel auto-switch on drain
expected: Tab switches from Proto to Response automatically when drain completes
result: issue
reported: "there is no Drain button on Hex or History tab"
severity: minor

### 7. FIFO-500 cumulative cap
expected: Drain >500 messages in multiple batches; feed holds exactly 500 (the most recent)
result: pass

### 8. Partial-error toast on mid-drain disconnect
expected: Kill broker mid-drain; toast.error appears and partial results are in the feed without a crash
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Tab switches to Response tab automatically when drain completes from any right-panel tab"
  status: failed
  reason: "User reported: there is no Drain button on Hex or History tab"
  severity: minor
  test: 6
  root_cause: "Drain button lives inside MessageFeedTab (Response tab content), so the user is always already on the Response tab when drain runs. The auto-switch useEffect in RightPanel.tsx line 44 fires but is a no-op. The scenario the test assumed — triggering drain while on a different tab — is unreachable with the current toolbar placement."
  artifacts:
    - path: "src/components/layout/RightPanel.tsx"
      issue: "Auto-switch useEffect (line 40-46) is dead code — lastReadAt only changes when drain runs, which requires being on Response tab to access the Drain button"
    - path: "src/components/response/MessageFeedTab.tsx"
      issue: "Drain button is inside Response tab content, not above the tab strip"
  missing:
    - "Move ResponseQueuePicker toolbar (queue picker + drain count + Drain button) above the Hex/History/Response tab strip in RightPanel so it is accessible from any tab — then the auto-switch would fire meaningfully"
  debug_session: ""
