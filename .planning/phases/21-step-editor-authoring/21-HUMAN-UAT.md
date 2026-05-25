---
status: resolved
phase: 21-step-editor-authoring
source: [21-VERIFICATION.md]
started: 2026-05-24T00:10:00Z
updated: 2026-05-25T00:00:00.000Z
---

## Current Test

[complete — human verification recorded in 21-VERIFICATION.md on 2026-05-25]

## Tests

### 1. Drag-and-drop step reorder
expected: Drag a step by its GripVertical handle; reorderSteps fires and the row body does NOT initiate drag (PointerSensor distance:4 constraint)
result: passed

### 2. Auto-save debounce + stale-step guard
expected: Edit a field then switch steps before 300ms; the edit does NOT save to the first step and the new step form initializes from its own stored values (no echo loop)
result: passed

### 3. From history import — proto resolution and error toast
expected: (a) with proto file open: step pre-fills with field values, target, and proto path; (b) with proto file closed: toast error "Open the .proto file for [type] first, then retry."
result: passed

### 4. From block library import — blank proto confirmed
expected: Import a block; new step has field values from block but proto file selector and message type selector are empty (D-12)
result: passed

### 5. Inline rename commit / cancel
expected: Rename via kebab: Enter commits, Escape reverts, clearing then blurring reverts
result: passed

### 6. Delete AlertDialog rendering
expected: Delete a step via kebab; AlertDialog renders outside ScrollArea with no z-index or portal stacking issues in Tauri WKWebView
result: passed

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
