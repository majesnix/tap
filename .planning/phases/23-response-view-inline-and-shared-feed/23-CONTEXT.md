# Phase 23: Response View — Inline and Shared Feed - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the display layer on top of Phase 22's execution engine. Two requirements in scope:

- **RESP-04**: When a step finishes with a reply (correlation-id or first-arrival mode), the decoded protobuf response is shown inline in the `StepFieldEditor` right pane — replacing the form view with a `ResponseDecodedView` + `ResponseHexSection` read-only display. User clicks the step again to toggle back to the form.
- **RESP-05**: A tab strip (`[Step Editor | Reply Feed]`) appears in the `StepFieldEditor` pane header after the first run. The Reply Feed tab shows all step replies in chronological order using the existing `MessageFeedRow` accordion component, accumulated in `usePlanExecutionStore.planReplyFeed` (FIFO-500).

No-wait steps are excluded from the feed. No new Rust commands required — all data comes from `StepResult.reply` already returned by `execute_step`.

</domain>

<decisions>
## Implementation Decisions

### Inline Reply Display (RESP-04)

- **D-01:** Decoded step reply appears in the `StepFieldEditor` right pane, NOT in the step list. The step list remains compact (~240px) with only status badges.
- **D-02:** When a step has a reply, the right pane shows the **reply view only** — it replaces the form (not appended below). The disabled form fields are NOT shown alongside the reply. Clean focus on the result.
- **D-03:** Toggle back: a second click on the same step row in `StepListPanel` switches the pane back to editor mode (same row click that originally selected the step). No additional button in the reply view header.
- **D-04:** During a live run, the right pane auto-switches to a step's reply view as soon as `executeStep` resolves with a reply. Consistent with Phase 22's auto-scroll to active step (D-10 in Phase 22 CONTEXT). When the next step starts executing, the pane switches back to that step's form in read-only mode.

### Shared Reply Feed (RESP-05)

- **D-05:** A tab strip with two tabs (`Step Editor` | `Reply Feed`) appears in the `StepFieldEditor` pane header **once a plan has been run** (after `setRunning()` is called for the first time in the session). The tab strip persists for the session lifetime of that plan — consistent with how `stepStatuses` and `summary` are retained post-run.
- **D-06:** The `Reply Feed` tab shows accumulated reply messages in a **scrollable accordion list using the existing `MessageFeedRow` component**. Each entry: routing key, content-type, timestamp in the collapsed row; `ResponseDecodedView` + `ResponseHexSection` on expand. Zero new display component needed.
- **D-07:** The `Reply Feed` tab does NOT auto-activate when a run starts. User switches to it manually. No surprise layout jumps during a live run — the step editor mode (or reply view per D-04) is the primary focus during execution.
- **D-08:** The tab strip interacts with the reply view (D-01/D-02) as follows: when the pane is in "reply view" mode (showing a step's inline reply), the tab strip still renders with `Step Editor` active. The `Reply Feed` tab is always accessible regardless of which step is selected.

### Feed Storage

- **D-09:** `planReplyFeed: FeedMessage[]` is added to `usePlanExecutionStore` (the existing ephemeral Zustand store). A new `appendReplyFeedEntry(entry: FeedMessage)` action appends an entry (FIFO-500 — same cap as drain/subscribe). `clearRun()` resets `planReplyFeed` to `[]`. No separate store.
- **D-10:** Feed scope: **reply messages only** — only steps in `correlation-id` or `first-arrival` response mode that received a reply. No-wait steps are excluded. No synthetic entries. Matches REQUIREMENTS.md: "messages arriving on watched reply queues".
- **D-11:** FIFO cap: **500 entries** — same as the drain/subscribe `MessageFeedTab` (D-16 from Phase 13). Consistent, negligible memory impact for a dev tool.

### usePlanRunner Updates

- **D-12:** `usePlanRunner` calls `appendReplyFeedEntry()` after each step that resolves with a non-null `result.reply`. The entry is shaped as `FeedMessage`: `id` = `crypto.randomUUID()`, `routingKey` = `result.reply.routingKey`, `exchange` = `""` (not present in `ReplyMessage`), `contentType` = `result.reply.contentType`, `timestamp` = `Date.now() / 1000`, `decoded` = `result.reply.decoded`, `hexString` = `result.reply.hexString`, `error` = null, `decodedAs` = `result.reply.decodedAs`.
- **D-13:** `usePlanRunner` also calls a new `setStepReply(stepId, reply)` action to store the raw `ReplyMessage` keyed by step ID. This is the source of truth for the inline reply view (D-01/D-02) — the right pane reads `stepReplies[selectedStepId]` from `usePlanExecutionStore`.

### Claude's Discretion

- Specific tab component choice for the `[Step Editor | Reply Feed]` tab strip — shadcn `Tabs` with `TabsList` / `TabsTrigger` / `TabsContent` is the natural fit given the existing shadcn/ui foundation.
- Whether the tab strip renders inside `StepFieldEditor.tsx` or is lifted to `PlanDetailPanel.tsx` — follow whichever keeps `StepFieldEditor` focused (lifting to `PlanDetailPanel` is likely cleaner).
- Empty state for the `Reply Feed` tab when no replies have arrived yet: "No replies received yet — run a plan with correlation-id or first-arrival steps to see responses here."
- Step list visual indicator: when a step has a reply stored (`stepReplies[step.id]` is non-null), show a small dot or indicator on the step row to signal there's a reply to view. Exact visual is discretionary.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §Response Handling (RESP-04, RESP-05) — the 2 requirements in scope for Phase 23
- `.planning/ROADMAP.md` §Phase 23 — Goal, success criteria, FIFO cap note

### Foundation phases (MUST read — Phase 23 builds directly on these)
- `.planning/phases/22-plan-runner-sequential-execution/22-CONTEXT.md` — `usePlanExecutionStore` shape, `usePlanRunner` hook, `StepResult`/`ReplyMessage` types, ephemeral-store rationale. Phase 23 adds `stepReplies` and `planReplyFeed` to the store.
- `.planning/phases/21-step-editor-authoring/21-CONTEXT.md` — `PlanDetailPanel` two-pane layout, `StepListPanel`, `StepFieldEditor` composition. Phase 23 adds the tab strip to the right pane and the reply indicator to step rows.

### Key source files to read before planning
- `src/stores/usePlanExecutionStore.ts` — current store shape; Phase 23 adds `stepReplies: Record<string, ReplyMessage>`, `planReplyFeed: FeedMessage[]`, and new actions `setStepReply` / `appendReplyFeedEntry`.
- `src/hooks/usePlanRunner.ts` — current runner loop; Phase 23 adds `appendReplyFeedEntry` and `setStepReply` calls after each step that returns a non-null reply.
- `src/lib/ipc.ts` — `StepResultIpc`, `ReplyMessageIpc`, `executeStep` IPC wrapper. `ReplyMessage` (in `src/lib/types.ts`) is the reply shape stored per-step.
- `src/lib/types.ts` — `FeedMessage`, `ReplyMessage`, `StepResult` type definitions.
- `src/components/plans/PlanDetailPanel.tsx` — Phase 21/22 two-pane layout; Phase 23 wraps the right pane content in a tab strip.
- `src/components/plans/StepListPanel.tsx` — Phase 22 step rows with status badges; Phase 23 adds a reply indicator dot when `stepReplies[step.id]` is non-null.
- `src/components/plans/StepFieldEditor.tsx` — Phase 21 form editor; Phase 23 adds reply view rendering (replaces form when step has a reply + is selected).

### Existing response components (reused as-is)
- `src/components/response/ResponseDecodedView.tsx` — collapsible key-value JSON tree. Used by RESP-04 inline reply view.
- `src/components/response/ResponseHexSection.tsx` — hex viewer. Used alongside `ResponseDecodedView` in the inline reply view.
- `src/components/response/MessageFeedRow.tsx` — accordion row for the shared feed tab. Reused verbatim with `FeedMessage` entries.
- `src/components/response/MessageFeedTab.tsx` — structural reference for the Reply Feed tab layout (scrollable accordion list pattern, D-17/D-21 from Phase 13). Do NOT import or reuse this component directly — it is tightly coupled to `useResponseStore`. Instead, copy the accordion rendering pattern into the new Reply Feed tab component.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResponseDecodedView` (`src/components/response/ResponseDecodedView.tsx`) — collapsible `JsonTreeNode` tree. Accepts `{ decoded: Record<string, unknown> | null, error: string | null }`. Used directly for the inline step reply view.
- `ResponseHexSection` (`src/components/response/ResponseHexSection.tsx`) — hex viewer with copy. Accepts `{ hexString: string, decoded: Record<string, unknown> | null }`. Paired with `ResponseDecodedView` in the inline reply pane.
- `MessageFeedRow` (`src/components/response/MessageFeedRow.tsx`) — accordion row for `FeedMessage` entries. Reused directly in the Reply Feed tab. Requires a `<Accordion>` parent (shadcn).
- `usePlanExecutionStore` — add `stepReplies` (Record keyed by step ID) and `planReplyFeed` (FeedMessage array, FIFO-500). New actions: `setStepReply(stepId, reply)` and `appendReplyFeedEntry(entry)`.
- `usePlanRunner` hook — add two new store calls after `result.status === "done"` with a non-null reply: `setStepReply(step.id, result.reply)` and `appendReplyFeedEntry(buildFeedMessage(result.reply))`.
- shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — for the `[Step Editor | Reply Feed]` tab strip in the right pane. Already installed via shadcn/ui nova.

### Established Patterns
- **Ephemeral execution state** — `stepReplies` and `planReplyFeed` are NOT persisted. They live in `usePlanExecutionStore` (no persist middleware). Cleared by `clearRun()` at the start of the next run.
- **FIFO-500 in-place trim** — `planReplyFeed` uses the same FIFO-500 pattern as `useResponseStore.messages`. Trim to 500 inside `appendReplyFeedEntry` before updating state.
- **Immutable state updates** — all Zustand actions produce new objects; no in-place mutation (coding-style.md CRITICAL rule).
- **`crypto.randomUUID()` for FeedMessage.id** — never derive from server data (Pitfall 2 from Phase 13 research).
- **`exchange: ""` for plan reply feed entries** — `ReplyMessage` has no `exchange` field. Use empty string to satisfy `FeedMessage` shape; `MessageFeedRow` renders `""` gracefully (the collapsed row string shows `"" •` which is acceptable for a dev tool).
- **Click-to-select in StepListPanel** — Phase 21 D-04: clicking a step sets `selectedStepId`. Phase 23 second-click toggle: if `selectedStepId === step.id` AND `paneMode === "reply"`, switch paneMode to `"editor"`. Otherwise, select the step and switch to `"reply"` if the step has a reply in `stepReplies`.

### Integration Points
- `src/components/plans/PlanDetailPanel.tsx` — Wrap the right pane content in a `Tabs` component when `hasRunStarted` (derived from `usePlanExecutionStore.runningPlanId !== null || stepStatuses` being non-empty). `TabsContent` for `Step Editor` = current `StepFieldEditor`; `TabsContent` for `Reply Feed` = new `PlanReplyFeedTab` component.
- New: `src/components/plans/PlanReplyFeedTab.tsx` — thin wrapper reading `usePlanExecutionStore.planReplyFeed` and rendering a shadcn `Accordion` + `MessageFeedRow` list. Handles empty state.
- `src/components/plans/StepFieldEditor.tsx` — receives a `replyMode: boolean` prop (or reads from the parent's tab/pane state) to decide: when `replyMode=true` and `selectedStepId` has a reply, render the reply view instead of the form.
- `src/stores/usePlanExecutionStore.ts` — new fields and actions (D-09, D-13).
- `src/hooks/usePlanRunner.ts` — new store calls after `result.reply` is non-null (D-12, D-13).

</code_context>

<specifics>
## Specific Ideas

- Step list reply indicator: a small colored dot (e.g., `bg-primary rounded-full w-1.5 h-1.5`) on the right side of a step row when `stepReplies[step.id]` is non-null. Subtle, doesn't compete with the `StepStatusBadge`. Exact visual is at Claude's discretion.
- Inline reply pane header: render the step name as a compact breadcrumb or label ("Reply from: [step name]") so the user knows which step's reply they're viewing. No back button — second click on the step row in StepListPanel returns to editor mode.
- Reply Feed tab label: `Reply Feed` (noun phrase, consistent with existing tab naming in the app). Badge showing message count if > 0: `Reply Feed (3)`.
- `FeedMessage.exchange` mapped from `ReplyMessage`: use `""` (empty string). `MessageFeedRow` renders the trigger text as `[routingKey] • [exchange] • [contentType] • [timestamp] • [decodedAs]` — `""` in the exchange position produces a `• •` double-dot artifact. Consider filtering empty segments in `MessageFeedRow` or in `buildFeedMessage`. Claude's discretion on which is cleaner.

</specifics>

<deferred>
## Deferred Ideas

- **Step-level reply indicator in `PlanRunBar` summary** — e.g., "✓ 3/4 succeeded, 2 replies received". Could be a nice touch but adds complexity to `PlanRunBar`; post-v1.6.
- **Persist reply feed across session** — currently ephemeral (cleared on next run). Long-running dev sessions might benefit from persisted feed. Defer to v2 if needed.
- **Export reply feed** — JSON export of the plan reply feed analogous to `MessageFeedTab`'s export button. Out of scope for Phase 23; note for backlog.
- **Filter/search in Reply Feed tab** — routing key filter, etc. Drain/subscribe feed has this (Phase 15); plan reply feed defers it.

</deferred>

---

*Phase: 23-Response View — Inline and Shared Feed*
*Context gathered: 2026-05-24*
