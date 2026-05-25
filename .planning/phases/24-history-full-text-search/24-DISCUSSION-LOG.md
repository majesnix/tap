# Phase 24: History Full-Text Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 24-history-full-text-search
**Areas discussed:** Filter bar layout, Field name traversal depth, Count label update

---

## Filter bar layout

| Option | Description | Selected |
|--------|-------------|----------|
| Own row — search above type+target | Full-width row above the existing two inputs; clear hierarchy, no cramping | ✓ |
| Same row — 3 equal columns | All three inputs flex-1 on one row; each ~90px in a ~300px panel | |
| You decide | Claude picks based on narrow panel width | |

**User's choice:** Own row — search above type+target

---

| Option | Description | Selected |
|--------|-------------|----------|
| "Search…" | Short, minimal | ✓ |
| "Search fields…" | Hints at field name searching | |
| "Search type, target, fields…" | Explicit about all three dimensions | |

**User's choice:** Placeholder text: "Search…"

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain input — match existing style | No icon; consistent with type/target inputs | ✓ |
| Search icon prefix | Adds magnifying glass; differentiates search visually | |

**User's choice:** Plain input, no icon

---

## Field name traversal depth

| Option | Description | Selected |
|--------|-------------|----------|
| Recursive — all field names at any depth | Searches nested message keys, oneof branch keys, repeated element keys; excludes _selected | ✓ |
| Top-level only — flat keys | Searches only root-level keys of fieldValues | |
| You decide | Claude picks based on HIST-FT-04 "schema-guided" wording | |

**User's choice:** Recursive — all field names at any depth

---

| Option | Description | Selected |
|--------|-------------|----------|
| _selected only | Exclude only the oneof discriminator key | ✓ |
| _selected + array index keys | Also skip "0", "1", ... numeric string keys | |
| You decide | Claude decides what counts as RHF internal | |

**User's choice:** Exclude `_selected` only

---

## Count label update

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with filtered count — "3 of 47 / 100" | When filters active: show X of Y / 100; revert when clear | ✓ |
| Always show filtered / total — "3 of 47" | Always show filtered/total; drop the /100 cap indicator | |
| Separate count label near filter bar | Keep header unchanged; add small label in filter bar | |

**User's choice:** "X of Y / 100" when any filter is active; revert to "Y / 100" when all clear

---

| Option | Description | Selected |
|--------|-------------|----------|
| Any filter active (type OR target OR search) | All three inputs trigger filtered format | ✓ |
| Only when search input has text | Existing filters keep old format | |

**User's choice:** Any filter active triggers the "X of Y / 100" format

---

## Claude's Discretion

None — all areas had explicit user choices.

## Deferred Ideas

- Search field VALUES (decoded scalar data) — deferred to HIST-FT-FUTURE-01; requires stripping RHF internals before indexing
