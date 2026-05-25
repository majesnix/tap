# S02: Proto File Management — Research

**Date:** 2026-05-25

## Summary

S02 adds three capabilities: (1) reload the currently loaded .proto file without re-opening the file picker, (2) a recent files list persisted across restarts, and (3) inline include path management with auto-reload on change. The work splits cleanly into a Rust backend task (new `reload_proto` and `check_paths_exist` commands) and frontend tasks (reload button UI, recent files list, include path manager in FileSection).

The Rust `reload_proto` command is the highest-risk item. Per MEM004, `DescriptorPool` is append-only — there is no `remove_file()` API and re-calling `parse_proto` is a silent no-op due to the skip-if-exists guard (proto.rs:36). The command must build a **fresh** `DescriptorPool` and atomically replace the `Mutex<Option<DescriptorPool>>` state. It also needs to re-parse *all* currently open files (not just the active one) so the encoding pool stays complete.

Recent files and stale-file detection are straightforward frontend work using `tauri-plugin-store` (already wired) and an `exists()` call from `@tauri-apps/plugin-fs` (already a dependency but `fs:allow-exists` is **not** in `capabilities/default.json` — must be added).

## Recommendation

**Approach:** Three-task decomposition: (T01) Rust backend — `reload_proto` + `check_paths_exist` commands, (T02) Frontend — reload button + recent files list + stale detection, (T03) Frontend — include path manager inline in FileSection + auto-reload on path change + Cmd+R shortcut.

**Why this order:** T01 unblocks T02 (reload button needs the IPC command) and T03 (auto-reload on include path change calls the same command). T02 and T03 are partially independent — T02 is the recent files list, T03 is the include path manager — but T03 depends on `reload_proto` from T01.

## Implementation Landscape

### Key Files

- `src-tauri/src/commands/proto.rs` — Currently has only `parse_proto`. Add `reload_proto` (fresh pool rebuild) and `check_paths_exist` (batch file existence check via `std::path::Path::exists()`).
- `src-tauri/src/lib.rs:32-51` — `invoke_handler` macro: must register new commands. Pool state is at line 117: `Mutex::new(Option::<prost_reflect::DescriptorPool>::None)`.
- `src-tauri/capabilities/default.json` — Must add `"fs:allow-exists"` to permissions array for stale file detection from frontend.
- `src/lib/ipc.ts` — Add `reloadProto()` and `checkPathsExist()` IPC wrappers.
- `src/stores/useProtoStore.ts` — Add `recentFiles: string[]` (capped at 10), `addRecentFile()`, `reloadRequested` counter (same pattern as `sendRequested`/`openFileRequested`), and `updateFileSchema()` action for reload.
- `src/components/sidebar/FileSection.tsx` — Primary UI surface: add Reload button, recent files list, and inline include path editor. Currently handles file open flow and include path dialog.
- `src/components/include-paths/IncludePathDialog.tsx` — Existing dialog; may be reused for include path editing or replaced with inline controls in FileSection.
- `src/components/layout/AppLayout.tsx` — Add Cmd+R keyboard shortcut for reload (same useHotkeys pattern from S01).

### Build Order

**T01 (Rust backend) first** — `reload_proto` is the highest-risk item and unblocks all frontend work. It must:
1. Accept `file_paths: Vec<String>` and `include_paths: Vec<Vec<String>>` (one set per file) or iterate open files from frontend state.
2. Build a fresh `protox::Compiler`, open all files, produce a new `DescriptorPool`.
3. Replace the `Mutex<Option<DescriptorPool>>` atomically.
4. Return the `ProtoSchema` for the *active* file (so the frontend can update the form).

**Design decision — who tracks open files for reload?** The frontend (useProtoStore) already tracks `openFiles[]` with `filePath` and saved include paths in `tap.json`. The simplest approach: `reload_proto` accepts the same `(file_path, include_paths)` as `parse_proto` but rebuilds the pool from scratch. The frontend calls it for the active file first, then calls `parse_proto` for each remaining open file to re-populate the pool. Alternatively, a single `reload_all_protos` command accepts all file+include pairs. The single-command approach is cleaner — one IPC round-trip, one pool rebuild.

**T02 (Recent files + reload UI) second** — Can proceed once T01 is merged. Adds:
- `recentFiles` array in useProtoStore (persisted via tap.json key `recent_files`).
- Recent files list in FileSection with disabled styling for stale entries (uses `check_paths_exist` or frontend `exists()` from `@tauri-apps/plugin-fs`).
- Reload button in FileSection header (calls `reloadProto` IPC).

**T03 (Include path manager + auto-reload) third** — Extends FileSection with:
- Inline include path display/edit for the active file (replaces or supplements IncludePathDialog).
- Auto-reload trigger when include paths change.
- Cmd+R shortcut in AppLayout (useHotkeys, same pattern as S01).

### Constraints and Risks

1. **DescriptorPool is append-only** (MEM004): `reload_proto` must construct a fresh pool. Cannot incrementally update. The existing `parse_proto` merge logic (proto.rs:28-43) that skips already-present files will not work for reload.

2. **`fs:allow-exists` capability missing**: `capabilities/default.json` does not include `fs:allow-exists`. This must be added for the frontend to call `exists()` from `@tauri-apps/plugin-fs` for stale file detection. Alternative: use the new `check_paths_exist` Rust command (no capability change needed, but adds IPC round-trip).

3. **Recent files persistence**: Use `tap.json` store with key `recent_files` (string array, max 10). Push on file open, deduplicate, trim oldest. Load on app start.

4. **Reload must preserve selected message type**: After reload, if the previously selected message type still exists in the new schema, keep it selected. If it was removed/renamed, fall back to first message type.

5. **Include path auto-reload**: When the user changes include paths for the active file, save to store and immediately call `reload_proto`. If the reload fails (bad include path), show the parse error but keep the old schema loaded.

6. **No new Rust crates needed**: `std::path::Path::exists()` is stdlib. `protox` and `prost-reflect` are already dependencies.

### Patterns to Follow

- **Monotonic counter signal** (from S01): `reloadRequested` counter in useProtoStore for cross-component reload trigger (Cmd+R in AppLayout → FileSection listener).
- **`useHotkeys` registration** (from S01): Cmd+R shortcut in AppLayout, same inhibit rules.
- **`tap.json` store pattern**: Already used for include paths (`include_paths:{filePath}`) and theme. Add `recent_files` key.
- **Error display**: Existing `parseError` state in FileSection for showing reload failures.

### Verification

- `cargo check` — Rust backend compiles with new commands.
- `pnpm tsc --noEmit` — Frontend type-checks with new IPC wrappers and store additions.
- `pnpm vitest run` — All existing tests pass, new tests cover: reload_proto IPC mock, recent files list management (add/deduplicate/cap/persist), stale file detection, include path change triggering reload.
- Manual: Edit a .proto file externally → click Reload → see updated schema in form.

### Don't Hand-Roll

- **File existence check**: Use `std::path::Path::exists()` in Rust (stdlib) or `exists()` from `@tauri-apps/plugin-fs` in frontend. Both are established.
- **Store persistence**: `tauri-plugin-store` already handles atomic writes and cross-platform paths. No custom file I/O.

### Open Questions Resolved

- **`fs:allow-exists` capability**: NOT present in `capabilities/default.json`. Two options: (a) add it — simplest, allows frontend `exists()` calls, or (b) use `check_paths_exist` Rust command — avoids capability change but adds IPC. **Recommendation**: Add `fs:allow-exists` capability — it's a read-only permission with no security risk, and aligns with existing `fs:scope` patterns.

- **Reload scope**: Reload rebuilds the pool for ALL open files, not just the active one. The frontend sends all `(filePath, includePaths)` pairs. The Rust command returns the schema for the requested active file.
