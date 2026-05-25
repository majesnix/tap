---
status: approved
phase: 23-response-view-inline-and-shared-feed
source: [23-VERIFICATION.md]
started: 2026-05-24T14:30:00Z
updated: 2026-05-24T16:00:00Z
---

## Current Test

Human UAT approved 2026-05-24.

## Tests

### 1. Reply dot on step row
expected: Run a plan with a reply-capable step; confirm the dot (w-1.5 h-1.5 bg-primary) appears next to the step's status badge after the reply arrives.
result: passed

### 2. Click step with dot shows StepReplyView
expected: The right pane switches to the decoded reply view with step-name header, ResponseDecodedView component, and hex section. paneMode becomes 'reply'.
result: passed

### 3. Click same step again toggles back to StepFieldEditor
expected: A second click on the same reply-dot step while in reply mode returns paneMode to 'editor' and shows StepFieldEditor.
result: passed

### 4. Click different step (no reply) closes StepReplyView
expected: Selecting a step without a stored reply resets paneMode to 'editor' and StepFieldEditor is shown.
result: passed

### 5. Reply Feed tab appears with count badge
expected: After the first step reply arrives, a "Reply Feed (1)" tab appears in PlanDetailPanel alongside the "Step Editor" tab. The tab strip is gated on hasRunStarted.
result: passed

### 6. Reply Feed tab shows Accordion entries
expected: PlanReplyFeedTab renders MessageFeedRow items inside an Accordion; the Step Editor tab content remains mounted (hidden with forceMount, not unmounted).
result: passed

### 7. Form state preserved across tab switches
expected: react-hook-form fields retain their values when switching between the Step Editor and Reply Feed tabs — forceMount keeps the form alive.
result: passed

### 8. FIFO cap at 500 entries (optional)
expected: planReplyFeed never exceeds 500 entries after many step replies; oldest entries are dropped when cap is hit.
result: passed

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
