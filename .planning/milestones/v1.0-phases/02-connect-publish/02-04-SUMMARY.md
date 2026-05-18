---
phase: 02-connect-publish
plan: "04"
subsystem: publish-message
tags: [rust, tauri, lapin, react, publish, sonner, zustand, shadcn]
dependency_graph:
  requires: [02-03-PLAN.md]
  provides: [publish-message, sonner-toasts, buildPublishArgs, publ-01, publ-02]
  affects:
    - src-tauri/src/commands/publish.rs
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/components/publish/PublishBar.tsx
    - src/App.tsx
    - src/components/publish/__tests__/PublishBar.test.tsx
    - src/components/ui/sonner.tsx
tech_stack:
  added: [sonner (via shadcn)]
  patterns:
    - Ephemeral lapin connection per publish (connect, publish, close — no persistent state)
    - tokio::time::timeout(10s) on Connection::connect — same as test_connection
    - AMQP default exchange = "" (empty string) for PUBL-01 queue-direct publish
    - buildPublishArgs pure function for testable PUBL-01/PUBL-02 routing logic
    - vi.hoisted() for Vitest module-scope mock with hoisted vi.mock() factory
    - isSending state flag for double-submit prevention (D-19)
key_files:
  created:
    - src-tauri/src/commands/publish.rs
    - src/components/ui/sonner.tsx
  modified:
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/components/publish/PublishBar.tsx
    - src/App.tsx
    - src/components/publish/__tests__/PublishBar.test.tsx
decisions:
  - "lapin basic_publish takes ShortString — must use .into() on &str args (not &String or .as_str())"
  - "vi.hoisted() required for toastMock — plain const at module scope fails Vitest hoisting"
  - "buildPublishArgs exported as pure function for testable PUBL-01/PUBL-02 routing logic without component render"
  - "load_profile_with_password changed to pub(crate) to allow use from publish.rs"
metrics:
  duration: "~10 min"
  completed: "2026-05-17"
  tasks_completed: 2
  files_changed: 9
---

# Phase 02 Plan 04: Publish Message — Vertical Slice 4 Summary

**One-liner:** Ephemeral lapin publish_message command with PUBL-01/PUBL-02 routing, Sonner toasts (3s success / 5s error), spinner + double-submit guard, form retains values — completes Phase 2 end-to-end journey.

## What Was Built

Vertical slice 4 of the connect-publish system. Completes Phase 2. Users can now:
1. Fill out the proto form, select a queue or exchange, click Send
2. Binary protobuf message is published to RabbitMQ via an ephemeral lapin connection
3. Success: "Message sent to [target]" toast appears for 3 seconds, non-blocking
4. Failure: "Send failed: [error]" destructive toast appears for 5 seconds
5. Form field values are retained after a successful send (no auto-reset)
6. Send button shows a spinner and is disabled during in-flight publish (double-submit prevention)
7. PUBL-01 (queue direct): exchange = "" (AMQP default exchange), routing_key = queue_name
8. PUBL-02 (named exchange + routing key): exchange = selected exchange, routing_key = explicit key

## Tasks

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Rust backend — publish_message command using ephemeral lapin connection | 8729375 | Complete |
| 2 | Frontend — IPC publishMessage, Sonner toasts, PublishBar handleSend wired, App.tsx Toaster | b6b3ff6 | Complete |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lapin basic_publish takes ShortString, not &String or &str**

- **Found during:** Task 1 (cargo build)
- **Issue:** The plan code passed `&exchange` and `&routing_key` (both `&String`) to `basic_publish`. The lapin 4.7.4 API expects `ShortString` for both the exchange and routing_key parameters. The compiler reported "expected `ShortString`, found `&String`".
- **Fix:** Changed to `exchange.as_str().into()` and `routing_key.as_str().into()` — the `.into()` converts `&str` to `ShortString` via the `From<&str>` impl.
- **Files modified:** src-tauri/src/commands/publish.rs
- **Commit:** 8729375

**2. [Rule 1 - Bug] vi.hoisted() required for toastMock — plain const at module scope fails**

- **Found during:** Task 2 (test run)
- **Issue:** The plan specified `const toastMock = Object.assign(vi.fn(), { error: vi.fn() })` at module scope before `vi.mock("sonner", ...)`. Vitest hoists `vi.mock()` factory functions before any variable declarations in the module — including `const` at the top of the file. The factory closed over `toastMock` which was not yet initialized at hoist time, causing `ReferenceError: Cannot access 'toastMock' before initialization`.
- **Fix:** Used `vi.hoisted()` to create the mock variable inside the hoisted block, ensuring it is initialized before the factory runs: `const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }))`.
- **Files modified:** src/components/publish/__tests__/PublishBar.test.tsx
- **Commit:** b6b3ff6

## Verification

| Check | Result |
|-------|--------|
| `cargo build` exits 0 | PASS (0 errors, 0 warnings) |
| `cargo test -- publish::tests` 1/1 | PASS |
| `npm test -- PublishBar.test.tsx` 9/9 | PASS (3 new + 6 existing) |
| `npx tsc --noEmit` exits 0 | PASS |
| `grep "with_content_type" publish.rs \| wc -l` >= 1 | PASS (3) |
| `grep "tokio::time::timeout" publish.rs \| wc -l` >= 1 | PASS (3) |
| `grep "tokio::spawn" publish.rs` returns nothing | PASS (0 matches) |
| `grep "publish_message" lib.rs \| wc -l` >= 1 | PASS (3) |
| `grep "Message sent to" PublishBar.tsx \| wc -l` >= 1 | PASS (3) |
| `grep "Send failed:" PublishBar.tsx \| wc -l` >= 1 | PASS (4) |
| `grep "duration: 3000" PublishBar.tsx \| wc -l` >= 1 | PASS (3) |
| `grep "duration: 5000" PublishBar.tsx \| wc -l` >= 1 | PASS (3) |
| `grep 'exchange.*""' PublishBar.tsx \| wc -l` >= 1 | PASS (4) |
| `grep "buildPublishArgs" PublishBar.tsx \| wc -l` >= 2 | PASS (5) |
| `grep "buildPublishArgs" PublishBar.test.tsx \| wc -l` >= 1 | PASS (7) |
| App.tsx contains `<Toaster />` | PASS |
| `vi.mock.*sonner` at line <= 15 | PASS (line 10) |
| `const toastMock` at line <= 15 | PASS (line 9) |

## Security Verification (Threat Model)

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-02-15: AMQP URI information disclosure | URI built locally, `drop(password)` called immediately after use, `tracing::debug!` logs only exchange + routing_key — never URI or password | Code review confirms no password/URI in tracing calls |
| T-02-16: publish_message hangs on unreachable broker | `tokio::time::timeout(Duration::from_secs(10), ...)` wraps Connection::connect | grep confirmed |
| T-02-19: Double-submit on Send button | `isSending` state flag: `disabled={!canSend \|\| isSending}` + Loader2 spinner | Code review confirms |

## Known Stubs

None — all publish functionality is fully wired. The `handleSend` stub from 02-03 is replaced with the real implementation.

## Threat Flags

None — no new network surface beyond what is in the plan's threat model.

## Self-Check

- [x] src-tauri/src/commands/publish.rs exists: FOUND
- [x] src/lib/ipc.ts contains publishMessage: FOUND
- [x] src/components/publish/PublishBar.tsx exports buildPublishArgs: FOUND
- [x] src/App.tsx contains Toaster: FOUND
- [x] src/components/ui/sonner.tsx exists: FOUND
- [x] commit 8729375 exists: FOUND
- [x] commit b6b3ff6 exists: FOUND

## Self-Check: PASSED
