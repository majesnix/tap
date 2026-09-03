import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useDestination } from "@/components/compose/useDestination";
import { usePublish } from "@/components/compose/usePublish";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useAmqpStore, INITIAL_PROPERTIES } from "@/stores/useAmqpStore";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn() })
);
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import { invalidateCatalog } from "@/lib/brokerCatalog";

const mockInvoke = vi.mocked(invoke);

const PROFILE = {
  name: "test-profile",
  host: "localhost",
  port: 5672,
  vhost: "/",
  username: "dev",
  management_port: 15672,
  management_ssl: false,
};

function Harness() {
  const destination = useDestination();
  const publish = usePublish(destination);
  return (
    <div>
      <select
        aria-label="target"
        value={destination.selectedQueue}
        onChange={(e) => destination.setSelectedQueue(e.target.value)}
      >
        <option value="" />
        <option value="test-queue">test-queue</option>
      </select>
      <button onClick={publish.send} disabled={!publish.canSend || publish.isSending}>
        Send
      </button>
      <button onClick={publish.confirmPublish}>Confirm</button>
      <button onClick={publish.cancelPublish}>Cancel</button>
      <button onClick={publish.dismissOutcome}>Dismiss</button>
      <span data-testid="outcome">{publish.outcome?.status ?? "none"}</span>
      <span data-testid="outcome-at">{publish.outcomeAt ?? "none"}</span>
      <span data-testid="can-send">{String(publish.canSend)}</span>
      <span data-testid="reason">{publish.disabledReason ?? "none"}</span>
      <span data-testid="sending">{String(publish.isSending)}</span>
      <span data-testid="pending">{publish.pendingPublish?.kind ?? "none"}</span>
    </div>
  );
}

async function renderAndPickQueue() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByLabelText("target")).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("target"), { target: { value: "test-queue" } });
  await waitFor(() => expect(screen.getByTestId("can-send")).toHaveTextContent("true"));
}

beforeEach(() => {
  invalidateCatalog();
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useConnectionStore.setState({
    profiles: [PROFILE],
    activeProfileName: "test-profile",
    connectionStatus: "connected",
    connectionError: null,
    managementStatus: "live",
    managementAuthError: null,
    queues: ["test-queue"],
    exchanges: [],
  });
  useProtoStore.setState({
    hexPreview: "0a 05",
    encodeError: null,
    latestValues: { value: "hi" },
    selectedMessageType: "TestMessage",
    activeFilePath: "/fake/test.proto",
  });
  useAmqpStore.setState({ properties: { ...INITIAL_PROPERTIES, headers: [] } });
  useHistoryStore.setState({ entries: [], historyLoaded: true });
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
    if (cmd === "encode_message") return Promise.resolve("CgU=");
    if (cmd === "publish_message") return Promise.resolve({ status: "ack" });
    return Promise.resolve([]);
  });
});

afterEach(async () => {
  await act(async () => {});
  vi.useRealTimers();
  useProtoStore.getState().reset();
});

describe("delivery outcome", () => {
  it("PUBL-05: reports an ACK and auto-dismisses it after 3 seconds", async () => {
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("ack"));
    expect(screen.getByTestId("outcome-at")).not.toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(3000));
    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("none"));
  });

  it("PUBL-06: a Returned outcome lives for 5 seconds", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "encode_message") return Promise.resolve("CgU=");
      if (cmd === "publish_message") return Promise.resolve({ status: "returned" });
      return Promise.resolve([]);
    });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("returned"));

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId("outcome")).toHaveTextContent("returned");
    act(() => vi.advanceTimersByTime(2000));
    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("none"));
  });

  it("PUBL-07: a NACK lives for 5 seconds", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "encode_message") return Promise.resolve("CgU=");
      if (cmd === "publish_message") return Promise.resolve({ status: "nack" });
      return Promise.resolve([]);
    });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("nack"));

    act(() => vi.advanceTimersByTime(5000));
    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("none"));
  });

  it("PUBL-08: a Timeout never auto-dismisses but can be dismissed by hand", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "encode_message") return Promise.resolve("CgU=");
      if (cmd === "publish_message") return Promise.resolve({ status: "timeout" });
      return Promise.resolve([]);
    });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("timeout"));

    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByTestId("outcome")).toHaveTextContent("timeout");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByTestId("outcome")).toHaveTextContent("none");
  });
});

describe("the send pipeline", () => {
  it("re-encodes the latest form values before publishing", async () => {
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "publish_message",
        expect.objectContaining({ exchange: "", routingKey: "test-queue" })
      )
    );
    const commands = mockInvoke.mock.calls.map((args) => args[0]);
    expect(commands.indexOf("encode_message")).toBeGreaterThanOrEqual(0);
    expect(commands.indexOf("encode_message")).toBeLessThan(commands.indexOf("publish_message"));
    expect(mockInvoke).toHaveBeenCalledWith("encode_message", {
      messageType: "TestMessage",
      formValues: { value: "hi" },
    });
  });

  it("sends when the store's send signal fires (mod+enter)", async () => {
    await renderAndPickQueue();
    act(() => {
      useProtoStore.getState().requestSend();
    });

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "publish_message",
        expect.objectContaining({ routingKey: "test-queue" })
      )
    );
  });

  it("asks a production profile for confirmation before anything leaves the machine", async () => {
    useConnectionStore.setState({ profiles: [{ ...PROFILE, environment: "production" }] });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("publish"));
    expect(mockInvoke).not.toHaveBeenCalledWith("publish_message", expect.anything());

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "publish_message",
        expect.objectContaining({ routingKey: "test-queue" })
      )
    );
    expect(screen.getByTestId("pending")).toHaveTextContent("none");
  });

  it("cancelling the confirmation publishes nothing", async () => {
    useConnectionStore.setState({ profiles: [{ ...PROFILE, environment: "production" }] });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("publish"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("pending")).toHaveTextContent("none");
    expect(mockInvoke).not.toHaveBeenCalledWith("publish_message", expect.anything());
  });

  it("refuses to send through a read-only profile", async () => {
    useConnectionStore.setState({ profiles: [{ ...PROFILE, read_only: true }] });
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText("target")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "test-queue" } });

    expect(screen.getByTestId("can-send")).toHaveTextContent("false");
    expect(screen.getByTestId("reason")).toHaveTextContent("Profile is read-only");
  });

  it("explains a missing connection and a missing target", async () => {
    useConnectionStore.setState({ connectionStatus: "disconnected" });
    render(<Harness />);
    expect(screen.getByTestId("reason")).toHaveTextContent(
      "Connect to a RabbitMQ profile to send."
    );

    act(() => {
      useConnectionStore.setState({ connectionStatus: "connected" });
    });
    await waitFor(() => expect(screen.getByTestId("reason")).toHaveTextContent(/queue/i));
    expect(screen.getByTestId("can-send")).toHaveTextContent("false");
  });

  it("reports a failed publish as a toast", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "encode_message") return Promise.resolve("CgU=");
      if (cmd === "publish_message") return Promise.reject(new Error("broker is gone"));
      return Promise.resolve([]);
    });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Send failed: broker is gone", {
        duration: 5000,
      })
    );
    await waitFor(() =>
      expect(useHistoryStore.getState().entries[0]?.status).toBe("failed")
    );
  });
});

describe("history recording", () => {
  it("records the outcome, correlation id and reply-to of a successful send", async () => {
    useAmqpStore.setState({
      properties: {
        ...INITIAL_PROPERTIES,
        correlationId: "req-7c1e",
        replyTo: "orders.reply",
        headers: [],
      },
    });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(useHistoryStore.getState().entries).toHaveLength(1));
    const entry = useHistoryStore.getState().entries[0];
    expect(entry).toMatchObject({
      status: "sent",
      outcome: "ack",
      correlationId: "req-7c1e",
      replyTo: "orders.reply",
      messageTypeName: "TestMessage",
      routingKey: "test-queue",
      exchange: "",
      protoPath: "/fake/test.proto",
    });
  });

  it("records nothing for a profile with record_history off", async () => {
    useConnectionStore.setState({ profiles: [{ ...PROFILE, record_history: false }] });
    await renderAndPickQueue();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("ack"));
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });
});
