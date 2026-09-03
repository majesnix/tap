import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ConnectionSheet } from "@/components/connection/ConnectionSheet";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { SheetState } from "@/lib/workbench";
import type { ConnectionProfile } from "@/lib/types";

// Mock Tauri IPC
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock the native file picker (CA certificate browse button)
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

// The Sheet primitive renders through a Radix Dialog portal; jsdom cannot lay
// that out usefully for these tests, so render its children directly.
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

afterEach(async () => {
  await act(async () => {});
});

const PROFILE_A: ConnectionProfile = {
  name: "Profile A",
  host: "host-a.local",
  port: 5672,
  vhost: "/",
  username: "user-a",
  management_port: 15672,
  management_ssl: false,
  amqp_tls: false,
};

const PROFILE_B: ConnectionProfile = {
  name: "Profile B",
  host: "host-b.local",
  port: 5673,
  vhost: "orders",
  username: "user-b",
  management_port: 15673,
  management_ssl: true,
  amqp_tls: false,
};

function setStore(overrides: Partial<ReturnType<typeof useConnectionStore.getState>> = {}) {
  useConnectionStore.setState({
    profiles: [],
    activeProfileName: null,
    connectionStatus: "disconnected",
    connectionError: null,
    managementStatus: "unknown",
    managementAuthError: null,
    queues: [],
    exchanges: [],
    keychainError: null,
    ...overrides,
  });
}

function renderSheet(state: SheetState, onStateChange = vi.fn()) {
  render(<ConnectionSheet state={state} onStateChange={onStateChange} />);
  return onStateChange;
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "list_profiles") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
});

describe("ConnectionSheet", () => {
  it("renders nothing when state is null", () => {
    const { container } = render(<ConnectionSheet state={null} onStateChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("list view", () => {
    it("shows the header copy and a row per profile", () => {
      setStore({ profiles: [PROFILE_A, PROFILE_B], activeProfileName: "Profile A" });
      renderSheet({ mode: "list" });

      expect(screen.getByText("Connections")).toBeInTheDocument();
      expect(screen.getByText("Passwords live in the OS keychain")).toBeInTheDocument();

      expect(screen.getByText("Profile A")).toBeInTheDocument();
      expect(screen.getByText("amqp://user-a@host-a.local:5672/")).toBeInTheDocument();

      expect(screen.getByText("Profile B")).toBeInTheDocument();
      expect(screen.getByText("amqp://user-b@host-b.local:5673/orders")).toBeInTheDocument();

      expect(screen.getAllByTestId("environment-badge")).toHaveLength(2);
      expect(screen.getByRole("button", { name: /new connection/i })).toBeInTheDocument();
    });

    it("shows the keychain banner when the OS keychain is unavailable", () => {
      setStore({ keychainError: "locked" });
      renderSheet({ mode: "list" });
      expect(screen.getByText(/keychain unavailable.*\(locked\)/i)).toBeInTheDocument();
    });

    it("clicking a row opens the detail view for that profile", () => {
      setStore({ profiles: [PROFILE_A] });
      const onStateChange = renderSheet({ mode: "list" });
      fireEvent.click(screen.getByText("Profile A"));
      expect(onStateChange).toHaveBeenCalledWith({ mode: "edit", profile: "Profile A" });
    });

    it("New connection opens the create form", () => {
      const onStateChange = renderSheet({ mode: "list" });
      fireEvent.click(screen.getByRole("button", { name: /new connection/i }));
      expect(onStateChange).toHaveBeenCalledWith({ mode: "new" });
    });
  });

  describe("detail view — new profile", () => {
    it("shows the name in the header", () => {
      renderSheet({ mode: "new" });
      expect(screen.getByText("New connection")).toBeInTheDocument();
      expect(screen.getByText("Connection profile")).toBeInTheDocument();
    });

    it("requires a name and a host", async () => {
      renderSheet({ mode: "new" });
      fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
      await waitFor(() => {
        expect(screen.getByText("Profile name is required.")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
      await waitFor(() => {
        expect(screen.getByText("Host is required.")).toBeInTheDocument();
      });
    });

    it("Test saves then tests the connection without activating it", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      renderSheet({ mode: "new" });
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^test$/i }));

      await waitFor(() => {
        expect(screen.getByText(/reachable/i)).toBeInTheDocument();
      });
      expect(useConnectionStore.getState().activeProfileName).toBeNull();
      expect(useConnectionStore.getState().connectionStatus).toBe("disconnected");
    });

    it("Save & connect saves, tests, activates, and closes the sheet", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });
      const onStateChange = renderSheet({ mode: "new" });

      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

      await waitFor(() => {
        expect(useConnectionStore.getState().activeProfileName).toBe("MyProfile");
      });
      expect(useConnectionStore.getState().connectionStatus).toBe("connected");
      expect(onStateChange).toHaveBeenCalledWith(null);
    });

    it("stays open and shows the error when the test fails", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.reject(new Error("connection refused"));
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });
      const onStateChange = renderSheet({ mode: "new" });

      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

      await waitFor(() => {
        expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
      });
      expect(onStateChange).not.toHaveBeenCalledWith(null);
    });

    it("flips the AMQP TLS switch on when the port becomes 5671", () => {
      renderSheet({ mode: "new" });
      const portInput = screen.getByDisplayValue("5672");
      fireEvent.change(portInput, { target: { value: "5671" } });
      expect(screen.getByRole("switch", { name: /amqp over tls/i })).toHaveAttribute(
        "aria-checked",
        "true"
      );
    });

    it("shows the cleartext warning for a remote host", () => {
      renderSheet({ mode: "new" });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "rabbit.internal" },
      });
      expect(screen.getByText(/password travels unencrypted over amqp/i)).toBeInTheDocument();
    });

    it("shows 'Local host — TLS optional' for a local host", () => {
      renderSheet({ mode: "new" });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      expect(screen.getByText(/local host — tls optional/i)).toBeInTheDocument();
    });

    it("shows an inline error when saving fails", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.reject(new Error("disk full"));
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });
      renderSheet({ mode: "new" });
      fireEvent.change(screen.getByPlaceholderText(/e.g. local rabbitmq/i), {
        target: { value: "MyProfile" },
      });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));
      await waitFor(() => {
        expect(screen.getByText("disk full")).toBeInTheDocument();
      });
    });

    it("shows 'Encrypted on both transports' once both TLS switches are on", () => {
      renderSheet({ mode: "new" });
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "rabbit.internal" },
      });
      fireEvent.click(screen.getByRole("switch", { name: /^amqp over tls$/i }));
      fireEvent.click(screen.getByRole("switch", { name: /management api over https/i }));
      expect(screen.getByText(/encrypted on both transports/i)).toBeInTheDocument();
    });

    it("flips Management API SSL on when the management port becomes 15671", () => {
      renderSheet({ mode: "new" });
      const managementPortInput = screen.getByDisplayValue("15672");
      fireEvent.change(managementPortInput, { target: { value: "15671" } });
      expect(
        screen.getByRole("switch", { name: /management api over https/i })
      ).toHaveAttribute("aria-checked", "true");
    });

    it("updates username, virtual host and CA certificate path fields", () => {
      renderSheet({ mode: "new" });
      fireEvent.change(screen.getByRole("textbox", { name: /username/i }), {
        target: { value: "guest" },
      });
      fireEvent.change(screen.getByPlaceholderText("/"), { target: { value: "/orders" } });
      fireEvent.change(screen.getByPlaceholderText(/ca certificate/i), {
        target: { value: "/etc/ssl/ca.pem" },
      });
      expect(screen.getByDisplayValue("guest")).toBeInTheDocument();
      expect(screen.getByDisplayValue("/orders")).toBeInTheDocument();
      expect(screen.getByDisplayValue("/etc/ssl/ca.pem")).toBeInTheDocument();
    });

    it("picks up a CA certificate path from the native file picker", async () => {
      const dialog = await import("@tauri-apps/plugin-dialog");
      vi.mocked(dialog.open).mockResolvedValueOnce("/etc/ssl/picked.pem");
      renderSheet({ mode: "new" });
      fireEvent.click(screen.getByRole("button", { name: /browse for ca certificate/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue("/etc/ssl/picked.pem")).toBeInTheDocument();
      });
    });

    it("toggles read-only and record-history switches", () => {
      renderSheet({ mode: "new" });
      const readOnly = screen.getByRole("switch", { name: /read-only profile/i });
      const recordHistory = screen.getByRole("switch", { name: /record sent messages in history/i });
      expect(readOnly).toHaveAttribute("aria-checked", "false");
      expect(recordHistory).toHaveAttribute("aria-checked", "true");
      fireEvent.click(readOnly);
      fireEvent.click(recordHistory);
      expect(readOnly).toHaveAttribute("aria-checked", "true");
      expect(recordHistory).toHaveAttribute("aria-checked", "false");
    });

    it("selecting Production in the environment control marks it touched", () => {
      renderSheet({ mode: "new" });
      fireEvent.click(screen.getByRole("radio", { name: /production/i }));
      expect(screen.getByRole("radio", { name: /production/i })).toHaveAttribute(
        "aria-checked",
        "true"
      );
      // Once touched, changing the host no longer overrides the environment.
      fireEvent.change(screen.getByPlaceholderText(/localhost/i), {
        target: { value: "localhost" },
      });
      expect(screen.getByRole("radio", { name: /production/i })).toHaveAttribute(
        "aria-checked",
        "true"
      );
    });

    it("Back calls back through to the sheet with { mode: 'list' }", () => {
      const onStateChange = renderSheet({ mode: "new" });
      fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
      expect(onStateChange).toHaveBeenCalledWith({ mode: "list" });
    });

    it("Close calls back through to the sheet with null", () => {
      const onStateChange = renderSheet({ mode: "new" });
      fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
      expect(onStateChange).toHaveBeenCalledWith(null);
    });
  });

  describe("detail view — edit profile", () => {
    beforeEach(() => {
      setStore({ profiles: [PROFILE_A] });
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "list_profiles") return Promise.resolve([PROFILE_A]);
        return Promise.resolve(undefined);
      });
    });

    it("shows the profile name in the header and a read-only name field", () => {
      renderSheet({ mode: "edit", profile: "Profile A" });
      expect(screen.getAllByText("Profile A").length).toBeGreaterThan(0);
      const nameInput = screen.getByDisplayValue("Profile A");
      expect(nameInput).toHaveAttribute("readOnly");
    });

    it("blocks save with a blank password and shows the existing message", async () => {
      renderSheet({ mode: "edit", profile: "Profile A" });
      fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));
      await waitFor(() => {
        expect(
          screen.getByText(/password is required to save changes/i)
        ).toBeInTheDocument();
      });
    });

    it("delete asks for confirmation in an AlertDialog and calls delete_profile", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "delete_profile") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });
      const onStateChange = renderSheet({ mode: "edit", profile: "Profile A" });

      fireEvent.click(screen.getByText("Delete"));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText("Delete Profile A?")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("delete_profile", { profileName: "Profile A" });
      });
      expect(onStateChange).toHaveBeenCalledWith({ mode: "list" });
    });

    it("Keep profile cancels the delete confirmation without deleting", async () => {
      renderSheet({ mode: "edit", profile: "Profile A" });
      fireEvent.click(screen.getByText("Delete"));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: /keep profile/i }));
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(mockInvoke).not.toHaveBeenCalledWith("delete_profile", expect.anything());
    });

    it("shows an inline error when delete_profile fails", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "delete_profile") return Promise.reject(new Error("locked"));
        if (cmd === "list_profiles") return Promise.resolve([PROFILE_A]);
        return Promise.resolve(undefined);
      });
      renderSheet({ mode: "edit", profile: "Profile A" });
      fireEvent.click(screen.getByText("Delete"));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));
      await waitFor(() => {
        expect(screen.getByText("locked")).toBeInTheDocument();
      });
    });

    it("Test on an existing profile with a password saves, tests and shows Reachable", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([PROFILE_A]);
        return Promise.resolve(undefined);
      });
      renderSheet({ mode: "edit", profile: "Profile A" });
      const passwordInput = screen.getByPlaceholderText(/leave blank to keep/i);
      fireEvent.change(passwordInput, { target: { value: "secret" } });
      fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
      await waitFor(() => {
        expect(screen.getByText(/reachable/i)).toBeInTheDocument();
      });
      expect(mockInvoke).toHaveBeenCalledWith("save_profile", expect.anything());
      expect(mockInvoke).toHaveBeenCalledWith("test_connection", expect.anything());
    });

    it("Test on an existing profile with a blank password shows the existing message and does not save or test", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "save_profile") return Promise.resolve(undefined);
        if (cmd === "test_connection") return Promise.resolve(undefined);
        if (cmd === "list_profiles") return Promise.resolve([PROFILE_A]);
        return Promise.resolve(undefined);
      });
      renderSheet({ mode: "edit", profile: "Profile A" });
      // Leave the password field blank.
      fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
      await waitFor(() => {
        expect(
          screen.getByText(/password is required to save changes/i)
        ).toBeInTheDocument();
      });
      expect(mockInvoke).not.toHaveBeenCalledWith("save_profile", expect.anything());
      expect(mockInvoke).not.toHaveBeenCalledWith("test_connection", expect.anything());
    });

    it("falls back to the list when the edited profile is gone", async () => {
      // Deleted (or renamed) elsewhere: the sheet must not render an edit form
      // pre-filled with DEFAULT_FORM_VALUES for a profile that no longer exists.
      setStore({ profiles: [PROFILE_B] });
      const onStateChange = renderSheet({ mode: "edit", profile: "Profile A" });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith({ mode: "list" });
      });
      expect(screen.queryByRole("button", { name: /save & connect/i })).not.toBeInTheDocument();
    });
  });
});
