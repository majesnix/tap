---
status: partial
phase: 18-auto-update-linux-docs
source: [18-VERIFICATION.md]
started: 2026-05-23
updated: 2026-05-23
---

## Current Test

[awaiting human testing — requires live app + two published releases]

## Tests

### 1. Live update notification on startup (UPD-02)
expected: App shows a non-modal Sonner toast on startup when a newer version tag exists on GitHub Releases — toast has title, description, and "Install & Relaunch" action button; disappears only on user action (duration: Infinity)
result: [pending]

### 2. Download, install, and relaunch flow (UPD-03)
expected: User clicks "Install & Relaunch" from the toast, app downloads and installs the update, relaunches, and the version number reflects the new release
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
