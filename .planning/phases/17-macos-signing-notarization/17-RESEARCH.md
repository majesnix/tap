# Phase 17: macOS Signing + Notarization — Research

**Researched:** 2026-05-22
**Domain:** macOS code signing, Apple notarization, GitHub Actions CI/CD, Tauri 2.x bundling
**Confidence:** HIGH (all critical claims verified against official sources or primary code)

---

## Summary

Phase 17 implements macOS code signing and notarization for the Tap release pipeline. The goal is that a tagged release produces a signed, notarized Universal `.dmg` that passes Gatekeeper on a clean Mac without a quarantine warning. All the mechanical infrastructure (certificate import, tauri-action invocation, artifact upload) already exists in `release.yml` from Phase 16. Phase 17 is primarily about **completing the wiring** (passing the remaining env vars to tauri-action, adding `if:` guards) and **restoring a critical entitlement** that a Phase 16 security review removed incorrectly.

The most important finding: **WR-03 left Entitlements.plist in a broken state for notarization.** It removed `com.apple.security.cs.allow-unsigned-executable-memory`, but WKWebView requires that entitlement (in addition to `cs.allow-jit`) for the JIT compiler to function under Hardened Runtime. Without it, the notarized app will crash at launch. The plan must restore this entitlement.

`tauri-action@v0.6.2` handles signing, notarization, and stapling automatically when the correct env vars are set — no separate `notarytool` step is required. The action delegates to Tauri CLI's bundler, which calls `codesign`, then submits to Apple's notary service, then staples. However, `TAURI_BUNDLER_DMG_IGNORE_CI=true` is injected by tauri-action internally, which means CI will succeed (green) even if notarization is pending or failed. Explicit `spctl --assess` verification is required after the build step.

**Primary recommendation:** Add the five missing env vars to the tauri-action step, add `if: github.event_name == 'push'` guards to the cert import/verify steps, restore `cs.allow-unsigned-executable-memory` in Entitlements.plist, flip `draft: true` in create-release, and add a post-build `spctl --assess` verification step.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CICD-01 | Release workflow triggers on git tag `v*` — builds, signs, notarizes, uploads draft GitHub Release | Trigger already exists; `draft: false` must flip to `draft: true`; gating guards needed |
| SIGN-01 | macOS .dmg signed with Developer ID Application cert as Universal binary | Certificate import already present; tauri-action needs APPLE_SIGNING_IDENTITY + APPLE_CERTIFICATE + APPLE_CERTIFICATE_PASSWORD env vars wired in |
| SIGN-02 | macOS .dmg notarized via notarytool, stapled, passes Gatekeeper | tauri-action handles notarization when APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID are present; Entitlements.plist must restore `cs.allow-unsigned-executable-memory`; verification via `spctl --assess` required |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Certificate import & keychain setup | CI runner (GitHub Actions) | — | One-time per workflow run; keychain is runner-local |
| Code signing of .app bundle | Tauri CLI bundler (via tauri-action) | codesign CLI | Tauri CLI orchestrates codesign with identity; no manual codesign call needed |
| Notarization submission | Tauri CLI bundler (via tauri-action) | Apple notary service | CLI submits zip to Apple, polls for ticket, staples into .dmg |
| Hardened Runtime entitlements | Entitlements.plist (checked into repo) | tauri.conf.json (points to plist) | Entitlements travel with the binary; wrong entitlements = crash post-notarization |
| Artifact upload (signed .dmg) | GitHub Actions (upload-artifact) | — | Passes .dmg to create-release job |
| GitHub Release creation | create-release job (softprops/action-gh-release) | — | Consumes uploaded artifacts and publishes release |
| Gatekeeper verification | CI runner post-build step | — | `spctl --assess --type exec` confirms signing/notarization chain |

---

## Standard Stack

### Core

| Tool / Action | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `tauri-apps/tauri-action` | `v0.6.2` (pinned) | Build, sign, notarize Tauri app | Official Tauri action; handles full sign+notarize pipeline via Tauri CLI |
| `dtolnay/rust-toolchain` | `stable` | Install Rust | Standard, maintained by dtolnay |
| `Swatinem/rust-cache` | `v2` | Cache Rust build artifacts | De-facto standard for Rust CI caching |
| `actions/upload-artifact` | `v7` | Upload signed .dmg to artifact store | Latest GA version |
| `actions/download-artifact` | `v8` | Download artifacts in create-release | Latest GA version; NOTE: must match upload version family |
| `softprops/action-gh-release` | `v3` | Create GitHub Release with attachments | De-facto standard for GH releases |
| macOS `security` CLI | system | Import certificate into keychain | Built into macOS runner; the only way to add certs in CI |
| Apple `codesign` | system | Sign binaries (called by Tauri CLI) | System tool on macOS |
| Apple `notarytool` | system (Xcode) | Notarize .dmg (called by Tauri CLI) | Replaces deprecated altool; bundled in Xcode on macos-latest |

**Version note:** The `v1` tag for `tauri-apps/tauri-action` does NOT exist. [VERIFIED: GitHub API `GET /repos/tauri-apps/tauri-action/git/ref/tags/v1` returns 404]. Only `v0` (floating, currently resolves to v0.6.2) and pinned `v0.6.2` exist. Context7 docs showing `@v1` are incorrect. Phase 16 correctly pinned to `@v0.6.2`.

### Environment Variables Required by tauri-action for Signing + Notarization

[VERIFIED: tauri-apps/tauri-action README and official example `publish-to-auto-release-universal-macos-app-with-signing-certificate.yml`]

| Env Var | Required For | Source |
|---------|-------------|--------|
| `APPLE_CERTIFICATE` | Signing — base64-encoded .p12 | GitHub secret |
| `APPLE_CERTIFICATE_PASSWORD` | Signing — decrypt the .p12 | GitHub secret |
| `APPLE_SIGNING_IDENTITY` | Signing — "Developer ID Application: Name (TEAMID)" | Extracted from keychain at runtime (`${{ env.CERT_ID }}`) |
| `APPLE_ID` | Notarization — Apple ID email | GitHub secret |
| `APPLE_PASSWORD` | Notarization — app-specific password (NOT Apple ID password) | GitHub secret |
| `APPLE_TEAM_ID` | Notarization — 10-char team ID | GitHub secret |

**Currently wired into tauri-action step:** `GITHUB_TOKEN` only.
**Missing from tauri-action step:** All 6 above. Certificate import step sets them up in the keychain and env, but they must also be passed as env vars on the tauri-action step itself.

---

## Architecture Patterns

### macOS Signing + Notarization Flow

```
Tag push (v*.*.*)
        │
        ▼
build-macos job
        │
        ├─ [if: push] Import Apple Certificate into build.keychain
        │              (base64-decode .p12, security import)
        │
        ├─ [if: push] Verify Certificate → extract CERT_ID → $GITHUB_ENV
        │
        ├─ [always]   pnpm install
        │
        ├─ tauri-apps/tauri-action@v0.6.2
        │   env: APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD,
        │        APPLE_SIGNING_IDENTITY ($CERT_ID), APPLE_ID,
        │        APPLE_PASSWORD, APPLE_TEAM_ID, GITHUB_TOKEN
        │   args: --target universal-apple-darwin
        │       │
        │       ├─ pnpm build (frontend)
        │       ├─ cargo build --target universal-apple-darwin
        │       ├─ tauri bundle
        │       │   └─ codesign --entitlements Entitlements.plist
        │       ├─ notarytool submit (if APPLE_ID set)
        │       └─ staple .dmg (if notarization succeeded)
        │
        ├─ [if: push] spctl --assess --type exec (Gatekeeper verification)
        │
        └─ upload-artifact: src-tauri/target/universal-apple-darwin/release/bundle/
                │
                ▼
        create-release job (if: startsWith(github.ref, 'refs/tags/'))
                │
                ├─ download-artifact
                └─ softprops/action-gh-release (draft: true)
                       ├─ **/*.dmg
                       ├─ **/*.AppImage, *.deb, *.rpm (Linux)
                       └─ **/*.msi, *.exe (Windows)
```

### Entitlements Configuration (Corrected)

[VERIFIED: Apple developer docs + multiple Tauri community sources confirming WKWebView crash without `allow-unsigned-executable-memory`]

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Sandbox DISABLED — required for arbitrary file read (.proto files) -->
  <!-- Confirmed: WR-03 kept this false correctly -->
  <key>com.apple.security.app-sandbox</key>
  <false/>

  <!-- JIT execution — required by WKWebView -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>

  <!-- Unsigned executable memory — required by WKWebView for JS engine -->
  <!-- CRITICAL: WR-03 INCORRECTLY removed this. Without it, notarized app crashes at launch. -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

**What WR-03 got wrong:** `cs.allow-unsigned-executable-memory` is not "overly broad" for a WKWebView app — it is required. Apple's own documentation for Hardened Runtime lists it as a required entitlement for apps embedding WebKit. The entitlement lets the JS JIT compiler write executable pages that are not backed by a file. Without it, `codesign --verify` passes (signing is structural), but the app crashes at runtime when WKWebView initializes.

**`cs.allow-dyld-environment-variables`:** WR-03 also removed this. It is genuinely optional for most Tauri apps (it enables custom dyld env overrides, primarily used for debugging). Safe to leave out.

### tauri-action Step Wiring Pattern

```yaml
- name: Build Tauri app (universal macOS)
  uses: tauri-apps/tauri-action@v0.6.2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # Signing — required for SIGN-01
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ env.CERT_ID }}   # Set by Verify Certificate step
    # Notarization — required for SIGN-02
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  with:
    args: --target universal-apple-darwin
```

### Certificate Import Guard Pattern

```yaml
- name: Import Apple Developer Certificate
  if: github.event_name == 'push'   # REQUIRED — was missing in Phase 16 work
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security set-keychain-settings -t 3600 -u build.keychain
    security import certificate.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain
    security find-identity -v -p codesigning build.keychain

- name: Verify Certificate
  if: github.event_name == 'push'   # REQUIRED — was missing in Phase 16 work
  run: |
    CERT_INFO=$(security find-identity -v -p codesigning build.keychain | grep "Developer ID Application")
    CERT_ID=$(echo "$CERT_INFO" | awk -F'"' '{print $2}')
    if [ -z "$CERT_ID" ]; then
      echo "ERROR: Developer ID Application certificate not found in keychain"
      exit 1
    fi
    echo "CERT_ID=$CERT_ID" >> $GITHUB_ENV
    echo "Certificate: $CERT_ID"
```

### Gatekeeper Verification Step Pattern

```yaml
- name: Verify Gatekeeper (notarization check)
  if: github.event_name == 'push'
  run: |
    DMG=$(find src-tauri/target/universal-apple-darwin/release/bundle/dmg -name "*.dmg" | head -1)
    echo "Verifying: $DMG"
    spctl --assess --type open --context context:primary-signature --verbose "$DMG"
```

**Note:** `spctl --assess --type exec` is for binaries; for `.dmg` files use `--type open`. Use `--context context:primary-signature` or `--verbose` to get a clear PASS/FAIL. Exit code 0 = Gatekeeper approved.

### create-release Draft Flag

```yaml
- name: Create GitHub Release
  uses: softprops/action-gh-release@v3
  with:
    draft: true   # SC-1 requires draft; was incorrectly set to false
    generate_release_notes: true
    prerelease: ${{ contains(github.ref_name, '-') }}
    files: |
      **/*.dmg
      **/*.AppImage
      **/*.deb
      **/*.rpm
      **/*.msi
      **/*.exe
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Anti-Patterns to Avoid

- **Skipping the `if: github.event_name == 'push'` guard on cert steps:** workflow_dispatch runs will fail trying to import empty secrets. The cert steps must only run on push (tag push), not on manual dispatch without secrets.
- **Using APPLE_PASSWORD as the Apple ID account password:** Apple ID passwords are rejected for notarization. Must use an app-specific password generated at appleid.apple.com.
- **Trusting green CI as proof of notarization:** `TAURI_BUNDLER_DMG_IGNORE_CI=true` is injected automatically by tauri-action. CI succeeds even if notarization was skipped or timed out. Always add an explicit `spctl` check.
- **Using `altool` for notarization:** altool was deprecated by Apple in 2023 and disabled in 2024. Only `notarytool` works. tauri-action uses notarytool internally — no manual configuration needed.
- **Adding a separate `notarytool submit` step:** tauri-action handles the full sign→notarize→staple pipeline. Adding a manual step creates a double-submission error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sign + notarize + staple pipeline | Manual `codesign` + `notarytool` + `stapler` steps | `tauri-apps/tauri-action` with signing env vars | Action delegates to Tauri CLI which handles the full pipeline atomically; many edge cases in the stapling flow |
| Certificate management | Custom Python/bash secret extraction scripts | `security` CLI (already in release.yml) | macOS keychain is the only reliable cert storage in CI; existing steps are correct |
| GitHub Release creation | `gh release create` in bash | `softprops/action-gh-release@v3` | Handles draft/prerelease flags, glob file matching, retry logic |

---

## Runtime State Inventory

> Signing phase — external secrets and human-registered state, not code renames.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no databases involved | None |
| Live service config | Apple Developer portal: Developer ID Application cert must be issued and active; app-specific password must be generated | Human one-time setup (not code) |
| OS-registered state | macOS Keychain on developer machine: cert installed locally (for testing). CI uses ephemeral keychain per run. | None — CI keychain is created fresh each run |
| Secrets/env vars | 9 secrets required (see Open Questions for 9th secret): APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID, TAURI_SIGNING_PRIVATE_KEY (Phase 18), TAURI_SIGNING_PRIVATE_KEY_PASSWORD (Phase 18), KEYCHAIN_PASSWORD | Human must add KEYCHAIN_PASSWORD to GitHub repo secrets (not in original 8-list) |
| Build artifacts | `certificate.p12` created at root during CI run — ephemeral, not committed | None (runner is ephemeral) |

---

## Common Pitfalls

### Pitfall 1: WKWebView Crash After Notarization (WR-03 Regression)
**What goes wrong:** App installs, shows Gatekeeper approval, but crashes immediately on launch. Console shows "killed" or "signal 9" when WKWebView tries to initialize the JavaScript engine.
**Why it happens:** Hardened Runtime prevents writing unsigned executable memory pages. The JIT compiler in WKWebView's JavaScript engine requires this capability. `cs.allow-jit` alone is not sufficient — `cs.allow-unsigned-executable-memory` must also be set.
**How to avoid:** Restore `com.apple.security.cs.allow-unsigned-executable-memory` to Entitlements.plist. This is the primary deliverable of Phase 17.
**Warning signs:** App passes `spctl --assess` (notarization check) but crashes at launch.

### Pitfall 2: Green CI Does Not Mean Notarized
**What goes wrong:** Developer checks CI, sees green, uploads release, users get Gatekeeper warning.
**Why it happens:** `tauri-action` sets `TAURI_BUNDLER_DMG_IGNORE_CI=true` internally. This tells the Tauri bundler not to block CI if notarization is slow or returns a non-fatal error. The build step exits 0 regardless.
**How to avoid:** Add explicit `spctl --assess` step after the build step, gated on `if: github.event_name == 'push'`.
**Warning signs:** CI is green but no notarization log appears in the build step output.

### Pitfall 3: Missing Env Vars on tauri-action Step
**What goes wrong:** Build succeeds but app is unsigned (ad-hoc signed or unsigned). No signing or notarization errors shown because Tauri silently skips signing when env vars are absent.
**Why it happens:** The certificate is imported into the keychain but tauri-action doesn't auto-discover it — it needs the env vars explicitly on its step.
**How to avoid:** All 6 signing/notarization env vars must be set on the `tauri-apps/tauri-action` step (not just on preceding steps).
**Warning signs:** Build output shows no `codesign` commands; `codesign -dv --verbose=4 app.dmg` shows ad-hoc signature.

### Pitfall 4: `workflow_dispatch` Fails on Missing Secrets
**What goes wrong:** Manual workflow dispatch run fails at "Import Apple Developer Certificate" with base64 decode error or keychain creation error.
**Why it happens:** Cert import steps lack `if: github.event_name == 'push'` guard. When triggered manually without secrets pre-filled, `$APPLE_CERTIFICATE` is empty.
**How to avoid:** Add `if: github.event_name == 'push'` to cert import and verify steps.
**Warning signs:** workflow_dispatch test runs fail immediately at certificate steps.

### Pitfall 5: APPLE_PASSWORD Is Not the Apple ID Password
**What goes wrong:** Notarization fails with "Invalid credentials" or "Unable to authenticate."
**Why it happens:** Developer uses their Apple ID account password instead of an app-specific password. Apple ID passwords are blocked for notarytool.
**How to avoid:** Generate an app-specific password at https://appleid.apple.com → Sign-In and Security → App-Specific Passwords. This is a one-time human setup step.
**Warning signs:** Notarization error log shows authentication failure; error code typically 1057.

### Pitfall 6: upload-artifact / download-artifact Version Mismatch
**What goes wrong:** create-release job fails to download artifacts; "no artifacts found" error.
**Why it happens:** upload-artifact v4+ uses a different artifact storage API than v3. download-artifact must match the upload version family.
**Current state:** release.yml uses upload-artifact@v7 (build jobs) and download-artifact@v8 (create-release). These are compatible (both v4+ family). [ASSUMED — verify via GitHub Actions changelog if issues arise]
**Warning signs:** create-release job shows 0 artifacts downloaded.

---

## Open Questions (RESOLVED)

1. **KEYCHAIN_PASSWORD: 9th secret not in ROADMAP 8-list**
   - What we know: `release.yml` uses `${{ secrets.KEYCHAIN_PASSWORD }}` in the certificate import step. The ROADMAP lists 8 secrets for human one-time setup; KEYCHAIN_PASSWORD is not among them.
   - What's unclear: Was KEYCHAIN_PASSWORD intentionally omitted from the ROADMAP (implying it should be generated at plan time and added to the instructions), or was it an oversight?
   - RESOLVED: Plan should include adding KEYCHAIN_PASSWORD to the human setup checklist. It can be any strong random string (e.g., `openssl rand -base64 32`). It only secures the temporary CI keychain and has no external dependency.

2. **Should `cs.allow-dyld-environment-variables` be restored alongside `cs.allow-unsigned-executable-memory`?**
   - What we know: WR-03 removed both. `cs.allow-unsigned-executable-memory` is required (WKWebView crash). `cs.allow-dyld-environment-variables` enables custom dyld env overrides, primarily used for debugging (e.g., `DYLD_LIBRARY_PATH`).
   - What's unclear: Whether any production behavior of Tap depends on this entitlement.
   - RESOLVED: Leave `cs.allow-dyld-environment-variables` out — it is genuinely optional and the security reviewer's concern about it was valid. Only restore `cs.allow-unsigned-executable-memory`.

3. **`spctl --assess` syntax for .dmg files**
   - What we know: For `.app` bundles, `spctl --assess --type exec`. For `.dmg`, the correct type is `open` (Gatekeeper's "open" assessment).
   - What's unclear: Some sources use `--type exec` for .dmg files; this may work on some macOS versions and fail on others.
   - RESOLVED: Use `spctl --assess --type open --context context:primary-signature --verbose "$DMG"`. If that fails, fall back to `spctl --assess --verbose "$DMG"` (omitting --type lets Gatekeeper infer).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | upload-artifact@v7 and download-artifact@v8 are in the same v4+ artifact storage family and are compatible | Pitfall 6 | create-release fails to find artifacts; fix is to align versions |
| A2 | `spctl --assess --type open` is the correct syntax for assessing a .dmg file | Architecture Patterns (Gatekeeper Verification) | spctl step exits 1 for wrong type even on valid notarized .dmg; fix is to omit --type |
| A3 | tauri-action silently skips signing when env vars are absent (does not fail the build) | Pitfall 3 | If it does fail, the missing-env-vars problem is self-revealing; safer outcome |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes (CI secrets) | GitHub repo secrets with environment protection |
| V5 Input Validation | No | — |
| V6 Cryptography | Yes (code signing) | Developer ID Application cert; notarytool via Apple's PKI |

### Known Threat Patterns for macOS Signing in CI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Certificate exfiltration via leaked APPLE_CERTIFICATE secret | Information Disclosure | GitHub environment protection rules; limit secret access to protected branches/tags |
| Supply chain: compromised tauri-action | Tampering | Pin to exact version `@v0.6.2` (already done); review tauri-action release notes before bumping |
| Ad-hoc signed DMG shipped as "signed" | Spoofing | Explicit `spctl --assess` gate in CI; codesign -dv verification |
| App-specific password reuse | Elevation of Privilege | App-specific passwords are scoped — if leaked, only notarization is at risk, not full Apple ID |

### Secret Storage Recommendations

- `APPLE_CERTIFICATE`: Base64-encoded .p12; never commit to repo
- `APPLE_PASSWORD`: Must be an app-specific password (not Apple ID password); rotate annually
- `KEYCHAIN_PASSWORD`: Random string for ephemeral CI keychain; no external value; rotate at will
- All 9 secrets should use GitHub repository secrets (not environment secrets) since release workflow runs from the default branch/tags

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `macos-latest` runner | build-macos job | ✓ | GitHub-hosted; includes Xcode, notarytool, security CLI |
| `notarytool` (Xcode) | SIGN-02 notarization | ✓ | Bundled with Xcode on macos-latest; replaces altool |
| `codesign` | SIGN-01 signing | ✓ | System tool on macOS runner |
| `spctl` | Gatekeeper verification | ✓ | System tool on macOS runner |
| `security` CLI | Certificate import | ✓ | System tool on macOS runner; already used in release.yml |
| Apple Developer ID certificate | SIGN-01 | Human prerequisite | Must be issued by Apple Developer portal before Phase 17 executes |
| App-specific password | SIGN-02 | Human prerequisite | Must be generated at appleid.apple.com before Phase 17 executes |
| GitHub repo secrets (all 9) | CI signing/notarization | Human prerequisite | Must be added to repo secrets before tagged release |

**Missing dependencies with no fallback (human prerequisites):**
- Apple Developer ID Application certificate (must be purchased and issued)
- App-specific password for notarytool
- All 9 GitHub secrets populated

**Note:** These are human setup prerequisites, not CI tooling gaps. The CI tooling is fully available on `macos-latest`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `altool` for notarization | `notarytool` (Xcode 13+) | Altool deprecated 2023, disabled 2024 | tauri-action uses notarytool; no manual change needed |
| Separate `xcrun notarytool submit` step | tauri-action handles end-to-end | Tauri CLI ~v1.4 (2023) | No separate notarytool step needed in workflow |
| `hardenedRuntime: true` in tauri.conf.json | Default behavior in Tauri 2 | Tauri 2.0 release | No explicit config needed; hardened runtime is always enabled for notarization |

**Deprecated/outdated:**
- `xcrun altool --notarize-app`: Disabled by Apple; do not use
- `tauri.conf.json → bundle.macOS.hardenedRuntime`: Removed from Tauri 2 config schema; hardened runtime is unconditional for notarizable builds
- `tauri-apps/tauri-action@v1`: Does not exist; use `@v0.6.2`

---

## Sources

### Primary (HIGH confidence)

- tauri-apps/tauri-action README (GitHub) — env vars required for signing/notarization, official example workflow `publish-to-auto-release-universal-macos-app-with-signing-certificate.yml`
- GitHub API `GET /repos/tauri-apps/tauri-action/git/ref/tags/v1` — confirmed 404; v1 tag does not exist
- tauri-action `src/build.ts` (GitHub) — confirmed `TAURI_BUNDLER_DMG_IGNORE_CI: process.env.TAURI_BUNDLER_DMG_IGNORE_CI ?? 'true'` injected for macOS
- Apple Developer Documentation: Hardened Runtime entitlements reference — `cs.allow-jit` and `cs.allow-unsigned-executable-memory` both required for WKWebView
- `src-tauri/Entitlements.plist` (HEAD) — current 2-key state confirmed
- `.planning/phases/16-pipeline-foundation/16-REVIEW-FIX.md` — WR-03 documents the removal
- `.github/workflows/release.yml` (HEAD) — current workflow state confirmed

### Secondary (MEDIUM confidence)

- Multiple Tauri community forum posts and GitHub issues confirming `cs.allow-unsigned-executable-memory` crash behavior
- softprops/action-gh-release@v3 README — `draft`, `prerelease`, `files` parameters verified

### Tertiary (LOW confidence)

- upload-artifact@v7 / download-artifact@v8 cross-version compatibility [ASSUMED — not verified against GitHub Actions changelog]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tauri-action version verified via GitHub API; env vars verified against official example
- Architecture: HIGH — flow derived from tauri-action source code and official docs
- Pitfalls: HIGH for WR-03/entitlements (multiple sources), HIGH for TAURI_BUNDLER_DMG_IGNORE_CI (source code verified), MEDIUM for spctl syntax
- Entitlements: HIGH for `cs.allow-unsigned-executable-memory` requirement; MEDIUM for `cs.allow-dyld-environment-variables` omission

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (tauri-action releases; check for v0.7 before bumping)
