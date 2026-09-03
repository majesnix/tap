import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn().mockResolvedValue("1.9.0") }));
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@/lib/ipc", () => ({
  parseProto: vi.fn(),
  reloadProto: vi.fn().mockResolvedValue([]),
  checkPathsExist: vi.fn().mockResolvedValue([]),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { FilesSidebar } from "@/components/sidebar/FilesSidebar";
import { parseProto, checkPathsExist } from "@/lib/ipc";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const mockCheckPathsExist = vi.mocked(checkPathsExist);
const mockParseProto = vi.mocked(parseProto);
const mockOpenDialog = vi.mocked(openDialog);

const makeSchema = (messageNames: string[], enumCount = 0): ProtoSchema => {
  const messages = messageNames.map((n) => ({
    name: n.split(".").pop() ?? n,
    full_name: n,
    fields: [] as never[],
  }));
  const enums = Array.from({ length: enumCount }, (_, i) => ({
    name: `Enum${i}`,
    full_name: `pkg.Enum${i}`,
    values: [{ name: "A", number: 0 }],
  }));
  return {
    messages,
    message_map: Object.fromEntries(messages.map((m) => [m.full_name, m])),
    enums,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.getState().reset();
  mockCheckPathsExist.mockResolvedValue([]);
});

describe("FilesSidebar", () => {
  it("shows Files, the file row with meta, close/reload/open buttons, and the footer version", async () => {
    const schema = makeSchema(["pkg.Order", "pkg.Line"], 1);
    useProtoStore.setState({
      openFiles: [{ filePath: "/path/order.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/path/order.proto",
      schema,
    });

    render(<FilesSidebar />);

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("order.proto")).toBeInTheDocument();
    expect(screen.getByText(/2 messages · 1 enum/)).toBeInTheDocument();
    expect(screen.getByLabelText("Close order.proto")).toBeInTheDocument();
    expect(screen.getByLabelText("Reload proto schema")).toBeInTheDocument();
    expect(screen.getByLabelText("Open .proto")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/v1\.9\.0/)).toBeInTheDocument();
    });
  });

  it("shows a dashed Open .proto button and no Recent section when nothing has ever been opened", () => {
    useProtoStore.setState({ openFiles: [], activeIndex: -1, recentFiles: [] });
    render(<FilesSidebar />);
    expect(screen.getByLabelText("Open .proto")).toBeInTheDocument();
    expect(screen.getByText("Open .proto")).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it("shows a Recent section listing recent files, with stale ones struck through", async () => {
    useProtoStore.setState({
      openFiles: [],
      activeIndex: -1,
      recentFiles: ["/path/exists.proto", "/path/gone.proto"],
    });
    mockCheckPathsExist.mockResolvedValue([true, false]);

    render(<FilesSidebar />);

    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("exists.proto")).toBeInTheDocument();

    await waitFor(() => {
      const staleRow = screen.getByText("gone.proto").closest("[title]");
      expect(staleRow).toHaveAttribute("title", "File not found: /path/gone.proto");
      expect(staleRow).toHaveClass("line-through");
    });
  });

  it("activates a file when its row is clicked", () => {
    const schema = makeSchema(["pkg.Order"]);
    useProtoStore.setState({
      openFiles: [
        { filePath: "/path/order.proto", schema },
        { filePath: "/path/second.proto", schema },
      ],
      activeIndex: 0,
      activeFilePath: "/path/order.proto",
      schema,
    });

    render(<FilesSidebar />);

    const secondRow = screen.getByText("second.proto").closest('[role="button"]');
    expect(secondRow).not.toBeNull();
    fireEvent.click(secondRow as Element);

    expect(useProtoStore.getState().activeIndex).toBe(1);
  });

  it("closes a file when its Close button is clicked", () => {
    const schema = makeSchema(["pkg.Order"]);
    useProtoStore.setState({
      openFiles: [{ filePath: "/path/order.proto", schema }],
      activeIndex: 0,
      activeFilePath: "/path/order.proto",
      schema,
    });

    render(<FilesSidebar />);

    fireEvent.click(screen.getByLabelText("Close order.proto"));

    expect(useProtoStore.getState().openFiles).toHaveLength(0);
  });

  it("renders parse errors with role alert", async () => {
    mockOpenDialog.mockResolvedValue("/path/widget.proto");
    mockParseProto.mockRejectedValue(new Error("boom"));

    render(<FilesSidebar />);
    await act(async () => {
      useProtoStore.getState().requestOpenFile();
    });
    const loadButton = await screen.findByText("Load file");
    await act(async () => {
      fireEvent.click(loadButton);
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("boom");
    });
  });
});
