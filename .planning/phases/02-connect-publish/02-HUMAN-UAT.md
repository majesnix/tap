---
status: partial
phase: 02-connect-publish
source: [02-VERIFICATION.md]
started: 2026-05-17T21:30:00Z
updated: 2026-05-17T21:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end AMQP connection test
expected: User can create a connection profile, click "Test Connection", and see a green checkmark inline when the broker is reachable with valid credentials

### 2. OS keychain isolation
expected: The profile JSON stored on disk contains no password field; the password is stored exclusively in the OS keychain and retrievable across app restarts

### 3. Message delivery to queue
expected: After clicking Send, the message appears in the target queue (confirm via RabbitMQ Management UI or a consumer); message payload is binary protobuf wire format, not JSON

### 4. Silent Manual fallback when Management API unreachable
expected: When the Management API port (default 15672) is unreachable, the queue/exchange dropdown switches to a manual text input field without surfacing an error toast

### 5. 401 auth error badge — not silent fallback
expected: When the Management API returns HTTP 401, a visible red error badge appears in the publish bar (not a silent switch to manual mode)

### 6. Multi-profile switching with live data refresh
expected: Switching to a different profile in the sidebar dropdown re-triggers the connection test and refreshes the queue/exchange list for the new broker

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
