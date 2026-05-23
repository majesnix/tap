# Phase 16: Pipeline Foundation - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the GitHub Actions release pipeline so `workflow_dispatch` runs green on all matrix jobs (macOS-latest + ubuntu-22.04) — no signing credentials required. Covers: correcting broken action versions, adding Rust build cache, replacing the Entitlements.plist with the correct Hardened Runtime keys, and bumping the app version to v1.5.0.

Requirements in scope: CICD-02, CICD-03, SIGN-03

</domain>

<decisions>
## Implementation Decisions

### Dry-Run Gate (CICD-02)

- **D-01:** Gate signing steps on `if: github.event_name == 'push'` — not a `workflow_dispatch` input flag. Signing runs only on tag push; `workflow_dispatch` always skips it automatically. Phase 17 adds signing steps under this existing conditional.
- **D-02:** Artifact upload (`actions/upload-artifact`) runs on every trigger (both `workflow_dispatch` and tag push) to validate the action version fix. The `create-release` job already gates on `startsWith(github.ref, 'refs/tags/')` so no release is created on dry-runs.

### Rust Build Cache (CICD-03)

- **D-03:** Use `Swatanabe/rust-cache` action on **both** the macOS and Linux build jobs. One-step setup; automatically caches `~/.cargo/registry`, `~/.cargo/git`, and `target/` with a key derived from OS + toolchain + `Cargo.lock`. No manual key maintenance required.

### macOS Runner & Build Target

- **D-04:** Use `macos-latest` (currently macOS 15, M2 Apple Silicon) — faster than `macos-13` for Rust compilation and the recommended runner for new Tauri setups. Carries forward into Phase 17.
- **D-05:** Keep the Universal binary build (`--target universal-apple-darwin`) with both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets. Phase 16 validates the Universal build structure before Phase 17 adds signing.

### Entitlements.plist (SIGN-03)

- **D-06:** Replace the current file entirely. Remove `com.apple.security.temporary-exception.files.absolute-path.read-write` (old sandbox exception). Add the three Hardened Runtime WebView entitlements: `com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`, `com.apple.security.cs.allow-dyld-environment-variables`. Keep `com.apple.security.app-sandbox` = `false` (carried forward — required for arbitrary `.proto` file read as dev tool).

### Version Bump

- **D-07:** Bump version to `1.5.0` in both `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` (currently `1.3.0` in both).

### Claude's Discretion

- Exact `Swatanabe/rust-cache` version pin — use latest stable
- Exact pinned versions for `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`, `pnpm/action-setup`, `softprops/action-gh-release` — use current stable major tags (v4, v4, v4, v4, v4, v2 respectively)
- Whether to add `workflow_dispatch` inputs section at all (none required per design — event-based gate needs no inputs)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workflow under repair
- `.github/workflows/release.yml` — the release pipeline being fixed; contains broken action versions and missing Rust cache

### Config files to patch
- `src-tauri/Entitlements.plist` — current file has wrong entitlements; must be fully replaced per D-06
- `src-tauri/tauri.conf.json` — version bump target (1.3.0 → 1.5.0); also contains `bundle.macOS.entitlements` path reference
- `src-tauri/Cargo.toml` — version bump target (1.3.0 → 1.5.0)

### Requirements source
- `.planning/REQUIREMENTS.md` — CICD-02 (dry-run gate), CICD-03 (Rust cache), SIGN-03 (Entitlements keys) — the three requirements this phase satisfies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/ci.yml` — check this for any patterns already established (pnpm version, Node version) to keep consistency with the release workflow

### Established Patterns
- Tauri Universal binary: `--target universal-apple-darwin` with `targets: aarch64-apple-darwin,x86_64-apple-darwin` is already the intended pattern in the existing `release.yml`
- `pnpm install --frozen-lockfile` + `cache: pnpm` on `setup-node` — keep this pattern

### Integration Points
- `src-tauri/tauri.conf.json` `bundle.macOS.entitlements` key points to `Entitlements.plist` — path does not change, only the file content
- Phase 17 will add signing env vars (`APPLE_CERTIFICATE`, etc.) under the `if: github.event_name == 'push'` gate established here

</code_context>

<specifics>
## Specific Ideas

No specific references beyond what is captured in decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-Pipeline Foundation*
*Context gathered: 2026-05-21*
