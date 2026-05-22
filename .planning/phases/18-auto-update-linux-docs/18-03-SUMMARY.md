---
phase: 18-auto-update-linux-docs
plan: "03"
subsystem: ci-pipeline
tags:
  - ci
  - github-actions
  - linux
  - signing
  - docs
dependency_graph:
  requires:
    - 17-02 (macOS signing pipeline — establishes releaseDraft: true convention)
  provides:
    - Linux AppImage Ed25519 signing env vars in CI
    - Linux keychain runtime documentation for end users
  affects:
    - .github/workflows/release.yml
    - docs/linux-keychain.md
tech_stack:
  added: []
  patterns:
    - GitHub Actions env block for tauri-action signing secrets
    - D-Bus Secret Service runtime docs pattern (mirroring docs/release-setup.md structure)
key_files:
  modified:
    - .github/workflows/release.yml
  created:
    - docs/linux-keychain.md
decisions:
  - "Keep releaseDraft: true on Linux job — consistent with macOS job; manual publish is the release workflow gate"
  - "Removed build-windows job entirely — Windows out of scope for v1.5 per REQUIREMENTS.md"
  - "libsecret-1-0 clarification included in docs — dbus-secret-service-keyring-store uses D-Bus directly, not libsecret C API"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-22T15:27:59Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 18 Plan 03: CI Linux Signing + Linux Keychain Docs Summary

Wire Linux CI signing env vars, remove the out-of-scope Windows job, and create the Linux keychain documentation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Linux signing env vars and delete Windows job from release.yml | 3a07022 | .github/workflows/release.yml |
| 2 | Create docs/linux-keychain.md | f887913 | docs/linux-keychain.md |

## What Was Built

**Task 1 — release.yml changes:**
- Added `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars to the `build-linux` tauri-action step. Without these, tauri-action silently skips `.sig` file upload and the `linux-x86_64` entry never gets a valid signature in `latest.json` (Pitfall 1+2 from RESEARCH.md).
- Deleted the `build-windows` job entirely (lines 137–173). Windows is explicitly out of scope in v1.5 per REQUIREMENTS.md. Removing it prevents CI minute waste and eliminates a potential release blocker.
- `releaseDraft: true` retained on the Linux job — consistent with the macOS job. Manual publish step is the release workflow gate (resolved per Open Question 3 in RESEARCH.md).

**Task 2 — docs/linux-keychain.md:**
- Created 98-line documentation file covering all 6 DOC-01 required topics.
- Matches `docs/release-setup.md` structure: H1 title, one-sentence purpose, `---` separators, numbered steps, code blocks, bold for important terms, verification section.
- Key clarification: `libsecret-1-0` is NOT required — `dbus-secret-service-keyring-store` with `crypto-rust` feature uses D-Bus directly, not the libsecret C API. This prevents user confusion with other Linux desktop tools.
- Covers: what is stored, runtime deps (gnome-keyring/kwallet), system libraries, headless warning, distro-specific install commands (Ubuntu/Debian/Fedora/Arch), and verification via `gdbus` introspection.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates CI configuration and documentation. No UI components or data sources with stub values.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model:
- `TAURI_SIGNING_PRIVATE_KEY` is referenced via `${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}` — GitHub Actions masks secrets in CI logs automatically (T-18-09 mitigated).
- `docs/linux-keychain.md` contains no secrets — public documentation only (T-18-11 accepted).

## Self-Check: PASSED

- `.github/workflows/release.yml` — FOUND (modified)
- `docs/linux-keychain.md` — FOUND (created, 98 lines)
- Commit `3a07022` — FOUND (Task 1)
- Commit `f887913` — FOUND (Task 2)
- `TAURI_SIGNING_PRIVATE_KEY` in Linux env block — confirmed
- `build-windows` job — removed
- YAML valid — confirmed via npx js-yaml
- `gnome-keyring` occurrences: 7 (≥ 3)
