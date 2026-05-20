import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock sonner toast — must be before component import
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { ResponseHexSection } from "@/components/response/ResponseHexSection";

beforeEach(() => {
  vi.clearAllMocks();

  // Mock clipboard
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
  });
});

describe("ResponseHexSection", () => {
  it("renders nothing when hexString is empty", () => {
    const { container } = render(
      <ResponseHexSection hexString="" decoded={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders hex display without JSON copy button when decoded is null", () => {
    render(
      <ResponseHexSection hexString="0a 05 68 65 6c 6c 6f" decoded={null} />
    );
    expect(screen.getByText("0a 05 68 65 6c 6c 6f")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy hex/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy decoded json/i })).toBeNull();
  });

  it("renders JSON copy button when decoded is provided", () => {
    render(
      <ResponseHexSection
        hexString="0a 05"
        decoded={{ name: "Hello" }}
      />
    );
    expect(
      screen.getByRole("button", { name: /copy hex/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy decoded json/i })
    ).toBeInTheDocument();
  });

  it("copies hex string to clipboard on Copy hex click and shows toast", async () => {
    render(
      <ResponseHexSection hexString="0a 05 68 65 6c 6c 6f" decoded={null} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy hex/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "0a 05 68 65 6c 6c 6f"
      );
      expect(toastMock).toHaveBeenCalledWith("Hex copied", { duration: 2000 });
    });
  });

  it("copies decoded JSON to clipboard on Copy decoded JSON click and shows toast", async () => {
    const decoded = { name: "Hello" };
    render(
      <ResponseHexSection hexString="0a 05 68 65 6c 6c 6f" decoded={decoded} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy decoded json/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(decoded, null, 2)
      );
      expect(toastMock).toHaveBeenCalledWith("JSON copied", { duration: 2000 });
    });
  });
});
