---
plan: 17-01
phase: 17-macos-signing-notarization
status: complete
completed: 2026-05-23
---

# Plan 17-01 Summary: Wire Signing + Restore WKWebView Entitlement

## What Was Built

**Task 1 — Signing env vars + guards (pre-completed by Phase 18 work):**

The release.yml signing infrastructure was already committed during Phase 18 execution:
- All 6 Apple signing/notarization env vars wired onto the tauri-action step (APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY via `${{ env.CERT_ID }}`, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID)
- `Import Apple Developer Certificate` step guarded with `if: startsWith(github.ref, 'refs/tags/')`
- `Verify Certificate` step guarded with `if: startsWith(github.ref, 'refs/tags/')`
- `Verify Gatekeeper` step added after tauri-action, guarded with `if: startsWith(github.ref, 'refs/tags/')`
- `releaseDraft: true` set on tauri-action (tauri-action handles release creation, no separate create-release job)

**Deviation from plan:** Plan specified `if: github.event_name == 'push'` guards; implementation uses `if: startsWith(github.ref, 'refs/tags/')`. This is strictly better — tag-only triggering avoids accidentally importing certificates on branch pushes. All must_haves are satisfied.

**Task 2 — Restore cs.allow-unsigned-executable-memory (this execution):**

Restored the WKWebView JIT entitlement that WR-03 (Phase 16 security review) incorrectly removed. Without it, the notarized app crashes at launch under Hardened Runtime. Apple's docs explicitly require this for apps embedding WebKit/WKWebView.

Entitlements.plist now has exactly 3 keys:
- `com.apple.security.app-sandbox` → `false` (required for arbitrary .proto file access)
- `com.apple.security.cs.allow-jit` → `true` (WKWebView)
- `com.apple.security.cs.allow-unsigned-executable-memory` → `true` (WKWebView JIT, restored)

`cs.allow-dyld-environment-variables` remains absent — WR-03's removal of that entitlement was correct.

## Key Files

- `.github/workflows/release.yml` — signing pipeline (pre-committed by Phase 18)
- `src-tauri/Entitlements.plist` — 3-key Hardened Runtime entitlements (committed in this plan)

## Self-Check: PASSED

- [ ] ✅ `grep -c "<key>" src-tauri/Entitlements.plist` → 3
- [ ] ✅ `grep "cs.allow-unsigned-executable-memory" src-tauri/Entitlements.plist` → present
- [ ] ✅ `grep "cs.allow-dyld-environment-variables" src-tauri/Entitlements.plist` → absent
- [ ] ✅ All 6 Apple signing vars on tauri-action step in release.yml
- [ ] ✅ if-guards on cert import, verify cert, and Gatekeeper steps
- [ ] ✅ `releaseDraft: true` on tauri-action (creates draft GitHub Release)
- [ ] ✅ YAML validity confirmed (file was already committed and CI-validated)
