# Phase 8: JSON Override Toggle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 08-json-override-toggle
**Areas discussed:** Mode state ownership, Fix JSON / Discard UX, Unknown fields warning (JSON-05), JSON snapshot format for special fields

---

## Mode State Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| FormPanel owns isJsonMode | Toggle in FormPanel header, conditionally renders ProtoFormRenderer vs JsonEditor. Uses latestValues from Zustand + resetRef already in place. Zero ProtoFormRenderer changes. | ✓ |
| ProtoFormRenderer owns isJsonMode | Self-contained: ProtoFormRenderer renders both the toggle button and the editor. Keeps form logic together but expands the frozen dispatch layer. | |

**User's choice:** FormPanel owns isJsonMode

| Option | Description | Selected |
|--------|-------------|----------|
| Unmount ProtoFormRenderer in JSON mode | In JSON mode: FormPanel renders only JsonEditor. Switching back: call resetRef.current(parsedValues) via reset(). Consistent with the existing replay pattern. Simpler DOM. | ✓ |
| Keep mounted but hidden (CSS hidden) | ProtoFormRenderer stays alive in DOM, hidden with display:none. Form state preserved without reset() on switch-back. More complex conditional rendering. | |

**User's choice:** Unmount ProtoFormRenderer — use resetRef.current(parsedValues) to rebuild on switch-back

---

## Fix JSON / Discard UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error banner | Error strip below CodeMirror editor with parse error message + "Fix JSON" (stay in JSON mode) and "Discard changes" (switch to form with Zustand latestValues) buttons. | ✓ |
| AlertDialog modal | Clicking the toggle triggers AlertDialog with error and two choices. More prominent, but user can't see the JSON editor while dialog is open. | |

**User's choice:** Inline error banner below the editor

| Option | Description | Selected |
|--------|-------------|----------|
| Revert to form with last known values | Switch back to form using latestValues from Zustand — values captured when user entered JSON mode. Invalid JSON abandoned, form restored exactly. | ✓ |
| Reset form to schema defaults | Switch back and call buildDefaultValues(message). Simpler but more disruptive — user loses all previously entered values. | |

**User's choice:** Revert to form with last known values (latestValues from Zustand at JSON mode entry)

---

## Unknown Fields Warning (JSON-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | sonner toast (already wired in App.tsx) listing the unknown field names. Auto-dismisses. E.g.: "2 unknown fields ignored: foo, bar" | ✓ |
| Inline dismissible banner | Amber warning strip appears above the form after switching back, listing ignored field names. Stays until dismissed. | |
| You decide | Leave to Claude's discretion during implementation | |

**User's choice:** Toast notification (sonner)

---

## JSON Snapshot Format for Special Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Raw RHF shape, no comment | JSON shows exactly what the form holds (RHF internal format with _selected, map rows as [{key, value}], etc.). JSON.stringify(latestValues, null, 2). | ✓ |
| Add a header comment explaining special keys | Prepend comment block or top-level __schema_hint field explaining _selected, map row format, etc. More self-documenting but adds parsing complexity. | |

**User's choice:** Raw RHF shape, no comment or transformation

---

## Claude's Discretion

- Toggle button label/icon (e.g., `{ }` icon vs "JSON" text vs a toggle icon)
- Exact inline error banner layout and Tailwind classes
- Whether to debounce JSON parse validation on keystroke (or only on toggle-back click)
- JSON editor height within ScrollArea (fill available height recommended)
- Error banner position (below editor)

## Deferred Ideas

None — discussion stayed within phase scope.
