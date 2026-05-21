---
phase: 16-pipeline-foundation
reviewed: 2026-05-21T21:02:46Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - .github/workflows/release.yml
  - .github/workflows/ci.yml
  - package.json
  - src-tauri/Cargo.lock
  - src-tauri/Cargo.toml
  - src-tauri/Entitlements.plist
  - src-tauri/tauri.conf.json
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-05-21T21:02:46Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase establishes the CI/CD pipeline foundation (GitHub Actions workflows), project manifest files, and Tauri configuration. Four blockers were found: two make the macOS release build produce no artifacts and upload nothing (incorrect artifact path, duplicate artifact name), one makes code signing silently produce an unsigned binary (wrong certificate grep pattern), and one means the declared Windows target is never built or tested. Five warnings address hardcoded identity data, build tool inconsistency, overly-broad macOS entitlements, missing CI steps, and a placeholder author field.

---

## Critical Issues

### CR-01: macOS upload path does not match what the matrix builds produce

**File:** `.github/workflows/release.yml:14-17, 82`

**Issue:** The `build-macos` job uses a matrix to build `aarch64-apple-darwin` and `x86_64-apple-darwin` separately (lines 14-17 via `matrix.args`). However, the "Upload macOS artifacts" step reads from `src-tauri/target/universal-apple-darwin/release/bundle/` (line 82). That path is only created by `--target universal-apple-darwin` (a true fat-binary build). Neither matrix leg produces output at that path — the upload will silently succeed with zero files, and the release will contain no macOS binaries.

**Fix:** Either (a) switch each matrix leg to its own correct output path, or (b) drop the matrix and use a single `--target universal-apple-darwin` build:

```yaml
# Option A — per-arch paths matching the matrix
- name: Upload macOS artifacts
  uses: actions/upload-artifact@v7
  with:
    name: macos-artifacts-${{ matrix.arch }}
    path: src-tauri/target/${{ matrix.arch == 'silicon' && 'aarch64-apple-darwin' || 'x86_64-apple-darwin' }}/release/bundle/

# Option B — single universal build (drop the matrix entirely)
- name: Build Tauri app (universal macOS)
  uses: tauri-apps/tauri-action@v0
  with:
    args: --target universal-apple-darwin
```

---

### CR-02: Matrix produces duplicate artifact name — upload-artifact errors on collision

**File:** `.github/workflows/release.yml:79-82`

**Issue:** Both matrix legs (silicon and intel) upload to `name: macos-artifacts` (line 81). `actions/upload-artifact@v3+` fails when two parallel jobs in the same run upload the same artifact name. One of the two builds will error, causing the entire `create-release` job to be blocked.

**Fix:** Parameterise the artifact name with the matrix variable:

```yaml
- name: Upload macOS artifacts
  uses: actions/upload-artifact@v7
  with:
    name: macos-artifacts-${{ matrix.arch }}
    path: ...
```

Matches the `download-artifact` step in `create-release` which downloads all artifacts anyway.

---

### CR-03: Certificate grep matches the wrong cert type — signing identity will be empty

**File:** `.github/workflows/release.yml:61`

**Issue:** The "Verify Certificate" step greps for `"Apple Development"`:

```bash
CERT_INFO=$(security find-identity -v -p codesigning build.keychain | grep "Apple Development")
```

But the certificate being imported is a **Developer ID Application** certificate (as confirmed by `tauri.conf.json:36`: `"Developer ID Application: Dominic Classen"`). `Apple Development` certs are used for device testing, not notarized distribution. The grep will match nothing, `CERT_ID` will be empty, and `APPLE_SIGNING_IDENTITY` (line 71) will be set to an empty string. Tauri will either skip signing or error without a clear message, producing an unsigned binary that macOS Gatekeeper will reject.

**Fix:**

```bash
CERT_INFO=$(security find-identity -v -p codesigning build.keychain | grep "Developer ID Application")
CERT_ID=$(echo "$CERT_INFO" | awk -F'"' '{print $2}')
echo "CERT_ID=$CERT_ID" >> $GITHUB_ENV
echo "Certificate: $CERT_ID"
```

Also add a guard so the job fails fast if the cert is not found:

```bash
if [ -z "$CERT_ID" ]; then
  echo "ERROR: Developer ID Application certificate not found in keychain"
  exit 1
fi
```

---

### CR-04: Windows is a stated distribution target but has no build job

**File:** `.github/workflows/release.yml` (entire file), `src-tauri/Cargo.toml:47-48`

**Issue:** `CLAUDE.md` states the app "Should be cross-platform (macOS, Windows, Linux) since it's a team tool." `Cargo.toml` ships a `windows-native-keyring-store` dependency behind `cfg(target_os = "windows")` — meaning Windows-specific code exists. The `release.yml` has no `build-windows` job, and `ci.yml` never compiles or tests Windows code. Windows build failures, linker errors, and keyring integration bugs will reach users undetected.

**Fix:** Add a `build-windows` job to `release.yml`:

```yaml
build-windows:
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v6
    - uses: dtolnay/rust-toolchain@stable
    - uses: Swatinem/rust-cache@v2
      with:
        workspaces: src-tauri
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v6
      with:
        node-version: "20"
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - uses: tauri-apps/tauri-action@v0
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    - uses: actions/upload-artifact@v7
      with:
        name: windows-artifacts
        path: src-tauri/target/release/bundle/
```

Add `build-windows` to `create-release.needs`.

---

## Warnings

### WR-01: Signing identity hardcoded in tauri.conf.json

**File:** `src-tauri/tauri.conf.json:36`

**Issue:** `signingIdentity` contains a literal certificate fingerprint and developer name:

```json
"signingIdentity": "45DF4580231F3F595EBE858DA84AB8DF3631FD08 \"Developer ID Application: Dominic Classen (SKMTX4CJ27)\""
```

This is checked into the repository. It embeds a personal developer identity (name + Team ID) in source code shared across the team. The fingerprint will become stale on cert renewal. The CI workflow already handles this dynamically via `APPLE_SIGNING_IDENTITY: ${{ env.CERT_ID }}` — the static config field fights that.

**Fix:** Remove the hardcoded `signingIdentity` from `tauri.conf.json` and rely entirely on the `APPLE_SIGNING_IDENTITY` environment variable set by the workflow. Tauri reads the env var when the config field is absent.

---

### WR-02: tauri.conf.json uses `npm run` but project package manager is pnpm

**File:** `src-tauri/tauri.conf.json:7, 9`

**Issue:**

```json
"beforeDevCommand": "npm run dev",
"beforeBuildCommand": "npm run build"
```

`package.json:6` declares `"packageManager": "pnpm@10.33.0"`. Using `npm run` in a pnpm-managed project works locally only because npm falls back to the lockfile's resolved packages — but it bypasses pnpm's strict linker, can produce different resolution on fresh machines, and breaks if `npm` is not installed alongside `pnpm`.

**Fix:**

```json
"beforeDevCommand": "pnpm dev",
"beforeBuildCommand": "pnpm build"
```

---

### WR-03: Entitlements.plist grants three overly-broad hardened-runtime exceptions simultaneously

**File:** `src-tauri/Entitlements.plist:8-13`

**Issue:** Three entitlements are enabled together:

```xml
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
```

`allow-unsigned-executable-memory` alone disables the W^X memory protection and is the broadest of the three. `allow-dyld-environment-variables` permits `DYLD_INSERT_LIBRARIES` injection into the process — a common vector for code injection attacks. Together they substantially weaken the hardened-runtime guarantees that Apple requires for notarisation. The app's declared runtime needs are HTTP + AMQP + file I/O; none of these require JIT, arbitrary executable memory, or DYLD override.

**Fix:** Justify each entitlement against an actual runtime requirement. Tauri's WKWebView requires `allow-jit` on Intel macOS for the JavaScript engine — keep that one. Remove `allow-unsigned-executable-memory` and `allow-dyld-environment-variables` unless a concrete dependency is identified that requires them.

---

### WR-04: CI does not run TypeScript type-checking or frontend build

**File:** `.github/workflows/ci.yml`

**Issue:** `ci.yml` runs `pnpm test` (Vitest unit tests) and `cargo test` + `cargo clippy`, but never runs `tsc` or `pnpm build`. The project's build script is `"build": "tsc && vite build"` — TypeScript type errors and Vite configuration failures pass CI silently. A broken frontend can be merged to `main` with a green check.

**Fix:** Add a type-check step before or after the test step:

```yaml
- name: Type-check frontend
  run: pnpm build
```

Or separately:

```yaml
- name: Type-check frontend
  run: npx tsc --noEmit
```

---

### WR-05: CI installs coverage tool but never runs it

**File:** `.github/workflows/ci.yml`, `package.json:51`

**Issue:** `@vitest/coverage-v8` is installed as a dev dependency (`package.json:51`), but neither `ci.yml` nor any script runs `vitest run --coverage`. The project's global rules require 80% minimum coverage. Coverage is installed but never enforced.

**Fix:** Add a coverage step to `ci.yml`:

```yaml
- name: Run frontend tests with coverage
  run: pnpm exec vitest run --coverage --coverage.thresholds.lines=80
```

Or add a `test:coverage` script to `package.json` and call it from CI.

---

## Info

### IN-01: Placeholder author in Cargo.toml

**File:** `src-tauri/Cargo.toml:5`

**Issue:** `authors = ["you"]` is the default placeholder from `cargo new`. This field appears in `cargo metadata` output, crate manifests, and any generated documentation.

**Fix:** Replace with the actual author or team name, or remove the field if it is not needed for this private crate.

---

### IN-02: tauri-apps/tauri-action uses floating major tag @v0

**File:** `.github/workflows/release.yml:66, 122`

**Issue:** `tauri-apps/tauri-action@v0` pins to the latest patch under the v0 major. Any backward-incompatible change pushed to `v0` would silently break both release builds. This is an accepted trade-off for actions under active development, but is worth noting since the release workflow is security-sensitive (it produces signed distributable binaries).

**Fix:** When the workflow is stable, pin to a specific commit SHA or a minor tag (e.g., `tauri-apps/tauri-action@v0.5.17`) to prevent unexpected breakage.

---

_Reviewed: 2026-05-21T21:02:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
