---
status: partial
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
result: [pending]

### 2. Map skip-all with non-colliding rows
expected: Same setup as #1. Leave conflict row on Skip → Apply block → colliding key unchanged (skipped), BUT non-colliding block rows are still appended (unconditional Phase B invariant).
result: [pending]

### 3. Oneof branch-switch
expected: Load proto with oneof field, select + fill one branch. Drag block selecting a different branch. Dialog opens with "branch switch" badge and label "Switch '<field>' from '<current>' to '<block>'". Choose Overwrite → Apply → form switches branch atomically.
result: [pending]

### 4. No conflict regression guard
expected: Empty form + block with scalar/enum/map fields → drag → NO dialog, fields filled immediately.
result: [pending]

### 5. Pitfall D regression (shouldDirty:false)
expected: Apply a block with no conflicts (scenario 4). Drag the SAME block again immediately → NO dialog on second drag (fields remained non-dirty due to shouldDirty:false).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
