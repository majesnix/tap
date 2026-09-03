import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useProtoFiles } from "@/components/sidebar/useProtoFiles";
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
  load: vi.fn(() => Promise.resolve({ get: mockGet, set: mockSet, save: mockSave })),
}));
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

/** Tiny harness exercising the hook's public surface. */
function Harness() {
  const { parseError, isReloading, stalePaths, reload, openFile, openRecent, includeDialog } =
    useProtoFiles();
  return (
    <div>
      {parseError && <p role="alert">{parseError}</p>}
      <button onClick={() => void reload()} disabled={isReloading}>
        reload
      </button>
      <button onClick={() => void openFile()}>open</button>
      <span data-testid="stale-gone">{stalePaths.has("/path/gone.proto") ? "stale" : "fresh"}</span>
      <button onClick={() => void openRecent("/path/gone.proto")}>open-recent-stale</button>
      <button onClick={() => void openRecent("/path/fresh.proto")}>open-recent-fresh</button>
      {includeDialog.open && (
        <div>
          <span data-testid="initial-paths">{includeDialog.initialPaths.join(",")}</span>
          <button onClick={() => void includeDialog.onConfirm(includeDialog.initialPaths)}>
            Load file
          </button>
        </div>
      )}
    </div>
  );
}

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
    if (cmd === "reload_proto") return Promise.resolve([makeSchema(["pkg.Reloaded"])]);
    if (cmd === "check_paths_exist") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
});

describe("reload", () => {
  it("calls reload_proto with every open file and its saved include paths, applying each schema to its own file", async () => {
    const schema = makeSchema(["pkg.Msg"]);
    useProtoStore.setState({
      openFiles: [
        { filePath: "/a.proto", schema },
        { filePath: "/b.proto", schema },
      ],
      activeIndex: 0,
      activeFilePath: "/a.proto",
      schema,
    });

    mockGet.mockImplementation((key: string) => {
      if (key === "include_paths:/a.proto") return Promise.resolve(["/inc/a"]);
      if (key === "include_paths:/b.proto") return Promise.resolve(["/inc/b"]);
      return Promise.resolve(null);
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "reload_proto")
        return Promise.resolve([makeSchema(["pkg.Reloaded"]), makeSchema(["pkg.Reloaded"])]);
      if (cmd === "check_paths_exist") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reload" }));
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reload_proto", {
        filePaths: ["/a.proto", "/b.proto"],
        includePaths: [["/inc/a"], ["/inc/b"]],
      });
    });

    expect(useProtoStore.getState().openFiles[0].schema.messages[0].full_name).toBe(
      "pkg.Reloaded"
    );
    expect(useProtoStore.getState().openFiles[1].schema.messages[0].full_name).toBe(
      "pkg.Reloaded"
    );
  });

  it("toasts success and clears any previous parse error", async () => {
    const { toast } = await import("sonner");
    const schema = makeSchema(["pkg.Msg"]);
    useProtoStore.setState({
      openFiles: [{ filePath: "/a.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/a.proto",
      schema,
    });

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reload" }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Proto schema reloaded");
    });
  });

  it("sets parseError 'Reload failed: …' on error", async () => {
    const schema = makeSchema(["pkg.Msg"]);
    useProtoStore.setState({
      openFiles: [{ filePath: "/a.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/a.proto",
      schema,
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "reload_proto") return Promise.reject(new Error("boom"));
      return Promise.resolve(undefined);
    });

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reload" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Reload failed: boom");
    });
  });
});

describe("parse errors", () => {
  it("surfaces a failing store read from openFile as a parse error", async () => {
    mockOpen.mockResolvedValue("/path/to/widget.proto");
    mockGet.mockRejectedValue(new Error("store unavailable"));

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Failed to open: store unavailable");
    });
    expect(screen.queryByText("Load file")).toBeNull();
  });

  it("surfaces the raw protox message when parse fails", async () => {
    mockOpen.mockResolvedValue("/path/to/widget.proto");
    const real =
      "Proto parse error: fields must have a label with proto2 syntax (expected one of 'optional', 'repeated' or 'required')";
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "parse_proto") return Promise.reject(new Error(real));
      return Promise.resolve(undefined);
    });

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open" }));
    });
    const loadButton = await screen.findByText("Load file");
    await act(async () => {
      fireEvent.click(loadButton);
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("must have a label with proto2 syntax");
    });
    expect(
      screen.queryByText("Could not parse .proto file. Check include paths and file syntax.")
    ).toBeNull();
  });

  it("adds an include-paths hint for import-resolution errors", async () => {
    mockOpen.mockResolvedValue("/path/to/widget.proto");
    const real = "Proto parse error: import 'common/types.proto' not found";
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "parse_proto") return Promise.reject(new Error(real));
      return Promise.resolve(undefined);
    });

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open" }));
    });
    const loadButton = await screen.findByText("Load file");
    await act(async () => {
      fireEvent.click(loadButton);
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("common/types.proto");
      expect(alert.textContent).toContain("add the containing directory to include paths.");
    });
  });
});

describe("openRecent", () => {
  it("is a no-op on a stale path", async () => {
    useProtoStore.setState({ recentFiles: ["/path/gone.proto"] });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "check_paths_exist") return Promise.resolve([false]);
      return Promise.resolve(undefined);
    });

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId("stale-gone")).toHaveTextContent("stale");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open-recent-stale" }));
    });

    expect(mockInvoke).not.toHaveBeenCalledWith("parse_proto", expect.anything());
  });

  it("opens the dialog with the parent dir when there are no saved include paths", async () => {
    mockGet.mockResolvedValue(null);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open-recent-fresh" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("initial-paths")).toHaveTextContent("/path");
    });
  });
});
