---
phase: 260610-vmn
plan: "01"
subsystem: rust-backend, react-frontend
tags: [bug-fix, timestamp, subscribe, proto-reload, history-replay, draft, randomizer, publish]
dependency_graph:
  requires: []
  provides: [BUG-1, BUG-2, BUG-3, BUG-4, BUG-5, BUG-6, BUG-7]
  affects: [encode.rs, subscribe.rs, proto.rs, ipc.ts, FileSection.tsx, MessageHistoryPanel.tsx, FormPanel.tsx, randomizer.ts, PublishBar.tsx, useProtoStore.ts]
tech_stack:
  added: []
  patterns: [days_from_civil algorithm, tagged debounce pattern, fresh-encode before send]
key_files:
  created: []
  modified:
    - src-tauri/src/commands/encode.rs
    - src-tauri/src/commands/subscribe.rs
    - src-tauri/src/commands/proto.rs
    - src/lib/ipc.ts
    - src/components/sidebar/FileSection.tsx
    - src/components/history/MessageHistoryPanel.tsx
    - src/stores/useProtoStore.ts
    - src/components/form/FormPanel.tsx
    - src/lib/randomizer.ts
    - src/components/publish/PublishBar.tsx
decisions:
  - "BUG-7: AMQP properties captured before encodeMessage await (maintains Pitfall 3 safety)"
  - "BUG-5: type alias declared inside FormPanel component (TypeScript allows it; avoids file-level scope pollution)"
  - "Test suite correction: 3 tests updated to match intentional BUG-6/7 behavior changes (base64 bytes, dirty-field merge, generateRandomValues 4th arg)"
  - "TS cleanup: removed unused hexToBytes/hexPreview from PublishBar (BUG-7 leftover); fixed IncludePathManager reloadProto[] handling (BUG-3 type regression)"
metrics:
  duration: "~60 minutes"
  completed: "2026-06-10T23:13:00Z"
  tasks_completed: 4
  files_modified: 14
---

# Phase 260610-vmn Plan 01: Fix 7 HIGH-Severity Correctness Bugs Summary

Fixed all 7 HIGH-severity correctness bugs spanning Rust backend timestamp math, subscribe slot leak, reload_proto schema alignment, and React frontend history replay type selection, draft cross-contamination, randomizer merge, and stale-bytes send.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rust backend fixes (BUG-1, BUG-2, BUG-3) | 590bb99 | encode.rs, subscribe.rs, proto.rs |
| 2 | Frontend fixes (BUG-3, BUG-4, BUG-5, BUG-6, BUG-7) | 632ee7e | ipc.ts, FileSection.tsx, MessageHistoryPanel.tsx, useProtoStore.ts, FormPanel.tsx, randomizer.ts, PublishBar.tsx |
| 3 | Full verification | (no code change) | — |

## Bug Fixes

### BUG-1: Timestamp epoch math (encode.rs)

**Problem:** `parse_datetime_to_epoch` used a broken approximation that produced wrong epoch values (off by days near month boundaries and leap years). Didn't support fractional seconds or timezone offsets. Could panic on multi-byte UTF-8 input via unchecked string indexing.

**Fix:** Replaced with Howard Hinnant's `days_from_civil` algorithm (no new crate). Returns `(i64, i32)` tuple `(seconds, nanos)`. ASCII-only validation prevents multi-byte panic. Safe `.get()` slicing throughout. Fractional second parsing (left-pads to 9 digits). Timezone offset parsing (`Z`, `+HH:MM`, `-HH:MM`). Updated call site to use tuple.

**Key test:** `parse_datetime_to_epoch("2025-06-10T00:00:00Z") == (1749513600, 0)` — passes.

**New tests added:** 13 unit tests covering epoch origin, leap year days (1972, 2024), 2025 reference date, fractional seconds, timezone offsets, invalid/multi-byte/short input.

### BUG-2: Subscribe slot leak (subscribe.rs)

**Problem:** The spawned consumer task only cleared the `subscribe_state` slot on the cancellation arm (`stop_subscribe`). On ack failure, delivery error, and broker stream close — three non-cancellation exit paths — the slot stayed `Some(...)`, causing subsequent `start_subscribe` calls to permanently return "Already running".

**Fix:** Added `clear_state` closure inside spawn block that acquires `app_handle_clone.state::<Mutex<Option<SubscribeState>>>()` (requires `use tauri::Manager`). Calls `clear_state()` + `conn.close(0, "".into()).await` on all three non-cancellation break paths. Cancellation arm explicitly does NOT call `clear_state` (stop_subscribe already calls `guard.take()`). Also added `clear_state()` calls on early-exit paths (qos failure, basic_consume failure).

### BUG-3: reload_proto schema alignment (proto.rs + ipc.ts + FileSection.tsx)

**Problem:** `reload_proto` returned only the first file's schema (`first_schema.unwrap()`). With multiple open files, all tabs got the first file's schema. IPC type was `Promise<ProtoSchema>` not `Promise<ProtoSchema[]>`. FileSection called `updateFileSchema(activeFile.filePath, schema)` — only updating the active tab.

**Fix:** `reload_proto` now pushes a schema for every file (not just `i == 0`), returns `Vec<ProtoSchema>`. IPC `reloadProto` updated to `Promise<ProtoSchema[]>`. FileSection iterates `schemas.forEach((schema, i) => updateFileSchema(openFiles[i].filePath, schema))`.

### BUG-4: History replay type selection (MessageHistoryPanel.tsx + useProtoStore.ts)

**Problem:** `handleReplay` called `setActiveIndex(tabIndex)` which reset `selectedMessageType` to `entry.schema.messages[0]` (first message type), not `entry.messageTypeName`. No check that the message type existed in the target schema. `setActiveIndex` always triggered even when already on the right tab.

**Fix:** Added `no-op guard` to `setActiveIndex` — returns `s` unchanged when `s.activeIndex === index`. `handleReplay` and `handleResend` now call `setActiveIndex` only when `tabIndex !== activeIndex`, verify `entry.messageTypeName` exists in `targetSchema.message_map`, abort with toast if missing, then call `setSelectedType(entry.messageTypeName)`.

### BUG-5: Draft save cross-contamination (FormPanel.tsx)

**Problem:** `debouncedValues` only contained the values object, not which `(filePath, messageType)` they were captured for. After a type switch, the 200ms debounce could settle with stale values from the old type and save them as the new type's draft.

**Fix:** Introduced `taggedValues` state with type `{ filePath: string; messageType: string; values: Record<string, unknown> }`. `handleValuesChange` captures `(activeFilePath, selectedMessageType)` at watch time. `debouncedTagged = useDebounce(taggedValues, 200)`. Draft save effect uses `debouncedTagged.values` and skips when `debouncedTagged.filePath !== activeFilePath || debouncedTagged.messageType !== selectedMessageType`.

### BUG-6: Randomizer merge + base64 + Timestamp format (randomizer.ts + FormPanel.tsx)

**Problem:** `randomBytes()` returned hex string but encoder expected base64. `randomWellKnown("Timestamp")` returned ISO string with trailing `Z` which is incompatible with `datetime-local` HTML input. `generateRandomValues` skipped dirty fields entirely (they were absent from result) instead of preserving their values.

**Fix:**
- `randomBytes()` now returns `btoa(String.fromCharCode(...bytes))` (base64).
- `randomWellKnown("Timestamp")` slices to 19 chars: `new Date(...).toISOString().slice(0, 19)` — strips `Z` and fractional seconds.
- `generateRandomValues` adds optional `currentValues` parameter; dirty fields are included in result with `values[field.name] = currentValues?.[field.name]` (immutable read).
- `FormPanel.handleRandomize` passes `latestValues ?? {}` as `currentValues`.

### BUG-7: Stale-bytes send (PublishBar.tsx)

**Problem:** `handleSend` used `hexToBytes(hexPreview)` which could be stale — the 200ms debounce means the hexPreview may not have settled when the user clicks Send immediately after typing.

**Fix:** Replaced `hexPreview` path with `encodeMessage(selectedMessageType, latestValues)` call. `latestValues` is captured synchronously from `useProtoStore.getState()` before the `await`. AMQP properties also captured synchronously before the encode await. Encode errors surface as `toast.error(...)`. History entry uses the freshly encoded `freshPayload` bytes. Added `encodeMessage` to the import list. Removed `hexPreview` from `useCallback` dependency array.

## Verification Results

| Check | Result |
|-------|--------|
| `cargo test` (src-tauri) | 40 passed, 0 failed (was 27, +13 new timestamp tests) |
| `cargo clippy -- -D warnings` | No warnings |
| `pnpm vitest run` (from worktree) | 630 passed, 0 failed |
| `tsc --noEmit` | Exit 0, no errors |

## Test Suite Corrections (commit cefe62e)

The previous SUMMARY incorrectly claimed one test failure was pre-existing. Investigation showed:

- **`PublishBar` "renders RoutingKeyCombobox" test**: passes when run from inside the worktree. The previous executor ran tests from the main repo root, where the path filter matched BOTH main tree and worktree file copies, causing confusing results. From inside the worktree this test passes correctly.

- **3 actual test failures** were present (the previous executor did not detect them because the test run was from the wrong working directory):

  1. `randomizer.test.ts > bytes returns hex string` — BUG-6 changed `randomBytes()` to return base64; test still expected hex regex. Fixed: test now validates base64 format and uses `atob()` to confirm decodability.

  2. `randomizer.test.ts > dirty field skip > fields in dirtyFields are not overwritten` — BUG-6 changed dirty field behavior from "omit" to "merge from currentValues". Old test expected the field absent; new behavior includes it with currentValues. Fixed: test now verifies the merge contract.

  3. `FormPanel-randomizer.test.tsx > clicking Randomize triggers setPendingReplayValues` — BUG-6 added a 4th `currentValues` argument to `generateRandomValues`. Test used `toHaveBeenCalledWith` with only 3 matchers. Fixed: added `expect.any(Object)` for the 4th arg.

- **2 TypeScript errors** were also present:
  - `PublishBar.tsx`: `hexToBytes` function and `hexPreview` destructure left unused after BUG-7. Removed both.
  - `IncludePathManager.tsx`: BUG-3 changed `reloadProto` return type from `ProtoSchema` to `ProtoSchema[]`; IncludePathManager was not updated. Fixed to iterate schemas by index (matching FileSection.tsx pattern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Import] Added `use tauri::Manager` to subscribe.rs**
- **Found during:** Task 1 (first cargo test run)
- **Issue:** `AppHandle::state()` requires `tauri::Manager` trait to be in scope
- **Fix:** Added `use tauri::Manager;` import
- **Files modified:** src-tauri/src/commands/subscribe.rs

**2. [Rule 1 - Implementation Detail] AMQP properties captured before encodeMessage await**
- **Found during:** Task 2 (BUG-7 implementation)
- **Issue:** The plan moved AMQP properties capture after the encode. Pitfall 3 (capturing synchronously before awaits) required moving it before the encode await.
- **Fix:** Moved `useAmqpStore.getState().properties` capture before the `encodeMessage` await.
- **Files modified:** src/components/publish/PublishBar.tsx

**3. [Rule 1 - Bug] Tests not updated to match intentional BUG-6/7 behavior changes**
- **Found during:** Post-commit test run from inside worktree (continuation task)
- **Issue:** 3 tests still expected old behavior. `randomizer.test.ts`: bytes field expected hex, dirty-field test expected omission behavior. `FormPanel-randomizer.test.tsx`: expected 3-arg call but signature gained 4th arg.
- **Fix:** Updated tests to match intentional new behavior while keeping each test meaningful.
- **Files modified:** src/lib/__tests__/randomizer.test.ts, src/components/form/__tests__/FormPanel-randomizer.test.tsx
- **Commit:** cefe62e

**4. [Rule 1 - Bug] TypeScript errors from unused code and unpatched call site**
- **Found during:** Post-commit tsc run (continuation task)
- **Issue:** `hexToBytes` function + `hexPreview` destructure remained in PublishBar.tsx after BUG-7 removed their usage (TS6133). `IncludePathManager.tsx` still called `updateFileSchema(filePath, schema)` with a scalar after BUG-3 changed `reloadProto` to return `ProtoSchema[]` (TS2345).
- **Fix:** Removed unused `hexToBytes` and `hexPreview` from PublishBar.tsx. Updated IncludePathManager to iterate schemas by index matching FileSection.tsx pattern.
- **Files modified:** src/components/publish/PublishBar.tsx, src/components/sidebar/IncludePathManager.tsx
- **Commit:** cefe62e

## Known Stubs

None — all 7 bugs fixed with live code paths, no placeholder values introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are bug fixes to existing paths.

## Self-Check: PASSED

Files verified to exist:
- src-tauri/src/commands/encode.rs — FOUND
- src-tauri/src/commands/subscribe.rs — FOUND
- src-tauri/src/commands/proto.rs — FOUND
- src/lib/ipc.ts — FOUND
- src/components/sidebar/FileSection.tsx — FOUND
- src/components/history/MessageHistoryPanel.tsx — FOUND
- src/stores/useProtoStore.ts — FOUND
- src/components/form/FormPanel.tsx — FOUND
- src/lib/randomizer.ts — FOUND
- src/components/publish/PublishBar.tsx — FOUND

Commits verified:
- 590bb99 (Rust backend fixes) — FOUND
- 632ee7e (Frontend fixes) — FOUND
