# Phase 21: Step Editor (Authoring) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 21-Step Editor (Authoring)
**Areas discussed:** Step list + editor layout, StepFieldEditor composition, History import: proto path gap, DnD sortable approach

---

## Step list + editor layout

| Option | Description | Selected |
|--------|-------------|----------|
| Split pane | Step list on the left portion of the panel, clicking a step loads its editor on the right. Similar to Postman/Bruno. | ✓ |
| Accordion rows | Each step row expands inline to reveal its form editor. | |
| Full-pane editor | Click a step → full-pane edit; back button returns to list. | |

**User's choice:** Split pane

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed narrow list (~240px) | Step name + drag handle + kebab ⋮ menu. | |
| Fixed wider list (~320px) | Wider with proto file name + target summary per row. | |
| You decide | Claude picks width and row content. | ✓ |

**User's choice:** You decide (Claude chose ~240px, step name + GripVertical + kebab)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Button at top/bottom of step list | Single persistent "+" button in step list header/footer. | ✓ |
| Button in right-pane empty state | CTA in the "No steps yet" state only. | |
| Both | Empty state CTA + persistent list button. | |

**User's choice:** Button at top/bottom of step list — opens DropdownMenu with Blank step / From history / From block library

---

## StepFieldEditor composition

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap field components, not ProtoFormRenderer | Uses ScalarField, EnumField etc. with isolated react-hook-form state. ProtoFormRenderer not reused. | ✓ |
| Refactor ProtoFormRenderer to accept external state | Add a "controlled mode" prop to ProtoFormRenderer. | |
| You decide | Claude picks isolation approach. | |

**User's choice:** Wrap field components — isolated form state, ProtoFormRenderer NOT reused

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scrollable sections with headers | One scroll: proto selector → fields → target → response mode. Dividers between sections. | |
| Tabs: Fields \| Config | Two tabs. | |
| You decide | Claude picks. | ✓ |

**User's choice:** You decide (Claude chose scrollable sections with dividers — dev tool users benefit from seeing all at once)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save on every change | form.watch debounced ~300ms, persists to usePlanStore. No Save button. | ✓ |
| Explicit Save button | Changes held in local state until Save clicked. | |

**User's choice:** Auto-save on every change

---

## History import: proto path gap

| Option | Description | Selected |
|--------|-------------|----------|
| Add protoPath to HistoryEntry now | Update PublishBar appendEntry calls. Old entries fall back to auto-match. | ✓ |
| Auto-match from currently open files | Scan openFiles by messageTypeName at import time. | |
| Two-step picker | Pick history entry, then pick proto file. | |

**User's choice:** Add protoPath to HistoryEntry now

---

| Option | Description | Selected |
|--------|-------------|----------|
| Button in step list area | Separate "From History" button alongside "+ Add Step". | |
| Import options in Add Step dropdown | "+ Add Step" opens dropdown: Blank / From history / From block library. | ✓ |
| You decide | Claude picks placement. | |

**User's choice:** Import options in dropdown under single "+" button

---

## DnD sortable approach

| Option | Description | Selected |
|--------|-------------|----------|
| Install @dnd-kit/sortable | Official companion package. useSortable, SortableContext, arrayMove. | ✓ |
| Hand-roll with @dnd-kit/core only | Manual useDraggable + useDroppable + custom arrayMove. | |

**User's choice:** Install @dnd-kit/sortable

---

| Option | Description | Selected |
|--------|-------------|----------|
| Persist immediately on drop | Same auto-save pattern as field edits. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Persist immediately on drop

---

## Claude's Discretion

- Step list width: ~240px fixed (consistent with Phase 20 plan list proportions)
- Step form layout: scrollable sections with visual dividers (no tabs)
- "+" button placement: footer of step list column
- Response mode default for new steps: `{ mode: 'no-wait', delay_ms: 200 }`

## Deferred Ideas

- Step-level JSON override toggle (like main form's JSON editor mode) — post-v1.6
- Step reorder via keyboard (up/down shortcuts) — accessibility improvement, post-v1.6
- Block import auto-filling proto path — not feasible in v1 (blocks don't store proto path)
- Response mode default per plan (not per step) — Phase 22 concern if needed
