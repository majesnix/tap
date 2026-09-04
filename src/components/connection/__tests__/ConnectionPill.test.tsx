import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { ConnectionPill } from "@/components/connection/ConnectionPill";

const mockInvoke = vi.mocked(invoke);

const PROFILE_LOCAL = {
  name: "Local",
  host: "localhost",
  port: 5672,
  vhost: "/",
  username: "guest",
  management_port: 15672,
  management_ssl: false,
};

const PROFILE_STAGING = {
  name: "Staging",
  host: "staging.internal",
  port: 5672,
  vhost: "/",
  username: "admin",
  management_port: 15672,
  management_ssl: false,
};

function setProfiles(profiles: typeof PROFILE_LOCAL[], activeProfileName: string | null = profiles[0]?.name ?? null) {
  useConnectionStore.setState({
    profiles,
    activeProfileName,
    connectionStatus: "disconnected",
    connectionError: null,
    managementStatus: "unknown",
    managementAuthError: null,
    queues: [],
    exchanges: [],
    keychainError: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useConnectionStore.getState().reset();
  usePlanExecutionStore.setState({ isRunning: false });
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "list_profiles") return Promise.resolve([]);
    if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
    return Promise.resolve(undefined);
  });
});

describe("ConnectionPill", () => {
  it("shows dashed 'Add connection' when there are no profiles", async () => {
    const onOpenSheet = vi.fn();
    render(<ConnectionPill onOpenSheet={onOpenSheet} />);
    const addButton = await screen.findByRole("button", { name: /add connection/i });
    fireEvent.click(addButton);
    expect(onOpenSheet).toHaveBeenCalledWith({ mode: "new" });
  });

  it("shows profile name, host and environment pill when profiles exist", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL]);
      if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
      return Promise.resolve(undefined);
    });
    setProfiles([PROFILE_LOCAL]);
    render(<ConnectionPill onOpenSheet={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Connection" });
    expect(within(trigger).getByText("Local")).toBeInTheDocument();
    expect(within(trigger).getByText("localhost")).toBeInTheDocument();
    expect(within(trigger).getByTestId("environment-badge")).toBeInTheDocument();
  });

  it("clicking a profile in the dropdown calls activate_profile and sets connectionStatus connected", async () => {
    setProfiles([PROFILE_LOCAL, PROFILE_STAGING], "Local");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL, PROFILE_STAGING]);
      if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
      if (cmd === "activate_profile") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
    render(<ConnectionPill onOpenSheet={vi.fn()} />);
    const stagingItem = await screen.findByText("Staging");
    fireEvent.click(stagingItem);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("activate_profile", { profileName: "Staging" });
    });
    await waitFor(() => {
      expect(useConnectionStore.getState().connectionStatus).toBe("connected");
    });
  });

  it("sets status error and toasts when activate_profile fails", async () => {
    setProfiles([PROFILE_LOCAL, PROFILE_STAGING], "Local");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL, PROFILE_STAGING]);
      if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
      if (cmd === "activate_profile") return Promise.reject(new Error("Connection refused"));
      return Promise.resolve(undefined);
    });
    render(<ConnectionPill onOpenSheet={vi.fn()} />);
    const stagingItem = await screen.findByText("Staging");
    fireEvent.click(stagingItem);
    await waitFor(() => {
      expect(useConnectionStore.getState().connectionStatus).toBe("error");
    });
    expect(toast.error).toHaveBeenCalledWith("Connection failed: Connection refused");
  });

  it("blocks switching with toast.warning while a plan is running", async () => {
    setProfiles([PROFILE_LOCAL, PROFILE_STAGING], "Local");
    usePlanExecutionStore.setState({ isRunning: true });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL, PROFILE_STAGING]);
      if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
      return Promise.resolve(undefined);
    });
    render(<ConnectionPill onOpenSheet={vi.fn()} />);
    const stagingItem = await screen.findByText("Staging");
    fireEvent.click(stagingItem);
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith("Cannot switch profile while a plan is running");
    });
    expect(mockInvoke).not.toHaveBeenCalledWith("activate_profile", expect.anything());
  });

  it("the status dot has bg-success when connected, bg-danger on error, bg-ghost when disconnected", async () => {
    setProfiles([PROFILE_LOCAL], "Local");
    useConnectionStore.setState({ connectionStatus: "connected" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL]);
      if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
      return Promise.resolve(undefined);
    });
    const { container, rerender } = render(<ConnectionPill onOpenSheet={vi.fn()} />);
    await waitFor(() => expect(container.querySelector(".bg-success")).toBeInTheDocument());

    useConnectionStore.setState({ connectionStatus: "error" });
    rerender(<ConnectionPill onOpenSheet={vi.fn()} />);
    expect(container.querySelector(".bg-danger")).toBeInTheDocument();

    useConnectionStore.setState({ connectionStatus: "disconnected" });
    rerender(<ConnectionPill onOpenSheet={vi.fn()} />);
    expect(container.querySelector(".bg-ghost")).toBeInTheDocument();
  });

  it("renders a triangle-alert button titled 'Keychain unavailable' when the keychain is unavailable", async () => {
    setProfiles([PROFILE_LOCAL], "Local");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL]);
      if (cmd === "keychain_status") return Promise.resolve({ available: false, error: "locked" });
      return Promise.resolve(undefined);
    });
    render(<ConnectionPill onOpenSheet={vi.fn()} />);
    const alertButton = await screen.findByTitle(/keychain unavailable/i);
    expect(alertButton).toBeInTheDocument();
    expect(alertButton.querySelector("svg.lucide-triangle-alert")).toBeInTheDocument();
  });

  it("'Manage connections…' calls onOpenSheet({ mode: 'list' })", async () => {
    setProfiles([PROFILE_LOCAL], "Local");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_profiles") return Promise.resolve([PROFILE_LOCAL]);
      if (cmd === "keychain_status") return Promise.resolve({ available: true, error: null });
      return Promise.resolve(undefined);
    });
    const onOpenSheet = vi.fn();
    render(<ConnectionPill onOpenSheet={onOpenSheet} />);
    const manageButton = await screen.findByText(/manage connections/i);
    fireEvent.click(manageButton);
    expect(onOpenSheet).toHaveBeenCalledWith({ mode: "list" });
  });
});
