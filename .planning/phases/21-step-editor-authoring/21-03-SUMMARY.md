---
phase: 21-step-editor-authoring
plan: "03"
subsystem: ui-components
tags: [react, react-hook-form, step-editor, form-provider, auto-save, debounce]
dependency_graph:
  requires:
    - 21-01 (usePlanStore.updateStep)
    - 21-02 (StepFieldEditor stub with correct prop signature)
  provides:
    - StepFieldEditor (full implementation replacing Plan 02 stub)
    - safeParseFieldValues (T-21-07 mitigation)
  affects:
    - src/components/plans/StepFieldEditor.tsx
tech_stack:
  added: []
  patterns:
    - isolated useForm instance (D-07 — not shared with useProtoStore)
    - prevStepIdRef guard (reset only on step.id change, never on field_values change)
    - currentStepIdRef stale-step guard on debounced auto-save
    - renderField dispatch switch (mirrors ProtoFormRenderer FROZEN pattern)
    - RepeatedField pre-dispatch before switch
    - TargetSection / ResponseModeSection as local useState components
key_files:
  created: []
  modified:
    - src/components/plans/StepFieldEditor.tsx
decisions:
  - "StepFieldEditorInner subcomponent isolates all hooks below the null-step early return (rules of hooks)"
  - "TargetSection and ResponseModeSection placed outside <form> element but inside ScrollArea — they manage their own state and call updateStep directly, not via form watch"
  - "renderField function is file-scoped (not inside component) to avoid re-creation on every render while still accessing FormProvider context through each field primitive's useFormContext()"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-23T22:04:00Z"
  tasks_completed: 1
  files_changed: 1
---

# Phase 21 Plan 03: StepFieldEditor Full Implementation Summary

Isolated react-hook-form instance with 300ms debounced auto-save, stale-step guard, FormProvider wrapping all field primitives, and four scrollable sections (Proto file, Fields, Target, Response mode) replacing the Plan 02 stub.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement StepFieldEditor (full replacement of Plan 02 stub) | 675540f | src/components/plans/StepFieldEditor.tsx |

## What Was Built

### StepFieldEditor (full implementation)

Complete replacement for the Plan 02 stub. The component is split into two parts:

**`StepFieldEditor` (exported):**
- Reads `updateStep` from `usePlanStore` and `openFiles` from `useProtoStore`
- Handles the null-step empty state ("Select a step to edit it.")
- Resolves proto schema: `openFiles.find(f => f.filePath === step.proto_path)?.schema?.message_map[step.message_type]`
- Delegates to `StepFieldEditorInner` for the hook-heavy implementation

**`StepFieldEditorInner` (internal):**
- Isolated `useForm` instance initialized from `safeParseFieldValues(step.field_values, message)` (D-07)
- `prevStepIdRef` guard: resets form ONLY when `step.id` changes — never on `step.field_values` change (prevents echo loop)
- `currentStepIdRef` + debounce (300ms): stale-step guard prevents a pending save from writing to a step that was switched away from (T-21-09)
- `FormProvider` wraps all field primitives so they can call `useFormContext()` internally

**`safeParseFieldValues` helper:**
- Returns `{}` when no schema
- Wraps `JSON.parse` in try/catch — corrupt JSON falls back to `buildDefaultValues(schema)` (T-21-07)
- Non-object parse results also fall back to defaults

**`renderField` dispatch function (file-scoped):**
- Mirrors `ProtoFormRenderer`'s FROZEN dispatch switch exactly
- Pre-dispatch bytes check (`scalar + bytes` → `BytesField`)
- Pre-dispatch map check (`map` → `MapField`)
- Switch cases: scalar, message, enum, oneof, well_known
- Depth guard: returns `(max depth reached)` div when depth > MAX_DEPTH (5)

**Section: Proto file + message type**
- `Select` populated from `openFiles` — displays filename only (`.split("/").pop()`)
- Message type `Select` appears only when a file is selected and open (has matching `openFiles` entry)
- "Proto not open" helper text when `step.proto_path` is set but not in `openFiles`
- Changing the file resets `message_type: ""` to avoid stale type selection

**Section: Fields**
- "No message type selected." helper when `message` is null
- Full field dispatch: repeated fields via `RepeatedField` pre-check, all others via `renderField`
- Field path equals `field.name` at depth 0

**Section: Target (`TargetSection`):**
- Local `useState` for `targetKind`, `queueName`, `exchangeName`, `routingKey`
- `prevStepIdRef` resets local state on step change
- Queue/Exchange RadioGroup with `sr-only` items + conditional label styling (mirrors PublishBar)
- IDs scoped to step: `target-${kind}-${step.id}` (prevents conflicts with multiple editors)
- `updateStep` called on RadioGroup change and on input blur

**Section: Response mode (`ResponseModeSection`):**
- Local `useState` for `mode`, `delayMs`, `replyQueue`, `timeoutMs`
- Three modes: no-wait (delay input) / correlation-id (reply queue + timeout) / first-arrival (reply queue + timeout)
- `parseInt` fallback to defaults (200ms, 10000ms) on empty or NaN input (T-21-10)
- `updateStep` called on mode change and input blur

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rules of hooks violation — hooks after conditional return**
- **Found during:** Task 1 implementation
- **Issue:** The plan's sample code called `useForm`, `useEffect`, and `useWatch` inside `StepFieldEditor` after a null-step early return, which violates React's rules of hooks
- **Fix:** Extracted `StepFieldEditorInner` as a separate component that always renders when `step` is non-null. `StepFieldEditor` handles the early return; `StepFieldEditorInner` owns all hooks unconditionally.
- **Files modified:** `src/components/plans/StepFieldEditor.tsx`

**2. [Rule 1 - Bug] TypeScript: mode state type too wide**
- **Found during:** Task 1, `tsc --noEmit` run
- **Issue:** `useState(step.response_mode.mode)` inferred `string` type, but `setMode(newMode)` received `string` from RadioGroup `onValueChange` — TypeScript rejected the assignment
- **Fix:** Explicit type annotation `useState<"no-wait" | "correlation-id" | "first-arrival">` + cast in `handleModeChange`
- **Files modified:** `src/components/plans/StepFieldEditor.tsx`

**3. [Rule 3 - Blocking] Initial write went to main repo path**
- **Found during:** Post-write verification
- **Issue:** `Write` tool call used `/Users/majesnix/gits/proto-sender/src/...` (main repo) instead of the worktree path
- **Fix:** Re-read the worktree file, then re-wrote to the correct worktree path `/Users/majesnix/gits/proto-sender/.claude/worktrees/agent-a917c9b0cfa55c003/src/...`
- **Impact:** No data loss — the implementation was correct, just written to wrong path first

## Known Stubs

None — all four sections are fully implemented with real functionality. The Plan 02 stub text ("implemented in Plan 03") is gone.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. All surfaces are local UI state mutations.

Threat mitigations implemented per plan's threat model:
- T-21-07: `safeParseFieldValues` with try/catch + object type check — corrupt JSON never reaches `useForm` as untyped data
- T-21-09: `currentStepIdRef.current === capturedStepId` guard in debounce closure prevents stale write to switched-away step
- T-21-10: `parseInt` fallback defaults (200, 10000) prevent NaN from being persisted

## Self-Check: PASSED

Files exist:
- src/components/plans/StepFieldEditor.tsx: FOUND (690 lines)

Commits exist:
- 675540f (Task 1): FOUND

Acceptance criteria verified:
- `safeParseFieldValues` defined and used: PASS
- `prevStepIdRef` and `currentStepIdRef` present: PASS
- `step.field_values` not in useEffect dependency array: PASS
- `FormProvider` wrapping fields: PASS
- All three response mode values present: PASS
- "Select a step to edit it." copy: PASS
- "No message type selected." copy: PASS
- "Failed to save step. Changes may be lost." copy: PASS
- TypeScript: 0 errors: PASS
