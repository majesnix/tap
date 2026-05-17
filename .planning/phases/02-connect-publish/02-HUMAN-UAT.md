---
status: partial
phase: 02-connect-publish
source: [02-VERIFICATION.md]
started: 2026-05-17T23:40:00Z
updated: 2026-05-17T23:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End Profile Save + Connection Test
expected: Spinner appears while test runs; green checkmark + "Connected" displayed on success. Status dot in sidebar turns green. Modal stays open for user to close manually.
result: [pending]

### 2. Standalone "Test Connection" Button
expected: Spinner then green checkmark inline. Modal stays open. Profile IS in sidebar list but NOT yet active — status dot stays gray, dropdown still unselected.
result: [pending]

### 3. OS Keychain Isolation
expected: Password in Keychain Access under service "dev.protosender.app". proto-sender.json has host/port/vhost/username/managementPort but NO "password" key.
result: [pending]

### 4. Message Delivery to Queue
expected: "Message sent to [queue]" toast for 3s. Message visible in RabbitMQ Management UI. Form values unchanged after send.
result: [pending]

### 5. Management API Fallback Behavior (silent)
expected: Amber "Manual" badge. Picker switches to plain text Input. No error message.
result: [pending]

### 6. 401 Auth Error — NOT Silent Fallback
expected: Destructive red badge "Management API authentication failed: wrong credentials (HTTP 401)". Picker does NOT fall back to Manual silently.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
