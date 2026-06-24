# Searchable Queue/Target Pickers — Design

**Date:** 2026-06-24
**Status:** Approved (pending spec review)

## Problem

When a RabbitMQ broker has many queues (or exchanges), the current target pickers
are plain shadcn `Select` dropdowns with no filtering. Finding the right queue means
scrolling a long, unsorted list — tedious and error-prone.

There are two affected pickers, both using the same non-searchable `Select`:

1. **`PublishBar`** — the publish *target* picker (queue or exchange), Live mode.
2. **`ResponseQueuePicker`** — the subscribe/drain queue picker, Live mode.

Both should be searchable.

## Decisions

- **Scope:** Both pickers become searchable (consistent UX).
- **Filter-only:** In Live mode the user can only pick from real queues/exchanges
  returned by the Management API; typing only narrows the list. No free-type commit.
  Prevents typos and sending to non-existent targets. **Manual mode** (no Management
  API / 401) keeps its existing free-text `Input` unchanged.
- **Shared component:** Extract one reusable `SearchableSelect` combobox used by both
  call sites (DRY; matches the existing `RoutingKeyCombobox` / decode-types idiom).

## Architecture

Reuse the established combobox idiom already present in the codebase
(`RoutingKeyCombobox`, decode-types picker): shadcn `Popover` + `Command` (cmdk).
No backend/IPC changes — existing `fetch_queues` / `fetch_exchanges` are reused as-is.

### Component: `SearchableSelect`

Location: `src/components/ui/searchable-select.tsx` (kebab-case, matching the
`ui/` folder convention for generic widgets).

```ts
interface SearchableSelectItem {
  value: string;            // queue/exchange name (also the cmdk filter key)
  badge?: React.ReactNode;  // optional trailing badge (e.g. exchange [type])
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;        // trigger label, e.g. "Select queue…"
  searchPlaceholder?: string;  // command input, e.g. "Filter queues…"
  emptyText?: string;          // e.g. "No queues found."
  className?: string;          // defaults to w-48 to match the current Select
  disabled?: boolean;
}
```

**Behavior:**

- Outline trigger button mirrors existing combobox triggers: shows the selected
  `value` or a muted `placeholder`, with a trailing `ChevronsUpDown` icon.
- Click opens a popover containing a `CommandInput` over a `CommandList`.
- Typing filters items via cmdk's built-in substring matching on `value`.
- Each `CommandItem` shows a `Check` when selected and renders its optional `badge`.
- Selecting an item fires `onChange(value)` and closes the popover.
- Arrow-key / Enter navigation provided natively by cmdk.
- **Filter-only:** the input narrows the list; it never commits an arbitrary value.

## Call-site integration

Changes are confined to the **Live-mode** branch of each picker. The **Manual-mode**
branch (plain free-text `Input`) is untouched. Status badges, queue-depth pill,
decode picker, and drain controls are all unchanged.

### `PublishBar.tsx` (~lines 417–449)

Replace the `<Select>` with `SearchableSelect`:

```tsx
<SearchableSelect
  value={mode === "queue" ? selectedQueue : selectedExchange}
  onChange={mode === "queue" ? setSelectedQueue : setSelectedExchange}
  placeholder={mode === "queue" ? "Select queue…" : "Select exchange…"}
  searchPlaceholder={mode === "queue" ? "Filter queues…" : "Filter exchanges…"}
  emptyText={mode === "queue" ? "No queues found." : "No exchanges found."}
  items={
    mode === "exchange"
      ? exchanges.map((ex) => ({
          value: ex.name,
          badge: (
            <Badge variant="outline" className="text-xs text-muted-foreground font-semibold">
              [{ex.exchange_type}]
            </Badge>
          ),
        }))
      : queues.map((name) => ({ value: name }))
  }
/>
```

### `ResponseQueuePicker.tsx` (~lines 151–163)

```tsx
<SearchableSelect
  value={selectedQueue}
  onChange={setSelectedQueue}
  placeholder="Select queue…"
  searchPlaceholder="Filter queues…"
  emptyText="No queues found."
  items={queueList.map((name) => ({ value: name }))}
/>
```

## Edge cases

- **Empty list (Live):** `CommandEmpty` renders `emptyText`.
- **Selected value deleted between fetches:** trigger keeps showing the stored `value`
  (no crash); user can re-pick. Matches current `Select` behavior.
- **Long names:** trigger truncates (`truncate`); items truncate with a `title`
  attribute exposing the full name.
- **Width parity:** default `w-48` keeps both bars' layout / flex-wrap unchanged.

## Testing

- **New** `searchable-select.test.tsx` (AAA pattern):
  - renders all items
  - typing filters the list
  - selecting an item calls `onChange` with its value and closes
  - `Check` appears on the selected item
  - renders a `badge` when provided
  - shows `emptyText` when nothing matches
- **Update** existing tests that drive the old `Select` (open trigger → click
  `SelectItem`) to use the combobox interaction (open popover → optionally type →
  click `CommandItem`):
  - `src/components/publish/__tests__/PublishBar.test.tsx`
  - `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`
  - `src/components/response/ResponseQueuePicker.test.tsx`
- Maintain ≥80% coverage. No Rust/backend test changes (no backend changes).

## Out of scope

- No JSON/manual-mode behavior changes.
- No backend/IPC changes.
- No sorting or grouping of queues beyond the existing fetch order (filtering only).
