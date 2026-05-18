---
phase: "04"
plan: "01"
subsystem: response-queue-reader
tags: [rust, react, amqp, protobuf, tauri, zustand, tdd]
dependency_graph:
  requires:
    - "03-04 (History Filter + Replay/Resend) — useConnectionStore, useProtoStore shapes"
    - "03-03 (Message History) — RightPanel tab structure"
  provides:
    - "consume_message Tauri command (basic_get → basic_ack → decode)"
    - "useResponseStore (Zustand state for response results)"
    - "ResponseTab component (queue input + Read button + decoded field display + hex)"
    - "RightPanel extended with 3rd tab + lastReadAt auto-switch"
  affects:
    - "src/components/layout/RightPanel.tsx — 3rd tab added"
    - "src-tauri/src/lib.rs — consume_message registered in invoke_handler"
tech_stack:
  added:
    - "lapin BasicGetOptions + BasicAckOptions for consume flow"
    - "prost_reflect::SerializeOptions with use_proto_field_name + stringify_64_bit_integers"
  patterns:
    - "Ephemeral connection pattern (from publish.rs) — get → ack → close on ALL exit paths"
    - "DescriptorPool clone-before-await pattern (from encode.rs)"
    - "lastReadAt edge-detection useEffect with useRef (from prevLastSendAt in RightPanel)"
    - "vi.hoisted() for mock factories in Vitest"
key_files:
  created:
    - "src-tauri/src/commands/consume.rs"
    - "src/stores/useResponseStore.ts"
    - "src/components/response/ResponseTab.tsx"
    - "src/components/response/ResponseTab.test.tsx"
  modified:
    - "src-tauri/src/commands/mod.rs — added pub mod consume"
    - "src-tauri/src/lib.rs — registered consume_message in invoke_handler"
    - "src/lib/types.ts — added ConsumeResult interface"
    - "src/lib/ipc.ts — added consumeMessage IPC wrapper"
    - "src/components/layout/RightPanel.tsx — 3rd tab + lastReadAt auto-switch"
decisions:
  - "D-10 confirmed: ack happens before decode — poison-pill prevention over strict RESP-04 spec"
  - "use_proto_field_name=true: users see snake_case .proto field names, not lowerCamelCase"
  - "stringify_64_bit_integers=true: JS precision safety for int64/uint64 fields"
  - "ConsumeResult uses #[serde(rename_all = camelCase)] to match frontend hexString vs hex_string"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  files_changed: 9
---

# Phase 4 Plan 1: Response Queue Reader (Core Slice) Summary

Delivered the thinnest end-to-end slice of the response queue reader: a Rust `consume_message` command (basic_get → basic_ack → prost-reflect decode with use_proto_field_name), typed TypeScript plumbing (ConsumeResult type, consumeMessage IPC wrapper, useResponseStore), and a minimal ResponseTab wired as the 3rd tab in RightPanel with lastReadAt auto-switch.

## What Was Built

### Rust Backend (`src-tauri/src/commands/consume.rs`)

`consume_message` Tauri command implementing the full consume flow:
- Ephemeral AMQP connection (same pattern as publish.rs)
- `basic_get` (non-blocking — returns `None` on empty queue)
- **D-10**: Ack BEFORE decode — always. Prevents poison-pill messages from blocking queues.
- Connection closed on ALL exit paths (empty queue, ack error, decode success, decode failure)
- prost-reflect `DynamicMessage::decode` with `SerializeOptions::use_proto_field_name(true)` and `stringify_64_bit_integers(true)`
- Decode errors returned inline as `ConsumeResult { error: Some(...) }` — NOT propagated as `Err`

### TypeScript Plumbing

- `src/lib/types.ts` — `ConsumeResult` interface with camelCase field names
- `src/lib/ipc.ts` — `consumeMessage` async wrapper calling `invoke("consume_message")`
- `src/stores/useResponseStore.ts` — Zustand store following useConnectionStore pattern (typed interface + INITIAL_STATE as const)

### React Frontend

- `src/components/response/ResponseTab.tsx` — minimal slice: text input for queue name, Read button, 6 UI states (idle, no-connection, loading, empty, success, decode-error)
- `src/components/layout/RightPanel.tsx` — extended with 3rd "Response" tab + `lastReadAt` edge-detection useEffect that auto-switches to Response tab after successful reads

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `#[serde(rename_all = "camelCase")]` to ConsumeResult**
- **Found during:** Task 2a implementation planning
- **Issue:** Rust field `hex_string` would serialize as `hex_string` over IPC; TypeScript interface and all tests expect `hexString` (camelCase). Without this attribute, `result.hexString` would always be `undefined` at runtime (tests pass because they mock the IPC layer — they don't test serde serialization).
- **Fix:** Added `#[serde(rename_all = "camelCase")]` to `ConsumeResult` derive block
- **Files modified:** `src-tauri/src/commands/consume.rs`

**2. [Rule 1 - Bug] Removed unused `use prost_reflect::ReflectMessage` import**
- **Found during:** Task 2a cargo build
- **Issue:** The plan included `use prost_reflect::ReflectMessage;` inside the decode block, but `serialize_with_options` is available without importing the trait explicitly in the same scope.
- **Fix:** Removed the import. Build is now clean (0 warnings).
- **Files modified:** `src-tauri/src/commands/consume.rs`

## Known Stubs

None. The ResponseTab provides a minimal but fully functional queue name text input (no Live/Manual picker — that is planned for 04-02 and is intentional scope deferral, not a stub that breaks the current feature).

## Verification Results

| Check | Result |
|-------|--------|
| `cargo test -- consume` | 4/4 pass (bytes_to_hex_empty, bytes_to_hex_single_byte, bytes_to_hex_multiple_bytes, consume_result_empty_sentinel) |
| `npx vitest run ResponseTab.test.tsx` | 4/4 pass (happy path, empty queue, decode error, disconnected) |
| `npx tsc --noEmit` | 0 errors |
| `cargo build` | 0 errors, 0 warnings |
| grep: `pub mod consume` in mod.rs | 1 |
| grep: `consume_message` in lib.rs | 1 |
| grep: `ConsumeResult` in types.ts | 1 |
| grep: `INITIAL_STATE` in useResponseStore.ts | 3 |
| grep: `lastReadAt` in RightPanel.tsx | 4 |
| grep: `response` in RightPanel.tsx | 6 |

## Threat Surface Scan

No new threat surface beyond what the plan's threat model already covers. All T-04-01-01 through T-04-01-06 mitigations are implemented as specified.

## Self-Check: PASSED

All created files verified to exist:
- `/Users/majesnix/gits/proto-sender/src-tauri/src/commands/consume.rs` — FOUND
- `/Users/majesnix/gits/proto-sender/src/stores/useResponseStore.ts` — FOUND
- `/Users/majesnix/gits/proto-sender/src/components/response/ResponseTab.tsx` — FOUND
- `/Users/majesnix/gits/proto-sender/src/components/response/ResponseTab.test.tsx` — FOUND
