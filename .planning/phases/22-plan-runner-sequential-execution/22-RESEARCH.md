# Phase 22: Plan Runner — Sequential Execution - Research

**Researched:** 2026-05-24
**Domain:** Tauri 2.x + Rust/lapin AMQP + React/Zustand sequential execution engine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rust Command API**
- D-01: New `execute_step` Tauri command — one command handles a single step atomically: publish + reply-wait (if applicable). JS runner loop calls `execute_step` per step, awaiting each before moving to the next.
- D-02: `execute_step` signature: `(profile_name, publish_args, response_mode) → StepResult`. `StepResult` is `{ status: "done" | "error", error: Option<String>, reply: Option<ReplyMessage> }`. `ReplyMessage` mirrors the decoded-reply struct from `ConsumeResult` (decoded fields + hex_string).
- D-03: `execute_step` uses `pool_state` (same `Mutex<Option<DescriptorPool>>` pattern as `consume_message`) to decode the reply payload in Rust. No two-hop decode.
- D-04: Cancellation: a separate `cancel_plan_run` Tauri command flips a `PlanRunState` `CancellationToken`. `execute_step` uses `tokio::select!` on three branches: delivery match / timeout / cancellation token (ROADMAP pitfall #70). Stop resolves with `{ status: "error", error: "Cancelled" }`.
- D-05: `PlanRunState` is a separate managed-state slot in `lib.rs` (parallel to `SubscribeState`). Pattern: `Mutex<Option<PlanRunState>>` where `PlanRunState { token: CancellationToken }`. No JoinHandle needed.
- D-06: AMQP ordering: consumer MUST be opened before publish (pitfall #59). `correlation_id` read from AMQP delivery properties (pitfall #58). Non-matching correlation-id replies: selectively NACKed and requeued (pitfall #60).

**Stop-on-Error**
- D-07: Add `stop_on_error: boolean` to `Plan` interface in `src/lib/types.ts`. Default `true`. Optional on load — missing defaults to `true` (no schema_version bump; update `isPlan()` guard).
- D-08: `stop_on_error` toggle in the run controls bar (shadcn `Switch` + label). Persists via `usePlanStore.updatePlan(planId, { stop_on_error: value })`.

**Run Mode UX**
- D-09: Phase 21 two-pane layout stays intact during a run. Inputs disabled (read-only) while running.
- D-10: Actively-executing step highlighted with same background tint as selection. Step list auto-scrolls. StepFieldEditor auto-switches to active step.
- D-11: Run summary inline in run controls bar after completion. "Re-run" button resets statuses and starts new run.

**Run Controls Placement**
- D-12: Sticky header bar at top of `PlanDetailPanel`. Layout: `[Plan name (truncated)] | [Stop on error toggle] | [Run / Stop button]`.
- D-13: Run button disabled guards: (a) zero steps, (b) no active connection profile.

**Execution State Store**
- D-14: New `usePlanExecutionStore` (Zustand, ephemeral). Holds: `runningPlanId`, `stepStatuses`, `activeStepId`, `isCancelling`.
- D-15: JS runner loop lives in `usePlanRunner` hook. Orchestrates iterate → invoke → update status → check stop_on_error → continue or abort.

### Claude's Discretion

- `StepResult` / `ReplyMessage` Rust struct field names — follow existing `ConsumeResult` / `DrainResult` naming conventions.
- `execute_step` publish args struct shape — reuse `publish_message` parameter structure.
- `usePlanRunner` hook file location — `src/hooks/usePlanRunner.ts` or co-located in `src/components/plans/`.
- No-wait step timing: `delay_ms: 0` = `tokio::time::sleep(Duration::from_millis(0))` (effectively a yield).

### Deferred Ideas (OUT OF SCOPE)

- RESP-04 / RESP-05 (decoded response inline under step + shared reply feed) — Phase 23 scope.
- Pause / Resume mid-run — Future Requirement.
- Variable extraction across steps — deferred to v2.
- Per-step timeout override in UI — field already exists in type; Phase 22 reads it; no additional UI needed.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | User can run a plan sequentially — steps execute one at a time in order | `usePlanRunner` for-loop pattern; JS awaits `execute_step` per step |
| RUN-02 | User can stop a running plan at any time | `cancel_plan_run` command + CancellationToken; `isCancelling` state gate |
| RUN-03 | Each step shows a status badge (Pending / Sending / WaitingResponse / Done / Error) | `usePlanExecutionStore.stepStatuses`; badge components in StepListPanel |
| RUN-04 | Per-plan stop-on-error / continue-on-error setting | `stop_on_error: boolean` field on Plan; `isPlan()` guard update |
| RUN-05 | Run summary on completion (N/M succeeded) | Computed from `stepStatuses` after run completes; inline in PlanRunBar |
| RUN-06 | No-wait steps advance after configurable delay (default 200 ms) | `tokio::time::sleep(Duration::from_millis(delay_ms))` in no-wait branch |
| RESP-01 | No-wait steps fire publish + advance after delay; no reply consumer opened | `execute_step` early-return path for `no-wait` mode |
| RESP-02 | CorrelationId: generate UUID, set correlation_id + reply_to, open consumer before publish, match reply, timeout=10s default | uuid v1.x crate; `basic_consume` before `basic_publish`; three-branch `tokio::select!` |
| RESP-03 | First-arrival: consumer on specified reply queue, accept first arrival, timeout=10s default | Same consumer-first ordering; no correlation matching; first `consumer.next()` wins |
</phase_requirements>

---

## Summary

Phase 22 is the most technically complex phase in the v1.6 milestone. It introduces the first Tauri command with a persistent AMQP consumer loop and a three-branch `tokio::select!` pattern (delivery / timeout / cancellation). The Rust backend gains two new commands (`execute_step`, `cancel_plan_run`) and a new managed-state slot (`PlanRunState`). The React frontend gains an ephemeral Zustand execution store (`usePlanExecutionStore`) and a custom hook (`usePlanRunner`) that drives the step-by-step runner loop.

All architectural decisions are locked in CONTEXT.md (D-01 through D-15). Research focus is on verifying the exact lapin API shapes needed for the three critical AMQP pitfalls — especially `correlation_id` extraction from delivery properties (not headers), consumer-before-publish ordering, and selective NACK for non-matching correlation-id replies. The `uuid` crate (not yet in Cargo.toml) must be added for UUID v4 generation.

The ephemeral-connection-per-step pattern is an **intentional deviation** from the standard single-operation ephemeral pattern: per CONTEXT.md D-code, `execute_step` opens and closes one AMQP connection per step call, including for response-waiting modes. This simplifies error handling and eliminates reconnect logic at the cost of slightly higher per-step latency.

**Primary recommendation:** Follow subscribe.rs as the structural template for `plan_runner.rs`. The three-branch `tokio::select!` is an extension of subscribe.rs's two-branch loop with a timeout arm added. The connection/channel setup boilerplate in publish.rs can be extracted into a shared helper or copied inline (project pattern so far is inline per-command).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AMQP publish + reply-wait | Rust backend | — | AMQP complexity (consumer lifecycle, NACK, select!) belongs in Rust |
| UUID generation for correlation_id | Rust backend | — | Guarantees uniqueness; prevents JS UUID being serialized through IPC |
| Cancellation token lifecycle | Rust backend | React client | Rust holds the token; JS calls `cancel_plan_run` to trigger |
| Step execution ordering (runner loop) | React client | — | JS awaits each `execute_step` call sequentially — natural async/await |
| Step status state | React client | — | Ephemeral Zustand store; not persisted |
| Run controls UI (Run/Stop/Summary) | React client | — | shadcn components in PlanRunBar |
| `stop_on_error` persistence | tauri-plugin-store | React client | Field on Plan, persisted via existing `usePlanStore.updatePlan` path |
| Active step highlighting + auto-scroll | React client | — | Ref + scrollIntoView on active step row |

---

## Standard Stack

### Core — All Already in Cargo.toml or package.json

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lapin` | 4.x [VERIFIED: crates.io] | AMQP consumer/publish for reply-wait modes | Project standard; `basic_consume`, three-branch `tokio::select!` |
| `tokio` | 1.x [VERIFIED: Cargo.toml] | Async runtime: `time::sleep`, `select!`, `time::timeout` | Project standard |
| `tokio-util` | 0.7.x [VERIFIED: Cargo.toml] | `CancellationToken` for clean stop | Already used in `SubscribeState` |
| `futures-util` | 0.3 [VERIFIED: Cargo.toml] | `StreamExt` trait for `consumer.next()` | Already imported in subscribe.rs |
| `prost-reflect` | 0.16 [VERIFIED: Cargo.toml] | Decode reply payload in Rust (D-03) | Project standard |
| `zustand` | 5.x [VERIFIED: package.json] | `usePlanExecutionStore` ephemeral state | Project standard; all existing stores use this |
| shadcn `Switch` | n/a [ASSUMED] | Stop-on-error toggle in PlanRunBar | Already used elsewhere per CLAUDE.md |
| shadcn `Tooltip` | n/a [ASSUMED] | Disabled Run button explanations | Already used elsewhere per CLAUDE.md |
| `sonner` toast | n/a [ASSUMED] | Per-step error toasts when `stop_on_error=false` | Already installed per CONTEXT.md |

### New Dependency Required

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `uuid` | 1.23.1 [VERIFIED: crates.io] | `Uuid::new_v4().to_string()` for correlation_id | Not yet in Cargo.toml; needed for RESP-02 |

**Installation (Rust):**
```toml
uuid = { version = "1", features = ["v4"] }
```

**Version verification:**
```
cargo search uuid
# uuid = "1.23.1" — confirmed 2026-05-24
```

---

## Package Legitimacy Audit

> slopcheck was not available at research time (installation failed). Packages below are marked `[ASSUMED]` for the one new dependency.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `uuid` | crates.io | ~10 yrs [ASSUMED] | Very high [ASSUMED] | github.com/uuid-rs/uuid | N/A — slopcheck unavailable | Approved — widely used Rust UUID crate, confirmed at 1.23.1 on crates.io |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. The `uuid` package is tagged `[ASSUMED]` — planner should verify it is the legitimate `uuid-rs/uuid` crate (https://crates.io/crates/uuid) before adding to Cargo.toml.*

---

## Architecture Patterns

### System Architecture Diagram

```
JS runner loop (usePlanRunner)
        │
        │  for each step in plan.steps
        ▼
  setStatus(stepId, 'sending')
        │
        │  await invoke('execute_step', { ... })
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Rust: execute_step                                              │
│                                                                  │
│  1. Validate args                                                │
│  2. Clone pool (before any .await)                               │
│  3. Load profile credentials                                     │
│  4. Open AMQP connection (ephemeral per step)                    │
│  5. Create channel                                               │
│  6. Branch on response_mode:                                     │
│                                                                  │
│  no-wait ──────────────────────────────────────────► publish    │
│                  tokio::sleep(delay_ms)                          │
│                  close connection                                │
│                  return StepResult { status: "done" }           │
│                                                                  │
│  correlation-id ──────► basic_consume (reply_queue) ──► publish │
│                          tokio::select! {                        │
│                            consumer.next() → match correlation   │
│                              match: ack + decode + return done   │
│                              no match: nack(requeue=true) + loop │
│                            sleep(timeout_ms) → return error     │
│                            token.cancelled() → return cancelled  │
│                          }                                       │
│                                                                  │
│  first-arrival ──────── basic_consume (reply_queue) ──► publish │
│                          tokio::select! {                        │
│                            consumer.next() → ack + decode +     │
│                              return done                         │
│                            sleep(timeout_ms) → return error     │
│                            token.cancelled() → return cancelled  │
│                          }                                       │
└─────────────────────────────────────────────────────────────────┘
        │
        │  StepResult { status, error, reply }
        ▼
  setStatus(stepId, result.status === 'done' ? 'done' : 'error')
        │
        │  if result.status === 'error' && stopOnError → break
        ▼
  (next step or run complete)
        │
        ▼
  Show run summary (N/M succeeded)
```

### Recommended Project Structure

```
src-tauri/src/commands/
├── plan_runner.rs     # New: execute_step, cancel_plan_run, PlanRunState, StepResult
├── mod.rs             # Add: pub mod plan_runner;
└── [existing files unchanged]

src/
├── stores/
│   ├── usePlanExecutionStore.ts   # New: ephemeral run status store
│   └── [existing stores unchanged]
├── hooks/
│   └── usePlanRunner.ts           # New: runner loop hook
└── components/plans/
    ├── PlanRunBar.tsx             # New: sticky header bar (Run/Stop/Summary/Toggle)
    ├── StepStatusBadge.tsx        # New: status badge component
    ├── PlanDetailPanel.tsx        # Modified: add PlanRunBar at top
    └── StepListPanel.tsx          # Modified: add status badge overlay + active highlight
```

### Pattern 1: PlanRunState Managed State

**What:** Separate managed-state slot for the plan runner, parallel to `SubscribeState`. Simpler than `SubscribeState` — no JoinHandle (execute_step is directly awaited), only a CancellationToken.

**When to use:** Any time a Tauri command needs a cancel-able token separate from the subscribe session.

```rust
// Source: derived from subscribe.rs SubscribeState pattern
use tokio_util::sync::CancellationToken;

pub struct PlanRunState {
    pub token: CancellationToken,
}

// In lib.rs — add alongside SubscribeState:
.manage(Mutex::new(Option::<commands::plan_runner::PlanRunState>::None))

// In invoke_handler — add:
commands::plan_runner::execute_step,
commands::plan_runner::cancel_plan_run,
```

### Pattern 2: execute_step — Three-Branch tokio::select! (RESP-02 / RESP-03)

**What:** Consumer opens before publish (pitfall #59). `tokio::select!` on delivery / timeout / cancellation (pitfall #70). Correlation-id is read from `delivery.properties.correlation_id()` via `.as_ref().map(|s| s.as_str())` (pitfall #58). Non-matching replies are NACKed with `requeue: true` (pitfall #60). Timeout uses `tokio::pin!` OUTSIDE the loop so the deadline is not reset on each iteration.

**When to use:** correlation-id and first-arrival response modes only. No-wait mode skips the consumer entirely.

```rust
// Source: lapin docs.rs (verified 2026-05-24) + subscribe.rs patterns
use lapin::{
    options::{
        BasicAckOptions, BasicCancelOptions, BasicConsumeOptions,
        BasicNackOptions, BasicPublishOptions, ConfirmSelectOptions,
    },
    types::FieldTable,
    BasicProperties,
};
use futures_util::StreamExt;
use tokio_util::sync::CancellationToken;
use std::time::Duration;
use uuid::Uuid;

// Critical ordering for correlation-id mode:
// 1. Open consumer BEFORE publish (pitfall #59)
let correlation_id = Uuid::new_v4().to_string();
let consumer = channel
    .basic_consume(
        reply_queue.as_str().into(),
        "tap-plan-runner",
        BasicConsumeOptions::default(),
        FieldTable::default(),
    )
    .await?;
let mut consumer = consumer;

// 2. Publish WITH correlation_id + reply_to set
// (reuse publish.rs props-building pattern)
let props = BasicProperties::default()
    .with_correlation_id(correlation_id.clone().into())
    .with_reply_to(reply_queue.clone().into());

// confirm_select + basic_publish omitted for brevity (see publish.rs)

// 3. Three-branch select! (pitfall #70)
// IMPORTANT: Create the deadline OUTSIDE the loop using tokio::pin! so it is NOT
// reset on each iteration. Creating sleep() inside the loop gives each iteration
// a fresh timeout — that is a bug for correlation-id mode where many non-matching
// messages may arrive before the match (pitfall #4 below).
let deadline = tokio::time::sleep(Duration::from_millis(timeout_ms));
tokio::pin!(deadline);

loop {
    tokio::select! {
        delivery_opt = consumer.next() => {
            match delivery_opt {
                Some(Ok(delivery)) => {
                    // Pitfall #58: read correlation_id from AMQP properties, NOT headers
                    let incoming_cid = delivery
                        .properties
                        .correlation_id()
                        .as_ref()
                        .map(|s| s.as_str().to_owned());
                    if incoming_cid.as_deref() == Some(correlation_id.as_str()) {
                        // Match: ack + decode + return done
                        let _ = delivery.acker.ack(BasicAckOptions::default()).await;
                        // decode payload ...
                        // Explicit cleanup before return (security: prevent resource leak)
                        let _ = channel
                            .basic_cancel("tap-plan-runner", BasicCancelOptions::default())
                            .await;
                        let _ = conn.close(0, "step done").await;
                        break; // return StepResult done
                    } else {
                        // Pitfall #60: non-matching — selective NACK with requeue
                        let _ = delivery.acker.nack(BasicNackOptions {
                            requeue: true,
                            ..Default::default()
                        }).await;
                        // continue loop — wait for next delivery
                    }
                }
                _ => {
                    // Broker closed consumer — surface as step error
                    let _ = conn.close(0, "broker closed consumer").await;
                    break;
                }
            }
        }
        _ = &mut deadline => {
            // Timeout: explicit cleanup before returning error result
            let _ = channel
                .basic_cancel("tap-plan-runner", BasicCancelOptions::default())
                .await;
            let _ = conn.close(0, "step timeout").await;
            break; // return StepResult { status: "error", error: "Timeout" }
        }
        _ = token.cancelled() => {
            // Cancellation: explicit cleanup before returning cancelled result
            let _ = channel
                .basic_cancel("tap-plan-runner", BasicCancelOptions::default())
                .await;
            let _ = conn.close(0, "step cancelled").await;
            break; // return StepResult { status: "error", error: "Cancelled" }
        }
    }
}
```

**Note:** For first-arrival mode, the select! body is the same but the delivery branch unconditionally acks (no correlation-id matching) and returns.

### Pattern 3: usePlanExecutionStore (Ephemeral Zustand)

**What:** Non-persisted Zustand store for runtime step statuses. Follows the same Zustand `create()` pattern as existing stores but without `tauri-plugin-store` persistence.

**When to use:** Any UI component reading step status badges, active step ID, or run completion state.

```typescript
// Source: Zustand 5 pattern (project standard)
import { create } from 'zustand';
import type { StepStatus } from '@/lib/types';

interface PlanExecutionStore {
  runningPlanId: string | null;
  stepStatuses: Record<string, StepStatus>;
  activeStepId: string | null;
  isCancelling: boolean;
  startRun: (planId: string, stepIds: string[]) => void;
  setStepStatus: (stepId: string, status: StepStatus) => void;
  setActiveStep: (stepId: string | null) => void;
  setCancelling: () => void;
  clearRun: () => void;
}

export const usePlanExecutionStore = create<PlanExecutionStore>((set) => ({
  runningPlanId: null,
  stepStatuses: {},
  activeStepId: null,
  isCancelling: false,
  startRun: (planId, stepIds) => set({
    runningPlanId: planId,
    stepStatuses: Object.fromEntries(stepIds.map(id => [id, 'pending'])),
    activeStepId: null,
    isCancelling: false,
  }),
  setStepStatus: (stepId, status) =>
    set((state) => ({ stepStatuses: { ...state.stepStatuses, [stepId]: status } })),
  setActiveStep: (stepId) => set({ activeStepId: stepId }),
  setCancelling: () => set({ isCancelling: true }),
  clearRun: () => set({ runningPlanId: null, stepStatuses: {}, activeStepId: null, isCancelling: false }),
}));
```

### Pattern 4: usePlanRunner Hook

**What:** Custom hook encapsulating the JS runner loop. Calls `usePlanExecutionStore` for status updates and invokes `execute_step` / `cancel_plan_run` Tauri commands.

**When to use:** Instantiated by `PlanRunBar` or `PlanDetailPanel`.

```typescript
// Source: CONTEXT.md D-15 specification
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useRef } from 'react';
import { usePlanExecutionStore } from '@/stores/usePlanExecutionStore';
import type { PlanStep, ResponseMode } from '@/lib/types';

export function usePlanRunner() {
  const store = usePlanExecutionStore();
  const runningRef = useRef(false);

  const runPlan = useCallback(async (
    planId: string,
    steps: PlanStep[],
    profileName: string,
    stopOnError: boolean,
  ) => {
    runningRef.current = true;
    store.startRun(planId, steps.map(s => s.id));

    for (const step of steps) {
      if (!runningRef.current) break;  // isCancelling check

      store.setActiveStep(step.id);
      store.setStepStatus(step.id, 'sending');

      // Set to waiting-response immediately if response mode needs it
      if (step.response_mode.mode !== 'no-wait') {
        store.setStepStatus(step.id, 'waiting-response');
      }

      try {
        const result = await invoke<StepResult>('execute_step', {
          profileName,
          step: serializeStep(step),
        });

        store.setStepStatus(step.id, result.status === 'done' ? 'done' : 'error');

        if (result.status === 'error' && stopOnError) break;
      } catch (err) {
        store.setStepStatus(step.id, 'error');
        if (stopOnError) break;
      }
    }

    store.setActiveStep(null);
    runningRef.current = false;
  }, [store]);

  const stopPlan = useCallback(async () => {
    runningRef.current = false;
    store.setCancelling();
    await invoke('cancel_plan_run').catch(() => {});
  }, [store]);

  return { runPlan, stopPlan };
}
```

### Pattern 5: StepResult and ReplyMessage Rust Structs

Following `ConsumeResult` / `DrainResult` naming conventions (CONTEXT.md Claude's Discretion).
Q4 RESOLVED (2026-05-24): Use `step.message_type` for reply type lookup — same proto type as the request. Consistent with D-03 (Rust decodes inline via pool_state). `decoded_as` is set to `Some(step.message_type)` on success, `None` on decode failure. `decoded: None` on failure does NOT make the step error — the step returns `done` with hex available for display.

```rust
// Source: CONTEXT.md D-02 + consume.rs naming conventions + Q4 resolution
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMessage {
    pub routing_key: String,
    pub content_type: Option<String>,
    pub decoded: Option<serde_json::Value>,  // None on decode failure (not a step error)
    pub decoded_as: Option<String>,           // Some(step.message_type) on success, None on failure
    pub hex_string: String,
    // raw_bytes is NOT serialized — used internally only for hex_string generation
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub step_id: String,
    pub status: String,              // "done" | "error"
    pub error: Option<String>,
    pub reply: Option<ReplyMessage>,
}
```

### Pattern 6: isPlan() Guard Update

The existing `isPlan()` type guard in `usePlanStore.ts` must treat missing `stop_on_error` as `true` (backward compat):

```typescript
// The Plan interface gets stop_on_error: boolean added.
// isPlan() updated to: allow absence = treat as truthy (not a disqualifying missing field)
function isPlan(value: unknown): value is Plan {
  // ... existing checks ...
  // stop_on_error: accept missing (undefined) or boolean — treat absence as true
  // typeof v.stop_on_error === 'boolean' || v.stop_on_error === undefined
}
```

### Anti-Patterns to Avoid

- **Consumer after publish for correlation-id/first-arrival:** The consumer MUST be opened before `basic_publish`. If the service processes the request very fast and sends a reply before the consumer is registered, the reply is lost. This is pitfall #59.
- **Reading correlation_id from AMQP headers:** Correlation ID is in AMQP basic properties (`delivery.properties.correlation_id()`), not in the user-defined header table. Pitfall #58.
- **Reusing SubscribeState slot for PlanRunState:** These are independent sessions that can (conceptually) run simultaneously. They must be separate managed-state slots. Pitfall #68.
- **Silently discarding non-matching correlation-id messages:** Non-matching replies must be NACKed with `requeue: true` so other consumers (or the next retry) can process them. Discarding them corrupts other clients' workflows. Pitfall #60.
- **Creating a new `tokio::time::sleep` inside a loop body for the overall timeout:** The sleep resets on each loop iteration. Use `tokio::pin!` outside the loop so the deadline is preserved across iterations.
- **Using `tokio::spawn` instead of `tauri::async_runtime::spawn`:** Not needed here since `execute_step` is directly awaited, but any spawned background work must use the Tauri runtime to avoid panics on Windows (PROJECT.md Key Decision).
- **Locking MutexGuard across an `.await` point:** MutexGuard is not Send. Always clone the pool inside a lock block, then drop the guard before any `.await`. Follows existing consume.rs/subscribe.rs pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUIDs for correlation_id | Hand-rolled random string | `uuid` crate v1.x with `v4` feature | RFC 4122 UUID uniqueness, well-tested, standard |
| Cancellation tokens | `Arc<AtomicBool>` | `tokio_util::sync::CancellationToken` | Already in Cargo.toml; child tokens, clean Drop, proper wakeup |
| AMQP stream iteration | Manual channel poll loop | `futures_util::StreamExt` + `consumer.next()` | Already used in subscribe.rs; handles EOF/error correctly |
| Timeout logic | `tokio::time::sleep` re-created per iteration | `tokio::pin!` + `&mut deadline` inside select! | Correctly implements a deadline (not a per-iteration timeout) |
| Disable Run button during run | Conditional rendering | `disabled` prop + shadcn `Tooltip` | shadcn pattern; already used elsewhere |
| Stop-on-error toggle | Custom checkbox | shadcn `Switch` | Already installed; matches app design language |

**Key insight:** The hardest problem in this phase is the three-branch `tokio::select!` with a preserved deadline. Do not re-create the sleep inside the loop — that resets the timeout on every delivery (for correlation-id mode, where multiple non-matching messages may arrive before the match is found).

---

## Common Pitfalls

### Pitfall 1: Consumer After Publish (ROADMAP #59) — CRITICAL
**What goes wrong:** Consumer registered AFTER `basic_publish`. If the replying service responds before the consumer is active, the reply is lost and the step times out.
**Why it happens:** Developer follows the intuitive "publish first, then wait" mental model.
**How to avoid:** In `execute_step`, for correlation-id and first-arrival modes, call `basic_consume` before `basic_publish`. Subscribe.rs already demonstrates the correct ordering: consumer setup runs inside the spawn closure before any message processing begins.
**Warning signs:** Step reliably times out in tests but works when a debugger slows execution.

### Pitfall 2: correlation_id in Headers vs. Properties (ROADMAP #58) — CRITICAL
**What goes wrong:** Code reads `delivery.headers["correlation_id"]` (or similar) instead of `delivery.properties.correlation_id()`. The reply service sets it as a standard AMQP property; it is never in headers.
**Why it happens:** Developers used to HTTP headers conflate AMQP headers with AMQP properties.
**How to avoid:** Use `delivery.properties.correlation_id().as_ref().map(|s| s.as_str())`. This is the lapin accessor, returning `&Option<ShortString>`. Compare with `.as_deref() == Some(correlation_id.as_str())`.
**Warning signs:** Correlation matching never succeeds; logs show non-matching NACK on every reply.

### Pitfall 3: Discarding Non-Matching Correlation Replies (ROADMAP #60)
**What goes wrong:** Non-matching messages in the correlation-id consumer are ACKed and discarded. If the queue is shared or the replying service sends spurious messages, legitimate replies to other consumers are consumed and dropped.
**Why it happens:** Simple `ack-or-ignore` logic without considering shared-queue semantics.
**How to avoid:** `delivery.acker.nack(BasicNackOptions { requeue: true, ..Default::default() }).await`. This puts the message back in the queue for the correct consumer.
**Warning signs:** Other clients' requests time out when running concurrently.

### Pitfall 4: Timeout Resets in Loop (tokio::select! with sleep inside loop body)
**What goes wrong:** `tokio::time::sleep(Duration::from_millis(timeout_ms))` is called inside the `loop { tokio::select! { ... } }` body. Each iteration creates a new sleep, effectively giving the timeout a fresh lease on each message arrival. A busy queue with non-matching messages will never time out.
**Why it happens:** Sleep is placed inside select! for convenience, matching the "timeout per iteration" mental model.
**How to avoid:**
```rust
let deadline = tokio::time::sleep(Duration::from_millis(timeout_ms));
tokio::pin!(deadline);
loop {
    tokio::select! {
        _ = &mut deadline => { break; }
        // other arms
    }
}
```
**Warning signs:** Step never reaches the Error state even after the configured timeout in a high-traffic queue.

### Pitfall 5: PlanRunState Merged Into SubscribeState (ROADMAP #68)
**What goes wrong:** Developer adds plan-run fields directly to `SubscribeState` or reuses the single `Mutex<Option<SubscribeState>>` slot for plan runs. A live subscribe session would block a plan run (and vice versa).
**Why it happens:** Appears to be a simplification; both use CancellationToken.
**How to avoid:** `PlanRunState` is a SEPARATE managed-state slot in `lib.rs`. The `Mutex<Option<PlanRunState>>` is registered independently alongside `Mutex<Option<SubscribeState>>`.
**Warning signs:** Starting a plan run while subscribed kills the subscribe session (or is blocked by it).

### Pitfall 6: MutexGuard Held Across .await
**What goes wrong:** The DescriptorPool or PlanRunState MutexGuard is still held when an `.await` point is reached. Rust correctly rejects this at compile time with `Send` bound errors.
**Why it happens:** Cloning pool is forgotten; guard dropped too late.
**How to avoid:** Always clone the pool inside a lock block that ends before any `.await`. This is documented in CONTEXT.md and every existing command (consume.rs, subscribe.rs).
**Warning signs:** Compiler error: "cannot be sent between threads safely" mentioning MutexGuard.

### Pitfall 7: ShortString Comparison
**What goes wrong:** `delivery.properties.correlation_id() == Some(correlation_id_string)` — ShortString does not implement `PartialEq<String>`. Compilation error.
**Why it happens:** ShortString is a newtype; standard equality comparison doesn't cross types.
**How to avoid:** `delivery.properties.correlation_id().as_ref().map(|s| s.as_str()) == Some(correlation_id.as_str())` — compare as `&str` slices after extracting via `as_str()`. [VERIFIED: amq-protocol-types docs.rs 2026-05-24]

### Pitfall 8: isCancelling race — loop checks runningRef between steps
**What goes wrong:** The JS runner loop checks cancellation state only at the top of each iteration. If `stopPlan()` is called mid-`invoke`, the current step completes normally, then the loop checks the flag and stops. This is correct behavior (D-04 says current in-flight resolves with "Cancelled" from Rust side), but the UI must handle receiving a final `{ status: "error", error: "Cancelled" }` for the in-flight step while `isCancelling` is true.
**Why it happens:** UI marks the step as "error" even though the user explicitly stopped — confusing if not distinguished.
**How to avoid:** In `usePlanRunner`, after `invoke` returns with `error: "Cancelled"`, check `isCancelling` and optionally skip the `stop_on_error` check (a cancelled run should not be treated as a real error for summary purposes). Handle in the step-status update logic.

---

## Code Examples

### Verified Pattern: correlation_id Property Access (lapin)

```rust
// Source: lapin docs.rs Delivery struct + amq-protocol-types ShortString [VERIFIED: docs.rs 2026-05-24]
// delivery.properties.correlation_id() returns &Option<ShortString>
// ShortString has as_str() -> &str  [VERIFIED: amq-protocol-types docs.rs 2026-05-24]

let incoming_cid: Option<&str> = delivery
    .properties
    .correlation_id()
    .as_ref()
    .map(|s| s.as_str());

if incoming_cid == Some(expected_cid.as_str()) {
    // matched
}
```

### Verified Pattern: BasicNackOptions with requeue

```rust
// Source: lapin docs.rs BasicNackOptions [VERIFIED: docs.rs 2026-05-24]
// Fields: multiple: Boolean, requeue: Boolean (amq-protocol-types Boolean type)
use lapin::options::BasicNackOptions;

delivery.acker.nack(BasicNackOptions {
    requeue: true,
    ..Default::default()
}).await?;
```

### Verified Pattern: uuid v4 generation in Rust

```rust
// Source: crates.io uuid 1.23.1 [VERIFIED: crates.io 2026-05-24]
// Cargo.toml: uuid = { version = "1", features = ["v4"] }
use uuid::Uuid;

let correlation_id = Uuid::new_v4().to_string();
// e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### Verified Pattern: futures_util::StreamExt import for consumer.next()

```rust
// Source: subscribe.rs (line 13) — already in codebase [VERIFIED: subscribe.rs]
use futures_util::StreamExt;
// Consumer implements Stream; .next() is available via StreamExt blanket impl
let mut consumer = channel.basic_consume(...).await?;
while let Some(item) = consumer.next().await { ... }
// OR inside select!:
delivery_opt = consumer.next() => { ... }
```

### Verified Pattern: cancel_plan_run command

```rust
// Source: stop_subscribe pattern (subscribe.rs) [VERIFIED: subscribe.rs]
// Simplified — no JoinHandle needed (execute_step is directly awaited)
#[tauri::command]
pub async fn cancel_plan_run(
    plan_run_state: tauri::State<'_, Mutex<Option<PlanRunState>>>,
) -> Result<(), crate::error::AppError> {
    let state = {
        let mut guard = plan_run_state
            .lock()
            .map_err(|_| crate::error::AppError::AmqpError("Plan run state lock poisoned".to_string()))?;
        guard.take()
    };
    if let Some(PlanRunState { token }) = state {
        token.cancel();
    }
    Ok(())
}
```

### Verified Pattern: updatePlan action in usePlanStore

Based on existing `renamePlan` pattern with optimistic-write + rollback:

```typescript
// Source: usePlanStore.ts renamePlan pattern [VERIFIED: usePlanStore.ts]
updatePlan: async (id: string, partial: Partial<Plan>): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [];
  let updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) => (p.id === id ? { ...p, ...partial } : p));
    return { plans: updated };
  });
  try {
    await persistPlans(updated);
  } catch (err) {
    set({ plans: previous });
    throw err;
  }
},
```

### Verified Pattern: Auto-scroll to active step

```typescript
// Source: CONTEXT.md D-10 specification + browser scrollIntoView API [ASSUMED]
const activeStepRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (isActive && activeStepRef.current) {
    activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}, [isActive]);
```

### Verified Pattern: Disabled Run button with Tooltip

```tsx
// Source: shadcn Tooltip usage pattern (already in codebase) [ASSUMED]
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

<Tooltip>
  <TooltipTrigger asChild>
    <span>  {/* wrapper needed when button is disabled */}
      <Button disabled={isDisabled} onClick={handleRun}>
        Run
      </Button>
    </span>
  </TooltipTrigger>
  {isDisabled && (
    <TooltipContent>{disabledReason}</TooltipContent>
  )}
</Tooltip>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tokio::spawn` for background tasks | `tauri::async_runtime::spawn` | Tauri 2.0 | Prevents panic on Windows; project enforces this in PROJECT.md |
| Single managed-state slot for all sessions | Separate slot per session type | Project convention (subscribe.rs) | SubscribeState and PlanRunState are independent |
| ACK before or after decode | ACK before decode | Project convention (consume.rs, subscribe.rs) | Prevents poison-pill queue blocking |
| Connection kept open across operations | Ephemeral connection per operation | Project Key Decision | execute_step follows this; intentional for v1 |

**Deprecated/outdated:**
- `amq.rabbitmq.reply-to` (direct-reply-to): REQUIREMENTS.md explicitly excludes this. Use named exclusive queues instead.
- Blocking on `pool_state` lock across await: All existing commands clone the pool before awaiting. execute_step must follow the same pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `shadcn/ui Switch` component is already available in the project | Standard Stack | Planner would need to add it; low risk — shadcn/ui is already installed |
| A2 | `shadcn/ui Tooltip` component is already available | Standard Stack | Same as A1 |
| A3 | `sonner` toast package is already installed (stated in CONTEXT.md code_context) | Standard Stack | Low risk — CONTEXT explicitly calls it out |
| A4 | `uuid` crate on crates.io is the legitimate `uuid-rs/uuid` package | Package Legitimacy | Extremely low risk — uuid is one of the most-downloaded Rust crates |
| A5 | `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` is the correct call | Code Examples | Behavior-only; correctness confirmed by MDN — not a library API |
| A6 | No queue_declare step needed for reply_queue in execute_step — caller ensures queue exists | Open Questions | If the queue doesn't exist, AMQP returns NOT_FOUND which surfaces as step Error — acceptable UX for v1 |

**If this table is empty:** Not applicable — several assumptions present.

---

## Open Questions (RESOLVED)

1. **Reply queue lifecycle — passive declare vs. assume-exists**
   - **RESOLVED:** Assume-exists. Surface AMQP NOT_FOUND as step Error with message "Reply queue 'X' not found — create it in RabbitMQ first". Matches no-auto-provisioning policy. Chosen path: assume-exists (confirmed by A6 above).

2. **First-arrival semantics with pre-existing messages**
   - **RESOLVED:** Accept the literal first `consumer.next()` unconditionally. Users who want "fresh only" should use a dedicated transient/exclusive reply queue. Simpler, matches spec text.

3. **execute_step PlanRunState slot — concurrent call guard**
   - **RESOLVED:** JS runner owns the guard via `runningPlanId` in `usePlanExecutionStore`. Rust atomically stores the token into `PlanRunState` on each call and clears it on return. A second concurrent call replaces the previous token (acceptable for v1 — sequential JS runner prevents this in practice).

4. **Reply decoding strategy for execute_step — which type(s) to try against DescriptorPool**
   - **RESOLVED (confirmed by user 2026-05-24):** Use `step.message_type` for reply type lookup — same proto type as the request. Consistent with D-03 (Rust decodes inline via pool_state Mutex<Option<DescriptorPool>>). Implementation: clone pool from pool_state before first .await; look up MessageDescriptor by step.message_type; decode delivery.data via DynamicMessage::decode; set decoded_as = Some(step.message_type) on success, None on decode failure. Decode failure does NOT make the step error — return status "done" with decoded: null, decoded_as: null, hex_string: <hex>. This is strategy (a) from the original list.

---

## Environment Availability

> Step 2.6: SKIPPED — no new external dependencies beyond the `uuid` crate being added to Cargo.toml. All tools (Rust toolchain, Node, Tauri) are confirmed present from Phase 21 (recently completed). AMQP broker is user-provided at runtime (not a build dependency).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — auth handled by connection profiles (existing) |
| V3 Session Management | Yes — execute_step token lifecycle | CancellationToken scoped to single step execution; cleared on completion |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Validate profile_name, queue names, response_mode before any AMQP call |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for Tauri 2 + lapin AMQP

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| AMQP URI credential exposure in error messages | Information Disclosure | Follow existing subscribe.rs/publish.rs pattern: sanitize error messages, drop URI before await |
| Open consumer never closed on cancellation | Denial of Service (resource leak) | Explicit `basic_cancel` + `conn.close()` in ALL three exit branches of `tokio::select!` (see Pattern 2 code example) |
| Unvalidated reply queue name | Tampering | Validate queue name is non-empty at system boundary; AMQP enforces the rest |
| UUID correlation_id predictability | No meaningful threat for dev tool | Uuid::new_v4() is random; acceptable for internal tooling |

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/commands/subscribe.rs` — CancellationToken + tokio::select! pattern, three-branch structure template, futures_util::StreamExt import
- `src-tauri/src/commands/publish.rs` — AMQP connection setup, BasicProperties building, publish + confirm pattern
- `src-tauri/src/commands/consume.rs` — pool_state clone pattern, ConsumeResult/DrainResult struct shapes
- `src-tauri/src/commands/encode.rs` — encode_message is `pub async fn`; callable as `crate::commands::encode::encode_message(...)` from plan_runner.rs
- `src-tauri/src/lib.rs` — managed-state registration pattern
- `src/stores/usePlanStore.ts` — optimistic-write + rollback pattern for updatePlan
- `src/stores/useConnectionStore.ts` — activeProfileName field name for Run button guard
- `.planning/phases/22-plan-runner-sequential-execution/22-CONTEXT.md` — all locked decisions D-01 through D-15

### Secondary (MEDIUM confidence)
- [lapin docs.rs — Consumer struct (Stream impl, item type)](https://docs.rs/lapin/latest/lapin/struct.Consumer.html) — confirmed Consumer implements Stream, StreamExt blanket impl provides .next()
- [lapin docs.rs — BasicNackOptions](https://docs.rs/lapin/latest/lapin/options/struct.BasicNackOptions.html) — confirmed fields: `multiple: Boolean`, `requeue: Boolean`
- [amq-protocol-types docs.rs — ShortString](https://docs.rs/amq-protocol-types/latest/amq_protocol_types/struct.ShortString.html) — confirmed `as_str() -> &str` method; no direct PartialEq with String/&str
- [crates.io — uuid 1.23.1](https://crates.io/crates/uuid) — confirmed current version, v4 feature for Uuid::new_v4()

### Tertiary (LOW confidence — training knowledge)
- scrollIntoView behavior: MDN documented API, not library-specific
- shadcn Switch / Tooltip availability: stated as already installed in CONTEXT.md code_context

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all core libraries already in Cargo.toml/package.json; only uuid is new, verified on crates.io
- Architecture: HIGH — directly derived from existing subscribe.rs/publish.rs/consume.rs patterns + locked CONTEXT.md decisions
- Pitfalls: HIGH — three verified from ROADMAP.md with explicit pitfall numbers; two discovered during research (timeout reset in loop, ShortString comparison)
- lapin API specifics: MEDIUM — delivery.properties.correlation_id() existence confirmed from docs.rs; exact type hierarchy confirmed via ShortString docs

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable stack; lapin 4.x API unlikely to change)
