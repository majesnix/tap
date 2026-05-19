import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PublishBar, buildPublishArgs } from "@/components/publish/PublishBar";
import { useConnectionStore } from "@/stores/useConnectionStore";

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
    // Dropdown should be rendered (not text input)
    expect(screen.queryByRole("combobox")).toBeTruthy();
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
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "orders" } });

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
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "logs" } });

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
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "my-headers" } });

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
    await waitFor(() => screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "logs" } });

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
    await waitFor(() => screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "my-headers" } });

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
    await waitFor(() => screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "orders" } });

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
    await waitFor(() => screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "orders" } });

    await waitFor(() => {
      // Plain Input has placeholder="Routing key" — combobox should NOT be present
      expect(screen.queryByLabelText("Routing key combobox")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Routing key")).toBeInTheDocument();
    });
    // No destructive auth error badge should appear
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
