---
phase: "22-plan-runner-sequential-execution"
plan: "02"
subsystem: "rust-backend"
tags: ["plan-runner", "amqp", "protobuf", "tauri-command", "execute-step"]
dependency_graph:
  requires:
    - "src-tauri/src/commands/encode.rs (encode_message pub async fn)"
    - "src-tauri/src/commands/connection.rs (load_profile_with_password)"
    - "src-tauri/src/lib.rs (managed state registration)"
  provides:
    - "execute_step Tauri command (three response mode branches)"
    - "cancel_plan_run Tauri command"
    - "PlanRunState managed state"
    - "ReplyMessage + StepResult IPC output structs"
  affects:
    - "src-tauri/src/lib.rs (invoke_handler + managed state)"
    - "src-tauri/src/commands/mod.rs (pub mod plan_runner)"
tech_stack:
  added:
    - "uuid = { version = '1', features = ['v4'] } — correlation_id generation"
  patterns:
    - "ephemeral lapin connection per step (not persistent)"
    - "CancellationToken acquired BEFORE first .await"
    - "DescriptorPool cloned from lock block BEFORE first .await (MutexGuard not Send)"
    - "basic_consume BEFORE basic_publish in reply modes (pitfall #59)"
    - "tokio::pin!(deadline) OUTSIDE select! loop (pitfall #4)"
    - "correlation_id from AMQP properties, NOT headers (pitfall #58)"
    - "NACK with requeue=true for non-matching correlation_id deliveries (pitfall #60)"
key_files:
  created:
    - "src-tauri/src/commands/plan_runner.rs"
  modified:
    - "src-tauri/src/commands/mod.rs"
    - "src-tauri/src/lib.rs"
    - "src-tauri/Cargo.toml"
    - "src-tauri/Cargo.lock"
decisions:
  - "encode_message is called via pool_state.clone() (State<T> is cheap to clone) rather than reconstructing the pool — this re-locks briefly and is safe since the DescriptorPool was already cloned out for decode use"
  - "AppError::AmqpError used for descriptor pool not initialized (no Internal variant exists in error.rs)"
  - "decode failure in build_reply_message returns decoded: None, decoded_as: None — step status stays 'done' per D-03"
metrics:
  duration: "6 minutes"
  completed_date: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 22 Plan 02: execute_step Rust Backend Summary

Implemented the Rust backend for plan runner sequential execution: `execute_step` Tauri command with three response mode branches, `cancel_plan_run`, and `PlanRunState` managed state. The module compiles cleanly (0 errors, 1 dead_code warning for unused `name` and `proto_path` fields that are needed for IPC deserialization).

## What Was Built

**`src-tauri/src/commands/plan_runner.rs`** — new file:
- `PlanRunState` struct with `CancellationToken` only (no JoinHandle — execute_step is directly awaited)
- `PublishTarget` enum with `serde(tag = "kind", rename_all = "lowercase")` — IPC discriminated union
- `ResponseMode` enum with `serde(tag = "mode", rename_all = "kebab-case")` — maps to TS union modes
- `PlanStep` struct (Deserialize) — the IPC input type
- `ReplyMessage` struct with `serde(rename_all = "camelCase")` — matches TS `ReplyMessageIpc`
- `StepResult` struct (Serialize) — IPC output
- `cancel_plan_run` — synchronous command, cancels token and clears slot
- `execute_step` — async command, three branches:
  - **NoWait**: publish + sleep delay_ms
  - **CorrelationId**: basic_consume → basic_publish → 10s reply loop with correlation_id match
  - **FirstArrival**: basic_consume → basic_publish → 10s reply loop, first delivery wins
- `build_reply_message` helper — decodes reply bytes via DescriptorPool + DynamicMessage; decode failure is silent (not a step error)

**`src-tauri/Cargo.toml`** — added `uuid = { version = "1", features = ["v4"] }` for correlation_id generation.

**`src-tauri/src/commands/mod.rs`** — added `pub mod plan_runner` (alphabetically placed between `encode` and `proto`).

**`src-tauri/src/lib.rs`** — added:
- `.manage(Mutex::new(Option::<commands::plan_runner::PlanRunState>::None))` after SubscribeState line
- `commands::plan_runner::execute_step` and `commands::plan_runner::cancel_plan_run` in invoke_handler

## Commits

| Hash | Description |
|------|-------------|
| f9381d2 | feat(22-02): PlanRunState, structs, cancel_plan_run + mod/lib wiring |
| 08f0ae7 | feat(22-02): wire execute_step + cancel_plan_run into lib.rs invoke_handler |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong lapin import `AMQPProperties` replaced with `BasicProperties`**
- **Found during:** Task 1 / cargo check
- **Issue:** Plan specified `lapin::protocol::basic::AMQPProperties` which does not exist in lapin 4.x
- **Fix:** Used `lapin::BasicProperties` as seen in publish.rs; builder pattern `.with_correlation_id().with_reply_to()`
- **Files modified:** src-tauri/src/commands/plan_runner.rs

**2. [Rule 1 - Bug] Wrong import `futures::StreamExt` replaced with `futures_util::StreamExt`**
- **Found during:** Task 1 (advisor review)
- **Issue:** Plan listed `futures::StreamExt` but Cargo.toml has `futures-util = "0.3"`, not `futures`
- **Fix:** Used `futures_util::StreamExt` matching subscribe.rs pattern
- **Files modified:** src-tauri/src/commands/plan_runner.rs

**3. [Rule 1 - Bug] String args to basic_consume/basic_publish converted to ShortString**
- **Found during:** Task 1 / cargo check (5 type errors)
- **Issue:** lapin 4.x requires `ShortString` not `&String` for queue_name and consumer_tag params
- **Fix:** Applied `.as_str().into()` pattern from subscribe.rs for all basic_consume and basic_publish string arguments
- **Files modified:** src-tauri/src/commands/plan_runner.rs

**4. [Rule 1 - Bug] AppError::Internal does not exist — replaced with AppError::AmqpError**
- **Found during:** Task 1 (code review of error.rs)
- **Issue:** Plan referenced `AppError::Internal("descriptor pool not initialized")` but error.rs has no `Internal` variant
- **Fix:** Used `AppError::AmqpError` consistent with consume.rs pattern
- **Files modified:** src-tauri/src/commands/plan_runner.rs

**5. [Rule 1 - Bug] Removed unused import `prost_reflect::prost::Message as ProstMessage`**
- **Found during:** Task 1 / cargo check (unused import warning)
- **Issue:** DynamicMessage::decode in prost_reflect 0.16 doesn't require explicit prost::Message import
- **Fix:** Removed the import
- **Files modified:** src-tauri/src/commands/plan_runner.rs

## Known Stubs

None — all functionality is fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced beyond what the plan's threat model (`T-22-03` through `T-22-SC`) already covers. The AMQP URI tight-scope pattern from publish.rs is followed: password dropped before first `.await`, URI dropped at block end.

## Self-Check: PASSED

- [x] `src-tauri/src/commands/plan_runner.rs` exists (created)
- [x] `cargo build` 0 errors
- [x] `f9381d2` commit present in git log
- [x] `08f0ae7` commit present in git log
- [x] `pub mod plan_runner` in mod.rs
- [x] `PlanRunState` managed state in lib.rs
- [x] `execute_step` + `cancel_plan_run` in lib.rs invoke_handler
- [x] `AppHandle` is first param of `execute_step`
- [x] `load_profile_with_password` called in execute_step body
- [x] No `.descriptor_pool` subfield
- [x] `decoded_as` present in ReplyMessage and decode logic
- [x] `AppError` return type (not String)
- [x] `basic_consume` before `basic_publish` in both reply branches
- [x] `tokio::pin!(deadline)` outside select! loop
- [x] `uuid = { version = "1", features = ["v4"] }` in Cargo.toml
