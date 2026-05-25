# Phase 24: History Full-Text Search — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 5 modified files (no new files)
**Analogs found:** 5 / 5 (all analogs are within-file existing patterns)

> This phase modifies only existing files. Each file's closest analog is the parallel
> existing pattern within that same file — `typeFilter`/`onTypeChange` is the direct
> template for the new `searchQuery`/`onSearchChange` pair throughout.

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/components/history/historyHelpers.ts` | utility | transform | existing `.filter().filter()` chain in same file (lines 16-27) | exact |
| `src/components/history/historyHelpers.test.ts` | test | — | existing `filterHistoryEntries` describe block in same file (lines 42-114) | exact |
| `src/components/history/HistoryFilterBar.tsx` | component | request-response | existing `typeFilter`/`onTypeChange` prop pair in same file (lines 3-8, 17-30) | exact |
| `src/components/history/MessageHistoryPanel.tsx` | component | request-response | existing `typeFilter`/`targetFilter` useState + useMemo pattern in same file (lines 16-28) | exact |
| `src/components/history/HistoryTable.tsx` | component | request-response | existing `isFiltered` prop check in same file (line 41-43) | exact |

---

## Pattern Assignments

### `src/components/history/historyHelpers.ts` (utility, transform)

**Analog:** Self — existing `filterHistoryEntries` function (lines 11-28)

**Core chained-filter pattern** (lines 11-28 — full current function):
```typescript
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string
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
    );
}
```

**Extension:** Add `searchQuery = ""` as 4th parameter (default preserves all existing callers).
Chain a third `.filter()` after the two existing ones. The new filter:
- Returns `true` when `!searchQuery`
- Otherwise checks `messageTypeName`, `exchange`, `routingKey` for substring match
- Then falls through to `collectFieldNames(e.fieldValues)` field-key matching

**New helper to add** (`collectFieldNames` — no analog; specified directly in D-03):
```typescript
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

**Critical guard:** `value !== null` MUST precede `typeof value === "object"` — `typeof null === "object"` in JavaScript; omitting this causes a runtime crash on any entry with a null field value.

**Import:** No new imports needed. `HistoryEntry` is already imported on line 1.

---

### `src/components/history/historyHelpers.test.ts` (test)

**Analog:** Self — existing `filterHistoryEntries` describe block (lines 42-114)

**Test factory pattern** (lines 8-20 — `makeEntry` helper):
```typescript
function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "test-id",
    timestamp: new Date().toISOString(),
    messageTypeName: "com.example.MyMessage",
    exchange: "",
    routingKey: "my.queue",
    status: "sent",
    fieldValues: {},
    payloadBytes: [],
    ...overrides,
  };
}
```

**Test describe/it pattern** (lines 42-66 — shape of each test block):
```typescript
describe("filterHistoryEntries", () => {
  const entries = [ /* makeEntry() variants */ ];

  it("returns all entries when both filters are empty", () => {
    const result = filterHistoryEntries(entries, "", "");
    expect(result).toHaveLength(3);
    expect(result).toEqual(entries);
  });
  // ...
});
```

**Extension:** Add new `it()` cases inside the existing `filterHistoryEntries` describe block testing `searchQuery` as 4th argument. Also add a new `describe("collectFieldNames")` block.

**New tests to add — by requirement:**
- `searchQuery = ""` → all entries returned (HIST-FT-06, HIST-FT-07 backward compat)
- searchQuery matches `messageTypeName` substring (HIST-FT-02)
- searchQuery matches `exchange` substring (HIST-FT-03)
- searchQuery matches `routingKey` substring (HIST-FT-03)
- searchQuery matches a top-level `fieldValues` key (HIST-FT-04)
- searchQuery matches a nested `fieldValues` key (D-03 recursion)
- searchQuery matches an array-element key (D-03 array case)
- `_selected` key is excluded from matching (D-03)
- searchQuery AND typeFilter both active — AND logic (HIST-FT-05)
- numeric key `"0"` from array index is included (D-03 accepted trade-off — assert this explicitly)
- `collectFieldNames` describe block: flat object, nested object, array of objects, null value (no crash), `_selected` excluded

**Import:** `collectFieldNames` must be added to the import on line 2:
```typescript
import { filterHistoryEntries, findReplayTabIndex, collectFieldNames } from "./historyHelpers";
```

---

### `src/components/history/HistoryFilterBar.tsx` (component, request-response)

**Analog:** Self — existing props interface and Input layout (lines 3-30)

**Props interface pattern** (lines 3-8 — current):
```typescript
interface HistoryFilterBarProps {
  typeFilter: string;
  targetFilter: string;
  onTypeChange: (query: string) => void;
  onTargetChange: (query: string) => void;
}
```

**Extension:** Add `searchQuery: string` and `onSearchChange: (query: string) => void` to the interface using the same pair convention.

**Input layout pattern** (lines 17-30 — current):
```tsx
<div className="flex items-center gap-2 px-3 py-2 border-b border-border">
  <Input
    placeholder="Filter by type…"
    value={typeFilter}
    onChange={(e) => onTypeChange(e.target.value)}
    className="h-7 text-xs flex-1"
  />
  <Input
    placeholder="Filter by queue/exchange…"
    value={targetFilter}
    onChange={(e) => onTargetChange(e.target.value)}
    className="h-7 text-xs flex-1"
  />
</div>
```

**Extension:** Add a new full-width row **above** the existing `<div>` row (D-01).
New row uses `w-full` instead of `flex-1` (single input, no sibling to share space).
No search icon (D-02). Placeholder: `"Search…"` (D-02).

```tsx
<div className="px-3 pt-2 pb-0 border-b border-border">
  <Input
    placeholder="Search…"
    value={searchQuery}
    onChange={(e) => onSearchChange(e.target.value)}
    className="h-7 text-xs w-full"
  />
</div>
{/* existing type + target row stays unchanged below */}
```

**Import:** `Input` is already imported from `@/components/ui/input` on line 1 — no new imports.

---

### `src/components/history/MessageHistoryPanel.tsx` (component, request-response)

**Analog:** Self — existing `typeFilter`/`targetFilter` state + useMemo + isFiltered pattern (lines 16-28, 127)

**useState pair pattern** (lines 16-17 — current):
```typescript
const [typeFilter, setTypeFilter] = useState("");
const [targetFilter, setTargetFilter] = useState("");
```

**Extension:** Add directly below:
```typescript
const [searchQuery, setSearchQuery] = useState("");
```

**useMemo pattern** (lines 25-28 — current):
```typescript
const filteredEntries = useMemo(
  () => filterHistoryEntries(entries, typeFilter, targetFilter),
  [entries, typeFilter, targetFilter]
);
```

**Extension:** Add `searchQuery` as 4th arg and to dependency array:
```typescript
const filteredEntries = useMemo(
  () => filterHistoryEntries(entries, typeFilter, targetFilter, searchQuery),
  [entries, typeFilter, targetFilter, searchQuery]
);
```

**isFiltered pattern** (line 127 — current):
```tsx
isFiltered={!!(typeFilter || targetFilter)}
```

**Extension:** Include `searchQuery`:
```tsx
isFiltered={!!(typeFilter || targetFilter || searchQuery)}
```

**Count label pattern** (lines 106-108 — current):
```tsx
<span className="text-xs font-semibold text-muted-foreground">
  {entries.length} / 100
</span>
```

**Extension (D-04):** Conditional based on whether any filter is active:
```tsx
const isFiltered = !!(typeFilter || targetFilter || searchQuery);
// ...
<span className="text-xs font-semibold text-muted-foreground">
  {isFiltered
    ? `${filteredEntries.length} of ${entries.length} / 100`
    : `${entries.length} / 100`}
</span>
```

**HistoryFilterBar usage pattern** (lines 118-123 — current):
```tsx
<HistoryFilterBar
  typeFilter={typeFilter}
  targetFilter={targetFilter}
  onTypeChange={setTypeFilter}
  onTargetChange={setTargetFilter}
/>
```

**Extension:** Add `searchQuery` and `onSearchChange`:
```tsx
<HistoryFilterBar
  typeFilter={typeFilter}
  targetFilter={targetFilter}
  searchQuery={searchQuery}
  onTypeChange={setTypeFilter}
  onTargetChange={setTargetFilter}
  onSearchChange={setSearchQuery}
/>
```

**Import:** No new imports needed. `useState`, `useMemo`, `filterHistoryEntries`, and `HistoryFilterBar` are already imported.

---

### `src/components/history/HistoryTable.tsx` (component, request-response)

**Analog:** Self — existing `isFiltered` prop check (lines 16-46)

**isFiltered prop interface** (lines 16-21 — current):
```typescript
interface HistoryTableProps {
  entries: HistoryEntry[];
  isFiltered?: boolean;
  onReplay?: (entry: HistoryEntry) => void;
  onResend?: (entry: HistoryEntry) => void;
}
```

**Usage in empty-state** (lines 38-46 — current):
```tsx
if (entries.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs p-4 text-center">
      {isFiltered
        ? "No entries match the current filter."
        : "No messages sent yet. Send a message to see history here."}
    </div>
  );
}
```

**Extension:** `HistoryTable` itself needs **no code change**. The `isFiltered` prop interface stays the same (`boolean`). The parent `MessageHistoryPanel` now passes a value that accounts for all three filters — this component simply receives the updated boolean and renders the correct empty-state message automatically.

No file edits required to `HistoryTable.tsx` beyond verifying the prop is correctly forwarded from the parent.

---

## Shared Patterns

### shadcn/ui Input usage
**Source:** `src/components/history/HistoryFilterBar.tsx` line 1, lines 18-22
**Apply to:** HistoryFilterBar.tsx search input row

```typescript
import { Input } from "@/components/ui/input";
// ...
<Input
  placeholder="…"
  value={value}
  onChange={(e) => onChange(e.target.value)}
  className="h-7 text-xs flex-1"   // use w-full for single full-width input
/>
```

The `h-7 text-xs` sizing convention is the project standard for history panel filter controls (D-02).

### Filter guard pattern
**Source:** `src/components/history/historyHelpers.ts` lines 17-20
**Apply to:** `filterHistoryEntries` searchQuery filter stage

```typescript
.filter((e) => !filterValue || /* match logic */)
```

When `filterValue` is falsy (empty string), return `true` immediately — no match needed. This pattern provides backward compatibility and zero-cost pass-through for empty filters.

### useState filter state pair
**Source:** `src/components/history/MessageHistoryPanel.tsx` lines 16-17
**Apply to:** `searchQuery` addition in `MessageHistoryPanel`

```typescript
const [xFilter, setXFilter] = useState("");
```

All three filter states follow this same `useState("")` initialization pattern. State lives in `MessageHistoryPanel`, not in `HistoryFilterBar` (controlled component pattern).

---

## No Analog Found

None. All modified files have exact within-file analogs for their extension patterns. `collectFieldNames` has no prior analog in the codebase but is fully specified by D-03 in CONTEXT.md — the RESEARCH.md Pattern 2 excerpt is the authoritative reference.

---

## Metadata

**Analog search scope:** `src/components/history/` (all five files read directly)
**Files scanned:** 6 (5 history component files + `src/stores/useHistoryStore.ts` for type reference)
**Pattern extraction date:** 2026-05-25
