---
phase: "23"
plan: "03"
subsystem: ui
tags: [react, zustand, tabs, pane-mode, reply-view, step-list]
dependency_graph:
  requires: [23-01, 23-02]
  provides: [hasRunStarted-gated-tabs, paneMode-driven-editor, reply-dot-on-steps, toggle-click-handler]
  affects: [src/components/plans/PlanDetailPanel.tsx, src/components/plans/StepListPanel.tsx]
tech_stack:
  added: []
  patterns: [forceMount-hidden, paneMode-toggle, imperative-getState, hasRunStarted-predicate]
key_files:
  created: []
  modified:
    - src/components/plans/PlanDetailPanel.tsx
    - src/components/plans/StepListPanel.tsx
decisions:
  - "D-01: StepReplyView renders in editor TabsContent (right pane), not in StepListPanel"
  - "D-02: paneMode === 'reply' replaces StepFieldEditor in editor TabsContent — not appended"
  - "D-03: Second click on same step row while paneMode === 'reply' calls setPaneMode('editor')"
  - "D-05: Tab strip appears only when hasRunStarted — derived from stepStatuses/planReplyFeed length"
  - "D-07: Reply Feed tab does not auto-activate — activeTab local state starts as 'editor'"
  - "D-08: Tab strip always accessible; Reply Feed tab does not vanish on paneMode === 'reply'"
  - "Pitfall 1: forceMount + hidden className preserves StepFieldEditor mount state during Reply Feed tab"
  - "Pitfall 4: hasRunStarted uses stepStatuses/planReplyFeed predicates, not isRunning/runningPlanId"
metrics:
  duration_seconds: 420
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_changed: 2
---

# Phase 23 Plan 03: Wire Tab Strip and Reply View into Layout Summary

## One-liner

Wired paneMode-driven StepReplyView/StepFieldEditor toggle and hasRunStarted-gated Tabs strip into PlanDetailPanel; added reply indicator dot and second-click toggle to StepListPanel.

## What Was Built

### Task 1: Add tab strip and paneMode-driven reply view to PlanDetailPanel

Modified `src/components/plans/PlanDetailPanel.tsx`:

**New imports:**
- `{ Tabs, TabsContent, TabsList, TabsTrigger }` from `@/components/ui/tabs`
- `{ cn }` from `@/lib/utils`
- `{ StepReplyView }` from `./StepReplyView`
- `{ PlanReplyFeedTab }` from `./PlanReplyFeedTab`
- `type { ReplyMessage }` added to types import

**Extended store destructure:** Added `paneMode`, `stepReplies`, `planReplyFeed`, `stepStatuses` to `usePlanExecutionStore()` destructure.

**Local tab state:** `const [activeTab, setActiveTab] = useState<'editor' | 'reply-feed'>('editor')` — local component state only, not in global store (D-07: tab strip does not auto-activate).

**hasRunStarted predicate (Pitfall 4):**
```ts
const hasRunStarted = Object.keys(stepStatuses).length > 0 || planReplyFeed.length > 0;
```
Correctly uses stepStatuses/planReplyFeed — NOT `isRunning` or `runningPlanId` (which clear post-run, preventing tab strip from persisting).

**Derived reply values:**
- `selectedStepReply: ReplyMessage | null` — keyed from stepReplies by effectiveSelectedStepId
- `selectedStepName` — from selectedStep?.name

**Conditional render:**
- When `!hasRunStarted`: bare `<StepFieldEditor>` as before (pre-run path unchanged)
- When `hasRunStarted`: `<Tabs>` wrapper with:
  - "Step Editor" trigger + "Reply Feed (N)" trigger with live count
  - Editor `TabsContent` with `forceMount` + `hidden` className (Pitfall 1 — keeps StepFieldEditor mounted)
  - Editor content: `StepReplyView` when `paneMode === 'reply' && selectedStepReply !== null`, else `StepFieldEditor`
  - Reply Feed `TabsContent` renders `<PlanReplyFeedTab />`

### Task 2: Add reply indicator dot and toggle click handler to StepListPanel

Modified `src/components/plans/StepListPanel.tsx`:

**Type import:** Added `ReplyMessage` to the types import line.

**SortableStepRowProps interface:** Added `stepReplies: Record<string, ReplyMessage>` prop.

**SortableStepRow function:** Added `stepReplies` destructure; renders reply indicator dot after StepStatusBadge:
```tsx
{stepReplies[step.id] != null && (
  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-label="has reply" />
)}
```

**StepListPanel store destructure:** Extended with `stepReplies, setPaneMode`.

**Toggle click handler** (replacing plain `() => onSelectStep(step.id)`):
- Reads `paneMode` imperatively via `usePlanExecutionStore.getState()` (not reactive — prevents stale closure)
- D-03 guard: if `selectedStepId === step.id && paneMode === 'reply'`, call `setPaneMode('editor')` and return
- Otherwise: call `onSelectStep(step.id)`, then `setPaneMode('reply')` if step has a stored reply, else `setPaneMode('editor')`

## Test Results

- `npx tsc --noEmit`: exits 0, no type errors (both tasks verified)
- No automated unit tests added — this plan wires UI only; behavior is covered by manual UAT (verification item 8)

## Commits

| Hash    | Type | Description                                                      |
|---------|------|------------------------------------------------------------------|
| 1de2940 | feat | feat(23-03): wire tab strip and paneMode reply view in PlanDetailPanel |
| 834ebe9 | feat | feat(23-03): add reply dot and toggle click handler to StepListPanel |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

All plan verification conditions pass:

1. `npx tsc --noEmit` exits 0 — confirmed
2. `grep -n "forceMount" src/components/plans/PlanDetailPanel.tsx` — 1 match on editor TabsContent (line 141) — confirmed
3. `grep -n "activeTab !== 'editor'" src/components/plans/PlanDetailPanel.tsx` — 1 match (hidden className, line 142) — confirmed
4. `grep -n "hasRunStarted" src/components/plans/PlanDetailPanel.tsx` — definition at line 43 contains "stepStatuses" and "planReplyFeed" only — confirmed no isRunning/runningPlanId
5. `grep -n "StepReplyView\|PlanReplyFeedTab" src/components/plans/PlanDetailPanel.tsx` — both imports (lines 17-18) and render sites (lines 145, 149) present — confirmed
6. `grep -n "paneMode === 'reply'" src/components/plans/StepListPanel.tsx` — second-click guard present (line 344) — confirmed
7. `grep -n "has reply" src/components/plans/StepListPanel.tsx` — reply dot aria-label present (line 185) — confirmed

## Known Stubs

None. All UI wiring is complete — StepReplyView renders real reply data from the store, PlanReplyFeedTab reads real planReplyFeed from the store, the toggle handler reads real paneMode state.

## Threat Flags

T-23-06 verified: `grep -n "dangerouslySetInnerHTML"` on `ResponseDecodedView.tsx` and `ResponseHexSection.tsx` returned 0 matches. Both components use React text rendering only — no XSS surface from reply content.

## Self-Check: PASSED

- `src/components/plans/PlanDetailPanel.tsx` — exists, contains all required imports, hasRunStarted predicate, forceMount TabsContent, StepReplyView and PlanReplyFeedTab renders
- `src/components/plans/StepListPanel.tsx` — exists, contains stepReplies prop, reply dot, toggle handler with getState() and setPaneMode calls
- Commit 1de2940 — exists (Task 1: PlanDetailPanel tab strip and paneMode reply view)
- Commit 834ebe9 — exists (Task 2: StepListPanel reply dot and toggle handler)
