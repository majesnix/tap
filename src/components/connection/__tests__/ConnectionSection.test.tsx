import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConnectionSection } from "@/components/sidebar/ConnectionSection";
import { useConnectionStore } from "@/stores/useConnectionStore";

// Mock Tauri IPC
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock tauri-plugin-store
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
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

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("ConnectionSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Zustand store to initial state
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: null,
      connectionStatus: "disconnected",
      connectionError: null,
      managementStatus: "unknown",
      queues: [],
      exchanges: [],
    });
    // Default: list_profiles returns empty array to prevent undefined from crashing profiles.length
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it("shows 'Add connection' hint when no profiles saved", () => {
    render(<ConnectionSection />);
    expect(screen.getByText(/add connection/i)).toBeInTheDocument();
  });

  it("shows profile dropdown when profiles exist", async () => {
    useConnectionStore.setState({
      profiles: [{ name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false }],
      activeProfileName: "Local RabbitMQ",
      connectionStatus: "disconnected",
      connectionError: null,
      managementStatus: "unknown",
      queues: [],
      exchanges: [],
    });
    render(<ConnectionSection />);
    expect(screen.getByText("Local RabbitMQ")).toBeInTheDocument();
  });

  it("opens ProfileManagementModal when gear button clicked", async () => {
    render(<ConnectionSection />);
    const manageBtn = screen.getByRole("button", { name: /manage connection profiles/i });
    fireEvent.click(manageBtn);
    await waitFor(() => {
      expect(screen.getByText(/connection profiles/i)).toBeInTheDocument();
    });
  });

  it("saves profile and updates dropdown on Save & Connect", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "save_profile") return Promise.resolve(undefined);
      if (cmd === "list_profiles") return Promise.resolve([{ name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false }]);
      return Promise.resolve(undefined);
    });

    render(<ConnectionSection />);
    // Open modal
    const manageBtn = screen.getByRole("button", { name: /manage connection profiles/i });
    fireEvent.click(manageBtn);
    // Click New Profile
    await waitFor(() => screen.getByText(/\+ new profile/i));
    fireEvent.click(screen.getByText(/\+ new profile/i));
    // Fill fields
    fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), { target: { value: "Local RabbitMQ" } });
    fireEvent.change(screen.getByPlaceholderText(/localhost/i), { target: { value: "localhost" } });
    // Save
    fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("save_profile", expect.objectContaining({
        profile: expect.objectContaining({ name: "Local RabbitMQ" }),
        password: expect.any(String),
      }));
    });
  });

  it("shows spinner then checkmark when connection test passes", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "save_profile") return Promise.resolve(undefined);
      if (cmd === "test_connection") return Promise.resolve(undefined);
      if (cmd === "list_profiles") return Promise.resolve([{ name: "Local", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false }]);
      return Promise.resolve(undefined);
    });

    render(<ConnectionSection />);
    fireEvent.click(screen.getByRole("button", { name: /manage connection profiles/i }));
    await waitFor(() => screen.getByText(/\+ new profile/i));
    fireEvent.click(screen.getByText(/\+ new profile/i));

    fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), { target: { value: "Local" } });
    fireEvent.change(screen.getByPlaceholderText(/localhost/i), { target: { value: "localhost" } });
    fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

    await waitFor(() => {
      // ConnectionTestResult shows "Connected" with emerald color inside the modal form
      const connectedElements = screen.getAllByText("Connected");
      expect(connectedElements.length).toBeGreaterThan(0);
    });
  });

  it("shows error message when connection test fails", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "save_profile") return Promise.resolve(undefined);
      if (cmd === "test_connection") return Promise.reject(new Error("Connection refused"));
      if (cmd === "list_profiles") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<ConnectionSection />);
    fireEvent.click(screen.getByRole("button", { name: /manage connection profiles/i }));
    await waitFor(() => screen.getByText(/\+ new profile/i));
    fireEvent.click(screen.getByText(/\+ new profile/i));
    fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText(/localhost/i), { target: { value: "localhost" } });
    fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

    await waitFor(() => {
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
    });
  });

  it("switching profiles calls activateProfile and updates status dot to green", async () => {
    // Seed profiles so the dropdown renders
    useConnectionStore.setState({
      profiles: [
        { name: "Local", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false },
        { name: "Staging", host: "staging.internal", port: 5672, vhost: "/", username: "admin", management_port: 15672, management_ssl: false },
      ],
      activeProfileName: "Local",
      connectionStatus: "disconnected",
      connectionError: null,
      managementStatus: "unknown",
      queues: [],
      exchanges: [],
    });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([
        { name: "Local", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false },
        { name: "Staging", host: "staging.internal", port: 5672, vhost: "/", username: "admin", management_port: 15672, management_ssl: false },
      ]);
      if (cmd === "activate_profile") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    render(<ConnectionSection />);
    // Select a different profile via the native select mock
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "Staging" } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("activate_profile", { profileName: "Staging" });
    });
    // Status dot should reflect connected state
    const statusDot = document.querySelector(".bg-emerald-500");
    expect(statusDot).toBeInTheDocument();
  });

  describe("handleRetest", () => {
    beforeEach(() => {
      // Seed a profile so the Re-test button is visible
      useConnectionStore.setState({
        profiles: [
          { name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false },
        ],
        activeProfileName: "Local RabbitMQ",
        connectionStatus: "connected",
        connectionError: null,
        managementStatus: "unknown",
        queues: [],
        exchanges: [],
      });
    });

    it("shows green checkmark after successful re-test", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "list_profiles") return Promise.resolve([
          { name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false },
        ]);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      });

      render(<ConnectionSection />);
      const retestBtn = await screen.findByRole("button", { name: /re-test/i });
      fireEvent.click(retestBtn);

      await waitFor(() => {
        const connectedElements = screen.getAllByText("Connected");
        expect(connectedElements.length).toBeGreaterThan(0);
      });
    });

    it("shows red badge with error message after failed re-test", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "list_profiles") return Promise.resolve([
          { name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false },
        ]);
        if (cmd === "test_connection") return Promise.reject(new Error("connection refused"));
        return Promise.resolve(undefined);
      });

      render(<ConnectionSection />);
      const retestBtn = await screen.findByRole("button", { name: /re-test/i });
      fireEvent.click(retestBtn);

      await waitFor(() => {
        expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
      });
    });

    it("Re-test button is disabled while testing is in progress", async () => {
      let resolveTest: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolveTest = resolve;
      });

      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "list_profiles") return Promise.resolve([
          { name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", management_port: 15672, management_ssl: false },
        ]);
        if (cmd === "test_connection") return pendingPromise;
        return Promise.resolve(undefined);
      });

      render(<ConnectionSection />);
      const retestBtn = await screen.findByRole("button", { name: /re-test/i });
      fireEvent.click(retestBtn);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /re-test/i })).toBeDisabled();
      });

      // Clean up pending promise
      resolveTest!();
    });
  });
});
