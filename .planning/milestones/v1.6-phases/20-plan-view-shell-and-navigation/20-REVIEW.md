---
phase: 20-plan-view-shell-and-navigation
reviewed: 2026-05-23T19:23:03Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/components/ui/dropdown-menu.tsx
  - src/components/plans/PlanView.tsx
  - src/components/plans/PlanListPanel.tsx
  - src/components/plans/PlanDetailPanel.tsx
  - src/App.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/sidebar/Sidebar.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: fixed
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-23T19:23:03Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** fixed (WR-01, WR-02, WR-03 resolved 2026-05-23)

## Summary

This phase adds the Plan View shell and navigation: a new `PlanView` component with a sidebar, `PlanListPanel` (CRUD + inline rename/create), and a `PlanDetailPanel` placeholder. The `usePlanStore` is wired to `App.tsx` for hydration, and `Sidebar.tsx` gains a Plans toggle button.

The architecture is sound. The `selectedPlanId` in local state, the AlertDialog rendered outside ScrollArea, and the kebab `stopPropagation` pattern are all correct. Three issues were identified and have been fixed: a silent data-loss on fast creation (WR-01), unhandled rejections on every CRUD operation (WR-02), and an AlertDialog title that flashed empty during its exit animation (WR-03).

## Warnings

### WR-01: Silent `createPlan` failure when store is not yet hydrated ✓ fixed

**File:** `src/components/plans/PlanListPanel.tsx:150-157`

The "New Plan" button has no `plansLoaded` guard. On first app launch, `loadPlans()` is async — a user who clicks "New Plan" before it resolves will see the `InlineEditRow`, type a name, and press Enter. `createPlan()` checks `!get().plansLoaded`, returns `null`, and the row disappears. The plan is silently discarded with no error message or retry path.

The `isCreating` InlineEditRow render (line 192) also lacks a `plansLoaded` guard, so the row appears even when the store is not safe to write.

**Fix:**
```tsx
<Button
  variant="ghost"
  size="sm"
  className="gap-1"
  disabled={!plansLoaded}
  onClick={() => setIsCreating(true)}
>
  <Plus size={14} />New Plan
</Button>
```
And gate the create row:
```tsx
{plansLoaded && isCreating && (
  <InlineEditRow ... />
)}
```

---

### WR-02: Unhandled promise rejections on all CRUD operations ✓ fixed

**File:** `src/components/plans/PlanListPanel.tsx:176, 187, 199, 223`

All four store mutations are called with `void`, discarding the returned promise:

```ts
void renamePlan(plan.id, name);   // line 176
void duplicatePlan(plan.id)       // line 187
void createPlan(name);            // line 199
void deletePlan(id);              // line 223
```

The store's `persistPlans` helper can throw (network, disk, permissions). On failure the store correctly rolls back state — but since the rejection is swallowed, the user sees the UI revert with no explanation. This is a silent data-loss regression path: the store rolls back, the plan disappears, and the user does not know why.

**Fix:** Catch and surface errors for each mutation. Example for createPlan:
```tsx
onCommit={(name) => {
  setIsCreating(false);
  createPlan(name).catch((err) => {
    console.error("[PlanListPanel] createPlan failed:", err);
    // toast.error("Failed to save plan — please try again");
  });
}}
```
Apply the same `.catch` pattern to `renamePlan`, `duplicatePlan`, and `deletePlan`.

---

### WR-03: AlertDialog title flashes `Delete ""?` during exit animation ✓ fixed

**File:** `src/components/plans/PlanListPanel.tsx:219-226`

The `onClick` handler on the Delete confirm button calls `setPlanToDelete(null)` synchronously before the dialog can close naturally:

```tsx
onClick={() => {
  if (planToDelete) {
    const id = planToDelete.id;
    setPlanToDelete(null);   // ← clears planToDelete immediately
    void deletePlan(id);
    if (selectedPlanId === id) onSelectPlan(null);
  }
}}
```

Radix AlertDialog keeps the content in the DOM during its exit animation. After `setPlanToDelete(null)`, `open={!!planToDelete}` becomes `false`, triggering the exit animation — but the content re-renders with `planToDelete?.name === undefined`, causing the title to display `Delete ""?` for the duration of the animation.

**Fix:** Capture the name before clearing, or keep `planToDelete` alive until after `onOpenChange`:
```tsx
onClick={() => {
  if (planToDelete) {
    const id = planToDelete.id;
    const wasSelected = selectedPlanId === id;
    // Don't clear planToDelete here — let onOpenChange handle cleanup
    void deletePlan(id);
    if (wasSelected) onSelectPlan(null);
    // Close the dialog by letting AlertDialogAction default close behavior run,
    // then onOpenChange fires with open=false -> setPlanToDelete(null)
  }
}}
```
Remove the `setPlanToDelete(null)` from the onClick handler; `onOpenChange` already handles it on line 208.

## Info

### IN-01: `console.error` debug logging in production-shipped `ThemeBootstrap`

**File:** `src/App.tsx:30, 47`

`console.error` is used to log theme load/persist failures. Acceptable for a dev tool context, but in a production Tauri release these will appear in the webview console. Consider replacing with `tracing`-style structured logging or suppressing behind a `__DEV__` guard if the app ships with devtools disabled.

---

### IN-02: `navigator.userAgent` evaluated at module scope

**File:** `src/components/sidebar/Sidebar.tsx:21`

```ts
const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent);
```

This runs once when the module is first imported, not inside the component. In a Tauri app (no SSR) this is safe and the regex correctly covers Apple Silicon Macs (which still report `"Macintosh"` in their UA string). However, evaluation at module scope means it can never update if the UA changes (it won't in practice) and makes unit testing this module harder without a `jsdom` `navigator` mock. Moving the evaluation inside the component or a `useMemo` would be cleaner but is not urgent.

---

_Reviewed: 2026-05-23T19:23:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
