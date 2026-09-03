import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DestinationStrip } from "@/components/compose/DestinationStrip";
import type { useDestination } from "@/components/compose/useDestination";
import { useAmqpStore, INITIAL_PROPERTIES } from "@/stores/useAmqpStore";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

// cmdk/Radix portals do not work in jsdom — render a native select instead.
vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    placeholder,
    items,
    meta,
  }: {
    value?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    items: { value: string }[];
    meta?: React.ReactNode;
  }) => (
    <span>
      <select
        aria-label="target"
        role="combobox"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.value}
          </option>
        ))}
      </select>
      <span data-testid="target-meta">{meta}</span>
    </span>
  ),
}));

vi.mock("@/components/compose/RoutingKeyCombobox", () => ({
  RoutingKeyCombobox: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
    bindingKeys: string[];
    isLoading: boolean;
  }) => (
    <input aria-label="Routing key combobox" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

type Destination = ReturnType<typeof useDestination>;

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    mode: "queue",
    setMode: vi.fn(),
    selectedQueue: "",
    setSelectedQueue: vi.fn(),
    selectedExchange: "",
    setSelectedExchange: vi.fn(),
    routingKey: "",
    setRoutingKey: vi.fn(),
    queues: ["orders", "payments"],
    exchanges: [{ name: "orders.ex", exchange_type: "topic" }],
    managementStatus: "live",
    managementAuthError: null,
    bindingKeys: [],
    isLoadingBindings: false,
    useCombobox: false,
    selectedExchangeType: "",
    targetName: "",
    hasTarget: false,
    queueDepth: null,
    ...overrides,
  } as Destination;
}

function renderStrip(overrides: Partial<Destination> = {}, propsOpen = false) {
  const onTogglePropsOpen = vi.fn();
  const utils = render(
    <DestinationStrip
      destination={makeDestination(overrides)}
      propsOpen={propsOpen}
      onTogglePropsOpen={onTogglePropsOpen}
    />
  );
  return { ...utils, onTogglePropsOpen };
}

beforeEach(() => {
  useAmqpStore.setState({ properties: { ...INITIAL_PROPERTIES, headers: [] } });
});

describe("target kind", () => {
  it("offers Queue and Exchange", () => {
    renderStrip();
    expect(screen.getByRole("radio", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Exchange" })).toBeInTheDocument();
  });

  it("switches mode when Exchange is picked", () => {
    const setMode = vi.fn();
    renderStrip({ setMode });
    fireEvent.click(screen.getByRole("radio", { name: "Exchange" }));
    expect(setMode).toHaveBeenCalledWith("exchange");
  });
});

describe("catalog status", () => {
  it("says Live catalog when the Management API answered", () => {
    renderStrip();
    expect(screen.getByText("Live catalog")).toBeInTheDocument();
  });

  it("says Manual entry when the Management API is unavailable", () => {
    const setSelectedQueue = vi.fn();
    renderStrip({ managementStatus: "manual", setSelectedQueue });
    expect(screen.getByText("Manual entry")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Queue name");
    fireEvent.change(input, { target: { value: "typed-queue" } });
    expect(setSelectedQueue).toHaveBeenCalledWith("typed-queue");
  });

  it("picks a queue from the live catalog", () => {
    const setSelectedQueue = vi.fn();
    renderStrip({ setSelectedQueue });
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "payments" } });
    expect(setSelectedQueue).toHaveBeenCalledWith("payments");
  });

  it("shows an auth failure with the broker message as its tooltip", () => {
    renderStrip({
      managementStatus: "unknown",
      managementAuthError: "Management API authentication failed: wrong credentials (HTTP 401)",
    });
    const tag = screen.getByText(/auth failed/i);
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveAttribute("title", expect.stringContaining("authentication failed"));
    expect(screen.queryByText("Manual entry")).not.toBeInTheDocument();
  });
});

describe("routing key", () => {
  it("is hidden in queue mode", () => {
    renderStrip();
    expect(screen.queryByPlaceholderText("Routing key")).not.toBeInTheDocument();
  });

  it("is a plain input in exchange mode without binding suggestions", () => {
    renderStrip({ mode: "exchange", selectedExchange: "orders.ex", selectedExchangeType: "topic" });
    expect(screen.getByPlaceholderText("Routing key")).toBeInTheDocument();
    expect(screen.queryByLabelText("Routing key combobox")).not.toBeInTheDocument();
  });

  it("types a routing key into the plain input", () => {
    const setRoutingKey = vi.fn();
    renderStrip({
      mode: "exchange",
      selectedExchange: "orders.ex",
      selectedExchangeType: "topic",
      setRoutingKey,
    });
    fireEvent.change(screen.getByPlaceholderText("Routing key"), {
      target: { value: "eu.orders" },
    });
    expect(setRoutingKey).toHaveBeenCalledWith("eu.orders");
  });

  it("is a combobox when bindings are available", () => {
    renderStrip({
      mode: "exchange",
      selectedExchange: "orders.ex",
      selectedExchangeType: "topic",
      useCombobox: true,
      bindingKeys: ["orders.eu"],
    });
    expect(screen.getByLabelText("Routing key combobox")).toBeInTheDocument();
  });

  it("explains that a fanout exchange ignores the routing key", () => {
    renderStrip({
      mode: "exchange",
      selectedExchange: "logs",
      selectedExchangeType: "fanout",
    });
    expect(screen.getByText("Routing key is ignored for fanout exchanges.")).toBeInTheDocument();
  });

  it("says nothing extra for a topic exchange", () => {
    renderStrip({ mode: "exchange", selectedExchange: "orders.ex", selectedExchangeType: "topic" });
    expect(
      screen.queryByText("Routing key is ignored for fanout exchanges.")
    ).not.toBeInTheDocument();
  });
});

describe("target meta", () => {
  it("shows the queue depth", () => {
    renderStrip({ selectedQueue: "orders", targetName: "orders", hasTarget: true, queueDepth: 12 });
    expect(screen.getByTestId("target-meta")).toHaveTextContent("12 msgs");
  });

  it("shows the exchange type in exchange mode", () => {
    renderStrip({
      mode: "exchange",
      selectedExchange: "orders.ex",
      selectedExchangeType: "topic",
      targetName: "orders.ex",
      hasTarget: true,
    });
    expect(screen.getByTestId("target-meta")).toHaveTextContent("topic");
  });
});

describe("properties summary", () => {
  it("summarises the defaults and offers to edit them", () => {
    const { onTogglePropsOpen } = renderStrip();
    const button = screen.getByTestId("properties-summary");
    expect(button).toHaveTextContent("defaults");
    expect(button).toHaveTextContent("Edit");
    fireEvent.click(button);
    expect(onTogglePropsOpen).toHaveBeenCalledTimes(1);
  });

  it("reads Done while the properties section is open", () => {
    renderStrip({}, true);
    const button = screen.getByTestId("properties-summary");
    expect(button).toHaveTextContent("Done");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("describes the committed properties", () => {
    useAmqpStore.setState({
      properties: {
        ...INITIAL_PROPERTIES,
        replyTo: "orders.reply",
        headers: [
          { key: "a", value: "1" },
          { key: "b", value: "2" },
        ],
      },
    });
    renderStrip();
    const button = screen.getByTestId("properties-summary");
    expect(button).toHaveTextContent("persistent");
    expect(button).toHaveTextContent("orders.reply");
    expect(button).toHaveTextContent("2 headers");
  });
});
