import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { IncludePathManager } from "@/components/sidebar/IncludePathManager";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

const { mockLoad, mockInvoke, mockOpen, mockGet } = vi.hoisted(() => {
  const mockGet = vi.fn().mockResolvedValue(null);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockLoad = vi.fn().mockResolvedValue({
    get: mockGet,
    set: mockSet,
    save: mockSave,
  });
  const mockInvoke = vi.fn();
  const mockOpen = vi.fn();
  return { mockLoad, mockInvoke, mockOpen, mockGet };
});

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-store", () => ({ load: mockLoad }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const makeSchema = (messageNames: string[]): ProtoSchema => {
  const messages = messageNames.map((n) => ({
    name: n.split(".").pop() ?? n,
    full_name: n,
    fields: [] as never[],
  }));
  return {
    messages,
    message_map: Object.fromEntries(messages.map((m) => [m.full_name, m])),
    enums: [],
  };
};

afterEach(async () => {
  await act(async () => {});
});

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.getState().reset();

  mockGet.mockResolvedValue(["/include/path"]);
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "reload_proto") return Promise.resolve(makeSchema(["pkg.Reloaded"]));
    return Promise.resolve(undefined);
  });

  useProtoStore.setState({
    openFiles: [{ filePath: "/test.proto", schema: makeSchema(["pkg.Msg"]) }],
    activeIndex: 0,
    activeFilePath: "/test.proto",
    schema: makeSchema(["pkg.Msg"]),
  });
});

describe("renders current paths", () => {
  it("shows saved include paths as chips", async () => {
    render(<IncludePathManager filePath="/test.proto" />);

    await waitFor(() => {
      expect(screen.getByText("path")).toBeInTheDocument();
    });
  });

  it("falls back to parent dir when no saved paths", async () => {
    mockGet.mockResolvedValue(null);

    render(<IncludePathManager filePath="/some/dir/test.proto" />);

    await waitFor(() => {
      expect(screen.getByText("dir")).toBeInTheDocument();
    });
  });
});

describe("remove path", () => {
  it("triggers reload on path removal", async () => {
    mockGet.mockResolvedValue(["/path/one", "/path/two"]);

    render(<IncludePathManager filePath="/test.proto" />);

    await waitFor(() => {
      expect(screen.getByText("one")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Remove include path /path/one"));
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reload_proto", expect.any(Object));
    });
  });
});

describe("add path", () => {
  it("opens directory picker and triggers reload on selection", async () => {
    mockOpen.mockResolvedValue("/new/include");

    render(<IncludePathManager filePath="/test.proto" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add include path")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Add include path"));
    });

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({ directory: true, multiple: false });
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reload_proto", expect.any(Object));
    });
  });

  it("does not reload when directory picker is cancelled", async () => {
    mockOpen.mockResolvedValue(null);

    render(<IncludePathManager filePath="/test.proto" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add include path")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Add include path"));
    });

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
    });

    expect(mockInvoke).not.toHaveBeenCalledWith("reload_proto", expect.any(Object));
  });
});
