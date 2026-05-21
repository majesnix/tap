import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockDrainMessages } = vi.hoisted(() => ({
  mockDrainMessages: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  drainMessages: mockDrainMessages,
  fetchQueues: vi.fn().mockRejectedValue(new Error("no management")),
  fetchQueueDepth: vi.fn().mockResolvedValue(0),
}));

const { mockToastInfo, mockToastError } = vi.hoisted(() => ({
  mockToastInfo: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    info: mockToastInfo,
    error: mockToastError,
  }),
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

beforeEach(() => {
  vi.clearAllMocks();
  useResponseStore.setState(FEED_STATE);
  useConnectionStore.setState(CONNECTED_STATE);
  useProtoStore.setState({ selectedMessageType: "MyMessage" });
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
    expect(screen.getByText("1 messages")).toBeInTheDocument();
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
