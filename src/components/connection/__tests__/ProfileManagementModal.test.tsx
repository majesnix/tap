import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileManagementModal } from "@/components/connection/ProfileManagementModal";
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

const mockOnClose = vi.fn();

function renderModal(open = true) {
  return render(<ProfileManagementModal open={open} onClose={mockOnClose} />);
}

describe("ProfileManagementModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: null,
      connectionStatus: "disconnected",
      connectionError: null,
      managementStatus: "unknown",
      queues: [],
      exchanges: [],
    });
    // Default: list_profiles returns empty array
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  describe("handleTestOnly", () => {
    async function openCreateForm() {
      renderModal();
      await waitFor(() => screen.getByText(/\+ new profile/i));
      fireEvent.click(screen.getByText(/\+ new profile/i));
    }

    it("shows error 'Profile name is required.' when name is empty", async () => {
      await openCreateForm();
      fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
      await waitFor(() => {
        expect(screen.getByText("Profile name is required.")).toBeInTheDocument();
      });
    });

    it("shows error 'Host is required.' when host is empty", async () => {
      await openCreateForm();
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
      await waitFor(() => {
        expect(screen.getByText("Host is required.")).toBeInTheDocument();
      });
    });

    it("sets testState to 'success' when saveProfile and testConnection both succeed", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await openCreateForm();
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("sets testState to 'error' and shows error message when testConnection fails", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.reject(new Error("connection refused"));
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await openCreateForm();
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
      });
    });

    it("does NOT call setActiveProfile or setConnectionStatus on success", async () => {
      const setActiveProfile = vi.fn();
      const setConnectionStatus = vi.fn();
      useConnectionStore.setState({
        profiles: [],
        activeProfileName: null,
        connectionStatus: "disconnected",
        connectionError: null,
        managementStatus: "unknown",
        queues: [],
        exchanges: [],
        setActiveProfile,
        setConnectionStatus,
      } as unknown as Parameters<typeof useConnectionStore.setState>[0]);

      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await openCreateForm();
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      expect(setActiveProfile).not.toHaveBeenCalled();
      expect(setConnectionStatus).not.toHaveBeenCalled();
    });

    it("does NOT close the modal after successful test", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await openCreateForm();
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("Save & Connect button continues to save, test, and activate as before", async () => {
      const setActiveProfile = vi.fn();
      const setConnectionStatus = vi.fn();
      useConnectionStore.setState({
        profiles: [],
        activeProfileName: null,
        connectionStatus: "disconnected",
        connectionError: null,
        managementStatus: "unknown",
        queues: [],
        exchanges: [],
        setActiveProfile,
        setConnectionStatus,
      } as unknown as Parameters<typeof useConnectionStore.setState>[0]);

      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await openCreateForm();
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

      await waitFor(() => {
        expect(setActiveProfile).toHaveBeenCalledWith("MyProfile");
      });
      expect(setConnectionStatus).toHaveBeenCalledWith("connected");
    });
  });
});
