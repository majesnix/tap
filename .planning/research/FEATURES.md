# Feature Landscape: v1.7 Block Apply Completeness + History Search

**Domain:** Block apply smart-merge for complex proto field types; full-text search across send history
**Researched:** 2026-05-25
**Downstream consumer:** Requirements scoping / milestone planner

---

## Context: What Already Exists

| Existing capability | Where |
|---|---|
| Block apply via DnD: fills empty scalar/enum/message top-level fields, BLK-08 toast for unmatched keys | `applyBlockRef` in `ProtoFormRenderer`, `FormPanel.useDndMonitor` |
| dirtyFields guard (BLK-07): dirty (user-touched) fields never overwritten | `methods.formState.dirtyFields` check in `applyBlockRef.current` |
| Skipped with toast today: oneof, WellKnownType, map fields | `eligibleFields` filter in `applyBlockRef` — `kind.type` must be `scalar`, `enum`, or `message` |
| History panel: FIFO-100, replay, resend, hex preview | `useHistoryStore`, `MessageHistoryPanel` |
| History filter bar: two text inputs (type substring, queue/exchange substring) | `HistoryFilterBar`, `filterHistoryEntries` in `historyHelpers.ts` |
| fieldValues on HistoryEntry: `Record<string, unknown>` with nested messages, repeated arrays, map rows as `Array<{key,value}>`, oneof as `{_selected, branchField}` | `useHistoryStore.HistoryEntry.fieldValues` |

---

## Section 1 — Block Apply: Complex Field Types

### Overview

The three skipped field types (oneof, WellKnownType, map) are structurally distinct. Each has a different merge model. The `applyBlockRef` contract (returns `string[]` of skipped keys) is the extension point; the call site in `FormPanel` already handles the returned array for the BLK-08 toast. No changes to `ProtoFormRenderer`'s switch block are needed (frozen per D-01).

**Overall complexity: Medium** (WKT is Low; map merge-by-key is Medium; oneof branch-switch is Medium-High due to `unregister` semantics)

---

### Table Stakes

Features required for block apply to be considered "complete" for complex field types.

| ID | Feature | Why Required | Complexity | Implementation note |
|---|---|---|---|---|
| BLK-CT-01 | **WKT fields filled when empty** | Timestamp and Duration fields store strings (`""` default). Block specifying a WKT value must fill them the same way scalars are filled — `setValue(key, value)` — when the field is not dirty. | Low | Same `setValue` path as scalar. `kind.type === 'well_known'` added to `eligibleFields`. Empty-string default = "not set" (consistent with dirtyFields semantic from BLK-07). |
| BLK-CT-02 | **WKT dirty guard honoured** | If the user has already typed a Timestamp or Duration value, the block must not overwrite it. | Low | Same `dirtyFields[key]` check already in place. No new code required — just includes WKT in `eligibleFields`. |
| BLK-CT-03 | **Map field from block: replace-all when empty** | If the map field has zero rows, the block value (an array of `{key, value}` rows) is applied wholesale as the new row set. | Low | `setValue(key, blockValue)` where `blockValue` is an array. MapField uses `useFieldArray`; `setValue` on the array path replaces all rows. |
| BLK-CT-04 | **Map field conflict: per-collision overwrite prompt** | If the map field already has rows and the block also has rows, a conflict exists. Prompt the user per colliding key: block key matches an existing form row key → overwrite or skip. Non-colliding block keys are appended silently. | Medium | `useFormContext().getValues(mapPath)` to read current rows; compare keys; append non-colliding; present batched prompt for collisions (see BLK-CT-07). |
| BLK-CT-05 | **Oneof same-branch fill: fill branch fields when empty** | Block specifies `fieldName._selected === current._selected` and provides branch-field values. The selected branch is the same → same as filling scalar fields inside the branch. Fill non-dirty branch fields silently. | Low | `setValue(`${path}.${branchField.name}`, value)` for each branch field that is not dirty. |
| BLK-CT-06 | **Oneof branch-switch prompt** | Block specifies `fieldName._selected !== current._selected` (different branch). This is not a value overwrite — it is a semantic branch change that will `unregister` the current branch fields. Must prompt before proceeding: "Switch branch from X to Y?" | Medium-High | Prompt must fire before `setValue(path._selected, newBranch)` — switching `_selected` triggers `OneofField`'s `useEffect` which calls `unregister` on the departing branch. Cannot be undone silently. Include in batched prompt (BLK-CT-07). |
| BLK-CT-07 | **Batched conflict prompt, not per-field dialog spam** | When one or more conflicts exist (map key collision, oneof branch-switch, or scalar dirty-field overwrite), show a single summary prompt: "N fields will be overwritten: [list]. Apply / Skip all?" with no per-field modal chain. | Medium | Replace the current silent dirty-skip with an explicit batch conflict list. `applyBlockRef` must collect conflicts and return them (or invoke a callback) rather than silently skipping. The caller (`FormPanel`) presents the prompt and calls back with the decision. |

**Dependency chain:** BLK-CT-07 is the UX container for BLK-CT-04 and BLK-CT-06. BLK-CT-01/02 are independent of the prompt path (WKT is just scalar-shaped). BLK-CT-03 is independent when there is no collision.

---

### Differentiators

Nice-to-have for a dev productivity tool but not required for v1.7 completeness.

| ID | Feature | Value | Complexity |
|---|---|---|---|
| BLK-DIF-01 | **"Decide each" mode in conflict prompt** | Offer Apply All / Skip All / Decide Each in the batched prompt. "Decide Each" walks through conflicts one by one. | High — UX complexity; requires stateful wizard. Defer to v1.8 if requested. |
| BLK-DIF-02 | **Oneof branch-switch with auto-fill of new branch** | After confirming the branch switch, also fill the new branch's fields from block values rather than leaving them at defaults. | Low — natural follow-on from BLK-CT-06; add after the switch. |
| BLK-DIF-03 | **Repeated field merge from block** | Currently repeated fields are not in `eligibleFields` either. Allow a block to set the array contents of a repeated field when the array is empty. | Medium — same `setValue` path, but repeated fields can be deeply nested. |

---

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Per-field modal dialog for each conflict** | 5 colliding map keys → 5 sequential modals. Unusable. | Batched prompt (BLK-CT-07): one dialog listing all conflicts, Apply All / Skip All. |
| **Silent overwrite of dirty fields** | Destroys user intent without warning. Current BLK-07 behaviour (skip silently) is also wrong for the new types — user doesn't know they lost data. | Batched prompt surfaces the list; user chooses. |
| **Type-safe blocks scoped to a message type** | Adds schema-coupling complexity already rejected in v1.3 (see v1.3-REQUIREMENTS.md Out of Scope). | Global field-name-match remains the model. |
| **Block apply in JSON mode** | The form is not mounted in JSON mode; `applyBlockRef.current` is null. `FormPanel.onDragEnd` already guards: `if (isJsonMode) return`. Keep this guard. | No change needed. |
| **Recursive nested-message merge** | Nested message field apply is already included in `eligibleFields` (`kind.type === 'message'`), but only at top level. Recursing into nested message sub-fields from a block is impractical without a recursive schema walk. | Top-level only. Deep nesting uses `resetRef` (replay) not `applyBlockRef`. |

---

## Section 2 — History Search: Full-Text Across Field Values

### Overview

Today's `HistoryFilterBar` has two separate substring inputs: "Filter by type" and "Filter by queue/exchange". Full-text search adds a third input that searches across all field values (decoded form data), field names/keys, message type name, and queue/exchange target in a single query. It augments — does not replace — the two existing filters.

All matching happens client-side on the FIFO-100 array (max 100 entries). No indexing infrastructure needed. The `filterHistoryEntries` pure function in `historyHelpers.ts` is the extension point.

**Overall complexity: Low-Medium** (recursive field-value walker is the main work; composing with existing filters is trivial)

---

### Table Stakes

| ID | Feature | Why Required | Complexity | Implementation note |
|---|---|---|---|---|
| HIST-FT-01 | **Single search input alongside existing filters** | Developers type one query and expect it to match "anywhere in that entry". Separate type + target filters stay for precision; the search bar is for discovery. | Low | Add `searchQuery: string` state to `MessageHistoryPanel`. `filterHistoryEntries` gains a third parameter. |
| HIST-FT-02 | **Match message type name** | "I sent something with a Payment type three hours ago" — type name substring match. Already covered by the existing type filter, but the unified search bar must also cover it. | Low | Include `e.messageTypeName` in the search corpus. |
| HIST-FT-03 | **Match queue/exchange target** | "I sent something to orders.*exchange*" — routing key or exchange substring match. Already covered by the existing target filter. | Low | Include `e.exchange` and `e.routingKey` in the search corpus. |
| HIST-FT-04 | **Match field names (keys) in fieldValues** | "Find all entries that had a `user_id` field" — key names, not values. | Low | Walk `Object.keys(fieldValues)` recursively (see traversal rule below). |
| HIST-FT-05 | **Match field values (scalar strings and numbers)** | "Find the entry where I set orderId to 'abc-123'" — the most common dev use case. Values are `string | number | boolean | null | object | array`. Stringify non-objects for matching. | Medium | `String(value)` for scalars; recurse into objects and arrays. Map rows are `Array<{key, value}>` — both key and value are searchable. Oneof values are `{_selected, branchField}` — `_selected` and branch field values are searchable. |
| HIST-FT-06 | **Case-insensitive, substring match** | Consistent with existing type and target filter behaviour. | Low | `.toLowerCase().includes(query.toLowerCase())` |
| HIST-FT-07 | **AND composition with existing filters** | Entries must satisfy all active filters simultaneously. If the user has type filter "Payment" and search query "abc-123", only entries matching both are shown. | Low | Filter chain: existing type filter → existing target filter → search filter. |
| HIST-FT-08 | **Empty query = no filtering** | Standard baseline; returning all entries when query is blank. | Low | `if (!query) return true` guard. |
| HIST-FT-09 | **Correct count label updates** | The existing `entries.length / 100` label in the panel header should reflect filtered count when any filter is active. | Low | Pass `filteredEntries.length` to the counter when filters are active. |

---

### Field Value Traversal Rule

`fieldValues` is `Record<string, unknown>`. The recursive walker must handle:

| Shape | Example | Rule |
|---|---|---|
| Scalar | `{ orderId: "abc-123" }` | `String(value)` for matching; key is also matched |
| Nested message | `{ address: { street: "Main St", city: "Berlin" } }` | Recurse into the object; match keys and scalar values |
| Repeated field | `{ tags: ["a", "b"] }` | Walk array items; stringify non-objects |
| Map rows | `{ headers: [{key: "x-trace", value: "001"}] }` | Walk array; for each `{key, value}` object, both key and value are searchable |
| Oneof | `{ payment: { _selected: "card_number", card_number: "4111..." } }` | `_selected` is a key worth matching (developer searches by branch name); branch field values are scalars — recurse |
| Boolean / null | `{ active: false }` | `String(false)` = `"false"` — matchable |
| payloadBytes / id / timestamp / status | Not in fieldValues | Not searched (searching byte arrays is an anti-feature) |

**Depth guard:** cap recursive walk at depth 8 (proto MAX_DEPTH is 5; oneof adds one more level; map values add one more). Prevents stack issues on pathological schemas.

---

### Differentiators

| ID | Feature | Value | Complexity |
|---|---|---|---|
| HIST-DIF-01 | **Match highlighting in expanded row or detail view** | Highlighted match in the table truncates to 24 chars — not useful. Highlighting is worth implementing if/when a row-expand or detail pane is added (not in v1.7 scope). | Medium — defer |
| HIST-DIF-02 | **Search result count indicator** | "3 of 8 filtered" label when search is active. Shows the developer how many entries survived the combined filters. | Low — worth doing in v1.7 as extension of HIST-FT-09 |
| HIST-DIF-03 | **Debounced search input** | 150ms debounce on the search input prevents re-filtering 100 entries on every keystroke. Imperceptible for 100 entries — include as good practice, not correctness requirement. | Low |

---

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Searching `payloadBytes`** | Byte array values have no semantic meaning as text. Will produce false positives (e.g., "01" matches common byte sequences). | Limit search to `fieldValues` only. |
| **Searching the hex string representation** | Same problem as payloadBytes — text pattern in hex has no domain meaning. | Do not include `hexString` or `payloadBytes` in the search corpus. |
| **Fuzzy / ranked search** | 100 entries is not a search problem. Substring match is the correct solution at this scale. Fuzzy ranking adds library complexity (Fuse.js or similar) for zero perceptible benefit. | Case-insensitive substring only. |
| **Full-text index / Fuse.js / external search** | Over-engineered for ≤100 rows in memory. | Pure client-side filter on the FIFO-100 array, same pattern as the existing filters. |
| **Replacing the existing type / target filter inputs with a single search bar** | The existing filters are precision tools (filter to exactly one message type for all-replay scenarios). The search bar is a discovery tool. Replacing the filters would degrade the precision use case. | Keep all three inputs: type filter, target filter, full-text search. Layout: add the search bar as a third row in `HistoryFilterBar`, or full-width below the two existing inputs. |
| **Persisting the search query across restarts** | Filter state is session-only by convention in all existing Tap filters. | Session-local state only (`useState` in `MessageHistoryPanel`). |
| **Searching across the Plan Runner reply feed or Drain feed** | Out of scope for v1.7. Those feeds have different data shapes and UX contexts. | History panel only. |

---

## Dependencies on Existing Features

| v1.7 feature | Existing feature it depends on |
|---|---|
| BLK-CT-01/02 (WKT apply) | `applyBlockRef` contract, `dirtyFields` guard (Phase 12) |
| BLK-CT-03/04 (map apply) | `MapField` `useFieldArray` `setValue` path (Phase 07) |
| BLK-CT-05/06 (oneof apply) | `OneofField` `_selected` path, `unregister` on branch switch (Phase 01) |
| BLK-CT-07 (batched prompt) | `FormPanel` `useDndMonitor.onDragEnd` skipped-keys handler (Phase 12) |
| HIST-FT-01–09 (search) | `filterHistoryEntries` in `historyHelpers.ts`, `MessageHistoryPanel` state, `HistoryFilterBar` (Phase 03) |

---

## Phase Ordering Recommendation

**Phase A — History Search** (Low-Medium, no UI prompt complexity)
Implement HIST-FT-01 through HIST-FT-09 plus HIST-DIF-02 (search result count) and HIST-DIF-03 (debounce). Touches only `historyHelpers.ts`, `HistoryFilterBar`, and `MessageHistoryPanel`. Isolated; zero risk to block apply path.

**Phase B — Block Apply: WKT + Map empty-case** (Low)
BLK-CT-01/02 (WKT as scalar) and BLK-CT-03 (map replace-all when empty). No prompt required. Pure extension of `eligibleFields` in `applyBlockRef`. Isolated change.

**Phase C — Block Apply: Conflict Prompt + Oneof** (Medium-High)
BLK-CT-04 (map collision), BLK-CT-06 (oneof branch-switch), and BLK-CT-07 (batched prompt). These three must ship together — the prompt is the UX container for both conflicts. Requires changes to `applyBlockRef` contract (returns conflicts instead of skipping silently) and a new prompt component in `FormPanel`.

**Rationale for this order:** Phase A has no inter-dependencies with Phases B/C. Phase B can be validated independently before adding prompt logic. Phase C carries the highest UX design risk and should be isolated to its own plan.
