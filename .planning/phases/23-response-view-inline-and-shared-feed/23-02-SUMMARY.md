---
phase: "23"
plan: "02"
subsystem: ui
tags: [react, display-components, reply-view, feed, zustand]
dependency_graph:
  requires: [23-01]
  provides: [StepReplyView, PlanReplyFeedTab]
  affects:
    - src/components/plans/StepReplyView.tsx
    - src/components/plans/PlanReplyFeedTab.tsx
tech_stack:
  added: []
  patterns: [pure-display-component, zustand-selector, shadcn-accordion-scrollarea]
key_files:
  created:
    - src/components/plans/StepReplyView.tsx
    - src/components/plans/PlanReplyFeedTab.tsx
  modified: []
decisions:
  - "D-02: StepReplyView renders decoded reply replacing the form — no form fields, no edit controls"
  - "D-06: PlanReplyFeedTab reads planReplyFeed from usePlanExecutionStore; does not couple to useResponseStore"
  - "Pitfall 6: StepReplyView shows fallback message when decoded is null so pane is never blank"
metrics:
  duration_seconds: 180
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_changed: 2
---

# Phase 23 Plan 02: Display Components (StepReplyView + PlanReplyFeedTab) Summary

## One-liner

Created two purely-presentational components: StepReplyView (inline step reply pane composing ResponseDecodedView + ResponseHexSection) and PlanReplyFeedTab (scrollable accordion feed reading planReplyFeed from usePlanExecutionStore).

## What Was Built

### Task 1: StepReplyView

Created `src/components/plans/StepReplyView.tsx`.

**Props:** `{ reply: ReplyMessage, stepName: string }`

**Renders:**
1. Container `div` with `flex flex-col gap-4 p-4 flex-1 overflow-auto`
2. Step-name header: `"Reply from: {stepName}"` in `text-sm text-muted-foreground`
3. `ResponseDecodedView` with `decoded={reply.decoded}` and hardcoded `error={null}` (D-02: reply replaces form; errors are not shown here)
4. Null fallback `div` (`"No decoded content available."`) rendered only when `reply.decoded === null` — prevents blank pane since ResponseDecodedView returns null silently in that case (Pitfall 6)
5. `ResponseHexSection` with `hexString={reply.hexString}` and `decoded={reply.decoded}`

Pure display component: no state, no forwardRef, no form fields.

### Task 2: PlanReplyFeedTab

Created `src/components/plans/PlanReplyFeedTab.tsx`.

**Props:** none

**Reads:** `planReplyFeed` from `usePlanExecutionStore((s) => s.planReplyFeed)`

**Renders:**
- Empty state (`planReplyFeed.length === 0`): `"No replies received yet — run a plan with correlation-id or first-arrival steps to see responses here."`
- Feed (`planReplyFeed.length > 0`): `ScrollArea` wrapping `Accordion` (type="single" collapsible) wrapping `planReplyFeed.map((msg) => <MessageFeedRow key={msg.id} message={msg} />)`

No imports of `MessageFeedTab` or `useResponseStore` — fully isolated from the response-tab store (D-06).

## Commits

| Hash    | Type | Description                                        |
|---------|------|----------------------------------------------------|
| 6a32628 | feat | feat(23-02): add StepReplyView inline reply display |
| cf5fb9e | feat | feat(23-02): add PlanReplyFeedTab shared feed       |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both components render from live store state (planReplyFeed) or props (reply, stepName) with no hardcoded placeholder data.

## Threat Flags

No new security surface introduced. T-23-03 (XSS via decoded payload): verified during read_first that ResponseDecodedView renders all values as text content via React's default escaping — no `dangerouslySetInnerHTML` anywhere in the component or its JsonTreeNode children. Disposition confirmed `mitigate` is satisfied.

## Self-Check: PASSED

1. `ls src/components/plans/StepReplyView.tsx src/components/plans/PlanReplyFeedTab.tsx` — both files exist
2. `npx tsc --noEmit` — exits 0, no type errors
3. `grep -n "ResponseDecodedView\|ResponseHexSection" src/components/plans/StepReplyView.tsx` — 4 matches (2 imports, 2 JSX usages)
4. `grep -n "No decoded content available" src/components/plans/StepReplyView.tsx` — 1 match (line 16)
5. `grep -n "MessageFeedRow" src/components/plans/PlanReplyFeedTab.tsx` — 2 matches (import + JSX)
6. `grep "MessageFeedTab\|useResponseStore" src/components/plans/PlanReplyFeedTab.tsx` — no output (exit 1, isolation confirmed)
7. `grep -n "No replies received yet" src/components/plans/PlanReplyFeedTab.tsx` — 1 match (line 12)
- Commit 6a32628 — verified in git log
- Commit cf5fb9e — verified in git log
