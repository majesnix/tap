import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoutingKeyCombobox } from "../RoutingKeyCombobox";

// Mock cmdk + Radix Popover — jsdom incompatibility (same pattern as PublishBar.test.tsx Select mock)
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    placeholder,
    value,
    onValueChange,
  }: {
    placeholder?: string;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <input
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      aria-label="Filter keys"
    />
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
  PopoverTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <button>{children}</button>),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div role="listbox">{children}</div>
  ),
}));

describe("RoutingKeyCombobox", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    bindingKeys: [],
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows placeholder when value is empty", () => {
    render(<RoutingKeyCombobox {...defaultProps} />);
    expect(screen.getByText("Routing key")).toBeInTheDocument();
  });

  it("shows Loader2 spinner when isLoading=true", () => {
    render(<RoutingKeyCombobox {...defaultProps} isLoading={true} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders suggestion items from bindingKeys", () => {
    render(
      <RoutingKeyCombobox
        {...defaultProps}
        bindingKeys={["orders.eu", "orders.us"]}
      />
    );
    expect(screen.getByRole("option", { name: /orders\.eu/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /orders\.us/ })).toBeInTheDocument();
  });

  it("calls onChange when a suggestion is selected", () => {
    const onChange = vi.fn();
    render(
      <RoutingKeyCombobox
        {...defaultProps}
        onChange={onChange}
        bindingKeys={["orders.eu"]}
      />
    );
    fireEvent.click(screen.getByRole("option", { name: /orders\.eu/ }));
    expect(onChange).toHaveBeenCalledWith("orders.eu");
  });

  it("calls onChange when user types in CommandInput", () => {
    const onChange = vi.fn();
    render(<RoutingKeyCombobox {...defaultProps} onChange={onChange} />);
    const input = screen.getByLabelText("Filter keys");
    fireEvent.change(input, { target: { value: "ord" } });
    expect(onChange).toHaveBeenCalledWith("ord");
  });

  it("CommandInput value matches the value prop (controlled free-type D-02)", () => {
    render(<RoutingKeyCombobox {...defaultProps} value="orders.eu" />);
    const input = screen.getByLabelText("Filter keys");
    expect(input).toHaveValue("orders.eu");
  });

  it("renders amber 'pattern' badge for wildcard keys with *", () => {
    render(
      <RoutingKeyCombobox
        {...defaultProps}
        bindingKeys={["orders.*.created"]}
      />
    );
    expect(screen.getByText("pattern")).toBeInTheDocument();
  });

  it("renders amber 'pattern' badge for wildcard keys with #", () => {
    render(
      <RoutingKeyCombobox
        {...defaultProps}
        bindingKeys={["orders.#"]}
      />
    );
    expect(screen.getByText("pattern")).toBeInTheDocument();
  });

  it("does NOT render pattern badge for exact keys", () => {
    render(
      <RoutingKeyCombobox
        {...defaultProps}
        bindingKeys={["orders.eu"]}
      />
    );
    expect(screen.queryByText("pattern")).not.toBeInTheDocument();
  });

  it("selects wildcard pattern as-is (D-09) — copies exact string without modification", () => {
    const onChange = vi.fn();
    render(
      <RoutingKeyCombobox
        {...defaultProps}
        onChange={onChange}
        bindingKeys={["orders.*.created"]}
      />
    );
    fireEvent.click(screen.getByRole("option", { name: /orders\.\*\.created/ }));
    expect(onChange).toHaveBeenCalledWith("orders.*.created");
  });
});
