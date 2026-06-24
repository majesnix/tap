import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import React from "react";

const { mockListProfiles, mockActivateProfile } = vi.hoisted(() => ({
  mockListProfiles: vi.fn(),
  mockActivateProfile: vi.fn(),
}));

const { mockToastWarning, mockToastError } = vi.hoisted(() => ({
  mockToastWarning: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  listProfiles: mockListProfiles,
  activateProfile: mockActivateProfile,
  fetchQueues: vi.fn().mockResolvedValue([]),
  fetchExchanges: vi.fn().mockResolvedValue([]),
  fetchBindings: vi.fn().mockResolvedValue([]),
  publishMessage: vi.fn().mockResolvedValue({ status: "ack" }),
  encodeMessage: vi.fn().mockResolvedValue([]),
}));

vi.mock("sonner", () => ({
  toast: {
    warning: mockToastWarning,
    error: mockToastError,
    success: vi.fn(),
  },
}));

vi.mock("@/stores/useHistoryStore", () => ({
  useHistoryStore: {
    getState: () => ({ appendEntry: vi.fn() }),
  },
}));

vi.mock("@/stores/useAmqpStore", () => ({
  useAmqpStore: {
    getState: () => ({
      properties: { contentType: null, deliveryMode: null, ttl: null, correlationId: null, replyTo: null, headers: [] },
    }),
  },
}));

// Mock Radix Select to a plain HTML <select> — Radix internals don't work in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: {
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
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

import { PublishBar } from "@/components/publish/PublishBar";

beforeEach(() => {
  useConnectionStore.setState({
    profiles: [
      { name: "local", host: "localhost", port: 5672, username: "guest", vhost: "/", management_port: 15672, management_ssl: false },
      { name: "staging", host: "staging.example.com", port: 5672, username: "user", vhost: "/", management_port: 15672, management_ssl: false },
    ],
    activeProfileName: "local",
    connectionStatus: "connected",
    connectionError: null,
    managementStatus: "live",
    managementAuthError: null,
    queues: ["test-queue"],
    exchanges: [],
  });

  usePlanExecutionStore.setState({ isRunning: false });

  vi.clearAllMocks();
  mockListProfiles.mockResolvedValue([]);
  mockActivateProfile.mockResolvedValue(undefined);
});

afterEach(() => {
  useConnectionStore.getState().reset();
  vi.restoreAllMocks();
});

function getProfileSelect() {
  const selects = screen.getAllByTestId("mock-select");
  return selects[0];
}

describe("Profile Select rendering", () => {
  test("renders with active profile value", () => {
    render(<PublishBar />);
    const select = getProfileSelect();
    expect(select).toHaveValue("local");
  });

  test("Select is enabled when multiple profiles exist", () => {
    render(<PublishBar />);
    const select = getProfileSelect();
    expect(select).not.toBeDisabled();
  });

  test("Select is disabled when only one profile exists", () => {
    useConnectionStore.setState({
      profiles: [{ name: "only", host: "localhost", port: 5672, username: "guest", vhost: "/", management_port: 15672, management_ssl: false }],
    });
    render(<PublishBar />);
    const select = getProfileSelect();
    expect(select).toBeDisabled();
  });
});

describe("Quick-switch behavior", () => {
  test("selecting a profile calls activateProfile", async () => {
    render(<PublishBar />);

    const select = getProfileSelect();
    await act(async () => {
      fireEvent.change(select, { target: { value: "staging" } });
    });

    await waitFor(() => {
      expect(mockActivateProfile).toHaveBeenCalledWith("staging");
    });
  });

  test("blocks switch with toast.warning when plan is running", async () => {
    usePlanExecutionStore.setState({ isRunning: true });

    render(<PublishBar />);

    const select = getProfileSelect();
    await act(async () => {
      fireEvent.change(select, { target: { value: "staging" } });
    });

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith("Cannot switch profile while a plan is running");
    });
    expect(mockActivateProfile).not.toHaveBeenCalled();
  });

  test("shows toast.error on connection failure", async () => {
    mockActivateProfile.mockRejectedValueOnce(new Error("Connection refused"));

    render(<PublishBar />);

    const select = getProfileSelect();
    await act(async () => {
      fireEvent.change(select, { target: { value: "staging" } });
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Connection failed: Connection refused");
    });
  });
});

describe("Connection status dot", () => {
  test("shows green dot when connected", () => {
    const { container } = render(<PublishBar />);
    const dot = container.querySelector(".bg-emerald-500");
    expect(dot).toBeInTheDocument();
  });

  test("shows red dot on error", () => {
    useConnectionStore.setState({ connectionStatus: "error" });
    const { container } = render(<PublishBar />);
    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeInTheDocument();
  });

  test("shows amber dot when disconnected", () => {
    useConnectionStore.setState({ connectionStatus: "disconnected" });
    const { container } = render(<PublishBar />);
    const dot = container.querySelector(".bg-amber-500");
    expect(dot).toBeInTheDocument();
  });
});
