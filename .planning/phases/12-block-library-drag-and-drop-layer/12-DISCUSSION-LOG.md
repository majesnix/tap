# Phase 12: Block Library — Drag-and-Drop Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 12-block-library-drag-and-drop-layer
**Areas discussed:** DnD library, Empty field definition, Nested/map/repeated fields, Drop zone UX

---

## DnD Library

### Q1: Library choice

| Option | Description | Selected |
|--------|-------------|----------|
| Native HTML5 (no dep) | `draggable` + `onDragStart`/`onDrop`; no new dependency; adequate for one-way block→form drag | ✓ |
| @dnd-kit/core | Better keyboard accessibility, smoother overlays, better test support; +1 dep | |

**User's choice:** Native HTML5
**Notes:** No new dependency preferred. Block→form is a simple one-directional drag — native events are sufficient.

### Q2: Drag payload

| Option | Description | Selected |
|--------|-------------|----------|
| Block ID only | `dataTransfer.setData('blockId', block.id)`; drop handler looks up content from store | ✓ |
| Block JSON content directly | Serialize content at drag-start; drop handler parses without store lookup | |

**User's choice:** Block ID only
**Notes:** Fresh from the store on drop; avoids stale-content edge case.

---

## Empty Field Definition

### Q1: What counts as "empty"

| Option | Description | Selected |
|--------|-------------|----------|
| dirtyFields (RHF) | Field is fillable when `formState.dirtyFields[fieldName]` is falsy — tracks user interaction | ✓ |
| Compare to default | Field is fillable when current value equals `buildDefaultValues()` output | |

**User's choice:** dirtyFields
**Notes:** Tracks user intent, not semantic value. User who typed `0` has their intent respected.

### Q2: How to access form internals from drop handler

| Option | Description | Selected |
|--------|-------------|----------|
| applyBlockRef pattern | Extend existing `resetRef` with an `applyBlockRef`; ProtoFormRenderer wires it to a function that applies block values | ✓ |
| pendingBlockValues signal | Signal prop via Zustand store (like `pendingReplayValues`); more indirection | |

**User's choice:** applyBlockRef pattern
**Notes:** Consistent with existing `resetRef` precedent; keeps logic inside ProtoFormRenderer where form methods live.

---

## Nested/Map/Repeated Fields

### Q1: What happens to block keys matching nested/map/repeated fields

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level scalar/enum only; nested treated as absent (shown in toast) | Simple, no recursive merge; nested matches included in BLK-08 warning | ✓ |
| Top-level only, skip nested quietly | Same but nested/map/repeated silently ignored, no warning | |

**User's choice:** Top-level scalar/enum only; nested keys included in warning toast
**Notes:** Transparent behavior — user sees what was skipped and why.

### Q2: BLK-08 toast trigger and wording

| Option | Description | Selected |
|--------|-------------|----------|
| Any key with no matching fillable field → toast.warning() | Fires for truly absent keys AND nested/map/repeated matches; wording: "N field(s) from block not in form: [names]" | ✓ |
| Only truly absent keys | Dirty-blocked fields excluded from warning (they were intentionally protected) | |

**User's choice:** Any key with no matching fillable field
**Notes:** Dirty-blocked fields still excluded from the warning — that is intentional behavior. Only "no matching top-level scalar/enum field" triggers warning.

---

## Drop Zone UX

### Q1: Drop target placement

| Option | Description | Selected |
|--------|-------------|----------|
| FormPanel scroll area only | `<ScrollArea>` wrapping `ProtoFormRenderer`; excludes header, JSON editor | ✓ |
| Entire center column | Full FormPanel div including header | |

**User's choice:** FormPanel scroll area only
**Notes:** Tight, intentional target. JSON editor mode has no scroll area rendered, naturally excluded.

### Q2: Visual feedback during drag

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight border (ring-2 ring-primary/50) | Local `isDraggingOver` state; subtle ring on the scroll area | ✓ |
| Colored overlay | Semi-transparent overlay with "Drop to apply" text | |
| Cursor change only | `e.preventDefault()` in onDragOver; no border | |

**User's choice:** Highlight border
**Notes:** Informative without obscuring form fields.

### Q3: Block card drag hint

| Option | Description | Selected |
|--------|-------------|----------|
| cursor-grab on hover | CSS class; no extra icon; makes draggability discoverable | ✓ |
| GripVertical drag handle icon | Explicit icon; more visual noise in compact list | |

**User's choice:** cursor-grab on hover

---

## Claude's Discretion

- Error handling if `JSON.parse(block.content)` throws at apply time (silent no-op; Save already validated)
- Whether to suppress drag from editor view (naturally handled — editor view renders no block list items)
- DataTransfer mock strategy for unit tests

## Deferred Ideas

None — discussion stayed within phase scope.
