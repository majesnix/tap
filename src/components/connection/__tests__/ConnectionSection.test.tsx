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
  });

  it("shows 'Add connection' hint when no profiles saved", () => {
    render(<ConnectionSection />);
    expect(screen.getByText(/add connection/i)).toBeInTheDocument();
  });

  it("shows profile dropdown when profiles exist", async () => {
    useConnectionStore.setState({
      profiles: [{ name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", managementPort: 15672 }],
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
      if (cmd === "list_profiles") return Promise.resolve([{ name: "Local RabbitMQ", host: "localhost", port: 5672, vhost: "/", username: "guest", managementPort: 15672 }]);
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
});
