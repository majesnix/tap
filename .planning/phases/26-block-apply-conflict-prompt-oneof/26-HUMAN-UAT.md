---
status: complete
phase: 26-block-apply-conflict-prompt-oneof
source: [26-VERIFICATION.md]
started: 2026-05-25T17:00:00Z
updated: 2026-05-25T17:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Map key collision — Overwrite path
expected: Drag a block whose map field has a key that already exists in the form. Dialog opens with the colliding key row (badge: "map key"), default=Skip. Choose Overwrite → Apply block → colliding key updated to block value, non-colliding block rows appended, existing non-colliding rows preserved.
result: [pass] — Dialog opened with "map key" badge, `env` collision shown with Skip/Overwrite toggle. Chose Overwrite → Applied → `env` updated to block value (staging), non-colliding `team=infra` appended, pre-existing `region=us-east` preserved.

### 2. Map skip-all with non-colliding rows
expected: Same setup as #1. Leave conflict row on Skip → Apply block → colliding key unchanged (skipped), BUT non-colliding block rows are still appended (unconditional Phase B invariant).
result: [pass] — Dialog opened with Skip selected (default). Left on Skip → clicked Apply block → `env=prod` remained unchanged, non-colliding `team=infra` appended. Confirmed unconditional-append Phase B invariant holds.

### 3. Oneof branch-switch
expected: Load proto with oneof field, select + fill one branch. Drag block selecting a different branch. Dialog opens with "branch switch" badge and label "Switch '<field>' from '<current>' to '<block>'". Choose Overwrite → Apply → form switches branch atomically.
result: [pass] — Payment form with oneof `payment` field, `card_number=visa` active. Dragged "Bank Transfer Block" (targets bank_transfer). Dialog showed `Switch "payment" from "card_number" to "bank_transfer"` with `branch switch` badge. Chose Overwrite → Applied → `card_number` cleared, `bank_transfer=IBAN123` active. Atomic switch confirmed.

### 4. No conflict regression guard
expected: Empty form + block with scalar/enum/map fields → drag → NO dialog, fields filled immediately.
result: [pass] — Dragged "Scalar Block" onto empty scalar form → no dialog, `name=Alice` filled immediately.

### 5. Pitfall D regression (shouldDirty:false)
expected: Apply a block with no conflicts (scenario 4). Drag the SAME block again immediately → NO dialog on second drag (fields remained non-dirty due to shouldDirty:false).
result: [pass] — Dragged same block a second time → no dialog opened, fields re-applied without conflict prompt. shouldDirty:false confirmed working.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
