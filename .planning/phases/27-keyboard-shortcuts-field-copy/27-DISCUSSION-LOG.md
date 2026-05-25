# Phase 27: Keyboard Shortcuts + Field Copy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 27-keyboard-shortcuts-field-copy
**Areas discussed:** Shortcut inhibit scope, Copy field format, Clear + JSON mode interaction

---

## Shortcut Inhibit Scope

### Cmd+Shift+R (clear form)

| Option | Description | Selected |
|--------|-------------|----------|
| Inhibit in inputs | Blocked when `<input>`, `<textarea>`, or contenteditable has focus. `enableOnFormTags: false` (react-hotkeys-hook default) | ✓ |
| Fire everywhere | Fires globally like Cmd+Enter | |
| You decide | Claude picks | |

**User's choice:** Inhibit in inputs (Recommended)
**Notes:** Prevents accidental form clears while the user is filling out fields.

### Cmd+1/2/3 (tab navigation)

| Option | Description | Selected |
|--------|-------------|----------|
| Same — inhibit in inputs | Consistent with Cmd+Shift+R | ✓ |
| Fire everywhere | IDE-style, fires even while typing | |
| You decide | Claude picks | |

**User's choice:** Same — inhibit in inputs (Recommended)

---

## Copy Field Format

### Clipboard content format

| Option | Description | Selected |
|--------|-------------|----------|
| String representation, as-is | Copy value exactly as it appears in the input (int64 as string, bool as "true"/"false", enum as string name, bytes as base64) | ✓ |
| JSON-serialized | int64 as number (breaks for >53-bit), bool without quotes | |
| You decide | Claude picks | |

**User's choice:** String representation, as-is (Recommended)
**Notes:** Predictable, no int64 precision loss.

### Copy feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Brief icon swap (checkmark) | Copy icon flips to Check for ~1500ms then reverts. Silent, no toast. | ✓ |
| Sonner toast | "Field value copied" toast. Consistent with BLK-08 pattern. | |
| You decide | Claude picks | |

**User's choice:** Brief icon swap (checkmark) (Recommended)

### Copy icon visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hover-reveal only | Appears on cursor hover via Tailwind group-hover. Matches FRM-02 requirement. | ✓ |
| Always visible | Always shown, simpler implementation but clutters the form. | |

**User's choice:** Hover-reveal only (Recommended)

---

## Clear + JSON Mode Interaction

### What happens when Clear fires in JSON override mode

| Option | Description | Selected |
|--------|-------------|----------|
| Exit JSON mode and reset form to defaults | Exits JSON mode, resets all fields to buildDefaultValues(). Clean slate. | ✓ |
| Clear the JSON string to default JSON | Stay in JSON mode, replace CM content with default JSON. | |
| Refuse / warn while in JSON mode | Show warning: "Exit JSON mode first". | |

**User's choice:** Exit JSON mode and reset form to defaults (Recommended)
**Notes:** Mental model — Clear = start over, always. Discard JSON draft.

### Clear button location

| Option | Description | Selected |
|--------|-------------|----------|
| Form panel header, right side | Alongside JSON toggle and block library toggle. Small icon button with tooltip. | ✓ |
| Below message type selector | More prominent, breaks visual separation. | |
| You decide | Claude picks | |

**User's choice:** Form panel header, right side (Recommended)

---

## Claude's Discretion

- Icon swap duration: 1500ms
- Clear button icon: `RotateCcw` from lucide-react
- Platform label in tooltips: `⌘` on macOS, `Ctrl+` on Windows/Linux

## Deferred Ideas

- Customizable keyboard shortcuts — v1.9+
- Copy for complex fields (repeated, map, nested) — future polish
- Keyboard shortcut cheat sheet / help modal — future phase
