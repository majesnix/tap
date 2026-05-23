# Architecture Patterns — Plan Runner Integration

**Project:** Tap v1.6 Plan Runner
**Researched:** 2026-05-23
**Confidence:** HIGH (derived directly from reading v1.5 source)

---

## Existing Architecture Baseline (v1.5)

### Rust Backend Shape

| Command | File | Pattern |
|---------|------|---------|
| `parse_proto` | `commands/proto.rs` | Sets `DescriptorPool` in managed `Mutex<Option<DescriptorPool>>` AppState |
| `encode_message` | `commands/encode.rs` | Reads pool; sync encode; returns hex string |
| `publish_message` | `commands/publish.rs` | Ephemeral lapin connection per call; publisher confirms; returns `PublishOutcome` |
| `consume_message` | `commands/consume.rs` | Ephemeral lapin connection; basic_get; ack-before-decode |
| `drain_messages` | `commands/consume.rs` | Ephemeral lapin connection; loop up to 500 basic_get; multi-type decode |
| `start_subscribe` | `commands/subscribe.rs` | Persistent lapin connection; background task via `tauri::async_runtime::spawn`; streaming via `tauri::ipc::Channel<DrainResult>` |
| `stop_subscribe` | `commands/subscribe.rs` | Cancels `CancellationToken` stored in `Mutex<Option<SubscribeState>>` |
| `save_profile` / `list_profiles` etc. | `commands/connection.rs` | `tauri-plugin-store` + OS keychain via `keyring-core` |
| `fetch_queues` / `fetch_exchanges` | `commands/connection.rs` | `reqwest` to Management API |

**AppState (managed):**
- `Mutex<Option<prost_reflect::DescriptorPool>>` — single pool, replaced on each proto load
- `Mutex<Option<SubscribeState>>` — one active subscribe session at a time; `SubscribeState { token: CancellationToken, handle: Option<JoinHandle<()>> }`

### React Frontend Shape

**Stores (Zustand 5):**
- `useProtoStore` — open files, active file, schema, selected message type, hex preview, last send signal (`lastSendAt`), pending replay values
- `useConnectionStore` — profiles, active profile, connection/management status, queues, exchanges
- `useHistoryStore` — FIFO-100 send history; `tauri-plugin-store` persistence to `history.json`
- `useBlockStore` — message blocks; `tauri-plugin-store` persistence to `blocks.json`
- `useResponseStore` — feed messages (FIFO-500), subscribe status, queue selection, decode types

**Component tree (v1.5):**
```
App.tsx
  ThemeProvider (next-themes)
    ThemeBootstrap
    UpdateChecker
    AppLayout                   ← top-level layout; owns DndContext
      aside (Sidebar)
      main
        PublishBar
        DndContext
          BlockLibraryPanel
          FormPanel             ← react-hook-form + ProtoFormRenderer (FROZEN)
        DragOverlay
      aside (RightPanel)        ← tabs: Hex / History / Response
        HexPreviewPanel
        MessageHistoryPanel
        MessageFeedTab          ← drain + live subscribe feed
    Toaster
```

**FROZEN contracts:**
- `ProtoFormRenderer` switch body — extend via pre-dispatch branches only
- `applyBlockRef` contract — ref wiring at form-level drop zone, no switch changes
- `AppLayout`'s `DndContext` + `DragOverlay` — mounted at layout level for z-index correctness

**Persistence stores (tauri-plugin-store):**
- `tap.json` — theme mode
- `history.json` — send history entries (FIFO-100)
- `blocks.json` — message blocks

---

## Decision 1: Rust Command Design — Single Command vs. JS Orchestration

**Recommendation: JS-orchestrated step execution using existing commands.**

A `execute_plan_step` Rust command that wraps publish + conditional consume inside Rust is superficially attractive but creates problems:

1. **Polling logic belongs in JS.** The response-waiting strategy (correlationId match, first-arrival, no-wait with delay) requires polling `basic_get` or subscribing to a reply queue — both are already available as JS-callable commands. Adding a new Rust wrapper duplicates logic that already exists and works.

2. **Each step already maps cleanly to existing commands.** A plan step is: `encode_message` → `publish_message` → (optionally) `start_subscribe` + `stop_subscribe` or `drain_messages`. The JS orchestrator sequences these with `await`, handles per-step state transitions, and surfaces errors inline.

3. **Pause / Stop controls require JS control of the loop.** A single Rust command cannot be paused mid-execution without a second cancellation mechanism. The JS loop already runs in a React context where a "stop" action simply sets an ephemeral flag that the `while (steps[i] && !stopped)` loop checks.

4. **The only new Rust command needed is `check_queue_depth` for multi-queue monitoring.** This is a simple wrapper around `fetch_queue_depth` that accepts multiple queue names and returns a map — or the existing `fetch_queue_depth` (singular) called in parallel from JS is sufficient.

**Concrete step execution sequence (JS):**

```
for each step:
  1. encode_message(step.proto_file, step.message_type, step.field_values)
     → produces payload bytes
  2. publish_message(profile, step.target, payload, step.amqp_props)
     → PublishOutcome { status }
     → update step status: Sending → (WaitingResponse | Done | Error)
  3. if step.response_config.mode === "correlationId":
       poll drain_messages(reply_queue) until matching correlationId found
       or timeout
  4. if step.response_config.mode === "firstArrival":
       drain_messages(reply_queue, count=1) with timeout poll
  5. if step.response_config.mode === "noWait":
       await delay(step.response_config.delayMs)
  6. advance to next step
```

**No new Rust command for step execution.** The JS runner orchestrates existing commands.

---

## Decision 2: Multi-Queue Monitoring During a Plan Run

**Recommendation: Reuse `start_subscribe` / `stop_subscribe` with a plan-scoped channel.**

The existing `start_subscribe` command is a single-queue persistent consumer. During a plan run, the shared response feed collects all messages arriving on watched queues (which may change per step).

**Pattern:** One `start_subscribe` call per watched queue. Plan runner starts a subscribe session on the reply queue before step 1 executes, and stops it after the plan completes (or on Stop). All incoming `DrainResult` events are appended to the plan's `executionFeed` (not the global `useResponseStore.messages`).

**Critical boundary:** The plan's subscribe channel is **separate from the global subscribe session** in `useResponseStore`. Two independent subscribe sessions can run simultaneously on different queues because each opens its own lapin connection + channel (ephemeral per session). The `Mutex<Option<SubscribeState>>` in AppState is **the bottleneck** — it allows only one active global subscribe at a time.

**Resolution:** Add a second managed state slot for plan subscribe:

```rust
// In lib.rs AppState registrations:
.manage(Mutex::new(Option::<commands::subscribe::SubscribeState>::None))  // existing: global subscribe
.manage(commands::plan::PlanSubscribeState::new())                         // new: plan subscribe
```

Or, simpler: make `start_subscribe` accept an optional `session_id: String` parameter and use a `HashMap<String, SubscribeState>` in managed state. This avoids adding a second managed type.

**Simplest approach (recommended):** Use a `HashMap`-based subscribe manager:

```rust
// commands/subscribe.rs — extend existing
pub struct SubscribeManager {
    pub sessions: HashMap<String, SubscribeState>,
}
// Managed as: Mutex<SubscribeManager>
// start_subscribe(session_id: "global") for the existing flow
// start_subscribe(session_id: "plan") for plan runs
// stop_subscribe(session_id: "global"|"plan")
```

**Frontend impact:** The existing `SubscribePanel` / `MessageFeedTab` passes `session_id: "global"` implicitly. Plan runner passes `session_id: "plan"`. The Tauri `Channel` instances are separate — plan events go to the plan store, not `useResponseStore`.

This approach requires modifying `start_subscribe` and `stop_subscribe` signatures and updating `lib.rs` managed state. The existing frontend behavior is unchanged because it always passes `session_id: "global"`.

---

## Decision 3: Plan Full-Screen View in the React Component Tree

**Recommendation: View-level switcher at `App.tsx`, not a new route, not inside `AppLayout`.**

Three options:

**Option A — React Router route (`/plan`, `/`):** Adds a dependency (React Router or TanStack Router). Unnecessary for a desktop app with two views. Routing libraries add complexity and bundle size for no benefit here. Rejected.

**Option B — Inside AppLayout (panel replacement):** Plan view replaces the center panel content. Forces Plan view into the same sidebar + right-panel chrome. The Plan runner UI is full-screen; fitting it into the existing layout constraints (sidebar is 288px, right panel is 320px) would require hiding both sidebars. Awkward and fragile — the layout would need mode-dependent conditional rendering throughout. Rejected.

**Option C — Top-level view switcher in `App.tsx`:** A `currentView: "main" | "plans"` local state in `App.tsx` (or a thin store). When `"plans"`, render `<PlanView />` full-screen in place of `<AppLayout />`. When `"main"`, render `<AppLayout />` as today. No layout constraints, no routing library, no changes to `AppLayout`. Clean separation.

**Chosen: Option C.**

```tsx
// App.tsx (extended)
export default function App() {
  const [view, setView] = useState<"main" | "plans">("main");
  return (
    <ThemeProvider ...>
      <ThemeBootstrap />
      <UpdateChecker />
      {view === "main"
        ? <AppLayout onNavigatePlans={() => setView("plans")} />
        : <PlanView onNavigateMain={() => setView("main")} />}
      <Toaster />
    </ThemeProvider>
  );
}
```

`AppLayout` receives an `onNavigatePlans` callback that a sidebar button invokes. `PlanView` receives an `onNavigateMain` callback for a "Back" button.

**DndContext:** Plan view has its own drag-and-drop context (step reordering). This is separate from the `AppLayout`-level `DndContext` (block apply). No conflict: the two contexts are never mounted simultaneously.

---

## Decision 4: Zustand Store Design — Plan State

### Persistent (tauri-plugin-store → `plans.json`)

**`usePlanStore`** holds plan definitions that survive app restarts.

```typescript
interface PlanStep {
  id: string;                          // crypto.randomUUID()
  protoFilePath: string;               // path to .proto file
  messageTypeName: string;             // full_name from schema
  fieldValues: Record<string, unknown>;// field values (same shape as HistoryEntry.fieldValues)
  target: {
    mode: "queue" | "exchange";
    queue?: string;
    exchange?: string;
    routingKey?: string;
  };
  amqpProps?: {
    correlationId?: string;
    replyTo?: string;
    contentType?: string;
    deliveryMode?: 1 | 2;
    ttl?: number;
    headers?: [string, string][];
  };
  responseConfig: {
    mode: "correlationId" | "firstArrival" | "noWait";
    replyQueue?: string;            // for correlationId + firstArrival modes
    timeoutMs?: number;             // default 10000
    delayMs?: number;               // for noWait mode
  };
}

interface Plan {
  id: string;
  name: string;
  steps: PlanStep[];
  createdAt: string;                   // ISO timestamp
  updatedAt: string;
}

interface PlanStore {
  plans: Plan[];
  plansLoaded: boolean;
  loadPlans: () => Promise<void>;
  createPlan: (name: string) => Promise<Plan>;
  updatePlan: (id: string, updates: Partial<Pick<Plan, "name" | "steps">>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  duplicatePlan: (id: string) => Promise<Plan>;
}
```

Pattern follows `useBlockStore` exactly: optimistic update → persist → rollback on failure. Store path: `plans.json`. Hydration gate: `plansLoaded` flag.

### Ephemeral (React state — never persisted)

Execution state is local to `PlanView` or a dedicated ephemeral store. It resets on every run and does not survive navigation away.

```typescript
// usePlanExecutionStore — ephemeral, NOT persisted
type StepStatus = "Pending" | "Sending" | "WaitingResponse" | "Done" | "Error";

interface StepExecutionState {
  stepId: string;
  status: StepStatus;
  publishOutcome?: "ack" | "nack" | "returned" | "timeout";
  response?: FeedMessage;              // decoded response for inline display
  error?: string;
}

interface PlanExecutionStore {
  activePlanId: string | null;
  stepStates: StepExecutionState[];   // ordered, index matches plan.steps
  runStatus: "Idle" | "Running" | "Paused" | "Done" | "Error";
  executionFeed: FeedMessage[];        // shared feed of all messages arriving during run
  startRun: (plan: Plan) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  stopRun: () => void;
  updateStepStatus: (stepId: string, update: Partial<StepExecutionState>) => void;
  appendFeedMessage: (msg: FeedMessage) => void;
  reset: () => void;
}
```

**Why a separate ephemeral store (not component state):** The plan runner's execution state needs to be readable by multiple components simultaneously — the step list (for status badges), the execution feed (for incoming messages), and the Run/Pause/Stop control bar. Component state would require prop-drilling through three levels. A Zustand store is the right tool; making it ephemeral (no persistence calls) keeps it simple.

**What is not stored:**
- The live Tauri `Channel` handler — this is a closure reference, not serializable
- Whether a subscribe session is active during the run — derived from `runStatus`

---

## Decision 5: Build Order for Phases

The dependencies are:

```
Phase A: Plan data model + persistence
  → usePlanStore (plans.json)
  → Plan / PlanStep TypeScript types
  → Basic plan CRUD (create, rename, delete)
  UNBLOCKED — no new Rust, no UI chrome yet

Phase B: Plan view shell + navigation
  → App.tsx view switcher
  → PlanView component (full-screen)
  → Plan list panel (left column: list of plans)
  → PlanView navigation trigger in Sidebar
  DEPENDS ON: Phase A (needs plan list to render)
  NO new Rust

Phase C: Step editor — authoring
  → Step list within a selected plan
  → Step create: from-scratch mini form (proto picker + message type selector)
  → Step import from history (history picker modal → copies fieldValues)
  → Step import from block (block picker modal → copies JSON content)
  → Step reordering via dnd-kit (plan-scoped DndContext, separate from AppLayout)
  DEPENDS ON: Phase A, Phase B
  NO new Rust
  RISK: Step authoring "from scratch" needs a proto file picker and a mini form
        that reproduces FormPanel behavior. Use existing `parse_proto` command.
        Do NOT use ProtoFormRenderer directly (it's coupled to useProtoStore).
        Create a lightweight StepFieldEditor that calls encode_message directly.

Phase D: Plan runner — sequential execution
  → usePlanExecutionStore (ephemeral)
  → JS orchestration loop (encode → publish → response wait)
  → Per-step status badges (Pending / Sending / WaitingResponse / Done / Error)
  → Run / Pause / Stop controls
  → subscribe_manager Rust changes (session_id parameter on start/stop_subscribe)
  DEPENDS ON: Phase A, Phase B, Phase C
  NEW RUST: modify start_subscribe + stop_subscribe to accept session_id
  RISK: correlationId matching requires polling basic_get in a JS loop;
        test timeout handling carefully

Phase E: Response view — inline + shared feed
  → Inline decoded response under each step that received one
  → Shared scrollable execution feed (all messages from plan-scoped subscribe)
  → Feed filtering (reuse existing FilterBar component patterns)
  DEPENDS ON: Phase D (needs execution state + feed messages)
  NO new Rust
```

**Strict ordering:** A → B → C → D → E. Phase C cannot start before A+B because the step editor needs plan CRUD to persist steps and the PlanView shell to render in. Phase D cannot start before C because it needs steps to execute. Phase E is purely additive on top of D.

**Phase D is the riskiest phase.** It introduces the only new Rust changes (subscribe_manager session_id), the JS orchestration loop with real AMQP I/O, and the correlationId polling logic. Allocate extra time and plan for deeper phase-specific research before implementation.

---

## Component Boundaries — New vs. Modified

### New Components

| Component | Location | Responsibility |
|-----------|----------|---------------|
| `PlanView` | `src/components/plan/PlanView.tsx` | Full-screen container; owns plan-scoped DndContext |
| `PlanListPanel` | `src/components/plan/PlanListPanel.tsx` | Left column: plan list, create/delete/rename |
| `PlanDetailPanel` | `src/components/plan/PlanDetailPanel.tsx` | Right area: step list + editor + runner |
| `StepList` | `src/components/plan/StepList.tsx` | Ordered step cards with drag handles |
| `StepEditor` | `src/components/plan/StepEditor.tsx` | Per-step config: proto, target, response mode |
| `StepFieldEditor` | `src/components/plan/StepFieldEditor.tsx` | Lightweight field form (calls encode_message directly, NOT ProtoFormRenderer) |
| `PlanRunnerControls` | `src/components/plan/PlanRunnerControls.tsx` | Run / Pause / Stop bar |
| `PlanExecutionFeed` | `src/components/plan/PlanExecutionFeed.tsx` | Scrollable feed of all plan-run messages |
| `HistoryPickerModal` | `src/components/plan/HistoryPickerModal.tsx` | Pick history entry → populate step field values |
| `BlockPickerModal` | `src/components/plan/BlockPickerModal.tsx` | Pick block → populate step field values |
| `usePlanStore` | `src/stores/usePlanStore.ts` | Persistent plan CRUD |
| `usePlanExecutionStore` | `src/stores/usePlanExecutionStore.ts` | Ephemeral execution state |

### Modified Files

| File | Change | Why |
|------|--------|-----|
| `src/App.tsx` | Add `view` state + conditional render | Plan view switcher |
| `src/components/layout/AppLayout.tsx` | Add `onNavigatePlans` callback prop | Navigation trigger |
| `src/components/sidebar/Sidebar.tsx` | Add "Plans" navigation button | Entry point to plan view |
| `src-tauri/src/commands/subscribe.rs` | Add `session_id: String` param; change managed state to `HashMap` | Multi-session support |
| `src-tauri/src/lib.rs` | Update managed state registration for subscribe manager | New subscribe state shape |
| `src/lib/types.ts` | Add `Plan`, `PlanStep`, `StepStatus` types | New data model |

### Unchanged / Frozen

| File | Status | Reason |
|------|--------|--------|
| `ProtoFormRenderer.tsx` | FROZEN | Switch body frozen; plan uses a separate StepFieldEditor |
| `AppLayout` DndContext | UNCHANGED | Plan view has its own DndContext; AppLayout's is for block-apply only |
| `useResponseStore` | UNCHANGED | Plan runner has its own ephemeral feed; global subscribe is unaffected |
| `useHistoryStore` | UNCHANGED | Read-only access from HistoryPickerModal |
| `useBlockStore` | UNCHANGED | Read-only access from BlockPickerModal |
| All publish/consume commands | UNCHANGED | Existing commands reused directly from JS runner |

---

## Data Flow — Plan Step Execution

```
User clicks Run
  ↓
usePlanExecutionStore.startRun(plan)
  → stepStates = plan.steps.map(s => ({ stepId: s.id, status: "Pending" }))
  → runStatus = "Running"
  ↓
[JS runner loop — for each step while runStatus === "Running"]
  ↓
  1. setStepStatus(stepId, "Sending")
  2. invoke("encode_message", { proto_file, message_type, field_values })
     → payload bytes
  3. invoke("publish_message", { profile, exchange, routing_key, payload, ... })
     → PublishOutcome { status: "ack" | "nack" | ... }
  4a. if responseConfig.mode === "noWait":
        await delay(delayMs)
        setStepStatus(stepId, "Done")
  4b. if responseConfig.mode === "correlationId" | "firstArrival":
        setStepStatus(stepId, "WaitingResponse")
        [poll drain_messages(replyQueue, count=1) in timeout loop]
          on message: appendFeedMessage(msg); updateStepStatus(response=msg, "Done")
          on timeout:  setStepStatus(stepId, "Error", "Timed out waiting for response")
  ↓
  next step (if not paused/stopped)
  ↓
runStatus = "Done" | "Error"
```

**Parallel queue monitoring (shared feed):**
```
Before step 1:
  invoke("start_subscribe", { session_id: "plan", queue: replyQueue, channel })
  channel.onMessage → usePlanExecutionStore.appendFeedMessage(msg)

After all steps done / Stop pressed:
  invoke("stop_subscribe", { session_id: "plan" })
```

The correlationId polling loop (`drain_messages`) and the background subscribe channel run in parallel. The subscribe channel populates the shared feed; the drain loop is used for step-level response detection (drain is synchronous from JS's perspective; subscribe is async push). The two do not conflict because drain is basic_get (pull) and subscribe is basic_consume (push) — they can target the same queue simultaneously but the first to consume a message wins the delivery. For simplicity, use **either** drain polling **or** subscribe, not both simultaneously on the same queue for response waiting. Recommended: subscribe-based approach (plan subscribe channel per reply queue; correlationId/firstArrival logic runs inside the channel handler).

---

## Scalability and Edge Cases

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Plan steps fail mid-run | Steps 1..N-1 acked by broker | Stop run, mark remaining steps Error, surface last error |
| Plan view navigated away during run | Background subscribe leaks | PlanView unmount must call `stop_subscribe("plan")` and `usePlanExecutionStore.reset()` |
| Two plan runs attempted simultaneously | Second start would see runStatus="Running" | Disable Run button while running; idempotent guard in startRun |
| Global subscribe running when plan subscribe starts | Both use "global" session_id | After session_id change, plan uses "plan" — no collision |
| Very large plan (100 steps) | JS loop takes time | No change needed; loop is async-sequential; Pause works at step boundary |
| Reply queue empty / no response arrives | drain_messages returns empty | Timeout-based polling loop exits with Error status |
| Stop pressed mid-step | Must not leave AMQP channel in bad state | ephemeral connections close on each command; publish_message always closes before returning |

---

## Sources

All findings derived from direct source code reading of the v1.5 codebase:
- `/mnt/shimikaze/gits/tap/src-tauri/src/lib.rs` (managed state, command registration)
- `/mnt/shimikaze/gits/tap/src-tauri/src/commands/publish.rs` (ephemeral connection pattern)
- `/mnt/shimikaze/gits/tap/src-tauri/src/commands/subscribe.rs` (CancellationToken, SubscribeState, Channel streaming)
- `/mnt/shimikaze/gits/tap/src-tauri/src/commands/consume.rs` (DrainResult, basic_get pattern)
- `/mnt/shimikaze/gits/tap/src/components/layout/AppLayout.tsx` (DndContext placement, layout constraints)
- `/mnt/shimikaze/gits/tap/src/App.tsx` (ThemeProvider, component tree root)
- `/mnt/shimikaze/gits/tap/src/components/layout/RightPanel.tsx` (tab auto-switch pattern)
- `/mnt/shimikaze/gits/tap/src/stores/useBlockStore.ts` (persistence pattern with rollback)
- `/mnt/shimikaze/gits/tap/src/stores/useHistoryStore.ts` (hydration gate pattern)
- `/mnt/shimikaze/gits/tap/src/stores/useResponseStore.ts` (FeedMessage, subscribe status)
- `/mnt/shimikaze/gits/tap/src/lib/types.ts` (all TypeScript types)
- `/mnt/shimikaze/gits/tap/.planning/PROJECT.md` (key decisions, constraints, frozen contracts)
