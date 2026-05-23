---
phase: 16-pipeline-foundation
plan: "01"
subsystem: ci-cd
tags: [github-actions, entitlements, version-bump, rust-cache]
dependency_graph:
  requires: []
  provides: [release-pipeline-macos-latest, rust-cache-both-jobs, hardened-runtime-entitlements, version-1.5.0]
  affects: [.github/workflows/release.yml, src-tauri/Entitlements.plist, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, package.json, src-tauri/Cargo.lock]
tech_stack:
  added: []
  patterns: [Swatinem/rust-cache@v2 with workspaces, Hardened Runtime WebView entitlements]
key_files:
  created: []
  modified:
    - .github/workflows/release.yml
    - src-tauri/Entitlements.plist
    - src-tauri/tauri.conf.json
    - src-tauri/Cargo.toml
    - package.json
    - src-tauri/Cargo.lock
decisions:
  - "Kept action version pins v6/v7/v8/v3 to match ci.yml — downgrading to v4 per CONTEXT.md 'Claude's Discretion' would create inconsistency"
  - "Phase 17 signing gate scaffolded as comment only (no empty conditional step) — D-01 satisfied, Phase 17 adds real steps under the gate"
  - "cargo update -p tap committed immediately — keeps repo self-consistent regardless of CI --locked behavior"
metrics:
  duration: "8 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_modified: 6
---

# Phase 16 Plan 01: Pipeline Foundation — Release Pipeline Fix Summary

**One-liner:** Corrected Tauri release pipeline with macos-latest runner, Rust build cache on both jobs, Hardened Runtime entitlements (4-key), and version bumped to 1.5.0 across all three version files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix release.yml — runner, Rust cache, signing-gate comment | 97ebb2e | .github/workflows/release.yml |
| 2 | Replace Entitlements.plist with Hardened Runtime keys | dd38ee3 | src-tauri/Entitlements.plist |
| 3 | Bump version to 1.5.0 in all three files and update Cargo.lock | 2cf79f2 | src-tauri/tauri.conf.json, src-tauri/Cargo.toml, package.json, src-tauri/Cargo.lock |

## Changes Made

### Task 1: .github/workflows/release.yml

Four targeted edits:

1. **Runner change (D-04):** `runs-on: macos-13` → `runs-on: macos-latest` in build-macos job (line 11)
2. **Rust cache in build-macos (CICD-03):** Inserted `Swatinem/rust-cache@v2` with `workspaces: src-tauri` after `dtolnay/rust-toolchain@stable`, before `Setup pnpm`
3. **Rust cache in build-linux (CICD-03):** Inserted `Swatinem/rust-cache@v2` with `workspaces: src-tauri` after `dtolnay/rust-toolchain@stable`, before `Setup pnpm`
4. **Signing-gate scaffold (D-01):** Added comment `# Phase 17: signing steps go here, guarded by: if: github.event_name == 'push'` after the tauri-action step in build-macos

No action version tags were changed — v6/v7/v8/v3 pins remain consistent with ci.yml.

### Task 2: src-tauri/Entitlements.plist

Full replacement. Old file had 2 keys:
- `com.apple.security.app-sandbox` = false
- `com.apple.security.temporary-exception.files.absolute-path.read-write` = ["/"] (sandbox exception — no-op when app-sandbox=false)

New file has 4 keys (D-06/SIGN-03):
- `com.apple.security.app-sandbox` = false (retained — dev tool must read arbitrary .proto files)
- `com.apple.security.cs.allow-jit` = true (WKWebView JIT compilation)
- `com.apple.security.cs.allow-unsigned-executable-memory` = true (WebKit executable memory pages)
- `com.apple.security.cs.allow-dyld-environment-variables` = true (WebKit dynamic linker)

File path `src-tauri/Entitlements.plist` unchanged — `tauri.conf.json` entitlements reference is still valid.

### Task 3: Version files (D-07)

All three version files bumped from `1.3.0` to `1.5.0`:
- `src-tauri/tauri.conf.json` line 4: `"version": "1.3.0"` → `"version": "1.5.0"`
- `src-tauri/Cargo.toml` line 3: `version = "1.3.0"` → `version = "1.5.0"`
- `package.json` line 4: `"version": "1.3.0"` → `"version": "1.5.0"`

Cargo.lock regenerated via `cargo update -p tap` — tap entry updated to `version = "1.5.0"`.

## Verification Commands Run

```
=== Task 1: release.yml ===
grep 'runs-on: macos-latest' .github/workflows/release.yml        → MATCH (line 11)
grep -c 'Swatinem/rust-cache@v2' .github/workflows/release.yml    → 2
grep 'Phase 17: signing steps go here' .github/workflows/release.yml → MATCH (line 47)
! grep 'macos-13' .github/workflows/release.yml                   → OK (absent)

=== Task 2: Entitlements.plist ===
grep -c '<key>' src-tauri/Entitlements.plist                      → 4
grep 'cs.allow-jit' src-tauri/Entitlements.plist                  → MATCH
! grep 'temporary-exception' src-tauri/Entitlements.plist         → OK (absent)

=== Task 3: Version files ===
grep '"version": "1.5.0"' src-tauri/tauri.conf.json               → MATCH (line 4)
grep 'version = "1.5.0"' src-tauri/Cargo.toml                     → MATCH (line 3)
grep '"version": "1.5.0"' package.json                            → MATCH (line 4)
grep -A1 'name = "tap"' src-tauri/Cargo.lock | grep '1.5.0'       → MATCH
```

All 12 acceptance checks passed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan makes no UI changes and introduces no placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. The Entitlements.plist replacement reduces the threat surface (T-16-03 mitigated: removed the misleading `temporary-exception` key).

## Self-Check: PASSED

Files exist:
- FOUND: .github/workflows/release.yml
- FOUND: src-tauri/Entitlements.plist
- FOUND: src-tauri/tauri.conf.json
- FOUND: src-tauri/Cargo.toml
- FOUND: package.json
- FOUND: src-tauri/Cargo.lock

Commits exist:
- 97ebb2e — feat(16-01): fix release.yml
- dd38ee3 — feat(16-01): replace Entitlements.plist
- 2cf79f2 — chore(16-01): bump version to 1.5.0
