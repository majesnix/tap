---
phase: 21-step-editor-authoring
plan: "04"
subsystem: ui-components
tags: [react, sheet, history-import, block-import, step-creation]
dependency_graph:
  requires:
    - "21-01 (usePlanStore.addStep action)"
    - "21-02 (StepListPanel with picker open state stubs)"
  provides:
    - StepHistoryPicker (Sheet component, D-10 protoPath fallback, target reconstruction)
    - StepBlockPicker (Sheet component, D-12 blank proto_path/message_type)
    - StepListPanel updated to render both pickers
  affects:
    - src/components/plans/StepListPanel.tsx
    - src/components/plans/StepHistoryPicker.tsx
    - src/components/plans/StepBlockPicker.tsx
tech-stack:
  added: []
  patterns:
    - Sheet picker pattern (AmqpPropertiesSheet analog)
    - D-10 protoPath fallback: entry.protoPath ?? openFiles.find by messageTypeName
    - D-11 target reconstruction from exchange/routingKey
    - D-12 blank proto_path/message_type on block import (user fills manually)

key-files:
  created:
    - src/components/plans/StepHistoryPicker.tsx
    - src/components/plans/StepBlockPicker.tsx
  modified:
    - src/components/plans/StepListPanel.tsx

key-decisions:
  - "D-10 fallback: when entry.protoPath is undefined, match by messageTypeName against openFiles; toast error if no match"
  - "D-11 target reconstruction: entry.exchange==='' → queue mode; entry.exchange!=='' → exchange mode"
  - "D-12: block import leaves proto_path and message_type blank; user sets manually after import"
  - "Picker getter names restored from discarded form (Plan 02 workaround) now that pickers consume them"

patterns-established:
  - "Sheet picker: side=right w-80 flex flex-col, ScrollArea flex-1 min-h-0, empty state in h-full centered div"
  - "History import: always validate proto resolution before calling addStep; toast.error on failure"
  - "Block import: field_values = block.content (already serialized JSON string, no re-serialization)"

requirements-completed:
  - STEP-02
  - STEP-03

duration: ~6min
completed: "2026-05-24"
---

# Phase 21 Plan 04: History and Block Import Pickers Summary

**StepHistoryPicker and StepBlockPicker Sheet components with D-10 protoPath fallback, target reconstruction, and D-12 blank-field block import wired into StepListPanel**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:06:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- StepHistoryPicker Sheet component: resolves proto path via D-10 fallback (entry.protoPath ?? openFiles.find), reconstructs target from exchange/routingKey (D-11), shows toast.error when proto file not open
- StepBlockPicker Sheet component: uses block.content directly as field_values, leaves proto_path and message_type blank per D-12, user fills those in StepFieldEditor
- StepListPanel wired: picker open state getters restored from discarded form used in Plan 02, both pickers now render with correct props; "From history" and "From block library" menu items fully functional

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StepHistoryPicker and StepBlockPicker** - `9749ebe` (feat)
2. **Task 2: Wire pickers into StepListPanel** - `37ebf6c` (feat)

## Files Created/Modified

- `src/components/plans/StepHistoryPicker.tsx` - Sheet picker for history import; D-10 protoPath fallback; D-11 target reconstruction; exact UI-SPEC empty state and toast copy
- `src/components/plans/StepBlockPicker.tsx` - Sheet picker for block library import; D-12 blank proto_path/message_type; exact UI-SPEC empty state copy
- `src/components/plans/StepListPanel.tsx` - Added imports, restored getter names, replaced TODO placeholder comment with actual picker renders

## Decisions Made

- D-10: History picker resolves proto path as `entry.protoPath ?? openFiles.find(f => f.schema?.message_map[entry.messageTypeName])?.filePath ?? null`; if null, shows toast.error and aborts — does not create a broken step
- D-11: `entry.exchange === ""` signals queue-mode send; `entry.exchange !== ""` signals exchange-mode send
- D-12: Block picker leaves `proto_path: ""` and `message_type: ""` blank — this is accepted behavior (D-12 decision), user sets them in StepFieldEditor after import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restore picker open state getter names in StepListPanel**
- **Found during:** Task 2 (wiring pickers into StepListPanel)
- **Issue:** Plan 02 discarded getter names (`const [, setHistoryPickerOpen]`) to work around `noUnusedLocals` TS error; the picker components introduced in this plan now consume `historyPickerOpen` and `blockPickerOpen` as `open` props — so the getters must exist
- **Fix:** Changed `const [, setHistoryPickerOpen]` → `const [historyPickerOpen, setHistoryPickerOpen]` (same for blockPickerOpen)
- **Files modified:** `src/components/plans/StepListPanel.tsx`
- **Verification:** TypeScript `tsc --noEmit` returns 0 errors; `grep -n "historyPickerOpen"` shows 4 matches (declaration + open prop usage)
- **Committed in:** 37ebf6c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for pickers to function. No scope creep.

## Issues Encountered

None — TypeScript compiled cleanly after restoring getter names.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — StepHistoryPicker and StepBlockPicker are fully implemented. All three step-creation paths (blank, from history, from block library) are now functional.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All trust boundaries are unchanged from the plan's threat model:
- `JSON.stringify(entry.fieldValues)` re-serializes user-authored values (T-21-11, accepted)
- `block.content` passed directly as `field_values` (T-21-12, accepted; validated by safeParseFieldValues in Plan 03)
- `entry.protoPath` used as `proto_path` (T-21-13, accepted; captured from native dialog at send time)

## Next Phase Readiness

- All three step-creation paths are complete: blank step (Plan 02), from history (this plan), from block library (this plan)
- STEP-02 and STEP-03 requirements fulfilled
- Phase 21 wave 3 complete

## Self-Check: PASSED

Files exist:
- src/components/plans/StepHistoryPicker.tsx: FOUND
- src/components/plans/StepBlockPicker.tsx: FOUND
- src/components/plans/StepListPanel.tsx: FOUND
- .planning/phases/21-step-editor-authoring/21-04-SUMMARY.md: FOUND

Commits exist:
- 9749ebe (Task 1 - StepHistoryPicker + StepBlockPicker): FOUND
- 37ebf6c (Task 2 - Wire into StepListPanel): FOUND
- ff22742 (Summary): FOUND

---
*Phase: 21-step-editor-authoring*
*Completed: 2026-05-24*
