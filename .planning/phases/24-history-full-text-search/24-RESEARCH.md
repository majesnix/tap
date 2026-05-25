# Phase 24: History Full-Text Search — Research

**Researched:** 2026-05-25
**Domain:** React frontend — pure filter function extension + UI layout addition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Filter bar layout — search on its own row above type+target**
The search input occupies a full-width row above the existing two filter inputs. The existing row with type and target inputs stays as-is below. Two separate `border-b` rows.

**D-02: Search input style — plain, matching existing filter inputs**
No search icon. The search input uses the same `h-7 text-xs` style as the existing filter inputs. Placeholder text: `"Search…"`.

**D-03: Field name traversal — recursive, exclude `_selected` only**
`filterHistoryEntries` traverses `fieldValues` recursively to collect field names at any depth. Excluded keys: `_selected` (oneof discriminator) only. Numeric string keys (`"0"`, `"1"`, ...) from array indices are included as traversal entries. The search matches any collected key against the query.

**Recursion approach:** For each value in `fieldValues`:
- If the value is a plain object (`typeof === "object"`, not null, not Array): recurse into its keys.
- If the value is an Array: recurse into each array element's keys (if elements are objects).
- Primitives: skip (they are values, not names).

**D-04: Count label — "X of Y / 100" when any filter active**
When any of the three inputs (typeFilter, targetFilter, searchQuery) has non-empty text: the header count changes from `"entries.length / 100"` to `"filteredEntries.length of entries.length / 100"` (e.g., `"3 of 47 / 100"`).
When all three inputs are empty: revert to the existing `"entries.length / 100"` format.
`isFiltered` prop must account for all three filters: `!!(typeFilter || targetFilter || searchQuery)`.

### Claude's Discretion

None — discussion stayed within implementation decisions.

### Deferred Ideas (OUT OF SCOPE)

- **HIST-FT-FUTURE-01**: Search field values (decoded scalar data) — requires stripping RHF internals before indexing.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-FT-01 | User sees a search input in the history panel as a third filter control | D-01 + D-02: layout and style decisions enable direct implementation in `HistoryFilterBar.tsx` |
| HIST-FT-02 | Search filters entries whose message type name contains the query (case-insensitive) | Extends existing `filterHistoryEntries` substring pattern; no new technique needed |
| HIST-FT-03 | Search filters entries whose queue/exchange target contains the query (case-insensitive) | Same extension as HIST-FT-02 on `e.exchange` / `e.routingKey` |
| HIST-FT-04 | Search filters entries whose `fieldValues` contain a matching field name key | D-03 + `collectFieldNames` recursive helper implementation; `_selected` excluded only |
| HIST-FT-05 | Search filter applies with AND logic alongside existing type and target filters | Optional 4th param added to `filterHistoryEntries`; chained `.filter()` call |
| HIST-FT-06 | Empty query shows full list; count label reflects combined filter result | D-04: conditional label in `MessageHistoryPanel` header |
| HIST-FT-07 | `filterHistoryEntries` extended with optional `searchQuery` (empty default); existing callers unchanged | Signature design: `searchQuery = ""` default; backward compat by construction |
</phase_requirements>

---

## Summary

Phase 24 is a pure frontend change with no new dependencies, no Rust backend changes, and no persistence requirements. The work touches four files: `historyHelpers.ts` (algorithm), `historyHelpers.test.ts` (tests), `HistoryFilterBar.tsx` (UI), and `MessageHistoryPanel.tsx` (state + rendering).

The critical algorithmic piece is the `collectFieldNames` recursive traversal of `HistoryEntry.fieldValues: Record<string, unknown>`. The function must handle three structural cases: plain nested objects (recurse), arrays (recurse into elements that are objects), and primitives (skip). The only excluded key is `_selected`. Numeric string keys produced by array indices are included — this is an intentional trade-off accepted in D-03.

The filter combination follows the same AND chaining pattern already established by `typeFilter` + `targetFilter`. Adding `searchQuery` as a fourth optional `.filter()` stage maintains exact backward compatibility with all existing callers (HIST-FT-07 satisfied by default parameter, not by special-casing).

**Primary recommendation:** Implement `collectFieldNames` as a standalone pure helper in `historyHelpers.ts`, called inside the `filterHistoryEntries` search filter stage. The function has no side effects and is directly unit-testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Search input UI (layout + style) | Frontend Client — React Component | — | `HistoryFilterBar.tsx` owns the filter bar layout |
| Search query state | Frontend Client — React State | — | `MessageHistoryPanel` holds all filter state via `useState`; searchQuery follows same pattern |
| Field name traversal algorithm | Frontend Client — Pure Helper | — | `historyHelpers.ts`; pure function, no schema access, no store access |
| Filtered entries derivation | Frontend Client — React Memo | — | `useMemo` in `MessageHistoryPanel`; searchQuery added to dependency array |
| Count label rendering | Frontend Client — React Component | — | JSX in `MessageHistoryPanel` header, conditional on `!!(typeFilter \|\| targetFilter \|\| searchQuery)` |

---

## Standard Stack

No new packages are installed in this phase. All required tools are already present in the project.

### Existing Libraries Used

[VERIFIED: codebase] Already in `package.json` and `vite.config.ts`:

| Library | Version | Role in This Phase |
|---------|---------|-------------------|
| React | 19.x | `useState`, `useMemo`, component props |
| Vitest | 4.1.7 | Test runner for `historyHelpers.test.ts` |
| `@testing-library/react` | 16.x | Component tests (if any added) |
| shadcn/ui `Input` | current | Reuse existing `h-7 text-xs flex-1` style for search input |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. Extensions to existing files only:

```
src/components/history/
├── historyHelpers.ts          # Add collectFieldNames + extend filterHistoryEntries
├── historyHelpers.test.ts     # Add tests for searchQuery parameter + collectFieldNames
├── HistoryFilterBar.tsx       # Add search input row + extend props interface
├── MessageHistoryPanel.tsx    # Add searchQuery state, update useMemo, update header
└── HistoryTable.tsx           # Update isFiltered prop usage (receives new value from parent)
```

### Pattern 1: Extending filterHistoryEntries (backward-compatible optional param)

**What:** Add an optional 4th parameter with empty-string default. New `.filter()` call is chained after existing ones.
**When to use:** HIST-FT-07 requires all existing callers to remain unaffected.

```typescript
// Source: existing historyHelpers.ts pattern extended per D-03
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string,
  searchQuery = ""
): HistoryEntry[] {
  return entries
    .filter(
      (e) =>
        !typeFilter ||
        e.messageTypeName.toLowerCase().includes(typeFilter.toLowerCase())
    )
    .filter(
      (e) =>
        !targetFilter ||
        e.exchange.toLowerCase().includes(targetFilter.toLowerCase()) ||
        e.routingKey.toLowerCase().includes(targetFilter.toLowerCase())
    )
    .filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      if (e.messageTypeName.toLowerCase().includes(q)) return true;
      if (e.exchange.toLowerCase().includes(q)) return true;
      if (e.routingKey.toLowerCase().includes(q)) return true;
      const fieldNames = collectFieldNames(e.fieldValues);
      return fieldNames.some((name) => name.toLowerCase().includes(q));
    });
}
```

### Pattern 2: collectFieldNames — recursive field key collector

**What:** Pure helper that traverses `Record<string, unknown>` recursively and returns all non-`_selected` keys at every depth.
**Critical guard:** `typeof null === "object"` in JavaScript — must check `value !== null` before recursing.

```typescript
// Source: D-03 specification in 24-CONTEXT.md
export function collectFieldNames(obj: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_selected") continue;
    names.push(key);
    if (value !== null && !Array.isArray(value) && typeof value === "object") {
      names.push(...collectFieldNames(value as Record<string, unknown>));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          names.push(...collectFieldNames(item as Record<string, unknown>));
        }
      }
    }
  }
  return names;
}
```

### Pattern 3: HistoryFilterBar prop extension

**What:** Add `searchQuery`/`onSearchChange` prop pair following the existing `typeFilter`/`onTypeChange` pattern. Add new `<div>` row above the existing filter row.

```typescript
// Source: D-01, D-02 — extended from existing HistoryFilterBar.tsx pattern
interface HistoryFilterBarProps {
  typeFilter: string;
  targetFilter: string;
  searchQuery: string;
  onTypeChange: (query: string) => void;
  onTargetChange: (query: string) => void;
  onSearchChange: (query: string) => void;
}
```

New row above the existing filter row (D-01):
```tsx
<div className="px-3 pt-2 pb-0 border-b border-border">
  <Input
    placeholder="Search…"
    value={searchQuery}
    onChange={(e) => onSearchChange(e.target.value)}
    className="h-7 text-xs w-full"
  />
</div>
<div className="flex items-center gap-2 px-3 py-2 border-b border-border">
  {/* existing type + target inputs unchanged */}
</div>
```

### Pattern 4: MessageHistoryPanel state + header update

**What:** Add `searchQuery` useState, include in useMemo deps, update header count label and `isFiltered`.

```typescript
// Source: existing MessageHistoryPanel.tsx pattern extended
const [searchQuery, setSearchQuery] = useState("");

const filteredEntries = useMemo(
  () => filterHistoryEntries(entries, typeFilter, targetFilter, searchQuery),
  [entries, typeFilter, targetFilter, searchQuery]
);

const isFiltered = !!(typeFilter || targetFilter || searchQuery);

// Header label (D-04):
// When isFiltered: "{filteredEntries.length} of {entries.length} / 100"
// When not filtered: "{entries.length} / 100"
```

### Anti-Patterns to Avoid

- **`typeof value === "object"` without null guard:** JavaScript returns `"object"` for `null`. Always check `value !== null` before recursing — missing this causes a runtime crash on any proto entry with a null field value.
- **Debouncing the search input:** The REQUIREMENTS.md success criteria specify "typing in it immediately narrows the visible entry list". With N≤100 entries, debouncing adds complexity without any performance benefit.
- **Using a search library (Fuse.js, MiniSearch, etc.):** Explicitly Out of Scope in REQUIREMENTS.md.
- **Excluding numeric string keys:** D-03 explicitly accepts that `"0"`, `"1"` etc. from array indices will be in the key set. Do not add logic to detect/exclude them — it requires schema knowledge that is unavailable at filter time.

---

## Don't Hand-Roll

Not applicable — this phase has no problems that warrant reaching for external libraries. The filter is a pure JavaScript substring match on N≤100 entries.

---

## Common Pitfalls

### Pitfall 1: Null value crash in collectFieldNames

**What goes wrong:** `typeof null === "object"` is `true` in JavaScript. If a `fieldValues` entry has a null value and the null-check is absent, `Object.entries(null)` throws at runtime.
**Why it happens:** Forgetting the `null !== value` guard before the `typeof value === "object"` branch.
**How to avoid:** Always write `value !== null && !Array.isArray(value) && typeof value === "object"` as the combined guard.
**Warning signs:** Runtime error "Cannot convert undefined or null to object" when replaying messages with null-valued fields.

### Pitfall 2: Missing searchQuery in useMemo dependency array

**What goes wrong:** `filteredEntries` does not update when the search input changes — the list appears frozen.
**Why it happens:** Forgetting to add `searchQuery` to the `useMemo` dependency array in `MessageHistoryPanel`.
**How to avoid:** Dependency array must include `[entries, typeFilter, targetFilter, searchQuery]`.
**Warning signs:** Typing in the search box has no effect on the visible list.

### Pitfall 3: Numeric index keys as false-positive matches

**What goes wrong:** A search for `"0"` matches any history entry that has a non-empty repeated (array) field, because array element index keys `"0"`, `"1"` etc. are collected per D-03.
**Why it happens:** The schema-free traversal cannot distinguish array index keys from semantic field names.
**How to avoid:** This is an accepted trade-off per D-03. Do not attempt to fix it — it would require schema awareness not available at filter time. Add a test asserting this behavior explicitly so the behavior is documented.
**Warning signs:** Unexpected matches when searching for short numeric strings.

### Pitfall 4: isFiltered not updated for search state

**What goes wrong:** The `HistoryTable` empty-state message says "No messages sent yet" instead of "No entries match the current filter" when the search query is the active filter.
**Why it happens:** `isFiltered` still computed from `!!(typeFilter || targetFilter)` without `searchQuery`.
**How to avoid:** Update to `!!(typeFilter || targetFilter || searchQuery)` in both the `isFiltered` prop passed to `HistoryTable` and the count label logic.

### Pitfall 5: searchQuery not passed to HistoryFilterBar

**What goes wrong:** The search input is rendered but its value is always empty (controlled input with no value binding).
**Why it happens:** Adding `onSearchChange` prop but forgetting to add `searchQuery` (the controlled value) to `HistoryFilterBar`.
**How to avoid:** Props must include both `searchQuery` and `onSearchChange` as a pair — same pattern as `typeFilter`/`onTypeChange`.

---

## Code Examples

All patterns are from existing codebase code verified by direct read. No third-party documentation required.

### Existing filterHistoryEntries signature (source file read 2026-05-25)

```typescript
// Current signature in historyHelpers.ts — line 11-28
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string
): HistoryEntry[]
```

Extension adds `searchQuery = ""` as 4th param — no existing callers change.

### Existing HistoryFilterBar props interface (source file read 2026-05-25)

```typescript
// Current props in HistoryFilterBar.tsx — lines 3-8
interface HistoryFilterBarProps {
  typeFilter: string;
  targetFilter: string;
  onTypeChange: (query: string) => void;
  onTargetChange: (query: string) => void;
}
```

Extend with: `searchQuery: string` and `onSearchChange: (query: string) => void`.

---

## State of the Art

No library or API changes required. All current versions already in use.

| Current Approach | Notes |
|-----------------|-------|
| Vitest 4.1.7 — already configured | `vitest run` runs all tests; new tests go in `historyHelpers.test.ts` |
| shadcn/ui `Input` — already used in `HistoryFilterBar` | Reuse without modification |
| React `useMemo` for filtered entries | Pattern already established; extend dependency array |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified by direct codebase read (2026-05-25) — no assumed claims.**

---

## Open Questions

None. All decisions are locked in CONTEXT.md and all existing code was read directly.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure frontend code change, no new packages, no CLI tools, no external services).

---

## Sources

### Primary (HIGH confidence)
- `src/components/history/historyHelpers.ts` — read 2026-05-25; existing `filterHistoryEntries` signature and implementation
- `src/components/history/historyHelpers.test.ts` — read 2026-05-25; existing test suite (14 tests, all passing)
- `src/components/history/MessageHistoryPanel.tsx` — read 2026-05-25; existing filter state pattern and header rendering
- `src/components/history/HistoryFilterBar.tsx` — read 2026-05-25; existing props interface and layout
- `src/components/history/HistoryTable.tsx` — read 2026-05-25; `isFiltered` prop interface
- `src/stores/useHistoryStore.ts` — read 2026-05-25; `HistoryEntry.fieldValues: Record<string, unknown>` type
- `.planning/phases/24-history-full-text-search/24-CONTEXT.md` — decisions D-01..D-04 (locked)
- `.planning/REQUIREMENTS.md` — HIST-FT-01..07 acceptance criteria
- `vite.config.ts` — Vitest config (`globals: true`, `environment: "jsdom"`, `setupFiles`)
- `package.json` — confirmed Vitest 4.1.7, no missing test deps

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — full codebase read, locked decisions in CONTEXT.md
- Algorithm (collectFieldNames): HIGH — direct specification from D-03, standard JS recursion pattern
- Pitfalls: HIGH — derived from locked design decisions and known JS gotchas (null/typeof)

**Research date:** 2026-05-25
**Valid until:** Stable — no external dependencies to rot
