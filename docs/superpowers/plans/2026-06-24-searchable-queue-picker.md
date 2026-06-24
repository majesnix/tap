# Searchable Queue/Target Pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the publish-target and subscribe/drain queue pickers searchable by replacing their non-filterable shadcn `Select` dropdowns with a shared, filter-as-you-type combobox.

**Architecture:** Add one reusable `SearchableSelect` component built on the existing shadcn `Popover` + `Command` (cmdk) idiom (the same primitives `RoutingKeyCombobox` already uses). Swap it into the two Live-mode pickers (`PublishBar` target, `ResponseQueuePicker`). No backend/IPC changes — existing `fetch_queues` / `fetch_exchanges` are reused unchanged.

**Tech Stack:** React 18 + TypeScript, shadcn/ui (`Popover`, `Command`/cmdk, `Button`), Vitest + @testing-library/react (jsdom).

## Global Constraints

- **Filter-only:** in Live mode the picker only lets the user select an existing queue/exchange; typing filters the list and never commits an arbitrary value. Manual mode (no Management API / 401) keeps its existing free-text `<Input>` untouched.
- **Component location:** `src/components/ui/searchable-select.tsx` (kebab-case, matching the `ui/` folder convention).
- **Width parity:** default trigger width `w-48` so both bars' layout/flex-wrap is unchanged.
- **TS style:** explicit prop types via a named `interface`; no `React.FC`; avoid `any`.
- **jsdom test idiom:** cmdk/Radix portals don't work in jsdom. Unit-test the component by mocking `@/components/ui/command` and `@/components/ui/popover` with plain DOM (pattern: `src/components/publish/__tests__/RoutingKeyCombobox.test.tsx`). In integration tests, mock `@/components/ui/searchable-select` itself with a native `<select role="combobox">` (pattern: the existing `@/components/ui/select` mock in those test files).
- **Commands:** run a single test file with `pnpm exec vitest run <path>`; full suite with `pnpm test`; typecheck with `pnpm exec tsc --noEmit`.

---

### Task 1: `SearchableSelect` component

**Files:**
- Create: `src/components/ui/searchable-select.tsx`
- Test: `src/components/ui/searchable-select.test.tsx`

**Interfaces:**
- Consumes: shadcn `Popover`/`PopoverContent`/`PopoverTrigger` from `@/components/ui/popover`; `Command`/`CommandEmpty`/`CommandGroup`/`CommandInput`/`CommandItem`/`CommandList` from `@/components/ui/command`; `Button` from `@/components/ui/button`; `cn` from `@/lib/utils`; `ChevronsUpDown`, `Check` from `lucide-react`.
- Produces:
  ```ts
  export interface SearchableSelectItem {
    value: string;
    badge?: React.ReactNode;
  }
  export function SearchableSelect(props: {
    items: SearchableSelectItem[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/searchable-select.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchableSelect } from "./searchable-select";

// Mock cmdk + Radix Popover — jsdom incompatibility.
// Pattern from src/components/publish/__tests__/RoutingKeyCombobox.test.tsx.
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input placeholder={placeholder} aria-label="filter" />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <li role="status">{children}</li>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandItem: ({
    value,
    onSelect,
    children,
  }: {
    value: string;
    onSelect?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <li role="option" onClick={() => onSelect?.(value)}>
      {children}
    </li>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div role="listbox">{children}</div>
  ),
}));

describe("SearchableSelect", () => {
  const defaultProps = {
    items: [{ value: "orders" }, { value: "payments" }],
    value: "",
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the placeholder when value is empty", () => {
    render(<SearchableSelect {...defaultProps} placeholder="Select queue…" />);
    expect(screen.getByText("Select queue…")).toBeInTheDocument();
  });

  it("shows the selected value on the trigger", () => {
    render(<SearchableSelect {...defaultProps} items={[]} value="orders" />);
    expect(screen.getByText("orders")).toBeInTheDocument();
  });

  it("renders each item as an option", () => {
    render(<SearchableSelect {...defaultProps} />);
    expect(screen.getByRole("option", { name: /orders/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /payments/ })).toBeInTheDocument();
  });

  it("calls onChange with the item value when an item is selected", () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByRole("option", { name: /payments/ }));
    expect(onChange).toHaveBeenCalledWith("payments");
  });

  it("renders a trailing badge when provided", () => {
    render(
      <SearchableSelect
        {...defaultProps}
        items={[{ value: "logs", badge: <span>[fanout]</span> }]}
      />
    );
    expect(screen.getByText("[fanout]")).toBeInTheDocument();
  });

  it("renders the empty text", () => {
    render(<SearchableSelect {...defaultProps} items={[]} emptyText="No queues found." />);
    expect(screen.getByText("No queues found.")).toBeInTheDocument();
  });

  it("renders the search placeholder on the filter input", () => {
    render(<SearchableSelect {...defaultProps} searchPlaceholder="Filter queues…" />);
    expect(screen.getByPlaceholderText("Filter queues…")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/ui/searchable-select.test.tsx`
Expected: FAIL — cannot resolve `./searchable-select` / `SearchableSelect is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/ui/searchable-select.tsx`:

```tsx
import { useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface SearchableSelectItem {
  /** The queue/exchange name — also the cmdk filter key and the committed value. */
  value: string;
  /** Optional trailing element rendered after the label (e.g. an exchange [type] badge). */
  badge?: React.ReactNode;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Filter-as-you-type combobox over a known list of values (queues/exchanges).
 *
 * Filter-only: typing narrows the list; selection commits the item's exact `value`.
 * We pass `item.value` to onChange (not the cmdk onSelect argument) so names keep
 * their original casing — cmdk lowercases the value it hands back to onSelect.
 */
export function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Filter…",
  emptyText = "No results.",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-48 h-9 justify-between border-input bg-background font-normal",
            className
          )}
        >
          <span className="truncate text-left flex-1" title={value || undefined}>
            {value || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate" title={item.value}>
                    {item.value}
                  </span>
                  {item.badge}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/ui/searchable-select.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/searchable-select.tsx src/components/ui/searchable-select.test.tsx
git commit -m "feat(ui): add SearchableSelect filter-as-you-type combobox"
```

---

### Task 2: Integrate into `PublishBar` (target picker)

**Files:**
- Modify: `src/components/publish/PublishBar.tsx:417-449` (Live-mode target `<Select>` → `<SearchableSelect>`)
- Modify: `src/components/publish/__tests__/PublishBar.test.tsx` (add a `SearchableSelect` mock)
- Modify: `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx` (add a `SearchableSelect` mock)

**Interfaces:**
- Consumes: `SearchableSelect`, `SearchableSelectItem` from Task 1.
- Produces: nothing new (internal UI swap; `selectedQueue`/`selectedExchange` state and `setSelectedQueue`/`setSelectedExchange` setters are unchanged).

**Context:** `PublishBar` renders **two** comboboxes — the profile quick-switch `Select` (line ~353, **keep as `Select`**) and the target picker (line ~418, **swap**). The Live branch only renders when `managementStatus === "live"`; the Manual branch (`<Input>`) is untouched. The existing exchange item renders a `[type]` `Badge`; preserve it via the `badge` prop.

- [ ] **Step 1: Update the integration-test mocks first (still green against old code)**

In `src/components/publish/__tests__/PublishBar.test.tsx`, add this mock next to the existing `vi.mock("@/components/ui/select", …)` block (do NOT remove the select mock — the profile select still uses it):

```tsx
// Mock SearchableSelect with a native <select> — cmdk/Radix portals don't work in jsdom.
// Renders one <option> per item so fireEvent.change(value) works; keeps role="combobox"
// so getTargetCombobox() (last combobox in the DOM) still resolves to the target picker.
vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    placeholder,
    items,
  }: {
    value?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    items: { value: string }[];
  }) => (
    <select role="combobox" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.value}
        </option>
      ))}
    </select>
  ),
}));
```

In `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`, add the **same** mock block next to its existing `vi.mock("@/components/ui/select", …)` block (defensive — keeps PublishBar from rendering real cmdk if a quick-switch test ever goes Live).

- [ ] **Step 2: Run both PublishBar test files — they must still pass unchanged**

Run: `pnpm exec vitest run src/components/publish/__tests__/PublishBar.test.tsx src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`
Expected: PASS (mock is added but `PublishBar.tsx` still renders the old `Select`, which is also mocked — both comboboxes present, suite green).

- [ ] **Step 3: Swap the component in `PublishBar.tsx`**

Add the import near the other `@/components/ui` imports at the top of `src/components/publish/PublishBar.tsx`:

```tsx
import { SearchableSelect } from "@/components/ui/searchable-select";
```

Replace the Live-mode `<Select>…</Select>` block (lines ~418-449) with:

```tsx
          <SearchableSelect
            className="w-48"
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
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground font-semibold"
                      >
                        [{ex.exchange_type}]
                      </Badge>
                    ),
                  }))
                : queues.map((name) => ({ value: name }))
            }
          />
```

Leave the surrounding `managementStatus === "live" ? ( … ) : ( <Input …/> )` ternary and the Manual `<Input>` branch exactly as they are. Do not touch the profile `<Select>` at line ~353.

- [ ] **Step 4: Remove now-unused `Select` imports only if the profile select no longer needs them**

The profile picker still uses `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, so **keep** the `@/components/ui/select` import. Verify with:

Run: `pnpm exec tsc --noEmit`
Expected: no errors, no "unused import" complaints. If `tsc` reports an unused select-subcomponent, remove only that specific unused name from the import.

- [ ] **Step 5: Run the PublishBar test files to verify they pass against the new component**

Run: `pnpm exec vitest run src/components/publish/__tests__/PublishBar.test.tsx src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`
Expected: PASS. `getTargetCombobox()` resolves to the mocked `SearchableSelect` (last `combobox`); `fireEvent.change` against its options drives `selectedQueue`/`selectedExchange` exactly as before.

If any test fails because it asserted Select-specific text (e.g. a placeholder `<option>`): the mock above already renders the placeholder option and one option per item — adjust only the failing assertion's queried text to match `placeholder`/item values, not the interaction.

- [ ] **Step 6: Commit**

```bash
git add src/components/publish/PublishBar.tsx \
        src/components/publish/__tests__/PublishBar.test.tsx \
        src/components/publish/__tests__/PublishBar-quickswitch.test.tsx
git commit -m "feat(publish): make target queue/exchange picker searchable"
```

---

### Task 3: Integrate into `ResponseQueuePicker` (subscribe/drain)

**Files:**
- Modify: `src/components/response/ResponseQueuePicker.tsx:151-163` (Live-mode queue `<Select>` → `<SearchableSelect>`)
- Modify: `src/components/response/ResponseQueuePicker.test.tsx` (replace the `Select` mock with a `SearchableSelect` mock)

**Interfaces:**
- Consumes: `SearchableSelect` from Task 1.
- Produces: nothing new (`selectedQueue`/`setSelectedQueue` from `useResponseStore` unchanged).

**Context:** Live branch renders the `<Select>` over `queueList`; Manual branch renders a free-text `<Input>` — keep it. After this swap the component no longer uses `Select`, so its `@/components/ui/select` import is removed.

- [ ] **Step 1: Replace the test mock**

In `src/components/response/ResponseQueuePicker.test.tsx`, **replace** the existing `vi.mock("@/components/ui/select", …)` block with a `SearchableSelect` mock that preserves the queried accessible name (`aria-label="queue select"`) and renders one `<option>` per item (tests query `getByRole("option", { name: "queue-a" })`):

```tsx
// Mock SearchableSelect with a native <select> — cmdk/Radix portals don't work in jsdom.
vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    items,
  }: {
    value?: string;
    onChange: (v: string) => void;
    items: { value: string }[];
  }) => (
    <select
      role="combobox"
      aria-label="queue select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.value}
        </option>
      ))}
    </select>
  ),
}));
```

- [ ] **Step 2: Run the test file — expect failure**

Run: `pnpm exec vitest run src/components/response/ResponseQueuePicker.test.tsx`
Expected: FAIL — `ResponseQueuePicker.tsx` still renders the real `Select` (now unmocked → cmdk/Radix or Select Radix errors in jsdom), or option queries miss. This confirms the test now targets `SearchableSelect`.

- [ ] **Step 3: Swap the component in `ResponseQueuePicker.tsx`**

Add the import near the other `@/components/ui` imports:

```tsx
import { SearchableSelect } from "@/components/ui/searchable-select";
```

Replace the Live-mode `<Select>…</Select>` block (lines ~152-163) with:

```tsx
        <SearchableSelect
          className="w-48"
          value={selectedQueue}
          onChange={setSelectedQueue}
          placeholder="Select queue…"
          searchPlaceholder="Filter queues…"
          emptyText="No queues found."
          items={queueList.map((name) => ({ value: name }))}
        />
```

Remove the now-unused `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` import (the block at lines ~6-12). Keep the `Input` import (Manual branch still uses it).

- [ ] **Step 4: Run the test file to verify it passes**

Run: `pnpm exec vitest run src/components/response/ResponseQueuePicker.test.tsx`
Expected: PASS. The mocked `SearchableSelect` renders `role="combobox"` + an `<option>` per queue, satisfying the existing option/select queries.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (no unused `Select*` imports remaining).

- [ ] **Step 6: Run the full suite with coverage gate**

Run: `pnpm test`
Expected: all test files PASS. Confirm overall coverage stays ≥80% (the new component is covered by Task 1; both integration sites remain covered).

- [ ] **Step 7: Commit**

```bash
git add src/components/response/ResponseQueuePicker.tsx \
        src/components/response/ResponseQueuePicker.test.tsx
git commit -m "feat(response): make subscribe/drain queue picker searchable"
```

---

## Manual verification (after all tasks)

1. `pnpm tauri dev`, connect to a RabbitMQ profile with the Management API reachable (Live badge).
2. **Publish bar:** open the target picker — confirm a filter input appears, typing narrows the queue list, and selecting commits the queue. Switch to Exchange mode — confirm the `[type]` badge still shows per exchange and filtering works.
3. **Subscribe/drain (Response tab):** open the queue picker — confirm filtering works and a selected queue drives the depth pill/drain.
4. Disconnect / use a profile without the Management API — confirm both pickers fall back to the free-text `Input` (Manual mode) unchanged.
