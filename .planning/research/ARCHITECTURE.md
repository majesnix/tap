# Architecture: v1.7 Block Apply Completeness + History Search

**Project:** Tap (proto-sender)
**Researched:** 2026-05-25
**Milestone:** v1.7

---

## Section 1 — Block Apply for Complex Field Types

### 1.1 Current State

`applyBlockRef.current` in `ProtoFormRenderer.tsx` (lines 151–175) is a synchronous function with this contract:

```ts
(blockValues: Record<string, unknown>) => string[]
// returns: array of unmatched block key names (toast-warned as BLK-08)
```

**Current eligible set** (line 153–158): `scalar`, `enum`, `message`. oneof/WKT/map are excluded from `eligibleFields` and land in `skipped`, producing the BLK-08 toast. `dirtyFields[key]` silently prevents overwrite with no user prompt.

**v1.7 changes two things:**

1. **Extend eligibility** — oneof, WKT, and map fields become applicable.
2. **Replace silent dirty-skip with a per-field conflict prompt** — this is cross-cutting; it applies to ALL field types (scalar, enum, message, oneof, WKT, map), not only the newly eligible ones. The current silent protection becomes a user-facing decision.

### 1.2 Block JSON Shape Contract

The block's `content` JSON string already stores the form's `latestValues` snapshot. For complex types the shape follows existing RHF internal conventions (already encoded this way when blocks are saved from form state):

| Field type | JSON shape in block content |
|------------|----------------------------|
| oneof | `{ payment: { _selected: "card_number", card_number: "1234" } }` — flat object, `_selected` key plus one branch key. Matches `OneofField` path convention. |
| map | `{ headers: [{ key: "x-version", value: "1" }] }` — array of `{key, value}` pairs. NOT `Record<K,V>`. Matches `useFieldArray` storage and the existing duplicate-key decision. |
| WKT | `{ created_at: "2024-01-15T10:00" }` — string at top level. For Any/Struct/Value/ListValue it is a JSON-encoded string per `WellKnownTypeField` fallback path. |
| repeated | `{ tags: ["a","b","c"] }` — plain array. |
| scalar/enum/message | unchanged from v1.3 |

**No migration needed** for existing saved blocks. Blocks saved before v1.7 used the same form snapshot format. Complex fields were simply never stored in saved blocks (users who have blocks today have only scalar/enum/message content since those were the only eligible fields at apply time).

### 1.3 applyBlockRef Contract Change

The synchronous write contract must become two-phase to support the user conflict prompt without ProtoFormRenderer owning UI:

**Phase A — Plan (pure, no side effects):**

```ts
interface FieldConflict {
  key: string;
  incomingValue: unknown;
  currentValue: unknown;
  fieldType: 'scalar' | 'enum' | 'message' | 'oneof' | 'well_known' | 'map';
}

interface ApplyPlan {
  cleanApplies: Record<string, unknown>;  // dirty=false -> apply immediately, no prompt
  conflicts: FieldConflict[];             // dirty=true -> needs user decision
  unmatched: string[];                    // not in message schema -> BLK-08 toast
}
```

**Phase B — Commit (writes to form):**

```ts
interface ApplyDecision {
  key: string;
  action: 'overwrite' | 'skip';
}

// Commit: void, applies setValue calls for decided conflicts + all cleanApplies
```

**Ref shape on ProtoFormRenderer:**

```ts
interface ApplyBlockRefs {
  planApplyBlockRef: React.MutableRefObject<
    ((blockValues: Record<string, unknown>) => ApplyPlan) | null
  >;
  commitApplyBlockRef: React.MutableRefObject<
    ((cleanApplies: Record<string, unknown>, decisions: ApplyDecision[]) => void) | null
  >;
}
```

The existing single `applyBlockRef` prop becomes two props (`planApplyBlockRef`, `commitApplyBlockRef`). `FormPanel` holds both refs, `ProtoFormRenderer` populates both via `useEffect`, `FormPanel` orchestrates the dialog.

### 1.4 setValue Mechanics for Complex Types

**oneof** — apply order matters. Set the full object atomically via `setValue(key, { _selected: branchName, [branchName]: branchValue })`. Do NOT set `_selected` first then the branch separately: RHF's `unregister` effect in `OneofField` fires on `_selected` change and would unregister the branch path before the second `setValue` lands. Atomic set avoids the race. Use `shouldDirty: false` (consistent with existing scalar apply per Pitfall 3 in prior research — keeps field non-dirty so a subsequent block drop can still overwrite it).

**map** — `setValue(key, arrayOfPairs, { shouldDirty: false })` where `arrayOfPairs` is `Array<{key, value}>`. `useFieldArray` in `MapField` watches the path, so setting the top-level array refreshes all rows. The duplicate-key guard (`useWatch` + `useMemo` in MapField) fires automatically on the next render cycle.

**WKT** — `setValue(key, stringValue, { shouldDirty: false })`. Same as scalar; the `Controller` in `WellKnownTypeField` picks it up directly.

**message (nested)** — already eligible today. `setValue(key, objectValue, { shouldDirty: false })`. No change.

### 1.5 Conflict Detection Granularity

Top-level fields only. Do not recurse into nested message shapes for dirty detection. Rationale: `formState.dirtyFields[key]` tracks top-level keys in RHF; a user editing `payment.card_number` has dirtied the `payment` top-level entry in dirtyFields, which the top-level check catches. Recursive sub-field dirty inspection adds complexity without clear user value in v1.7.

### 1.6 Modified Components

**`ProtoFormRenderer.tsx` — MODIFIED**

- Remove `applyBlockRef` prop (single ref).
- Add `planApplyBlockRef` and `commitApplyBlockRef` props.
- Populate `planApplyBlockRef.current` with a pure function that classifies each block key as `cleanApply | conflict | unmatched` using `message.fields` + `formState.dirtyFields`. Extends eligible set to include `oneof`, `well_known`, `map`.
- Populate `commitApplyBlockRef.current` with a function that calls `setValue` per decision.
- Do NOT touch the `renderField` switch or any pre-dispatch branch.

**`FormPanel.tsx` — MODIFIED**

- Replace `applyBlockRef` ref with `planApplyBlockRef` + `commitApplyBlockRef` refs.
- In `useDndMonitor.onDragEnd`: call `planApplyBlockRef.current(blockValues)` to get `ApplyPlan`.
  - `conflicts.length === 0`: call `commitApplyBlockRef.current(cleanApplies, [])` immediately (no dialog).
  - `conflicts.length > 0`: open the conflict dialog, passing `conflicts` and `cleanApplies`.
- Add local state for the dialog: `pendingApplyPlan: ApplyPlan | null`, `isConflictDialogOpen: boolean`.
- On dialog confirm: call `commitApplyBlockRef.current(plan.cleanApplies, decisions)`.
- Still show BLK-08 toast for `unmatched` keys.

### 1.7 New Components

**`BlockApplyConflictDialog.tsx` — NEW**

Location: `src/components/blocks/BlockApplyConflictDialog.tsx`

Responsibility: render per-field overwrite/skip UI for each `FieldConflict`. Stateless — receives `conflicts`, `cleanApplies`, `onConfirm(decisions)`, `onCancel`. Internal state: `decisions: Record<string, 'overwrite' | 'skip'>`, initialized to `'skip'` (conservative default — do not overwrite without explicit user intent).

UI shape:
- AlertDialog with scrollable list of conflict rows.
- Each row: field name + field type badge, current value display (truncated stringify), incoming value display (truncated stringify), overwrite/skip toggle (Switch or RadioGroup).
- "Apply" button confirms all decisions.
- "Cancel" discards the drop entirely.

Value display: `JSON.stringify(val).slice(0, 80) + (len > 80 ? '...' : '')`. For oneof/map, show the type badge rather than raw JSON to keep rows readable.

**`src/lib/blockApply.ts` — NEW**

Pure helper module, extractable from `ProtoFormRenderer` logic and independently unit-testable:

```ts
export function classifyBlockKey(
  key: string,
  incomingValue: unknown,
  eligibleFields: Set<string>,
  dirtyFields: Record<string, unknown>
): 'clean' | 'conflict' | 'unmatched'

export function buildApplyPlan(
  blockValues: Record<string, unknown>,
  message: MessageSchema,
  currentFormValues: Record<string, unknown>,
  dirtyFields: Record<string, unknown>
): ApplyPlan
```

`ApplyPlan`, `FieldConflict`, `ApplyDecision` types are also exported from this module and imported by `ProtoFormRenderer` and `FormPanel`.

### 1.8 Data Flow

```
BlockLibraryPanel (drag start)
  -> DndContext.DragOverlay (AppLayout)
  -> FormPanel.useDndMonitor.onDragEnd
      -> parse block.content JSON
      -> planApplyBlockRef.current(blockValues) -> ApplyPlan
          [ProtoFormRenderer closure: buildApplyPlan(blockValues, message, getValues(), dirtyFields)]
      -> if conflicts.length === 0:
            commitApplyBlockRef.current(cleanApplies, [])
      -> if conflicts.length > 0:
            setPendingApplyPlan(plan), setConflictDialogOpen(true)
      -> toast BLK-08 for unmatched keys

BlockApplyConflictDialog (user makes decisions)
  -> onConfirm(decisions)
      -> commitApplyBlockRef.current(plan.cleanApplies, decisions)
          [ProtoFormRenderer closure]
          -> for cleanApply keys: setValue(key, value, {shouldDirty:false})
          -> for decisions with action='overwrite': setValue(key, value, {shouldDirty:false})
          -> for decisions with action='skip': no-op
  -> onCancel: setPendingApplyPlan(null), setConflictDialogOpen(false)
```

### 1.9 Repeated Fields

Repeated fields (any inner kind) remain excluded from block apply. Merge semantics are ambiguous (append vs replace) and out of scope for v1.7. They land in `unmatched` and trigger the BLK-08 toast. The `buildApplyPlan` function JSDoc should document this exclusion so a future milestone can add append/replace mode.

### 1.10 Build Order for Block Apply

1. Extract types (`ApplyPlan`, `FieldConflict`, `ApplyDecision`) and pure helpers (`buildApplyPlan`, `classifyBlockKey`) to `src/lib/blockApply.ts` + unit tests.
2. Add `BlockApplyConflictDialog` component + tests (no wiring yet).
3. Modify `ProtoFormRenderer`: replace single ref with two-phase refs, extend eligible set to oneof/WKT/map, wire plan/commit logic using `buildApplyPlan`.
4. Update `FormPanel`: replace `applyBlockRef` ref, add `pendingApplyPlan` local state, wire `BlockApplyConflictDialog` in `useDndMonitor.onDragEnd`.
5. Integration tests: drop onto form with clean fields (instant apply, no dialog), dirty scalar (conflict dialog), dirty oneof (conflict dialog), dirty map (conflict dialog), cancel path, confirm overwrite path.

---

## Section 2 — Full-Text Search in History Panel

### 2.1 Current State

`MessageHistoryPanel` has two filters (`typeFilter`, `targetFilter`) that call `filterHistoryEntries` in `historyHelpers.ts`. Filtering is pure, search-time, in `useMemo`. The `HistoryFilterBar` component renders two `Input` elements.

`HistoryEntry.fieldValues` is `Record<string, unknown>` — the form's `latestValues` at send time. For complex fields, the shapes are:
- oneof: `{ _selected: "card_number", card_number: "4111..." }` (nested object with `_selected`)
- map: `[{ key: "x-version", value: "1" }]` (array of pairs)
- WKT: string value
- repeated: array of primitives or objects
- nested message: nested object

### 2.2 Index Location

Search-time only. No index-time extraction is needed. 100 entries x ~50 fields = ~5,000 leaf values. Recursive walk on each filter keystroke is negligible for this volume. Do not add index structures to `HistoryEntry` or `useHistoryStore`.

### 2.3 fieldValues is Sufficient

`HistoryEntry.fieldValues` is already the complete form state at send time — field names as keys, user-entered values as values, with complex shapes as above. The milestone phrase "decoded field values" refers to this stored form state (i.e., what the user typed/selected), not to decoded AMQP binary reception. No additional extraction is needed at persist time. `HistoryEntry` shape is unchanged.

### 2.4 Recursive Value Walker

A pure helper function walks `fieldValues` recursively to collect all searchable text tokens:

```ts
// src/components/history/historyHelpers.ts — ADD (does not modify existing exports)

/**
 * Recursively extracts all searchable tokens from a fieldValues object.
 * Returns an array of lowercase strings for fast substring matching.
 *
 * Handles:
 *   - Primitives: stringified and lowercased
 *   - Arrays: recurse into each element (covers repeated and map-as-pairs [{key,value}])
 *   - Objects: recurse into values AND include keys as tokens
 *     (covers nested messages, oneof — keys like "card_number" and "_selected" are searchable)
 *   - null/undefined: skipped
 * Depth-limited to 10 to guard against pathological schemas.
 */
export function extractSearchTokens(value: unknown, depth?: number): string[]
```

The caller joins with the entry's `messageTypeName`, `exchange`, and `routingKey` to form the complete token set for that entry. The search check is: any token in the full set includes `normalizedQuery` (lowercase substring).

### 2.5 Filter Integration

Search is an AND filter with the existing type+target filters, consistent with the current `filterHistoryEntries` logic. `searchQuery` is an additional parameter added to `filterHistoryEntries`:

**Updated signature:**

```ts
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string,
  searchQuery: string   // NEW — empty string = no filter
): HistoryEntry[]
```

The function is additive: existing callers pass `""` for `searchQuery` and get identical behavior. The search check adds a third `.filter()` clause using `extractSearchTokens(entry.fieldValues)` combined with `messageTypeName`, `exchange`, `routingKey` tokens.

`MessageHistoryPanel` debounces `searchQuery` at 150ms before passing to `filterHistoryEntries` in `useMemo`. Use the `useDebounce` hook pattern already established in `FormPanel` (`src/hooks/useDebounce.ts`).

### 2.6 Modified Components

**`historyHelpers.ts` — MODIFIED**

- Add `extractSearchTokens(value: unknown, depth?: number): string[]` export.
- Update `filterHistoryEntries` signature to accept `searchQuery: string`.
- Add search filter branch to filter chain (third `.filter()` after existing type and target filters).

**`MessageHistoryPanel.tsx` — MODIFIED**

- Add `searchQuery: string` state via `useState("")`.
- Add `debouncedSearchQuery` via `useDebounce(searchQuery, 150)`.
- Pass `debouncedSearchQuery` to `filterHistoryEntries` in `useMemo` deps and call.
- Pass `searchQuery` and `onSearchChange` down to `HistoryFilterBar`.

**`HistoryFilterBar.tsx` — MODIFIED**

- Add `searchQuery: string` and `onSearchChange: (q: string) => void` to `HistoryFilterBarProps`.
- Add a third `Input` for the search bar, placed above the existing type+target filter inputs (search-first UX — the primary action; filters narrow a searched result set).
- Layout: change outer `div` from `flex items-center gap-2` to `flex flex-col gap-2` or a two-row layout. Decide at implementation.
- Placeholder: `"Search fields, values…"`.

### 2.7 New Components

None. All search logic integrates into existing files via additive changes.

### 2.8 Data Flow

```
User types in search Input (HistoryFilterBar)
  -> onSearchChange(value) -> MessageHistoryPanel.setSearchQuery(value)
  -> debouncedSearchQuery updates after 150ms idle
  -> useMemo re-runs: filterHistoryEntries(entries, typeFilter, targetFilter, debouncedSearchQuery)
      -> for each entry: extractSearchTokens(entry.fieldValues) -> string[]
      -> combine with [entry.messageTypeName, entry.exchange, entry.routingKey].map(toLower)
      -> entry passes if combined tokens.some(t => t.includes(normalizedQuery))
  -> HistoryTable re-renders with filtered entries
```

### 2.9 Build Order for History Search

1. Add `extractSearchTokens` to `historyHelpers.ts` + unit tests covering: oneof shape (object with `_selected`), map-as-pairs (array of `{key,value}`), nested message, repeated scalars, null values, depth cap at 10.
2. Update `filterHistoryEntries` with `searchQuery` param + tests for search branch (hit on field name, hit on field value, miss, empty query passthrough).
3. Update `HistoryFilterBar` props + add search Input.
4. Update `MessageHistoryPanel`: add searchQuery state, debounce, pass to filterHistoryEntries.

---

## Section 3 — Combined Build Order

History search and block apply are independent (no shared state, no shared components). Build history search first: lower risk, no architectural ripples, independently testable.

| Step | Feature | Scope | Risk |
|------|---------|-------|------|
| 1 | History Search | `historyHelpers.ts` — add `extractSearchTokens` + tests | Very low |
| 2 | History Search | `filterHistoryEntries` update + tests | Very low |
| 3 | History Search | `HistoryFilterBar` + `MessageHistoryPanel` wiring | Low |
| 4 | Block Apply | `src/lib/blockApply.ts` types + pure helpers + tests | Low |
| 5 | Block Apply | `BlockApplyConflictDialog` component + tests | Low |
| 6 | Block Apply | `ProtoFormRenderer` — two-phase refs + extended eligibility | Medium |
| 7 | Block Apply | `FormPanel` — two-phase ref wiring + dialog integration | Medium |
| 8 | Block Apply | Integration tests: all field type paths | Medium |

---

## Section 4 — Explicit New vs Modified

### New files

| File | Purpose |
|------|---------|
| `src/lib/blockApply.ts` | Exported types (`ApplyPlan`, `FieldConflict`, `ApplyDecision`) + pure helpers (`buildApplyPlan`, `classifyBlockKey`) |
| `src/components/blocks/BlockApplyConflictDialog.tsx` | Per-field overwrite/skip dialog; stateless prop receiver |

### Modified files

| File | Change summary |
|------|---------------|
| `src/components/form/ProtoFormRenderer.tsx` | Replace `applyBlockRef` with `planApplyBlockRef` + `commitApplyBlockRef`; extend eligible set to oneof/WKT/map; populate both refs in `useEffect` |
| `src/components/form/FormPanel.tsx` | Replace single ref; add `pendingApplyPlan` local state; wire `BlockApplyConflictDialog`; orchestrate two-phase flow in `useDndMonitor.onDragEnd` |
| `src/components/history/historyHelpers.ts` | Add `extractSearchTokens`; update `filterHistoryEntries` signature with `searchQuery` |
| `src/components/history/HistoryFilterBar.tsx` | Add search Input + `searchQuery` / `onSearchChange` props |
| `src/components/history/MessageHistoryPanel.tsx` | Add `searchQuery` state + debounce; pass to `filterHistoryEntries` |

### Unchanged files

| File | Why untouched |
|------|--------------|
| `ProtoFormRenderer` switch body | Frozen per D-01 — no new cases added |
| `OneofField`, `WellKnownTypeField`, `MapField` | No block-apply logic inside field components; apply happens via `setValue` from outside |
| `useHistoryStore` | No index-time change; `HistoryEntry` shape unchanged |
| `AppLayout` | DndContext mount point unchanged |
| `BlockLibraryPanel` | DnD drag source unchanged |

---

## Section 5 — Open Questions / Decision Points

**BA-D1 (Block Apply): Dialog default state for conflict rows.**
Recommendation: default to `'skip'` (conservative — no silent overwrite). Alternative: `'overwrite'` (matches current non-dirty behavior). One-line change in `BlockApplyConflictDialog` initial state; decide at build planning.

**BA-D2 (Block Apply): Repeated field exclusion.**
All repeated fields (regardless of inner type) are excluded from block apply in v1.7 due to ambiguous append/replace semantics. Document in `buildApplyPlan` JSDoc so a future milestone can add explicit mode selection.

**BA-D3 (Block Apply): Dirty detection granularity for oneof.**
Top-level `dirtyFields[key]` check: if a user has touched `payment.card_number`, the entire `payment` oneof key is treated as dirty. This is safe (conservative). Sub-field granularity is a future enhancement.

**HS-D1 (History Search): Search Input layout in HistoryFilterBar.**
Placing search above the type+target filters requires a layout change from `flex-row` to `flex-col`. Confirm at implementation — the RightPanel column is 320px wide, which accommodates a stacked layout cleanly.
