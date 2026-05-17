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

  describe("edit mode", () => {
    const mockProfiles = [
      {
        name: "Profile A",
        host: "host-a.local",
        port: 5672,
        vhost: "/",
        username: "user-a",
        management_port: 15672,
        management_ssl: false,
      },
      {
        name: "Profile B",
        host: "host-b.local",
        port: 5673,
        vhost: "/vhost-b",
        username: "user-b",
        management_port: 15673,
        management_ssl: true,
      },
    ];

    beforeEach(() => {
      useConnectionStore.setState({
        profiles: mockProfiles,
        activeProfileName: null,
        connectionStatus: "disconnected",
        connectionError: null,
        managementStatus: "unknown",
        queues: [],
        exchanges: [],
      });
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "list_profiles") return Promise.resolve(mockProfiles);
        return Promise.resolve(undefined);
      });
    });

    it("edit button appears for each profile row", async () => {
      renderModal();
      await waitFor(() => screen.getByText("Profile A"));
      const editButtons = screen.getAllByRole("button", { name: /edit profile/i });
      expect(editButtons).toHaveLength(2);
    });

    it("clicking Edit pre-populates form fields from the selected profile", async () => {
      renderModal();
      await waitFor(() => screen.getByText("Profile A"));
      const editButton = screen.getByRole("button", { name: /edit profile profile a/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        // Name field should be pre-populated
        const nameInput = screen.getByDisplayValue("Profile A");
        expect(nameInput).toBeInTheDocument();
        // Host field should be pre-populated
        expect(screen.getByDisplayValue("host-a.local")).toBeInTheDocument();
        // Username field should be pre-populated
        expect(screen.getByDisplayValue("user-a")).toBeInTheDocument();
        // Password field should be empty
        const passwordInput = screen.getByPlaceholderText(/enter password to update/i);
        expect(passwordInput).toHaveValue("");
      });
    });

    it("Profile Name field is read-only in edit mode", async () => {
      renderModal();
      await waitFor(() => screen.getByText("Profile A"));
      fireEvent.click(screen.getByRole("button", { name: /edit profile profile a/i }));

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue("Profile A");
        expect(nameInput).toHaveAttribute("readOnly");
      });
    });

    it("save in edit mode with password calls saveProfile with updated values", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve(mockProfiles);
        return Promise.resolve(undefined);
      });

      renderModal();
      await waitFor(() => screen.getByText("Profile A"));
      fireEvent.click(screen.getByRole("button", { name: /edit profile profile a/i }));

      await waitFor(() => screen.getByDisplayValue("host-a.local"));
      fireEvent.change(screen.getByDisplayValue("host-a.local"), {
        target: { value: "new-host.local" },
      });
      fireEvent.change(screen.getByPlaceholderText(/enter password to update/i), {
        target: { value: "mypassword" },
      });
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("save_profile", expect.objectContaining({
          profile: expect.objectContaining({ host: "new-host.local" }),
          password: "mypassword",
        }));
      });
    });

    it("blank password in edit mode blocks save and shows inline error", async () => {
      renderModal();
      await waitFor(() => screen.getByText("Profile A"));
      fireEvent.click(screen.getByRole("button", { name: /edit profile profile a/i }));

      await waitFor(() => screen.getByDisplayValue("host-a.local"));
      fireEvent.change(screen.getByDisplayValue("host-a.local"), {
        target: { value: "new-host.local" },
      });
      // Leave password blank
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
      expect(mockInvoke).not.toHaveBeenCalledWith("save_profile", expect.anything());
    });
  });

  describe("scroll layout", () => {
    it("DialogContent has max-h-[85vh] flex flex-col overflow-hidden classes", async () => {
      renderModal();
      // DialogContent renders as role="dialog"
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveClass("max-h-[85vh]");
      expect(dialog).toHaveClass("flex");
      expect(dialog).toHaveClass("flex-col");
      expect(dialog).toHaveClass("overflow-hidden");
    });

    it("scroll container div has flex-1 min-h-0 overflow-y-auto classes", async () => {
      renderModal();
      await screen.findByRole("dialog");
      const scrollContainer = document.querySelector('[data-testid="profile-modal-scroll"]');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass("flex-1");
      expect(scrollContainer).toHaveClass("min-h-0");
      expect(scrollContainer).toHaveClass("overflow-y-auto");
    });
  });
});
