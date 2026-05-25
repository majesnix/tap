# Phase 23: Response View — Inline and Shared Feed - Research

**Researched:** 2026-05-24
**Domain:** Tauri 2.x / React frontend — ephemeral Zustand state, Radix UI Tabs, response display components
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inline Reply Display (RESP-04)**

- **D-01:** Decoded step reply appears in the `StepFieldEditor` right pane, NOT in the step list. The step list remains compact (~240px) with only status badges.
- **D-02:** When a step has a reply, the right pane shows the **reply view only** — it replaces the form (not appended below). The disabled form fields are NOT shown alongside the reply. Clean focus on the result.
- **D-03:** Toggle back: a second click on the same step row in `StepListPanel` switches the pane back to editor mode (same row click that originally selected the step). No additional button in the reply view header.
- **D-04:** During a live run, the right pane auto-switches to a step's reply view as soon as `executeStep` resolves with a reply. Consistent with Phase 22's auto-scroll to active step. When the next step starts executing, the pane switches back to that step's form in read-only mode.

**Shared Reply Feed (RESP-05)**

- **D-05:** A tab strip with two tabs (`Step Editor` | `Reply Feed`) appears in the `StepFieldEditor` pane header **once a plan has been run** (after `setRunning()` is called for the first time in the session). Persists for the session lifetime of that plan — consistent with how `stepStatuses` and `summary` are retained post-run.
- **D-06:** The `Reply Feed` tab shows accumulated reply messages in a **scrollable accordion list using the existing `MessageFeedRow` component**. Each entry: routing key, content-type, timestamp in the collapsed row; `ResponseDecodedView` + `ResponseHexSection` on expand. Zero new display component needed.
- **D-07:** The `Reply Feed` tab does NOT auto-activate when a run starts. User switches to it manually. No surprise layout jumps during a live run.
- **D-08:** When the pane is in "reply view" mode (showing a step's inline reply), the tab strip still renders with `Step Editor` active. The `Reply Feed` tab is always accessible regardless of which step is selected.

**Feed Storage**

- **D-09:** `planReplyFeed: FeedMessage[]` is added to `usePlanExecutionStore`. A new `appendReplyFeedEntry(entry: FeedMessage)` action appends an entry (FIFO-500). `clearRun()` resets `planReplyFeed` to `[]`. No separate store.
- **D-10:** Feed scope: reply messages only — only steps in `correlation-id` or `first-arrival` response mode that received a reply. No-wait steps excluded. No synthetic entries.
- **D-11:** FIFO cap: **500 entries** — same as the drain/subscribe `MessageFeedTab` (D-16 from Phase 13).

**usePlanRunner Updates**

- **D-12:** `usePlanRunner` calls `appendReplyFeedEntry()` after each step that resolves with a non-null `result.reply`. Entry shape: `id` = `crypto.randomUUID()`, `routingKey` = `result.reply.routingKey`, `exchange` = `""`, `contentType` = `result.reply.contentType`, `timestamp` = `Date.now() / 1000`, `decoded` = `result.reply.decoded`, `hexString` = `result.reply.hexString`, `error` = null, `decodedAs` = `result.reply.decodedAs`.
- **D-13:** `usePlanRunner` also calls a new `setStepReply(stepId, reply)` action to store the raw `ReplyMessage` keyed by step ID. This is the source of truth for the inline reply view — the right pane reads `stepReplies[selectedStepId]` from `usePlanExecutionStore`.

### Claude's Discretion

- Specific tab component choice — shadcn `Tabs` with `TabsList` / `TabsTrigger` / `TabsContent` is the natural fit.
- Whether the tab strip renders inside `StepFieldEditor.tsx` or is lifted to `PlanDetailPanel.tsx` — lifting to `PlanDetailPanel` is likely cleaner.
- Empty state for the `Reply Feed` tab when no replies have arrived yet: "No replies received yet — run a plan with correlation-id or first-arrival steps to see responses here."
- Step list visual indicator: small dot (`bg-primary rounded-full w-1.5 h-1.5`) on the step row when `stepReplies[step.id]` is non-null. Exact visual is discretionary.

### Deferred Ideas (OUT OF SCOPE)

- Step-level reply indicator in `PlanRunBar` summary (e.g., "2 replies received")
- Persist reply feed across session
- Export reply feed to JSON
- Filter/search in Reply Feed tab
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESP-04 | Steps that received a reply show the decoded protobuf response inline in the `StepFieldEditor` right pane, replacing the form, not appended alongside it. | Store field `stepReplies[stepId]` + `paneMode` state in `usePlanExecutionStore`; new `StepReplyView` component using existing `ResponseDecodedView` + `ResponseHexSection`; second-click toggle in `StepListPanel`. |
| RESP-05 | A `[Step Editor | Reply Feed]` tab strip in the right pane header shows accumulated reply messages in chronological order using the existing `MessageFeedRow` component. | `planReplyFeed: FeedMessage[]` in `usePlanExecutionStore` (FIFO-500); new `PlanReplyFeedTab` component; shadcn `Tabs` already installed; `appendReplyFeedEntry` action in `usePlanRunner` after each non-null reply. |
</phase_requirements>

## Summary

Phase 23 wires up the display layer on top of Phase 22's execution engine. No new Rust commands are required — all data comes from `StepResult.reply` already returned by `execute_step`. The work is entirely in TypeScript: extend `usePlanExecutionStore` with two new fields, add two store calls to `usePlanRunner`, build one new component (`StepReplyView`), one new component (`PlanReplyFeedTab`), and update three existing components (`PlanDetailPanel`, `StepListPanel`, and `StepFieldEditor`).

All dependencies are already installed. The shadcn `Tabs` component is present at `src/components/ui/tabs.tsx`. The response display primitives (`ResponseDecodedView`, `ResponseHexSection`, `MessageFeedRow`) need no modification. The primary implementation risk is Radix UI's tab content unmounting behavior — the `Step Editor` `TabsContent` must use `forceMount` to preserve `react-hook-form` state during tab switches.

The two requirements interact through a shared `paneMode: 'editor' | 'reply'` field that must live in `usePlanExecutionStore` (not local component state), because `usePlanRunner` — a hook, not a component — needs to write it for D-04's auto-switch behavior.

**Primary recommendation:** Add `stepReplies`, `planReplyFeed`, and `paneMode` to `usePlanExecutionStore`; wire `usePlanRunner`; lift the tab strip to `PlanDetailPanel`; use `forceMount` on the Step Editor `TabsContent`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Store reply per step | Frontend (Zustand store) | — | Ephemeral execution state; cleared on next run; same tier as `stepStatuses` |
| Accumulate reply feed (FIFO-500) | Frontend (Zustand store) | — | Same pattern as drain/subscribe feed in `useResponseStore` |
| Pane mode (editor vs reply) | Frontend (Zustand store) | — | Must be reachable by `usePlanRunner` hook — cannot be local component state |
| Auto-switch pane on step reply | Frontend (usePlanRunner hook) | — | Already owns the runner loop; adds `setPaneMode('reply')` call after D-04 trigger |
| Second-click toggle to editor | Frontend (StepListPanel) | — | Row click handler; reads `paneMode` from store |
| Inline reply rendering | Frontend (StepReplyView component) | — | Composes `ResponseDecodedView` + `ResponseHexSection` with a step-name header |
| Shared feed tab rendering | Frontend (PlanReplyFeedTab component) | — | Reads `planReplyFeed` from store; renders `Accordion` + `MessageFeedRow` list |
| Tab strip visibility control | Frontend (PlanDetailPanel) | — | Owns the two-pane layout; knows when `hasRunStarted` |
| Reply indicator dot on step row | Frontend (StepListPanel) | — | Reads `stepReplies[step.id]` from store; renders dot when non-null |

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | 5.x | Ephemeral run state (`usePlanExecutionStore`) | Already used for `stepStatuses`, `activeStepId`, `summary` |
| `@radix-ui/react-tabs` | (via shadcn) | Tab strip primitive | shadcn `Tabs` component wraps this; `forceMount` prop is key |
| `react-hook-form` | 7.x | Form state in `StepFieldEditor` (unchanged) | Already used; `forceMount` protects its state during tab switches |
| `@tauri-apps/api` | 2.x | IPC `invoke` (unchanged) | Already used; no new commands |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/plans/StepReplyView.tsx` | Inline reply display: step name header + `ResponseDecodedView` + `ResponseHexSection` |
| `src/components/plans/PlanReplyFeedTab.tsx` | Reply Feed tab content: `ScrollArea` + `Accordion` + `MessageFeedRow` list, empty state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lift `paneMode` to `usePlanExecutionStore` | Local state in `PlanDetailPanel` | Local state cannot be written by `usePlanRunner` hook (D-04 requires auto-switch) |
| New `PlanReplyFeedTab` component | Reuse `MessageFeedTab` directly | `MessageFeedTab` is coupled to `useResponseStore`; importing it would create a cross-store dependency |
| `forceMount` + CSS `hidden` | `keepMounted` pattern or React portals | `forceMount` is the idiomatic Radix solution; simpler than portals |

**Installation:** No new packages. All dependencies already present.

## Package Legitimacy Audit

No new packages are installed in this phase. All libraries used (`zustand`, `radix-ui`, `react-hook-form`, `@tauri-apps/api`) were audited in prior phases.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[usePlanRunner hook]
    |
    | result.reply != null
    v
[usePlanExecutionStore]
    stepReplies: { [stepId]: ReplyMessage }
    planReplyFeed: FeedMessage[]          (FIFO-500)
    paneMode: 'editor' | 'reply'
    |
    +------ read by --------> [PlanDetailPanel]
    |                              |
    |                       hasRunStarted?
    |                        yes: render Tabs
    |                             |
    |              +——————————————+——————————————+
    |              |                             |
    |       [Step Editor tab]           [Reply Feed tab]
    |       TabsContent forceMount      TabsContent
    |              |                             |
    |       paneMode='editor'?          [PlanReplyFeedTab]
    |         [StepFieldEditor]              reads planReplyFeed
    |       paneMode='reply'?               [Accordion]
    |         [StepReplyView]                 [MessageFeedRow x N]
    |              |                          empty state if []
    |              |
    +------ read by --------> [StepListPanel]
                               row click:
                               - select step
                               - if stepReplies[id]: setPaneMode('reply')
                               - second click + paneMode='reply': setPaneMode('editor')
                               reply dot: stepReplies[id] != null
```

### Recommended Project Structure

```
src/
├── stores/
│   └── usePlanExecutionStore.ts    # add stepReplies, planReplyFeed, paneMode + actions
├── hooks/
│   └── usePlanRunner.ts            # add setStepReply + appendReplyFeedEntry calls
├── components/
│   └── plans/
│       ├── PlanDetailPanel.tsx     # add Tabs wrapper (when hasRunStarted)
│       ├── StepListPanel.tsx       # add toggle logic + reply dot
│       ├── StepFieldEditor.tsx     # accept replyMode prop (or read from parent tab)
│       ├── StepReplyView.tsx       # NEW: inline reply display
│       └── PlanReplyFeedTab.tsx    # NEW: Reply Feed tab content
```

### Pattern 1: Extend usePlanExecutionStore

**What:** Add `stepReplies`, `planReplyFeed`, and `paneMode` fields with their actions.
**When to use:** This is the only store for ephemeral execution state.

```typescript
// Source: src/stores/usePlanExecutionStore.ts (verified in codebase)
// Extend the state interface:
interface PlanExecutionState {
  // ... existing fields ...
  stepReplies: Record<string, ReplyMessage>
  planReplyFeed: FeedMessage[]
  paneMode: 'editor' | 'reply'
}

// New actions:
setStepReply: (stepId: string, reply: ReplyMessage) => void
appendReplyFeedEntry: (entry: FeedMessage) => void
setPaneMode: (mode: 'editor' | 'reply') => void

// Implementation (immutable, FIFO-500):
appendReplyFeedEntry: (entry) =>
  set((s) => ({
    planReplyFeed: [entry, ...s.planReplyFeed].slice(0, 500),
  })),

setStepReply: (stepId, reply) =>
  set((s) => ({
    stepReplies: { ...s.stepReplies, [stepId]: reply },
  })),

// Reset in setRunning (follow existing pattern — NOT via clearRun):
setRunning: (planId) =>
  set({
    runningPlanId: planId,
    isRunning: true,
    isCancelling: false,
    summary: null,
    stepStatuses: {},
    activeStepId: null,
    stepReplies: {},        // Phase 23
    planReplyFeed: [],      // Phase 23
    paneMode: 'editor',     // Phase 23
  }),

// Also reset in clearRun:
clearRun: () =>
  set({
    runningPlanId: null,
    isRunning: false,
    stepStatuses: {},
    activeStepId: null,
    isCancelling: false,
    summary: null,
    stepReplies: {},        // Phase 23
    planReplyFeed: [],      // Phase 23
    paneMode: 'editor',     // Phase 23
  }),
```

### Pattern 2: usePlanRunner — Dispatch After Reply

**What:** After each step resolves with a non-null reply, dispatch two store actions.
**When to use:** Inside the runner loop, after `result.status === "done"`.

```typescript
// Source: src/hooks/usePlanRunner.ts (verified in codebase, lines 54-98)
// Add after existing status dispatch:
if (result.status === 'done' && result.reply !== null) {
  setStepReply(step.id, result.reply)
  setPaneMode('reply')           // D-04 auto-switch
  appendReplyFeedEntry({
    id: crypto.randomUUID(),
    routingKey: result.reply.routingKey,
    exchange: '',                // ReplyMessage has no exchange field
    contentType: result.reply.contentType,
    timestamp: Date.now() / 1000,
    decoded: result.reply.decoded,
    hexString: result.reply.hexString,
    error: null,
    decodedAs: result.reply.decodedAs,
  })
}
// When next step starts (before executeStep call):
setPaneMode('editor')           // D-04: switch back to form for next step
```

### Pattern 3: Radix Tabs with forceMount

**What:** Wrap the right pane in shadcn `Tabs`; use `forceMount` on the Step Editor tab to prevent `react-hook-form` unmounting.
**When to use:** In `PlanDetailPanel`, conditional on `hasRunStarted`.

```typescript
// Source: src/components/ui/tabs.tsx (verified in codebase)
// shadcn Tabs wraps @radix-ui/react-tabs; TabsContent inherits forceMount prop.

{hasRunStarted && (
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList>
      <TabsTrigger value="editor">Step Editor</TabsTrigger>
      <TabsTrigger value="reply-feed">
        Reply Feed{planReplyFeed.length > 0 ? ` (${planReplyFeed.length})` : ''}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="editor" forceMount className={activeTab !== 'editor' ? 'hidden' : undefined}>
      {/* StepFieldEditor or StepReplyView based on paneMode */}
      {paneMode === 'reply' && selectedStepReply
        ? <StepReplyView reply={selectedStepReply} stepName={selectedStepName} />
        : <StepFieldEditor ... />}
    </TabsContent>
    <TabsContent value="reply-feed">
      <PlanReplyFeedTab />
    </TabsContent>
  </Tabs>
)}
{!hasRunStarted && (
  <StepFieldEditor ... />
)}
```

**Critical:** The `forceMount` + `hidden` pattern prevents Radix from unmounting `StepFieldEditor` when the user switches to the "Reply Feed" tab. Without this, `react-hook-form` state, debounce timers, and scroll position are lost.

### Pattern 4: StepListPanel Toggle Logic

**What:** Row click handler with second-click toggle behavior.

```typescript
// Source: src/components/plans/StepListPanel.tsx (verified in codebase)
function handleStepClick(stepId: string) {
  if (selectedStepId === stepId && paneMode === 'reply') {
    // Second click on same step while in reply view → back to editor
    setPaneMode('editor')
    return
  }
  onSelectStep(stepId)
  if (stepReplies[stepId]) {
    setPaneMode('reply')
  } else {
    setPaneMode('editor')
  }
}
```

### Pattern 5: PlanReplyFeedTab

**What:** New component that reads `planReplyFeed` and renders the accordion list.
**Note:** Do NOT import `MessageFeedTab` — copy the accordion pattern instead.

```typescript
// Source: src/components/response/MessageFeedTab.tsx (structural reference, verified)
// Copy the Accordion + MessageFeedRow pattern:
export function PlanReplyFeedTab() {
  const planReplyFeed = usePlanExecutionStore((s) => s.planReplyFeed)

  if (planReplyFeed.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No replies received yet — run a plan with correlation-id or first-arrival
        steps to see responses here.
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <Accordion type="single" collapsible>
        {planReplyFeed.map((msg) => (
          <MessageFeedRow key={msg.id} message={msg} />
        ))}
      </Accordion>
    </ScrollArea>
  )
}
```

### Pattern 6: StepReplyView

**What:** New component for inline reply display inside the Step Editor tab when `paneMode === 'reply'`.

```typescript
// Composes existing response components (verified in codebase)
interface StepReplyViewProps {
  reply: ReplyMessage
  stepName: string
}

export function StepReplyView({ reply, stepName }: StepReplyViewProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-sm text-muted-foreground">Reply from: {stepName}</div>
      <ResponseDecodedView
        decoded={reply.decoded}
        error={null}           // decode failure handled via fallback below
      />
      {reply.decoded === null && reply.hexString === '' && (
        <div className="text-sm text-muted-foreground">
          No decoded content available.
        </div>
      )}
      <ResponseHexSection hexString={reply.hexString} decoded={reply.decoded} />
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Putting `paneMode` in local component state:** `usePlanRunner` (a hook, not a component) must write `paneMode` for D-04. Local state in `PlanDetailPanel` is unreachable from the hook.
- **Calling `clearRun()` from `setRunning`:** The existing `setRunning` action resets fields inline (not via `clearRun`). Follow this pattern — do not call `clearRun` from within `setRunning`.
- **Missing `forceMount` on `TabsContent`:** Omitting it causes Radix to unmount `StepFieldEditor` when user switches to Reply Feed tab, losing react-hook-form dirty state and debounce timers.
- **Importing `MessageFeedTab` directly:** It is coupled to `useResponseStore`. Build `PlanReplyFeedTab` as a standalone component reading from `usePlanExecutionStore`.
- **Deriving `FeedMessage.id` from server data:** Always use `crypto.randomUUID()`. Phase 13 CONTEXT documents this as Pitfall 2.
- **Not resetting Phase 23 fields in both `setRunning` and `clearRun`:** The existing pattern resets `summary` and `isCancelling` in `setRunning` directly. Phase 23 fields must follow the same pattern in both actions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab strip UI | Custom div-based tabs | shadcn `Tabs` / Radix UI | Already installed; keyboard nav, ARIA, `forceMount` prop |
| Accordion feed rows | Custom collapsible rows | `MessageFeedRow` + shadcn `Accordion` | Already used in drain/subscribe feed; identical requirements |
| FIFO cap logic | Custom ring buffer | Inline `.slice(0, 500)` after prepend | One-liner; same pattern used in `useResponseStore` |
| Scroll container | Custom overflow div | shadcn `ScrollArea` | Already used throughout the app for consistent cross-platform scrollbars |
| Hex display | Custom hex formatter | `ResponseHexSection` | Already built in Phase 21; copy-with-hex-string support |
| Decoded tree display | Custom JSON tree | `ResponseDecodedView` | Already built in Phase 21; handles null/error states |

**Key insight:** Every display primitive needed by Phase 23 already exists. The planner's job is wiring, not building.

## Common Pitfalls

### Pitfall 1: Radix TabsContent Unmounts on Tab Switch
**What goes wrong:** When user switches from "Step Editor" to "Reply Feed" tab, Radix unmounts the `Step Editor` `TabsContent` by default. `react-hook-form`'s `useForm` hook unmounts, losing dirty field values, auto-save debounce timers, and scroll position.
**Why it happens:** Radix UI mounts/unmounts tab content for performance. Without `forceMount`, the editor component lifecycle resets on every tab switch.
**How to avoid:** Add `forceMount` prop to the Step Editor `TabsContent`. Hide the inactive tab visually with a `className={activeTab !== 'editor' ? 'hidden' : undefined}` conditional. Radix keeps the component mounted; CSS hides it.
**Warning signs:** Form reverts to saved state after switching tabs and back. Auto-save does not fire for changes made before a tab switch.

### Pitfall 2: paneMode Cannot Be Local State
**What goes wrong:** If `paneMode` is stored as `useState` in `PlanDetailPanel`, the D-04 auto-switch (right pane flips to reply view as soon as `executeStep` resolves) cannot work. `usePlanRunner` is a hook, not a child component — it cannot call a setter from `PlanDetailPanel`.
**Why it happens:** React state is scoped to the component that holds it. A hook running in a parent or sibling context cannot reach into a child component's state.
**How to avoid:** Add `paneMode: 'editor' | 'reply'` and `setPaneMode` to `usePlanExecutionStore`. Both `usePlanRunner` and `StepListPanel` and `PlanDetailPanel` then read/write through the store.
**Warning signs:** D-04 auto-switch silently does nothing. Step row second-click toggle has no effect.

### Pitfall 3: setRunning Does Not Reset New Fields
**What goes wrong:** Starting a second run on the same plan shows stale replies from the previous run. `stepReplies` and `planReplyFeed` from run N carry over into run N+1.
**Why it happens:** The existing `setRunning` action resets `summary`, `stepStatuses`, `isCancelling` inline. If Phase 23 fields are only reset in `clearRun`, they persist across runs because `setRunning` is called at the start of a run, not `clearRun`.
**How to avoid:** Add `stepReplies: {}`, `planReplyFeed: []`, and `paneMode: 'editor'` to the inline reset block inside `setRunning` (same place as `summary: null`). Also reset them in `clearRun`.
**Warning signs:** Second run shows correct step statuses but stale reply views from the first run.

### Pitfall 4: Tab Visibility Predicate
**What goes wrong:** D-05 says tabs appear after "first `setRunning()` call for the session." If the predicate is `runningPlanId !== null`, the tabs disappear after `clearRun()` (which sets `runningPlanId = null`). If the predicate is `isRunning === true`, the tabs disappear as soon as the run completes.
**Why it happens:** Neither `runningPlanId` nor `isRunning` survives the post-run state the way `stepStatuses` and `summary` do.
**How to avoid:** Use `Object.keys(stepStatuses).length > 0 || planReplyFeed.length > 0` as `hasRunStarted`. Both `stepStatuses` and `planReplyFeed` persist after a run completes (they are only cleared on the NEXT `setRunning` call). This matches "consistent with how `stepStatuses` and `summary` are retained post-run" (D-05).
**Warning signs:** Tab strip disappears immediately when run completes, or never appears at all.

### Pitfall 5: double-dot Artifact in MessageFeedRow
**What goes wrong:** `MessageFeedRow` renders the trigger text as segments joined by ` • `. When `exchange: ""` is passed for plan reply feed entries, the join produces `routingKey • • contentType • ...` — a visible double-dot artifact.
**Why it happens:** `ReplyMessage` has no `exchange` field. D-12 maps it to `""` to satisfy `FeedMessage`'s shape. `MessageFeedRow` does not filter empty/null segments before joining.
**How to avoid:** In `PlanReplyFeedTab` (or in `buildFeedMessage`), filter the segments before joining. Alternatively, pass `null` for `exchange` if `FeedMessage` allows it — but the type says `exchange: string` (not nullable), so filtering in the join is cleaner. The filtering should happen inside `MessageFeedRow` for correctness across all callers, but since we cannot modify `MessageFeedRow` (it is used by the drain/subscribe feed), filter in the `buildFeedMessage` helper or accept the artifact as per the CONTEXT's note: "acceptable for a dev tool."
**Warning signs:** Reply Feed accordion rows show `routingKey • • contentType` with a blank segment.

### Pitfall 6: ResponseDecodedView Returns null When decoded === null AND error === null
**What goes wrong:** In `StepReplyView`, if a step reply has `decoded: null` and no decode error (e.g., binary-only message), `ResponseDecodedView` renders nothing. The user sees a blank right pane with only the hex section.
**Why it happens:** `ResponseDecodedView` has an early return: `if (!decoded && !error) return null`. A successful protobuf decode that produces an empty message object is technically valid but may produce `decoded: null`.
**How to avoid:** In `StepReplyView`, add a fallback message below `ResponseDecodedView`: if `reply.decoded === null && !reply.error`, render `<div>No decoded content available.</div>` so the user knows the pane is not broken. The hex section still shows if `hexString` is non-empty.
**Warning signs:** User clicks a step with a reply, pane shows only hex with no explanation of why the decoded tree is absent.

## Code Examples

Verified patterns from official sources and codebase inspection:

### hasRunStarted Predicate
```typescript
// Source: usePlanExecutionStore.ts (verified), D-05 semantics
const stepStatuses = usePlanExecutionStore((s) => s.stepStatuses)
const planReplyFeed = usePlanExecutionStore((s) => s.planReplyFeed)
const hasRunStarted = Object.keys(stepStatuses).length > 0 || planReplyFeed.length > 0
```

### Conditional Tab Strip in PlanDetailPanel
```typescript
// Source: src/components/plans/PlanDetailPanel.tsx (verified) + shadcn Tabs pattern
const [activeTab, setActiveTab] = useState<'editor' | 'reply-feed'>('editor')
const paneMode = usePlanExecutionStore((s) => s.paneMode)
const planReplyFeed = usePlanExecutionStore((s) => s.planReplyFeed)

// Right pane:
{hasRunStarted ? (
  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
    <TabsList>
      <TabsTrigger value="editor">Step Editor</TabsTrigger>
      <TabsTrigger value="reply-feed">
        Reply Feed{planReplyFeed.length > 0 ? ` (${planReplyFeed.length})` : ''}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="editor" forceMount className={activeTab !== 'editor' ? 'hidden' : undefined}>
      {paneMode === 'reply' && selectedStepReply
        ? <StepReplyView reply={selectedStepReply} stepName={selectedStepName} />
        : <StepFieldEditor ... />}
    </TabsContent>
    <TabsContent value="reply-feed">
      <PlanReplyFeedTab />
    </TabsContent>
  </Tabs>
) : (
  <StepFieldEditor ... />
)}
```

### FIFO-500 Append (immutable)
```typescript
// Source: useResponseStore pattern (verified in codebase), adapted for usePlanExecutionStore
appendReplyFeedEntry: (entry: FeedMessage) =>
  set((s) => ({
    planReplyFeed: [entry, ...s.planReplyFeed].slice(0, 500),
  })),
```

### buildFeedMessage Helper
```typescript
// Source: D-12 (CONTEXT.md), types verified in src/lib/types.ts
function buildFeedMessage(reply: ReplyMessage): FeedMessage {
  return {
    id: crypto.randomUUID(),
    routingKey: reply.routingKey,
    exchange: '',
    contentType: reply.contentType,
    timestamp: Date.now() / 1000,
    decoded: reply.decoded,
    hexString: reply.hexString,
    error: null,
    decodedAs: reply.decodedAs,
  }
}
```

### Reply Dot in StepListPanel
```typescript
// Source: src/components/plans/StepListPanel.tsx (verified), D-03 specifics section
const stepReplies = usePlanExecutionStore((s) => s.stepReplies)

// Inside step row render:
{stepReplies[step.id] != null && (
  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-label="has reply" />
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate response store (`useResponseStore`) | Ephemeral execution store (`usePlanExecutionStore`) for run-scoped data | Phase 22 established the pattern | Plan reply feed belongs in `usePlanExecutionStore`, not `useResponseStore` |
| Tab content unmounts by default (Radix default) | `forceMount` + CSS `hidden` to keep editor mounted | Radix UI design; workaround well-established | Without this, react-hook-form state is lost on tab switch |

**Deprecated/outdated for this phase:**
- Using `MessageFeedTab` directly: it is coupled to `useResponseStore`; copy the pattern instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TabsContent` in the installed `src/components/ui/tabs.tsx` (shadcn nova variant) inherits Radix UI's `forceMount` prop from `TabsPrimitive.Content` | Common Pitfalls #1, Code Examples | If shadcn nova does not pass `forceMount` through, the editor will still unmount; fix is to forward the prop in `tabs.tsx` |
| A2 | `exchange: ""` (empty string) in `FeedMessage` is valid per `FeedMessage` type (not null-only) | Common Pitfalls #5, Code Examples | If `FeedMessage.exchange` is `string \| null`, passing `""` is fine; if validation rejects `""`, use `null` instead |
| A3 | The `hasRunStarted` predicate `Object.keys(stepStatuses).length > 0 \|\| planReplyFeed.length > 0` is stable across page navigations (Zustand store is not reset on route change) | Common Pitfalls #4 | If the store is reset on navigation (it should not be — no persist, but also no reset on unmount), the tab strip disappears when user navigates away and back |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
*(Table is not empty — A1 needs ctx7 verification, which was unavailable. Planner should add a verification step in Wave 0.)*

## Open Questions (RESOLVED)

1. **Does `tabs.tsx` (shadcn nova) forward `forceMount` to `TabsPrimitive.Content`?**
   - What we know: The shadcn component at `src/components/ui/tabs.tsx` wraps `@radix-ui/react-tabs`. Radix UI's `Content` primitive accepts `forceMount`. ctx7 was unavailable for direct API verification.
   - What's unclear: Whether the shadcn nova variant explicitly forwards `forceMount` in its `TabsContent` wrapper, or if it needs to be added.
   - Recommendation: Wave 0 task — read `src/components/ui/tabs.tsx` and confirm `TabsContent` spreads `...props` (which would forward `forceMount`). If not, add `forceMount?: boolean` to the prop spread.
   - RESOLVED: `tabs.tsx` line 78 spreads `...props` on `TabsPrimitive.Content` — `forceMount` passes through natively. No modification to `tabs.tsx` needed (confirmed by direct read in PATTERNS.md).

2. **Filter `exchange: ""` in MessageFeedRow vs. in buildFeedMessage?**
   - What we know: `MessageFeedRow` joins segments with ` • `. Empty `exchange` produces double-dot artifact. CONTEXT says this is "acceptable for a dev tool" but suggests filtering.
   - What's unclear: Whether modifying `MessageFeedRow` to filter empty/null segments would affect the drain/subscribe feed (which presumably always has a non-empty `exchange`).
   - Recommendation: Filter in `buildFeedMessage` helper to avoid touching `MessageFeedRow` (safe isolation). Add a Wave 0 task to inspect `MessageFeedRow`'s join logic and confirm no regression for drain/subscribe feed.
   - RESOLVED: Accept the double-dot artifact per CONTEXT.md — `exchange: ""` is acceptable for a dev tool. No filtering in `MessageFeedRow` or `buildFeedMessage` (confirmed per PATTERNS.md decision).

## Environment Availability

This phase is code/config-only changes — no external runtime dependencies beyond the existing Tauri 2.x + Node 20 development environment already in use.

## Security Domain

This phase renders pre-validated server data that has already passed through the Rust backend's protobuf decode pipeline (Phase 22). No new user input surfaces are introduced. The `crypto.randomUUID()` call for `FeedMessage.id` uses the browser's native CSPRNG — no cryptographic library needed.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | Data originates from Tauri IPC (already type-checked by `StepResultIpc`) |
| V6 Cryptography | no | `crypto.randomUUID()` for UUID generation only — not a security-sensitive operation |

## Sources

### Primary (HIGH confidence)
- `src/stores/usePlanExecutionStore.ts` — verified current state shape, action patterns, reset logic
- `src/hooks/usePlanRunner.ts` — verified runner loop structure, lines 54-98
- `src/lib/types.ts` — verified `FeedMessage`, `ReplyMessage`, `StepResult` type definitions
- `src/components/ui/tabs.tsx` — verified shadcn Tabs is installed, wraps `@radix-ui/react-tabs`
- `src/components/response/MessageFeedRow.tsx` — verified prop shape `{ message: FeedMessage }`, accordion row pattern
- `src/components/response/ResponseDecodedView.tsx` — verified `{ decoded, error }` props, null+null early return behavior
- `src/components/response/ResponseHexSection.tsx` — verified `{ hexString, decoded }` props, null guard
- `src/components/response/MessageFeedTab.tsx` — verified tightly coupled to `useResponseStore`; confirmed structural reference only
- `src/components/plans/PlanDetailPanel.tsx` — verified two-pane layout structure
- `src/components/plans/StepListPanel.tsx` — verified row click handler, `StepStatusBadge` pattern
- `.planning/phases/23-response-view-inline-and-shared-feed/23-CONTEXT.md` — locked decisions D-01 through D-13

### Secondary (MEDIUM confidence)
- Radix UI `TabsContent` `forceMount` prop — documented in Radix UI official docs (training knowledge); NOT directly verified via ctx7 (unavailable) or codebase inspection of `tabs.tsx` internals. Tag: [ASSUMED] for the forwarding behavior.

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, verified in codebase
- Architecture: HIGH — all integration points read from source files
- Pitfalls: HIGH — six pitfalls derived from direct code inspection + advisor review
- `forceMount` forwarding: MEDIUM (ASSUMED) — Radix UI documented; shadcn forwarding not directly verified

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable — no fast-moving dependencies)
