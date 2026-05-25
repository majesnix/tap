---
phase: "22-plan-runner-sequential-execution"
plan: "01"
subsystem: "frontend-types-ipc"
tags: ["typescript", "types", "ipc", "zustand", "plan-runner"]
dependency_graph:
  requires: []
  provides:
    - "stop_on_error field on Plan type (D-07)"
    - "ReplyMessage and StepResult interfaces (D-02, D-03)"
    - "StepResultIpc and ReplyMessageIpc IPC interfaces (D-01, D-03)"
    - "executeStep() and cancelPlanRun() invoke wrappers (D-01, D-04)"
    - "updatePlan() store action with optimistic rollback (D-08)"
  affects:
    - "src/lib/types.ts"
    - "src/lib/ipc.ts"
    - "src/stores/usePlanStore.ts"
tech_stack:
  added: []
  patterns:
    - "Optimistic-write + rollback pattern (mirrors renamePlan)"
    - "Asymmetric Rust serde convention: snake_case StepResult top-level, camelCase ReplyMessage via rename_all"
key_files:
  created: []
  modified:
    - "src/lib/types.ts"
    - "src/lib/ipc.ts"
    - "src/stores/usePlanStore.ts"
decisions:
  - "D-07: stop_on_error optional on Plan; absence treated as true; isPlan() guard unchanged for backward compat"
  - "D-01: executeStep() maps only step_id→stepId; reply passed through as-is (Rust rename_all='camelCase')"
  - "D-03: ReplyMessageIpc has exactly 5 camelCase fields; no raw_bytes, no exchange"
  - "D-08: updatePlan follows exact renamePlan optimistic-write + rollback pattern"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 22 Plan 01: TypeScript Foundation — stop_on_error, ReplyMessage, IPC wrappers, updatePlan

**One-liner:** TypeScript foundation for plan runner: stop_on_error on Plan, ReplyMessage/StepResult types, StepResultIpc/ReplyMessageIpc IPC interfaces, executeStep/cancelPlanRun invoke wrappers, and updatePlan optimistic store action.

## What Was Built

### Task 1: Type Contract Extension (types.ts + ipc.ts types)

- Added `stop_on_error?: boolean` to the `Plan` interface with JSDoc noting absence = true (D-07). No schema_version bump. `isPlan()` guard unchanged — old plans without the field pass without modification.
- Added `ReplyMessage` interface to `types.ts`: `routingKey`, `contentType`, `decoded`, `decodedAs`, `hexString`. The `decoded` field is `null` when protobuf decode fails (not a step error). `decodedAs` is `step.message_type` on success, null on failure.
- Added `StepResult` interface to `types.ts`: `stepId`, `status: 'done' | 'error'`, `reply: ReplyMessage | null`, `error: string | null`.
- Added `ReplyMessageIpc` interface to `ipc.ts`: exactly 5 camelCase fields matching what Rust serializes under `#[serde(rename_all = "camelCase")]`. No `raw_bytes` (internal only), no `exchange` (not in Rust IPC shape).
- Added `StepResultIpc` interface to `ipc.ts`: snake_case top-level (`step_id`) because Rust does NOT apply `rename_all` to `StepResult`.

### Task 2: Invoke Wrappers + Store Action (ipc.ts + usePlanStore.ts)

- Added `executeStep(profileName, step)` → `Promise<StepResult>`: invokes `execute_step`, maps only `step_id → stepId` at top level; `reply` is passed through without remapping (already camelCase from Rust).
- Added `cancelPlanRun()` → `Promise<void>`: void invoke for `cancel_plan_run` (D-04).
- Added `updatePlan(id, partial)` to `PlanStore` interface and implementation, following the exact `renamePlan` optimistic-write + rollback pattern (D-08).

## Verification

All plan success criteria met:

- `npx tsc --noEmit` passes with 0 errors
- `stop_on_error?: boolean` present on `Plan` with JSDoc noting default-true
- `ReplyMessage` and `StepResult` exported from `types.ts`
- `StepResultIpc` and `ReplyMessageIpc` in `ipc.ts` — `ReplyMessageIpc` has exactly 5 fields (routingKey, contentType, decoded, decodedAs, hexString), all camelCase, no raw_bytes, no exchange
- `executeStep()` and `cancelPlanRun()` exported from `ipc.ts`
- `executeStep()` maps only `step_id → stepId`; reply passed through as-is
- `updatePlan()` in both `PlanStore` interface and implementation with rollback
- `isPlan()` guard does NOT check `stop_on_error` (backward compat D-07)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b92595f | feat(22-01): add stop_on_error, ReplyMessage, StepResult, StepResultIpc, ReplyMessageIpc |
| 2 | 8a412ac | feat(22-01): add executeStep, cancelPlanRun wrappers and updatePlan store action |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All interfaces are fully defined. No hardcoded empty values or placeholder text.

## Threat Flags

No new security-relevant surface introduced. This plan adds TypeScript type definitions and IPC wrappers only — no new network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- [x] src/lib/types.ts modified — contains stop_on_error, ReplyMessage, StepResult
- [x] src/lib/ipc.ts modified — contains StepResultIpc, ReplyMessageIpc, executeStep, cancelPlanRun
- [x] src/stores/usePlanStore.ts modified — contains updatePlan in interface + implementation
- [x] Commit b92595f exists: feat(22-01): add stop_on_error, ReplyMessage, StepResult, StepResultIpc, ReplyMessageIpc
- [x] Commit 8a412ac exists: feat(22-01): add executeStep, cancelPlanRun wrappers and updatePlan store action
- [x] TypeScript compiles with 0 errors
