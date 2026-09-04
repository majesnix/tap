import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const { mockDrainMessages } = vi.hoisted(() => ({ mockDrainMessages: vi.fn() }));

vi.mock("@/lib/ipc", () => ({
  drainMessages: mockDrainMessages,
  fetchQueues: vi.fn().mockRejectedValue(new Error("no management")),
  fetchQueueDepth: vi.fn().mockResolvedValue(0),
  startSubscribe: vi.fn().mockResolvedValue(undefined),
  stopSubscribe: vi.fn().mockResolvedValue(undefined),
}));

const { mockToastInfo, mockToastError } = vi.hoisted(() => ({
  mockToastInfo: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    info: mockToastInfo,
    error: mockToastError,
    success: vi.fn(),
  }),
}));

// Radix popovers do not portal usefully in jsdom — render the content inline.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    items,
  }: {
    value?: string;
    onChange: (v: string) => void;
    items: { value: string }[];
  }) => (
    <select
      role="combobox"
      aria-label="queue select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.value}
        </option>
      ))}
    </select>
  ),
}));

import React, { useState } from "react";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { invalidateCatalog } from "@/lib/brokerCatalog";
import type { FeedMode } from "@/lib/types";
import { ReadModePopover } from "../ReadModePopover";

const LOCAL_PROFILE = {
  name: "test-profile",
  host: "localhost",
  port: 5672,
  vhost: "/",
  username: "dev",
  management_port: 15672,
  management_ssl: false,
};

const CONNECTED_STATE = {
  connectionStatus: "connected" as const,
  activeProfileName: "test-profile",
  profiles: [LOCAL_PROFILE],
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
  subscribeStatus: "Idle" as const,
  subscribeError: null,
};

function Harness() {
  const [mode, setMode] = useState<FeedMode>("tap");
  return (
    <ReadModePopover open onOpenChange={vi.fn()} mode={mode} onModeChange={setMode} />
  );
}

/** Pick a feed mode on the Tap / Subscribe / Peek / Consume segmented control. */
function selectMode(label: RegExp) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

beforeEach(() => {
  invalidateCatalog();
  vi.clearAllMocks();
  useResponseStore.setState(FEED_STATE);
  useConnectionStore.setState(CONNECTED_STATE);
  useProtoStore.setState({ selectedMessageType: "MyMessage" });
});

afterEach(async () => {
  await act(async () => {});
});

describe("read modes", () => {
  test("offers Tap, Subscribe, Peek and Consume with Tap selected", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /^tap$/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^subscribe$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^peek$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^consume$/i })).toBeInTheDocument();
  });

  test("locks the mode while a subscription is running", () => {
    useResponseStore.setState({ subscribeStatus: "Running" });
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /^peek$/i })).toBeDisabled();
  });

  test("shows the live controls only for Tap and Subscribe", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    selectMode(/^peek$/i);
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();
  });
});

describe("draining", () => {
  test("calls drainMessages with selectedDecodeTypes on Consume", async () => {
    mockDrainMessages.mockResolvedValueOnce({ messages: [], partialError: null });
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    await waitFor(() => {
      expect(mockDrainMessages).toHaveBeenCalledWith(
        "test-profile",
        "test-queue",
        ["MyMessage"],
        10,
        false
      );
    });
  });

  test("Peek passes requeue=true", async () => {
    mockDrainMessages.mockResolvedValueOnce({ messages: [], partialError: null });
    render(<Harness />);
    selectMode(/^peek$/i);
    fireEvent.click(screen.getByRole("button", { name: /^peek$/i }));
    await waitFor(() => {
      expect(mockDrainMessages).toHaveBeenCalledWith(
        "test-profile",
        "test-queue",
        ["MyMessage"],
        10,
        true
      );
    });
  });

  test("shows toast.info when the queue is empty", async () => {
    mockDrainMessages.mockResolvedValueOnce({ messages: [], partialError: null });
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    await waitFor(() => expect(mockToastInfo).toHaveBeenCalledWith("Queue is empty"));
  });

  test("reports a partial error", async () => {
    mockDrainMessages.mockResolvedValueOnce({
      messages: [],
      partialError: "connection reset",
    });
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Consume stopped early: connection reset")
    );
  });

  test("reports a failed drain", async () => {
    mockDrainMessages.mockRejectedValueOnce(new Error("broker down"));
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Consume failed: broker down"));
  });

  test("warns when the feed is capped at 500", async () => {
    const existing = Array.from({ length: 499 }, (_, i) => ({
      id: `old-${i}`,
      routingKey: "rk",
      exchange: "",
      contentType: null,
      correlationId: null,
      timestamp: null,
      receivedAt: 0,
      decoded: null,
      hexString: "0a",
      error: null,
      decodedAs: null,
    }));
    useResponseStore.setState({ messages: existing });
    mockDrainMessages.mockResolvedValueOnce({
      messages: [
        {
          routingKey: "rk",
          exchange: "",
          contentType: null,
          correlationId: null,
          timestamp: null,
          decoded: null,
          hexString: "0a",
          error: null,
          decodedAs: null,
        },
        {
          routingKey: "rk",
          exchange: "",
          contentType: null,
          correlationId: null,
          timestamp: null,
          decoded: null,
          hexString: "0a",
          error: null,
          decodedAs: null,
        },
      ],
      partialError: null,
    });
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    await waitFor(() =>
      expect(mockToastInfo).toHaveBeenCalledWith(
        "Feed capped at 500 — 1 older message(s) removed"
      )
    );
  });
});

describe("consume confirmation on non-local hosts", () => {
  beforeEach(() => {
    useConnectionStore.setState({
      ...CONNECTED_STATE,
      profiles: [{ ...LOCAL_PROFILE, host: "rabbit.staging.internal" }],
    });
    mockDrainMessages.mockResolvedValue({ messages: [], partialError: null });
  });

  test("asks for confirmation instead of consuming immediately", async () => {
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("rabbit.staging.internal");
    expect(dialog).toHaveTextContent("test-queue");
    expect(mockDrainMessages).not.toHaveBeenCalled();
  });

  test("consumes after the user confirms", async () => {
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /consume 10 messages/i }));
    await waitFor(() => {
      expect(mockDrainMessages).toHaveBeenCalledWith(
        "test-profile",
        "test-queue",
        ["MyMessage"],
        10,
        false
      );
    });
  });

  test("does nothing when the user cancels", async () => {
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mockDrainMessages).not.toHaveBeenCalled();
  });

  test("Peek needs no confirmation on a remote host", async () => {
    mockDrainMessages.mockResolvedValueOnce({ messages: [], partialError: null });
    render(<Harness />);
    selectMode(/^peek$/i);
    fireEvent.click(screen.getByRole("button", { name: /^peek$/i }));
    await waitFor(() => expect(mockDrainMessages).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("environment tags and read-only profiles", () => {
  test("a production tag forces confirmation even on localhost", async () => {
    useConnectionStore.setState({
      ...CONNECTED_STATE,
      profiles: [{ ...LOCAL_PROFILE, environment: "production" }],
    });
    render(<Harness />);
    selectMode(/^consume$/i);
    fireEvent.click(screen.getByRole("button", { name: /^consume$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/production/i);
    expect(mockDrainMessages).not.toHaveBeenCalled();
  });

  test("a read-only profile disables Consume but not Peek", () => {
    useConnectionStore.setState({
      ...CONNECTED_STATE,
      profiles: [{ ...LOCAL_PROFILE, read_only: true }],
    });
    render(<Harness />);
    selectMode(/^consume$/i);
    expect(screen.getByRole("button", { name: /^consume$/i })).toBeDisabled();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    selectMode(/^peek$/i);
    expect(screen.getByRole("button", { name: /^peek$/i })).not.toBeDisabled();
  });
});
