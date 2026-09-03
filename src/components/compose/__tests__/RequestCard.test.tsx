import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { RequestCard } from "@/components/compose/RequestCard";
import type { ComposeSignals } from "@/components/layout/ComposeView";
import { useProtoStore } from "@/stores/useProtoStore";
import { useDraftStore } from "@/stores/useDraftStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { MessageSchema, ProtoSchema } from "@/lib/types";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn() }),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue([]) }));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: vi.fn() }));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

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
    <select aria-label="target" role="combobox" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.value}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/compose/RoutingKeyCombobox", () => ({
  RoutingKeyCombobox: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Routing key combobox" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const { dndKit } = vi.hoisted(() => ({ dndKit: { isOver: false } }));
vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ isOver: dndKit.isOver, setNodeRef: vi.fn() })),
  useDndMonitor: vi.fn(),
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));
import { useDroppable } from "@dnd-kit/core";

const MSG: MessageSchema = {
  name: "Order",
  full_name: "example.Order",
  fields: [
    {
      name: "value",
      label: "value",
      field_number: 1,
      kind: { type: "scalar", scalar: "string" },
      repeated: false,
      default_value: null,
    },
  ],
};

const SCHEMA: ProtoSchema = { messages: [MSG], message_map: { "example.Order": MSG }, enums: [] };

function makeSignals(): ComposeSignals {
  return {
    focusFilter: { current: null },
    toggleHex: { current: null },
    toggleReadMode: { current: null },
  };
}

function renderCard(signals: ComposeSignals = makeSignals(), blocksOpen = false) {
  const onToggleBlocks = vi.fn();
  const utils = render(
    <RequestCard signals={signals} blocksOpen={blocksOpen} onToggleBlocks={onToggleBlocks} />
  );
  return { ...utils, onToggleBlocks, signals };
}

function openSchema() {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/order.proto", SCHEMA);
    useProtoStore.getState().setSelectedType("example.Order");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dndKit.isOver = false;
  vi.mocked(useDroppable).mockImplementation(
    () => ({ isOver: dndKit.isOver, setNodeRef: vi.fn() }) as unknown as ReturnType<typeof useDroppable>
  );
  useProtoStore.getState().reset();
  useDraftStore.setState({ drafts: {}, draftsLoaded: true });
  useConnectionStore.setState({
    profiles: [],
    activeProfileName: null,
    connectionStatus: "disconnected",
    connectionError: null,
    managementStatus: "unknown",
    managementAuthError: null,
    queues: [],
    exchanges: [],
  });
});

afterEach(async () => {
  await act(async () => {});
  useProtoStore.getState().reset();
  useDraftStore.setState({ drafts: {}, draftsLoaded: false });
});

describe("empty state", () => {
  it("pitches the 30 second promise when no schema is loaded", () => {
    renderCard();
    expect(
      screen.getByText("Send a real protobuf message in 30 seconds")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open a \.proto/ })).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("opens a file from the first step card", () => {
    renderCard();
    const before = useProtoStore.getState().openFileRequested;
    fireEvent.click(screen.getByRole("button", { name: /Open a \.proto/ }));
    expect(useProtoStore.getState().openFileRequested).toBe(before + 1);
  });

  it("names the connected profile", () => {
    useConnectionStore.setState({ activeProfileName: "local", connectionStatus: "connected" });
    renderCard();
    expect(screen.getByText("local")).toBeInTheDocument();
  });

  it("falls back to a plain line when the selected type is missing", () => {
    act(() => {
      useProtoStore.getState().addOrActivateFile("/fake/order.proto", SCHEMA);
      useProtoStore.setState({ selectedMessageType: "example.Ghost" });
    });
    renderCard();
    expect(screen.getByText("Message type not found in schema")).toBeInTheDocument();
  });
});

describe("header", () => {
  it("names the request and its message", () => {
    openSchema();
    renderCard();
    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.getByText("example.Order")).toBeInTheDocument();
    expect(screen.queryByText("· draft saved")).not.toBeInTheDocument();
  });

  it("mentions a saved draft", () => {
    openSchema();
    useDraftStore.setState({
      drafts: {
        "/fake/order.proto::example.Order": { values: { value: "x" }, accessedAt: Date.now() },
      },
      draftsLoaded: true,
    });
    renderCard();
    expect(screen.getByText("· draft saved")).toBeInTheDocument();
  });

  it("offers the four toolbar actions", () => {
    openSchema();
    renderCard();
    expect(screen.getByRole("button", { name: "Block library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Randomize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear form" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit as JSON" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear form" }).getAttribute("title")
    ).toMatch(/\+Shift\+R/);
  });

  it("presses the block library button when the drawer is open", () => {
    openSchema();
    const { onToggleBlocks } = renderCard(makeSignals(), true);
    const button = screen.getByRole("button", { name: "Block library" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onToggleBlocks).toHaveBeenCalledTimes(1);
  });

  it("swaps the JSON toggle label in JSON mode", () => {
    openSchema();
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    expect(screen.getByRole("button", { name: "Return to form" })).toBeInTheDocument();
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
  });
});

describe("drop target", () => {
  it("highlights the card while a block hovers over it", () => {
    dndKit.isOver = true;
    openSchema();
    renderCard();
    const zone = screen.getByTestId("drop-zone");
    expect(zone.className).toContain("ring-4");
    expect(zone.className).toContain("ring-primary/12");
    expect(zone.className).toContain("border-border-strong");
    expect(screen.getByText(/Drop to fill Order · 1 fields/)).toBeInTheDocument();
  });

  it("leaves the card alone otherwise", () => {
    openSchema();
    renderCard();
    expect(screen.getByTestId("drop-zone").className).not.toContain("ring-4");
  });
});

describe("compose signals", () => {
  it("registers the hex toggle and clears it on unmount", async () => {
    openSchema();
    const signals = makeSignals();
    const { unmount } = renderCard(signals);
    await waitFor(() => expect(signals.toggleHex.current).toBeTypeOf("function"));

    act(() => signals.toggleHex.current?.());
    expect(screen.getByText(/wire format/)).toBeInTheDocument();

    unmount();
    expect(signals.toggleHex.current).toBeNull();
  });
});

describe("destination and footer", () => {
  it("renders the destination strip and the send button", () => {
    openSchema();
    renderCard();
    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send/ })).toBeDisabled();
  });

  it("opens the properties section from the summary button", () => {
    openSchema();
    renderCard();
    expect(screen.queryByLabelText("Content type")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("properties-summary"));
    expect(screen.getByLabelText("Content type")).toBeInTheDocument();
  });
});
