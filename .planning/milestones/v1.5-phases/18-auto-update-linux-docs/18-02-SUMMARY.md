---
phase: 18-auto-update-linux-docs
plan: "02"
subsystem: frontend
tags:
  - auto-update
  - tdd
  - react
  - tauri-plugin-updater
  - tauri-plugin-process
  - sonner
dependency_graph:
  requires: []
  provides:
    - UpdateChecker component (startup update notification)
    - UPD-02 implementation (non-modal toast on update available)
    - UPD-03 implementation (install + relaunch on user confirmation)
  affects:
    - src/App.tsx
tech_stack:
  added:
    - "@tauri-apps/plugin-updater 2.10.1 (npm)"
    - "@tauri-apps/plugin-process 2.3.1 (npm)"
  patterns:
    - ThemeBootstrap extraction pattern (startup effect component returning null)
    - vi.hoisted mock factory for Vitest module mocking
    - Silent .catch() for background startup operations
key_files:
  created:
    - src/UpdateChecker.tsx
    - src/UpdateChecker.test.tsx
  modified:
    - src/App.tsx
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Extracted UpdateChecker as standalone component (not inline in App) — mirrors ThemeBootstrap pattern; improves testability"
  - "Toast duration: Infinity — update notification must persist until user acts; no auto-dismiss"
  - "Silent .catch() on check() failure — 404 before first published release is a normal startup condition; no user-visible error"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_changed: 5
---

# Phase 18 Plan 02: UpdateChecker Component Summary

**One-liner:** Non-modal startup update notification using @tauri-apps/plugin-updater check() → Sonner toast → downloadAndInstall() + relaunch() flow, implemented TDD.

## What Was Built

A `UpdateChecker` React component that:
- Calls `check()` from `@tauri-apps/plugin-updater` once on mount
- Shows a persistent Sonner toast (duration: Infinity) when `update.available` is true: title "Update {version} available", description from `update.body` or fallback
- Provides an "Install & Relaunch" action that calls `update.downloadAndInstall()` then `relaunch()`
- Swallows all `check()` errors silently via `.catch()` with `console.error` only — app startup is never affected by update check failures

The component is mounted in `App.tsx` alongside `ThemeBootstrap`, before `AppLayout`.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | c28a4b6 | PASS — tests failed with "Failed to resolve import './UpdateChecker'" |
| GREEN (feat) | 5f17f5b | PASS — all 5 tests pass, 333/333 full suite |

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write UpdateChecker tests (RED phase) | c28a4b6 | src/UpdateChecker.test.tsx, package.json, pnpm-lock.yaml |
| 2 | Implement UpdateChecker + mount in App (GREEN phase) | 5f17f5b | src/UpdateChecker.tsx, src/App.tsx |

## Test Coverage

5 test cases in `src/UpdateChecker.test.tsx`:

1. `check()` is called on mount (UPD-02)
2. Sonner toast shown with correct title/description/action/duration when update is available (UPD-02)
3. No toast when `update.available` is false (UPD-02)
4. Clicking "Install & Relaunch" calls `downloadAndInstall()` then `relaunch()` (UPD-03)
5. `check()` rejection is swallowed silently — no toast shown (T-18-07 mitigate, Pitfall 4)

Full suite: 333 tests pass, 0 regressions.

## Deviations from Plan

None — plan executed exactly as written. The vi.hoisted mock structure, component implementation, and App.tsx mounting all followed the plan's prescriptive code samples.

## Known Stubs

None. The UpdateChecker component is fully wired: check() call, toast notification, and downloadAndInstall() + relaunch() flow are all implemented. The pubkey in tauri.conf.json (Plan 18-01's concern) must be populated before the update endpoint can return a valid update object at runtime, but that is a separate plan's responsibility.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers:
- T-18-07 (DoS via check() failure) mitigated: .catch() swallows all errors
- T-18-08 (tampered payload) transferred: tauri-plugin-updater handles Ed25519 verification before downloadAndInstall() exposes data

## Self-Check

- [x] src/UpdateChecker.tsx exists
- [x] src/UpdateChecker.test.tsx exists
- [x] Commits c28a4b6 (test) and 5f17f5b (feat) exist in git log
- [x] `grep -c 'vi.hoisted' src/UpdateChecker.test.tsx` = 3 (>= 1 required)
- [x] `grep 'UpdateChecker' src/App.tsx` shows import and JSX tag
- [x] `grep 'duration: Infinity' src/UpdateChecker.tsx` confirmed
- [x] `grep 'Install.*Relaunch' src/UpdateChecker.tsx` confirmed
- [x] `grep 'downloadAndInstall' src/UpdateChecker.tsx` confirmed
- [x] `grep 'console.error.*Update check failed' src/UpdateChecker.tsx` confirmed
- [x] Full test suite 333/333 pass, no regressions

## Self-Check: PASSED
