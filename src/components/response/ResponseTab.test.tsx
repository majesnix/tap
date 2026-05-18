import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Use vi.hoisted for mock factories (Vitest hoisting requirement)
const { mockConsumeMessage, mockFetchQueues } = vi.hoisted(() => ({
  mockConsumeMessage: vi.fn(),
  mockFetchQueues: vi.fn(),
}));

// Mock fetchQueues with a rejection to keep ResponseQueuePicker in Manual mode.
// This ensures the existing tests (which use getByPlaceholderText("Queue name")) continue
// to find the Input field (not the Live Select dropdown). [Rule 1 deviation]
vi.mock("@/lib/ipc", () => ({
  consumeMessage: mockConsumeMessage,
  fetchQueues: mockFetchQueues,
}));

import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { ResponseTab } from "./ResponseTab";

beforeEach(() => {
  vi.clearAllMocks();

  // Reset response store state
  useResponseStore.setState({
    selectedQueue: "",
    isLoading: false,
    lastResult: null,
    lastReadAt: null,
    queueList: [],
    isLiveMode: false,
  });

  // Reset connection store with active profile + connected status
  useConnectionStore.setState({
    activeProfileName: "dev",
    connectionStatus: "connected",
    connectionError: null,
    profiles: [],
    managementStatus: "unknown",
    managementAuthError: null,
    queues: [],
    exchanges: [],
  });

  // Seed proto store with a message type
  useProtoStore.setState({
    selectedMessageType: "test.Person",
  } as Parameters<typeof useProtoStore.setState>[0]);

  // Keep ResponseQueuePicker in Manual mode so existing tests find "Queue name" Input
  mockFetchQueues.mockRejectedValue(new Error("not under test"));

  // Default mock: happy path response
  mockConsumeMessage.mockResolvedValue({
    empty: false,
    decoded: { name: "Alice" },
    hexString: "0a 05 41 6c 69 63 65",
    error: null,
  });
});

describe("ResponseTab", () => {
  test("Test 1 (happy path): renders decoded fields and hex string after Read", async () => {
    render(<ResponseTab />);

    // Type a queue name
    const input = screen.getByPlaceholderText("Queue name");
    fireEvent.change(input, { target: { value: "my-queue" } });

    // Click Read
    const readButton = screen.getByRole("button", { name: /read/i });
    fireEvent.click(readButton);

    // Wait for the IPC response to resolve
    await waitFor(() => {
      expect(screen.getByText(/name/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/0a 05/i)).toBeInTheDocument();
  });

  test("Test 2 (empty queue): shows 'Queue empty' text", async () => {
    mockConsumeMessage.mockResolvedValue({
      empty: true,
      decoded: null,
      hexString: "",
      error: null,
    });

    render(<ResponseTab />);

    const input = screen.getByPlaceholderText("Queue name");
    fireEvent.change(input, { target: { value: "my-queue" } });

    const readButton = screen.getByRole("button", { name: /read/i });
    fireEvent.click(readButton);

    await waitFor(() => {
      expect(screen.getByText("Queue empty")).toBeInTheDocument();
    });
  });

  test("Test 3 (decode error): shows inline error text and hex bytes", async () => {
    mockConsumeMessage.mockResolvedValue({
      empty: false,
      decoded: null,
      hexString: "ff fe",
      error: "Decode failed: invalid varint. Showing raw bytes.",
    });

    render(<ResponseTab />);

    const input = screen.getByPlaceholderText("Queue name");
    fireEvent.change(input, { target: { value: "my-queue" } });

    const readButton = screen.getByRole("button", { name: /read/i });
    fireEvent.click(readButton);

    await waitFor(() => {
      expect(
        screen.getByText("Decode failed: invalid varint. Showing raw bytes.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("ff fe")).toBeInTheDocument();
  });

  test("Test 4 (no active connection): Read button is disabled when disconnected", () => {
    useConnectionStore.setState({ connectionStatus: "disconnected" });

    render(<ResponseTab />);

    const readButton = screen.getByRole("button", { name: /read/i });
    expect(readButton).toBeDisabled();
  });
});
