import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// This file deliberately uses the real Popover primitive: the point under test
// is that closing the popover does not unmount SubscribePanel, whose unmount
// cleanup stops a running tap.

vi.mock("@/lib/ipc", () => ({
  drainMessages: vi.fn(),
  fetchQueues: vi.fn().mockRejectedValue(new Error("no management")),
  fetchQueueDepth: vi.fn().mockResolvedValue(0),
  startSubscribe: vi.fn().mockResolvedValue(undefined),
  stopSubscribe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { invalidateCatalog } from "@/lib/brokerCatalog";
import { stopSubscribe } from "@/lib/ipc";
import { ReadModePopover } from "../ReadModePopover";

beforeEach(() => {
  invalidateCatalog();
  vi.clearAllMocks();
  useResponseStore.setState({
    selectedQueue: "orders",
    selectedDecodeTypes: ["MyMessage"],
    subscribeStatus: "Idle",
    subscribeError: null,
    messages: [],
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
});

afterEach(async () => {
  await act(async () => {});
});

describe("popover mounting", () => {
  test("keeps the live controls mounted while closed so a running tap survives", async () => {
    useResponseStore.setState({ subscribeStatus: "Running" });
    const { rerender } = render(
      <ReadModePopover open onOpenChange={vi.fn()} mode="tap" onModeChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();

    await act(async () => {
      rerender(
        <ReadModePopover open={false} onOpenChange={vi.fn()} mode="tap" onModeChange={vi.fn()} />
      );
    });

    // Still in the DOM (CSS hides it), and no stop was issued.
    expect(screen.getByRole("button", { name: /stop/i, hidden: true })).toBeInTheDocument();
    expect(vi.mocked(stopSubscribe)).not.toHaveBeenCalled();
    expect(useResponseStore.getState().subscribeStatus).toBe("Running");
  });
});
