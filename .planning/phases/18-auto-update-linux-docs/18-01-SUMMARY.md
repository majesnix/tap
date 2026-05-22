---
phase: 18-auto-update-linux-docs
plan: "01"
subsystem: tauri-updater-infrastructure
tags: [tauri, rust, auto-update, cargo, capabilities]
dependency_graph:
  requires: []
  provides: [tauri-plugin-updater-wired, tauri-plugin-process-wired, updater-capabilities]
  affects: [src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/tauri.conf.json, src-tauri/capabilities/default.json]
tech_stack:
  added: [tauri-plugin-updater@2.10.1, tauri-plugin-process@2.3.1]
  patterns: [desktop-only-cargo-target-section, tauri-builder-plugin-chain, capability-permission-strings]
key_files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
decisions:
  - "Used cfg(not(any(target_os=android, target_os=ios))) predicate for desktop-only deps — covers macOS/Linux/Windows in one block without an explicit OS list"
  - "No #[cfg(desktop)] guard at call sites in lib.rs — Cargo.toml target section enforces desktop-only compilation"
  - "UPDATER_PUBKEY_PLACEHOLDER intentional — Plan 04 replaces with real Ed25519 public key after key generation"
  - "process:allow-restart used (not process:default) — scoped permission per tauri-plugin-process Tauri 2 API"
metrics:
  duration: "~45 minutes (including cargo check download + compile)"
  completed: "2026-05-22"
  tasks_completed: 3
  files_changed: 4
---

# Phase 18 Plan 01: Tauri Updater Infrastructure Summary

Wire the Tauri updater plugin infrastructure — desktop-only Cargo deps, plugin registrations in lib.rs, createUpdaterArtifacts + plugins.updater config in tauri.conf.json, and updater/process capability permissions — all passing `cargo check`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add desktop-only Cargo dependencies | 4c3c89e | src-tauri/Cargo.toml |
| 2 | Register updater and process plugins in lib.rs | 866b172 | src-tauri/src/lib.rs |
| 3 | Add createUpdaterArtifacts + plugins.updater + capabilities | 6eb8d06 | src-tauri/tauri.conf.json, src-tauri/capabilities/default.json |

## What Was Built

Four configuration changes that wire the complete Tauri auto-update infrastructure:

1. **Cargo.toml** — Added `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` section with `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"`. The desktop-only cfg predicate covers macOS, Linux, and Windows in a single block, consistent with the existing per-OS target sections.

2. **lib.rs** — Inserted two `.plugin()` calls in the `tauri::Builder::default()` chain between `.plugin(tauri_plugin_opener::init())` and `.invoke_handler(...)`:
   - `.plugin(tauri_plugin_updater::Builder::new().build())`
   - `.plugin(tauri_plugin_process::init())`

3. **tauri.conf.json** — Added `"createUpdaterArtifacts": true` inside the `"bundle"` object (critical: must be inside bundle for tauri-action to produce `.sig` files and populate `latest.json`). Added top-level `"plugins"` block with `"updater"` key containing `UPDATER_PUBKEY_PLACEHOLDER` pubkey and the GitHub Releases endpoint.

4. **capabilities/default.json** — Appended `"updater:default"` and `"process:allow-restart"` to the permissions array. Used `process:allow-restart` specifically (not `process:default`) per the scoped permission requirement.

## Verification Results

All 5 success criteria from the plan passed:

- `grep 'tauri-plugin-updater' src-tauri/Cargo.toml` → `tauri-plugin-updater = "2"` ✓
- `grep 'tauri_plugin_updater' src-tauri/src/lib.rs` → `.plugin(tauri_plugin_updater::Builder::new().build())` ✓
- `grep 'createUpdaterArtifacts' src-tauri/tauri.conf.json` → `"createUpdaterArtifacts": true,` ✓
- `grep 'process:allow-restart' src-tauri/capabilities/default.json` → `"process:allow-restart"` ✓
- `cargo check --manifest-path src-tauri/Cargo.toml` → exit 0 (tauri-plugin-updater 2.10.1 + tauri-plugin-process 2.3.1 resolved cleanly) ✓

## Decisions Made

- **cfg(not(android or ios)) predicate** — covers all three desktop OSes (macOS, Linux, Windows) in one target block; avoids listing explicit OSes which would miss future platforms
- **No #[cfg(desktop)] guard at lib.rs call sites** — the Cargo.toml target section ensures crate symbols only exist on desktop builds; unconditional call sites compile correctly
- **UPDATER_PUBKEY_PLACEHOLDER** — intentional placeholder string; `cargo check` (and `tauri-build`) do not validate pubkey content at compile time; Plan 04 replaces with real Ed25519 public key
- **process:allow-restart (not process:default)** — scoped permission required for `relaunch()` in Tauri 2 permission model; `process:default` is broader and non-specific

## Deviations from Plan

None — plan executed exactly as written. The placeholder pubkey did not cause `cargo check` failures (advisor's main risk item confirmed non-blocking).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public-key-placeholder | src-tauri/tauri.conf.json | UPDATER_PUBKEY_PLACEHOLDER must be replaced with real Ed25519 pubkey before any signed release build; leaving placeholder means updater plugin will reject all update checks at runtime until replaced |

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `"pubkey": "UPDATER_PUBKEY_PLACEHOLDER"` | src-tauri/tauri.conf.json | Ed25519 public key not yet generated; Plan 04 generates keypair and replaces this value; intentional per plan design |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src-tauri/Cargo.toml exists with desktop deps | FOUND |
| src-tauri/src/lib.rs exists with plugin registrations | FOUND |
| src-tauri/tauri.conf.json exists with createUpdaterArtifacts | FOUND |
| src-tauri/capabilities/default.json exists with permissions | FOUND |
| 18-01-SUMMARY.md created | FOUND |
| Commit 4c3c89e (Task 1) | VERIFIED |
| Commit 866b172 (Task 2) | VERIFIED |
| Commit 6eb8d06 (Task 3) | VERIFIED |
