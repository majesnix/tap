# Phase 11: Block Library — Store, Editor, Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 11-block-library-store-editor-persistence
**Areas discussed:** Panel placement, Block editor workflow, Delete confirmation UI

---

## Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Left of form, inside `<main>` | Panel slides into center column on the left side; FormPanel shrinks to fill remaining space. AppLayout gains a conditional `<aside>` inside `<main>`. | ✓ |
| Right of form, inside `<main>` | Panel appears to the right of FormPanel, between the form and RightPanel separator. | |
| Overlay (Sheet/Drawer) | A Sheet slides over the form from left or right. Form stays full-width; panel overlays it. | |

**User's choice:** Left of form, inside `<main>` (Recommended)
**Notes:** 256px fixed width (`w-64`). Toggle button placed on right side of FormPanel header, beside existing JSON (Braces) toggle button.

---

## Panel Width

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 256px | Same as w-64 sidebar class. Symmetrical and leaves form enough room. | ✓ |
| Fixed 288px | Matches left sidebar (w-72). Slightly wider. | |
| Fixed 320px | Matches RightPanel. Widest, compresses form most. | |

**User's choice:** Fixed 256px (Recommended)

---

## Toggle Button Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Right side, beside existing JSON toggle | Two icon buttons on the right: [Blocks][Braces]. | ✓ |
| Left side of the header | Toggle on the left, before message type name. | |
| You decide | Claude picks based on fit. | |

**User's choice:** Right side, beside the existing JSON toggle (Recommended)

---

## Block Editor Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Two-view panel: list view → editor view | Panel has list view (all blocks + create button) and editor view (name + CodeMirror). Click to switch; Back returns to list. | ✓ |
| Dialog/modal editor | Block list visible in panel; clicking opens a shadcn Dialog with name + editor. | |
| Sheet/Drawer editor | Clicking opens a Sheet from the right that slides over everything. | |

**User's choice:** Two-view panel (Recommended)
**Notes:** No modal needed — everything stays in the panel column.

---

## New Block Initial Content

| Option | Description | Selected |
|--------|-------------|----------|
| Empty object: `{}` | User always starts fresh. Blocks are general-purpose. | ✓ |
| Pre-filled from current form values | Seeds editor with current `latestValues`. Quick capture. | |
| Completely empty (blank string) | Fully empty editor. | |

**User's choice:** Empty object `{}` (Recommended)

---

## Save/Apply Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Save button | Save button writes to store + persists. Cancel discards. Consistent with AmqpPropertiesSheet pattern. | ✓ |
| Auto-save on every keystroke | Changes persist immediately. Risk: partial/invalid JSON saved mid-edit. | |
| Auto-save on valid JSON only | Saves whenever parseable as valid JSON. | |

**User's choice:** Explicit Save button (Recommended)

---

## Delete Confirmation UI

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn AlertDialog (modal) | Standard destructive action pattern. Title + description + Cancel + Delete. | ✓ |
| Inline confirm row | Delete press replaces block item with inline confirm row. No modal. | |
| Popover | Small popover anchored to delete button. | |

**User's choice:** shadcn AlertDialog (modal) (Recommended)

---

## Claude's Discretion

None — user selected all options explicitly.

## Deferred Ideas

None — discussion stayed within phase scope.
