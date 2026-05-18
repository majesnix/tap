import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// Use vi.hoisted for mock factories (Vitest hoisting requirement)
const { mockStore, mockGet, mockSet, mockSave } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(null);
  const mockStore = { get: mockGet, set: mockSet, save: mockSave };
  return { mockStore, mockGet, mockSet, mockSave };
});

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

import { useTheme } from "next-themes";
import { ThemeBootstrap } from "./App";

const mockUseTheme = vi.mocked(useTheme);

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
  // Default: theme is "system", setTheme is mocked
  mockUseTheme.mockReturnValue({
    theme: "system",
    setTheme: mockSetTheme,
    themes: ["light", "dark", "system"],
    resolvedTheme: "light",
    systemTheme: "light",
    forcedTheme: undefined,
  });
});

describe("ThemeBootstrap", () => {
  test("calls setTheme with saved value from tauri-plugin-store on mount", async () => {
    mockGet.mockResolvedValue("dark");

    await act(async () => {
      render(<ThemeBootstrap />);
    });

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  test("does not call setTheme when no saved value exists", async () => {
    mockGet.mockResolvedValue(null);

    await act(async () => {
      render(<ThemeBootstrap />);
    });

    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  test("bootstrapped: mirror effect does NOT write to store before bootstrap completes (race guard)", async () => {
    // mockGet is a pending promise — bootstrap never completes in this window
    let resolvePending: (value: string | null) => void = () => {};
    const pendingPromise = new Promise<string | null>((resolve) => {
      resolvePending = resolve;
    });
    mockGet.mockReturnValue(pendingPromise);

    await act(async () => {
      render(<ThemeBootstrap />);
      // Flush some microtasks — mirror should not write while bootstrap is pending
      await Promise.resolve();
      await Promise.resolve();
    });

    // Mirror effect must NOT write while bootstrap is pending (bootstrapped=false)
    expect(mockSet).not.toHaveBeenCalled();

    // Cleanup: resolve the pending promise so no dangling work
    resolvePending(null);
  });

  test("mirror effect writes to store after bootstrap completes", async () => {
    // Bootstrap resolves with "light"
    mockGet.mockResolvedValue("light");

    const { rerender } = await act(async () => {
      return render(<ThemeBootstrap />);
    });

    // After bootstrap, simulate theme change to "dark"
    mockUseTheme.mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
      themes: ["light", "dark", "system"],
      resolvedTheme: "dark",
      systemTheme: "light",
      forcedTheme: undefined,
    });

    // After the initial bootstrap act, the mirror effect fires once with the
    // current theme ("system"). Assert the call sequence so far to ensure
    // the bootstrap write is not silently overwritten by a stale mirror write.
    expect(mockSet.mock.calls).toEqual([["theme-mode", "system"]]);

    await act(async () => {
      rerender(<ThemeBootstrap />);
    });

    // After the theme change rerender, the mirror fires again with "dark".
    // Use toHaveBeenLastCalledWith to assert the most recent write — not
    // just any historical call — ensuring the sequence is correct.
    expect(mockSet).toHaveBeenLastCalledWith("theme-mode", "dark");
    expect(mockSet.mock.calls).toEqual([
      ["theme-mode", "system"],
      ["theme-mode", "dark"],
    ]);
    expect(mockSave).toHaveBeenCalled();
  });
});
