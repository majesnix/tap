import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// Use vi.hoisted for mock factories (Vitest hoisting requirement)
const { mockCheck, mockUpdate, mockRelaunch } = vi.hoisted(() => {
  const mockUpdate = {
    available: true,
    version: "1.6.0",
    body: "Bug fixes and improvements.",
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
  };
  const mockCheck = vi.fn().mockResolvedValue(mockUpdate);
  const mockRelaunch = vi.fn().mockResolvedValue(undefined);
  return { mockCheck, mockUpdate, mockRelaunch };
});

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: mockCheck,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mockRelaunch,
}));

const { mockToast } = vi.hoisted(() => {
  const mockToast = vi.fn();
  return { mockToast };
});

vi.mock("sonner", () => ({ toast: mockToast }));

import { UpdateChecker } from "./UpdateChecker";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheck.mockResolvedValue({
    available: true,
    version: "1.6.0",
    body: "Bug fixes and improvements.",
    downloadAndInstall: mockUpdate.downloadAndInstall,
  });
});

describe("UpdateChecker", () => {
  test("check() is called on mount", async () => {
    await act(async () => {
      render(<UpdateChecker />);
    });

    expect(mockCheck).toHaveBeenCalledOnce();
  });

  test("shows Sonner toast with correct title/description/action/duration when update is available", async () => {
    await act(async () => {
      render(<UpdateChecker />);
    });

    expect(mockToast).toHaveBeenCalledWith(
      "Update 1.6.0 available",
      expect.objectContaining({
        description: "Bug fixes and improvements.",
        action: expect.objectContaining({
          label: "Install & Relaunch",
        }),
        duration: Infinity,
      })
    );
  });

  test("does not show toast when update.available is false", async () => {
    mockCheck.mockResolvedValue({ available: false });

    await act(async () => {
      render(<UpdateChecker />);
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  test("clicking 'Install & Relaunch' calls downloadAndInstall() then relaunch()", async () => {
    await act(async () => {
      render(<UpdateChecker />);
    });

    // Get the action onClick from the toast call
    const toastOptions = mockToast.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    const onClick = toastOptions.action.onClick;

    await act(async () => {
      onClick();
    });

    expect(mockUpdate.downloadAndInstall).toHaveBeenCalledOnce();
    expect(mockRelaunch).toHaveBeenCalledOnce();
  });

  test("check() rejection is swallowed silently — no toast shown", async () => {
    mockCheck.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<UpdateChecker />);
    });

    expect(mockToast).not.toHaveBeenCalled();
  });
});
