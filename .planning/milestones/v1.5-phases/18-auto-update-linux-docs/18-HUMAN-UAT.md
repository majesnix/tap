---
status: complete
phase: 18-auto-update-linux-docs
source: [18-VERIFICATION.md]
started: 2026-05-23
updated: 2026-05-23
---

## Tests

### 1. Live update notification on startup (UPD-02)
expected: App shows a non-modal Sonner toast on startup when a newer version tag exists on GitHub Releases — toast has title, description, and "Install & Relaunch" action button; disappears only on user action (duration: Infinity)
result: PASS — user confirmed update toast appeared on startup after installing v1.5.6 and publishing v1.5.7 (repo made public to allow unauthenticated latest.json fetch)

### 2. Download, install, and relaunch flow (UPD-03)
expected: User clicks "Install & Relaunch" from the toast, app downloads and installs the update, relaunches, and the version number reflects the new release
result: PASS — user confirmed Install & Relaunch completed and updated version is running

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Notes

- Root cause of initial failure: repository was private — `tauri-plugin-updater` makes unauthenticated requests; 404 was silently swallowed by `.catch`. Fixed by making the repo public.
- Bonus delivery: "Check for Updates..." added to macOS native menu bar (Tap application menu) and manual trigger button in sidebar for Windows/Linux — not in original Phase 18 scope.
