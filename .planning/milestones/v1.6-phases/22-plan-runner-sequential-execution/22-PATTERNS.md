# Phase 22: Plan Runner — Sequential Execution - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 14 (5 new, 8 modified, 1 config add)
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/commands/plan_runner.rs` | command | request-response + event-driven | `src-tauri/src/commands/subscribe.rs` | exact (CancellationToken + tokio::select! + stream consumer) |
| `src-tauri/src/commands/mod.rs` | config | — | `src-tauri/src/commands/mod.rs` (itself, 1-line addition) | exact |
| `src-tauri/src/lib.rs` | config | — | `src-tauri/src/lib.rs` (itself, managed-state + handler additions) | exact |
| `src-tauri/Cargo.toml` | config | — | n/a (dependency add) | n/a |
| `src/stores/usePlanExecutionStore.ts` | store | event-driven | `src/stores/useResponseStore.ts` | exact (ephemeral Zustand, no persistence, session-status transitions) |
| `src/hooks/usePlanRunner.ts` | hook | request-response | `src/components/response/SubscribePanel.tsx` | role-match (hook driving IPC lifecycle + status transitions) |
| `src/lib/ipc.ts` | utility | request-response | `src/lib/ipc.ts` (itself — add 2 wrappers) | exact |
| `src/components/plans/PlanRunBar.tsx` | component | request-response | `src/components/publish/PublishBar.tsx` | exact (sticky bar, disabled-button-with-Tooltip, Badge status, isSending toggle) |
| `src/components/plans/StepStatusBadge.tsx` | component | transform | `src/components/publish/PublishBar.tsx` lines 452–486 | role-match (Badge with status-keyed variant/className) |
| `src/components/plans/PlanDetailPanel.tsx` | component | — | `src/components/plans/PlanDetailPanel.tsx` (itself) | exact (add sticky header row above existing flex layout) |
| `src/components/plans/StepListPanel.tsx` | component | — | `src/components/plans/StepListPanel.tsx` (itself) | exact (add badge overlay + active highlight to SortableStepRow) |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` (itself — add `stop_on_error` to Plan + ReplyMessage/StepResult interfaces) | exact |
| `src/stores/usePlanStore.ts` | store | CRUD | `src/stores/usePlanStore.ts` lines 103–118 (`renamePlan`) | exact (optimistic-write + rollback for `updatePlan`) |

---

## Pattern Assignments

### `src-tauri/src/commands/plan_runner.rs` (command, request-response + event-driven)

**Analog:** `src-tauri/src/commands/subscribe.rs` (primary), `src-tauri/src/commands/publish.rs` (secondary), `src-tauri/src/commands/consume.rs` (secondary)

---

**Imports pattern** — copy from subscribe.rs lines 1–20 + publish.rs lines 1–9, extend with uuid:

```rust
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicCancelOptions, BasicConsumeOptions,
        BasicNackOptions, BasicPublishOptions, ConfirmSelectOptions,
    },
    types::FieldTable,
    BasicProperties,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::AppError;
use crate::profiles::build_amqp_uri;
```

---

**PlanRunState struct** — copy from subscribe.rs lines 30–36, simplify (no JoinHandle):

```rust
// subscribe.rs lines 30-36 (original) — simplified version for plan_runner:
// SubscribeState has token + Option<JoinHandle>; PlanRunState has token only (execute_step is
// directly awaited — no background spawn needed per D-05).
pub struct PlanRunState {
    pub token: CancellationToken,
}
```

---

**Output structs** — follow consume.rs lines 13–18 (`ConsumeResult`) and 216–228 (`DrainResult`) naming conventions. Use `#[serde(rename_all = "camelCase")]`:

```rust
// consume.rs lines 216-228 — DrainResult field naming to mirror:
// decoded: Option<serde_json::Value>
// hex_string: String          → camelCase: hexString on JS side
// error: Option<String>
// decoded_as: Option<String>  → camelCase: decodedAs on JS side
//
// ReplyMessage follows the same shape. StepResult is the envelope:
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMessage {
    pub decoded: Option<serde_json::Value>,
    pub hex_string: String,
    pub error: Option<String>,
    pub decoded_as: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub status: String,          // "done" | "error"
    pub error: Option<String>,
    pub reply: Option<ReplyMessage>,
}
```

---

**Input validation pattern** — copy from subscribe.rs lines 78–100:

```rust
// subscribe.rs lines 78-100 — validate at system boundary, return AppError::InvalidInput
if profile_name.trim().is_empty() {
    return Err(AppError::InvalidInput(
        "profile_name must not be empty".to_string(),
    ));
}
```

---

**pool_state clone before await** — copy from subscribe.rs lines 134–141 (identical pattern in consume.rs lines 40–54):

```rust
// subscribe.rs lines 134-141 — clone BEFORE first .await; MutexGuard is not Send
let pool = {
    let guard = pool_state
        .lock()
        .map_err(|_| AppError::AmqpError("Descriptor pool lock poisoned".to_string()))?;
    guard.clone() // O(1) — Arc-backed
}; // guard drops here
```

---

**AMQP connection in tight URI scope** — copy from publish.rs lines 62–82 (security pattern: password dropped before await, URI dropped at block end):

```rust
// publish.rs lines 62-82
let conn = {
    let uri = build_amqp_uri(
        &profile.host,
        profile.port,
        &profile.vhost,
        &profile.username,
        &password,
    );
    drop(password); // password dropped before connecting
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        lapin::Connection::connect(&uri, lapin::ConnectionProperties::default()),
    )
    .await;
    // uri drops here
    result
        .map_err(|_| AppError::AmqpError("...timed out...".to_string()))?
        .map_err(|_| AppError::AmqpError("AMQP connection failed...".to_string()))?
};
```

---

**Channel creation with conn cleanup** — copy from publish.rs lines 86–92:

```rust
// publish.rs lines 86-92
let channel = match conn.create_channel().await {
    Ok(ch) => ch,
    Err(e) => {
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }
};
```

---

**confirm_select + basic_publish** — copy from publish.rs lines 96–158 for the publish step:

```rust
// publish.rs lines 96-104 — enable publisher confirms before publishing
if let Err(e) = channel.confirm_select(ConfirmSelectOptions::default()).await {
    let _ = conn.close(0, "".into()).await;
    return Err(AppError::AmqpError(e.to_string()));
}

// publish.rs lines 108-138 — BasicProperties building pattern
let mut props = BasicProperties::default()
    .with_content_type("application/octet-stream".into());
// ... with_correlation_id / with_reply_to for reply modes
```

---

**Three-branch tokio::select! loop** — structural template from subscribe.rs lines 230–355. Key differences for plan_runner: add timeout arm + correlation-id matching loop; replace `channel.send()` with local variable accumulation:

```rust
// subscribe.rs lines 230-355 — two-branch select! extended to three branches.
// CRITICAL: basic_consume BEFORE basic_publish (pitfall #59).
// CRITICAL: deadline via tokio::pin! OUTSIDE the loop (pitfall — reset-on-iteration bug).

// Step 1 — open consumer FIRST (pitfall #59)
let consumer = channel
    .basic_consume(
        reply_queue.as_str(),
        "tap-plan-runner",
        BasicConsumeOptions::default(),
        FieldTable::default(),
    )
    .await
    .map_err(|e| { let _ = conn.close(0, "").await; AppError::AmqpError(e.to_string()) })?;
let mut consumer = consumer;

// Step 2 — publish (reuse publish.rs props-building pattern above)
// ... basic_publish ...

// Step 3 — three-branch select! with external deadline pin
let deadline = tokio::time::sleep(Duration::from_millis(timeout_ms));
tokio::pin!(deadline);

loop {
    tokio::select! {
        delivery_opt = consumer.next() => {
            // subscribe.rs lines 232-343 is the delivery arm template.
            // For correlation-id mode: read cid from delivery.properties (pitfall #58):
            //   delivery.properties.correlation_id().as_ref().map(|s| s.as_str())
            // Match → ack + decode + break "done"
            // No-match → nack(requeue=true) (pitfall #60) + continue
        }
        _ = &mut deadline => {
            // subscribe.rs lines 344-353 cancellation arm adapted for timeout
            let _ = channel.basic_cancel("tap-plan-runner", BasicCancelOptions::default()).await;
            let _ = conn.close(0, "step timeout").await;
            break; // return StepResult { status: "error", error: "Timeout" }
        }
        _ = token.cancelled() => {
            // subscribe.rs lines 344-353 — same pattern
            let _ = channel.basic_cancel("tap-plan-runner", BasicCancelOptions::default()).await;
            let _ = conn.close(0, "step cancelled").await;
            break; // return StepResult { status: "error", error: "Cancelled" }
        }
    }
}
```

---

**Reply decode loop** — copy from consume.rs lines 358–405 (`drain_messages` multi-type first-success-wins loop):

```rust
// consume.rs lines 358-405 — first-success-wins decode over candidate list.
// PLANNER DECISION NEEDED (RESEARCH.md Open Question #4): which types to pass as
// candidate list — [step.message_type] (same type as request) vs. all pool types.
// Recommended fallback: pass [step.message_type] as single-element candidate list (option a).
// The decode loop itself is identical regardless.
let (decoded, decoded_as, error) = if let Some(pool) = &pool {
    // consume.rs lines 362-404 — iterate candidates, first Ok wins, last Err carried forward
    // ...
} else {
    (None, None, Some("No proto schema loaded — showing raw bytes".to_string()))
};
```

---

**cancel_plan_run command** — copy from subscribe.rs lines 380–403 (`stop_subscribe`), simplify (no JoinHandle await):

```rust
// subscribe.rs lines 380-403 — take state, drop guard before await, cancel token
#[tauri::command]
pub async fn cancel_plan_run(
    plan_run_state: tauri::State<'_, Mutex<Option<PlanRunState>>>,
) -> Result<(), AppError> {
    let state = {
        let mut guard = plan_run_state
            .lock()
            .map_err(|_| AppError::AmqpError("Plan run state lock poisoned".to_string()))?;
        guard.take()
    }; // guard dropped here — safe to proceed
    if let Some(PlanRunState { token }) = state {
        token.cancel();
    }
    Ok(())
}
```

---

**No-wait branch** — no consumer opened; publish + tokio::sleep(delay_ms) + close:

```rust
// publish.rs lines 143-195 — basic_publish + confirm pattern.
// After confirm: tokio::time::sleep(Duration::from_millis(delay_ms)).await;
// Then conn.close(0, "step done").await;
// Return StepResult { status: "done", error: None, reply: None }
```

---

**Test pattern** — copy from subscribe.rs lines 406–433 and consume.rs lines 438–521:
- Unit tests for struct construction (field presence, sentinel values)
- Document IPC contract (status string values, camelCase field names)

---

### `src-tauri/Cargo.toml` (config — dependency add)

**Analog:** n/a — no pattern to copy; this is a one-line dependency addition.

**Change:** Add the `uuid` crate under `[dependencies]` (required for `Uuid::new_v4()` in `execute_step` correlation ID generation — D-04, RESP-02):

```toml
uuid = { version = "1", features = ["v4"] }
```

**Placement:** Insert in alphabetical order among existing `[dependencies]`. Verified version: crates.io 1.23.1 (see RESEARCH.md §Standard Stack). Confirm `prost` version alignment is unaffected (uuid has no prost dependency).

---

### `src-tauri/src/commands/mod.rs` (config)

**Analog:** `src-tauri/src/commands/mod.rs` lines 1–6 (itself)

**Core pattern** (add one line after `subscribe`):

```rust
// mod.rs lines 1-6 — add pub mod plan_runner; in alphabetical order
pub mod connection;
pub mod consume;
pub mod encode;
pub mod plan_runner;   // NEW
pub mod proto;
pub mod publish;
pub mod subscribe;
```

---

### `src-tauri/src/lib.rs` (config)

**Analog:** `src-tauri/src/lib.rs` lines 33–99 (itself)

**Managed state registration** — copy from lib.rs line 35 pattern:

```rust
// lib.rs line 34-35 — .manage() chain; add PlanRunState alongside SubscribeState
.manage(Mutex::new(Option::<prost_reflect::DescriptorPool>::None))
.manage(Mutex::new(Option::<commands::subscribe::SubscribeState>::None))
.manage(Mutex::new(Option::<commands::plan_runner::PlanRunState>::None)) // NEW
```

**invoke_handler additions** — copy from lib.rs lines 82–99:

```rust
// lib.rs lines 96-98 — add after stop_subscribe
commands::plan_runner::execute_step,
commands::plan_runner::cancel_plan_run,
```

---

### `src/stores/usePlanExecutionStore.ts` (store, event-driven)

**Analog:** `src/stores/useResponseStore.ts` (entire file, 96 lines)

**Imports + create() pattern** (useResponseStore.ts lines 1–5, 55):

```typescript
// useResponseStore.ts lines 1-5
import { create } from "zustand";
import type { DrainResult, FeedMessage, SubscribeStatus } from "@/lib/types";

// useResponseStore.ts line 55 — no persistence (no tauri-plugin-store import); same for usePlanExecutionStore
export const useResponseStore = create<ResponseStore>((set, get) => ({
```

**INITIAL_STATE constant pattern** (useResponseStore.ts lines 30–53):

```typescript
// useResponseStore.ts lines 30-53 — typed INITIAL_STATE for clean reset()
const INITIAL_STATE: Pick<ResponseStore, 'subscribeStatus' | 'subscribeError' | ...> = {
  subscribeStatus: "Idle" as SubscribeStatus,
  subscribeError: null,
  // ...
};
```

**Immutable state update** (useResponseStore.ts lines 60–78):

```typescript
// useResponseStore.ts lines 60-78 — set((state) => ({ ...state.x, newEntry })) immutable pattern
appendMessages: (incoming) =>
  set((state) => {
    const newMessages = incoming.map(/* transform */);
    const combined = [...newMessages, ...state.messages];
    return { messages: combined.slice(0, FEED_MAX_SIZE) };
  }),
```

**Status transition action** (useResponseStore.ts lines 83–85):

```typescript
// useResponseStore.ts lines 83-85 — single action updates correlated state fields
setSubscribeStatus: (status, error) =>
  set({ subscribeStatus: status, subscribeError: error ?? null }),
```

**reset() with warning** (useResponseStore.ts lines 86–95):

```typescript
// useResponseStore.ts lines 86-95 — reset with active-session guard warning
reset: () => {
  const status = get().subscribeStatus;
  if (status === "Running" || status === "Stopping") {
    console.warn("...");
  }
  set({ ...INITIAL_STATE });
},
```

---

### `src/hooks/usePlanRunner.ts` (hook, request-response)

**Analog:** `src/components/response/SubscribePanel.tsx` (lines 1–80, handleStart + handleStop pattern)

**Hook structure with ref guard** (SubscribePanel.tsx lines 37–47):

```typescript
// SubscribePanel.tsx lines 37-47 — isStartingRef prevents concurrent invocations
const isStartingRef = useRef(false);
// For usePlanRunner, use runningRef = useRef(false) as the loop-iteration gate
```

**invoke + status transitions** (SubscribePanel.tsx lines 43–72):

```typescript
// SubscribePanel.tsx lines 43-72 — try/catch around invoke, status transitions in finally
const handleStart = async () => {
  if (isStartingRef.current) return;
  isStartingRef.current = true;
  try {
    await startSubscribe(profileName, selectedQueue, decodeTypes, channel);
    setSubscribeStatus("Running");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Subscribe failed";
    setSubscribeStatus("Error", message);
  } finally {
    isStartingRef.current = false;
  }
};
```

**Stop command pattern** (SubscribePanel.tsx lines 75–80):

```typescript
// SubscribePanel.tsx lines 75-80 — set transitional status, call stop IPC, catch silently
const handleStop = async () => {
  setSubscribeStatus("Stopping");
  try {
    await stopSubscribe();
    setSubscribeStatus("Idle");
  } catch { /* best effort */ }
};
```

**IPC import pattern** (ipc.ts lines 143–158 — startSubscribe/stopSubscribe wrappers):

```typescript
// ipc.ts lines 143-158 — simple invoke wrappers; executeStep follows same shape
export function stopSubscribe(): Promise<void> {
  return invoke("stop_subscribe");
}
```

---

### `src/lib/ipc.ts` (utility, request-response)

**Analog:** `src/lib/ipc.ts` lines 143–158 (`startSubscribe` / `stopSubscribe` — existing pattern)

**IPC wrapper pattern** (ipc.ts lines 143–158):

```typescript
// ipc.ts lines 143-158 — invoke wrapper functions; add two at the bottom of the file
// after the Phase 14 wrappers, under a Phase 22 comment block.

export interface StepResultIpc {
  status: 'done' | 'error';
  error: string | null;
  reply: ReplyMessageIpc | null;
}

export interface ReplyMessageIpc {
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
  decodedAs: string | null;
}

export async function executeStep(
  profileName: string,
  step: PlanStep,  // serialized as-is; Rust deserializes via serde
): Promise<StepResultIpc> {
  return invoke<StepResultIpc>("execute_step", { profileName, step });
}

export function cancelPlanRun(): Promise<void> {
  return invoke("cancel_plan_run");
}
```

---

### `src/components/plans/PlanRunBar.tsx` (component, request-response)

**Analog:** `src/components/publish/PublishBar.tsx` (entire file, 523 lines)

**Sticky bar layout pattern** (PublishBar.tsx lines 300–302):

```tsx
// PublishBar.tsx lines 300-302 — full-width flex bar spanning layout top
return (
  <div className="flex items-center gap-4 flex-wrap bg-card border-b border-border px-4 py-2">
    {/* PlanRunBar: bg-card border-b ... px-4 py-2 — same container pattern */}
```

**Disabled button with Tooltip pattern** (PublishBar.tsx lines 489–518):

```tsx
// PublishBar.tsx lines 503-518 — TooltipProvider > Tooltip > TooltipTrigger > span > disabled Button
// span wrapper is REQUIRED when button is disabled (Tooltip needs a focusable child)
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span>
        <Button variant="default" disabled>
          Run
        </Button>
      </span>
    </TooltipTrigger>
    <TooltipContent>Add steps to run</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Loading/sending state button toggle** (PublishBar.tsx lines 490–500):

```tsx
// PublishBar.tsx lines 490-500 — isSending state drives icon + disabled prop
<Button
  variant="default"
  disabled={!canSend || isSending}
  onClick={handleSend}
>
  {isSending ? (
    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
  ) : (
    <Send className="w-4 h-4 mr-2" />
  )}
  Send
</Button>
```

**toast.error for step failures** (PublishBar.tsx lines 276–279):

```tsx
// PublishBar.tsx lines 276-279 — toast.error for backend command failures
import { toast } from "sonner";
toast.error(`Send failed: ${message}`, { duration: 5000 });
// For plan runner: toast.error(`Step failed: ${result.error}`, { duration: 5000 })
// when stop_on_error = false (keep running but show toast per failed step)
```

**Switch component for stop_on_error toggle** (shadcn Switch is at `src/components/ui/switch.tsx`):

```tsx
// Pattern: import Switch from ui/switch; pair with label and onChange → updatePlan
import { Switch } from "@/components/ui/switch";

<div className="flex items-center gap-2">
  <Switch
    id="stop-on-error"
    checked={plan.stop_on_error ?? true}
    onCheckedChange={(checked) => updatePlan(plan.id, { stop_on_error: checked })}
  />
  <label htmlFor="stop-on-error" className="text-sm">Stop on error</label>
</div>
```

---

### `src/components/plans/StepStatusBadge.tsx` (component, transform)

**Analog:** `src/components/publish/PublishBar.tsx` lines 452–486 (delivery outcome badge block)

**Status-keyed Badge className pattern** (PublishBar.tsx lines 452–486):

```tsx
// PublishBar.tsx lines 452-486 — Badge with status-keyed variant/className
import { Badge } from "@/components/ui/badge";

{outcome && (
  <Badge
    variant="outline"
    className={
      outcome.status === "ack"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
        : outcome.status === "returned"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
        : outcome.status === "nack"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : "bg-muted text-muted-foreground border-border"
    }
  >
    {/* label */}
  </Badge>
)}
```

**StepStatusBadge color mapping** — map `StepStatus` onto the same color tokens:

```tsx
// StepStatus: 'pending' | 'sending' | 'waiting-response' | 'done' | 'error'
// pending:          bg-muted / text-muted-foreground (neutral)
// sending:          bg-blue-500/10 / text-blue-700    (active/progress)
// waiting-response: bg-amber-500/10 / text-amber-700  (waiting)
// done:             bg-emerald-500/10 / text-emerald-700 (success — matches ACK badge)
// error:            bg-destructive/10 / text-destructive (failure — matches NACK badge)
```

---

### `src/components/plans/PlanDetailPanel.tsx` (component — modified)

**Analog:** `src/components/plans/PlanDetailPanel.tsx` lines 66–94 (itself, existing JSX structure)

**Sticky header insertion pattern** (PlanDetailPanel.tsx lines 66–94):

```tsx
// PlanDetailPanel.tsx lines 66-94 — current return wraps everything in flex div.
// Add PlanRunBar as the FIRST child (above the DndContext flex row):
return (
  <div className="flex flex-1 flex-col min-h-0 min-w-0">  {/* flex-col to stack bar + content */}
    <PlanRunBar plan={selectedPlan} />                     {/* NEW: sticky header */}
    <div className="flex flex-1 min-h-0 min-w-0">         {/* existing: horizontal split */}
      <DndContext ...>
        <StepListPanel ... />
        ...
      </DndContext>
      <StepFieldEditor ... />
    </div>
  </div>
);
```

---

### `src/components/plans/StepListPanel.tsx` (component — modified)

**Analog:** `src/components/plans/StepListPanel.tsx` lines 98–178 (`SortableStepRow`, itself)

**Active highlight + auto-scroll pattern** (SortableStepRow, StepListPanel.tsx lines 131–141):

```tsx
// StepListPanel.tsx lines 131-141 — isSelected drives bg-accent background
// Phase 22 extends: isActive drives same bg-accent tint + ref for scrollIntoView

const activeStepRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (isActive && activeStepRef.current) {
    activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}, [isActive]);

// SortableStepRow className — extend existing pattern:
className={cn(
  "flex items-center py-2 px-3 cursor-pointer select-none",
  isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
  isActive  ? "bg-accent text-accent-foreground" : "",   // NEW: same tint as selection
  isDragging && "opacity-50"
)}
```

**Badge overlay position** — inline after step name span (StepListPanel.tsx line 151):

```tsx
// StepListPanel.tsx line 151 — step name span; add StepStatusBadge after it
<span className="text-sm truncate flex-1">{step.name}</span>
<StepStatusBadge status={stepStatus} />  {/* NEW: right-aligned status badge */}
```

---

### `src/lib/types.ts` (model — modified)

**Analog:** `src/lib/types.ts` lines 220–228 (`Plan` interface, itself)

**Plan interface extension** (types.ts lines 220–228):

```typescript
// types.ts lines 220-228 — Plan interface; add stop_on_error: boolean
export interface Plan {
  id: string;
  name: string;
  schema_version: number;
  steps: PlanStep[];
  stop_on_error: boolean;   // NEW (D-07): default true; optional on load (isPlan() treats absence as true)
}
```

**New IPC result types** — add after existing `PublishOutcome` (types.ts line 161):

```typescript
// types.ts lines 159-162 — PublishOutcome pattern to follow for StepResult/ReplyMessage
export interface ReplyMessage {
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
  decodedAs: string | null;
}

export interface StepResult {
  status: 'done' | 'error';
  error: string | null;
  reply: ReplyMessage | null;
}
```

---

### `src/stores/usePlanStore.ts` (store — modified)

**Analog:** `src/stores/usePlanStore.ts` lines 103–118 (`renamePlan`, itself)

**updatePlan — optimistic-write + rollback** (usePlanStore.ts lines 103–118):

```typescript
// usePlanStore.ts lines 103-118 — renamePlan is the exact template for updatePlan
renamePlan: async (id: string, name: string): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [];
  let updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) => (p.id === id ? { ...p, name } : p));
    return { plans: updated };
  });
  try {
    await persistPlans(updated);
  } catch (err) {
    set({ plans: previous });
    throw err;
  }
},
// updatePlan replaces `{ ...p, name }` with `{ ...p, ...partial }` — identical otherwise.
```

**isPlan() guard update** (usePlanStore.ts lines 44–54):

```typescript
// usePlanStore.ts lines 44-54 — isPlan() type guard; add stop_on_error backward-compat check
function isPlan(value: unknown): value is Plan {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Plan;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.schema_version === "number" &&
    Array.isArray(v.steps) &&
    v.steps.every(isPlanStep)
    // stop_on_error: absence treated as true — do NOT require it here
    // typeof v.stop_on_error === 'undefined' || typeof v.stop_on_error === 'boolean'
  );
}
```

---

## Shared Patterns

### AMQP Connection (Ephemeral per Operation)
**Source:** `src-tauri/src/commands/publish.rs` lines 62–82 and `src-tauri/src/commands/consume.rs` lines 61–89
**Apply to:** `plan_runner.rs` (`execute_step` — one connection per step call)

```rust
// The tight-scope URI block pattern — password dropped before connect, URI dropped before result
let conn = {
    let uri = build_amqp_uri(...);
    drop(password);
    let result = tokio::time::timeout(Duration::from_secs(10), Connection::connect(...)).await;
    // uri dropped here
    result.map_err(...)?.map_err(...)?
};
```

### pool_state Clone Before Await
**Source:** `src-tauri/src/commands/subscribe.rs` lines 134–141
**Apply to:** `plan_runner.rs` (`execute_step`)

The MutexGuard is NOT Send — always clone the pool in a sync block that ends (guard dropped) before any `.await` point.

### Optimistic-Write + Rollback
**Source:** `src/stores/usePlanStore.ts` lines 103–118 (`renamePlan`)
**Apply to:** `usePlanStore.ts` (`updatePlan` addition)

Capture `previous` and `updated` arrays inside `set()`, then rollback to `previous` in the `catch` block.

### Disabled Button with Tooltip
**Source:** `src/components/publish/PublishBar.tsx` lines 503–518
**Apply to:** `PlanRunBar.tsx` (Run button disabled guards — zero steps, no active profile)

Wrap disabled `<Button>` in `<span>` inside `<TooltipTrigger asChild>` — required because a disabled button cannot receive focus events.

### toast.error for Backend Failures
**Source:** `src/components/publish/PublishBar.tsx` lines 276–279
**Apply to:** `usePlanRunner.ts` (per-step error notification when `stop_on_error = false`)

```typescript
import { toast } from "sonner";
toast.error(`Step failed: ${message}`, { duration: 5000 });
```

### AppError Variants (Rust)
**Source:** `src-tauri/src/error.rs` lines 1–37
**Apply to:** `plan_runner.rs` — use `AppError::AmqpError(...)` for AMQP failures, `AppError::InvalidInput(...)` for validation failures. No new variants needed.

### Tauri Command Signature Convention
**Source:** `src-tauri/src/commands/subscribe.rs` lines 67–76 (`start_subscribe`)
**Apply to:** `plan_runner.rs` (`execute_step`)

All managed-state params use `tauri::State<'_, Mutex<Option<T>>>`. `AppHandle` is the first param when profile loading is needed. Return `Result<T, crate::error::AppError>`.

---

## Planner Decision Needed

### Open Question #4: Reply Decoding Strategy (RESEARCH.md §Open Questions)

**File affected:** `src-tauri/src/commands/plan_runner.rs` (`execute_step` decode loop)

**What is blocked:** The `ReplyMessage.decoded` and `ReplyMessage.decoded_as` fields require knowing which proto type(s) to try against the `DescriptorPool`. Four options exist (see RESEARCH.md Open Question #4). The `execute_step` decode loop analog is `drain_messages` (consume.rs lines 358–405) — the loop shape is identical regardless of which option is chosen.

**Recommended fallback:** Pass `[step.message_type]` (the request type) as a single-element candidate list. This requires no schema change and covers the common RPC case. Use this if the user cannot be reached before planning starts.

**Impact if deferred:** `StepResult.reply` will be populated with best-effort decoded data; Phase 23 can override the decode strategy. The `ReplyMessage` struct shape is unaffected — `decoded_as` is already `Option<String>`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src-tauri/Cargo.toml` | config | — | Dependency-only change; no code pattern applies — see RESEARCH.md §Standard Stack for uuid version |

---

## Metadata

**Analog search scope:** `src-tauri/src/commands/`, `src/stores/`, `src/hooks/`, `src/components/`, `src/lib/`
**Files scanned:** 12 source files read directly; supplementary Bash glob/grep to locate Badge/Switch/Tooltip/toast usage sites
**Pattern extraction date:** 2026-05-24
