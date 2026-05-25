# Phase 23: Response View — Inline and Shared Feed - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 7 (6 from prompt + StepReplyView.tsx added per RESEARCH.md)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/usePlanExecutionStore.ts` | store | event-driven | self (existing actions) | self-modification |
| `src/hooks/usePlanRunner.ts` | hook | event-driven | self (existing runner loop) | self-modification |
| `src/components/plans/PlanDetailPanel.tsx` | component | request-response | `src/components/layout/RightPanel.tsx` | exact (Tabs wiring + tab state + conditional content) |
| `src/components/plans/StepListPanel.tsx` | component | event-driven | self (existing step row pattern) | self-modification |
| `src/components/plans/StepFieldEditor.tsx` | component | request-response | self (existing pane pattern) | self-modification |
| `src/components/plans/StepReplyView.tsx` | component | request-response | `src/components/response/MessageFeedRow.tsx` | role-match (composes same ResponseDecodedView + ResponseHexSection) |
| `src/components/plans/PlanReplyFeedTab.tsx` | component | event-driven | `src/components/response/MessageFeedTab.tsx` | role-match (accordion feed, structural reference only) |

## Pattern Assignments

### `src/stores/usePlanExecutionStore.ts` (store, self-modification)

**Analog:** Self — extend the existing pattern in the same file.

**Existing immutable record-set pattern** (lines 81–84) — copy for `setStepReply`:
```typescript
setStepStatus: (stepId, status) =>
  set((state) => ({
    stepStatuses: { ...state.stepStatuses, [stepId]: status },
  })),
```

**Existing FIFO-500 reference** from `src/stores/useResponseStore.ts` (lines 60–78) — copy for `appendReplyFeedEntry`:
```typescript
// useResponseStore.ts lines 60-78 — canonical FIFO-500 pattern in this codebase
appendMessages: (incoming) =>
  set((state) => {
    const newMessages: FeedMessage[] = incoming.map((result) => ({
      id: crypto.randomUUID(),   // stable key for Accordion (Pitfall 2)
      // ... field mapping
    }));
    const combined = [...newMessages, ...state.messages];
    return { messages: combined.slice(0, FEED_MAX_SIZE) };
  }),
```

**Adapted for `appendReplyFeedEntry`** — prepend single entry, same FIFO-500 cap:
```typescript
appendReplyFeedEntry: (entry: FeedMessage) =>
  set((s) => ({
    planReplyFeed: [entry, ...s.planReplyFeed].slice(0, 500),
  })),
```

**Existing `INITIAL_STATE` + reset pattern** (lines 51–58, 99) — new fields must be added to both `INITIAL_STATE` and the inline reset inside `setRunning` (not via `clearRun`):
```typescript
// INITIAL_STATE (lines 51-58) — add:
stepReplies: {} as Record<string, ReplyMessage>,
planReplyFeed: [] as FeedMessage[],
paneMode: 'editor' as 'editor' | 'reply',

// setRunning inline reset (lines 70-79) — add alongside existing summary: null:
stepReplies: {},
planReplyFeed: [],
paneMode: 'editor',

// clearRun (line 99) — already calls set({ ...INITIAL_STATE }), picks up new fields automatically
```

**New imports required** — add to existing import at line 2:
```typescript
import type { StepStatus, ReplyMessage, FeedMessage } from "../lib/types";
```

---

### `src/hooks/usePlanRunner.ts` (hook, self-modification)

**Analog:** Self — insert new store calls into the existing runner loop.

**Existing destructure pattern** (lines 19–29) — add three new store actions:
```typescript
// Current destructure (lines 19-29):
const {
  setRunning,
  setStepStatus,
  setActiveStep,
  setIsCancelling,
  setSummary,
  finishRun,
  isRunning,
} = usePlanExecutionStore();

// Add to destructure:
  setStepReply,
  setPaneMode,
  appendReplyFeedEntry,
```

**Insertion point in runner loop** (after line 71, inside `if (result.status === 'done')`) — copy the `setStepStatus` call pattern at line 70 and extend:
```typescript
// Existing (lines 69-71):
if (result.status === 'done') {
  setStepStatus(step.id, 'done');
  succeeded++;
}

// Phase 23 addition — insert after setStepStatus, before succeeded++:
if (result.status === 'done') {
  setStepStatus(step.id, 'done');
  if (result.reply !== null) {
    setStepReply(step.id, result.reply)
    setPaneMode('reply')            // D-04: auto-switch to reply view
    appendReplyFeedEntry({
      id: crypto.randomUUID(),
      routingKey: result.reply.routingKey,
      exchange: '',                 // ReplyMessage has no exchange field (D-12)
      contentType: result.reply.contentType,
      timestamp: Date.now() / 1000,
      decoded: result.reply.decoded,
      hexString: result.reply.hexString,
      error: null,
      decodedAs: result.reply.decodedAs,
    })
  }
  succeeded++;
}
```

**D-04 pane reset** — before each `executeStep` call, switch pane back to editor (before line 67):
```typescript
// Before: const result = await executeStep(activeProfileName, step);
setPaneMode('editor')
const result = await executeStep(activeProfileName, step);
```

**NOTE:** `setPaneMode('editor')` runs before EVERY step, including the first. For the first step that has no prior reply view this is a harmless no-op since `paneMode` starts as `'editor'`.

---

### `src/components/plans/PlanDetailPanel.tsx` (component, Tabs wiring)

**Analog:** `src/components/layout/RightPanel.tsx` — the only existing Tabs consumer in the codebase.

**Tabs wiring pattern** (lines 2, 11, 53–79 of RightPanel.tsx):
```typescript
// Imports — copy from RightPanel.tsx line 2:
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tab state — local useState (RightPanel.tsx line 11 comment: "CRITICAL Pitfall 6"):
const [activeTab, setActiveTab] = useState<'editor' | 'reply-feed'>('editor')

// Tabs root with value + onValueChange (RightPanel.tsx lines 53-56):
<Tabs
  value={activeTab}
  onValueChange={(v) => setActiveTab(v as 'editor' | 'reply-feed')}
  className="flex flex-col h-full"
>

// TabsList flush with border-b — copy from RightPanel.tsx lines 58-61:
<TabsList className="w-full rounded-none border-b border-border justify-start px-2">
  <TabsTrigger value="editor" className="text-xs">Step Editor</TabsTrigger>
  <TabsTrigger value="reply-feed" className="text-xs">
    Reply Feed{planReplyFeed.length > 0 ? ` (${planReplyFeed.length})` : ''}
  </TabsTrigger>
</TabsList>
```

**forceMount + hidden pattern** — NOT in RightPanel.tsx (no react-hook-form there). Required for Phase 23 to protect StepFieldEditor's form state. `TabsContent` spreads `...props` (tabs.tsx line 78-82), so `forceMount` passes through to Radix UI natively:
```typescript
// Step Editor tab — forceMount keeps StepFieldEditor mounted during tab switches
<TabsContent
  value="editor"
  forceMount
  className={cn("flex-1 overflow-hidden m-0 p-0", activeTab !== 'editor' && 'hidden')}
>
  {paneMode === 'reply' && selectedStepReply
    ? <StepReplyView reply={selectedStepReply} stepName={selectedStep?.name ?? ''} />
    : <StepFieldEditor step={selectedStep} planId={planId} disabled={isRunning} />}
</TabsContent>

// Reply Feed tab — no forceMount needed (no form state to preserve)
<TabsContent value="reply-feed" className="flex-1 overflow-hidden m-0 p-0">
  <PlanReplyFeedTab />
</TabsContent>
```

**hasRunStarted predicate** — avoids Pitfall 4 (tabs disappear post-run). Uses `stepStatuses` which persist after `finishRun()`:
```typescript
const stepStatuses = usePlanExecutionStore((s) => s.stepStatuses)
const planReplyFeed = usePlanExecutionStore((s) => s.planReplyFeed)
const paneMode = usePlanExecutionStore((s) => s.paneMode)
const hasRunStarted = Object.keys(stepStatuses).length > 0 || planReplyFeed.length > 0
```

**Conditional rendering** — wrap right pane in Tabs only when `hasRunStarted`:
```typescript
// Replace current StepFieldEditor rendering (lines 103-108) with:
{hasRunStarted ? (
  <Tabs value={activeTab} onValueChange={...}>
    ...
  </Tabs>
) : (
  <StepFieldEditor step={selectedStep} planId={planId} disabled={isRunning} />
)}
```

**Additional imports for Phase 23:**
```typescript
import { useState } from "react"; // already present
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepReplyView } from "./StepReplyView";
import { PlanReplyFeedTab } from "./PlanReplyFeedTab";
import { cn } from "@/lib/utils";
// usePlanExecutionStore already imported at line 16 — add paneMode selector
```

---

### `src/components/plans/StepListPanel.tsx` (component, self-modification)

**Analog:** Self — modify the existing `SortableStepRow` and its `onSelect` handler.

**Existing `stepStatuses` read pattern** (lines 231–232) — copy for `stepReplies`:
```typescript
// Existing (lines 231-232):
const { stepStatuses, activeStepId } = usePlanExecutionStore();

// Add to destructure:
const { stepStatuses, activeStepId, stepReplies, setPaneMode } = usePlanExecutionStore();
```

**Existing `onSelect` prop plumbing** — `SortableStepRow.onSelect` currently calls `onSelectStep(step.id)`. Replace with a handler that implements toggle logic (D-03 from CONTEXT):
```typescript
// In StepListPanel, replace the onSelect lambda in steps.map():
// Current (lines 331-333):
onSelect={() => onSelectStep(step.id)}

// Replace with:
onSelect={() => {
  const { paneMode } = usePlanExecutionStore.getState()
  if (selectedStepId === step.id && paneMode === 'reply') {
    // Second click on same step in reply view → back to editor
    setPaneMode('editor')
    return
  }
  onSelectStep(step.id)
  if (stepReplies[step.id]) {
    setPaneMode('reply')
  } else {
    setPaneMode('editor')
  }
}}
```

**Reply indicator dot** — insert after `StepStatusBadge` in `SortableStepRow` render (lines 175–178). Follows the same conditional rendering pattern as `StepStatusBadge`:
```typescript
// After StepStatusBadge (currently lines 175-178):
{stepStatus !== undefined && (
  <StepStatusBadge status={stepStatus} />
)}
// Add:
{stepReplies[step.id] != null && (
  <span
    className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
    aria-label="has reply"
  />
)}
```

`SortableStepRow` needs `stepReplies` passed as a prop (add to `SortableStepRowProps` and the call site):
```typescript
interface SortableStepRowProps {
  // ... existing props ...
  stepReplies: Record<string, ReplyMessage>
}
```

---

### `src/components/plans/StepFieldEditor.tsx` (component, self-modification)

**Analog:** Self — the component's content rendering logic is unchanged; it receives a `disabled` prop already (line 473). Phase 23 does NOT modify `StepFieldEditor` directly. The reply-view decision (`paneMode === 'reply'`) is lifted to `PlanDetailPanel`, which renders either `<StepReplyView>` or `<StepFieldEditor>` in the `TabsContent` based on `paneMode`. `StepFieldEditor` itself receives no new props.

**No modifications required to this file in Phase 23.** The CONTEXT.md mentioned `StepFieldEditor` may receive a `replyMode` prop but the RESEARCH recommends lifting the decision to `PlanDetailPanel` to keep `StepFieldEditor` focused. Follow the lift approach.

---

### `src/components/plans/StepReplyView.tsx` (new component, request-response)

**Note:** This file is not in the prompt's expected list but is explicitly required by RESEARCH.md (lines 99–101, 172, 351–378) and implied by CONTEXT.md D-02 (reply view replaces the form). It must be created.

**Analog:** `src/components/response/MessageFeedRow.tsx` — same composition of `ResponseDecodedView` + `ResponseHexSection`, same read-only display purpose.

**Imports pattern** (from MessageFeedRow.tsx lines 1–8):
```typescript
import { ResponseDecodedView } from "./ResponseDecodedView";  // relative, adjust for plans/ dir
import { ResponseHexSection } from "./ResponseHexSection";
import type { ReplyMessage } from "@/lib/types";
```

**Adjust paths** — `StepReplyView` lives in `src/components/plans/`, not `src/components/response/`. Import the response components with their correct paths:
```typescript
import { ResponseDecodedView } from "@/components/response/ResponseDecodedView";
import { ResponseHexSection } from "@/components/response/ResponseHexSection";
```

**Core component pattern** — composes the two response components with a step-name header:
```typescript
interface StepReplyViewProps {
  reply: ReplyMessage
  stepName: string
}

export function StepReplyView({ reply, stepName }: StepReplyViewProps) {
  return (
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-auto">
      <div className="text-sm text-muted-foreground">Reply from: {stepName}</div>
      <ResponseDecodedView decoded={reply.decoded} error={null} />
      {reply.decoded === null && !reply.error && (
        <div className="text-sm text-muted-foreground">No decoded content available.</div>
      )}
      <ResponseHexSection hexString={reply.hexString} decoded={reply.decoded} />
    </div>
  )
}
```

**Pitfall 6 guard** — `ResponseDecodedView` returns `null` when both `decoded` and `error` are `null` (line 81 of ResponseDecodedView.tsx: `if (decoded === null) return null`). The explicit fallback `<div>No decoded content available.</div>` above prevents a blank pane.

---

### `src/components/plans/PlanReplyFeedTab.tsx` (new component, event-driven)

**Analog:** `src/components/response/MessageFeedTab.tsx` — structural reference only. Do NOT import it. Copy the accordion rendering pattern (lines 265–281 of MessageFeedTab.tsx).

**Accordion + ScrollArea pattern** from MessageFeedTab.tsx (lines 265–281):
```typescript
// MessageFeedTab.tsx lines 265-281 — canonical accordion feed pattern:
<ScrollArea className="flex-1 overflow-hidden">
  {messages.length === 0 ? (
    <p className="text-xs text-muted-foreground p-4">
      Select a queue and choose a mode
    </p>
  ) : (
    <Accordion type="single" collapsible className="w-full">
      {visibleMessages.map((msg) => (
        <MessageFeedRow key={msg.id} message={msg} />
      ))}
    </Accordion>
  )}
</ScrollArea>
```

**Adapted for PlanReplyFeedTab** — reads from `usePlanExecutionStore` (not `useResponseStore`):
```typescript
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import { Accordion } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageFeedRow } from "@/components/response/MessageFeedRow";

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
    <ScrollArea className="flex-1 overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        {planReplyFeed.map((msg) => (
          <MessageFeedRow key={msg.id} message={msg} />
        ))}
      </Accordion>
    </ScrollArea>
  )
}
```

**Double-dot artifact resolution (Pitfall 5)** — `MessageFeedRow` joins segments with ` • ` (line 30–36 of MessageFeedRow.tsx). `exchange: ""` produces a `routingKey • • contentType` artifact. Resolution: accept the artifact per CONTEXT.md's statement "acceptable for a dev tool." Do not modify `MessageFeedRow` (shared with drain/subscribe feed). The `buildFeedMessage` helper in `usePlanRunner` sets `exchange: ''` per D-12 and the double-dot is the expected rendering. No filtering needed.

---

## Shared Patterns

### Zustand Store Selector Pattern
**Source:** `src/hooks/usePlanRunner.ts` lines 19–29 and `src/components/plans/StepListPanel.tsx` lines 231–232
**Apply to:** All components and hooks reading from `usePlanExecutionStore`
```typescript
// Reactive hook usage (components):
const paneMode = usePlanExecutionStore((s) => s.paneMode)
const stepReplies = usePlanExecutionStore((s) => s.stepReplies)

// Imperative access inside callbacks (hooks/handlers):
const { paneMode } = usePlanExecutionStore.getState()
```

### Immutable Zustand Set Pattern
**Source:** `src/stores/usePlanExecutionStore.ts` lines 81–84
**Apply to:** `setStepReply`, `appendReplyFeedEntry`, `setPaneMode`
```typescript
// Record spread — setStepStatus analog for setStepReply:
set((state) => ({
  stepReplies: { ...state.stepReplies, [stepId]: reply },
}))

// Scalar — setPaneMode:
set({ paneMode: mode })
```

### Tabs Wiring (shadcn/Radix)
**Source:** `src/components/layout/RightPanel.tsx` lines 2, 11, 53–79
**Apply to:** `PlanDetailPanel.tsx` tab strip
```typescript
// Tab state is LOCAL useState — NOT in global store (RightPanel comment: "CRITICAL Pitfall 6")
const [activeTab, setActiveTab] = useState<'editor' | 'reply-feed'>('editor')

// Root props:
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>

// TabsList flush to container with border-b:
<TabsList className="w-full rounded-none border-b border-border justify-start px-2">
```

### forceMount + hidden (unique to Phase 23)
**Source:** `src/components/ui/tabs.tsx` lines 75–86 — `TabsContent` spreads `...props`, confirming `forceMount` passes through to `TabsPrimitive.Content` natively. No change to `tabs.tsx` needed.
**Apply to:** Step Editor `TabsContent` in `PlanDetailPanel`
```typescript
<TabsContent
  value="editor"
  forceMount
  className={cn("flex-1 overflow-hidden m-0 p-0", activeTab !== 'editor' && 'hidden')}
>
```

### ScrollArea + Accordion Feed
**Source:** `src/components/response/MessageFeedTab.tsx` lines 265–281
**Apply to:** `PlanReplyFeedTab.tsx`
```typescript
<ScrollArea className="flex-1 overflow-hidden">
  <Accordion type="single" collapsible className="w-full">
    {feed.map((msg) => <MessageFeedRow key={msg.id} message={msg} />)}
  </Accordion>
</ScrollArea>
```

### crypto.randomUUID() for FeedMessage.id
**Source:** `src/stores/useResponseStore.ts` line 65
**Apply to:** `buildFeedMessage` inline in `usePlanRunner`
```typescript
id: crypto.randomUUID(),   // never derive from server data (Pitfall 2)
```

---

## No Analog Found

All files have close codebase analogs. No files require falling back to RESEARCH.md patterns exclusively.

---

## Key Notes for Planner

1. **`StepReplyView.tsx` must be created.** It is not in the orchestrator's prompt file list but is required by RESEARCH.md and RESP-04. The prompt list is incomplete.

2. **`StepFieldEditor.tsx` requires no changes.** The reply-view/editor-view decision is entirely in `PlanDetailPanel`. Planner should not add a `replyMode` prop to `StepFieldEditor`.

3. **`tabs.tsx` requires no changes.** `TabsContent` already spreads `...props` (line 78), so `forceMount` passes through to Radix UI without modification.

4. **Double-dot artifact:** Accepted as-is per CONTEXT.md — do not modify `MessageFeedRow`.

5. **`clearRun()` picks up new fields automatically.** It calls `set({ ...INITIAL_STATE })` (line 99), so adding the new fields to `INITIAL_STATE` is sufficient. Only `setRunning` needs an explicit inline reset to prevent stale state on the second run (Pitfall 3).

---

## Metadata

**Analog search scope:** `src/stores/`, `src/hooks/`, `src/components/plans/`, `src/components/response/`, `src/components/layout/`, `src/components/ui/`
**Files scanned:** 10 source files read
**Pattern extraction date:** 2026-05-24
