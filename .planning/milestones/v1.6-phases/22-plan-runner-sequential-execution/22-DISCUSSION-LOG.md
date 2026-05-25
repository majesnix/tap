# Phase 22: Plan Runner — Sequential Execution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 22-Plan Runner — Sequential Execution
**Areas discussed:** Rust command API, Stop-on-error persistence, Run mode UX, Run controls placement

---

## Rust Command API

**Q1: How should the Rust command API be structured?**

| Option | Description | Selected |
|--------|-------------|----------|
| Single `execute_step` command | One atomic command per step: publish + wait. JS loop awaits each. Stop via `cancel_plan_run` CancellationToken. | ✓ |
| Separate publish + wait commands | Reuse `publish_message`, add separate `wait_for_correlation_reply` / `wait_for_first_arrival` commands. More composable, JS coordinates two-phase sequence. | |
| Single `run_plan` command (full Rust loop) | Long-running Rust command takes full plan, streams step updates via Tauri Channel. | |

**User's choice:** Single `execute_step` command
**Notes:** Recommended option selected. JS runner loop stays simple (awaits one command per step); Rust handles the consumer-before-publish ordering and `tokio::select!` cancellation internally.

---

**Q2: How should `execute_step` expose reply data?**

| Option | Description | Selected |
|--------|-------------|----------|
| Return decoded reply inline in StepResult | `StepResult { status, error, reply: Option<ReplyMessage> }`. JS stores in `usePlanExecutionStore`. | ✓ |
| No reply data in Phase 22 (defer to Phase 23) | `execute_step` returns only `{ status, error }`. Phase 23 adds reply decode and display. | |

**User's choice:** Return decoded reply inline in StepResult
**Notes:** Phase 23 uses `StepResult.reply` to display inline decoded responses; Phase 22 already captures it.

---

**Q3: Does `execute_step` use pool_state for reply decoding?**

| Option | Description | Selected |
|--------|-------------|----------|
| Rust decodes reply (pool_state, same as consume_message) | Consistent pattern. Returns `decoded: Option<serde_json::Value>` + `hex_string`. | ✓ |
| Rust returns raw bytes, frontend decodes | Two-hop decode via a new `decode_payload` command. | |

**User's choice:** Rust decodes reply using pool_state
**Notes:** Consistent with `consume_message` and `drain_messages`. No new decode command needed.

---

## Stop-on-Error Persistence

**Q1: Should `stop_on_error` persist on the Plan type or stay ephemeral?**

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted on Plan type (default: true) | Add `stop_on_error: boolean` to `Plan` interface; missing field defaults to `true` on load. | ✓ |
| Per-run UI toggle (ephemeral) | Stored in `usePlanExecutionStore` only, resets each run. | |

**User's choice:** Persisted on Plan type
**Notes:** RUN-04 says "per-plan setting" — persisting it with the plan is the correct interpretation. No schema_version bump needed (missing field defaults to `true`).

---

**Q2: Where should the stop_on_error toggle appear?**

| Option | Description | Selected |
|--------|-------------|----------|
| In the run controls bar (next to Run/Stop) | Compact Switch + label in the run header bar. | ✓ |
| In a plan-level settings panel/sheet | Settings icon opens a Sheet with plan-level config. | |
| You decide | Claude picks the simplest option. | |

**User's choice:** In the run controls bar next to Run / Stop buttons
**Notes:** Contextually clear — configure it where you run it.

---

## Run Mode UX

**Q1: What happens to the Phase 21 two-pane layout during a run?**

| Option | Description | Selected |
|--------|-------------|----------|
| Status overlaid on existing layout (editor read-only) | Step rows gain status badges; StepFieldEditor stays visible but inputs disabled. No layout shift. | ✓ |
| Dedicated run mode (editor hidden, step list expands) | Run switches to a focused monitoring view; requires layout toggle. | |
| You decide | Claude picks the approach that fits best. | |

**User's choice:** Status overlaid on existing layout
**Notes:** Simplest implementation. User can see step field values in context during execution.

---

**Q2: How is the currently-executing step distinguished?**

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight active step + auto-scroll + StepFieldEditor auto-switch | Active step highlighted with selection tint; step list scrolls; StepFieldEditor shows active step. | ✓ |
| Status badge only (no auto-scroll or auto-switch) | User manually navigates. | |

**User's choice:** Highlight active step + auto-scroll + StepFieldEditor auto-switch
**Notes:** Recommended. Uses same background tint as Phase 21 step selection (D-04). Auto-scroll via `scrollIntoView`.

---

**Q3: Where does the run summary appear?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in run controls bar (replace Run button area) | "✓ 3/4 succeeded" replaces Run button after completion; Re-run button appears. | ✓ |
| Toast notification (Sonner) | Ephemeral completion toast, consistent with publisher confirms pattern. | |
| You decide | Claude picks most consistent with the app. | |

**User's choice:** Inline in the run controls bar
**Notes:** Summary persists until user starts a new run. Re-run button clears summary and restarts.

---

## Run Controls Placement

**Q1: Where do Run / Stop buttons live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Header bar spanning full PlanDetailPanel | Sticky header above the step list + editor split. `[Plan name] | [stop-on-error toggle] | [Run/Stop button]`. Mirrors PublishBar pattern. | ✓ |
| Above step list column only | Narrower, may truncate at 240px step list width. | |
| You decide | Claude picks best layout fit. | |

**User's choice:** Header bar spanning the full PlanDetailPanel
**Notes:** Consistent with PublishBar (spans full bottom of main layout). Plan name visible in the header context.

---

**Q2: Should Run button be disabled on no-steps / no-profile?**

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled with tooltip explaining why | `disabled` prop + shadcn `Tooltip` on hover. | ✓ |
| Always enabled, error toast on attempt | Simpler implementation, worse UX. | |

**User's choice:** Disabled on both conditions with tooltip
**Notes:** Guards: (a) zero steps → "Add steps to run"; (b) no active profile → "Select a connection profile first".

---

## Claude's Discretion

- `StepResult` / `ReplyMessage` Rust struct field names — follow existing `ConsumeResult` / `DrainResult` naming conventions
- `execute_step` publish args struct shape — reuse `publish_message` parameter structure
- `usePlanRunner` hook file location — `src/hooks/usePlanRunner.ts` or co-located in `src/components/plans/`
- No-wait step: `delay_ms: 0` = a yield (not a hard skip)

## Deferred Ideas

- RESP-04 / RESP-05 (decoded response inline + shared reply feed) — Phase 23 scope; `StepResult.reply` is captured but not displayed in Phase 22
- Pause / Resume mid-run — Future Requirement in REQUIREMENTS.md, deferred past v1.6
- Variable extraction across steps — deferred to v2
