import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useDestination } from "@/components/compose/useDestination";
import { useConnectionStore } from "@/stores/useConnectionStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

import { invoke } from "@tauri-apps/api/core";
import { invalidateCatalog } from "@/lib/brokerCatalog";

const mockInvoke = vi.mocked(invoke);

/** Renders every value the hook exposes as text so tests can assert on state. */
function Harness() {
  const d = useDestination();
  return (
    <div>
      <button onClick={() => d.setMode("exchange")}>to exchange</button>
      <button onClick={() => d.setMode("queue")}>to queue</button>
      <select
        aria-label="target"
        value={d.mode === "queue" ? d.selectedQueue : d.selectedExchange}
        onChange={(e) =>
          d.mode === "queue"
            ? d.setSelectedQueue(e.target.value)
            : d.setSelectedExchange(e.target.value)
        }
      >
        <option value="" />
        {d.mode === "queue"
          ? d.queues.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))
          : d.exchanges.map((ex) => (
              <option key={ex.name} value={ex.name}>
                {ex.name}
              </option>
            ))}
      </select>
      <span data-testid="status">{d.managementStatus}</span>
      <span data-testid="auth-error">{d.managementAuthError ?? ""}</span>
      <span data-testid="combobox">{String(d.useCombobox)}</span>
      <span data-testid="loading">{String(d.isLoadingBindings)}</span>
      <span data-testid="binding-keys">{d.bindingKeys.join(",")}</span>
      <span data-testid="exchange-type">{d.selectedExchangeType}</span>
      <span data-testid="target">{d.targetName}</span>
      <span data-testid="has-target">{String(d.hasTarget)}</span>
      <span data-testid="depth">{d.queueDepth === null ? "—" : String(d.queueDepth)}</span>
    </div>
  );
}

function seedConnection(overrides: Partial<ReturnType<typeof useConnectionStore.getState>> = {}) {
  useConnectionStore.setState({
    profiles: [],
    activeProfileName: "test-profile",
    connectionStatus: "connected",
    connectionError: null,
    managementStatus: "unknown",
    managementAuthError: null,
    queues: [],
    exchanges: [],
    ...overrides,
  });
}

beforeEach(() => {
  invalidateCatalog();
  vi.clearAllMocks();
  seedConnection();
  mockInvoke.mockImplementation(() => Promise.resolve([]));
});

afterEach(async () => {
  await act(async () => {});
});

describe("catalog state", () => {
  it("reports a live catalog once queues load", async () => {
    mockInvoke.mockImplementation((cmd: string) =>
      cmd === "fetch_queues" ? Promise.resolve(["orders"]) : Promise.resolve([])
    );
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("live"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent("");
  });

  it("falls back to manual entry when the Management API is unreachable", async () => {
    mockInvoke.mockImplementation((cmd: string) =>
      cmd === "fetch_queues"
        ? Promise.reject(new Error("error sending request"))
        : Promise.resolve([])
    );
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("manual"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent("");
  });

  it("surfaces a 401 instead of silently switching to manual", async () => {
    mockInvoke.mockImplementation((cmd: string) =>
      cmd === "fetch_queues"
        ? Promise.reject(
            new Error("Management API authentication failed: wrong credentials (HTTP 401)")
          )
        : Promise.resolve([])
    );
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("auth-error")).toHaveTextContent(/authentication failed/i)
    );
    expect(screen.getByTestId("status")).not.toHaveTextContent("manual");
  });
});

describe("binding suggestions", () => {
  it("calls fetch_bindings when a direct exchange is selected", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "orders", exchange_type: "direct" }]);
      if (cmd === "fetch_bindings") return Promise.resolve(["orders.eu"]);
      return Promise.resolve([]);
    });
    render(<Harness />);
    fireEvent.click(screen.getByText("to exchange"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" })
    );
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "orders" } });

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("fetch_bindings", {
        profileName: "test-profile",
        exchangeName: "orders",
      })
    );
    await waitFor(() => expect(screen.getByTestId("binding-keys")).toHaveTextContent("orders.eu"));
    expect(screen.getByTestId("combobox")).toHaveTextContent("true");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("does NOT call fetch_bindings for a fanout exchange", async () => {
    mockInvoke.mockImplementation((cmd: string) =>
      cmd === "fetch_exchanges"
        ? Promise.resolve([{ name: "logs", exchange_type: "fanout" }])
        : Promise.resolve([])
    );
    render(<Harness />);
    fireEvent.click(screen.getByText("to exchange"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" })
    );
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "logs" } });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke.mock.calls.filter((args) => args[0] === "fetch_bindings")).toHaveLength(0);
    expect(screen.getByTestId("exchange-type")).toHaveTextContent("fanout");
  });

  it("does NOT call fetch_bindings for a headers exchange", async () => {
    mockInvoke.mockImplementation((cmd: string) =>
      cmd === "fetch_exchanges"
        ? Promise.resolve([{ name: "my-headers", exchange_type: "headers" }])
        : Promise.resolve([])
    );
    render(<Harness />);
    fireEvent.click(screen.getByText("to exchange"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" })
    );
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "my-headers" } });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke.mock.calls.filter((args) => args[0] === "fetch_bindings")).toHaveLength(0);
  });

  it("D-10: falls back silently when fetch_bindings rejects", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "orders", exchange_type: "direct" }]);
      if (cmd === "fetch_bindings")
        return Promise.reject(new Error("Management API authentication failed"));
      return Promise.resolve([]);
    });
    render(<Harness />);
    fireEvent.click(screen.getByText("to exchange"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" })
    );
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "orders" } });

    await waitFor(() => expect(screen.getByTestId("combobox")).toHaveTextContent("false"));
    // the bindings 401 must never reach the catalog status
    expect(screen.getByTestId("auth-error")).toHaveTextContent("");
  });
});

describe("target and queue depth", () => {
  it("reads the depth of the selected queue", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["orders"]);
      if (cmd === "fetch_queue_depth") return Promise.resolve(12);
      return Promise.resolve([]);
    });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("live"));
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "orders" } });

    await waitFor(() => expect(screen.getByTestId("depth")).toHaveTextContent("12"));
    expect(screen.getByTestId("target")).toHaveTextContent("orders");
    expect(screen.getByTestId("has-target")).toHaveTextContent("true");
  });

  it("has no queue depth in exchange mode", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "orders", exchange_type: "topic" }]);
      if (cmd === "fetch_queue_depth") return Promise.resolve(12);
      return Promise.resolve([]);
    });
    render(<Harness />);
    fireEvent.click(screen.getByText("to exchange"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" })
    );
    fireEvent.change(screen.getByLabelText("target"), { target: { value: "orders" } });

    await waitFor(() => expect(screen.getByTestId("target")).toHaveTextContent("orders"));
    expect(screen.getByTestId("depth")).toHaveTextContent("—");
    expect(mockInvoke.mock.calls.filter((args) => args[0] === "fetch_queue_depth")).toHaveLength(0);
  });
});
