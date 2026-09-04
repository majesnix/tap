import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ── Hoist mocks for vitest ─────────────────────────────────────────────────────

const { mockStartSubscribe, mockStopSubscribe } = vi.hoisted(() => ({
  mockStartSubscribe: vi.fn(),
  mockStopSubscribe: vi.fn(),
}));

// Channel must be a class so `new Channel<DrainResult>(cb)` works in the component
vi.mock("@tauri-apps/api/core", () => ({
  Channel: vi.fn().mockImplementation(function (
    this: { cb: (msg: unknown) => void },
    cb: (msg: unknown) => void,
  ) {
    this.cb = cb;
  }),
  invoke: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  startSubscribe: mockStartSubscribe,
  stopSubscribe: mockStopSubscribe,
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { SubscribePanel } from "./SubscribePanel";

// ── Test helpers ───────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  selectedQueue: "my-queue",
  decodeTypes: ["MyMessage"],
  profileName: "test-profile",
  mode: "competing" as const,
};

const LOCAL_PROFILE = {
  name: "test-profile",
  host: "localhost",
  port: 5672,
  vhost: "/",
  username: "dev",
  management_port: 15672,
  management_ssl: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  useResponseStore.getState().reset();
  useConnectionStore.setState({
    activeProfileName: "test-profile",
    connectionStatus: "connected",
    profiles: [LOCAL_PROFILE],
  });
  // Default: startSubscribe resolves, stopSubscribe resolves
  mockStartSubscribe.mockResolvedValue(undefined);
  mockStopSubscribe.mockResolvedValue(undefined);
});

// ── Start button behavior ─────────────────────────────────────────────────────

describe("Start button", () => {
  test("is disabled when selectedQueue is empty", () => {
    render(<SubscribePanel {...DEFAULT_PROPS} selectedQueue="" />);
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  test("is enabled when subscribeStatus is Idle and selectedQueue is set", () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /start/i })).not.toBeDisabled();
  });

  test("is not rendered when subscribeStatus is Running (Stop button replaces it)", () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();
  });

  test("clicking Start calls startSubscribe as a competing consumer", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    await waitFor(() => {
      expect(mockStartSubscribe).toHaveBeenCalledWith(
        "test-profile",
        "my-queue",
        ["MyMessage"],
        expect.anything(),
        "competing",
      );
    });
  });

  test("clicking Start sets subscribeStatus to Running on success", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    await waitFor(() => {
      expect(useResponseStore.getState().subscribeStatus).toBe("Running");
    });
  });

  test("clicking Start sets subscribeStatus to Error on invoke failure", async () => {
    mockStartSubscribe.mockRejectedValueOnce(new Error("AMQP auth failed"));
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    await waitFor(() => {
      expect(useResponseStore.getState().subscribeStatus).toBe("Error");
    });
  });
});

// ── Stop button behavior ──────────────────────────────────────────────────────

describe("Stop button", () => {
  test("Stop button is not visible when status is Idle", () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  test("Stop button is visible when status is Running", () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  test("Stop button is visible when status is Stopping", () => {
    useResponseStore.getState().setSubscribeStatus("Stopping");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  test("Stop button is disabled when status is Stopping", () => {
    useResponseStore.getState().setSubscribeStatus("Stopping");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeDisabled();
  });

  test("Stop button shows Loader2 spinner when status is Stopping", () => {
    useResponseStore.getState().setSubscribeStatus("Stopping");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    // Loader2 renders as an svg — check the stop button contains an svg with animate-spin
    const stopButton = screen.getByRole("button", { name: /stop/i });
    const spinner = stopButton.querySelector("svg.animate-spin");
    expect(spinner).not.toBeNull();
  });

  test("clicking Stop calls stopSubscribe", async () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    await waitFor(() => {
      expect(mockStopSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  test("clicking Stop sets status to Idle when invoke resolves", async () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    await waitFor(() => {
      expect(useResponseStore.getState().subscribeStatus).toBe("Idle");
    });
  });
});

// ── Status badge ──────────────────────────────────────────────────────────────

describe("Status badge", () => {
  test("shows Idle badge when status is Idle", () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  test("shows Running badge when status is Running", () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  test("shows Stopping badge when status is Stopping", () => {
    useResponseStore.getState().setSubscribeStatus("Stopping");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Stopping")).toBeInTheDocument();
  });

  test("shows a danger Error tag carrying the message as its tooltip", () => {
    useResponseStore.getState().setSubscribeStatus("Error", "connection failed");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    const errorTag = screen.getByText("Error");
    expect(errorTag).toHaveClass("text-danger");
    expect(errorTag).toHaveAttribute("title", "connection failed");
  });
});

// ── Auto-stop: connectionStatus branch (CONS-07) ──────────────────────────────

describe("Auto-stop on connectionStatus change (CONS-07)", () => {
  test("calls stopSubscribe when connectionStatus changes to disconnected while Running", async () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    render(<SubscribePanel {...DEFAULT_PROPS} />);

    // Simulate connection drop
    act(() => {
      useConnectionStore.setState({ connectionStatus: "disconnected" });
    });

    await waitFor(() => {
      expect(mockStopSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  test("does not call reset() on auto-stop — feed messages are preserved (D-12)", async () => {
    // Put some messages in the feed
    useResponseStore.getState().appendMessages([
      {
        routingKey: "rk",
        exchange: "ex",
        contentType: null,
        correlationId: null,
        timestamp: null,
        decoded: null,
        hexString: "0a",
        error: null,
        decodedAs: null,
        isTerminal: false,
      },
    ]);
    useResponseStore.getState().setSubscribeStatus("Running");

    render(<SubscribePanel {...DEFAULT_PROPS} />);

    act(() => {
      useConnectionStore.setState({ connectionStatus: "disconnected" });
    });

    await waitFor(() => {
      expect(mockStopSubscribe).toHaveBeenCalledTimes(1);
    });

    // Messages must still be in the feed after auto-stop
    expect(useResponseStore.getState().messages).toHaveLength(1);
  });
});

// ── Auto-stop: profile-change branch (CONS-07) ───────────────────────────────

describe("Auto-stop on profile change (CONS-07)", () => {
  test("calls stopSubscribe when activeProfileName changes while Running (co-update scenario)", async () => {
    // Arrange: component mounted with profileName="test-profile" matching store
    useResponseStore.getState().setSubscribeStatus("Running");
    const { rerender } = render(<SubscribePanel {...DEFAULT_PROPS} profileName="test-profile" />);

    // Act: both store and prop update to "new-profile" simultaneously (co-update scenario)
    // This tests that prevProfileRef (not prop comparison) detects the transition
    act(() => {
      useConnectionStore.setState({ activeProfileName: "new-profile" });
    });
    rerender(<SubscribePanel {...DEFAULT_PROPS} profileName="new-profile" />);

    // Assert: stopSubscribe must be called even though prop === store value at re-render time
    await waitFor(() => {
      expect(mockStopSubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Start button race guard (CR-03) ──────────────────────────────────────────

describe("Start button double-click guard (CR-03)", () => {
  test("second click while startSubscribe is pending is ignored", async () => {
    // Arrange: startSubscribe never resolves during this test
    let resolveStart: () => void = () => {};
    mockStartSubscribe.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      })
    );

    render(<SubscribePanel {...DEFAULT_PROPS} />);
    const startButton = screen.getByRole("button", { name: /start/i });

    // Act: first click starts the async operation
    fireEvent.click(startButton);
    // Second click fires while first is pending
    fireEvent.click(startButton);

    // Assert: only one IPC call regardless of two clicks
    expect(mockStartSubscribe).toHaveBeenCalledTimes(1);

    // Cleanup: resolve the pending promise
    act(() => resolveStart());
  });

  test("Start button is re-enabled after startSubscribe resolves", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    await waitFor(() => {
      expect(useResponseStore.getState().subscribeStatus).toBe("Running");
    });
  });
});

// ── Unmount cleanup (CR-04) ───────────────────────────────────────────────────

describe("Unmount cleanup (CR-04)", () => {
  test("calls stopSubscribe on unmount when status is Running", async () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    const { unmount } = render(<SubscribePanel {...DEFAULT_PROPS} />);

    act(() => {
      unmount();
    });

    await waitFor(() => {
      expect(mockStopSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  test("sets subscribeStatus to Idle on unmount when status is Running", () => {
    useResponseStore.getState().setSubscribeStatus("Running");
    const { unmount } = render(<SubscribePanel {...DEFAULT_PROPS} />);

    act(() => {
      unmount();
    });

    expect(useResponseStore.getState().subscribeStatus).toBe("Idle");
  });

  test("does not call stopSubscribe on unmount when status is Idle", () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    const { unmount } = render(<SubscribePanel {...DEFAULT_PROPS} />);

    act(() => {
      unmount();
    });

    expect(mockStopSubscribe).not.toHaveBeenCalled();
  });
});

// ── GAP-1: Start button enabled in Error state ────────────────────────────────

describe("Start button in Error state (GAP-1)", () => {
  test("is enabled when subscribeStatus is Error and selectedQueue is set", () => {
    useResponseStore.getState().setSubscribeStatus("Error", "connection failed");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /start/i })).not.toBeDisabled();
  });

  test("is disabled when subscribeStatus is Error and selectedQueue is empty", () => {
    useResponseStore.getState().setSubscribeStatus("Error", "connection failed");
    render(<SubscribePanel {...DEFAULT_PROPS} selectedQueue="" />);
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  test("clicking Start from Error state calls startSubscribe and transitions to Running", async () => {
    useResponseStore.getState().setSubscribeStatus("Error", "prior failure");
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    await waitFor(() => {
      expect(mockStartSubscribe).toHaveBeenCalledTimes(1);
      expect(useResponseStore.getState().subscribeStatus).toBe("Running");
    });
  });
});

// ── GAP-3: Error→Idle reset on profile change ─────────────────────────────────

describe("Error state reset on profile change (GAP-3)", () => {
  test("resets subscribeStatus to Idle when profile changes while in Error state", async () => {
    useResponseStore.getState().setSubscribeStatus("Error", "prior failure");
    render(<SubscribePanel {...DEFAULT_PROPS} profileName="test-profile" />);

    act(() => {
      useConnectionStore.setState({ activeProfileName: "new-profile" });
    });

    await waitFor(() => {
      expect(useResponseStore.getState().subscribeStatus).toBe("Idle");
    });
  });

  test("does NOT call stopSubscribe when resetting Error state on profile change", async () => {
    useResponseStore.getState().setSubscribeStatus("Error", "prior failure");
    render(<SubscribePanel {...DEFAULT_PROPS} profileName="test-profile" />);

    act(() => {
      useConnectionStore.setState({ activeProfileName: "new-profile" });
    });

    await waitFor(() => {
      expect(useResponseStore.getState().subscribeStatus).toBe("Idle");
    });

    expect(mockStopSubscribe).not.toHaveBeenCalled();
  });

  test("does NOT reset Error state when only connectionStatus changes (not profile)", async () => {
    useResponseStore.getState().setSubscribeStatus("Error", "prior failure");
    render(<SubscribePanel {...DEFAULT_PROPS} />);

    act(() => {
      useConnectionStore.setState({ connectionStatus: "disconnected" });
    });

    // Status must still be Error — only profile change triggers reset in Error state
    // Wait one tick for any potential useEffect to fire
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useResponseStore.getState().subscribeStatus).toBe("Error");
  });
});

// ── Confirmation on non-local hosts ───────────────────────────────────────────

describe("confirmation on non-local hosts", () => {
  beforeEach(() => {
    useConnectionStore.setState({
      profiles: [{ ...LOCAL_PROFILE, host: "rabbit.staging.internal" }],
    });
  });

  test("clicking Start opens a confirmation instead of subscribing", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("rabbit.staging.internal");
    expect(dialog).toHaveTextContent("my-queue");
    expect(mockStartSubscribe).not.toHaveBeenCalled();
  });

  test("subscribes after the user confirms", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /start subscribing/i }));
    await waitFor(() => {
      expect(mockStartSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  test("does not subscribe when the user cancels", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(mockStartSubscribe).not.toHaveBeenCalled();
  });
});

describe("environment tags and read-only profiles", () => {
  test("a production tag forces confirmation even on localhost", async () => {
    useConnectionStore.setState({
      profiles: [{ ...LOCAL_PROFILE, environment: "production" }],
    });
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/production/i);
    expect(mockStartSubscribe).not.toHaveBeenCalled();
  });

  test("a read-only profile disables Start", () => {
    useConnectionStore.setState({
      profiles: [{ ...LOCAL_PROFILE, read_only: true }],
    });
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /^start$/i })).toBeDisabled();
  });
});

// ── Tap mode (non-destructive) ────────────────────────────────────────────────

describe("tap mode", () => {
  test("starts a tap without confirmation, even on a remote host", async () => {
    useConnectionStore.setState({
      profiles: [{ ...LOCAL_PROFILE, host: "rabbit.staging.internal" }],
    });
    render(<SubscribePanel {...DEFAULT_PROPS} mode="tap" />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    await waitFor(() => {
      expect(mockStartSubscribe).toHaveBeenCalledWith(
        "test-profile",
        "my-queue",
        ["MyMessage"],
        expect.anything(),
        "tap",
      );
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  test("stays available on a read-only profile", () => {
    useConnectionStore.setState({
      profiles: [{ ...LOCAL_PROFILE, read_only: true }],
    });
    render(<SubscribePanel {...DEFAULT_PROPS} mode="tap" />);
    expect(screen.getByRole("button", { name: /^start$/i })).not.toBeDisabled();
    expect(screen.getByText(/non-destructive/i)).toBeInTheDocument();
  });
});

// ── Delivery batching ─────────────────────────────────────────────────────────

import { Channel } from "@tauri-apps/api/core";
import { FEED_FLUSH_MS } from "@/lib/feedBatcher";
import type { DrainResult } from "@/lib/types";

describe("delivery batching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The callback handed to the (mocked) Channel by the most recent Start. */
  function channelCallback(): (msg: DrainResult) => void {
    const instances = vi.mocked(Channel).mock.instances as unknown as Array<{ cb: (msg: DrainResult) => void }>;
    return instances[instances.length - 1].cb;
  }

  const delivery = (routingKey: string, isTerminal = false): DrainResult => ({
    routingKey,
    exchange: "",
    contentType: null,
    correlationId: null,
    timestamp: null,
    decoded: null,
    hexString: "0a",
    error: null,
    decodedAs: null,
    isTerminal,
  });

  test("applies a burst of deliveries to the store in one update", () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    const cb = channelCallback();
    act(() => {
      cb(delivery("a"));
      cb(delivery("b"));
      cb(delivery("c"));
    });
    expect(useResponseStore.getState().messages).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(FEED_FLUSH_MS);
    });
    expect(useResponseStore.getState().messages.map((m) => m.routingKey)).toEqual(["c", "b", "a"]);
  });

  test("a terminal delivery lands immediately and returns the session to Idle", async () => {
    render(<SubscribePanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
    await act(async () => {}); // let the mocked startSubscribe resolve → Running
    expect(useResponseStore.getState().subscribeStatus).toBe("Running");
    const cb = channelCallback();
    act(() => {
      cb(delivery("a"));
      cb(delivery("closed", true));
    });
    expect(useResponseStore.getState().messages).toHaveLength(2);
    expect(useResponseStore.getState().subscribeStatus).toBe("Idle");
  });
});
