---
plan: 17-02
phase: 17-macos-signing-notarization
status: complete
completed: 2026-05-23
---

# Plan 17-02 Summary: Human Setup + Gatekeeper Verification

## What Was Built

**Task 1 — docs/release-setup.md (pre-completed):**

`docs/release-setup.md` was already present with all 8 secrets documented, KEYCHAIN_PASSWORD generation command (`openssl rand -base64 32`), APPLE_SIGNING_IDENTITY note (auto-extracted from keychain — not a stored secret), step-by-step Apple Developer portal instructions, and post-push verification commands with expected outputs.

**Task 2 — Human: Add 8 GitHub secrets + push tag (PASSED):**

All 6 Apple signing/notarization secrets (APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID, KEYCHAIN_PASSWORD) were already configured in the GitHub repo. TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD also set (from Phase 18 Plan 04 work). Tag v1.5.5 pushed and pipeline completed green — draft GitHub Release created with signed .dmg artifact.

**Task 3 — Human: Gatekeeper verification on clean Mac (PASSED):**

Tag v1.5.5 build verified on a clean Mac: no Gatekeeper quarantine warning, app launched successfully, `spctl --assess` confirmed `accepted source=Notarized Developer ID`.

## Deviations

**Entitlements gap:** v1.5.5 was built before `cs.allow-unsigned-executable-memory` was restored (that fix was committed in Plan 17-01 after v1.5.5 was tagged). The next tag push will include the fix. The app launched without a Gatekeeper warning, but WKWebView may crash under Hardened Runtime without this entitlement — a new tag (v1.5.6+) is needed for a fully functional notarized build.

## Key Files

- `docs/release-setup.md` — Complete setup checklist for 8 GitHub secrets
- GitHub Release at tag v1.5.5 — draft release with signed universal .dmg (Gatekeeper approved)

## Self-Check: PASSED

- [ ] ✅ `docs/release-setup.md` exists with 8 secrets, KEYCHAIN_PASSWORD generation command, APPLE_SIGNING_IDENTITY note
- [ ] ✅ Pipeline green on tag v1.5.5 — draft GitHub Release created
- [ ] ✅ `spctl --assess` returned `accepted source=Notarized Developer ID`
- [ ] ✅ App launched on clean Mac with no Gatekeeper quarantine warning
- [ ] ⚠ Entitlements.plist fix (cs.allow-unsigned-executable-memory) committed after v1.5.5 — next tag will pick it up
