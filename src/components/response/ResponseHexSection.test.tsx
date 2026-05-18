import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useResponseStore } from "@/stores/useResponseStore";

// Mock sonner toast — must be before component import
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { ResponseHexSection } from "@/components/response/ResponseHexSection";

beforeEach(() => {
  vi.clearAllMocks();

  // Reset response store
  useResponseStore.setState({
    selectedQueue: "",
    isLoading: false,
    lastResult: null,
    lastReadAt: null,
    queueList: [],
    isLiveMode: false,
  });

  // Mock clipboard
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
  });
});

describe("ResponseHexSection", () => {
  it("Test 1: renders hex string and Copy hex button when lastResult has hexString", () => {
    useResponseStore.setState({
      lastResult: {
        empty: false,
        hexString: "0a 05 68 65 6c 6c 6f",
        decoded: { name: "Hello" },
        error: null,
      },
    });

    render(<ResponseHexSection />);

    expect(screen.getByText("0a 05 68 65 6c 6c 6f")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy hex/i })).toBeInTheDocument();
  });

  it("Test 2 (copy hex): clicking Copy hex writes hex string to clipboard and shows toast", async () => {
    useResponseStore.setState({
      lastResult: {
        empty: false,
        hexString: "0a 05 68 65 6c 6c 6f",
        decoded: { name: "Hello" },
        error: null,
      },
    });

    render(<ResponseHexSection />);

    fireEvent.click(screen.getByRole("button", { name: /copy hex/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("0a 05 68 65 6c 6c 6f");
      expect(toastMock).toHaveBeenCalledWith("Hex copied", { duration: 2000 });
    });
  });

  it("Test 3 (copy decoded JSON): clicking Copy decoded JSON writes JSON to clipboard and shows toast", async () => {
    const decoded = { name: "Hello" };
    useResponseStore.setState({
      lastResult: {
        empty: false,
        hexString: "0a 05 68 65 6c 6c 6f",
        decoded,
        error: null,
      },
    });

    render(<ResponseHexSection />);

    fireEvent.click(screen.getByRole("button", { name: /copy decoded json/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(decoded, null, 2)
      );
      expect(toastMock).toHaveBeenCalledWith("JSON copied", { duration: 2000 });
    });
  });
});
