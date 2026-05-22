# Phase 18: Auto-Update + Linux + Docs — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 7 (5 modifications, 1 creation, 1 deletion)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/Cargo.toml` | config | — | `src-tauri/Cargo.toml` lines 41-48 | exact (self-extend) |
| `src-tauri/src/lib.rs` | config | request-response | `src-tauri/src/lib.rs` lines 35-38 | exact (self-extend) |
| `src-tauri/tauri.conf.json` | config | — | `src-tauri/tauri.conf.json` lines 24-37 | exact (self-extend) |
| `src-tauri/capabilities/default.json` | config | — | `src-tauri/capabilities/default.json` lines 6-18 | exact (self-extend) |
| `src/App.tsx` | component | event-driven | `src/App.tsx` `ThemeBootstrap` useEffect, lines 19-32 | exact (self-extend) |
| `.github/workflows/release.yml` — `build-linux` job | config | — | `.github/workflows/release.yml` `build-macos` env block, lines 64-79 | role-match |
| `.github/workflows/release.yml` — `build-windows` job | — | — | **Deletion only — no analog needed** | — |
| `src/App.test.tsx` or `src/updater.test.tsx` (Wave 0) | test | — | `src/App.test.tsx` lines 1-38 | exact |
| `docs/linux-keychain.md` | docs | — | `docs/release-setup.md` | role-match |

---

## Pattern Assignments

### `src-tauri/Cargo.toml` (config — extend desktop-only dependencies)

**Analog:** `src-tauri/Cargo.toml` lines 41-48 (existing keyring target sections)

The project already uses `[target.'cfg(...)'.dependencies]` to gate platform-specific crates. The updater and process plugins follow the same pattern under the desktop (non-mobile) cfg predicate.

**Existing pattern to copy** (lines 41-48):
```toml
[target.'cfg(target_os = "linux")'.dependencies]
dbus-secret-service-keyring-store = { version = "1", features = ["crypto-rust"] }

[target.'cfg(target_os = "macos")'.dependencies]
apple-native-keyring-store = { version = "1", features = ["keychain"] }

[target.'cfg(target_os = "windows")'.dependencies]
windows-native-keyring-store = "1"
```

**New section to add** (append after line 49, at end of file):
```toml
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

Note: The predicate is `not(android or ios)` rather than an explicit OS list — this covers macOS, Linux, and Windows with a single block. No passphrase features needed.

---

### `src-tauri/src/lib.rs` (config — plugin registration)

**Analog:** `src-tauri/src/lib.rs` lines 35-38 (existing `.plugin()` chain)

**Existing plugin chain** (lines 35-38):
```rust
.plugin(tauri_plugin_store::Builder::new().build())
.plugin(tauri_plugin_dialog::init())
.plugin(tauri_plugin_fs::init())
.plugin(tauri_plugin_opener::init())
```

**Insertion point:** After line 38 (after `.plugin(tauri_plugin_opener::init())`), before `.invoke_handler(...)` on line 39.

**Lines to insert:**
```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

Note: No `#[cfg(desktop)]` guard is needed at the call site. The Cargo.toml target section ensures the crate symbols only exist on desktop targets; the call sites compile unconditionally.

---

### `src-tauri/tauri.conf.json` (config — bundle + plugins)

**Analog:** `src-tauri/tauri.conf.json` lines 24-37 (existing `bundle` block)

**Existing bundle block** (lines 24-37):
```json
"bundle": {
  "active": true,
  "targets": "all",
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
}
```

**Two changes required:**

1. Add `"createUpdaterArtifacts": true` inside `"bundle"` (after `"targets": "all"`, before `"icon"`):
```json
"bundle": {
  "active": true,
  "targets": "all",
  "createUpdaterArtifacts": true,
  "icon": [ ... ]
}
```

2. Add a new top-level `"plugins"` key alongside `"bundle"` and `"app"`:
```json
"plugins": {
  "updater": {
    "pubkey": "PASTE_PUBLIC_KEY_CONTENT_HERE",
    "endpoints": [
      "https://github.com/majesnix/tap/releases/latest/download/latest.json"
    ]
  }
}
```

**Critical:** `createUpdaterArtifacts` must be inside `bundle`. Without it, tauri-action silently skips `.sig` file upload and the `linux-x86_64` entry never appears in `latest.json`. The pubkey value is the full content of `~/.tauri/tap.key.pub` (generated once; committed to repo — it is a public key, not a secret).

---

### `src-tauri/capabilities/default.json` (config — add permissions)

**Analog:** `src-tauri/capabilities/default.json` lines 6-18 (existing `permissions` array)

**Existing permissions array** (lines 6-18):
```json
"permissions": [
  "core:default",
  "dialog:default",
  "dialog:allow-open",
  "dialog:allow-save",
  "fs:allow-write-text-file",
  { "identifier": "fs:scope", "allow": [{ "path": "$HOME/**" }] },
  "store:default",
  "store:allow-load",
  "store:allow-set",
  "store:allow-save",
  "store:allow-get"
]
```

**Append to the array** (after `"store:allow-get"` on line 17):
```json
"updater:default",
"process:allow-restart"
```

Note: Use `"process:allow-restart"` specifically — not `"process:default"`. In Tauri 2 the scoped permission is required; `default` is broader and non-specific.

---

### `src/App.tsx` — startup update check useEffect (component, event-driven)

**Analog:** `src/App.tsx` `ThemeBootstrap` useEffect, lines 19-32

**Existing useEffect pattern** (lines 19-32):
```typescript
useEffect(() => {
  load(THEME_STORE_PATH)
    .then((store) => store.get<string>(THEME_MODE_KEY))
    .then((saved) => {
      if (saved && VALID_THEMES.includes(saved)) setTheme(saved);
    })
    .catch((err) => {
      // Log so the developer can diagnose; bootstrap still completes
      console.error("[ThemeBootstrap] Failed to load saved theme:", err);
    })
    .finally(() => {
      setBootstrapped(true);
    });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

The pattern for the new update check is structurally identical: fire-and-forget async in `useEffect([])`, `.catch()` swallows errors silently, ESLint disable comment on the empty deps array.

**New imports to add** (alongside existing imports at top of `App.tsx`):
```typescript
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { toast } from 'sonner'
```

Note: `toast` is already imported in the project via `@/components/ui/sonner` for some components, but `App.tsx` itself does not currently import it. The `Toaster` component is already mounted (line 57), so adding a `toast(...)` call will work without additional setup.

**New useEffect to add** inside the `App()` component (alongside the `ThemeBootstrap` component's own effects — the `App` function body currently returns JSX directly; the effect should go inside `App` or in a new sibling startup component following the `ThemeBootstrap` extraction pattern):
```typescript
useEffect(() => {
  // Non-blocking background check; React 18 strict mode fires twice in dev (idempotent)
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
      // Silent: 404 before first published release is a normal case
      console.error('Update check failed:', err)
    })
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

**Placement note:** Following the `ThemeBootstrap` extraction pattern (lines 12-49), the planner may extract the update check into a `UpdateChecker` component that returns `null` and place it inside `App()` alongside `<ThemeBootstrap />`. Both styles (inline in App or extracted) are valid; extracted is more testable. Planner decides.

---

### `.github/workflows/release.yml` — `build-linux` job (CI config — add signing env vars)

**Analog:** `.github/workflows/release.yml` `build-macos` tauri-action step, lines 64-79

**Existing macOS env block** (lines 64-79 — the env/with pattern to copy from):
```yaml
- name: Build Tauri app (universal macOS)
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ env.CERT_ID }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  with:
    tagName: ${{ startsWith(github.ref, 'refs/tags/') && github.ref_name || '' }}
    releaseName: "Tap v__VERSION__"
    releaseDraft: true
    releasePrerelease: ${{ contains(github.ref_name, '-') }}
    args: --target universal-apple-darwin
```

**Existing Linux env block to replace** (lines 127-135 — currently missing signing vars):
```yaml
- name: Build Tauri app (Linux x86_64)
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tagName: ${{ startsWith(github.ref, 'refs/tags/') && github.ref_name || '' }}
    releaseName: "Tap v__VERSION__"
    releaseDraft: true
    releasePrerelease: ${{ contains(github.ref_name, '-') }}
```

**Replace with** (add two signing env vars):
```yaml
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

Note: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is only needed if a passphrase was set during key generation. If the key was generated without a passphrase, omit the env line or add the GitHub secret with an empty value. Keeping it present with an empty value is safe and matches the `docs/release-setup.md` secret table (line 77).

---

### `.github/workflows/release.yml` — `build-windows` job deletion

**Analog:** None — pure deletion.

Lines 137-173 (the entire `build-windows` job) must be deleted. Windows distribution is out of scope for v1.5 per REQUIREMENTS.md. The job currently passes only `GITHUB_TOKEN` and would fail to produce signed artifacts anyway.

**Deletion target:**
```yaml
# Lines 137-173 — delete this entire job block
build-windows:
  runs-on: windows-latest
  permissions:
    contents: write
  steps:
    ...
```

---

### `src/App.test.tsx` or `src/updater.test.tsx` — Wave 0 tests (test)

**Analog:** `src/App.test.tsx` lines 1-38 (vi.hoisted mock factory + vi.mock pattern)

**PLANNER DECISION REQUIRED — test file placement:**

RESEARCH.md proposes `src/__tests__/updater.test.tsx`, but the project has two co-existing conventions:
- App-level: sibling co-location (`src/App.test.tsx` lives next to `src/App.tsx`)
- Component-level: nested `__tests__/` subfolder (`src/components/*/  __tests__/`)

Options:
- (a) Extend `src/App.test.tsx` — add updater test cases alongside ThemeBootstrap tests
- (b) Create `src/updater.test.tsx` as a new sibling (if the update logic is extracted into `UpdateChecker` component)
- (c) Create `src/__tests__/updater.test.tsx` (RESEARCH.md suggestion — inconsistent with App-level convention)

Recommendation: If the update check stays inline in `App.tsx` or in `ThemeBootstrap`-style sibling component, use option (b) `src/updater.test.tsx`. If it stays in `App()` directly and the component is not extracted, extend `src/App.test.tsx`.

**Existing mock factory pattern** (lines 1-15 of `src/App.test.tsx`):
```typescript
import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// Use vi.hoisted for mock factories (Vitest hoisting requirement)
const { mockStore, mockGet, mockSet, mockSave } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(null);
  const mockStore = { get: mockGet, set: mockSet, save: mockSave };
  return { mockStore, mockGet, mockSet, mockSave };
});

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));
```

**Apply this pattern for updater tests** — copy the `vi.hoisted` + `vi.mock` structure, substituting:
```typescript
const { mockCheck, mockUpdate } = vi.hoisted(() => {
  const mockUpdate = {
    available: true,
    version: '1.6.0',
    body: 'Release notes',
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
  };
  const mockCheck = vi.fn().mockResolvedValue(mockUpdate);
  return { mockCheck, mockUpdate };
});

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mockCheck,
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));
```

**Test behaviors to cover** (from RESEARCH.md Validation Architecture):
- `check()` called on startup
- No toast when `update.available` is false
- Toast shown when update available (UPD-02)
- `downloadAndInstall` → `relaunch` invoked on button click (UPD-03)
- No crash when `check()` rejects with network error (Pitfall 4)

---

### `docs/linux-keychain.md` (docs — new file)

**Analog:** `docs/release-setup.md` (structure, tone, audience)

**Existing doc structure pattern** (from `docs/release-setup.md`):
- H1 title
- One-sentence purpose statement
- `---` separators between sections
- Numbered steps with H2 headings
- Code blocks for commands
- **Bold** for field names and secret names
- "Verification" or "Verification command" section at the bottom with `bash` code blocks

**Content sections to include** (from RESEARCH.md DOC-01 Content Outline):
1. What it stores (AMQP credentials via D-Bus Secret Service API)
2. Runtime dependencies (gnome-keyring / kwallet)
3. System libraries at runtime (`libdbus-1-3`; clarify that `libsecret-1-0` is NOT required)
4. Headless / server installs (warning + workaround)
5. Verification command (`secret-tool list` or `gdbus` introspection)
6. Distro-specific install commands (Ubuntu/Debian, Fedora, Arch)

**Important content note:** The `dbus-secret-service-keyring-store` crate with `crypto-rust` feature uses the `dbus` crate (C FFI against `libdbus-1`) — it does NOT require `libsecret-1-dev` at build time and does not use the `libsecret` C API. The doc must clarify this to avoid user confusion with other tools.

---

## Shared Patterns

### Silent Error Swallowing for Background Operations

**Source:** `src/App.tsx` ThemeBootstrap useEffect, lines 26-31
**Apply to:** The update check useEffect in App.tsx

```typescript
.catch((err) => {
  // Log so the developer can diagnose; bootstrap still completes
  console.error("[ThemeBootstrap] Failed to load saved theme:", err);
})
```

Background startup operations (theme load, update check) must not surface errors to the user. Use `.catch()` with `console.error` only. No `toast.error()`, no re-throw.

### Target-Gated Cargo Dependencies

**Source:** `src-tauri/Cargo.toml` lines 41-48
**Apply to:** The new `tauri-plugin-updater` / `tauri-plugin-process` section

```toml
[target.'cfg(target_os = "linux")'.dependencies]
crate-name = { version = "1", features = ["..."] }
```

Use `[target.'cfg(...)'.dependencies]` for all platform-conditional crates. The updater/process plugins use the `not(android or ios)` variant, which covers all desktop OSes.

### Tauri Plugin Registration Chain

**Source:** `src-tauri/src/lib.rs` lines 35-38
**Apply to:** The two new plugin `.plugin()` calls in lib.rs

```rust
.plugin(tauri_plugin_store::Builder::new().build())
.plugin(tauri_plugin_dialog::init())
.plugin(tauri_plugin_fs::init())
.plugin(tauri_plugin_opener::init())
// ← insert new plugins here, before .invoke_handler(...)
```

Each plugin registration follows the same `.plugin(...)` method call. `Builder::new().build()` is used for plugins with configuration; `::init()` is used for simpler ones.

### GitHub Actions Env Var Block for tauri-action

**Source:** `.github/workflows/release.yml` lines 64-79 (build-macos)
**Apply to:** The `build-linux` tauri-action step (lines 127-135)

Pattern: `env:` block under the `uses: tauri-apps/tauri-action@v0` step; `GITHUB_TOKEN` always first, platform-specific signing vars follow.

### Capability Permission String Format

**Source:** `src-tauri/capabilities/default.json` lines 6-18
**Apply to:** The two new permission entries

Format is `"plugin-name:permission-identifier"` as a bare JSON string. Scoped permissions with allow-lists use the object form `{ "identifier": "...", "allow": [...] }` — but the updater and process permissions use the simple string form.

---

## No Analog Found

All files have analogs in this codebase. The `docs/linux-keychain.md` is a new file but `docs/release-setup.md` provides a strong structural analog.

---

## Metadata

**Analog search scope:** `src/`, `src-tauri/`, `.github/workflows/`, `docs/`
**Files scanned:** 9 source files read directly
**Pattern extraction date:** 2026-05-22
