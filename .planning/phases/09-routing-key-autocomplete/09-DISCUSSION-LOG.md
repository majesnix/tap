# Phase 9: Routing Key Autocomplete - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 9-Routing Key Autocomplete
**Areas discussed:** Autocomplete widget, Exchange type visibility, Pattern label style

---

## Autocomplete Widget

| Option | Description | Selected |
|--------|-------------|----------|
| Combobox | shadcn Command+Popover (cmdk) — searchable, filterable. Needs cmdk + Command components added. | ✓ |
| HTML datalist | Native browser <datalist> on existing <input>. Zero new deps, inline autocomplete. Less control over styling. | |
| Simple suggestion list | Non-searchable dropdown list below the input (Popover installed). Click to select OR type freely. | |

**User's choice:** Combobox

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — free type + suggestions | User can pick from suggestions OR type any custom key | ✓ |
| Suggestions only | User must pick from the list | |

**User's choice:** Yes — free type + suggestions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain `<Input>` | Same as today when no eligible exchange selected | ✓ |
| Combobox always, disabled | Always render combobox, disabled until exchange selected | |

**User's choice:** Plain `<Input>` (fallback when no eligible exchange or headers/fanout selected)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — small spinner | Loader2 icon inside input during fetch | ✓ |
| No — input stays blank | Simpler; binding fetches are typically fast | |

**User's choice:** Yes — small Loader2 spinner

---

## Exchange Type Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show type label | Each exchange shows type: 'orders [topic]', 'logs [fanout]'. Requires fetch_exchanges to return {name, type}. | ✓ |
| No — name only, suppress silently | Keep dropdown name-only; suppress suggestions without explanation | |

**User's choice:** Yes — show type label

---

| Option | Description | Selected |
|--------|-------------|----------|
| Muted badge beside the name | Small gray badge: 'orders' + [topic] | ✓ |
| Inline muted text | Name followed by muted type text, no badge chrome | |
| You decide | Claude picks based on existing badge usage | |

**User's choice:** Muted badge beside the name

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — small hint text below input | e.g. 'Routing key is ignored for fanout exchanges' | ✓ |
| No — just show plain input | Cleaner; type badge already gives the signal | |

**User's choice:** Yes — small hint text below input

---

## Pattern Label Style

| Option | Description | Selected |
|--------|-------------|----------|
| Badge 'pattern' beside the text | Small amber badge. Clear, scannable. | ✓ |
| Warning icon + tooltip | Small orange triangle; tooltip on hover | |
| Italic muted text | Pattern in italic muted style | |

**User's choice:** Badge 'pattern' beside the text

---

| Option | Description | Selected |
|--------|-------------|----------|
| Copies the full pattern as-is | e.g. 'orders.*.created' fills input; user edits before sending | ✓ |
| Copies pattern + shows inline warning | Pattern fills input AND a small warning appears | |

**User's choice:** Copies the full pattern as-is

---

| Option | Description | Selected |
|--------|-------------|----------|
| Check for * or # characters | AMQP spec — any binding key with * or # is a pattern | ✓ |
| Only flag from topic exchanges | Same logic but only label as 'pattern' for topic exchange keys | |

**User's choice:** Check for * or # characters (AMQP spec — universal)

---

## Claude's Discretion

None — user provided clear direction on all questions.

## Deferred Ideas

None — discussion stayed within phase scope.
