# Phase 18: Auto-Update + Linux + Docs — Research

**Researched:** 2026-05-22
**Domain:** Tauri 2 auto-update, Linux AppImage packaging, GitHub Actions signing pipeline, user-facing notification UI
**Confidence:** HIGH

---

## Summary

Phase 18 activates Tauri's built-in update mechanism (tauri-plugin-updater v2), ensures the Linux AppImage is built and signed on `ubuntu-22.04`, and adds a non-modal toast notification on startup when a new version is available.

The primary gap is not new libraries — it is **missing wiring in three existing artifacts**: (1) `tauri.conf.json` lacks `bundle.createUpdaterArtifacts: true` and the `plugins.updater` block, (2) `src-tauri/Cargo.toml` and `src/lib.rs` lack the two new plugins, and (3) the Linux CI job (`build-linux`) lacks the `TAURI_SIGNING_PRIVATE_KEY` env var. The macOS job already has signing wired correctly (Apple Developer certificate); Linux has none. Without `.sig` files, `tauri-action` silently skips populating `latest.json` with the `linux-x86_64` entry, so Linux users receive no updates even if AppImage is distributed.

The `build-windows` job must be **deleted** — Windows distribution is out of scope in v1.5 per REQUIREMENTS.md.

**Primary recommendation:** Wire `createUpdaterArtifacts`, add signing env vars to the Linux CI job, register the two plugins in Rust and JS, add capability permissions, write a startup `useEffect` that calls `check()` and presents a Sonner toast.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | Build AppImage on ubuntu-22.04 runner | `build-linux` job already targets ubuntu-22.04; existing apt deps cover AppImage; no runner change needed |
| UPD-01 | Generate Ed25519 signing keypair; public key in tauri.conf.json, private key in GitHub secret | `pnpm tauri signer generate` creates `.key` / `.key.pub`; pubkey goes into `plugins.updater.pubkey`; GitHub secret `TAURI_SIGNING_PRIVATE_KEY` |
| UPD-02 | Non-modal update notification on app startup | Sonner `<Toaster>` already mounted in `src/App.tsx`; startup `useEffect([])` pattern; `@tauri-apps/plugin-updater` JS API |
| UPD-03 | Download, install, and relaunch | `update.downloadAndInstall()` then `relaunch()` from `@tauri-apps/plugin-process`; `process:allow-restart` capability permission required |
| UPD-04 | latest.json uploaded to GitHub release assets | `tauri-action@v0` generates and uploads `latest.json` via `upload-version-json.ts` when `bundle.createUpdaterArtifacts: true` and `.sig` files exist |
| DOC-01 | docs/linux-keychain.md explaining libsecret runtime requirement | Document `gnome-keyring` / `kwallet` runtime deps and `dbus-secret-service-keyring-store` dependency |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Update availability check | Frontend (React startup) | Rust (Tauri command via plugin) | `@tauri-apps/plugin-updater` JS API calls into Rust plugin; JS side drives the UX flow |
| Download + install | Rust (tauri-plugin-updater) | — | Binary download and signature verification happen in Rust; JS calls `downloadAndInstall()` |
| App relaunch | Rust (tauri-plugin-process) | — | OS-level process restart must happen in Rust; JS calls `relaunch()` |
| Update notification UI | Frontend (React, Sonner) | — | Non-modal toast lives entirely in the frontend |
| Artifact signing | CI/CD (tauri-action) | Local (signer CLI for key gen) | Signing occurs at build time in GitHub Actions using `TAURI_SIGNING_PRIVATE_KEY` |
| latest.json aggregation | CI/CD (tauri-action) | — | `upload-version-json.ts` in tauri-action merges per-platform entries; not a runtime concern |
| Linux AppImage bundling | CI/CD (ubuntu-22.04 runner) | — | Platform-specific bundle; must build on Linux host |
| Linux keychain runtime | Rust (`dbus-secret-service-keyring-store`) | — | Already wired in Phase 16; documentation only for Phase 18 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-updater` | 2.10.1 | Auto-update check, download, signature verification | Official Tauri plugin; only supported updater mechanism |
| `tauri-plugin-process` | 2.3.1 | App relaunch after update install | Official Tauri plugin; required for cross-platform relaunch |
| `sonner` (JS) | already installed | Non-modal toast notification | Already wired in App.tsx; no new dependency |
| `@tauri-apps/plugin-updater` | 2.x | JS bindings for update check/install | Official JS binding for the Rust plugin |
| `@tauri-apps/plugin-process` | 2.x | JS binding for `relaunch()` | Official JS binding for the process plugin |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tauri signer` CLI | bundled with tauri-cli | Generate Ed25519 keypair for signing | One-time key generation; not a runtime dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-updater | custom HTTP update check | tauri-plugin-updater handles signature verification, platform detection, AppImage chmod fix — hand-rolling these is never correct |
| Sonner toast | Dialog/modal | Modal blocks the user; non-modal is the UX requirement (UPD-02) |

**Installation:**
```bash
# Rust (add to src-tauri/Cargo.toml)
cargo add tauri-plugin-updater --target-os=desktop
cargo add tauri-plugin-process --target-os=desktop

# JS
pnpm add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

**Version verification:** [VERIFIED: crates.io] tauri-plugin-updater 2.10.1 (published May 2025); tauri-plugin-process 2.3.1 (published 2025).

---

## Architecture Patterns

### System Architecture Diagram

```
App startup
    │
    ▼
useEffect([]) in App.tsx
    │
    ├─── invoke tauri-plugin-updater.check()
    │        │
    │        ├── HTTP GET https://github.com/majesnix/tap/releases/latest/download/latest.json
    │        │       └── compare latest.json version to current app version
    │        │
    │        ├── [no update] → return null → no UI change
    │        │
    │        └── [update available] → return UpdateInfo object
    │                │
    │                ▼
    │           toast("Update v{version} available", { action: "Install" })
    │                │
    │                └── [user clicks Install]
    │                        │
    │                        ▼
    │                  update.downloadAndInstall()
    │                        │
    │                        └── relaunch()  ← tauri-plugin-process
    │
    └─── CI/CD (GitHub Actions)
             │
             ├── build-macos (macOS universal, signed + notarized)
             │       └── tauri-action uploads: .dmg, .dmg.sig, .app.tar.gz, .app.tar.gz.sig
             │
             └── build-linux (ubuntu-22.04, Ed25519 signed)
                     └── tauri-action uploads: .AppImage, .AppImage.sig
                             │
                             └── tauri-action aggregates → latest.json
                                     platform keys: darwin-aarch64, darwin-x86_64, linux-x86_64
```

### Recommended Project Structure Changes

```
src-tauri/
├── tauri.conf.json          # Add bundle.createUpdaterArtifacts + plugins.updater
├── Cargo.toml               # Add tauri-plugin-updater + tauri-plugin-process (desktop only)
├── capabilities/
│   └── default.json         # Add updater:default, process:allow-restart
└── src/
    └── lib.rs               # Register updater + process plugins with #[cfg(desktop)] guards

src/
└── App.tsx                  # Add startup useEffect for update check + Sonner toast

docs/
└── linux-keychain.md        # New: explains libsecret runtime requirement (DOC-01)

.github/workflows/
└── release.yml              # Add TAURI_SIGNING_PRIVATE_KEY to Linux job; remove Windows job
```

### Pattern 1: Plugin Registration (Desktop-Only Guard)

**What:** Register updater and process plugins under `#[cfg(desktop)]` so mobile builds (if ever added) don't compile them.
**When to use:** Always — both plugins are desktop-only per Tauri docs.

```rust
// Source: https://v2.tauri.app/plugin/updater/
// src-tauri/src/lib.rs — add inside tauri::Builder::default() chain
#[cfg(desktop)]
{
    builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
}
```

Note: `lib.rs` currently uses a direct chain without a mutable `builder` variable. The implementation must adapt to the existing pattern (inline the two `.plugin()` calls into the chain, wrapped in `#[cfg(desktop)]`). Example adapted to the current style:

```rust
// Insert after .plugin(tauri_plugin_opener::init())
.plugin({
    #[cfg(desktop)]
    { tauri_plugin_updater::Builder::new().build() }
    #[cfg(not(desktop))]
    { tauri::plugin::TauriPlugin::default() } // placeholder not needed — use conditional compilation differently
})
```

Simpler approach that matches existing code style — use feature flags at the `.plugin()` call sites:

```rust
// This compiles fine: the cfg guards the whole plugin call
#[cfg(desktop)]
let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
#[cfg(desktop)]
let builder = builder.plugin(tauri_plugin_process::init());
```

**Actually**, reading `lib.rs` more carefully — it uses a builder chain, not mutable reassignment. The cleanest pattern for this codebase:

```rust
// Source: Context7 tauri-plugin-updater docs
tauri::Builder::default()
    // ... existing plugins ...
    .plugin(tauri_plugin_opener::init())
    // Add after existing plugins:
    .plugin(tauri_plugin_updater::Builder::new().build())  // desktop-only via Cargo target
    .plugin(tauri_plugin_process::init())                  // desktop-only via Cargo target
```

The desktop-only constraint is enforced via Cargo.toml target configuration (see Standard Stack installation), not via `#[cfg(desktop)]` in lib.rs.

### Pattern 2: Cargo.toml Desktop-Only Dependencies

```toml
# Source: https://v2.tauri.app/plugin/updater/
# Add to [dependencies] in src-tauri/Cargo.toml

[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

### Pattern 3: tauri.conf.json Additions

```json
// Source: https://v2.tauri.app/plugin/updater/
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": ["...existing icon list..."]
  },
  "plugins": {
    "updater": {
      "pubkey": "PASTE_PUBLIC_KEY_CONTENT_HERE",
      "endpoints": [
        "https://github.com/majesnix/tap/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**CRITICAL:** `"createUpdaterArtifacts": true` must be inside `"bundle"`. Without it, Tauri does not produce `.sig` files and `tauri-action` logs "Signature not found for the updater JSON. Skipping upload..." — silently. The app builds fine but no update entry appears in latest.json.

### Pattern 4: Capability Permissions

```json
// Source: Context7 tauri-plugin-updater permission reference
// src-tauri/capabilities/default.json — add to "permissions" array:
"updater:default",
"process:allow-restart"
```

**VERIFIED:** `process:allow-restart` is the correct permission identifier (confirmed from Context7 tauri-plugin-process permission reference.md). `process:default` is a different (broader) permission; use the specific `process:allow-restart`.

### Pattern 5: Frontend Update Check (Non-Modal)

```typescript
// Source: Context7 @tauri-apps/plugin-updater docs
// src/App.tsx — add to startup useEffect

import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { toast } from 'sonner'

useEffect(() => {
  // Follow existing App.tsx pattern: startup side effects in useEffect([])
  check().then((update) => {
    if (update?.available) {
      toast(`Update ${update.version} available`, {
        description: update.body ?? 'A new version is ready.',
        action: {
          label: 'Install',
          onClick: () => {
            update.downloadAndInstall().then(() => relaunch())
          }
        },
        duration: Infinity  // Keep visible until user acts
      })
    }
  }).catch(console.error)  // Non-blocking: update failure must not crash the app
}, [])
```

### Pattern 6: CI Signing Env Vars (Linux Job Fix)

```yaml
# Source: https://v2.tauri.app/distribute/updater/#signing
# Add to build-linux job, tauri-action step env block:
- name: Build Tauri app (Linux x86_64)
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  with:
    tagName: ${{ startsWith(github.ref, 'refs/tags/') && github.ref_name || '' }}
    releaseName: "Tap v__VERSION__"
    releaseDraft: true
    releasePrerelease: ${{ contains(github.ref_name, '-') }}
```

Note: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is optional — only needed if a passphrase was set during key generation. Add the secret as an empty string if no passphrase used, or omit the env line entirely.

### Pattern 7: Key Generation (One-Time, Local)

```bash
# Source: https://v2.tauri.app/distribute/updater/#signing
pnpm tauri signer generate -w ~/.tauri/tap.key

# This creates:
#   ~/.tauri/tap.key       — private key (never commit; add to GitHub secrets)
#   ~/.tauri/tap.key.pub   — public key (paste content into tauri.conf.json plugins.updater.pubkey)

# Add to GitHub secrets:
#   TAURI_SIGNING_PRIVATE_KEY = content of ~/.tauri/tap.key
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD = passphrase (if used, otherwise leave blank)
```

### Pattern 8: latest.json Merge Behavior (tauri-action)

**What happens when parallel jobs run:**

Each platform job independently calls `upload-version-json.ts` which:
1. Fetches the existing `latest.json` from the release (if present)
2. Reads `platforms` from it
3. Merges its own platform key(s) into the existing map
4. Deletes the old asset
5. Uploads the merged version

Platform keys are non-overlapping (`linux-x86_64`, `darwin-aarch64`, `darwin-x86_64`), so parallel execution is safe — no job overwrites another's entries. [VERIFIED: tauri-action source `upload-version-json.ts`]

**macOS universal note:** `--target universal-apple-darwin` expands to both `darwin-aarch64` and `darwin-x86_64` entries in latest.json.

### Anti-Patterns to Avoid

- **Hand-rolling update download/verification:** tauri-plugin-updater handles Ed25519 signature verification, AppImage chmod fix, and platform key lookup. Never replicate this.
- **Using `tokio::spawn` for update check:** CRITICAL project constraint — must use `tauri::async_runtime::spawn` per CLAUDE.md to avoid panic on Windows.
- **Blocking the UI on update check:** The `check()` call must be fire-and-forget. A network failure checking for updates must not crash or hang the app.
- **Putting the private key in tauri.conf.json:** Only the public key goes in config. Private key is a GitHub Actions secret only.
- **Modal dialog for update notification:** UPD-02 requires non-modal. Use Sonner toast, not `dialog.ask()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ed25519 signature verification of update payload | Custom crypto verification | `tauri-plugin-updater` | Handles signature verification, MITM resistance, and format validation |
| AppImage execute permission chmod | `fs::set_permissions` before exec | `tauri-plugin-updater` | Plugin has the chmod fix built in since 2.0.0-rc.1 (verified in 2.10.1) |
| latest.json construction | Custom JSON build + upload script | `tauri-action` + `createUpdaterArtifacts: true` | tauri-action handles multi-platform merge, asset deletion, upload atomicity |
| App relaunch after install | `std::process::Command::new(self)` | `tauri-plugin-process` `relaunch()` | Handles AppImage self-replacement on Linux where naive exec fails |
| Update version comparison | semver string comparison | `tauri-plugin-updater` `check()` return value | Plugin compares versions and returns `available: bool` |

**Key insight:** The entire update pipeline — signing, verification, download, installation, relaunch — is solved by two official plugins. The implementation work is configuration and wiring, not logic.

---

## Runtime State Inventory

> This phase is not a rename/refactor/migration phase. However, it introduces a new GitHub Actions secret that is runtime-only state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — update check is stateless (endpoint is public) | None |
| Live service config | GitHub repository secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — these do NOT exist yet | Must add to GitHub → Settings → Secrets before any signed release build can succeed |
| OS-registered state | None | None |
| Secrets/env vars | `plugins.updater.pubkey` in tauri.conf.json — must contain public key content (committed to repo, NOT secret) | Add after key generation |
| Build artifacts | No stale artifacts; this is new capability | None |

**Critical pre-flight:** The Ed25519 keypair must be generated locally BEFORE the first CI run that attempts to sign artifacts. GitHub secrets must be populated before tagging a release.

---

## Common Pitfalls

### Pitfall 1: Silent Skip — No .sig Files in latest.json

**What goes wrong:** tauri-action runs, produces `latest.json`, but the `linux-x86_64` entry has no `signature` field (or the entry is absent entirely). Linux users get no updates.

**Why it happens:** Either (a) `bundle.createUpdaterArtifacts` is missing/false in tauri.conf.json, or (b) the CI job is missing `TAURI_SIGNING_PRIVATE_KEY`. tauri-action logs "Signature not found for the updater JSON. Skipping upload..." but the overall build still succeeds (green CI).

**How to avoid:** Set `createUpdaterArtifacts: true` AND add signing env vars to every platform job. Verify by downloading `latest.json` from the release and checking all expected platform keys have a non-empty `signature` field.

**Warning signs:** Green CI + missing `linux-x86_64` key in latest.json, or key present but `signature` is `""`.

### Pitfall 2: Linux Job Missing Signing Env Vars

**What goes wrong:** Current `build-linux` job (lines 127-135 of release.yml) passes only `GITHUB_TOKEN`. macOS job passes Apple signing credentials. Linux has nothing equivalent.

**Why it happens:** The Linux job was set up before the updater feature was planned.

**How to avoid:** Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to the Linux tauri-action step env block (see Pattern 6).

**Warning signs:** `.AppImage` present in release assets but no `.AppImage.sig` alongside it.

### Pitfall 3: `tokio::spawn` in Update Check

**What goes wrong:** Using `tokio::spawn` inside a Tauri event listener or command causes a panic on Windows in Tauri 2.

**Why it happens:** Tauri 2 on Windows uses a custom async runtime entry point; `tokio::spawn` spawns onto a different runtime context.

**How to avoid:** If any update-related Rust code spawns async work, use `tauri::async_runtime::spawn`. (The frontend JS `check()` call goes through the plugin's own IPC handler; no manual spawn needed for the basic pattern.)

### Pitfall 4: Update Check Crashes App on Network Failure

**What goes wrong:** If the update endpoint is unreachable (user is offline, GitHub is down), an unhandled `check()` rejection crashes or freezes the app.

**Why it happens:** `check()` is async and can fail with a network error.

**How to avoid:** Always `.catch()` on the JS side (see Pattern 5). The update check is a best-effort background operation; any failure should log silently, not surface to the user.

### Pitfall 5: Windows Job Still in release.yml

**What goes wrong:** `build-windows` job runs on every tag push, consuming CI minutes for an out-of-scope platform. Worse, if Windows build fails, it blocks the release.

**Why it happens:** The job was added before Windows was descoped.

**How to avoid:** Delete the `build-windows` job entirely from release.yml (REQUIREMENTS.md explicitly states Windows is out of scope for v1.5).

### Pitfall 6: Public Key vs Private Key Confusion

**What goes wrong:** Developer pastes the private key content into `tauri.conf.json` instead of the public key, or commits the private key to the repo.

**Why it happens:** The signer generates two files with similar names.

**How to avoid:** `~/.tauri/tap.key.pub` content → `plugins.updater.pubkey` in tauri.conf.json (committed). `~/.tauri/tap.key` content → `TAURI_SIGNING_PRIVATE_KEY` GitHub secret (never committed).

---

## Code Examples

### tauri.conf.json — Final Shape (relevant sections)

```json
// Source: https://v2.tauri.app/plugin/updater/
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "entitlements": "Entitlements.plist"
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": [
        "https://github.com/majesnix/tap/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Cargo.toml — Desktop-Only Additions

```toml
# Source: https://v2.tauri.app/plugin/updater/
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

### lib.rs — Plugin Registration

```rust
// Source: https://v2.tauri.app/plugin/updater/
// Add to tauri::Builder::default() chain in src-tauri/src/lib.rs
// Place after existing plugin registrations, before .invoke_handler()
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

Note: No `#[cfg(desktop)]` guard needed at the call site if Cargo.toml uses the desktop-only target configuration above — the symbols simply won't exist on mobile targets.

### capabilities/default.json — Permission Additions

```json
// Source: Context7 tauri-plugin-updater permission reference [VERIFIED]
// Add to "permissions" array:
"updater:default",
"process:allow-restart"
```

### App.tsx — Startup Update Check

```typescript
// Source: Context7 @tauri-apps/plugin-updater [VERIFIED v2.x]
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { toast } from 'sonner'

// Inside the App component, alongside existing startup useEffect:
useEffect(() => {
  check()
    .then((update) => {
      if (!update?.available) return
      toast(`Update ${update.version} available`, {
        description: update.body ?? 'A new version is ready to install.',
        action: {
          label: 'Install & Relaunch',
          onClick: () => {
            update.downloadAndInstall()
              .then(() => relaunch())
              .catch((err) => console.error('Install failed:', err))
          }
        },
        duration: Infinity,
      })
    })
    .catch((err) => {
      // Silent: update check failure must not affect app functionality
      console.error('Update check failed:', err)
    })
}, [])
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ubuntu-22.04 runner | PKG-01 AppImage build | ✓ | GitHub-hosted | — |
| pnpm tauri signer | UPD-01 keypair generation | ✓ | bundled with tauri-cli | — |
| GitHub Actions secrets UI | UPD-01 secret storage | ✓ | n/a | — |
| `https://github.com/majesnix/tap/releases/latest/download/latest.json` endpoint | UPD-02/UPD-04 | Created on first tagged release | — | — |

Missing dependencies with no fallback: none.

Note: The `latest.json` endpoint does not exist until the first signed release is published. The app's `check()` call on first install will fail with a 404 — this is expected and must be caught (see Pitfall 4).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend), cargo test (Rust) |
| Config file | vite.config.ts (Vitest embedded) |
| Quick run command | `pnpm test --run` |
| Full suite command | `pnpm test --run && cargo test --manifest-path src-tauri/Cargo.toml` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPD-02 | `check()` called on startup; no crash when update unavailable | unit (mock plugin) | `pnpm test --run` | ❌ Wave 0 |
| UPD-02 | Toast shown when update available | unit (mock check()) | `pnpm test --run` | ❌ Wave 0 |
| UPD-03 | `downloadAndInstall` → `relaunch` invoked | unit (mock plugin) | `pnpm test --run` | ❌ Wave 0 |
| PKG-01 | AppImage produced in CI | CI smoke | `gh run view` (manual) | ❌ manual only |
| UPD-04 | latest.json has linux-x86_64 entry with signature | CI smoke | `curl latest.json` (manual) | ❌ manual only |
| DOC-01 | docs/linux-keychain.md exists and is non-empty | file existence | `test -f docs/linux-keychain.md` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `src/__tests__/updater.test.tsx` — covers UPD-02, UPD-03 (mock `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`)
- [ ] `docs/linux-keychain.md` — covers DOC-01 (content, not test)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Tauri plugin verifies Ed25519 signature before executing update |
| V6 Cryptography | yes | Ed25519 key pair via `tauri signer generate` — never hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MITM update substitution | Tampering | Ed25519 signature verification in tauri-plugin-updater; app rejects unsigned artifacts |
| Private key exposure in repo | Information Disclosure | Private key only in GitHub secret; never committed; public key only in tauri.conf.json |
| Update endpoint spoofing | Tampering | Signature verification ensures even a spoofed endpoint cannot deliver unsigned code |
| Malicious latest.json | Spoofing | Signature covers the actual artifact, not the JSON; attacker cannot forge a valid `.sig` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tauri-plugin-updater` v1 | `tauri-plugin-updater` v2 | Tauri 2.0 (2024) | Completely different API and config structure |
| `createUpdaterArtifacts` absent | Must set explicitly to `true` | Tauri 2.x default | No `.sig` files without this flag |
| `process:default` | `process:allow-restart` | Tauri 2 permissions refactor | Scoped permission; `default` is broader |

**Deprecated/outdated:**
- `tauri.allowlist.updater` (Tauri 1.x config): replaced by `plugins.updater` block in tauri.conf.json v2
- `TAURI_KEY_PASSWORD` env var: renamed to `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in Tauri 2

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret can be omitted if no passphrase was used during key gen | Pattern 6 / CI | CI build fails with "passphrase required" if key was generated with passphrase and secret is absent |
| A2 | tauri-plugin-updater 2.x and tauri-plugin-process 2.x are compatible with the project's current `tauri = "2"` dep | Standard Stack | Cargo version conflict if minor version constraints clash — verify with `cargo tree` after adding |

---

## Open Questions

1. **Will the first CI run after this phase succeed without a pre-existing `latest.json`?**
   - What we know: tauri-action's `upload-version-json.ts` gracefully handles the case where no existing asset is present (the fetch returns 404 and it starts a fresh object)
   - What's unclear: Whether the Tauri app's `check()` endpoint returning 404 on first install is handled gracefully by the plugin
   - Recommendation: Verify by testing `check()` against a 404 endpoint in unit tests; catch the error in the startup handler (already in Pattern 5)

2. **Should the Sonner toast use `duration: Infinity` or a long timeout?**
   - What we know: UPD-02 requires non-modal; user must be able to dismiss and act later
   - What's unclear: UX preference — Infinity means the toast persists until clicked/dismissed; a long timeout (e.g., 30s) means it auto-dismisses
   - Recommendation: Use `duration: Infinity` since an update prompt should not disappear without user intent; discuss with user at plan stage

---

## Sources

### Primary (HIGH confidence)

- Context7 `/tauri-apps/tauri` — `plugins.updater` config, `createUpdaterArtifacts`, `bundle` schema [VERIFIED]
- Context7 `tauri-plugin-updater` — `check()`, `downloadAndInstall()`, permission identifiers [VERIFIED]
- Context7 `tauri-plugin-process` — `relaunch()`, `process:allow-restart` permission [VERIFIED]
- https://v2.tauri.app/plugin/updater/ — official Tauri 2 updater documentation
- tauri-action `upload-version-json.ts` (GitHub raw) — latest.json merge logic [VERIFIED from source]
- `release.yml` in this repo (read directly) — actual CI structure [VERIFIED]
- `src-tauri/tauri.conf.json` (read directly) — missing `createUpdaterArtifacts` confirmed [VERIFIED]
- `src-tauri/Cargo.toml` (read directly) — missing updater/process plugins confirmed [VERIFIED]
- `src-tauri/capabilities/default.json` (read directly) — missing permissions confirmed [VERIFIED]
- `src-tauri/src/lib.rs` (read directly) — missing plugin registrations confirmed [VERIFIED]
- `src/App.tsx` (confirmed from prior session) — Sonner Toaster already mounted [VERIFIED]

### Secondary (MEDIUM confidence)

- crates.io registry — tauri-plugin-updater 2.10.1, tauri-plugin-process 2.3.1 version confirmation [VERIFIED]

### Tertiary (LOW confidence)

- None — all critical claims verified against primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both plugins verified on crates.io; JS bindings are official
- Architecture: HIGH — based on reading actual source files in this repo
- Pitfalls: HIGH — identified from direct inspection of release.yml and tauri.conf.json; not speculative
- CI signing gap: HIGH — confirmed by reading release.yml lines 127-135 (no `TAURI_SIGNING_PRIVATE_KEY` in Linux job)
- latest.json merge behavior: HIGH — verified from tauri-action source code

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (tauri-plugin-updater is stable; tauri-action upload logic is unlikely to change)
