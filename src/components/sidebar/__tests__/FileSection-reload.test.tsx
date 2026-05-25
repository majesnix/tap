import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { FileSection } from "@/components/sidebar/FileSection";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

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
  load: vi.fn(() => {
    return Promise.resolve({
      get: mockGet,
      set: mockSet,
      save: mockSave,
    });
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const makeSchema = (messageNames: string[]): ProtoSchema => ({
  messages: messageNames.map((name) => ({
    full_name: name,
    fields: [],
  })),
  enums: [],
  file_name: "test.proto",
});

afterEach(async () => {
  await act(async () => {});
});

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.getState().reset();

  mockGet = vi.fn().mockResolvedValue(null);
  mockSet = vi.fn().mockResolvedValue(undefined);
  mockSave = vi.fn().mockResolvedValue(undefined);

  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "reload_proto") return Promise.resolve(makeSchema(["pkg.Reloaded"]));
    if (cmd === "check_paths_exist") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
});

describe("Reload button", () => {
  it("shows reload button when files are open", () => {
    useProtoStore.setState({
      openFiles: [{ filePath: "/test.proto", schema: makeSchema(["pkg.Msg"]) }],
      activeIndex: 0,
      activeFilePath: "/test.proto",
      schema: makeSchema(["pkg.Msg"]),
    });

    render(<FileSection />);
    expect(screen.getByLabelText("Reload proto schema")).toBeInTheDocument();
  });

  it("does not show reload button when no files are open", () => {
    render(<FileSection />);
    expect(screen.queryByLabelText("Reload proto schema")).not.toBeInTheDocument();
  });

  it("calls reloadProto with correct args on click", async () => {
    const schema = makeSchema(["pkg.Msg"]);
    useProtoStore.setState({
      openFiles: [{ filePath: "/path/to/test.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/path/to/test.proto",
      schema,
    });

    mockGet.mockResolvedValue(["/path/to"]);

    render(<FileSection />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Reload proto schema"));
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reload_proto", {
        filePaths: ["/path/to/test.proto"],
        includePaths: [["/path/to"]],
      });
    });
  });
});

describe("Recent files", () => {
  it("renders recent files that are not currently open", () => {
    useProtoStore.setState({
      openFiles: [],
      activeIndex: -1,
      recentFiles: ["/path/recent1.proto", "/path/recent2.proto"],
    });

    render(<FileSection />);

    expect(screen.getByText("recent1.proto")).toBeInTheDocument();
    expect(screen.getByText("recent2.proto")).toBeInTheDocument();
  });

  it("filters out currently open files from recent list", async () => {
    const schema = makeSchema(["pkg.Msg"]);
    useProtoStore.setState({
      openFiles: [{ filePath: "/path/recent1.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/path/recent1.proto",
      schema,
      recentFiles: ["/path/recent1.proto", "/path/recent2.proto"],
    });

    render(<FileSection />);

    await waitFor(() => {
      expect(screen.getByText("Recent Files")).toBeInTheDocument();
    });

    const recentSection = screen.getByText("Recent Files").parentElement!;
    const recentButtons = recentSection.querySelectorAll("button[type='button']");
    const recentTexts = Array.from(recentButtons).map((b) => b.textContent);
    expect(recentTexts).not.toContain("recent1.proto");
    expect(recentTexts).toContain("recent2.proto");
  });

  it("disables stale recent file entries", async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "check_paths_exist") {
        const paths = (args as { paths: string[] }).paths;
        return Promise.resolve(paths.map((p: string) => !p.includes("gone")));
      }
      return Promise.resolve(undefined);
    });

    useProtoStore.setState({
      openFiles: [],
      activeIndex: -1,
      recentFiles: ["/path/exists.proto", "/path/gone.proto"],
    });

    render(<FileSection />);

    await waitFor(() => {
      expect(screen.getByText("exists.proto")).toBeInTheDocument();
    });

    await waitFor(() => {
      const goneButton = screen.getByText("gone.proto");
      expect(goneButton).toBeDisabled();
    });
  });
});

describe("Cmd+R reload shortcut", () => {
  it("triggers reload via reloadRequested counter", async () => {
    const schema = makeSchema(["pkg.Msg"]);
    useProtoStore.setState({
      openFiles: [{ filePath: "/test.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/test.proto",
      schema,
    });

    mockGet.mockResolvedValue(["/include"]);

    render(<FileSection />);

    await act(async () => {
      useProtoStore.getState().requestReload();
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reload_proto", expect.any(Object));
    });
  });
});
