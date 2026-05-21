# Requirements: v1.5 Distribution

**Milestone:** v1.5 Distribution
**Goal:** Make Tap installable by any team member — signed, auto-updating packages for macOS and Linux, built and released automatically via GitHub Actions.
**Date:** 2026-05-21

---

## v1 Requirements

### CICD — CI/CD Pipeline

- [ ] **CICD-01**: Release workflow triggers on git tag push `v*` — builds, signs, notarizes, and uploads artifacts to a draft GitHub Release
- [ ] **CICD-02**: Developer can trigger a `workflow_dispatch` dry-run (no signing) to validate pipeline structure
- [ ] **CICD-03**: Rust build artifacts are cached between runs (reduces macOS cold-build time from ~20 min to ~5 min)

### SIGN — macOS Signing + Notarization

- [ ] **SIGN-01**: macOS .dmg is signed with Developer ID Application cert as a Universal binary (aarch64 + x86_64)
- [ ] **SIGN-02**: macOS .dmg is notarized by Apple via `notarytool` and stapled — passes Gatekeeper on a clean Mac without quarantine warning
- [ ] **SIGN-03**: `Entitlements.plist` includes required Hardened Runtime WebView entitlements (`cs.allow-jit`, `cs.allow-unsigned-executable-memory`, `cs.allow-dyld-environment-variables`)

### PKG — Linux Packaging

- [ ] **PKG-01**: Linux `.AppImage` is built on ubuntu-22.04 and runs on Ubuntu 22.04 and 24.04

### UPD — Auto-Update

- [ ] **UPD-01**: App has an updater signing keypair; public key in `tauri.conf.json`; private key stored as GitHub Actions secret and offline backup
- [ ] **UPD-02**: App checks for updates on startup; shows a non-modal notification when a newer version is available
- [ ] **UPD-03**: User can confirm the update — app downloads, installs, and offers to relaunch
- [ ] **UPD-04**: `latest.json` is uploaded to GitHub Releases as part of the release pipeline, accessible at the configured endpoint

### DOC — Documentation

- [ ] **DOC-01**: `docs/linux-keychain.md` documents `libsecret` / `gnome-keyring` runtime prerequisite for Linux users

---

## Future Requirements

Deferred to future milestones:

- Linux `.deb` package — first-install convenience; not selected for v1.5
- Windows distribution — no code signing strategy defined yet
- Update download progress bar — UX polish, not required for functionality
- Manual "Check for Updates" menu item — launch-on-startup covers team use case
- Update delta / rollback — tauri-plugin-updater ships full binaries only

---

## Out of Scope

- App Store distribution — requires full sandboxing which conflicts with arbitrary .proto file reading
- OAuth or team-shared credentials — each user manages their own profiles locally
- Non-macOS/Linux targets in v1.5 — Windows requires separate EV/OV certificate and Authenticode signing

---

## Traceability

| Phase | Requirements |
|-------|-------------|
| (to be filled by roadmapper) | |
