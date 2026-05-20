---
status: partial
phase: 12-block-library-drag-and-drop-layer
source: [12-VERIFICATION.md]
started: 2026-05-20T18:40:00Z
updated: 2026-05-20T18:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag Ring Visual Feedback
expected: Load the app, drag a block row over the form ScrollArea, confirm the ring-2 ring-primary/50 outline appears during hover and disappears on leave or drop
result: [pending]

### 2. Drop Applies Non-Dirty Fields
expected: Drop a block with matching scalar fields onto a form with untouched fields — fields fill; drop again to confirm block-filled fields remain overwriteable (shouldDirty=false); type in a field, drop again — the typed field is protected but others fill
result: [pending]

### 3. BLK-08 Warning Toast in Production Sonner
expected: Drop a block whose keys do not exist in the proto message; Sonner toast appears in warning variant with correct copy: "N field from block not in form: field1, field2"
result: [pending]

### 4. Drop Zone Absent in JSON Mode
expected: Switch to "Edit as JSON" mode, attempt to drag a block onto the editor area — no ring appears, no form mutation occurs
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
