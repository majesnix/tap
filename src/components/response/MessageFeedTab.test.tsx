import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const { mockDrainMessages } = vi.hoisted(() => ({
  mockDrainMessages: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  drainMessages: mockDrainMessages,
  fetchQueues: vi.fn().mockRejectedValue(new Error("no management")),
  fetchQueueDepth: vi.fn().mockResolvedValue(0),
}));

const { mockToastInfo, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToastInfo: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    info: mockToastInfo,
    error: mockToastError,
    success: mockToastSuccess,
  }),
}));

const { mockSave, mockWriteTextFile } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mockSave,
  open: vi.fn(),  // keep open mock for FileSection compatibility
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: mockWriteTextFile,
  readTextFile: vi.fn(),  // keep readTextFile mock for FileSection compatibility
}));

// Mock shadcn Select with a native <select> to avoid Radix UI portal/pointer-event issues in jsdom.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      role="listbox"
      aria-label="queue select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

import React from "react";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { MessageFeedTab } from "./MessageFeedTab";

const CONNECTED_STATE = {
  connectionStatus: "connected" as const,
  activeProfileName: "test-profile",
};

const FEED_STATE = {
  selectedQueue: "test-queue",
  isLoading: false,
  messages: [] as never[],
  selectedDecodeTypes: ["MyMessage"],
  lastReadAt: null,
  queueList: [],
  isLiveMode: false,
  queueDepth: null,
};

const MESSAGE_A = {
  id: "msg-a",
  routingKey: "order.created",
  exchange: "orders",
      correlationId: null,
  contentType: "application/json",
  timestamp: 1716300718,  // epoch seconds → "2024-05-21T..." ISO
  decoded: { orderId: "abc" },
  hexString: "0a03616263",
  error: null,
  decodedAs: "OrderEvent",
};

const MESSAGE_B = {
  id: "msg-b",
  routingKey: "user.login",
  exchange: "users",
      correlationId: null,
  contentType: null,
  timestamp: null,
  decoded: null,
  hexString: "0a",
  error: null,
  decodedAs: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useResponseStore.setState(FEED_STATE);
  useConnectionStore.setState(CONNECTED_STATE);
  useProtoStore.setState({ selectedMessageType: "MyMessage" });
  // Default: save() cancelled (returns null) — individual tests override as needed
  mockSave.mockResolvedValue(null);
  mockWriteTextFile.mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => {});
});

describe("MessageFeedTab", () => {
  test("renders empty state placeholder when no messages", () => {
    render(<MessageFeedTab />);
    expect(
      screen.getByText("Select a queue and choose a mode")
    ).toBeInTheDocument();
  });

  test("shows 'No messages' in feed header when messages is empty", () => {
    render(<MessageFeedTab />);
    expect(screen.getByText("No messages")).toBeInTheDocument();
  });

  test("shows message count in feed header when messages exist", () => {
    useResponseStore.setState({
      messages: [
        {
          id: "1",
          routingKey: "rk",
          exchange: "ex",
      correlationId: null,
          contentType: null,
          timestamp: null,
          decoded: null,
          hexString: "0a",
          error: null,
          decodedAs: "MyMessage",
        },
      ],
    });
    render(<MessageFeedTab />);
    expect(screen.getByText("1 message")).toBeInTheDocument();
  });

  test("calls drainMessages with selectedDecodeTypes on Drain", async () => {
    mockDrainMessages.mockResolvedValueOnce({ messages: [], partialError: null });
    render(<MessageFeedTab />);
    // The Drain button is rendered by ResponseQueuePicker; find it
    const drainButton = screen.getByRole("button", { name: /drain/i });
    fireEvent.click(drainButton);
    await waitFor(() => {
      expect(mockDrainMessages).toHaveBeenCalledWith(
        "test-profile",
        "test-queue",
        ["MyMessage"],
        expect.any(Number),
      );
    });
  });

  test("shows toast.info when drain returns 0 messages", async () => {
    mockDrainMessages.mockResolvedValueOnce({ messages: [], partialError: null });
    render(<MessageFeedTab />);
    fireEvent.click(screen.getByRole("button", { name: /drain/i }));
    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith("Queue is empty");
    });
  });

  test("shows toast.error when drain has partial error", async () => {
    mockDrainMessages.mockResolvedValueOnce({
      messages: [],
      partialError: "connection reset",
    });
    render(<MessageFeedTab />);
    fireEvent.click(screen.getByRole("button", { name: /drain/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Drain stopped early: connection reset"
      );
    });
  });

  test("Clear button calls clearMessages", () => {
    useResponseStore.setState({
      messages: [
        {
          id: "1",
          routingKey: "rk",
          exchange: "ex",
      correlationId: null,
          contentType: null,
          timestamp: null,
          decoded: null,
          hexString: "0a",
          error: null,
          decodedAs: null,
        },
      ],
    });
    render(<MessageFeedTab />);
    const clearButton = screen.getByRole("button", { name: /clear feed/i });
    fireEvent.click(clearButton);
    expect(useResponseStore.getState().messages).toHaveLength(0);
  });
});

describe("Filter and Export", () => {
  test("routing key input narrows feed to matching messages", () => {
    useResponseStore.setState({ messages: [MESSAGE_A, MESSAGE_B] });
    render(<MessageFeedTab />);
    const input = screen.getByPlaceholderText("Filter by routing key");
    fireEvent.change(input, { target: { value: "order" } });
    // MessageFeedRow renders routingKey as part of joined string — use regex, not exact text
    expect(screen.getByText(/order\.created/)).toBeInTheDocument();
    expect(screen.queryByText(/user\.login/)).not.toBeInTheDocument();
  });

  test("routing key filter is case-insensitive", () => {
    useResponseStore.setState({ messages: [MESSAGE_A, MESSAGE_B] });
    render(<MessageFeedTab />);
    const input = screen.getByPlaceholderText("Filter by routing key");
    fireEvent.change(input, { target: { value: "ORDER" } });
    expect(screen.getByText(/order\.created/)).toBeInTheDocument();
    expect(screen.queryByText(/user\.login/)).not.toBeInTheDocument();
  });

  test("content-type select filters to matching messages", () => {
    useResponseStore.setState({ messages: [MESSAGE_A, MESSAGE_B] });
    render(<MessageFeedTab />);
    // In test env isLiveMode=false (fetchQueues rejects), so ResponseQueuePicker renders
    // an Input for queue name (not a Select). The only listbox is the content-type filter.
    const ctSelect = screen.getAllByRole("listbox")[0];
    fireEvent.change(ctSelect, { target: { value: "application/json" } });
    expect(screen.getByText(/order\.created/)).toBeInTheDocument();
    expect(screen.queryByText(/user\.login/)).not.toBeInTheDocument();
  });

  test("selecting __none__ sentinel matches messages with null contentType", () => {
    useResponseStore.setState({ messages: [MESSAGE_A, MESSAGE_B] });
    render(<MessageFeedTab />);
    const ctSelect = screen.getAllByRole("listbox")[0];
    fireEvent.change(ctSelect, { target: { value: "__none__" } });
    expect(screen.getByText(/user\.login/)).toBeInTheDocument();
    expect(screen.queryByText(/order\.created/)).not.toBeInTheDocument();
  });

  test("feed header shows 'X of Y messages' when filter is active", () => {
    useResponseStore.setState({ messages: [MESSAGE_A, MESSAGE_B] });
    render(<MessageFeedTab />);
    const input = screen.getByPlaceholderText("Filter by routing key");
    fireEvent.change(input, { target: { value: "order" } });
    expect(screen.getByText("1 of 2 messages")).toBeInTheDocument();
  });

  test("shows 'No messages match filter' when filter matches nothing", () => {
    useResponseStore.setState({ messages: [MESSAGE_A] });
    render(<MessageFeedTab />);
    const input = screen.getByPlaceholderText("Filter by routing key");
    fireEvent.change(input, { target: { value: "zzznomatch" } });
    expect(screen.getByText("No messages match filter")).toBeInTheDocument();
  });

  test("Export button is disabled when messages is empty", () => {
    render(<MessageFeedTab />); // FEED_STATE has messages: []
    const exportBtn = screen.getByRole("button", { name: /export/i });
    expect(exportBtn).toBeDisabled();
  });

  test("Export button is disabled when filter produces 0 visible messages", () => {
    useResponseStore.setState({ messages: [MESSAGE_A] });
    render(<MessageFeedTab />);
    const input = screen.getByPlaceholderText("Filter by routing key");
    fireEvent.change(input, { target: { value: "zzznomatch" } });
    const exportBtn = screen.getByRole("button", { name: /export/i });
    expect(exportBtn).toBeDisabled();
  });

  test("clicking Export with cancelled dialog produces no toast", async () => {
    mockSave.mockResolvedValueOnce(null); // user cancelled
    useResponseStore.setState({ messages: [MESSAGE_A] });
    render(<MessageFeedTab />);
    const exportBtn = screen.getByRole("button", { name: /export/i });
    fireEvent.click(exportBtn);
    await waitFor(() => {
      expect(mockWriteTextFile).not.toHaveBeenCalled();
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  test("successful export calls writeTextFile and shows success toast", async () => {
    mockSave.mockResolvedValueOnce("/tmp/feed-export.json");
    mockWriteTextFile.mockResolvedValueOnce(undefined);
    useResponseStore.setState({ messages: [MESSAGE_A] });
    render(<MessageFeedTab />);
    const exportBtn = screen.getByRole("button", { name: /export/i });
    fireEvent.click(exportBtn);
    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Exported 1 messages");
  });

  test("exported JSON has correct shape: wrapped envelope, curated fields, ISO timestamp", async () => {
    mockSave.mockResolvedValueOnce("/tmp/feed-export.json");
    mockWriteTextFile.mockResolvedValueOnce(undefined);
    useResponseStore.setState({ messages: [MESSAGE_A] });
    render(<MessageFeedTab />);
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    });
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as {
      exportedAt: string;
      messageCount: number;
      messages: Array<Record<string, unknown>>;
    };
    // D-12: wrapped envelope
    expect(parsed).toHaveProperty("exportedAt");
    expect(parsed.messageCount).toBe(1);
    expect(parsed.messages).toHaveLength(1);
    const msg = parsed.messages[0];
    // D-10: curated subset — id and hexString must be absent
    expect(msg).not.toHaveProperty("id");
    expect(msg).not.toHaveProperty("hexString");
    // D-10: included fields present
    expect(msg).toHaveProperty("routingKey", "order.created");
    expect(msg).toHaveProperty("exchange", "orders");
    expect(msg).toHaveProperty("contentType", "application/json");
    // D-11: timestamp is ISO string
    expect(typeof msg.timestamp).toBe("string");
    expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(msg).toHaveProperty("decodedAs", "OrderEvent");
    expect(msg).toHaveProperty("error", null);
  });

  test("exported JSON serializes null timestamp as null (not ISO string)", async () => {
    mockSave.mockResolvedValueOnce("/tmp/feed-export-null.json");
    mockWriteTextFile.mockResolvedValueOnce(undefined);
    useResponseStore.setState({ messages: [MESSAGE_B] }); // MESSAGE_B has timestamp: null
    render(<MessageFeedTab />);
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    });
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as { messages: Array<Record<string, unknown>> };
    expect(parsed.messages[0].timestamp).toBeNull(); // D-11
  });

  test("save() is called with defaultPath matching feed-export timestamp pattern", async () => {
    mockSave.mockResolvedValueOnce("/tmp/out.json");
    mockWriteTextFile.mockResolvedValueOnce(undefined);
    useResponseStore.setState({ messages: [MESSAGE_A] });
    render(<MessageFeedTab />);
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    const saveArg = mockSave.mock.calls[0][0] as { defaultPath: string };
    expect(saveArg.defaultPath).toMatch(/^feed-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/); // D-07
  });

  test("export only exports visibleMessages (filtered), not all messages (D-09)", async () => {
    mockSave.mockResolvedValueOnce("/tmp/filtered.json");
    mockWriteTextFile.mockResolvedValueOnce(undefined);
    useResponseStore.setState({ messages: [MESSAGE_A, MESSAGE_B] });
    render(<MessageFeedTab />);
    // Filter to only MESSAGE_A
    const input = screen.getByPlaceholderText("Filter by routing key");
    fireEvent.change(input, { target: { value: "order" } });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(mockWriteTextFile).toHaveBeenCalledTimes(1));
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as { messageCount: number; messages: unknown[] };
    expect(parsed.messageCount).toBe(1);
    expect(parsed.messages).toHaveLength(1);
  });
});
