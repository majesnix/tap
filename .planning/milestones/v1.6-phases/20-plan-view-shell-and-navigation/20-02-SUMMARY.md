---
phase: 20-plan-view-shell-and-navigation
plan: "02"
subsystem: frontend-navigation
tags: [react, navigation, state-management, sidebar]
dependency_graph:
  requires: ["20-01"]
  provides: ["PLAN-06-navigation"]
  affects: ["src/App.tsx", "src/components/layout/AppLayout.tsx", "src/components/sidebar/Sidebar.tsx"]
tech_stack:
  added: []
  patterns: ["local-useState-for-view-mode", "prop-drill-for-callbacks", "conditional-render"]
key_files:
  created: []
  modified:
    - src/App.tsx
    - src/components/layout/AppLayout.tsx
    - src/components/sidebar/Sidebar.tsx
decisions:
  - "viewMode kept as local useState in App.tsx — not in Zustand (D-10)"
  - "loadPlans() called at App mount so plan data ready on first navigation (D-11)"
  - "Plans nav button uses toggle pattern: click when plans-active returns to main (satisfies ROADMAP success criterion 3)"
  - "SidebarProps uses optional props for defensive safety at non-App call sites (consistent with plan prescription)"
metrics:
  duration: "15 minutes"
  completed: "2026-05-23T19:15:00Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 20 Plan 02: Plan View Shell and Navigation — Navigation Wiring Summary

Wired the Plans nav button and plan view navigation into the live app: viewMode local state in App.tsx drives conditional render between AppLayout and PlanView, with prop-drilling through AppLayout to Sidebar supplying the toggle callback and active-state indicator.

## What Was Built

The three-file navigation wiring that connects Phase 20 Plan 01's PlanView component to the running app:

- **App.tsx**: Added `viewMode` local state (initialized `"main"`), `loadPlans()` useEffect at mount, conditional render swapping `<AppLayout>` for `<PlanView>` based on view mode, and prop threading of `viewMode`/`onViewChange` into AppLayout.
- **AppLayout.tsx**: Added `AppLayoutProps` interface with `viewMode` and `onViewChange`; destructured props in function signature; passed both down to `<Sidebar>`. No other logic changed.
- **Sidebar.tsx**: Added `SidebarProps` interface (optional props for defensive safety), `ListChecks` icon import from lucide-react, `cn` utility import, and the Plans nav button. Button placement: between title/description block and first Separator. Active state via `bg-accent text-accent-foreground` when `viewMode === "plans"`. Toggle behavior: click when active returns to `"main"`.

## Decisions Made

- **viewMode NOT in Zustand** (D-10 absolute constraint): Local `useState` in App.tsx only. Verified post-task: `grep -rn "viewMode" src/stores/` returns 0 results.
- **loadPlans() at mount** (D-11): Called once at App component mount via `useEffect([], ...)`. Plan data is available on first navigation without waiting for view switch.
- **Toggle click behavior**: Plans button click when `viewMode === "plans"` calls `onViewChange("main")`, serving as the back mechanism. UI-SPEC specified only forward navigation; toggle satisfies ROADMAP success criterion 3 (navigating back preserves list state).
- **Optional SidebarProps**: Props typed as optional (`?`) to prevent TypeScript errors at any call site that does not yet pass them. In practice, App.tsx (via AppLayout) always provides them.

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` | Passes (exit 0, 476ms) |
| `npm run test` | 354 tests passed across 31 files |
| D-10: viewMode not in stores | 0 occurrences in src/stores/ |
| D-11: loadPlans in useEffect | Confirmed |
| AppLayoutProps present | Yes |
| ListChecks in Sidebar | Yes |
| Plans button active state | Yes — `bg-accent text-accent-foreground` |
| Plans button toggle | Yes — `viewMode === "plans" ? "main" : "plans"` |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Thread viewMode through AppLayout + Plans nav button | `321e465` | `feat(20-02): thread viewMode through AppLayout; add Plans nav button to Sidebar` |
| Task 2: Wire App.tsx viewMode state + conditional render | `86c01ce` | `feat(20-02): wire viewMode state and conditional PlanView render in App` |

## Deviations from Plan

None — plan executed exactly as written. The baseline build was already red (Plan 01's PlanView.tsx passed `viewMode` prop to an untyped Sidebar), which was the expected state Task 1 was designed to fix.

## Known Stubs

None introduced in this plan. The PlanDetailPanel empty-state messages ("Select a plan to view its steps" / "No steps yet") are intentional Phase 20 placeholders documented in D-03 and deferred to Phase 21.

## Self-Check: PASSED
