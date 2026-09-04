import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequestFooter } from "@/components/compose/RequestFooter";
import type { usePublish } from "@/components/compose/usePublish";
import { useProtoStore } from "@/stores/useProtoStore";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn() })
);
vi.mock("sonner", () => ({ toast: toastMock }));

const { mockSave, mockWriteFile } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockWriteFile: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mockSave }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: mockWriteFile }));

// Radix tooltips never open in jsdom — render trigger and content inline.
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

type Publish = ReturnType<typeof usePublish>;

const HEX = "0a 05 68 65 6c 6c 6f";

function makePublish(overrides: Partial<Publish> = {}): Publish {
  return {
    send: vi.fn(),
    isSending: false,
    canSend: true,
    readOnly: false,
    isConnected: true,
    disabledReason: null,
    outcome: null,
    dismissOutcome: vi.fn(),
    outcomeAt: null,
    pendingPublish: null,
    confirmPublish: vi.fn(),
    cancelPublish: vi.fn(),
    ...overrides,
  } as Publish;
}

function renderFooter(
  publishOverrides: Partial<Publish> = {},
  { hexOpen = false, targetName = "orders" } = {}
) {
  const onToggleHex = vi.fn();
  const publish = makePublish(publishOverrides);
  const utils = render(
    <RequestFooter
      publish={publish}
      targetName={targetName}
      messageFullName="example.Order"
      hexOpen={hexOpen}
      onToggleHex={onToggleHex}
    />
  );
  return { ...utils, onToggleHex, publish };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.setState({ hexPreview: HEX, encodeError: null });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("hex strip", () => {
  it("shows the byte count and the inline bytes", () => {
    renderFooter();
    const strip = screen.getByTestId("hex-strip");
    expect(strip).toHaveTextContent("7 B");
    expect(strip).toHaveTextContent("0a 05 68 65 6c 6c 6f");
    expect(strip).toHaveTextContent("Expand");
  });

  it("invites the user to fill in the form when there are no bytes yet", () => {
    useProtoStore.setState({ hexPreview: "", encodeError: null });
    renderFooter();
    expect(screen.getByText("Fill in the form to see the wire bytes")).toBeInTheDocument();
  });

  it("shows an encode error instead of the bytes", () => {
    useProtoStore.setState({ hexPreview: "", encodeError: "field 'id' is not a number" });
    renderFooter();
    expect(screen.getByText("field 'id' is not a number")).toBeInTheDocument();
  });

  it("toggles the dump", () => {
    const { onToggleHex } = renderFooter();
    fireEvent.click(screen.getByText("Expand"));
    expect(onToggleHex).toHaveBeenCalledTimes(1);
  });

  it("renders the dump with its header and actions when open", () => {
    renderFooter({}, { hexOpen: true });
    expect(screen.getByText("wire format · 7 bytes · example.Order")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy hex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save .bin" })).toBeInTheDocument();
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("copies the hex to the clipboard", async () => {
    renderFooter({}, { hexOpen: true });
    fireEvent.click(screen.getByRole("button", { name: "Copy hex" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(HEX));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Hex copied"));
  });

  it("saves the payload as a .bin file", async () => {
    mockSave.mockResolvedValue("/tmp/Order.bin");
    mockWriteFile.mockResolvedValue(undefined);
    renderFooter({}, { hexOpen: true });
    fireEvent.click(screen.getByRole("button", { name: "Save .bin" }));

    await waitFor(() => expect(mockWriteFile).toHaveBeenCalled());
    const [path, bytes] = mockWriteFile.mock.calls[0];
    expect(path).toBe("/tmp/Order.bin");
    expect(Array.from(bytes as Uint8Array)).toEqual([0x0a, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
  });

  it("stays quiet when the save dialog is cancelled", async () => {
    mockSave.mockResolvedValue(null);
    renderFooter({}, { hexOpen: true });
    fireEvent.click(screen.getByRole("button", { name: "Save .bin" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});

describe("send button", () => {
  it("names the target and shows the shortcut", () => {
    renderFooter();
    const send = screen.getByRole("button", { name: /Send to orders/ });
    expect(send).toBeEnabled();
    expect(send).toHaveTextContent("↵");
  });

  it("calls send when clicked", () => {
    const { publish } = renderFooter();
    fireEvent.click(screen.getByRole("button", { name: /Send to orders/ }));
    expect(publish.send).toHaveBeenCalledTimes(1);
  });

  it("is disabled with a reason when the profile is read-only", () => {
    renderFooter({ canSend: false, readOnly: true, disabledReason: "Profile is read-only" });
    expect(screen.getByRole("button", { name: /Send to orders/ })).toBeDisabled();
    expect(screen.getByText("Profile is read-only")).toBeInTheDocument();
  });

  it("is disabled with a reason when disconnected", () => {
    renderFooter({
      canSend: false,
      isConnected: false,
      disabledReason: "Connect to a RabbitMQ profile to send.",
    });
    expect(screen.getByRole("button", { name: /Send/ })).toBeDisabled();
    expect(screen.getByText("Connect to a RabbitMQ profile to send.")).toBeInTheDocument();
  });

  it("is disabled with a reason when no target is chosen", () => {
    renderFooter(
      { canSend: false, disabledReason: "Pick a queue to send to" },
      { targetName: "" }
    );
    expect(screen.getByRole("button", { name: /Send/ })).toBeDisabled();
    expect(screen.getByText("Pick a queue to send to")).toBeInTheDocument();
  });

  it("shows the sending state", () => {
    renderFooter({ isSending: true });
    expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled();
  });
});

describe("outcome chip", () => {
  it("shows an ACK with the time it arrived", () => {
    renderFooter({ outcome: { status: "ack" }, outcomeAt: Date.parse("2026-09-03T14:02:11") });
    const chip = screen.getByTestId("outcome-chip");
    expect(chip.textContent).toMatch(/ACK · \d{2}:\d{2}:\d{2}/);
    expect(screen.queryByLabelText("Dismiss timeout badge")).not.toBeInTheDocument();
  });

  it("shows a returned message", () => {
    renderFooter({ outcome: { status: "returned" }, outcomeAt: Date.now() });
    expect(screen.getByTestId("outcome-chip")).toHaveTextContent("RETURNED");
  });

  it("shows a NACK", () => {
    renderFooter({ outcome: { status: "nack" }, outcomeAt: Date.now() });
    expect(screen.getByTestId("outcome-chip")).toHaveTextContent("NACK");
  });

  it("shows a timeout with a dismiss button", () => {
    const dismissOutcome = vi.fn();
    renderFooter({ outcome: { status: "timeout" }, outcomeAt: Date.now(), dismissOutcome });
    expect(screen.getByTestId("outcome-chip")).toHaveTextContent("TIMEOUT");
    fireEvent.click(screen.getByLabelText("Dismiss timeout badge"));
    expect(dismissOutcome).toHaveBeenCalledTimes(1);
  });

  it("shows nothing without an outcome", () => {
    renderFooter();
    expect(screen.queryByTestId("outcome-chip")).not.toBeInTheDocument();
  });
});
