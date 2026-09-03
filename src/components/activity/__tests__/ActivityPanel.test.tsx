import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const { mockPublishMessage, mockDrainMessages } = vi.hoisted(() => ({
  mockPublishMessage: vi.fn(),
  mockDrainMessages: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  publishMessage: mockPublishMessage,
  drainMessages: mockDrainMessages,
  fetchQueues: vi.fn().mockRejectedValue(new Error("no management")),
  fetchQueueDepth: vi.fn().mockResolvedValue(0),
  startSubscribe: vi.fn().mockResolvedValue(undefined),
  stopSubscribe: vi.fn().mockResolvedValue(undefined),
}));

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: mockToastError,
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

const { mockSave, mockWriteTextFile } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mockSave, open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: mockWriteTextFile,
  readTextFile: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => ({
    get: vi.fn(async () => []),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}));
vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {},
  invoke: vi.fn(),
}));

// Radix popovers/dialogs do not portal usefully in jsdom — render inline.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (v: string) => void;
  }) => (
    <select
      role="combobox"
      aria-label="queue select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import React from "react";
import { useHistoryStore, type HistoryEntry } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { invalidateCatalog } from "@/lib/brokerCatalog";
import type { FeedMessage, ProtoSchema } from "@/lib/types";
import type { ComposeSignals } from "@/components/layout/ComposeView";
import { ActivityPanel } from "../ActivityPanel";

const SCHEMA: ProtoSchema = {
  messages: [{ name: "Order", full_name: "example.Order", fields: [] }],
  message_map: { "example.Order": { name: "Order", full_name: "example.Order", fields: [] } },
  enums: [],
};

const ENTRY: HistoryEntry = {
  id: "s1",
  timestamp: "2026-09-03T14:02:11.412Z",
  messageTypeName: "example.Order",
  exchange: "",
  routingKey: "orders",
  status: "sent",
  fieldValues: { order_id: "ord_1" },
  payloadBase64: "CgU=",
  outcome: "ack",
};

const REPLY: FeedMessage = {
  id: "r1",
  routingKey: "orders.reply",
  exchange: "",
  contentType: null,
  correlationId: null,
  timestamp: null,
  receivedAt: Date.parse("2026-09-03T14:02:11.690Z"),
  decoded: { confirmed: true },
  hexString: "0a 01 02",
  error: null,
  decodedAs: "example.OrderConfirmed",
};

// cmdk scrolls its active item into view; jsdom has no such method.
Element.prototype.scrollIntoView = function scrollIntoView() {};

function makeSignals(): ComposeSignals {
  return {
    focusFilter: { current: null },
    toggleHex: { current: null },
    toggleReadMode: { current: null },
  };
}

function renderPanel(signals = makeSignals()) {
  return { signals, ...render(<ActivityPanel signals={signals} />) };
}

beforeEach(() => {
  invalidateCatalog();
  vi.clearAllMocks();
  useProtoStore.getState().reset();
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/order.proto", SCHEMA);
  });
  useHistoryStore.setState({ entries: [], historyLoaded: true });
  useResponseStore.setState({
    messages: [],
    selectedQueue: "orders",
    selectedDecodeTypes: ["example.Order"],
    subscribeStatus: "Idle",
    subscribeError: null,
    queueList: [],
    isLiveMode: false,
    queueDepth: null,
    isLoading: false,
    lastReadAt: null,
  });
  useConnectionStore.setState({
    activeProfileName: "dev",
    connectionStatus: "connected",
    profiles: [],
  });
  mockSave.mockResolvedValue("/tmp/activity-export.json");
  mockWriteTextFile.mockResolvedValue(undefined);
  mockPublishMessage.mockResolvedValue({ status: "ack" });
});

afterEach(async () => {
  await act(async () => {});
});

describe("timeline", () => {
  test("shows the empty state with no items", () => {
    renderPanel();
    expect(
      screen.getByText("Sent and received messages appear here as one timeline.")
    ).toBeInTheDocument();
  });

  test("renders one row per item with type, status and mono meta", () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();
    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.getByText("ACK")).toBeInTheDocument();
    expect(screen.getByText("OrderConfirmed")).toBeInTheDocument();
    expect(screen.getByText("DECODED")).toBeInTheDocument();
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.getByText("orders.reply")).toBeInTheDocument();
  });

  test("the footer summarises what is on the timeline", () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();
    // The "· today" suffix depends on the wall clock; match the counts only.
    expect(screen.getByText(/^1 sent · 1 received/)).toBeInTheDocument();
  });

  test("the segmented filter narrows to sent and to received", () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();

    fireEvent.click(screen.getByRole("radio", { name: "Sent" }));
    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.queryByText("OrderConfirmed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Received" }));
    expect(screen.getByText("OrderConfirmed")).toBeInTheDocument();
    expect(screen.queryByText("Order")).not.toBeInTheDocument();
  });

  test("typing in the filter input hides non-matching rows", async () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();
    fireEvent.change(screen.getByLabelText("Filter activity"), {
      target: { value: "ord_1" },
    });
    await waitFor(() => expect(screen.queryByText("OrderConfirmed")).not.toBeInTheDocument());
    expect(screen.getByText("Order")).toBeInTheDocument();
  });

  test("shows a no-match message when the filter matches nothing", async () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    renderPanel();
    fireEvent.change(screen.getByLabelText("Filter activity"), {
      target: { value: "zzznomatch" },
    });
    await waitFor(() => expect(screen.getByText("Nothing matches the filter.")).toBeInTheDocument());
  });

  test("a reply row shows the REPLY tag under its sent row", () => {
    useHistoryStore.setState({
      entries: [{ ...ENTRY, correlationId: "req-1" }],
      historyLoaded: true,
    });
    useResponseStore.setState({ messages: [{ ...REPLY, correlationId: "req-1" }] });
    renderPanel();
    expect(screen.getByText("REPLY")).toBeInTheDocument();
    // Grouped: the reply is no longer a top-level row, so only one status tag shows.
    expect(screen.queryByText("DECODED")).not.toBeInTheDocument();
  });
});

describe("expanded row", () => {
  beforeEach(() => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
  });

  function expandSentRow() {
    fireEvent.click(screen.getByText("Order"));
  }

  test("clicking a sent row reveals its decoded values and actions", () => {
    renderPanel();
    expandSentRow();
    expect(screen.getByText("order_id")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hex/i })).toBeInTheDocument();
  });

  test("Load pushes the entry's field values into the form", () => {
    renderPanel();
    expandSentRow();
    fireEvent.click(screen.getByRole("button", { name: /load/i }));
    expect(useProtoStore.getState().pendingReplayValues).toEqual({ order_id: "ord_1" });
  });

  test("Load toasts when the .proto file is not open", () => {
    useProtoStore.getState().reset();
    renderPanel();
    expandSentRow();
    fireEvent.click(screen.getByRole("button", { name: /load/i }));
    expect(mockToastError).toHaveBeenCalledWith(
      "Replay failed: .proto file not open. Open the file first."
    );
  });

  test("Resend republishes the stored base64", async () => {
    renderPanel();
    expandSentRow();
    fireEvent.click(screen.getByRole("button", { name: /resend/i }));
    await waitFor(() =>
      expect(mockPublishMessage).toHaveBeenCalledWith("dev", "", "orders", "CgU=", {
        correlationId: undefined,
        replyTo: undefined,
      })
    );
  });

  test("Hex opens the binary payload dialog", () => {
    renderPanel();
    expandSentRow();
    fireEvent.click(screen.getByRole("button", { name: /hex/i }));
    expect(screen.getByText(/Binary payload/)).toBeInTheDocument();
  });

  test("clicking the row again collapses it", () => {
    renderPanel();
    expandSentRow();
    expect(screen.getByText("order_id")).toBeInTheDocument();
    expandSentRow();
    expect(screen.queryByText("order_id")).not.toBeInTheDocument();
  });

  test("a received row shows its decode error instead of a tree", () => {
    useHistoryStore.setState({ entries: [], historyLoaded: true });
    useResponseStore.setState({
      messages: [{ ...REPLY, decoded: null, decodedAs: null, error: "no matching type" }],
    });
    renderPanel();
    fireEvent.click(screen.getByText("unknown"));
    expect(screen.getByText("no matching type")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });
});

describe("footer actions", () => {
  test("Export is disabled with no visible rows", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
  });

  test("Export writes an envelope with messages and sent arrays", async () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(mockWriteTextFile).toHaveBeenCalledTimes(1));
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as { messages: unknown[]; sent: unknown[] };
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.sent).toHaveLength(1);
  });

  test("Clear asks first, then empties the timeline", async () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Clear activity?");
    const clearButtons = screen.getAllByRole("button", { name: /^clear$/i });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    await waitFor(() => expect(useHistoryStore.getState().entries).toHaveLength(0));
    expect(useResponseStore.getState().messages).toHaveLength(0);
  });

  test("Clear is disabled with nothing to clear", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^clear$/i })).toBeDisabled();
  });
});

describe("row animations", () => {
  /** The row container is the button's parent. */
  function rowOf(text: string) {
    return screen.getByText(text).closest("button")?.parentElement;
  }

  test("the newest sent row is highlighted after a send", async () => {
    const sentAt = Date.now();
    useHistoryStore.setState({
      entries: [{ ...ENTRY, timestamp: new Date(sentAt).toISOString() }],
      historyLoaded: true,
    });
    renderPanel();
    expect(rowOf("Order")).not.toHaveClass("animate-row-highlight");

    await act(async () => {
      useProtoStore.setState({ lastSendAt: sentAt });
    });

    expect(rowOf("Order")).toHaveClass("animate-row-highlight");
  });

  test("a stale newest entry is not highlighted when history recording is off", async () => {
    // Recording off: nothing is appended, so entries[0] is an older send that
    // must not flash as though it were the message just sent.
    useHistoryStore.setState({
      entries: [{ ...ENTRY, timestamp: new Date(Date.now() - 60_000).toISOString() }],
      historyLoaded: true,
    });
    renderPanel();

    await act(async () => {
      useProtoStore.setState({ lastSendAt: Date.now() });
    });

    expect(rowOf("Order")).not.toHaveClass("animate-row-highlight");
  });

  test("a received row that arrived after mount slides in", async () => {
    renderPanel();
    await act(async () => {
      useResponseStore.setState({ messages: [{ ...REPLY, receivedAt: Date.now() }] });
    });
    expect(rowOf("OrderConfirmed")).toHaveClass("animate-row-in");
  });

  test("received rows already present at mount do not slide in", () => {
    useResponseStore.setState({ messages: [REPLY] });
    renderPanel();
    expect(rowOf("OrderConfirmed")).not.toHaveClass("animate-row-in");
  });
});

describe("read mode button", () => {
  test("reads 'Read queue' when idle", () => {
    renderPanel();
    expect(screen.getByTitle("Read mode")).toHaveTextContent("Read queue");
  });

  test("reads 'Tapping {queue}' while a tap runs, and warns about the view switch", () => {
    useResponseStore.setState({ subscribeStatus: "Running", selectedQueue: "orders" });
    renderPanel();
    const button = screen.getByTitle("Switching to Plans stops the tap");
    expect(button).toHaveTextContent("Tapping orders");
  });
});

describe("compose signals", () => {
  test("focusFilter focuses the filter input and is cleared on unmount", () => {
    const { signals, unmount } = renderPanel();
    act(() => signals.focusFilter.current?.());
    expect(document.activeElement).toBe(screen.getByLabelText("Filter activity"));
    unmount();
    expect(signals.focusFilter.current).toBeNull();
    expect(signals.toggleReadMode.current).toBeNull();
  });

  test("toggleReadMode is registered", () => {
    const { signals } = renderPanel();
    expect(typeof signals.toggleReadMode.current).toBe("function");
  });
});
