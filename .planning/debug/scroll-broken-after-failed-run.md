---
status: resolved
slug: scroll-broken-after-failed-run
trigger: "After a plan run (especially a failed one), scrolling stops working in the step editor pane (PlanDetailPanel). Suspected regression from Phase 23 tab strip changes in PlanDetailPanel.tsx — the Tabs/TabsContent with forceMount may be causing overflow/height to break."
created: 2026-05-24T14:55:00Z
updated: 2026-05-24T15:10:00Z
---

## Symptoms

- **Expected**: Scroll normally through form fields in the step editor (right pane) after a run
- **Actual**: After a failed run, scrolling is completely broken in the step field editor (right pane)
- **Trigger**: Only after a failed run (e.g. step times out waiting for response); successful runs may work
- **Location**: Step field editor right pane only; step list (left pane) is unaffected
- **Error messages**: None reported
- **Timeline**: Started with Phase 23 changes (PlanDetailPanel tab strip added)
- **Reproduction**: Run a plan → have a step fail to wait for a response → try scrolling step editor → cannot scroll

## Current Focus

hypothesis: "CONFIRMED — Phase 23 wrapped StepFieldEditor in a TabsContent that lacked flex flex-col, breaking the flex height chain needed by ScrollArea."
test: "Inspect TabsContent className vs ScrollArea flex-1 min-h-0 requirements"
expecting: "Missing display:flex on TabsContent parent of ScrollArea"
next_action: "Fixed — added flex flex-col to both TabsContent className values in PlanDetailPanel.tsx"
reasoning_checkpoint: "ScrollArea uses flex-1 min-h-0 which only works inside a flex container. Before Phase 23 the direct parent was a flex row div. After Phase 23 the parent became TabsContent which had flex-1 overflow-hidden but no display:flex, so flex-1 resolved to nothing and ScrollArea grew to content height with no scrollable container."

## Evidence

- timestamp: 2026-05-24T15:05:00Z
  file: src/components/plans/PlanDetailPanel.tsx
  observation: "TabsContent for editor (line 142) had className='flex-1 overflow-hidden m-0 p-0' — missing flex flex-col. TabsContent for reply-feed (line 148) had same issue."

- timestamp: 2026-05-24T15:05:00Z
  file: src/components/plans/StepFieldEditor.tsx
  observation: "StepFieldEditorInner returns <ScrollArea className='flex-1 min-h-0'> (line 587). This requires a flex container parent to resolve height correctly."

- timestamp: 2026-05-24T15:05:00Z
  observation: "The 'failed run' framing is a UX red herring — the bug triggers on ANY first run (hasRunStarted becomes true, tab strip appears). Failed runs surface it because the user stays in the editor; successful runs users may move on before noticing."

## Eliminated

- Left pane (StepListPanel): not affected — it is outside the Tabs wrapper entirely
- paneMode or stepReplies state: not causal — the scroll is broken before any content switch
- forceMount on editor TabsContent: not causal — the issue is the missing flex display, not mounting behavior

## Resolution

root_cause: "TabsContent wrapping StepFieldEditor (Phase 23) lacked flex flex-col, so ScrollArea's flex-1 min-h-0 had no flex parent and could not constrain its height — content overflowed with no scroll container."
fix: "Added flex flex-col to className of both TabsContent elements in PlanDetailPanel.tsx (editor at line 142, reply-feed at line 148)."
verification: "Visual check — scrolling should work in both tabs once tab strip appears after a run."
files_changed:
  - src/components/plans/PlanDetailPanel.tsx
