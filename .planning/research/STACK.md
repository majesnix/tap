# Stack Research — Distribution (v1.5)

**Project:** Tap v1.5
**Researched:** 2026-05-21
**Focus:** GitHub Actions build pipeline, macOS signing + notarization, Linux packages, tauri-plugin-updater

---

## New Dependencies

### Rust (Cargo.toml additions)

| Crate | Version | Purpose | Target | Confidence |
|-------|---------|---------|--------|------------|
| `tauri-plugin-updater` | `"2"` (resolves to 2.10.1) | In-app update check, download, install | `cfg(not(android, ios))` | HIGH — crates.io confirmed 2.10.1 |
| `tauri-plugin-process` | `"2"` | `relaunch()` after update installs | `cfg(not(android, ios))` | HIGH — required by updater flow |

**Cargo.toml placement** — use desktop-only target to avoid mobile compile errors:

```toml
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

### JavaScript / npm

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `@tauri-apps/plugin-updater` | `^2.10.0` | JS bindings for update check/install | HIGH — npm confirmed 2.10.1 |
| `@tauri-apps/plugin-process` | `^2` | JS `relaunch()` call post-install | HIGH — official Tauri plugin |

**Version sync rule:** the npm package major.minor must match the Rust crate major.minor. Both are currently 2.10.x; pin the npm package to `^2.10.0` to avoid accidental minor drift during `pnpm update`.

---

## GitHub Actions Setup

### What Needs to Change in `release.yml`

The existing `release.yml` has the right skeleton (matrix split, tauri-action@v0, tag trigger) but is missing:

1. **`macos-13` is dead** — deprecated September 2025, fully unsupported December 2025. Replace with `macos-latest` (now macOS 15, ARM). For a universal binary build the runner must be ARM; `--target universal-apple-darwin` compiles both slices on the same runner.
2. **No signing/notarization env vars wired** — the macOS job has zero `APPLE_*` secrets.
3. **No updater signing env vars** — `TAURI_SIGNING_PRIVATE_KEY` is absent from both jobs.
4. **Separate create-release job** — currently correct but needs `latest.json` in the upload glob so the updater endpoint works.
5. **Missing Rust cache** — the macOS job has no `swatinem/rust-cache@v2` step; cold Rust builds on macOS take 15–20 min. Add it.
6. **`actions/checkout@v6`, `setup-node@v6`, `download-artifact@v8`** — these action versions do not exist at time of writing (latest are v4/v4/v4). The workflow will fail on checkout. Use v4 for all three.

### Revised Workflow Structure

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest           # macOS 15 ARM; supports universal-apple-darwin
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust (stable)
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Cache Rust build artifacts
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm

      - name: Install frontend dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and release (macOS universal)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: "Tap v__VERSION__"
          releaseBody: "See the assets below to download and install."
          releaseDraft: true
          prerelease: ${{ contains(github.ref_name, '-') }}
          args: --target universal-apple-darwin

  build-linux:
    runs-on: ubuntu-22.04           # 22.04 required — libwebkit2gtk-4.1-dev is in its repos
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            build-essential \
            libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            patchelf \
            file

      - name: Install Rust (stable)
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust build artifacts
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm

      - name: Install frontend dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and release (Linux x86_64)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: "Tap v__VERSION__"
          releaseDraft: true
          prerelease: ${{ contains(github.ref_name, '-') }}
```

### Why `tauri-action@v0` handles the release

`tauri-action@v0` (latest release 0.6.2, March 2026) both builds the app **and** creates/uploads to a GitHub Release when `tagName` is set. With `createUpdaterArtifacts: true` in `tauri.conf.json`, it also uploads `latest.json` (per-platform) automatically (`uploadUpdaterJson: true` is the default). The separate `create-release` job in the existing workflow is then redundant and should be removed — two jobs racing to create the same release causes non-deterministic failures.

**Do not set `releaseDraft: false` initially** — keep as `true` so you can verify artifacts before publishing.

### Required GitHub Secrets

All must be set in **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | How to obtain |
|--------|---------------|
| `APPLE_CERTIFICATE` | Export Developer ID Application cert as `.p12` from Keychain Access; `base64 -i cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Run `security find-identity -v -p codesigning`; copy the full string e.g. `Developer ID Application: Jane Smith (TEAMID)` |
| `APPLE_ID` | Apple Developer account email |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com (not primary password) |
| `APPLE_TEAM_ID` | 10-char team ID from developer.apple.com/account/membership |
| `TAURI_SIGNING_PRIVATE_KEY` | Run `npm run tauri signer generate -- -w ~/.tauri/tap.key`; store the private key file content |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password chosen during key generation (can be empty string) |

`GITHUB_TOKEN` is auto-injected by GitHub Actions — no setup needed, but the job needs `permissions: contents: write`.

### Notarization method choice

Both Apple ID (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) and App Store Connect API (`APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`) work. The table above uses Apple ID because it requires no separate API key file management. If rotating credentials is a concern, the App Store Connect API method is more robust (key never expires), but adds the `APPLE_API_KEY_PATH` setup complexity in CI.

---

## Tauri Config Changes

### 1. `tauri.conf.json` — bundle section

Add `createUpdaterArtifacts`, updater plugin config, and macOS signing settings:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "createUpdaterArtifacts": true,
    "macOS": {
      "entitlements": "./Entitlements.plist",
      "hardenedRuntime": true,
      "minimumSystemVersion": "11.0"
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "<CONTENT_OF_PUBLICKEY.PEM>",
      "endpoints": [
        "https://github.com/YOUR_ORG/YOUR_REPO/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Notes:**
- `signingIdentity` is intentionally **omitted from the config file** — set it only via `APPLE_SIGNING_IDENTITY` env var in CI. This keeps the repo clean (no developer-specific string in source).
- `hardenedRuntime: true` — confirmed key in official Tauri docs (`bundle.macOS.hardenedRuntime`). Required for notarization with Developer ID.
- `minimumSystemVersion: "11.0"` — recommended; macOS 11 is the practical baseline for Tauri 2. The Tauri default is `"10.13"` but macOS 10.x is out of Apple security support and WKWebView compatibility is uncertain.
- `pubkey` — the public key content from `tap.key.pub`. Safe to commit; the private key must never be committed.
- `endpoints` — `tauri-action` uploads `latest.json` to GitHub Releases automatically; this URL pattern works without a separate update server.

### 2. `Entitlements.plist` — MUST REPLACE EXISTING FILE

**The current `Entitlements.plist` will fail notarization.** It contains:

```xml
<key>com.apple.security.temporary-exception.files.absolute-path.read-write</key>
```

This is an App Sandbox temporary exception. With Hardened Runtime + Developer ID distribution (no sandbox), it is invalid and Apple's notarization service will reject it.

**Replace the entire file** with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
</dict>
</plist>
```

**Why these three:** Tauri's embedded WKWebView requires JIT compilation and unsigned executable memory to function under Hardened Runtime. `allow-dyld-environment-variables` is required for WebView dylib loading. All three are standard Hardened Runtime exceptions documented for WebView-based apps. Confidence: HIGH — confirmed by two independent community guides and cross-referenced against Apple's Hardened Runtime entitlement documentation.

**Why no `keychain-access-groups`:** The app uses `apple-native-keyring-store` with `features = ["keychain"]` (not `protected`). On macOS with a Developer ID certificate and no provisioning profile, the traditional file-based keychain is used. Apple's developer forums explicitly state that error -34018 (`errSecMissingEntitlement`) only applies when using the data protection keychain, which requires a provisioning profile. Developer ID apps use the file-based keychain and need no `keychain-access-groups` entitlement. Confidence: MEDIUM — Apple developer forum post confirmed the distinction, but no official Apple documentation page addresses this combination explicitly.

**Why no `com.apple.security.app-sandbox`:** The app is a developer tool requiring broad filesystem access (loading arbitrary `.proto` files). Sandboxing would break this. Developer ID distribution does not require the App Store sandbox.

### 3. `capabilities/default.json` — add updater permissions

Add to the existing permissions array:

```json
"updater:default",
"process:default"
```

`updater:default` includes `allow-check`, `allow-download`, `allow-install`, `allow-download-and-install`. `process:default` enables `relaunch()` after install.

### 4. `src-tauri/src/lib.rs` — register new plugins

Add after existing plugin registrations:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

Or with the desktop guard pattern:

```rust
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
```

### 5. Updater key generation (one-time, run locally)

```bash
npm run tauri signer generate -- -w ~/.tauri/tap.key
```

Outputs:
- `~/.tauri/tap.key` — private key → store as `TAURI_SIGNING_PRIVATE_KEY` in GitHub Secrets AND in a team password vault
- `~/.tauri/tap.key.pub` — public key → paste content into `tauri.conf.json` `plugins.updater.pubkey`

**Critical:** losing the private key means existing installed users can never receive auto-updates. They would need to manually reinstall.

### 6. `Info.plist` — no changes needed

Tauri auto-generates `Info.plist` from `tauri.conf.json`. No custom `Info.plist` is required for this milestone.

---

## What NOT to Add

| Rejected Approach | Reason |
|------------------|--------|
| Custom `latest.json` generation script | `tauri-action@v0` generates and uploads it automatically when `createUpdaterArtifacts: true`; adding a custom step creates duplication and drift risk |
| `softprops/action-gh-release` in release workflow | `tauri-action` already creates the GitHub Release; the existing separate `create-release` job races and conflicts — remove it |
| `tauri-plugin-sparkle-updater` | Sparkle is macOS-only; this app targets Linux too; `tauri-plugin-updater` is cross-platform |
| App Store signing / provisioning profiles | App is distributed outside the App Store; Developer ID Application cert is the correct certificate type |
| `com.apple.security.app-sandbox: true` | Developer ID distribution doesn't require sandbox; enabling it would break loading `.proto` files from arbitrary paths |
| `com.apple.security.temporary-exception.*` | Invalid under Hardened Runtime without the sandbox; notarization will reject it — this is in the current file and must be removed |
| Windows build job | Not in v1.5 scope; adding without a Windows code signing strategy produces SmartScreen-blocked unsigned binaries |
| `macos-13` runner | Deprecated and fully unsupported since December 2025; `macos-latest` (macOS 15) is the replacement |
| `actions/checkout@v6` / `setup-node@v6` / `download-artifact@v8` | These version tags do not exist; latest stable is v4 for all three |
| `KEYCHAIN_PASSWORD` secret | Only needed if unlocking a CI keychain manually; `tauri-action` handles the macOS keychain import automatically using `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` |

---

## Version Constraint Notes

| Item | Version | Notes |
|------|---------|-------|
| `tauri-plugin-updater` (Rust) | `2.10.1` | Keep in sync with npm package |
| `@tauri-apps/plugin-updater` (npm) | `2.10.1` | Keep in sync with Rust crate |
| `tauri-plugin-process` (Rust) | `2.x` | Check crates.io for current |
| `tauri-action` (GHA) | `v0` (latest release 0.6.2, 2026-03-14) | `v0` is the semver-pinned tag; do not use `@main` |
| macOS runner | `macos-latest` (macOS 15 ARM as of 2025-09) | `macos-13` is dead |
| Ubuntu runner | `ubuntu-22.04` | 22.04 specifically — `libwebkit2gtk-4.1-dev` was removed from Ubuntu 24.04 repos |

---

## Sources

- tauri-plugin-updater crate: https://crates.io/crates/tauri-plugin-updater (confirmed 2.10.1)
- Tauri updater plugin docs: https://v2.tauri.app/plugin/updater/ (Context7 verified)
- Tauri GitHub Actions pipeline: https://v2.tauri.app/distribute/pipelines/github/ (official)
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/ (official)
- tauri.conf.json macOS bundle reference (hardenedRuntime key confirmed): https://v2.tauri.app/reference/config/ (Context7 verified)
- tauri-action GitHub repo: https://github.com/tauri-apps/tauri-action
- macos-13 deprecation announcement: https://github.blog/changelog/2025-09-19-github-actions-macos-13-runner-image-is-closing-down/
- apple-native-keyring-store keychain vs protected modules: https://github.com/open-source-cooperative/apple-native-keyring-store
- macOS Developer ID + traditional keychain, no entitlement required: https://developer.apple.com/forums/thread/114456
- Community walkthrough Tauri v2 signing: https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n
- Community walkthrough Tauri v2 release automation: https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7
