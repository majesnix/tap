# Phase 15: Filter + Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 15-filter-export
**Areas discussed:** Filter bar placement, Export mechanism, Export JSON shape

---

## Filter bar placement

### Q1: Where should the routing key input and content-type dropdown live?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate filter row | A dedicated row between subscribe panel and feed header. Always visible. Enough horizontal space. | ✓ |
| Feed header bar | Add inputs directly into existing bg-muted header row. No extra row, but crowded. | |
| Collapsible — filter icon toggles it | Filter icon expands/collapses a row. More feed height when not needed. | |

**User's choice:** Separate filter row (recommended)

### Q2: Where should the Export button live?

| Option | Description | Selected |
|--------|-------------|----------|
| Right side of the filter row | Export sits in same row as filter inputs. "Filter then export what you see." | ✓ |
| Feed header bar | Export in existing bg-muted row next to Clear. Separate from filters. | |

**User's choice:** Right side of the filter row (recommended)

### Q3: What should the content-type dropdown show?

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamically derived from current feed | Lists distinct content-type values in messages[]. "All" first. Updates reactively. | ✓ |
| You decide | Leave to Claude's discretion. | |

**User's choice:** Dynamically derived from current feed (recommended)

---

## Export mechanism

### Q1: How should the JSON export be saved?

| Option | Description | Selected |
|--------|-------------|----------|
| Native Tauri save dialog | tauri-plugin-dialog save picker → user chooses path + filename. Desktop-native. | ✓ |
| Browser download | Blob + anchor click auto-downloads to Downloads folder. No file picker. | |

**User's choice:** Native Tauri save dialog (recommended)

### Q2: Default filename in the save dialog?

| Option | Description | Selected |
|--------|-------------|----------|
| feed-export-{timestamp}.json | e.g. feed-export-2026-05-21T14-32.json — unique, sortable | ✓ |
| feed-export.json | Fixed name, simple | |
| You decide | Leave to Claude's discretion | |

**User's choice:** feed-export-{timestamp}.json (recommended)

### Q3: What if user cancels the save dialog?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent — nothing happens | Cancelling is intentional. No toast, no state change. | ✓ |
| Brief info toast | Show "Export cancelled" toast. | |

**User's choice:** Silent (recommended)

---

## Export JSON shape

### Q1: What fields in each message object?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated human-readable subset | routingKey, exchange, contentType, timestamp (ISO), decodedAs, decoded, error. Omit id + hexString. | ✓ |
| All FeedMessage fields | Complete export including id and hexString. | |
| You decide | Leave to Claude's discretion. | |

**User's choice:** Curated human-readable subset (recommended)

### Q2: How should timestamp be serialized?

| Option | Description | Selected |
|--------|-------------|----------|
| ISO 8601 string | e.g. "2026-05-21T14:32:05.000Z". Human-readable, standard. | ✓ |
| Epoch seconds (number) | Raw number. Smaller, less readable. | |
| Both | timestamp (epoch) + timestampIso (ISO) fields. | |

**User's choice:** ISO 8601 string (recommended)

### Q3: Top-level JSON structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Wrapped object | { exportedAt, messageCount, messages: [...] }. Self-describing. | ✓ |
| Plain array | [{...}, {...}]. Minimal, good for scripting. | |

**User's choice:** Wrapped object (recommended)

---

## Claude's Discretion

- Routing key filter: case-insensitive `includes()` substring match
- Filter combination when both active: AND
- Export button disabled when visible messages count is 0
- Export button icon (Download from lucide-react)
- Filter row styling (border, padding, bg)
- Whether to show "N of M messages" in feed header when filter is active
- Content-type `null` label in dropdown ("(none)" or similar)
- `writeTextFile` from `@tauri-apps/plugin-fs` for writing the export file

## Deferred Ideas

None — discussion stayed within phase scope.
