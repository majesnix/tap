---
id: T01
parent: S02
milestone: M001
key_files:
  - src-tauri/src/commands/proto.rs
  - src-tauri/src/lib.rs
  - src-tauri/capabilities/default.json
key_decisions:
  - reload_proto builds entirely fresh DescriptorPool rather than attempting incremental update — DescriptorPool is append-only so atomic replacement is the only correct path
  - check_paths_exist uses synchronous std::path::Path::exists() since file existence checks are fast and don't need async IO
  - Input validation rejects mismatched array lengths and empty file_paths with AppError::InvalidInput
duration: 
verification_result: passed
completed_at: 2026-05-25T19:45:10.298Z
blocker_discovered: false
---

# T01: Added reload_proto and check_paths_exist Rust commands with invoke_handler registration and fs:allow-exists capability

**Added reload_proto and check_paths_exist Rust commands with invoke_handler registration and fs:allow-exists capability**

## What Happened

Implemented two new Tauri commands in `src-tauri/src/commands/proto.rs`:

1. **`reload_proto`** — accepts parallel `file_paths: Vec<String>` and `include_paths: Vec<Vec<String>>` arrays. Validates array length parity and non-emptiness. Builds a fresh `protox::Compiler` per file, creates a new `DescriptorPool` from scratch (not append-only like `parse_proto`), merges all files into one pool, and atomically replaces the `Mutex<Option<DescriptorPool>>` state. Returns `ProtoSchema` for the first file (the active one). This enables the frontend to reflect external `.proto` edits without restarting the app.

2. **`check_paths_exist`** — accepts `paths: Vec<String>`, returns `Vec<bool>` using `std::path::Path::new(p).exists()` for each path. Enables batch file existence checking for stale recent-file detection.

Both commands were registered in the `invoke_handler` macro in `src-tauri/src/lib.rs`. Added `fs:allow-exists` to `src-tauri/capabilities/default.json` permissions array for frontend fallback exists() calls.

## Verification

Ran `cargo check` in src-tauri directory — compiled successfully with zero errors and zero warnings for the `tap` crate.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd src-tauri && cargo check` | 0 | pass | 33240ms |

## Deviations

None

## Known Issues

None

## Files Created/Modified

- `src-tauri/src/commands/proto.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
