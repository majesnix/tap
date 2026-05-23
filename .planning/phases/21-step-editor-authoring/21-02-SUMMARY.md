---
phase: 21-step-editor-authoring
plan: "02"
subsystem: ui-components
tags: [react, dnd-kit, sortable, step-list, step-editor, tauri]
dependency_graph:
  requires:
    - 21-01 (usePlanStore step actions: addStep, updateStep, deleteStep, duplicateStep, reorderSteps)
  provides:
    - PlanDetailPanel (two-pane sub-split with DndContext)
    - StepListPanel (sortable step list with CRUD)
    - StepFieldEditor (stub with correct prop signature)
  affects:
    - src/components/plans/PlanDetailPanel.tsx
    - src/components/plans/StepListPanel.tsx
    - src/components/plans/StepFieldEditor.tsx
    - package.json
    - pnpm-lock.yaml
tech_stack:
  added:
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/utilities@3.2.2"
  patterns:
    - SortableContext + useSortable (verticalListSortingStrategy)
    - InlineEditRow with cancellingRef guard (copied from PlanListPanel)
    - AlertDialog at component root (outside ScrollArea)
    - listeners on GripVertical wrapper only (not full row)
    - selectedStepId as local React state (D-12 pattern)
key_files:
  created:
    - src/components/plans/StepListPanel.tsx
    - src/components/plans/StepFieldEditor.tsx
  modified:
    - src/components/plans/PlanDetailPanel.tsx
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Used pnpm add instead of npm install — project uses pnpm@10.33.0 as packageManager"
  - "@dnd-kit/utilities also installed (peer dep of @dnd-kit/sortable, needed for CSS.Transform.toString)"
  - "activeDragId prop accepted on StepListPanel for future use (pickers in Plan 04), suppressed with _activeDragId"
  - "picker state setters declared in StepListPanel with unnamed getter (const [, setX] = useState()) to avoid noUnusedLocals"
  - "planId captured as const before nested functions in PlanDetailPanel to satisfy TypeScript closure narrowing"
metrics:
  duration: "~12m"
  completed_date: "2026-05-23T21:50:51Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 21 Plan 02: Step List Panel and PlanDetailPanel Sub-Split Summary

PlanDetailPanel rewritten as a two-pane sub-split with plan-scoped DndContext; StepListPanel implements the complete sortable step list with DnD reorder, inline rename, AlertDialog delete, and kebab CRUD; StepFieldEditor stub provides the correct prop signature and four placeholder sections for Plan 03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @dnd-kit/sortable + rewrite PlanDetailPanel + create StepListPanel | 91b7373 | package.json, pnpm-lock.yaml, src/components/plans/PlanDetailPanel.tsx, src/components/plans/StepListPanel.tsx |
| 2 | Create StepFieldEditor stub component | 70cebaa | src/components/plans/StepFieldEditor.tsx |

## What Was Built

### PlanDetailPanel (rewritten)

Replaced the empty placeholder with a two-pane sub-split layout:
- `selectedStepId: string | null` — local React state, NOT in usePlanStore (D-12 pattern)
- `activeDragId: string | null` — local React state for DragOverlay
- `DndContext` wraps `StepListPanel` only — plan-scoped, separate from AppLayout's block DndContext (D-14)
- `PointerSensor` with `{ distance: 4 }` — tighter than AppLayout's distance 8 per UI-SPEC
- `DragOverlay` shows floating step name card during drag
- Empty state ("Select a plan to get started") preserved from original

### StepListPanel (new)

Complete sortable step list with all CRUD interactions:
- `SortableContext` + `useSortable` with `verticalListSortingStrategy`
- **listeners on GripVertical wrapper ONLY** — row is fully clickable for selection; only the grip handle activates drag
- `InlineEditRow` copied verbatim from PlanListPanel: autoFocus, select-all on mount, `cancellingRef` guard on Escape
- `AlertDialog` at component root, outside `ScrollArea` — prevents Radix Portal nesting issue
- `DropdownMenuItem` "Delete" calls `e.preventDefault()` before setting `stepToDelete` state
- After delete, if deleted step was selected: clears `selectedStepId` to `null`
- Header: `w-60` (240px) per D-01, with "Steps" label and "Add step" dropdown
- "Add step" menu: Blank step / From history / From block library
- "Blank step" creates `PlanStep` with `crypto.randomUUID()` and auto-selects it
- "From history" and "From block library" open states wired (setters ready for Plan 04 pickers)

### StepFieldEditor (stub)

Prop-correct stub for Plan 03 to fill in:
- `step: PlanStep | null` — renders "Select a step to edit it." when null
- `planId: string` — prefixed `_planId` to suppress `noUnusedParameters` until Plan 03 uses it
- Four placeholder sections: "Proto file" / "Fields" / "Target" / "Response mode"
- Each section uses the correct `px-4 py-3 border-b border-border` layout with `h3 text-sm font-semibold mb-3` heading

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Package manager is pnpm, not npm**
- **Found during:** Task 1 dependency installation
- **Issue:** Plan specified `npm install @dnd-kit/sortable@^10.0.0` but the project uses `pnpm@10.33.0` as the declared packageManager
- **Fix:** Used `pnpm add @dnd-kit/sortable@^10.0.0` — no lock file conflict
- **Impact:** None — installation succeeded cleanly

**2. [Rule 3 - Blocking] @dnd-kit/utilities not installed**
- **Found during:** Task 1, TypeScript error `Cannot find module '@dnd-kit/utilities'`
- **Issue:** Plan used `import { CSS } from "@dnd-kit/utilities"` but the package is a peer dependency of `@dnd-kit/sortable` that must be explicitly installed
- **Fix:** Installed `@dnd-kit/utilities@3.2.2` via `pnpm add`
- **Impact:** None — legitimate official package from @dnd-kit team

**3. [Rule 1 - Bug] TypeScript closure narrowing on selectedPlan.id**
- **Found during:** Task 1, `tsc --noEmit` run
- **Issue:** TypeScript reported `'selectedPlan' is possibly 'null'` inside `handleDragEnd` closure despite the early return null check, because TypeScript cannot narrow through closures for mutable props
- **Fix:** Captured `const planId = selectedPlan.id` before defining the nested functions, so the closure references the captured string rather than the prop
- **Files modified:** `src/components/plans/PlanDetailPanel.tsx`

**4. [Rule 3 - Blocking] noUnusedLocals prevents picker state variables**
- **Found during:** Task 1, TypeScript strictness analysis
- **Issue:** `const [historyPickerOpen, setHistoryPickerOpen] = useState(false)` — `historyPickerOpen` would be unused until Plan 04 adds pickers, causing `noUnusedLocals` error
- **Fix:** Used destructuring pattern `const [, setHistoryPickerOpen] = useState(false)` — discards the getter without a named local variable; setter is still callable
- **Files modified:** `src/components/plans/StepListPanel.tsx`

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| StepFieldEditor sections | src/components/plans/StepFieldEditor.tsx | All four sections show placeholder text — Plan 03 replaces with field primitives, proto selector, target, response mode |
| From history picker | src/components/plans/StepListPanel.tsx | `setHistoryPickerOpen(true)` wired but no Sheet renders yet — Plan 04 adds StepHistoryPicker |
| From block library picker | src/components/plans/StepListPanel.tsx | `setBlockPickerOpen(true)` wired but no Sheet renders yet — Plan 04 adds StepBlockPicker |

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. All surfaces are local UI state mutations — consistent with the threat model in the plan (T-21-04 mitigated: empty step name rejected via `if (trimmed) onCommit(trimmed); else onCancel()` in InlineEditRow).

## Self-Check: PASSED

Files exist:
- src/components/plans/PlanDetailPanel.tsx: FOUND
- src/components/plans/StepListPanel.tsx: FOUND
- src/components/plans/StepFieldEditor.tsx: FOUND
- package.json (with @dnd-kit/sortable): FOUND

Commits exist:
- 91b7373 (Task 1): FOUND
- 70cebaa (Task 2): FOUND
