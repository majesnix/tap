---
plan: 18-04
phase: 18-auto-update-linux-docs
status: complete
completed: 2026-05-23
---

# Plan 18-04 Summary: Ed25519 Keygen + Pipeline Verify + AppImage Smoke Test

## What Was Built

**Task 1 — Ed25519 keypair + pubkey wiring (pre-completed):**

Real Ed25519 minisign keypair was generated in a prior session. Public key (ID: 47DE72BD11907EBC) is stored as base64 in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. Private key was uploaded to GitHub secrets as TAURI_SIGNING_PRIVATE_KEY. Local `~/.tauri/tap.key` files absent from current machine — key was not regenerated (regeneration would invalidate existing releases).

**Task 2 — GitHub secrets confirmed (human action):**

TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD confirmed present in GitHub repo secrets. All 8 signing secrets in place (6 Apple + 2 Tauri).

**Task 3 — Pipeline verify + latest.json (human verify):**

Tag v1.5.6 pushed (includes Entitlements.plist fix — `cs.allow-unsigned-executable-memory` restored). Both `build-linux` and `build-macos` CI jobs completed green. Draft release published. `latest.json` accessible at GitHub Releases endpoint with non-empty `signature` fields for `linux-x86_64` and `darwin-*` platform keys.

**Task 4 — AppImage smoke test (human verify, blocking):**

- Ubuntu 22.04 (Docker): **PASS** — AppImage launches without library errors or Exec format error
- Ubuntu 24.04 (Docker): **PASS** — AppImage launches without library errors or Exec format error

## Key Files

- `src-tauri/tauri.conf.json` — Real Ed25519 pubkey wired into plugins.updater.pubkey
- GitHub Release v1.5.6 — signed .dmg + signed .AppImage + latest.json with platform signatures
- `docs/linux-keychain.md` — libsecret install docs (from Plan 18-03)

## Self-Check: PASSED

- [ ] ✅ `tauri.conf.json` pubkey contains real key content (not placeholder)
- [ ] ✅ TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD in GitHub secrets
- [ ] ✅ Pipeline green on both build-linux and build-macos for v1.5.6
- [ ] ✅ `latest.json` accessible with non-empty linux-x86_64 + darwin-* signature fields
- [ ] ✅ AppImage PASS on Ubuntu 22.04 (Docker headless)
- [ ] ✅ AppImage PASS on Ubuntu 24.04 (Docker headless)
- [ ] ⚠ End-to-end v1.5.x → v1.5.6 auto-update install path (UPD-02/UPD-03 live flow) deferred to milestone UAT — requires two published releases on same machine
