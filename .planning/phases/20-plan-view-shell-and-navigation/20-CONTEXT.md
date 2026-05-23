# Phase 20: Plan View Shell and Navigation - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Plans nav button to the sidebar that switches the entire app to a full-screen plan library view. The view is a two-pane layout: a fixed-width plan list on the left with full CRUD (create, rename, duplicate, delete), and an empty-state detail pane on the right (placeholder for Phase 21's step editor). `viewMode: "main" | "plans"` lives as local React state in `App.tsx`. No routing. No step authoring. No execution.

</domain>

<decisions>
## Implementation Decisions

### PlanView Layout
- **D-01:** Two-pane layout: fixed-width plan list on the left, detail panel on the right. Phase 21 fills in the right pane without layout restructuring. Mirrors the Postman / Bruno pattern.
- **D-02:** Left pane is **fixed width** (no drag handle). Consistent with the app's existing sidebar-style fixed dimensions (~260–320px).
- **D-03:** Right pane in Phase 20 shows **empty state messages only**:
  - No plan selected → "Select a plan to view its steps"
  - Plan selected (but no steps yet) → "No steps yet" (Phase 21 will replace this)

### CRUD Interaction Style
- **D-04:** Plan rows use a **three-dot kebab (⋮) button**, always visible (not hover-gated). Opens a shadcn `DropdownMenu` with: **Rename** / **Duplicate** / **Delete**.
- **D-05:** Delete triggers a shadcn `AlertDialog` confirmation: "Delete [plan name]? This cannot be undone." Two buttons: Confirm (destructive) / Cancel.
- **D-06:** No undo/toast-undo pattern — the confirmation dialog is the only safety net for delete.

### Create & Rename Flow
- **D-07:** "New Plan" creates a plan via **inline row input** at the bottom of the list. A new row appears with an auto-focused text input pre-filled with `"Untitled Plan"` (all text selected, ready to overwrite). Enter commits; Escape cancels and removes the pending row.
- **D-08:** **Rename** uses the same inline edit pattern: clicking Rename from the kebab menu replaces the plan name text in the row with an auto-focused input pre-filled with the current name. Enter commits; Escape discards.
- **D-09:** Empty-name guard: if the user clears the input and commits, treat it as Escape (discard/cancel) — do not persist a blank-named plan.

### View Switching
- **D-10:** `viewMode: "main" | "plans"` is local React state in `App.tsx` (already established in v1.6 key decisions). The Plans nav button in the sidebar receives `onViewChange` as a prop (prop-drill from App.tsx through AppLayout to Sidebar). Do NOT add viewMode to any Zustand store.
- **D-11:** `usePlanStore.loadPlans()` is called at `App` mount (alongside other store loads), not on view switch. Plan data is available immediately when the user navigates to the plan view.

### Plan Selection
- **D-12:** `selectedPlanId: string | null` is local React state in `PlanView` (not in `usePlanStore` — per Phase 19 D-09). Clicking a plan row sets the selected plan ID and shows its detail in the right pane.
- **D-13:** When the currently selected plan is deleted, `selectedPlanId` resets to `null`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §Plan Library (PLAN-06) — The single requirement in scope for Phase 20
- `.planning/ROADMAP.md` §Phase 20 — Goal, success criteria, and dependency notes

### Phase 19 foundation (MUST read — Phase 20 builds directly on this)
- `.planning/phases/19-plan-data-model-and-persistence/19-CONTEXT.md` — All type definitions (Plan, PlanStep, StepStatus, ResponseMode, PublishTarget), usePlanStore API, and persistence pattern decisions
- `src/stores/usePlanStore.ts` — Implemented CRUD store; Phase 20 calls `createPlan`, `renamePlan`, `deletePlan`, `duplicatePlan`, `loadPlans`

### Structural analogs (follow these patterns)
- `src/components/layout/AppLayout.tsx` — Current layout root; Phase 20 adds viewMode branching here or in App.tsx
- `src/App.tsx` — viewMode state lives here; Plans nav button wires onViewChange through AppLayout to Sidebar
- `src/components/sidebar/Sidebar.tsx` — Where the Plans nav button is added
- `src/components/blocks/BlockLibraryPanel.tsx` — Panel/list pattern analog (not full-screen, but useful for plan list row structure)

### shadcn/ui components to use
- `DropdownMenu` — For the three-dot kebab action menu per plan row
- `AlertDialog` — For delete confirmation dialog
- No new npm packages needed for Phase 20

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePlanStore` (`src/stores/usePlanStore.ts`) — Full CRUD API ready: `createPlan(name)`, `renamePlan(id, name)`, `deletePlan(id)`, `duplicatePlan(id)`, `loadPlans()`. All return Promises; optimistic rollback on failure.
- `shadcn/ui DropdownMenu` — Already used in the app; apply same pattern for the kebab menu.
- `shadcn/ui AlertDialog` — Already available; use for delete confirmation.
- `crypto.randomUUID()` — Used by all stores for IDs; no change needed.

### Established Patterns
- **No viewMode in Zustand** — All prior view-state decisions (e.g., `activeTab` in RightPanel, `isBlockLibraryOpen` in AppLayout) use local React state. `viewMode` follows the same rule.
- **prop-drill for callbacks** — The app uses prop-passing (not context/store) for UI callbacks like `onToggleBlockLibrary`. `onViewChange` follows the same pattern.
- **loadPlans() at mount** — Other stores (`loadHistory`, `loadBlocks`) are called at app mount in a `useEffect`. `loadPlans()` follows the same pattern.
- **Inline edit with auto-focus** — No existing inline edit pattern in the app yet; implement as a controlled `<input>` with `autoFocus` and `onBlur` / `onKeyDown` handlers.

### Integration Points
- `src/App.tsx` — Add `viewMode` state + `loadPlans()` useEffect + conditional render of `<AppLayout />` vs `<PlanView />`
- `src/components/sidebar/Sidebar.tsx` — Add Plans nav button (receives `viewMode` and `onViewChange` as props)
- `src/components/layout/AppLayout.tsx` — Thread `viewMode` and `onViewChange` props through to Sidebar
- New: `src/components/plans/PlanView.tsx` — Two-pane plan library view (the main deliverable)
- New: `src/components/plans/PlanListPanel.tsx` — Left pane with plan rows, "New Plan" button, kebab menus
- New: `src/components/plans/PlanDetailPanel.tsx` — Right pane with empty-state messages for Phase 20

</code_context>

<specifics>
## Specific Ideas

- The inline create row pre-fills with `"Untitled Plan"` (all text selected) — same UX pattern as macOS Finder or VS Code tab rename.
- The Plans nav button in the sidebar should be visually distinct from the connection/file sections — likely a button with a list/plan icon near the top of the sidebar, or a nav tab strip if the sidebar evolves to multi-section navigation.
- Empty state for the right pane when a plan is selected: "No steps yet" is enough for Phase 20. Phase 21 will replace this with the step editor.

</specifics>

<deferred>
## Deferred Ideas

- Resizable left/right pane split — deemed overkill for v1. Fixed width chosen.
- Undo-via-toast for delete — confirmation dialog is sufficient for v1.
- `selectedPlanId` in a store — explicitly deferred to Phase 20 local state per Phase 19 D-09.
- Step display in the right pane — Phase 21 scope.

</deferred>

---

*Phase: 20-Plan View Shell and Navigation*
*Context gathered: 2026-05-23*
