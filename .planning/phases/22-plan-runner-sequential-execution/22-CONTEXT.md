# Phase 22: Plan Runner — Sequential Execution - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Run button into a sequential execution engine. Given a plan with authored steps (Phase 21), the user presses Run and watches steps execute one at a time in order, each transitioning through `Pending → Sending → WaitingResponse → Done / Error` status badges in real time. All three response modes work: no-wait (fire + delay), correlation-id (wait for matching reply), and first-arrival (wait for any reply). User can stop the run at any time. A run summary (N/M succeeded) is shown on completion. Phase 23 handles the decoded-response display inline under each step and the shared reply feed.

</domain>

<decisions>
## Implementation Decisions

### Rust Command API

- **D-01:** New `execute_step` Tauri command — one command handles a single step atomically: publish + reply-wait (if applicable). JS runner loop calls `execute_step` per step, awaiting each before moving to the next. This matches the "JS runner loop" note in ROADMAP.md while keeping Rust responsible for AMQP complexity.
- **D-02:** `execute_step` signature: `(profile_name, publish_args, response_mode) → StepResult`. `StepResult` is `{ status: "done" | "error", error: Option<String>, reply: Option<ReplyMessage> }`. `ReplyMessage` mirrors the decoded-reply struct from `ConsumeResult` (decoded fields + hex_string).
- **D-03:** `execute_step` uses `pool_state` (same `Mutex<Option<DescriptorPool>>` pattern as `consume_message`) to decode the reply payload in Rust. No two-hop decode — Rust returns the decoded value directly.
- **D-04:** Cancellation: a separate `cancel_plan_run` Tauri command flips a `PlanRunState` `CancellationToken`. `execute_step` uses `tokio::select!` on three branches: delivery match / timeout / cancellation token (ROADMAP pitfall #70). Stop is clean — current in-flight `execute_step` resolves with `{ status: "error", error: "Cancelled" }`.
- **D-05:** `PlanRunState` is a separate managed-state slot in `lib.rs` (parallel to `SubscribeState` — NOT merged into it). Pattern: `Mutex<Option<PlanRunState>>` where `PlanRunState { token: CancellationToken }`. No JoinHandle needed — `execute_step` is a Tauri command awaited directly by the JS runner.
- **D-06:** Critical AMQP ordering for correlation-id and first-arrival modes: consumer MUST be opened before publish (ROADMAP pitfall #59). `execute_step` opens the reply consumer, then publishes, then waits. `correlation_id` is read from AMQP delivery properties (not headers) (pitfall #58). Non-matching correlation-id replies on the correlation-id consumer: selectively NACKed and requeued (pitfall #60).

### Stop-on-Error

- **D-07:** Add `stop_on_error: boolean` to the `Plan` interface in `src/lib/types.ts`. Default value: `true`. Schema migration: field is optional on load — missing field defaults to `true` (no schema_version bump required; `isPlan()` guard in `usePlanStore` updated to treat absence as `true`).
- **D-08:** `stop_on_error` is shown as a toggle in the run controls bar, next to the Run / Stop buttons. Displayed as a compact "Stop on error" switch (shadcn `Switch` + label). When toggled, calls `usePlanStore.updatePlan(planId, { stop_on_error: value })` to persist immediately.

### Run Mode UX

- **D-09:** Phase 21's two-pane layout (step list left + StepFieldEditor right) stays intact during a run — no layout switch. Status badges are overlaid on each step row. StepFieldEditor inputs are disabled (read-only) while the plan is running.
- **D-10:** The actively-executing step (Sending or WaitingResponse) is highlighted in the step list with the same background tint used for selection, and the step list auto-scrolls to keep it visible. StepFieldEditor auto-switches to show the active step's fields (so user can see what's being sent).
- **D-11:** Run summary shown inline in the run controls bar after completion — the Run button area is replaced with "✓ 3/4 succeeded" (green) or "✗ 1/4 succeeded" (destructive). A "Re-run" button appears next to the summary. Clicking Re-run resets all statuses to Pending and starts a new run. Summary clears as soon as a new run starts.

### Run Controls Placement

- **D-12:** A sticky header bar at the top of `PlanDetailPanel` spans the full width (above the step list + editor split). Layout: `[Plan name (truncated)] | [Stop on error toggle] | [Run / Stop button]`. This mirrors how `PublishBar` spans the full bottom of the main layout. Run and Stop are the same button, toggling between states.
- **D-13:** Run button disabled guards: (a) plan has zero steps — tooltip: "Add steps to run"; (b) no active connection profile — tooltip: "Select a connection profile first". Both checks read from `usePlanStore` (step count) and `useConnectionStore` (active profile). Guard implemented via `disabled` prop + shadcn `Tooltip`.

### Execution State Store

- **D-14:** New `usePlanExecutionStore` (Zustand, ephemeral — NOT persisted). Holds: `runningPlanId: string | null`, `stepStatuses: Record<string, StepStatus>`, `activeStepId: string | null`, `isCancelling: boolean`. On run start: all steps set to `'pending'`. Each step transitions: `'sending'` on execute call, `'waiting-response'` if reply mode, then `'done'` or `'error'`. Cleared/reset when a new run starts or user navigates away.
- **D-15:** The JS runner loop lives in a custom hook `usePlanRunner` (co-located with `PlanDetailPanel` or in `src/hooks/`). It orchestrates: iterate steps → invoke `execute_step` → update `usePlanExecutionStore` status → check `stop_on_error` → continue or abort. Stop: calls `cancel_plan_run` Tauri command + sets `isCancelling: true`.

### Claude's Discretion

- Specific `StepResult` / `ReplyMessage` Rust struct field names — follow existing `ConsumeResult` / `DrainResult` naming conventions.
- `execute_step` publish args struct shape — reuse `publish_message` parameter structure to the extent possible (same exchange/routing_key/payload/properties pattern).
- `usePlanRunner` hook file location — `src/hooks/usePlanRunner.ts` or co-located in `src/components/plans/`.
- No-wait step timing: `delay_ms: 0` = `tokio::time::sleep(Duration::from_millis(0))` (effectively a yield, not a hard skip). Frontend enforces the minimum too.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §Execution Engine (RUN-01 through RUN-06) — all 6 execution requirements in scope for Phase 22
- `.planning/REQUIREMENTS.md` §Response Handling (RESP-01, RESP-02, RESP-03) — 3 of the 5 response requirements in scope for Phase 22 (RESP-04, RESP-05 are Phase 23)
- `.planning/ROADMAP.md` §Phase 22 — Goal, success criteria, and **critical pitfall notes (#58, #59, #60, #68, #70)** — downstream agents MUST read these before planning the Rust commands

### Foundation phases (MUST read — Phase 22 builds directly on these)
- `.planning/phases/19-plan-data-model-and-persistence/19-CONTEXT.md` — `Plan`, `PlanStep`, `StepStatus`, `ResponseMode`, `PublishTarget` type definitions and usePlanStore patterns
- `.planning/phases/21-step-editor-authoring/21-CONTEXT.md` — Phase 21 deliverables (PlanDetailPanel two-pane layout, StepListPanel, StepFieldEditor) that Phase 22 extends with the run controls header bar and status overlays

### Key source files to read before planning
- `src/lib/types.ts` — `PlanStep`, `ResponseMode` (no-wait / correlation-id / first-arrival), `StepStatus` definitions; Phase 22 adds `stop_on_error: boolean` to `Plan`
- `src/stores/usePlanStore.ts` — existing plan CRUD + step CRUD; Phase 22 adds `updatePlan(id, partial)` for `stop_on_error` persistence
- `src-tauri/src/commands/subscribe.rs` — `SubscribeState` and `start_subscribe` pattern: CancellationToken + JoinHandle managed state, `tokio::select!` loop. `PlanRunState` follows the same structural pattern (separate slot, NOT merged)
- `src-tauri/src/commands/publish.rs` — `publish_message` command: AMQP connection setup, BasicProperties, mandatory=true, correlation_id/reply_to fields. `execute_step` reuses this publish logic
- `src-tauri/src/commands/consume.rs` — `consume_message` / `drain_messages`: pool_state usage, basic_get pattern, `ConsumeResult` / `DrainResult` structs. `ReplyMessage` in `StepResult` mirrors `ConsumeResult`
- `src-tauri/src/lib.rs` — managed state registration; Phase 22 adds `Mutex<Option<PlanRunState>>` alongside the existing `SubscribeState` slot
- `src/components/plans/PlanDetailPanel.tsx` — Phase 21 layout (two-pane: StepListPanel + StepFieldEditor); Phase 22 adds the run controls header bar at the top
- `src/components/plans/StepListPanel.tsx` — Phase 21 step rows; Phase 22 adds status badge overlay and active-step highlight

### Existing AMQP patterns (no-consume-before-publish pitfall)
- `src-tauri/src/commands/subscribe.rs` lines with `basic_consume` / `basic_qos` — shows the consumer setup flow before the channel enters the delivery loop. Phase 22's `execute_step` must open the reply consumer BEFORE calling `basic_publish` (ROADMAP pitfall #59).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SubscribeState` (`src-tauri/src/commands/subscribe.rs`) — structural template for `PlanRunState`. Use `CancellationToken` + `tauri::async_runtime::JoinHandle` pattern. PlanRunState is simpler: no JoinHandle needed since `execute_step` is directly awaited.
- `publish_message` (`src-tauri/src/commands/publish.rs`) — AMQP connection setup + publish logic reusable inside `execute_step`. Avoid duplicating the URI-building, connection, channel, confirm-select boilerplate.
- `ConsumeResult` / `DrainResult` (`src-tauri/src/commands/consume.rs`) — `ReplyMessage` in `StepResult` mirrors these. Reuse `decoded: Option<serde_json::Value>`, `hex_string: String`, `error: Option<String>` field pattern.
- `pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>` — same parameter pattern in `execute_step` as in `consume_message` and `drain_messages`.
- `useConnectionStore` (`src/stores/useConnectionStore.ts`) — read `activeProfile` for Run button disabled guard.
- Sonner toast (`sonner` package, already installed) — for error feedback when a step fails mid-run and `stop_on_error = false` (show a toast per failed step, keep running).
- shadcn `Tooltip` — for Run button disabled state explanations. Already used elsewhere in the app.
- shadcn `Switch` — for the stop_on_error toggle in the run controls bar.

### Established Patterns
- **Ephemeral connection per operation** — `publish_message`, `consume_message`, `drain_messages` all open and close a fresh AMQP connection per call. `execute_step` follows the same pattern: one connection per step execution (intentional deviation from "long-lived connection per plan run" — simpler error handling, no reconnect logic). NOTE: ROADMAP explicitly calls out this as "intentional deviation" from the ephemeral-connection Key Decision.
- **Optimistic-write + rollback** — all `usePlanStore` mutations. `updatePlan` (for stop_on_error) follows the same pattern.
- **`tauri::async_runtime::spawn` not `tokio::spawn`** — critical for Windows compatibility (PROJECT.md Key Decision). `execute_step` doesn't need spawn (it's directly awaited), but `cancel_plan_run` uses the token.
- **`pool_state` clone before any `.await`** — MutexGuard is not Send; clone the pool before the first await point (same as `consume_message`).
- **Zustand ephemeral state** — `usePlanExecutionStore` is NOT persisted (no tauri-plugin-store). Cleared on new run or plan change.
- **`isPlan()` type guard in `usePlanStore`** — update to treat missing `stop_on_error` as `true` (backward compat for existing saved plans).

### Integration Points
- `src/components/plans/PlanDetailPanel.tsx` — Add `PlanRunBar` as a new sticky header above the existing flex row (StepListPanel + StepFieldEditor)
- `src-tauri/src/lib.rs` — Add `.manage(Mutex::new(Option::<commands::plan_runner::PlanRunState>::None))` alongside existing managed state
- `src-tauri/src/commands/mod.rs` — Add `pub mod plan_runner;` (new file: `src-tauri/src/commands/plan_runner.rs`)
- `src-tauri/src/lib.rs` `.invoke_handler()` — Add `execute_step`, `cancel_plan_run` to the handler list
- `src/lib/types.ts` — Add `stop_on_error: boolean` to `Plan` interface
- `src/stores/usePlanStore.ts` — Add `updatePlan(id: string, partial: Partial<Plan>)` action; update `isPlan()` guard for `stop_on_error`

</code_context>

<specifics>
## Specific Ideas

- The run controls bar is a single button that toggles: when idle shows "Run ▶" (green), when running shows "Stop ■" (destructive). After completion, the button area is replaced by the summary ("✓ 3/4" or "✗ 1/4") with a "Re-run" button.
- Active step highlight in StepListPanel uses the same background tint as the selection highlight from Phase 21 (D-04 in Phase 21 CONTEXT). Auto-scroll: use a `ref` on the active step row + `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
- `usePlanRunner` hook drives the execution loop: `for (const step of steps) { setStatus(step.id, 'sending'); const result = await invoke('execute_step', ...); setStatus(step.id, result.status === 'done' ? 'done' : 'error'); if (result.status === 'error' && stopOnError) break; }`.

</specifics>

<deferred>
## Deferred Ideas

- **RESP-04 / RESP-05** (decoded response inline under step + shared reply feed) — explicitly Phase 23 scope. `StepResult.reply` from `execute_step` is available but not yet displayed. Phase 23 reads `usePlanExecutionStore.stepReplies` to render inline.
- **Pause / Resume mid-run** — listed as Future Requirement in REQUIREMENTS.md. Cancellation token allows stopping cleanly; resuming requires additional state not in scope for v1.6.
- **Variable extraction across steps** — deferred to v2 per REQUIREMENTS.md.
- **Per-step timeout override in UI** — `ResponseMode.timeout_ms` is already in the type; configurable in StepFieldEditor (Phase 21). Phase 22 reads it from the step; no additional UI needed.

</deferred>

---

*Phase: 22-Plan Runner — Sequential Execution*
*Context gathered: 2026-05-24*
