---
status: partial
phase: 25-block-apply-wkt-map-empty-case
source: [25-VERIFICATION.md]
started: 2026-05-25T14:05:00Z
updated: 2026-05-25T14:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. WKT Fill — Empty Field
expected: Drag block with Timestamp onto empty Timestamp field → field shows block value, no form error
result: [pending]

### 2. WKT Dirty Guard
expected: Type into Timestamp field first, then drag block → user value preserved, block NOT applied, toast lists skipped field
result: [pending]

### 3. Empty Map Fill
expected: Drag block with map rows onto empty map field → map shows block's rows with Remove buttons
result: [pending]

### 4. Non-Empty Map Protection
expected: Add map row manually, then drag block → existing rows preserved, block rows NOT applied, map field name in toast
result: [pending]

### 5. Unknown Field Toast
expected: Drag block with unknown field name → toast: "1 field from block not in form: <fieldname>"
result: [pending]

### 6. SC-3 Block-Re-drag Behavior (product intent check)
expected: Drag block A (ts: 2026-01-01) onto empty Timestamp, then drag block B (ts: 2026-12-31) → Timestamp shows 2026-12-31 (block-filled stays non-dirty, re-writable). Confirm this matches product intent per CONTEXT.md D-07.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
