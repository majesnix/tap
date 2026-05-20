import React from "react";
import { describe, it, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useResponseStore } from "@/stores/useResponseStore";

// Mock shadcn Select with a native <select> to avoid Radix UI portal/pointer-event issues in jsdom.
// Pattern copied from src/components/publish/__tests__/PublishBar.test.tsx (lines 16-33).
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
      role="combobox"
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

const { mockFetchQueues, mockFetchQueueDepth } = vi.hoisted(() => ({
  mockFetchQueues: vi.fn(),
  mockFetchQueueDepth: vi.fn(),
}));
vi.mock("@/lib/ipc", () => ({
  fetchQueues: mockFetchQueues,
  fetchQueueDepth: mockFetchQueueDepth,
  consumeMessage: vi.fn(),
  drainMessages: vi.fn(),
}));

import { ResponseQueuePicker } from "@/components/response/ResponseQueuePicker";

beforeEach(() => {
  vi.clearAllMocks();

  // Reset response store — new schema (messages, selectedDecodeTypes)
  useResponseStore.setState({
    selectedQueue: "test-queue",
    isLoading: false,
    messages: [],
    selectedDecodeTypes: ["MyMessage"],
    lastReadAt: null,
    queueList: [],
    isLiveMode: false,
    queueDepth: null,
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

  // Default mock: happy path returning a list of queues + depth 0
  mockFetchQueues.mockResolvedValue(["queue-a", "queue-b"]);
  mockFetchQueueDepth.mockResolvedValue(0);
});

describe("ResponseQueuePicker", () => {
  it("Test 1 (live mode): shows Select dropdown with Live badge when fetchQueues succeeds", async () => {
    render(<ResponseQueuePicker onDrain={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    // Queue options should be in the native <select>
    expect(screen.getByRole("option", { name: "queue-a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "queue-b" })).toBeInTheDocument();
  });

  it("Test 2 (manual mode): shows Input + Manual badge when fetchQueues throws non-401 error", async () => {
    mockFetchQueues.mockRejectedValue(new Error("connection refused"));

    render(<ResponseQueuePicker onDrain={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Manual")).toBeInTheDocument();
    });

    // Input field should be visible (no Select)
    expect(screen.getByPlaceholderText("Queue name")).toBeInTheDocument();
  });

  it("Test 3 (401 auth error): shows destructive badge with error message when fetchQueues throws auth error", async () => {
    mockFetchQueues.mockRejectedValue(
      new Error("Management API authentication failed: wrong credentials (HTTP 401)")
    );

    render(<ResponseQueuePicker onDrain={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("Management API authentication failed: wrong credentials (HTTP 401)")
      ).toBeInTheDocument();
    });
  });

  it("Test 4 (disabled drain + tooltip): Drain button is disabled when connectionStatus is disconnected", () => {
    useConnectionStore.setState({ connectionStatus: "disconnected" });

    render(<ResponseQueuePicker onDrain={vi.fn()} />);

    const drainButton = screen.getByRole("button", { name: /drain/i });
    expect(drainButton).toBeDisabled();
  });

  it("Test 5 (loading spinner): shows Loader2 spinner and disables Drain when isLoading=true", () => {
    useResponseStore.setState({ isLoading: true });

    render(<ResponseQueuePicker onDrain={vi.fn()} />);

    // Drain button should be disabled when loading
    const drainButton = screen.getByRole("button", { name: /drain/i });
    expect(drainButton).toBeDisabled();

    // Spinner should be visible
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });

  test("calls onDrain with the drain count value", async () => {
    const mockOnDrain = vi.fn();
    render(<ResponseQueuePicker onDrain={mockOnDrain} />);
    const countInput = screen.getByRole("spinbutton", { name: /drain count/i });
    fireEvent.change(countInput, { target: { value: "5" } });
    const drainButton = screen.getByRole("button", { name: /drain/i });
    fireEvent.click(drainButton);
    expect(mockOnDrain).toHaveBeenCalledWith(5);
  });

  test("calls onDrain with default count of 10 when unchanged", () => {
    const mockOnDrain = vi.fn();
    render(<ResponseQueuePicker onDrain={mockOnDrain} />);
    fireEvent.click(screen.getByRole("button", { name: /drain/i }));
    expect(mockOnDrain).toHaveBeenCalledWith(10);
  });
});
