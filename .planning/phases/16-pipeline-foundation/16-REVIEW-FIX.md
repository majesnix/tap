---
phase: 16-pipeline-foundation
fixed_at: 2026-05-21T21:30:00Z
review_path: .planning/phases/16-pipeline-foundation/16-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-05-21T21:30:00Z
**Source review:** .planning/phases/16-pipeline-foundation/16-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02 explicitly skipped per task instructions; CR-03, CR-04, WR-01 through WR-05 in scope)
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-03: Certificate grep matches the wrong cert type

**Files modified:** `.github/workflows/release.yml`
**Commit:** 92d7ba4
**Applied fix:** Changed grep pattern from `"Apple Development"` to `"Developer ID Application"` in the Verify Certificate step. Added fail-fast guard: if `CERT_ID` is empty after the grep, the job now prints an error message and exits with code 1, preventing silent signing failures.

---

### CR-04: Windows build job missing from release workflow

**Files modified:** `.github/workflows/release.yml`
**Commit:** 4bab18d
**Applied fix:** Added `build-windows` job using `windows-latest` runner with `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `pnpm/action-setup@v6`, `setup-node@v6` (Node 20 + pnpm cache), `pnpm install --frozen-lockfile`, `tauri-apps/tauri-action@v0`, and `upload-artifact@v7` with `name: windows-artifacts` and `path: src-tauri/target/release/bundle/`. Added `build-windows` to `create-release.needs`. Also added `**/*.msi` and `**/*.exe` glob patterns to the release file list so Windows installers are included in the GitHub Release.

---

### WR-02: tauri.conf.json uses npm run instead of pnpm

**Files modified:** `src-tauri/tauri.conf.json`
**Commit:** 8d7a23c
**Applied fix:** Changed `"beforeDevCommand": "npm run dev"` to `"pnpm dev"` and `"beforeBuildCommand": "npm run build"` to `"pnpm build"`. JSON syntax verified valid after change.

---

### WR-03: Entitlements.plist grants overly-broad hardened-runtime exceptions

**Files modified:** `src-tauri/Entitlements.plist`
**Commit:** ba0e9ff
**Applied fix:** Removed `com.apple.security.cs.allow-unsigned-executable-memory` and `com.apple.security.cs.allow-dyld-environment-variables` entitlements. Kept `com.apple.security.app-sandbox` (false) and `com.apple.security.cs.allow-jit` (true, required for WKWebView JavaScript engine on Intel macOS).

---

### WR-04: CI does not run TypeScript type-checking or frontend build

**Files modified:** `.github/workflows/ci.yml`
**Commit:** fb34d1c
**Applied fix:** Added `Type-check frontend` step running `pnpm build` (which runs `tsc && vite build`) after the frontend test step and before the Rust tests.

---

### WR-05: CI installs coverage tool but never runs it

**Files modified:** `.github/workflows/ci.yml`
**Commit:** c509a82
**Applied fix:** Replaced the bare `pnpm test` step with `pnpm exec vitest run --coverage --reporter=verbose` so coverage is collected on every CI run. No `test:coverage` script existed in `package.json`, so the coverage invocation is inline.

---

## Skipped Issues

### WR-01: Signing identity hardcoded in tauri.conf.json

**File:** `src-tauri/tauri.conf.json:36`
**Reason:** skipped: code context differs from review — the current `tauri.conf.json` contains no `signingIdentity` field. The finding was based on an older state of the file that has since been cleaned up. No action required.
**Original issue:** `signingIdentity` contained a literal certificate fingerprint and developer name checked into the repository.

---

_Fixed: 2026-05-21T21:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
