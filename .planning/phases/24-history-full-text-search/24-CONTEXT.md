# Phase 24: History Full-Text Search - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a full-text search input to the history panel that searches across message type name, queue/exchange target, and field names in `fieldValues` — using OR logic within the search (match if ANY of those contains the query), then AND-ing the search result with the existing type-filter and target-filter controls. All three inputs are independent controls; the AND combination narrows results as each is filled.

The existing `filterHistoryEntries(entries, typeFilter, targetFilter)` function is extended with an optional fourth parameter `searchQuery?: string` (default `""`) — all existing callers and tests are unaffected.

</domain>

<decisions>
## Implementation Decisions

### D-01: Filter bar layout — search on its own row above type+target
The search input occupies a full-width row above the existing two filter inputs. The existing row with type and target inputs stays as-is below. Two separate `border-b` rows. This avoids the cramping that would occur with three `flex-1` inputs on one row in a ~300px-wide panel.

### D-02: Search input style — plain, matching existing filter inputs
No search icon. The search input uses the same `h-7 text-xs` style as the existing filter inputs. Placeholder text: `"Search…"`.

### D-03: Field name traversal — recursive, exclude `_selected` only
`filterHistoryEntries` traverses `fieldValues` recursively to collect field names at any depth. Excluded keys: `_selected` (oneof discriminator) only. Numeric string keys (`"0"`, `"1"`, ...) from array indices are included as traversal entries — they are not field names semantically but excluding them requires schema knowledge not available at filter time. The search matches any collected key against the query.

**Excluded from matching:** keys strictly equal to `"_selected"`. All other string keys (including object-typed values' keys) are collected.

**Recursion approach:** For each value in `fieldValues`:
- If the value is a plain object (`typeof === "object"`, not null, not Array): recurse into its keys.
- If the value is an Array: recurse into each array element's keys (if elements are objects).
- Primitives: skip (they are values, not names).

### D-04: Count label — "X of Y / 100" when any filter active
When any of the three inputs (typeFilter, targetFilter, searchQuery) has non-empty text: the header count changes from `"entries.length / 100"` to `"filteredEntries.length of entries.length / 100"` (e.g., `"3 of 47 / 100"`).

When all three inputs are empty: revert to the existing `"entries.length / 100"` format.

The `isFiltered` prop passed to `HistoryTable` (for empty-state message) must also account for all three filters: `!!(typeFilter || targetFilter || searchQuery)`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §History — Full-Text Search — HIST-FT-01 through HIST-FT-07 define all acceptance criteria for this phase

### Existing code to extend (read before touching)
- `src/components/history/MessageHistoryPanel.tsx` — orchestrates filter state; add `searchQuery` state and pass to `HistoryFilterBar` and `filterHistoryEntries`
- `src/components/history/HistoryFilterBar.tsx` — add search input row; extend props with `searchQuery` + `onSearchChange`
- `src/components/history/historyHelpers.ts` — extend `filterHistoryEntries` with optional `searchQuery`; add recursive `collectFieldNames` helper
- `src/components/history/historyHelpers.test.ts` — extend tests for `filterHistoryEntries` with `searchQuery`; existing tests must continue to pass unchanged (HIST-FT-07)
- `src/components/history/HistoryTable.tsx` — `isFiltered` prop must account for searchQuery in addition to typeFilter/targetFilter

### Type reference
- `src/stores/useHistoryStore.ts` — `HistoryEntry.fieldValues: Record<string, unknown>` — the object being traversed for field names

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HistoryFilterBar` component: extend with a new `searchQuery`/`onSearchChange` prop pair, same pattern as existing `typeFilter`/`onTypeChange`
- `filterHistoryEntries`: pure function, extend with optional 4th arg — maintains backward compat
- Existing `Input` component (shadcn/ui): reuse same `h-7 text-xs flex-1 className` as current filter inputs

### Established Patterns
- Filter state lives in `MessageHistoryPanel` as local `useState` — `searchQuery` follows the same pattern as `typeFilter` and `targetFilter`
- `useMemo` for `filteredEntries`: add `searchQuery` to dependency array
- `isFiltered` prop: computed from `!!(typeFilter || targetFilter)` today — extend to include `searchQuery`
- The `filterHistoryEntries` function is pure and tested in isolation — keep it pure (no side effects, no schema import)

### Integration Points
- `MessageHistoryPanel` → `HistoryFilterBar`: pass `searchQuery` + `onSearchChange`
- `MessageHistoryPanel` → `filterHistoryEntries`: pass `searchQuery` as 4th arg
- `MessageHistoryPanel` header: conditional count format based on `!!(typeFilter || targetFilter || searchQuery)`
- `MessageHistoryPanel` → `HistoryTable`: `isFiltered={!!(typeFilter || targetFilter || searchQuery)}`

</code_context>

<specifics>
## Specific Ideas

None — discussion stayed within implementation decisions for the specified requirements.

</specifics>

<deferred>
## Deferred Ideas

- **Search field VALUES (decoded scalar data):** HIST-FT-FUTURE-01 in REQUIREMENTS.md — deferred from v1.7; requires stripping RHF internals before indexing

</deferred>

---

*Phase: 24-History Full-Text Search*
*Context gathered: 2026-05-25*
