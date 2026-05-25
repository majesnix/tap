---
phase: 20-plan-view-shell-and-navigation
plan: "01"
subsystem: frontend-ui
tags:
  - react
  - zustand
  - shadcn-ui
  - plan-library
dependency_graph:
  requires:
    - 19-plan-data-model-and-persistence
  provides:
    - plan-view-shell
    - plan-list-panel
    - plan-detail-panel
    - dropdown-menu-component
  affects:
    - src/components/plans/
    - src/components/ui/dropdown-menu.tsx
tech_stack:
  added:
    - shadcn/ui dropdown-menu (installed via npx shadcn@latest add dropdown-menu)
  patterns:
    - cancellingRef guard for Escape->blur double-commit on inline edit
    - controlled AlertDialog state at component root (not nested in DropdownMenuItem)
    - stopPropagation on kebab button to isolate from row selection
    - plansLoaded gate for list render (hydration deferred to App.tsx per D-11)
key_files:
  created:
    - src/components/ui/dropdown-menu.tsx
    - src/components/plans/PlanView.tsx
    - src/components/plans/PlanListPanel.tsx
    - src/components/plans/PlanDetailPanel.tsx
  modified: []
decisions:
  - "D-11 Option A: loadPlans() deferred to App.tsx (Plan 02) — PlanListPanel only reads plansLoaded flag"
  - "selectedPlanId local state in PlanView, not in usePlanStore (D-12)"
  - "cancellingRef pattern for Escape-safe inline edit — no prior codebase analog, new pattern"
  - "AlertDialog rendered at PlanListPanel root level, outside ScrollArea, to avoid mount-race (Pitfall 3)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 0
---

# Phase 20 Plan 01: Plan View Shell and Navigation — Component Build Summary

**One-liner:** Three plan library components (PlanView, PlanListPanel, PlanDetailPanel) plus shadcn dropdown-menu, delivering full CRUD UI with inline create/rename, kebab menus, AlertDialog confirmation, and two empty-state panels.

## What Was Built

### Task 1: Install dropdown-menu shadcn component (commit: 87a806d)

Ran `npx shadcn@latest add dropdown-menu` to generate `src/components/ui/dropdown-menu.tsx`. File contains `DropdownMenuTrigger`, `DropdownMenuContent`, and `DropdownMenuItem` exports consistent with the project's radix-nova shadcn preset.

### Task 2: PlanView and PlanDetailPanel (commit: 2242429)

**`src/components/plans/PlanDetailPanel.tsx`** — Pure display component. Renders two empty states:
- No plan selected: `ClipboardList` icon + "Select a plan to get started" / "Choose a plan from the list to view and edit its steps"
- Plan selected, no steps: `ListChecks` icon + "No steps yet" / "Steps will appear here once you add them"
Both icons carry `aria-hidden="true"`.

**`src/components/plans/PlanView.tsx`** — Full-screen two-pane root. Owns `selectedPlanId` local state (D-12 — NOT in usePlanStore). Renders `<Sidebar viewMode="plans" onViewChange={onViewChange} />` alongside `PlanListPanel` and `PlanDetailPanel`. Passes `selectedPlan` (Plan | null) to the detail panel via store lookup.

Note: `npm run build` will fail until Plan 02 runs (Sidebar.tsx does not yet accept `viewMode`/`onViewChange` props). This is documented and expected.

### Task 3: PlanListPanel with full CRUD (commit: bc3a865)

**`src/components/plans/PlanListPanel.tsx`** — The main deliverable for Phase 20. Implements:

- **Panel layout:** `w-72` fixed-width panel with `px-4 py-3` header (matched from BlockLibraryPanel pattern), ScrollArea list, and `+ New Plan` button (size="sm" with visible text label)
- **Plan rows (PlanRow):** kebab `DropdownMenu` always visible with Rename/Duplicate/Delete items; `stopPropagation` on trigger button prevents row selection (Pitfall 4)
- **Inline edit (InlineEditRow):** `cancellingRef` guards against Escape→blur double-commit (Pitfall 2); `inputRef.current?.select()` selects all text on mount (D-07/D-08); empty-name guard treats blank commit as cancel (D-09)
- **AlertDialog:** controlled state (`planToDelete`), rendered at component root outside ScrollArea — never nested in `DropdownMenuItem` (Pitfall 3). Delete confirm calls `onSelectPlan(null)` if deleting the selected plan (D-13)
- **Hydration:** Does NOT call `loadPlans()` — deferred to App.tsx per D-11. Reads `plansLoaded` flag only to gate list render
- **UI-SPEC copywriting:** exact strings "Keep plan", "Delete plan", "This action cannot be undone.", "Untitled Plan", "No plans yet"

## Deviations from Plan

None — plan executed exactly as written. The `loadPlans()` mention appears only in a comment in PlanListPanel.tsx documenting the D-11 rationale; it is not imported or called.

## Known Stubs

The `PlanDetailPanel` right pane renders empty-state messages only for Phase 20. This is intentional per D-03 — Phase 21 will replace this pane with the step editor. These are not bugs; they are the specified Phase 20 scope boundary.

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's threat model covers:

| Threat ID | Category | Status |
|-----------|----------|--------|
| T-20-01-01 | Tampering (plan names → createPlan/renamePlan) | Empty-name guard (D-09) implemented in InlineEditRow |
| T-20-01-02 | Information Disclosure | All data is developer-local; no sensitive tokens in scope |
| T-20-01-03 | Denial of Service (irreversible delete) | AlertDialog confirmation + `onSelectPlan(null)` reset implemented |

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check

### Files created:
- src/components/ui/dropdown-menu.tsx
- src/components/plans/PlanView.tsx
- src/components/plans/PlanListPanel.tsx
- src/components/plans/PlanDetailPanel.tsx

### Commits:
- 87a806d: chore(20-01): install shadcn dropdown-menu component
- 2242429: feat(20-01): create PlanView and PlanDetailPanel components
- bc3a865: feat(20-01): create PlanListPanel with inline CRUD, kebab menu, AlertDialog
