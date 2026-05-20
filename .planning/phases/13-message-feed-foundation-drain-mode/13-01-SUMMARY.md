---
phase: 13-message-feed-foundation-drain-mode
plan: "01"
subsystem: api
tags: [rust, tauri, amqp, protobuf, prost-reflect, lapin, typescript, ipc]

# Dependency graph
requires:
  - phase: 12-block-library-drag-and-drop-layer
    provides: existing consume_message + bytes_to_hex pattern in consume.rs
provides:
  - drain_messages Rust command with multi-type first-success decode (D-19)
  - DrainResult struct (8 fields including decoded_as)
  - DrainOutcome struct (messages + partial_error)
  - TypeScript DrainResult, DrainOutcome, FeedMessage interfaces (all with decodedAs)
  - drainMessages IPC function (profileName, queueName, messageTypeNames, count)
affects:
  - 13-02: MessageFeed store and FIFO-500 state management
  - 13-03: ConsumePanel UI wiring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "multi-type first-success decode: iterate message_type_names, break 'candidates on first Ok (D-19)"
    - "partial_error pattern: mid-loop basic_get errors preserved; already-acked messages returned (D-18)"
    - "ack-before-decode per message in drain loop (mirrors D-14 from consume_message)"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/consume.rs
    - src-tauri/src/lib.rs
    - src/lib/types.ts
    - src/lib/ipc.ts

key-decisions:
  - "basic_get arg uses .as_str().into() (ShortString coercion) to match lapin 4.7.4 API — aligned with consume_message pattern"
  - "pool cloned as Option<DescriptorPool> before await — None handled per-message (not early-error) to preserve drain progress"
  - "TDD via struct construction sentinels — AMQP commands require AppHandle+State, so integration tests are out of scope"

patterns-established:
  - "Drain loop: for _ in 0..count, stop on Ok(None) or Err, ACK before decode"
  - "First-success candidate loop: 'candidates: for type_name in &message_type_names; break 'candidates on decode + serialize success"

requirements-completed: [CONS-03, CONS-08]

# Metrics
duration: 20min
completed: 2026-05-20
---

# Phase 13 Plan 01: drain_messages Rust command + TypeScript IPC contract

**drain_messages Rust command with multi-type first-success decode (D-19), DrainResult/DrainOutcome/FeedMessage TypeScript interfaces, and drainMessages IPC function exposing messageTypeNames: string[] to the frontend**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-20T21:00:00Z
- **Completed:** 2026-05-20T21:20:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added DrainResult (8 fields: routingKey, exchange, contentType, timestamp, decoded, hexString, error, decoded_as/decodedAs) and DrainOutcome (messages + partial_error) Rust structs
- Implemented drain_messages Rust command: validates inputs, drains up to count messages via basic_get loop, acks each message before decode (D-14), iterates candidate message type names in order with first-success-wins semantics (D-19), sets partial_error on mid-loop basic_get errors (D-18)
- Registered drain_messages in lib.rs invoke_handler; exported DrainResult, DrainOutcome, FeedMessage TypeScript interfaces and drainMessages() IPC function

## Task Commits

Each task was committed atomically:

1. **TDD RED: Failing struct sentinels** - `0b243ff` (test)
2. **Task 1: drain_messages command** - `e522ae4` (feat)
3. **Task 2: lib.rs registration + TypeScript IPC contract** - `1eb4723` (feat)

## Files Created/Modified

- `src-tauri/src/commands/consume.rs` - Added DrainResult, DrainOutcome structs and drain_messages command; TDD sentinel tests
- `src-tauri/src/lib.rs` - Registered commands::consume::drain_messages in invoke_handler!
- `src/lib/types.ts` - Added DrainResult, DrainOutcome, FeedMessage interfaces (Phase 13 block)
- `src/lib/ipc.ts` - Added DrainOutcome to import; added drainMessages() function

## Decisions Made

- Used `.as_str().into()` for basic_get queue_name arg to match lapin 4.7.4 ShortString coercion requirement (aligned with consume_message pattern in same file)
- Pool is cloned as `Option<DescriptorPool>` (not unwrapped), allowing None to be handled per-message rather than early-exit — this preserves drain progress when schema is not loaded
- TDD RED phase uses struct construction sentinels because drain_messages takes AppHandle + State which cannot be tested in unit isolation; mirrors existing consume.rs test pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] basic_get arg type mismatch**
- **Found during:** Task 1 (GREEN phase, first cargo build)
- **Issue:** Plan verbatim code used `&queue_name` but lapin 4.7.4 `basic_get` expects `ShortString`, not `&String` — compile error E0308
- **Fix:** Changed to `queue_name.as_str().into()` — identical to the verified pattern in consume_message (line 103)
- **Files modified:** src-tauri/src/commands/consume.rs
- **Verification:** cargo build exits 0; all 24 tests pass
- **Committed in:** e522ae4 (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking compile error)
**Impact on plan:** Minor type coercion alignment; no behavior change. No scope creep.

## Issues Encountered

None beyond the auto-fixed basic_get arg type mismatch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- drain_messages Rust command is live and registered; TypeScript IPC contract (DrainResult, DrainOutcome, FeedMessage, drainMessages) is exported and ready for consumption
- Plan 13-02 (MessageFeed store + FIFO-500 state) can import FeedMessage and drainMessages directly
- Plan 13-03 (ConsumePanel UI wiring) has the full IPC contract it needs

## Self-Check: PASSED

- src-tauri/src/commands/consume.rs: FOUND (DrainResult, DrainOutcome, drain_messages)
- src-tauri/src/lib.rs: FOUND (drain_messages registered)
- src/lib/types.ts: FOUND (DrainResult, DrainOutcome, FeedMessage)
- src/lib/ipc.ts: FOUND (drainMessages function)
- Commits: 0b243ff, e522ae4, 1eb4723 all in git log

---
*Phase: 13-message-feed-foundation-drain-mode*
*Completed: 2026-05-20*
