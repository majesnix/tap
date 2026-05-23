---
status: partial
phase: 20-plan-view-shell-and-navigation
source: [20-VERIFICATION.md]
started: 2026-05-23T00:00:00.000Z
updated: 2026-05-23T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Plans Nav Button Navigation
expected: Clicking "Plans" in sidebar switches the entire app to the full-screen plan library view; button shows active state (bg-accent text-accent-foreground); clicking again returns to main form view

result: [pending]

### 2. Inline Create Row
expected: Clicking "New Plan" shows inline row with "Untitled Plan" pre-filled and all text selected; Enter commits; Escape cancels; blur with non-empty commits; blur with empty cancels

result: [pending]

### 3. Inline Rename via Kebab
expected: Kebab → Rename replaces the name span with an inline input containing the current name; Enter commits; Escape cancels without persisting

result: [pending]

### 4. Delete AlertDialog
expected: Kebab → Delete shows AlertDialog with title 'Delete "[name]"?'; "Keep plan" cancels; "Delete plan" removes the plan; if the plan was selected, right panel returns to "Select a plan to get started"

result: [pending]

### 5. Escape→Blur Double-Commit Guard
expected: Pressing Escape on inline edit cancels without persisting; does NOT trigger a second commit via the blur event (cancellingRef guard)

result: [pending]

### 6. Kebab stopPropagation
expected: Clicking the ⋮ kebab button on a plan row does NOT change the selected plan (stopPropagation prevents row click from firing)

result: [pending]

### 7. Toggle Navigation + State Preservation
expected: Switching from Plans view to main form view and back preserves the plan list (Zustand store singleton); previously selected plan is NOT preserved (selectedPlanId is local state in PlanView, which unmounts on view switch)

result: [pending]

### 8. PlanDetailPanel State Transitions
expected: Clicking a plan row shows "No steps yet" with ListChecks icon; deselecting (if applicable) shows "Select a plan to get started" with ClipboardList icon

result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
