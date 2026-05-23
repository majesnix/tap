# Phase 20: Plan View Shell and Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 20-Plan View Shell and Navigation
**Areas discussed:** PlanView layout shape, CRUD interaction style, Create & rename flow

---

## PlanView Layout Shape

**Q: What should Phase 20's PlanView look like structurally?**

| Option | Description | Selected |
|--------|-------------|----------|
| Two-pane: list left + detail right | Plan list on the left, empty/placeholder detail panel on the right. Phase 21 fills in the right pane without restructuring. | ✓ |
| Single panel: list only | Just the plan list fills the full-screen view. Phase 21 adds the right pane at that point. | |

**User's choice:** Two-pane layout
**Notes:** Prevents Phase 21 from needing to restructure the view layout.

---

**Q: What does the right pane show in Phase 20?**

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state message | "Select a plan to view its steps" / "No steps yet" | ✓ |
| Structural placeholder only | Just styled divs, no user-visible content | |

**User's choice:** Empty state message
**Notes:** Friendly placeholder, no component scaffolding needed.

---

**Q: Should the left pane be fixed width or resizable?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed width | ~260–320px, consistent with existing sidebar pattern | ✓ |
| Resizable with drag handle | User-adjustable split, more complexity | |

**User's choice:** Fixed width

---

## CRUD Interaction Style

**Q: How should rename / duplicate / delete be triggered on a plan row?**

| Option | Description | Selected |
|--------|-------------|----------|
| Three-dot kebab button | Always-visible ⋮ button, opens DropdownMenu | ✓ |
| Context menu (right-click) | Custom implementation needed for Tauri | |
| Inline action buttons | Edit / Duplicate / Delete icons always visible, clutters row | |

**User's choice:** Three-dot kebab (⋮) — always visible

---

**Q: When is the kebab button visible?**

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | No hover state tracking, better for keyboard navigation | ✓ |
| Show on hover only | Cleaner visual, more complex | |

**User's choice:** Always visible

---

**Q: What happens after clicking Delete?**

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation dialog | shadcn AlertDialog: "Delete [name]? This cannot be undone." | ✓ |
| Inline undo toast | Immediate delete with 5s Undo toast | |

**User's choice:** Confirmation dialog (AlertDialog)
**Notes:** Roadmap explicitly requires a confirmation dialog for delete.

---

## Create & Rename Flow

**Q: When the user clicks "New Plan," how does the name get entered?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline row input | New row at bottom of list, auto-focused input, Enter commits, Escape cancels | ✓ |
| Dialog / popover | Modal with text input and Create / Cancel buttons | |

**User's choice:** Inline row input

---

**Q: How does Rename work?**

| Option | Description | Selected |
|--------|-------------|----------|
| Same inline edit pattern | Name text replaced with auto-focused input in the row | ✓ |
| Dialog / popover for rename | Separate dialog, consistent with delete confirmation | |

**User's choice:** Same inline edit pattern (consistent with create)

---

**Q: What is the default name for a new plan?**

| Option | Description | Selected |
|--------|-------------|----------|
| "Untitled Plan" (pre-selected) | Input pre-filled and all-selected, ready to overwrite | ✓ |
| Empty input | User must type from scratch; needs blank-name validation | |
| You decide | Defer to planner | |

**User's choice:** "Untitled Plan" (all text selected)

---

## Claude's Discretion

None — all areas had explicit user choices.

## Deferred Ideas

- Resizable left/right pane split (deemed overkill for v1)
- Undo-via-toast for delete (confirmation dialog is sufficient)
