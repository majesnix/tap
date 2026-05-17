---
status: diagnosed
phase: 02-connect-publish
source: [02-VERIFICATION.md]
started: 2026-05-17T23:40:00Z
updated: 2026-05-17T23:50:00Z
---

## Current Test

Human testing complete.

## Tests

### 1. End-to-End Profile Save + Connection Test
expected: Spinner appears while test runs; green checkmark + "Connected" displayed on success. Status dot in sidebar turns green. Modal stays open for user to close manually.
result: approved

### 2. Standalone "Test Connection" Button
expected: Spinner then green checkmark inline. Modal stays open. Profile IS in sidebar list but NOT yet active — status dot stays gray, dropdown still unselected.
result: partial — Test Connection button missing in edit mode; modal lacks scrolling for multiple profiles

### 3. OS Keychain Isolation
expected: Password in Keychain Access under service "dev.protosender.app". proto-sender.json has host/port/vhost/username/managementPort but NO "password" key.
result: approved

### 4. Message Delivery to Queue
expected: "Message sent to [queue]" toast for 3s. Message visible in RabbitMQ Management UI. Form values unchanged after send.
result: approved

### 5. Management API Fallback Behavior (silent)
expected: Amber "Manual" badge. Picker switches to plain text Input. No error message.
result: approved

### 6. 401 Auth Error — NOT Silent Fallback
expected: Destructive red badge "Management API authentication failed: wrong credentials (HTTP 401)". Picker does NOT fall back to Manual silently.
result: approved

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### Gap 1: Test Connection button missing in edit mode
status: failed
description: "Test Connection" button is hidden in edit mode (formMode === "edit"). User expects to be able to test the connection from an existing profile's edit view.

### Gap 2: Modal overflow — no scroll for multiple profiles
status: failed
description: ProfileManagementModal does not scroll when there are many saved profiles, causing content to overflow off-screen.
