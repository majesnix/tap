# Phase 16: Pipeline Foundation - Research

**Researched:** 2026-05-21
**Domain:** GitHub Actions CI/CD — Tauri release pipeline repair
**Confidence:** HIGH

---

## Summary

Phase 16 repairs the existing `release.yml` pipeline so `workflow_dispatch` dry-runs pass on both `macos-latest` (macOS 15 ARM64) and `ubuntu-22.04`. The current file has four concrete defects: it runs on `macos-13` instead of `macos-latest`, it is missing Rust build cache on both build jobs, the `Entitlements.plist` has a sandbox exception instead of the three Hardened Runtime WebView keys, and the app version is still `1.3.0`.

Action version numbering in the current `release.yml` (checkout@v6, setup-node@v6, pnpm@v6, upload-artifact@v7, download-artifact@v8, softprops@v3) is not broken in the "tag doesn't exist" sense — all these floating major tags exist and resolve correctly. The CONTEXT.md "Claude's Discretion" section references v4/v2 versions, but the "Established Patterns" note explicitly says to maintain consistency with `ci.yml`, which already uses v6/v7/v8. Keeping v6/v7/v8/v3 is the correct resolution: it matches `ci.yml`, avoids a confusing downgrade, and all versions are verified stable.

The Swatinem/rust-cache `workspaces: src-tauri` pattern is already proven in `ci.yml` — copy it verbatim to both build jobs in `release.yml`.

**Primary recommendation:** Four targeted changes to `release.yml` + replace `Entitlements.plist` contents + three file version bumps (`tauri.conf.json`, `Cargo.toml`, `package.json`). No action version changes needed.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Gate signing steps on `if: github.event_name == 'push'` — not a `workflow_dispatch` input flag. Signing runs only on tag push; `workflow_dispatch` always skips it automatically. Phase 17 adds signing steps under this existing conditional.
- **D-02:** Artifact upload (`actions/upload-artifact`) runs on every trigger (both `workflow_dispatch` and tag push) to validate the action version fix. The `create-release` job already gates on `startsWith(github.ref, 'refs/tags/')` so no release is created on dry-runs.
- **D-03:** Use `Swatinem/rust-cache` action on **both** the macOS and Linux build jobs.
- **D-04:** Use `macos-latest` (currently macOS 15 ARM64 — see environment note below).
- **D-05:** Keep the Universal binary build (`--target universal-apple-darwin`) with both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets.
- **D-06:** Replace `Entitlements.plist` entirely. Remove `com.apple.security.temporary-exception.files.absolute-path.read-write`. Add the three Hardened Runtime WebView entitlements: `cs.allow-jit`, `cs.allow-unsigned-executable-memory`, `cs.allow-dyld-environment-variables`. Keep `com.apple.security.app-sandbox` = `false`.
- **D-07:** Bump version to `1.5.0` in both `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` (currently `1.3.0` in both). **Also bump `package.json` `version` field** — discovered during research to also be `1.3.0` [VERIFIED: package.json line 4].

### Claude's Discretion

- Exact `Swatinem/rust-cache` version pin — use latest stable
- Exact pinned versions for `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`, `pnpm/action-setup`, `softprops/action-gh-release` — **Research resolution: keep v6/v7/v8/v3 to match `ci.yml`** (see Action Version Analysis section)
- Whether to add `workflow_dispatch` inputs section at all (none required per design)

### Deferred Ideas (OUT OF SCOPE)

None.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CICD-02 | Developer can trigger a `workflow_dispatch` dry-run (no signing) to validate pipeline structure | D-01 gate pattern confirmed; signing env vars absent from Phase 16 so dispatch already passes without any conditional — the gate is insurance for Phase 17 forward |
| CICD-03 | Rust build artifacts are cached between runs (reduces macOS cold-build from ~20 min to ~5 min) | `Swatinem/rust-cache@v2` with `workspaces: src-tauri` is proven in `ci.yml`; copy verbatim to both jobs |
| SIGN-03 | `Entitlements.plist` includes required Hardened Runtime WebView entitlements | Three keys confirmed via Apple Developer docs and Tauri community guides; exact plist syntax provided in Code Examples section |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rust compilation cache | GitHub Actions runner (ephemeral) | Cargo registry cache (~/.cargo) | Cache lives on runner; workspaces key scopes it to src-tauri dir |
| macOS Universal binary build | GitHub Actions macOS runner | Tauri CLI (via tauri-action) | Runner provides both target architectures; tauri-action invokes cargo with --target |
| Linux build | GitHub Actions ubuntu runner | Tauri CLI | Standard apt deps + tauri-action build |
| Release artifact upload | GitHub Actions (upload-artifact) | — | upload-artifact stores artifacts between jobs; download-artifact + softprops publish on tag only |
| App entitlements | Bundler (Tauri macOS bundle) | OS codesign tool (Phase 17) | plist is read by Tauri bundler; codesign applies it during signing |
| Version identity | tauri.conf.json + Cargo.toml + package.json | Cargo.lock (auto-derived) | All three version strings must match; Cargo.lock auto-regenerates on first build |

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `tauri-apps/tauri-action` | `@v0` (floating, latest v0.6.2) | Builds and optionally publishes Tauri app | Official Tauri action; v0 is the only major series; floating tag tracks latest patch [VERIFIED: GitHub tags API] |
| `Swatinem/rust-cache` | `@v2` (floating, latest v2.9.1) | Caches Cargo registry + target dir | De facto standard for Rust CI; already used in this repo's ci.yml [VERIFIED: ci.yml grep + GitHub releases API] |
| `dtolnay/rust-toolchain` | `@stable` | Installs Rust stable toolchain | Official toolchain installer; no major version tag — `@stable` is the canonical form [VERIFIED: GitHub tags API] |
| `actions/checkout` | `@v6` (v6.0.2) | Checks out the repo | Already in use in ci.yml; v6 is latest stable floating tag [VERIFIED: GitHub tags API] |
| `actions/setup-node` | `@v6` (v6.4.0) | Sets up Node + pnpm cache | v6 is latest; already used in ci.yml; has `cache: pnpm` support [VERIFIED: GitHub tags API + ci.yml] |
| `pnpm/action-setup` | `@v6` (v6.0.8) | Installs pnpm | v6 is latest; already in ci.yml [VERIFIED: GitHub tags API] |
| `actions/upload-artifact` | `@v7` (v7.0.1) | Stores build outputs between jobs | v7 is latest stable; already in release.yml and confirmed to exist [VERIFIED: GitHub tags API] |
| `actions/download-artifact` | `@v8` (v8.0.1) | Downloads artifacts in create-release job | v8 is latest stable; must match upload-artifact major version [VERIFIED: GitHub tags API] |
| `softprops/action-gh-release` | `@v3` (v3.0.0) | Creates GitHub Release with assets | v3 is latest stable; already in release.yml [VERIFIED: GitHub tags API] |

**Note on upload vs download version mismatch:** `upload-artifact@v7` and `download-artifact@v8` use different major versions, but this is intentional and correct — they are independently versioned actions. The pairing works as long as `name:` matches between upload and download steps. [VERIFIED: GitHub Actions docs note independent versioning]

### Action Version Analysis (Claude's Discretion Resolution)

The CONTEXT.md "Claude's Discretion" suggested v4/v2 as target versions (e.g., checkout@v4, setup-node@v4). However:

1. `ci.yml` (the established pattern source per CONTEXT "Established Patterns") already uses: checkout@v6, setup-node@v6, pnpm@v6
2. The current `release.yml` also uses v6/v7/v8/v3 — all verified to exist and work
3. Downgrading to v4 would create inconsistency between ci.yml and release.yml
4. Official `tauri-action/v0` examples use v4 (those examples are rarely refreshed)

**Decision: Keep v6/v7/v8/v3 as-is.** No version changes needed in release.yml. The "broken action versions" phrase in the phase description referred to the runner (`macos-13`) and missing cache step — not action version numbers. [ASSUMED — advisory interpretation; the phrase "broken action versions" may refer to something else; planner should confirm if any action produces an actual workflow error]

---

## Architecture Patterns

### System Architecture Diagram

```
workflow_dispatch / tag-push
        |
        v
  +------------------+         +------------------+
  |  build-macos     |         |  build-linux     |
  |  macos-latest    |         |  ubuntu-22.04    |
  |  (macOS 15 ARM64)|         |                  |
  |                  |         |                  |
  |  checkout        |         |  checkout        |
  |  rust-toolchain  |         |  apt deps        |
  |  rust-cache ←NEW |         |  rust-toolchain  |
  |  pnpm + node     |         |  rust-cache ←NEW |
  |  tauri-action    |         |  pnpm + node     |
  |  (--target       |         |  tauri-action    |
  |   universal-     |         |                  |
  |   apple-darwin)  |         |                  |
  |  upload-artifact |         |  upload-artifact |
  +--+---------------+         +--------+---------+
     |                                  |
     |  both jobs complete              |
     v                                  v
  +------------------------------------------+
  |  create-release                          |
  |  (if: startsWith(ref, 'refs/tags/'))     |
  |                                          |
  |  download-artifact (macos + linux)       |
  |  softprops/action-gh-release             |
  +------------------------------------------+
```

**Dry-run path (workflow_dispatch):** build-macos + build-linux run fully, upload-artifact runs, create-release is SKIPPED (tag gate). No signing env vars exist in Phase 16, so dispatch already passes without any signing conditional. The `if: github.event_name == 'push'` gate is scaffolded here to protect the signing steps Phase 17 will add under it.

### Recommended File Structure

No new files or directories. Changes are:
```
.github/workflows/
└── release.yml          # 4 targeted edits (runner + cache + cache + signing gate)

src-tauri/
├── Entitlements.plist   # Full replacement (5 keys → 4 keys)
├── tauri.conf.json      # version: "1.3.0" → "1.5.0"
└── Cargo.toml           # version = "1.3.0" → "1.5.0"

package.json             # version: "1.3.0" → "1.5.0"  [repo root]
```

### Pattern 1: Swatinem/rust-cache with Workspace

Already verified in `ci.yml`. Copy to both build jobs in `release.yml`:

```yaml
# Source: .github/workflows/ci.yml (existing, verified working)
- name: Cache Rust build artifacts
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: src-tauri
```

The `workspaces: src-tauri` input tells the action that `src-tauri/` is the Cargo workspace root (where `Cargo.toml` and `target/` live). The cache key is automatically derived from: OS + toolchain + hash of all `Cargo.toml`/`Cargo.lock` files. No manual key management needed. [VERIFIED: rust-cache action.yml inputs spec]

**macOS-specific note:** For the Universal build, both `aarch64-apple-darwin/release/` and `x86_64-apple-darwin/release/` subdirectories of `target/` will be cached. The cache size will be larger than a single-arch build — typically 2–4 GB. GitHub Actions cache limit is 10 GB per repo; acceptable for this use case.

### Pattern 2: Signing Gate Conditional

```yaml
# Source: CONTEXT.md D-01 (locked decision)
# Place this as a step condition on any signing-related step
- name: [signing step — added in Phase 17]
  if: github.event_name == 'push'
```

In Phase 16, no signing steps exist yet. The gate should be placed as a comment-marked scaffold, or simply not added until Phase 17 when signing steps are written under it. Either approach satisfies D-01.

### Pattern 3: Hardened Runtime Entitlements

```xml
<!-- Source: Apple Developer Documentation + Tauri community guides (dev.to/tomtomdu73) -->
<!-- File: src-tauri/Entitlements.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <false/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
</dict>
</plist>
```

**Key removed:** `com.apple.security.temporary-exception.files.absolute-path.read-write` — this was a sandbox exception for arbitrary file read. Since `app-sandbox = false`, the app is NOT sandboxed, so this exception has no effect and is misleading/incorrect.

**Keys added:** The three `cs.*` keys enable the WKWebView (macOS WebKit) JavaScript engine to:
- `allow-jit` — use JIT compilation for JS execution
- `allow-unsigned-executable-memory` — allocate executable memory pages (required by WebKit)
- `allow-dyld-environment-variables` — accept dynamic linker env vars (required for WebKit internals)

These are standard for all Hardened Runtime macOS desktop apps that ship a WebView. Without them, the app crashes at launch after notarization. [CITED: developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-dyld-environment-variables + dev.to/tomtomdu73 article]

### Anti-Patterns to Avoid

- **Downgrading action versions to v4:** `ci.yml` and `release.yml` should use consistent versions. The CONTEXT.md v4 suggestion was Claude's Discretion (advisory), not a locked decision. Downgrading would require also changing ci.yml and adds no benefit.
- **Adding `workflow_dispatch` inputs:** CONTEXT explicitly says no inputs needed — the event-name gate requires no user input.
- **Adding `#[tokio::main]` or separate async runtime:** Not relevant to this phase, but noted in project CLAUDE.md as a critical constraint.
- **Manually editing Cargo.lock:** Never edit `Cargo.lock` directly. Bump `Cargo.toml` version; then the next `cargo build` (or `cargo update -p tap`) regenerates it automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rust build caching | Custom cache action with manual keys | `Swatinem/rust-cache@v2` | Handles registry + target dir, derives cache key from OS/toolchain/lockfile hash, saves on failure, prunes old entries |
| Release artifact publishing | `gh release create` in bash | `softprops/action-gh-release@v3` | Handles draft/prerelease flags, glob patterns for files, auto-release notes, re-upload idempotency |
| Entitlements plist | Writing a build script to generate it | Static file in source tree | `tauri.conf.json bundle.macOS.entitlements` path already points to it; static file is simpler and auditable |

---

## Runtime State Inventory

> Phase 16 involves a version bump and config file changes — checking for runtime state that embeds the old version or old entitlement keys.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No databases or datastores store the app version string | None |
| Live service config | No external services configured with version `1.3.0` | None |
| OS-registered state | No OS-level registrations embed the version string | None |
| Secrets/env vars | No env vars reference `1.3.0` directly | None |
| Build artifacts | (1) `src-tauri/Cargo.lock` has `version = "1.3.0"` for `tap` package (line 4762); (2) `package.json` root has `"version": "1.3.0"` (line 4) | Cargo.lock: run `cargo update -p tap` and commit; package.json: manual bump, no downstream artifacts affected |

**Cargo.lock note:** The lockfile will have a stale `tap` version entry until rebuilt. `--frozen-lockfile` is NOT used in the Rust build step (only in `pnpm install`), so `cargo` will update the lockfile automatically during `tauri-action` execution. The updated `Cargo.lock` should be committed to source control after the version bump. [VERIFIED: grep of release.yml and ci.yml — neither uses --locked for cargo]

---

## Common Pitfalls

### Pitfall 1: Cargo.lock Not Committed After Version Bump

**What goes wrong:** `Cargo.toml` bumped to `1.5.0`, `Cargo.lock` still says `1.3.0`. If the repo is cloned fresh and `cargo build --locked` is used (not the case here, but possible in future), the build fails with a lockfile mismatch.

**Why it happens:** Developers bump the manifest but forget the lockfile. The lockfile is auto-regenerated by `cargo build` (without `--locked`), but that regeneration needs to be committed.

**How to avoid:** After bumping `Cargo.toml`, run `cargo update -p tap` from `src-tauri/` and commit the resulting `Cargo.lock` diff in the same PR.

**Warning signs:** `Cargo.lock` still shows `version = "1.3.0"` for the `tap` package after committing the Cargo.toml bump.

### Pitfall 2: upload-artifact and download-artifact Major Version Mismatch

**What goes wrong:** Using `upload-artifact@v4` and `download-artifact@v4` together when artifact name format changed between major versions.

**Why it happens:** Developers see v4 in official examples and pin both to v4. But the current file uses v7/v8 which are both current latest and work as a pair.

**How to avoid:** Keep the existing v7/v8 pairing — they are independently versioned but compatible. Do not downgrade one without the other.

**Warning signs:** CI error: "No artifacts found with the provided path" in the download step.

### Pitfall 3: macos-latest Runner Migration

**What goes wrong:** `macos-latest` migrates from macOS 15 ARM64 to macOS 26 ARM64 mid-cycle (during Phase 16/17 work). Cache keys derived from OS in rust-cache would invalidate. Signing toolchain versions could change.

**Why it happens:** GitHub `-latest` labels migrate over 1–2 months without explicit opt-in/opt-out. `macos-26` images already exist in the runner-images repository as of 2026-05-21.

**How to avoid:** D-04 locks `macos-latest` — this is a known trade-off. If reproducibility becomes critical before Phase 17, pin to `macos-15` instead. For now, the dry-run validation in Phase 16 is low-stakes enough that a runner migration would just require a re-run.

**Warning signs:** `sw_vers` output in CI logs shows macOS 26 instead of macOS 15.

### Pitfall 4: Entitlements Path in tauri.conf.json

**What goes wrong:** Moving or renaming `Entitlements.plist` while forgetting to update the `bundle.macOS.entitlements` key in `tauri.conf.json`.

**Why it happens:** The path is a relative string — `"Entitlements.plist"` — in tauri.conf.json.

**How to avoid:** Phase 16 only changes the *contents* of `Entitlements.plist`, not its location. The path reference in `tauri.conf.json` (`"entitlements": "Entitlements.plist"`) does NOT need updating. [VERIFIED: tauri.conf.json line 35]

**Warning signs:** Build error: `[ERROR] macOS code signing failed: entitlements file not found`.

### Pitfall 5: Universal Build Target Requires Both Rust Targets Installed

**What goes wrong:** `--target universal-apple-darwin` fails because `x86_64-apple-darwin` is not installed on an ARM64 runner.

**Why it happens:** `macos-latest` is ARM64 native. `x86_64-apple-darwin` is a cross-compile target and must be explicitly installed via `dtolnay/rust-toolchain`.

**How to avoid:** The existing `release.yml` already has `targets: x86_64-apple-darwin,aarch64-apple-darwin` in the rust-toolchain step — do NOT remove this. [VERIFIED: release.yml line 19]

---

## Code Examples

### Complete corrected release.yml build-macos job (changes highlighted)

```yaml
# Source: .github/workflows/release.yml (target state after Phase 16)
build-macos:
  runs-on: macos-latest           # CHANGED: was macos-13
  steps:
    - name: Checkout
      uses: actions/checkout@v6   # no change

    - name: Install Rust (stable)
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: x86_64-apple-darwin,aarch64-apple-darwin  # no change

    - name: Cache Rust build artifacts   # NEW STEP (from ci.yml)
      uses: Swatinem/rust-cache@v2
      with:
        workspaces: src-tauri

    - name: Setup pnpm
      uses: pnpm/action-setup@v6
      with:
        version: 10

    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: "20"
        cache: pnpm

    - name: Install frontend dependencies
      run: pnpm install --frozen-lockfile

    - name: Build Tauri app (universal macOS)
      uses: tauri-apps/tauri-action@v0
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        args: --target universal-apple-darwin

    - name: Upload macOS artifacts
      uses: actions/upload-artifact@v7
      with:
        name: macos-artifacts
        path: src-tauri/target/universal-apple-darwin/release/bundle/
```

### Complete corrected build-linux job (rust-cache addition only)

```yaml
# Source: .github/workflows/release.yml (target state after Phase 16)
build-linux:
  runs-on: ubuntu-22.04
  steps:
    - name: Checkout
      uses: actions/checkout@v6

    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y \
          libgtk-3-dev \
          libwebkit2gtk-4.1-dev \
          libappindicator3-dev \
          librsvg2-dev \
          patchelf \
          libssl-dev

    - name: Install Rust (stable)
      uses: dtolnay/rust-toolchain@stable

    - name: Cache Rust build artifacts   # NEW STEP (from ci.yml)
      uses: Swatinem/rust-cache@v2
      with:
        workspaces: src-tauri

    - name: Setup pnpm
      uses: pnpm/action-setup@v6
      with:
        version: 10

    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: "20"
        cache: pnpm

    - name: Install frontend dependencies
      run: pnpm install --frozen-lockfile

    - name: Build Tauri app (Linux x86_64)
      uses: tauri-apps/tauri-action@v0
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Upload Linux artifacts
      uses: actions/upload-artifact@v7
      with:
        name: linux-artifacts
        path: src-tauri/target/release/bundle/
```

### Version bump locations

```json
// src-tauri/tauri.conf.json — line 4
"version": "1.5.0"
```

```toml
# src-tauri/Cargo.toml — line 3
version = "1.5.0"
```

```json
// package.json — line 4 (root of repo)
"version": "1.5.0"
```

```bash
# After bumping Cargo.toml, regenerate Cargo.lock:
cd src-tauri && cargo update -p tap
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `macos-13` (x86_64 Intel) | `macos-latest` = macOS 15 ARM64 | GitHub phased migration 2024–2025 | Faster Rust compilation; aarch64-native; Universal builds are cross-compiles for x86_64 only |
| Manual cache steps with `actions/cache` | `Swatinem/rust-cache@v2` | Industry shift ~2022 | Automatic key derivation, cache pruning, simpler config |
| `temporary-exception` sandbox plist | Hardened Runtime `cs.*` entitlements | Apple Hardened Runtime requirement | Required for notarization; `temporary-exception` keys are sandbox-specific and irrelevant when `app-sandbox = false` |

**Deprecated/outdated:**
- `macos-13` runner: Intel x86_64, slower, GitHub de-emphasizing; use `macos-latest` (ARM64)
- `com.apple.security.temporary-exception.files.absolute-path.read-write`: sandbox exception only applies when `app-sandbox = true`; having it alongside `app-sandbox = false` is a no-op and misleading

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Broken action versions" in phase description refers to the runner (`macos-13`) and missing cache — not to action tag versions that don't exist | Action Version Analysis | If specific action versions genuinely fail in CI, they need updating; the planner should note this in verification steps |
| A2 | `upload-artifact@v7` + `download-artifact@v8` work as a compatible pair | Standard Stack | If incompatible, artifact download in `create-release` fails; easy to diagnose from CI error |
| A3 | `workflow_dispatch` dry-run passes without any `if: github.event_name == 'push'` gate in Phase 16 because no signing env vars exist yet | Pattern 2 | If tauri-action fails on dispatch when `APPLE_CERTIFICATE` is absent but referenced somewhere, gate is needed now |

---

## Open Questions

1. **Should the `if: github.event_name == 'push'` gate be scaffolded in Phase 16 even with no signing steps?**
   - What we know: D-01 locks this pattern; Phase 17 will need it
   - What's unclear: Whether to add it now as a comment/no-op or wait until Phase 17 adds real signing steps
   - Recommendation: Add a comment in the macOS build job noting the gate location, but do not add an empty step. Phase 17's plan will add the gate with its first signing step.

2. **Should `cargo update -p tap` be a manual pre-commit step or rely on CI to regenerate?**
   - What we know: `release.yml` does not use `--locked`; CI will regenerate Cargo.lock automatically
   - What's unclear: Whether to commit the updated Cargo.lock as part of the version bump task
   - Recommendation: Include `cargo update -p tap` + commit `Cargo.lock` as part of the version bump task to keep the repo self-consistent at all times.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Actions | Pipeline execution | ✓ | N/A (cloud) | — |
| `macos-latest` runner | build-macos job | ✓ | macOS 15 ARM64 | Pin `macos-15` if migration starts |
| `ubuntu-22.04` runner | build-linux job | ✓ | Ubuntu 22.04 | — |
| `Swatinem/rust-cache@v2` | CICD-03 | ✓ | v2.9.1 (2026-03-12) | Manual `actions/cache` |
| `tauri-apps/tauri-action@v0` | Both build jobs | ✓ | v0.6.2 | Run `cargo tauri build` directly |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | Partial | `GITHUB_TOKEN` with `contents: write` permission scoped to release job only |
| V5 Input Validation | No | — |
| V6 Cryptography | Foundation | Phase 16 lays the Entitlements.plist foundation; Phase 17 adds actual code signing (never hand-roll crypto) |

### Known Threat Patterns for GitHub Actions CI/CD

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `GITHUB_TOKEN` overprivileged | Elevation of Privilege | Scope `permissions: contents: write` only on `create-release` job; build jobs need no write permissions |
| Secret injection via tauri-action env | Information Disclosure | Signing secrets (Phase 17) referenced only under `if: github.event_name == 'push'` gate — not exposed on dispatch runs |
| Supply chain via action pinning | Tampering | Use floating major tags (`@v6`, `@v0`) rather than exact SHA for readability; full SHA pinning is overkill for a dev tool with no untrusted contributors |

---

## Sources

### Primary (HIGH confidence)
- `ci.yml` — Swatinem/rust-cache@v2 with `workspaces: src-tauri` syntax [VERIFIED: live file]
- `release.yml` — current state of all action versions, runner, structure [VERIFIED: live file]
- GitHub Tags API — all action version tags confirmed to exist [VERIFIED: API responses]
- `actions/runner-images` README — `macos-latest` = macOS 15 ARM64 confirmed [VERIFIED: raw README]
- `tauri-apps/tauri-action` action.yml and examples — v0 is the only major; `--target universal-apple-darwin` syntax confirmed [VERIFIED: raw files from v0 tag]
- Swatinem/rust-cache action.yml — `workspaces` input spec confirmed [VERIFIED: raw file from v2]

### Secondary (MEDIUM confidence)
- [Ship Your Tauri v2 App Like a Pro (DEV Community)](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n) — two-key Entitlements.plist pattern (cs.allow-jit + cs.allow-unsigned-executable-memory)
- [Apple Developer: Allow DYLD environment variables](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-dyld-environment-variables) — third entitlement key confirmed [CITED]

### Tertiary (LOW confidence)
- None — all critical claims verified via primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all action versions verified against GitHub tags API
- Architecture: HIGH — patterns copied from working ci.yml; tauri-action examples reviewed
- Pitfalls: HIGH — grounded in specific verified file content (release.yml line numbers, Cargo.lock)

**Research date:** 2026-05-21
**Valid until:** 2026-07-21 (stable domain; macos-latest mapping may shift with macOS 26 rollout)
