---
phase: "14-live-subscribe-mode"
plan: "01"
subsystem: "rust-backend"
tags: ["rust", "tauri", "amqp", "subscribe", "cancellation-token"]
dependency_graph:
  requires:
    - "src-tauri/src/commands/consume.rs (DrainResult, bytes_to_hex)"
    - "src-tauri/src/commands/connection.rs (load_profile_with_password)"
    - "src-tauri/src/profiles.rs (build_amqp_uri)"
    - "src-tauri/src/error.rs (AppError)"
  provides:
    - "start_subscribe Tauri command (IPC entry point for frontend)"
    - "stop_subscribe Tauri command (IPC entry point for frontend)"
    - "SubscribeState managed state (Mutex<Option<SubscribeState>>)"
  affects:
    - "src-tauri/src/lib.rs (managed state + invoke_handler)"
    - "src-tauri/src/commands/mod.rs (pub mod subscribe)"
tech_stack:
  added:
    - "tokio-util 0.7 (CancellationToken for subscribe session control)"
    - "futures-util 0.3 (StreamExt trait for lapin Consumer stream iteration)"
  patterns:
    - "CancellationToken + tokio::select! for cooperative consumer cancellation"
    - "ack-before-decode per delivery (D-13)"
    - "password/URI drop before spawn closure (SECURITY)"
    - "tauri::async_runtime::spawn (not tokio::spawn — Tauri issue #10289)"
    - "Mutex lock → take → drop guard before await (MutexGuard not Send)"
key_files:
  created:
    - "src-tauri/src/commands/subscribe.rs"
  modified:
    - "src-tauri/Cargo.toml"
    - "src-tauri/Cargo.lock"
    - "src-tauri/src/commands/mod.rs"
    - "src-tauri/src/lib.rs"
decisions:
  - "Used Result<(), crate::error::AppError> instead of Result<(), String> — matches all other commands and allows ?-propagation from load_profile_with_password"
  - "Added pool_state parameter to start_subscribe — required for DrainResult.decoded field; plan omission was a gap"
  - "Added futures-util 0.3 as explicit Cargo dep — was only transitive via lapin; Rust requires explicit declaration"
  - "JoinHandle typed as tauri::async_runtime::JoinHandle<()> — NOT tokio::task::JoinHandle (type mismatch compile error)"
metrics:
  duration: "~28 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 14 Plan 01: Rust Subscribe Backend Summary

**One-liner:** Rust backend for live subscribe mode — CancellationToken-based persistent AMQP consumer with start_subscribe/stop_subscribe Tauri commands, ack-before-decode, basic_qos(20) prefetch cap, and password-safe spawn pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Edit Cargo.toml and verify compilation | c296d07 | src-tauri/Cargo.toml, Cargo.lock |
| 2 | Create subscribe.rs and wire into lib.rs + mod.rs | 80e6f29 | subscribe.rs, mod.rs, lib.rs, Cargo.toml, Cargo.lock |

## What Was Built

### `src-tauri/src/commands/subscribe.rs`

New command file implementing:

**`SubscribeState` struct** — holds `CancellationToken` and `tauri::async_runtime::JoinHandle<()>` for an active session. Stored as `Mutex<Option<SubscribeState>>` in Tauri managed state.

**`start_subscribe` command** — connects to AMQP, calls `basic_qos(20)` then `basic_consume`, spawns a consumer loop using `tauri::async_runtime::spawn`. Each delivery is acked before decode (D-13). Messages sent to frontend via `tauri::ipc::Channel<DrainResult>`. Returns immediately (D-02); task runs until cancelled or broker closes stream.

**`stop_subscribe` command** — idempotent; takes `SubscribeState` from Mutex (dropping guard before await), calls `token.cancel()`, awaits JoinHandle with 5s timeout.

**Security mitigations implemented:**
- T-14-01: profile_name validated non-empty before use
- T-14-02: D-08 double-start guard (lock → check Some → Err("Already running"))
- T-14-03: Password dropped before any await; URI dropped at connection block end
- T-14-04: basic_qos(20) caps in-flight deliveries
- T-14-05: decode_types validated non-empty; per-delivery skip on unknown type names

### Cargo.toml Changes

- `tokio` features: added `"sync"` (required by CancellationToken internals)
- `tokio-util = { version = "0.7", features = ["rt"] }` — explicit dep for `CancellationToken`
- `futures-util = "0.3"` — explicit dep for `StreamExt` trait on lapin `Consumer` stream

### lib.rs + mod.rs

- `pub mod subscribe;` added to commands/mod.rs
- `.manage(Mutex::new(Option::<commands::subscribe::SubscribeState>::None))` added to Builder chain
- `commands::subscribe::start_subscribe, commands::subscribe::stop_subscribe` registered in `generate_handler![]`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added pool_state parameter to start_subscribe**
- **Found during:** Task 2 implementation
- **Issue:** Plan action omitted `pool_state` from the command signature, but behavior block requires "decode using super::consume utilities" and `DrainResult.decoded` needs DescriptorPool access
- **Fix:** Added `pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>` parameter; clone pool before spawn (O(1), Arc-backed); move clone into consumer loop
- **Files modified:** src-tauri/src/commands/subscribe.rs
- **Commit:** 80e6f29

**2. [Rule 1 - Bug] Fixed Result return type inconsistency**
- **Found during:** Task 2 — plan said `Result<(), String>` but all other commands use `Result<(), AppError>`
- **Fix:** Used `Result<(), crate::error::AppError>` — enables `?`-propagation; Tauri serializes `AppError` automatically via `serde::Serialize` impl
- **Files modified:** src-tauri/src/commands/subscribe.rs
- **Commit:** 80e6f29

**3. [Rule 3 - Blocking Issue] Added futures-util as explicit Cargo dependency**
- **Found during:** Task 2 cargo build — `futures_util::StreamExt` failed to compile
- **Issue:** `futures-util` is transitive (via lapin) but Rust requires explicit Cargo.toml declaration to use a crate
- **Fix:** Added `futures-util = "0.3"` to Cargo.toml
- **Files modified:** src-tauri/Cargo.toml
- **Commit:** 80e6f29

**4. [Rule 1 - Bug] Fixed lapin ShortString type mismatches**
- **Found during:** Task 2 cargo build — `basic_consume` and `basic_cancel` expect `ShortString`, not `&String`
- **Fix:** Used `.as_str().into()` to convert `&String` to `ShortString` (consistent with existing consume.rs pattern)
- **Files modified:** src-tauri/src/commands/subscribe.rs
- **Commit:** 80e6f29

## Self-Check

**Created files:**
- [x] src-tauri/src/commands/subscribe.rs — FOUND
- [x] .planning/phases/14-live-subscribe-mode/14-01-SUMMARY.md — FOUND (this file)

**Modified files:**
- [x] src-tauri/Cargo.toml — contains tokio-util, futures-util, tokio sync
- [x] src-tauri/src/commands/mod.rs — contains pub mod subscribe
- [x] src-tauri/src/lib.rs — contains SubscribeState managed state + commands registered

**Commits:**
- [x] c296d07 — chore(14-01): add tokio sync feature and tokio-util to Cargo.toml
- [x] 80e6f29 — feat(14-01): implement start_subscribe and stop_subscribe Tauri commands

**Build:** `cargo build` exits 0 (verified)
**Tests:** 2 inline unit tests pass (error_drain_result construction sentinels)

## Self-Check: PASSED
