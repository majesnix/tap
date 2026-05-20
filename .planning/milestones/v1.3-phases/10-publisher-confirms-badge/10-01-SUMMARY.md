---
phase: 10-publisher-confirms-badge
plan: "01"
subsystem: rust-backend
tags: [publisher-confirms, amqp, lapin, rust, ipc]
dependency_graph:
  requires: []
  provides: [PublishOutcome-struct, publish_message-returns-outcome]
  affects: [src-tauri/src/commands/publish.rs]
tech_stack:
  added: []
  patterns: [tokio-timeout, lapin-Confirmation-match, serde-Serialize-flat-struct]
key_files:
  created: []
  modified: [src-tauri/src/commands/publish.rs]
decisions:
  - "Confirmation imported as lapin::Confirmation (public re-export), not lapin::publisher_confirm::Confirmation (private module) — verified from lapin 4.7.4 lib.rs source"
  - "mandatory=true set unconditionally on every basic_publish call (D-04) — no conditional flag"
  - "Timeout outcome is Ok(PublishOutcome { status: 'timeout' }), not Err — delivery outcome not command error (D-03)"
  - "Connection closed in timeout Err(_elapsed) branch before returning (Pitfall 2 / T-10-01-03)"
metrics:
  duration: "3m"
  completed: "2026-05-19"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 10 Plan 01: Publisher Confirms Badge — Rust Backend Summary

**One-liner:** Added `PublishOutcome` struct and rewrote the confirm block in `publish_message` to return structured ACK/NACK/Returned/Timeout delivery outcomes with mandatory=true and 5-second timeout.

## What Was Built

Modified `src-tauri/src/commands/publish.rs` with all six changes required by plan 10-01:

1. **`PublishOutcome` struct** — flat `#[derive(Debug, serde::Serialize)]` struct with `pub status: String`; added immediately before `publish_message` function.

2. **Function signature** — `publish_message` now returns `Result<PublishOutcome, AppError>` instead of `Result<(), AppError>` (D-01).

3. **`mandatory=true`** — `BasicPublishOptions::default()` replaced with `BasicPublishOptions { mandatory: true, ..Default::default() }` on every publish (D-04).

4. **5-second timeout** — `tokio::time::timeout(Duration::from_secs(5), confirm_future).await` wraps the broker confirmation future; elapsed returns `Ok(PublishOutcome { status: "timeout" })` with connection closed (D-03, Pitfall 2).

5. **Full `Confirmation` match** — all four variants handled: `Ack(None)→"ack"`, `Ack(Some(_))→"returned"`, `Nack(_)→"nack"`, `NotRequested→"ack"` (D-05).

6. **New unit test** — `publish_outcome_status_values_are_lowercase` documents the IPC contract for the TypeScript string union.

## Scope Note

This plan delivers the **Rust backend only**. The frontend changes (ipc.ts return type, PublishOutcome TypeScript interface in types.ts, PublishBar.tsx badge state and rendering) are in plan 10-02. Requirements PUBL-05 through PUBL-08 are enabled by this backend change but not yet fully deliverable until the frontend plan completes.

## Verification Results

All plan verification checks passed:

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "pub struct PublishOutcome"` | 1 | 1 |
| `grep -c "mandatory: true"` | 1 | 1 |
| `grep -c "tokio::time::timeout"` | 2 | 2 |
| `grep -c "Confirmation::Ack(Some"` | 1 | 1 |
| `grep -c "Result<PublishOutcome"` | 1 | 1 |
| `cargo check` | exits 0 | Finished dev |
| `cargo test` | all pass | 21 passed (3 suites) |

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PublishOutcome struct and rewrite confirm block | 2e87f05 | src-tauri/src/commands/publish.rs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Confirmation import path**
- **Found during:** Task 1 verification (cargo check)
- **Issue:** Plan specified `use lapin::publisher_confirm::Confirmation` but `publisher_confirm` is a private module in lapin 4.7.4. The enum is publicly re-exported as `lapin::Confirmation`.
- **Fix:** Changed import to `lapin::Confirmation` within the existing `use lapin::{ ... }` block.
- **Files modified:** src-tauri/src/commands/publish.rs
- **Commit:** 2e87f05 (included in task commit — single-pass fix)

All other plan instructions were applied exactly as specified.

## Threat Surface Scan

No new attack surface introduced. `PublishOutcome.status` is set entirely in Rust from the broker's `Confirmation` enum — no user input can influence the status value. The existing WR-01 password URI scope pattern is unchanged. T-10-01-03 (connection leak on timeout) is mitigated: `conn.close()` is called in the `Err(_elapsed)` branch before returning.

## Known Stubs

None — all four status values are wired to concrete `Confirmation` variants from the broker.

## Self-Check: PASSED

- [x] `src-tauri/src/commands/publish.rs` exists and contains all required changes
- [x] Commit 2e87f05 exists in git log
- [x] `cargo check` exits 0
- [x] `cargo test` passes 21 tests including `publish_outcome_status_values_are_lowercase`
