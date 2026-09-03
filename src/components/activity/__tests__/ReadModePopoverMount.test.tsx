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

import { fireEvent } from "@testing-library/react";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { invalidateCatalog } from "@/lib/brokerCatalog";
import { stopSubscribe } from "@/lib/ipc";
import type { ProtoSchema } from "@/lib/types";
import { ReadModePopover } from "../ReadModePopover";

// cmdk scrolls its active item into view; jsdom has no such method.
Element.prototype.scrollIntoView = function scrollIntoView() {};

const SCHEMA: ProtoSchema = {
  messages: [{ name: "Order", full_name: "example.Order", fields: [] }],
  message_map: { "example.Order": { name: "Order", full_name: "example.Order", fields: [] } },
  enums: [],
};

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

  test("closes the portalled decode-as list when the read-mode popover closes", async () => {
    // The decode-as list portals to document.body, so the read-mode popover's
    // own data-[state=closed]:hidden cannot hide it.
    useProtoStore.getState().reset();
    act(() => {
      useProtoStore.getState().addOrActivateFile("/fake/order.proto", SCHEMA);
    });

    const { rerender } = render(
      <ReadModePopover open onOpenChange={vi.fn()} mode="peek" onModeChange={vi.fn()} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox", { name: "Decode as" }));
    });
    expect(screen.getByPlaceholderText("Filter types…")).toBeInTheDocument();

    await act(async () => {
      rerender(
        <ReadModePopover open={false} onOpenChange={vi.fn()} mode="peek" onModeChange={vi.fn()} />
      );
    });

    expect(screen.queryByPlaceholderText("Filter types…")).not.toBeInTheDocument();
  });
});
