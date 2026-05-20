---
status: partial
phase: 09-routing-key-autocomplete
source: [09-VERIFICATION.md]
started: 2026-05-19T19:45:00Z
updated: 2026-05-19T19:45:00Z
---

## Current Test

[awaiting human testing with a live RabbitMQ connection]

## Tests

### 1. Searchable filtering in combobox
expected: Type a partial string into the routing key combobox while a direct/topic exchange is selected. The cmdk filter behavior is fully mocked in tests; real searchability needs exercise against actual data. Suggestion list should narrow in real time to matching keys.
result: [pending]

### 2. Exchange type badges in dropdown
expected: Open the exchange selector with a live RabbitMQ connection and verify `[direct]`, `[topic]`, `[fanout]`, `[headers]` badges render beside exchange names in the dropdown.
result: [pending]

### 3. Hint text with real Management API data
expected: Select a fanout exchange → "Routing key is ignored for fanout exchanges." appears below routing key row. Select a headers exchange → "Headers exchanges route by message headers, not routing key." appears.
result: [pending]

### 4. Stale-request guard under rapid exchange switching
expected: Switch quickly between two eligible direct/topic exchanges; only the last exchange's binding keys appear in the combobox. No flicker or intermediate results from the superseded request.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
