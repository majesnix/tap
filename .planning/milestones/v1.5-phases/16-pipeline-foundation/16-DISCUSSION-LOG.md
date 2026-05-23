# Phase 16: Pipeline Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 16-pipeline-foundation
**Areas discussed:** Dry-run gate design, Rust cache approach, macOS runner version

---

## Dry-run gate design

| Option | Description | Selected |
|--------|-------------|----------|
| Event-based: `if: github.event_name == 'push'` | Signing steps get an `if` condition — they only run on tag push, never on `workflow_dispatch`. Zero config, works automatically. Simplest design for Phase 17 to wire signing into. | ✓ |
| Input flag: `workflow_dispatch inputs.skip_signing` | Adds a boolean input to the dispatch form. Explicit, but requires the developer to remember to toggle it. Could accidentally run signing if forgotten. | |

**User's choice:** Event-based conditional
**Notes:** Artifact upload runs on all events to validate the upload-artifact action fix. The `create-release` job's existing `startsWith(github.ref, 'refs/tags/')` guard prevents release creation on dry-runs.

---

## Rust cache approach

| Option | Description | Selected |
|--------|-------------|----------|
| `Swatanabe/rust-cache` | One-line setup. Automatically caches ~/.cargo/registry, ~/.cargo/git, and target/ with a key derived from OS + Rust toolchain + Cargo.lock. Handles cache invalidation correctly. | ✓ |
| `actions/cache` with manual keys | Cache ~/.cargo and target/ manually. More control but requires maintaining the cache key and path list. Easy to get wrong. | |

**User's choice:** `Swatanabe/rust-cache` on both macOS and Linux jobs
**Notes:** Linux caching adds no cost and saves build time even though CICD-03's stated target is macOS (20 min → 5 min).

---

## macOS runner version

| Option | Description | Selected |
|--------|-------------|----------|
| `macos-13` (Intel) | What's already in release.yml. Stable. Cross-compiles aarch64 from x86_64 host. GitHub is phasing Intel runners out. | |
| `macos-14` (M1, Apple Silicon) | Faster than macos-13. Cross-compiles x86_64 from arm64 host. Current recommended for new Tauri setups. | |
| `macos-latest` (currently macOS 15, M2) | Newest, fastest. Tag shifts over time. | ✓ |

**User's choice:** `macos-latest`
**Notes:** Universal binary (`--target universal-apple-darwin`) kept in Phase 16 to validate the full build structure before Phase 17 adds signing. Carries forward to Phase 17.

---

## Claude's Discretion

- Exact version pins for GitHub Actions (checkout, setup-node, upload-artifact, download-artifact, pnpm/action-setup, softprops/action-gh-release) — use current stable major tags
- Exact `Swatanabe/rust-cache` version pin
- No `workflow_dispatch` inputs section needed (event-based gate requires no inputs)

## Deferred Ideas

None.
