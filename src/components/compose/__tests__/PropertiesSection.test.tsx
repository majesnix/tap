import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertiesSection } from "@/components/compose/PropertiesSection";
import { useAmqpStore, INITIAL_PROPERTIES, MAX_HEADERS } from "@/stores/useAmqpStore";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn() })
);
vi.mock("sonner", () => ({ toast: toastMock }));

// Radix Popover portals do not work in jsdom — render the content inline.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderSection() {
  const onApplied = vi.fn();
  const utils = render(<PropertiesSection onApplied={onApplied} />);
  return { ...utils, onApplied };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAmqpStore.setState({ properties: { ...INITIAL_PROPERTIES, headers: [] } });
});

describe("draft syncing", () => {
  it("shows the committed properties when it opens", () => {
    useAmqpStore.setState({
      properties: {
        ...INITIAL_PROPERTIES,
        contentType: "application/x-protobuf",
        correlationId: "req-7c1e",
        replyTo: "orders.reply",
        headers: [{ key: "x-tenant", value: "acme" }],
      },
    });
    renderSection();
    expect(screen.getByLabelText("Content type")).toHaveValue("application/x-protobuf");
    expect(screen.getByLabelText("Correlation ID")).toHaveValue("req-7c1e");
    expect(screen.getByLabelText("Reply-to")).toHaveValue("orders.reply");
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
  });

  it("does not touch the store before Apply", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("Reply-to"), { target: { value: "orders.reply" } });
    expect(useAmqpStore.getState().properties.replyTo).toBeNull();
  });
});

describe("apply and reset", () => {
  it("commits properties and headers on Apply", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("Reply-to"), { target: { value: "orders.reply" } });
    fireEvent.change(screen.getByLabelText("TTL"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const properties = useAmqpStore.getState().properties;
    expect(properties.replyTo).toBe("orders.reply");
    expect(properties.ttl).toBe(500);
  });

  it("closes the section after Apply", () => {
    const { onApplied } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("restores the defaults on Reset", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("Reply-to"), { target: { value: "orders.reply" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(screen.getByLabelText("Reply-to")).toHaveValue("");
    expect(screen.getByLabelText("Content type")).toHaveValue(INITIAL_PROPERTIES.contentType);
  });

  it("switches delivery mode to transient", () => {
    renderSection();
    fireEvent.click(screen.getByRole("radio", { name: "Transient" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(useAmqpStore.getState().properties.deliveryMode).toBe(1);
  });
});

describe("TTL validation", () => {
  it("rejects a negative TTL", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("TTL"), { target: { value: "-5" } });
    expect(screen.getByText("TTL must be a non-negative integer (ms)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(useAmqpStore.getState().properties.ttl).toBeNull();
  });

  it("clears the TTL when the field is emptied", () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("TTL"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("TTL"), { target: { value: "" } });
    expect(screen.queryByText("TTL must be a non-negative integer (ms)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(useAmqpStore.getState().properties.ttl).toBeNull();
  });
});

describe("headers", () => {
  it("adds a header and counts it", () => {
    renderSection();
    fireEvent.change(screen.getByPlaceholderText("Header key"), {
      target: { value: "x-tenant" },
    });
    fireEvent.change(screen.getByPlaceholderText("Header value"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Add header" }));

    expect(screen.getByText("1 / 20")).toBeInTheDocument();
    expect(screen.getByText("x-tenant")).toBeInTheDocument();
  });

  it("removes a header from its pill", () => {
    useAmqpStore.setState({
      properties: {
        ...INITIAL_PROPERTIES,
        headers: [
          { key: "x-tenant", value: "acme" },
          { key: "x-source", value: "tap" },
        ],
      },
    });
    renderSection();
    expect(screen.getByText("2 / 20")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove header x-tenant" }));
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
    expect(screen.queryByText("x-tenant")).not.toBeInTheDocument();
  });

  it("caps the header count", () => {
    useAmqpStore.setState({
      properties: {
        ...INITIAL_PROPERTIES,
        headers: Array.from({ length: MAX_HEADERS }, (_, i) => ({
          key: `k${i}`,
          value: String(i),
        })),
      },
    });
    renderSection();
    fireEvent.change(screen.getByPlaceholderText("Header key"), { target: { value: "one-too-many" } });
    fireEvent.click(screen.getByRole("button", { name: "Add header" }));
    expect(toastMock.error).toHaveBeenCalledWith("Maximum 20 custom headers reached");
    expect(screen.getByText("20 / 20")).toBeInTheDocument();
  });

  it("ignores an empty header key", () => {
    renderSection();
    fireEvent.change(screen.getByPlaceholderText("Header value"), { target: { value: "acme" } });
    expect(screen.getByRole("button", { name: "Add header" })).toBeDisabled();
  });
});
