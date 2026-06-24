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
    // Intentionally pass lowercased value to onSelect — mirrors cmdk's real behaviour.
    // The component must use item.value from its closure, not this callback argument.
    <li role="option" onClick={() => onSelect?.(value.toLowerCase())}>
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

  it("disables the trigger button when disabled prop is true", () => {
    render(<SearchableSelect {...defaultProps} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("trigger button is enabled by default", () => {
    render(<SearchableSelect {...defaultProps} />);
    expect(screen.getByRole("combobox")).not.toBeDisabled();
  });

  it("commits the item's exact value preserving original casing", () => {
    // Item has mixed-case value. The mock calls onSelect with value.toLowerCase()
    // ("myqueue"), so if the component relied on the callback arg it would call
    // onChange("myqueue"). The component must ignore the arg and use item.value.
    const onChange = vi.fn();
    render(
      <SearchableSelect
        {...defaultProps}
        items={[{ value: "MyQueue" }]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("option", { name: /MyQueue/i }));
    expect(onChange).toHaveBeenCalledWith("MyQueue");
    expect(onChange).not.toHaveBeenCalledWith("myqueue");
  });
});
