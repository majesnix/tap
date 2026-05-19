---
status: partial
phase: 07-mapfield
source: [07-VERIFICATION.md]
started: 2026-05-19T09:57:48Z
updated: 2026-05-19T09:57:48Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Enum-valued map field encoding

expected: Load a `.proto` with a `map<string, EnumType>` field. Fill in one entry with a non-zero enum variant. Click Send. RabbitMQ message decodes to the correct enum number (non-zero variant is not coerced to 0).
result: [pending]

### 2. Message-valued map field encoding

expected: Load a `.proto` with a `map<string, MessageType>` field. Fill in one entry with a non-empty nested message. Click Send. RabbitMQ message decodes to the correct nested message (fields are not dropped).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
