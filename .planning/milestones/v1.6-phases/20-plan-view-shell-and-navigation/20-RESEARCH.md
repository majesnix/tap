# Phase 20: Plan View Shell and Navigation - Research

**Researched:** 2026-05-23
**Domain:** React UI shell, Zustand local state, shadcn/ui DropdownMenu + AlertDialog
**Confidence:** HIGH

---

## Summary

Phase 20 is a pure React/UI phase. All persistence is delegated to `usePlanStore` (built in Phase 19). There are no Rust backend changes, no new IPC commands, and no new npm packages beyond the single missing shadcn component (`dropdown-menu`). The phase wires a `viewMode` state switch in `App.tsx`, adds a Plans nav button to the Sidebar, and builds three new components: `PlanView`, `PlanListPanel`, and `PlanDetailPanel`.

The two highest-value findings from this research are:
1. **Store hydration pattern deviation**: CONTEXT.md D-11 says `loadPlans()` is called "at App mount" — but the established codebase pattern is to hydrate stores inside consumer components, not in `App.tsx`. The planner must resolve this deviation explicitly.
2. **AlertDialog-from-DropdownMenu pattern**: The app already has a working reference implementation in `BlockLibraryPanel.tsx` — use controlled open state with AlertDialog rendered at component root level (not nested as `AlertDialogTrigger` inside the kebab row).

**Primary recommendation:** Follow the consumer-local hydration pattern (load plans inside `PlanListPanel`) unless D-11 is explicitly overriding it — the planner must clarify this before assigning tasks.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-pane layout: fixed-width plan list on the left, detail panel on the right. Phase 21 fills in the right pane without layout restructuring. Mirrors the Postman / Bruno pattern.
- **D-02:** Left pane is fixed width (no drag handle). Consistent with the app's existing sidebar-style fixed dimensions (~260–320px). Spec: `w-72` (288px).
- **D-03:** Right pane in Phase 20 shows empty state messages only. No plan selected → "Select a plan to view its steps". Plan selected (but no steps yet) → "No steps yet" (Phase 21 will replace this).
- **D-04:** Plan rows use a three-dot kebab (⋮) button, always visible (not hover-gated). Opens a shadcn `DropdownMenu` with: Rename / Duplicate / Delete.
- **D-05:** Delete triggers a shadcn `AlertDialog` confirmation: "Delete [plan name]? This cannot be undone." Two buttons: Confirm (destructive) / Cancel.
- **D-06:** No undo/toast-undo pattern — the confirmation dialog is the only safety net for delete.
- **D-07:** "New Plan" creates a plan via inline row input at the bottom of the list. A new row appears with an auto-focused text input pre-filled with `"Untitled Plan"` (all text selected). Enter commits; Escape cancels.
- **D-08:** Rename uses the same inline edit pattern: clicking Rename from the kebab menu replaces the plan name text in the row with an auto-focused input pre-filled with the current name. Enter commits; Escape discards.
- **D-09:** Empty-name guard: if the user clears the input and commits, treat it as Escape (discard/cancel) — do not persist a blank-named plan.
- **D-10:** `viewMode: "main" | "plans"` is local React state in `App.tsx`. The Plans nav button receives `onViewChange` as a prop (prop-drilled from `App.tsx` through `AppLayout` to `Sidebar`). Do NOT add viewMode to any Zustand store.
- **D-11:** `usePlanStore.loadPlans()` is called at `App` mount (alongside other store loads), not on view switch.
- **D-12:** `selectedPlanId: string | null` is local React state in `PlanView` (not in `usePlanStore`). Clicking a plan row sets the selected plan ID.
- **D-13:** When the currently selected plan is deleted, `selectedPlanId` resets to `null`.

### Claude's Discretion

No areas of explicit discretion — all implementation choices are locked via D-01 through D-13 and the UI-SPEC.

### Deferred Ideas (OUT OF SCOPE)

- Resizable left/right pane split
- Undo-via-toast for delete
- `selectedPlanId` in a store
- Step display in the right pane (Phase 21)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-06 | User accesses the plan library via a dedicated full-screen view (separate from the main form + tabs layout) | `viewMode` state switch in `App.tsx` with conditional render between `<AppLayout />` and `<PlanView />` — confirmed pattern is local `useState`, no routing |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| View mode switching (main/plans) | React / Client State | — | `useState` in `App.tsx`, no backend involvement |
| Plan list display | React / Client State | Zustand (usePlanStore) | UI reads from store already hydrated |
| Plan CRUD (create/rename/delete/duplicate) | Zustand (usePlanStore) | tauri-plugin-store (persistence) | All CRUD already implemented in Phase 19 store |
| Inline edit flow | React / Client State | — | Controlled `<input>` with local edit-mode flags |
| Delete confirmation | React / Client State | — | Controlled AlertDialog open state, local to PlanListPanel |
| Empty state rendering | React / Client State | — | Pure conditional render based on `selectedPlanId` |
| Store hydration | React / Client State | — | Determined by hydration pattern resolution (see Pitfall 1) |

All capabilities are purely frontend. No new Rust commands, no new IPC, no network calls.

---

## Standard Stack

### Core (all already installed — no new npm packages except dropdown-menu)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 19.1.0 | UI framework | Installed [VERIFIED: package.json] |
| Zustand | 5.0.13 | Plan store (usePlanStore) | Installed [VERIFIED: package.json] |
| shadcn/ui | 4.8.0 | UI component system | Installed [VERIFIED: package.json] |
| Tailwind CSS | 4.3.0 | Utility CSS | Installed [VERIFIED: package.json] |
| lucide-react | (peer) | Icons (ListChecks, ClipboardList, MoreVertical, Plus) | Installed [VERIFIED: components.json] |

### New Component to Install

| Component | Install Command | Status |
|-----------|----------------|--------|
| `dropdown-menu` | `npx shadcn@latest add dropdown-menu` | MISSING [VERIFIED: ls src/components/ui/dropdown-menu.tsx → not found] |

`alert-dialog` — already present at `src/components/ui/alert-dialog.tsx` [VERIFIED: codebase]
`scroll-area` — already present at `src/components/ui/scroll-area.tsx` [VERIFIED: codebase]
`button` — already present [VERIFIED: codebase]

---

## Architecture Patterns

### System Architecture Diagram

```
App.tsx
  ├── viewMode: "main" | "plans"  (useState — D-10)
  ├── loadPlans() useEffect        (D-11 — see Pitfall 1 on hydration location)
  │
  ├── viewMode === "main"  → <AppLayout />    (unchanged)
  │
  └── viewMode === "plans" → <PlanView onViewChange={setViewMode}>
          │
          ├── selectedPlanId: string | null  (useState — D-12)
          │
          ├── <PlanListPanel>          (w-72, border-r)
          │     ├── plans from usePlanStore (reactive subscription)
          │     ├── "New Plan" CTA → inline create row (controlled input)
          │     ├── plan rows → on click: setSelectedPlanId
          │     ├── kebab DropdownMenu → Rename / Duplicate / Delete
          │     ├── inline rename input (replaces name span in-row)
          │     └── AlertDialog (controlled open state, rendered at panel root)
          │
          └── <PlanDetailPanel selectedPlan={plan | null}>  (flex-1)
                ├── no plan selected → empty state A
                └── plan selected, no steps → empty state B
```

### Recommended Project Structure

```
src/components/plans/          ← new directory
  PlanView.tsx                 ← two-pane root, owns selectedPlanId
  PlanListPanel.tsx            ← left pane: list + CRUD + AlertDialog
  PlanDetailPanel.tsx          ← right pane: empty states only (Phase 20)
```

### Pattern 1: DropdownMenu API (shadcn/ui)

The `dropdown-menu` component follows standard shadcn composition:

```tsx
// Source: Context7 /shadcn-ui/ui — verified current API
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon-sm" aria-label="Plan options">
      <MoreVertical />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onSelect={() => startRename(plan.id)}>Rename</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => handleDuplicate(plan.id)}>Duplicate</DropdownMenuItem>
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPlanToDelete(plan); }}>
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Key:** The Delete item uses `onSelect={(e) => e.preventDefault()}` to prevent the menu from closing before the AlertDialog state is set. [VERIFIED: shadcn/ui docs pattern; codebase analog in BlockLibraryPanel]

### Pattern 2: AlertDialog with Controlled State (codebase-verified pattern)

`BlockLibraryPanel.tsx` (lines 247–278) is the authoritative reference implementation for this exact use case — AlertDialog triggered from a button in a list row, with controlled open state:

```tsx
// Source: src/components/blocks/BlockLibraryPanel.tsx lines 247-278 [VERIFIED: codebase]
// Pattern: controlled state + AlertDialog rendered at component root, NOT inside the row

const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

// In the kebab item onSelect:
onSelect={(e) => { e.preventDefault(); setPlanToDelete(plan); }}

// At component root level (outside the plan list / ScrollArea):
<AlertDialog
  open={!!planToDelete}
  onOpenChange={(open) => { if (!open) setPlanToDelete(null); }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete &quot;{planToDelete?.name}&quot;?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep plan</AlertDialogCancel>
      <AlertDialogAction
        variant="destructive"
        onClick={() => {
          if (planToDelete) {
            const id = planToDelete.id;
            setPlanToDelete(null);
            void usePlanStore.getState().deletePlan(id);
            if (selectedPlanId === id) setSelectedPlanId(null); // D-13
          }
        }}
      >
        Delete plan
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

`AlertDialogAction` accepts `variant="destructive"` because `alert-dialog.tsx` wraps it in a `Button` and forwards the `variant` prop. [VERIFIED: src/components/ui/alert-dialog.tsx lines 148–164, src/components/ui/button.tsx]

### Pattern 3: Inline Edit (no codebase precedent — new pattern)

The inline create and rename flows use a controlled `<input>` with `autoFocus`. The critical pitfall is that Escape must suppress the subsequent `onBlur` commit:

```tsx
// Standard pattern for Escape-safe inline edit
const cancellingRef = useRef(false);

function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    const trimmed = e.currentTarget.value.trim();
    if (trimmed) commitEdit(trimmed);     // non-empty: commit
    else cancelEdit();                    // D-09: empty = cancel
  }
  if (e.key === "Escape") {
    cancellingRef.current = true;         // flag before blur fires
    cancelEdit();
    e.currentTarget.blur();              // triggers onBlur but flag suppresses commit
  }
}

function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
  if (cancellingRef.current) {
    cancellingRef.current = false;
    return;                               // Escape already handled — don't commit
  }
  const trimmed = e.currentTarget.value.trim();
  if (trimmed) commitEdit(trimmed);      // blur = commit (non-empty)
  else cancelEdit();                     // D-09: empty = cancel
}

// For select-all on mount (pre-fill + all text selected per D-07/D-08):
<input
  ref={inputRef}
  type="text"
  autoFocus
  defaultValue="Untitled Plan"
  aria-label="Plan name"
  onKeyDown={handleKeyDown}
  onBlur={handleBlur}
/>
// In useEffect after mount:
useEffect(() => { inputRef.current?.select(); }, []);
```

[ASSUMED] — This is the standard pattern for Escape-safe inline editing; no prior inline-edit component exists in this codebase to verify against.

### Pattern 4: Kebab button click does not propagate to row

The row has `onClick={() => setSelectedPlanId(plan.id)}`. The kebab `<Button>` must not bubble this click to the row. The `DropdownMenuTrigger` wraps the button, and since it's a child of the row, it needs `stopPropagation`:

```tsx
<div onClick={() => setSelectedPlanId(plan.id)} className="...cursor-pointer">
  <span className="...truncate flex-1">{plan.name}</span>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Plan options"
        onClick={(e) => e.stopPropagation()}  // prevent row selection on kebab click
      >
        <MoreVertical />
      </Button>
    </DropdownMenuTrigger>
    ...
  </DropdownMenu>
</div>
```

[ASSUMED] — Standard React event propagation pattern; verified by reasoning from codebase DOM structure.

### Pattern 5: Store hydration (existing consumer-local pattern)

Existing codebase hydrates stores inside consumer components, not App.tsx:

```tsx
// MessageHistoryPanel.tsx lines 21-23 [VERIFIED: codebase]
useEffect(() => {
  if (!historyLoaded) { void loadHistory(); }
}, [historyLoaded, loadHistory]);

// BlockLibraryPanel.tsx lines 83-87 [VERIFIED: codebase]
useEffect(() => {
  if (!blocksLoaded) { void loadBlocks(); }
}, [blocksLoaded, loadBlocks]);
```

D-11 says to call `loadPlans()` at App mount. This deviates from the established pattern. See Pitfall 1.

### Anti-Patterns to Avoid

- **AlertDialogTrigger nested in DropdownMenuItem**: Causes mount/unmount race — the menu unmounts before the dialog opens. Use controlled open state instead (Pattern 2).
- **`viewMode` in Zustand store**: Locked by D-10. It's local `useState` in `App.tsx` only.
- **`selectedPlanId` in `usePlanStore`**: Locked by D-12. Local state in `PlanView`.
- **`tokio::spawn` or any Rust changes**: Phase 20 is frontend-only — no Rust modifications.
- **Blur commit without cancel-flag**: Calling commit in onBlur when Escape was pressed creates a double-action. Use `cancellingRef` pattern (Pattern 3).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal confirmation dialog | Custom modal overlay | `AlertDialog` from `shadcn/ui` | Focus trap, a11y, animation, keyboard dismiss are all handled by Radix |
| Kebab action menu | `<div>` with visibility toggle | `DropdownMenu` from `shadcn/ui` | Radix handles portal, positioning, keyboard nav, close-on-outside-click |
| Scrollable plan list | Custom `overflow-y-auto` div | `ScrollArea` (already installed) | Consistent scrollbar styling across platforms |

---

## Common Pitfalls

### Pitfall 1: loadPlans() hydration location — D-11 vs established pattern

**What goes wrong:** D-11 says call `loadPlans()` at App mount. The existing stores (`loadBlocks`, `loadHistory`) are hydrated inside their consumer components (not `App.tsx`). If the planner assigns `loadPlans()` to `App.tsx` without updating the existing `ThemeBootstrap`/`App` pattern, it requires threaded state from the store into App before PlanView is mounted.

**Why it happens:** D-11 is an intentional decision (data is immediately available on view switch) but contradicts the codebase convention.

**How to avoid:** The planner must make an explicit choice:
- **Option A (follow D-11 literally):** Add `loadPlans()` useEffect to `App.tsx`. Plans are pre-loaded regardless of whether the user visits the Plans view.
- **Option B (follow codebase convention):** Call `loadPlans()` inside `PlanListPanel` with the same `if (!plansLoaded) void loadPlans()` guard. Plans load on first visit to PlanView, not at app startup.

Option A matches D-11. Option B is safer (no behavior change to `App.tsx`). Both are correct — `plansLoaded` gates all CRUD operations anyway. **The planner must pick one and state it explicitly.**

**Warning signs:** If this isn't resolved, two tasks may independently add `loadPlans()` in different files, causing double hydration (no harm due to `plansLoaded` guard, but confusing).

### Pitfall 2: Escape → blur double-commit on inline edit

**What goes wrong:** User presses Escape to cancel an inline rename. The input fires `onBlur` after `e.currentTarget.blur()`, which then commits the edit instead of discarding it.

**Why it happens:** Escape → `cancelEdit()` → `blur()` → `onBlur` fires → `commitEdit()` is called again.

**How to avoid:** Use a `cancellingRef = useRef(false)` flag. Set it to `true` before calling `blur()` on Escape. Check and reset it at the start of `onBlur`. (Pattern 3 above.)

**Warning signs:** Rename that appears to cancel but then persists the old name; or create that cancels but creates a plan with the pre-filled value anyway.

### Pitfall 3: AlertDialog nested inside DropdownMenuItem (mount race)

**What goes wrong:** If `AlertDialogTrigger` is placed as a child of `DropdownMenuItem`, the menu unmounts when an item is selected. The dialog's trigger is in the unmounted menu tree — the dialog never opens.

**Why it happens:** Radix DropdownMenu closes (unmounts content) on item `onSelect`. The AlertDialog portal tries to open, but its trigger is already gone.

**How to avoid:** Never use `AlertDialogTrigger` inside a `DropdownMenuItem`. Instead, set a piece of state (`planToDelete`) in the `onSelect` handler (with `e.preventDefault()`), and render `<AlertDialog open={!!planToDelete}>` at the component's root level, outside the list entirely. This is exactly how `BlockLibraryPanel.tsx` does it. [VERIFIED: codebase]

**Warning signs:** Clicking Delete opens nothing; or dialog flashes and disappears immediately.

### Pitfall 4: Kebab click triggers row selection

**What goes wrong:** Clicking the `⋮` button opens the DropdownMenu but also fires the row's `onClick`, changing `selectedPlanId` to the clicked plan.

**Why it happens:** `DropdownMenuTrigger` is a child of the row div. Click events bubble up to the row's `onClick` handler.

**How to avoid:** Add `onClick={(e) => e.stopPropagation()}` to the `<Button>` inside `DropdownMenuTrigger`. (Pattern 4 above.) Alternatively, only apply row selection to the name span, not the full row div.

### Pitfall 5: plansLoaded gate renders loading flicker

**What goes wrong:** `PlanListPanel` renders before `plansLoaded` is true, showing an empty list briefly even if plans exist.

**Why it happens:** `loadPlans()` is async; store starts with `plans: []`.

**How to avoid:** Render the list only when `plansLoaded` is true. During loading show nothing or a subtle skeleton. Since the store uses `plansLoaded` as a hydration gate, check it before showing the plan list (same pattern as `BlockLibraryPanel` line 228: `{blocksLoaded && blocks.length === 0 && ...}`).

---

### Pitfall 6: Radix portal components incompatible with jsdom in tests

**What goes wrong:** If the planner adds Vitest tests for `PlanListPanel`, the `DropdownMenu` (and by extension any Radix portal component) will not render correctly in jsdom — pointer events and portal mounting fail silently.

**Why it happens:** This is a known codebase pattern. `STATE.md` records: *"Mocked shadcn Select with native `<select>` in tests — Radix UI portal/pointer events incompatible with jsdom"*. The same applies to `DropdownMenu`.

**How to avoid:** Since `nyquist_validation: false`, testing is optional. If tests are written for `PlanListPanel`, mock the `DropdownMenu` component with a simple `<div>` or `<button>` at the test boundary, consistent with the mocking approach already used for `Select` in the existing test suite. Do not attempt to test Radix portal behavior in jsdom.

---

## Code Examples


### PlanView root structure

```tsx
// src/components/plans/PlanView.tsx
import { useState } from "react";
import { usePlanStore } from "@/stores/usePlanStore";
import { PlanListPanel } from "./PlanListPanel";
import { PlanDetailPanel } from "./PlanDetailPanel";

interface PlanViewProps {
  onViewChange: (mode: "main" | "plans") => void;
}

export function PlanView({ onViewChange }: PlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const plans = usePlanStore((s) => s.plans);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="w-72 min-w-60 border-r border-border flex flex-col shrink-0">
        {/* Sidebar — unchanged, receives viewMode + onViewChange */}
      </aside>
      <div className="flex flex-1 min-w-0">
        <PlanListPanel
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
        />
        <PlanDetailPanel selectedPlan={selectedPlan} />
      </div>
    </div>
  );
}
```

### App.tsx modification points

```tsx
// 1. Add viewMode state
const [viewMode, setViewMode] = useState<"main" | "plans">("main");

// 2. Add loadPlans effect (if D-11 Option A chosen)
const { loadPlans } = usePlanStore.getState();
useEffect(() => { void loadPlans(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

// 3. Conditional render
{viewMode === "main"
  ? <AppLayout viewMode={viewMode} onViewChange={setViewMode} />
  : <PlanView onViewChange={setViewMode} />
}
```

Note: `AppLayout` needs `viewMode` + `onViewChange` threaded through to `Sidebar` for the Plans nav button.

### Sidebar Plans nav button

```tsx
// src/components/sidebar/Sidebar.tsx
import { ListChecks } from "lucide-react";

// Props addition:
interface SidebarProps {
  viewMode: "main" | "plans";
  onViewChange: (mode: "main" | "plans") => void;
}

// In JSX (placement: after the app title/description block, before FileSection separator):
<Button
  variant="ghost"
  className={cn("w-full justify-start gap-2", viewMode === "plans" && "bg-accent text-accent-foreground")}
  onClick={() => onViewChange("plans")}
>
  <ListChecks />
  Plans
</Button>
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cancellingRef` pattern prevents Escape → blur double-commit | Pattern 3, Pitfall 2 | Inline edit commits on Escape instead of canceling; poor UX but not data-destroying |
| A2 | `onClick={(e) => e.stopPropagation()}` on kebab Button prevents row selection | Pattern 4, Pitfall 4 | Kebab click always selects the plan; functional but unintended |

**All other claims are VERIFIED against the codebase or CITED from CONTEXT.md / UI-SPEC.md.**

---

## Open Questions (RESOLVED)

1. **loadPlans() hydration location (D-11 vs convention)**
   - What we know: D-11 says App mount; existing stores hydrate in consumers; both work correctly due to `plansLoaded` guard
   - What's unclear: Should Plan 20 establish a new App-level hydration convention, or follow the consumer-local pattern?
   - RESOLVED: Option A chosen — `loadPlans()` is called in `App.tsx` `useEffect` at mount (per D-11). PlanListPanel does not call `loadPlans()`. Plan 02 implements this.

2. **Sidebar prop threading scope**
   - What we know: `AppLayout` currently renders `<Sidebar />` with no props. `Sidebar` currently accepts no props.
   - What's unclear: Does `AppLayout` receive `viewMode`/`onViewChange` and pass them to `Sidebar`, or does `App.tsx` render `<Sidebar>` separately?
   - RESOLVED: `AppLayout` receives `viewMode` + `onViewChange` as props and passes them to `Sidebar` (D-10 prop-drill path). Implemented in Plan 02.

3. **Sidebar rendering in PlanView (which layout hosts Sidebar?)**
   - What we know: `PlanView` replaces `AppLayout` entirely when `viewMode === "plans"`. `AppLayout` currently owns `<Sidebar />`. The `PlanView` code example shows Sidebar as a placeholder comment.
   - What's unclear: Does `PlanView` render `<Sidebar viewMode="plans" onViewChange={onViewChange} />` directly? Or does `App.tsx` restructure to render `<Sidebar>` at the top level so only the content area swaps?
   - RESOLVED: `PlanView` renders `<Sidebar viewMode="plans" onViewChange={onViewChange} />` directly. `AppLayout` is not restructured. Implemented in Plan 01 (PlanView.tsx).

4. **Success criterion 3: "preserves plan list state" vs selectedPlanId reset**
   - What we know: Success criterion 3 says navigating back and returning "preserves plan list state". `selectedPlanId` is local state in `PlanView` (D-12), which means it resets to `null` on every view switch.
   - What's unclear: A verifier could read criterion 3 as requiring selectedPlanId to persist across view switches — contradicting D-12.
   - RESOLVED: "Preserves plan list state" refers to the Zustand `plans` array (always live in the store singleton) — not `selectedPlanId`. The selection reset on `PlanView` unmount is intentional per D-12 and is correct behavior. Verifiers should not flag this as a regression.

---

## Environment Availability

SKIPPED — Phase 20 is purely React/TypeScript frontend work. No external CLIs, services, databases, or runtimes beyond the existing project dev toolchain (Node 20, npm, Vite) are required.

---

## Validation Architecture

SKIPPED — `workflow.nyquist_validation: false` in `.planning/config.json`.

---

## Security Domain

Phase 20 adds no authentication, session management, cryptography, or server-side input validation. All data is local (Zustand + tauri-plugin-store). ASVS categories V2, V3, V4, V6 do not apply. V5 (input validation) is covered by the empty-name guard (D-09) in the inline edit handler — this is a UX guard, not a security boundary. No further security research needed.

---

## Sources

### Primary (HIGH confidence)
- `src/stores/usePlanStore.ts` — Full CRUD store API verified; `plansLoaded`, `createPlan`, `renamePlan`, `deletePlan`, `duplicatePlan` [VERIFIED: codebase]
- `src/components/blocks/BlockLibraryPanel.tsx` — AlertDialog controlled-state pattern, store hydration convention, panel header CSS (`px-4 py-3`), `icon-sm` button size, `ScrollArea` usage [VERIFIED: codebase]
- `src/components/layout/AppLayout.tsx` — Current `<Sidebar />` render with no props; `DndContext` scope [VERIFIED: codebase]
- `src/App.tsx` — Current `App` function with no `viewMode` state; `ThemeBootstrap` + `UpdateChecker` sibling pattern [VERIFIED: codebase]
- `src/components/sidebar/Sidebar.tsx` — Current sidebar with no external props; `Button`, `Separator` patterns [VERIFIED: codebase]
- `src/components/ui/alert-dialog.tsx` — `AlertDialogAction` accepts `variant` prop forwarded to `Button` [VERIFIED: codebase]
- `src/components/ui/button.tsx` — `destructive` variant exists; `icon-sm` size exists [VERIFIED: codebase]
- `.planning/phases/20-plan-view-shell-and-navigation/20-CONTEXT.md` — All locked decisions D-01 through D-13 [CITED]
- `.planning/phases/20-plan-view-shell-and-navigation/20-UI-SPEC.md` — Full visual/interaction contract [CITED]
- Context7 `/shadcn-ui/ui` — DropdownMenu component API (DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, `onSelect`) [VERIFIED: Context7]
- `package.json` — React 19.1.0, Zustand 5.0.13, Tailwind 4.3.0, shadcn 4.8.0 [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- shadcn/ui GitHub issue #2497 — AlertDialog-from-DropdownMenu pattern; `onSelect e.preventDefault()` as standard fix [cited from WebSearch; cross-verified against codebase BlockLibraryPanel implementation]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from package.json; dropdown-menu absence confirmed by filesystem check
- Architecture patterns: HIGH — AlertDialog controlled-state pattern and hydration convention verified directly from existing codebase files
- Pitfalls: HIGH (1, 3, 4, 5 verified from codebase); MEDIUM (2 inline-edit Escape/blur — reasoned from React event model, no prior inline-edit component in this codebase)

**Research date:** 2026-05-23
**Valid until:** 2026-07-23 (stable React/Zustand/shadcn APIs)
