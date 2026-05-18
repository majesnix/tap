---
phase: "03"
plan: "02"
subsystem: publish
tags: [amqp, properties, zustand, tauri, rust, shadcn]
dependency_graph:
  requires: [03-01]
  provides: [useAmqpStore, AmqpPropertiesSheet, extended-publish-pipeline]
  affects: [PublishBar, publish.rs, ipc.ts]
tech_stack:
  added: [shadcn/sheet, shadcn/switch, shadcn/popover, shadcn/textarea]
  patterns: [local-draft-state, session-scoped-store, tuple-array-ipc]
key_files:
  created:
    - src/stores/useAmqpStore.ts
    - src/stores/useAmqpStore.test.ts
    - src/components/publish/AmqpPropertiesSheet.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/switch.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/textarea.tsx
  modified:
    - src/lib/ipc.ts
    - src-tauri/src/commands/publish.rs
    - src-tauri/src/error.rs
    - src/components/publish/PublishBar.tsx
decisions:
  - "Local draft state in AmqpPropertiesSheet: Apply commits, dismiss discards (not reactive to store)"
  - "TTL typed as number|null (not string sentinel) — matches Rust Option<u32> across IPC boundary"
  - "Headers as Vec<(String,String)> in Rust / Array<[string,string]> in TS per D-08 (no AmqpHeader struct)"
  - "Default content_type changed to application/octet-stream per D-04 (was application/x-protobuf)"
  - "Delivery mode uses Switch component (not RadioGroup) per plan UI-SPEC"
  - "InvalidInput AppError variant added for delivery_mode Rust validation"
metrics:
  duration_seconds: 362
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_modified: 11
---

# Phase 03 Plan 02: AMQP Properties — Summary

## One-liner

Session-scoped AMQP properties (content-type, delivery mode, TTL, correlation-id, reply-to, custom headers) with Zustand store, shadcn Sheet UI with local draft pattern, and binary tuple IPC through the Rust publish command.

## What Was Built

### Task 1: useAmqpStore + publish pipeline extension

- **`src/stores/useAmqpStore.ts`**: Session-scoped Zustand store exporting `useAmqpStore`, `AmqpProperties`, `AmqpHeader`. D-04 defaults applied: `contentType="application/octet-stream"`, `deliveryMode=2`. Implements `setProperties` (partial merge), `setHeaders`, `addHeader`, `removeHeader`, `reset`.
- **`src/stores/useAmqpStore.test.ts`**: 18 tests covering all store actions, initial state verification, and threat model mitigations.
- **`src/lib/ipc.ts`**: `publishMessage` extended with optional `amqpProps: AmqpPropsIpc` parameter. All six optional fields passed explicitly as `null` when not set (Tauri IPC requirement). Headers typed as `Array<[string, string]>` (D-08 tuple form).
- **`src-tauri/src/commands/publish.rs`**: Extended with `content_type`, `delivery_mode`, `ttl`, `correlation_id`, `reply_to`, `headers: Option<Vec<(String, String)>>` parameters. D-04 base default is `"application/octet-stream"`. TTL converted via `t.to_string().into()` (AMQP ShortString).
- **`src-tauri/src/error.rs`**: Added `InvalidInput(String)` variant.

### Task 2: AmqpPropertiesSheet + PublishBar wiring

- **`src/components/publish/AmqpPropertiesSheet.tsx`**: Sheet with local draft state (re-syncs on open). Six property controls. "Add Header" uses shadcn Popover with confirm-to-append lifecycle. "Apply Properties" commits draft to store. "Reset to defaults" resets draft without closing.
- **shadcn components**: sheet, switch, popover, textarea installed.
- **`src/components/publish/PublishBar.tsx`**: "Properties" button opens sheet. `useAmqpStore.getState()` called synchronously before `await publishMessage` (Pitfall 3 avoidance). Headers mapped to `[string, string]` tuples.

## Deviations from Plan

### Auto-added Threat Mitigations (Rule 2)

**1. [Rule 2 - T-03-02-01] Empty header key guard in useAmqpStore.addHeader**
- **Found during:** Task 1 — threat model review
- **Issue:** Plan action section didn't include the store-level key guard (only the UI Popover disabled prop)
- **Fix:** `addHeader` checks `!header.key.trim()` and returns `s` (no-op) if key is empty/whitespace
- **Files modified:** `src/stores/useAmqpStore.ts`, `src/stores/useAmqpStore.test.ts`
- **Commit:** ed583c8 (test), bbb5ae5 (implementation)

**2. [Rule 2 - T-03-02-02] Header count cap at 20 in useAmqpStore.addHeader**
- **Found during:** Task 1 — threat model review
- **Issue:** Plan action section had no cap in the store's `addHeader` action
- **Fix:** `addHeader` checks `headers.length >= 20` and returns `s` with `toast.error("Maximum 20 custom headers reached")`
- **Files modified:** `src/stores/useAmqpStore.ts`, `src/stores/useAmqpStore.test.ts`
- **Commit:** ed583c8 (test), bbb5ae5 (implementation)

**3. [Rule 2 - T-03-02-04] TTL input validation in AmqpPropertiesSheet**
- **Found during:** Task 2 — threat model review
- **Issue:** Plan action section used `Number(e.target.value)` without validation
- **Fix:** `handleTtlChange` validates `Number.isInteger(parsed) && parsed >= 0`; shows inline `ttlError` if invalid; does not commit invalid values to draft
- **Files modified:** `src/components/publish/AmqpPropertiesSheet.tsx`
- **Commit:** 1ea0ad9

**4. [Rule 2 - T-03-02-05] delivery_mode validation in Rust publish command**
- **Found during:** Task 1 — threat model review
- **Issue:** Plan action section's Rust code didn't include the validation guard
- **Fix:** `if let Some(dm) = delivery_mode { if dm != 1 && dm != 2 { return Err(AppError::InvalidInput(...)); } }` added before processing. Added `InvalidInput` variant to `AppError`.
- **Files modified:** `src-tauri/src/commands/publish.rs`, `src-tauri/src/error.rs`
- **Commit:** bbb5ae5

## Known Stubs

None — all property controls are fully wired to the store and IPC pipeline.

## Threat Flags

No new threat surface introduced beyond what is in the plan's threat model.

## TDD Gate Compliance

- RED gate: commit `ed583c8` — `test(03-02): add failing tests for useAmqpStore with threat mitigations`
- GREEN gate: commit `bbb5ae5` — `feat(03-02): implement useAmqpStore + extend publish pipeline (Rust -> ipc.ts)`
- Both gates present in git history.

## Self-Check: PASSED

- `src/stores/useAmqpStore.ts` — EXISTS
- `src/stores/useAmqpStore.test.ts` — EXISTS
- `src/components/publish/AmqpPropertiesSheet.tsx` — EXISTS
- `src/components/ui/sheet.tsx` — EXISTS
- Commit `ed583c8` (RED test) — verified
- Commit `bbb5ae5` (GREEN implementation) — verified
- Commit `1ea0ad9` (Task 2 sheet + PublishBar) — verified
- TypeScript: `npx tsc --noEmit` — CLEAN
- Vitest: 18/18 tests PASS
- Rust: `cargo build` — CLEAN (no errors)
