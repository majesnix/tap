import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { FileSection } from "@/components/sidebar/FileSection";
import { useProtoStore } from "@/stores/useProtoStore";

const { mockInvoke, mockOpen } = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const mockOpen = vi.fn();
  return { mockInvoke, mockOpen };
});

let mockGet: ReturnType<typeof vi.fn>;
let mockSet: ReturnType<typeof vi.fn>;
let mockSave: ReturnType<typeof vi.fn>;

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() =>
    Promise.resolve({ get: mockGet, set: mockSet, save: mockSave })
  ),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

afterEach(async () => {
  await act(async () => {});
});

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.getState().reset();
  mockGet = vi.fn().mockResolvedValue(null);
  mockSet = vi.fn().mockResolvedValue(undefined);
  mockSave = vi.fn().mockResolvedValue(undefined);
  mockOpen.mockResolvedValue("/path/to/widget.proto");
});

/** Drive the open-file flow up to clicking "Load file" in the include-path dialog. */
async function openAndConfirm() {
  render(<FileSection />);
  await act(async () => {
    useProtoStore.getState().requestOpenFile();
  });
  const loadButton = await screen.findByText("Load file");
  await act(async () => {
    fireEvent.click(loadButton);
  });
}

describe("FileSection parse-error display", () => {
  it("surfaces the raw protox error message when parse fails", async () => {
    const real =
      "Proto parse error: fields must have a label with proto2 syntax (expected one of 'optional', 'repeated' or 'required')";
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "parse_proto") return Promise.reject(new Error(real));
      return Promise.resolve(undefined);
    });

    await openAndConfirm();

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("must have a label with proto2 syntax");
    });
    // The old generic message must NOT be the only thing shown.
    expect(screen.queryByText("Could not parse .proto file. Check include paths and file syntax.")).toBeNull();
  });

  it("still surfaces the raw message for import-resolution failures", async () => {
    const real = "Proto parse error: import 'common/types.proto' not found";
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "parse_proto") return Promise.reject(new Error(real));
      return Promise.resolve(undefined);
    });

    await openAndConfirm();

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("common/types.proto");
    });
  });
});
