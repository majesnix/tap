import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PublishBar, buildPublishArgs } from "@/components/publish/PublishBar";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";

// Module-scope mock for sonner — uses vi.hoisted() so the factory reference is valid
// after hoisting. vi.mock() factories are hoisted before const declarations; vi.hoisted()
// creates the variable in the hoisted block so it is always initialized first.
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock shadcn Select with a native <select> to avoid Radix UI portal/pointer-event issues in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      role="combobox"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// Mock SearchableSelect with a native <select> — cmdk/Radix portals don't work in jsdom.
// Renders one <option> per item so fireEvent.change(value) works; keeps role="combobox"
// so getTargetCombobox() (last combobox in the DOM) still resolves to the target picker.
vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    placeholder,
    items,
  }: {
    value?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    items: { value: string }[];
  }) => (
    <select role="combobox" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.value}
        </option>
      ))}
    </select>
  ),
}));

// Mock RoutingKeyCombobox to avoid cmdk/Radix portal issues in PublishBar integration tests
vi.mock("../RoutingKeyCombobox", () => ({
  RoutingKeyCombobox: ({
    value,
    onChange,
    isLoading,
  }: {
    value: string;
    onChange: (v: string) => void;
    bindingKeys: string[];
    isLoading: boolean;
  }) => (
    <input
      aria-label="Routing key combobox"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-loading={isLoading}
    />
  ),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

function getTargetCombobox() {
  const all = screen.getAllByRole("combobox");
  return all[all.length - 1];
}

afterEach(async () => {
  await act(async () => {});
});

describe("buildPublishArgs", () => {
  it("PUBL-01: queue mode uses empty string exchange and queue name as routing key", () => {
    const result = buildPublishArgs("queue", "orders", "", "");
    expect(result).toEqual({ exchange: "", routingKey: "orders" });
  });

  it("PUBL-01: exchange must be empty string (not amq.default or default)", () => {
    const result = buildPublishArgs("queue", "my-queue", "", "");
    expect(result.exchange).toBe("");
  });

  it("PUBL-02: exchange mode uses named exchange and explicit routing key", () => {
    const result = buildPublishArgs("exchange", "", "my-exchange", "my.routing.key");
    expect(result).toEqual({ exchange: "my-exchange", routingKey: "my.routing.key" });
  });
});

describe("PublishBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: null,
      connectionStatus: "disconnected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });
    // Default: IPC calls return empty arrays
    mockInvoke.mockImplementation(() => Promise.resolve([]));
  });

  it("Send button is disabled when no active connection", () => {
    render(<PublishBar />);
    const sendBtn = screen.getByRole("button", { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  it("shows Live badge and queue dropdown when Management API returns queues", async () => {
    useConnectionStore.setState({
      profiles: [{ name: "Local", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false }],
      activeProfileName: "Local",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "live",
      managementAuthError: null,
      queues: ["orders", "payments"],
      exchanges: [],
    });

    render(<PublishBar />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    // Queue dropdown should be rendered (profile + queue = 2 comboboxes)
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
  });

  it("shows Manual badge and text input when Management API unavailable", async () => {
    useConnectionStore.setState({
      profiles: [{ name: "Local", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false }],
      activeProfileName: "Local",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "manual",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
    // Text input should be rendered instead of dropdown
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows auth error message when Management API returns 401", async () => {
    // Mock fetch_queues to reject with auth error — simulates real 401 flow
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") {
        return Promise.reject(new Error("Management API authentication failed: wrong credentials (HTTP 401)"));
      }
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [{ name: "Local", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false }],
      activeProfileName: "Local",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);

    // Wait for the async fetch to reject and auth error to be set
    await waitFor(() => {
      // Auth error badge must be visible — NOT the silent Manual badge
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });
    // Must NOT show the plain Manual badge
    expect(screen.queryByText("Manual")).not.toBeInTheDocument();
  });

  it("shows routing key input in Exchange mode", async () => {
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "Local",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    // Switch to Exchange mode
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/routing key/i)).toBeInTheDocument();
    });
  });

  it("hides routing key input in Queue mode", () => {
    render(<PublishBar />);
    // Default mode is Queue
    expect(screen.queryByPlaceholderText(/routing key/i)).not.toBeInTheDocument();
  });
});

describe("Phase 9 — Routing Key Autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: null,
      connectionStatus: "disconnected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });
    mockInvoke.mockImplementation(() => Promise.resolve([]));
  });

  it("calls fetch_bindings when a direct exchange is selected", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "orders", exchange_type: "direct" }]);
      if (cmd === "fetch_bindings") return Promise.resolve(["orders.eu"]);
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    // Switch to exchange mode — triggers fetchExchanges
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    // Wait for exchanges to be populated
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" });
    });
    // Select the exchange
    fireEvent.change(getTargetCombobox(), { target: { value: "orders" } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("fetch_bindings", {
        profileName: "test-profile",
        exchangeName: "orders",
      });
    });
  });

  it("does NOT call fetch_bindings for fanout exchange", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "logs", exchange_type: "fanout" }]);
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" });
    });
    fireEvent.change(getTargetCombobox(), { target: { value: "logs" } });

    await new Promise((r) => setTimeout(r, 50));
    const bindingsCalls = mockInvoke.mock.calls.filter(
      (args) => args[0] === "fetch_bindings"
    );
    expect(bindingsCalls).toHaveLength(0);
  });

  it("does NOT call fetch_bindings for headers exchange", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "my-headers", exchange_type: "headers" }]);
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("fetch_exchanges", { profileName: "test-profile" });
    });
    fireEvent.change(getTargetCombobox(), { target: { value: "my-headers" } });

    await new Promise((r) => setTimeout(r, 50));
    const bindingsCalls = mockInvoke.mock.calls.filter(
      (args) => args[0] === "fetch_bindings"
    );
    expect(bindingsCalls).toHaveLength(0);
  });

  it("shows hint text for fanout exchange (D-06)", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "logs", exchange_type: "fanout" }]);
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "logs" } });

    await waitFor(() => {
      expect(
        screen.getByText("Routing key is ignored for fanout exchanges.")
      ).toBeInTheDocument();
    });
  });

  it("shows hint text for headers exchange (D-06)", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "my-headers", exchange_type: "headers" }]);
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "my-headers" } });

    await waitFor(() => {
      expect(
        screen.getByText("Headers exchanges route by message headers, not routing key.")
      ).toBeInTheDocument();
    });
  });

  it("renders RoutingKeyCombobox (not plain Input) when bindings fetch succeeds", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "orders", exchange_type: "direct" }]);
      if (cmd === "fetch_bindings") return Promise.resolve(["orders.eu"]);
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "orders" } });

    await waitFor(() => {
      // RoutingKeyCombobox mock renders aria-label="Routing key combobox"
      expect(screen.getByLabelText("Routing key combobox")).toBeInTheDocument();
    });
  });

  it("renders plain Input (not combobox) when fetch_bindings rejects (D-10 silent fallback)", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_exchanges")
        return Promise.resolve([{ name: "orders", exchange_type: "direct" }]);
      if (cmd === "fetch_bindings")
        return Promise.reject(new Error("Management API authentication failed"));
      return Promise.resolve([]);
    });

    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "unknown",
      managementAuthError: null,
      queues: [],
      exchanges: [],
    });

    render(<PublishBar />);
    fireEvent.click(screen.getByRole("radio", { name: /exchange/i }));
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "orders" } });

    await waitFor(() => {
      // Plain Input has placeholder="Routing key" — combobox should NOT be present
      expect(screen.queryByLabelText("Routing key combobox")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Routing key")).toBeInTheDocument();
    });
    // No destructive auth error badge should appear
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Phase 10 — Publisher Confirms Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true }); // Required: first timer-dependent tests in this file
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "live",
      managementAuthError: null,
      queues: ["test-queue"],
      exchanges: [],
    });
    // CRITICAL: seed hexPreview so handleSend does not early-return at the
    // "if (!hexPreview)" guard. Without this, clicking Send is a no-op and
    // all waitFor(badge) assertions time out.
    useProtoStore.setState({
      hexPreview: "0a 05 68 65 6c 6c 6f",
      encodeError: null,
      latestValues: {},
      selectedMessageType: "TestMessage",
    });
    // Default: fetch_queues returns queue list; publish_message is overridden per test
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test in this block
  });

  it("PUBL-05: shows green ACK badge after broker confirms delivery", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "ack" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    // Select a queue and click Send
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });
    // We call handleSend by clicking the Send button (it is connected+hasTarget)
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText("ACK")).toBeInTheDocument());
    // Verify the badge element has the green className
    expect(screen.getByText("ACK").closest("[data-slot='badge']")).toHaveClass("bg-emerald-500/10");
  });

  it("PUBL-05: ACK badge auto-dismisses after 3 seconds", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "ack" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText("ACK"));
    act(() => vi.advanceTimersByTime(3000));
    await waitFor(() => expect(screen.queryByText("ACK")).not.toBeInTheDocument());
  });

  it("PUBL-06: shows amber Returned badge when message is unrouted", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "returned" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText("Returned")).toBeInTheDocument());
    expect(screen.getByText("Returned").closest("[data-slot='badge']")).toHaveClass("bg-amber-500/10");
  });

  it("PUBL-07: shows red NACK badge on broker negative acknowledgment", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "nack" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText("NACK")).toBeInTheDocument());
    expect(screen.getByText("NACK").closest("[data-slot='badge']")).toHaveClass("bg-destructive/10");
  });

  it("PUBL-08: Timeout badge does not auto-dismiss and shows dismiss button", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "timeout" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText("Timeout")).toBeInTheDocument());
    // Advance far past any dismiss window — badge must still be visible
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("Timeout")).toBeInTheDocument();
    // Dismiss button must be present only for Timeout
    expect(screen.getByLabelText("Dismiss timeout badge")).toBeInTheDocument();
  });

  it("PUBL-08: clicking dismiss button hides the Timeout badge", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "timeout" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByLabelText("Dismiss timeout badge"));
    fireEvent.click(screen.getByLabelText("Dismiss timeout badge"));
    expect(screen.queryByText("Timeout")).not.toBeInTheDocument();
  });

  it("D-09: new send replaces prior badge immediately without queuing", async () => {
    let callCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") {
        callCount++;
        // First call → ack, second call → nack
        return Promise.resolve({ status: callCount === 1 ? "ack" : "nack" });
      }
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    await waitFor(() => getTargetCombobox());
    fireEvent.change(getTargetCombobox(), { target: { value: "test-queue" } });

    // First send → ACK badge
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText("ACK"));

    // Second send → NACK badge replaces ACK
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText("NACK"));
    // ACK badge must be gone
    expect(screen.queryByText("ACK")).not.toBeInTheDocument();
  });
});
