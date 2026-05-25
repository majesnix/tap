---
estimated_steps: 7
estimated_files: 3
skills_used: []
---

# T01: Added reload_proto and check_paths_exist Rust commands with invoke_handler registration and fs:allow-exists capability

**Why:** The DescriptorPool is append-only — parse_proto skips already-present files (proto.rs:36). To reflect external .proto edits, we need a command that builds a fresh pool from scratch. check_paths_exist provides batch file existence checking for stale recent-file detection without requiring fs:allow-exists capability.

**Do:**
1. In `src-tauri/src/commands/proto.rs`, add `reload_proto` command: accepts `file_paths: Vec<String>` and `include_paths: Vec<Vec<String>>` (parallel arrays — include_paths[i] applies to file_paths[i]). Builds a fresh `protox::Compiler` per file, merges all into one new `DescriptorPool`, atomically replaces the `Mutex<Option<DescriptorPool>>`. Returns `ProtoSchema` for the first file (the active one). If the previously selected message type still exists in the new schema, the frontend will preserve it.
2. Add `check_paths_exist` command: accepts `paths: Vec<String>`, returns `Vec<bool>` using `std::path::Path::new(p).exists()` for each path.
3. Register both commands in `src-tauri/src/lib.rs` invoke_handler macro.
4. Add `fs:allow-exists` to `src-tauri/capabilities/default.json` permissions array (read-only, no security risk — enables frontend exists() calls as fallback).

**Done when:** `cargo check` passes with both new commands registered; command signatures accept the documented parameters and return the documented types.

## Inputs

- `src-tauri/src/commands/proto.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/schema/extractor.rs`

## Expected Output

- `src-tauri/src/commands/proto.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`

## Verification

cd src-tauri && cargo check
