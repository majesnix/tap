import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, describe, test, expect } from "vitest";

// CodeMirror mock — same pattern as FormPanel.test.tsx
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

const { mockToastError } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: mockToastError } }));

// Mock useBlockStore — vi.hoisted required for Vitest hoisting
const { mockLoadBlocks, mockAddBlock, mockUpdateBlock, mockDeleteBlock } = vi.hoisted(() => ({
  mockLoadBlocks: vi.fn().mockResolvedValue(undefined),
  mockAddBlock: vi.fn().mockResolvedValue(undefined),
  mockUpdateBlock: vi.fn().mockResolvedValue(undefined),
  mockDeleteBlock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: vi.fn(),
}));

import { BlockLibraryPanel } from "@/components/blocks/BlockLibraryPanel";
import { useBlockStore } from "@/stores/useBlockStore";
import { useTheme } from "next-themes";
import type { Block } from "@/stores/useBlockStore";

function setupStore(overrides: Partial<ReturnType<typeof useBlockStore>> = {}) {
  vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "light" } as ReturnType<typeof useTheme>);
  vi.mocked(useBlockStore).mockReturnValue({
    blocks: [],
    blocksLoaded: true,
    loadBlocks: mockLoadBlocks,
    addBlock: mockAddBlock,
    updateBlock: mockUpdateBlock,
    deleteBlock: mockDeleteBlock,
    ...overrides,
  } as unknown as ReturnType<typeof useBlockStore>);
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return { id: "block-1", name: "My Block", content: '{"foo": 1}', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupStore();
});

describe("List view", () => {
  test("renders 'Block Library' heading in panel header", () => {
    render(<BlockLibraryPanel />);
    expect(screen.getByText("Block Library")).toBeInTheDocument();
  });

  test("renders '+ New Block' button with aria-label 'New block' in panel header", () => {
    render(<BlockLibraryPanel />);
    expect(screen.getByRole("button", { name: "New block" })).toBeInTheDocument();
  });

  test("when blocksLoaded===false renders no block rows and no empty state", () => {
    setupStore({ blocksLoaded: false, blocks: [] });
    render(<BlockLibraryPanel />);
    expect(screen.queryByText("No blocks yet")).not.toBeInTheDocument();
  });

  test("when blocksLoaded===true and blocks=[] renders 'No blocks yet' heading", () => {
    setupStore({ blocksLoaded: true, blocks: [] });
    render(<BlockLibraryPanel />);
    expect(screen.getByText("No blocks yet")).toBeInTheDocument();
  });

  test("when blocksLoaded===true and blocks=[] renders description text", () => {
    setupStore({ blocksLoaded: true, blocks: [] });
    render(<BlockLibraryPanel />);
    expect(
      screen.getByText("Save JSON snippets you can reuse across messages.")
    ).toBeInTheDocument();
  });

  test("when blocksLoaded===true and blocks have entries renders one row per block with name", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    expect(screen.getByText("Alpha Block")).toBeInTheDocument();
  });

  test("renders Edit button with aria-label 'Edit {name}' for each block", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    expect(screen.getByRole("button", { name: "Edit Alpha Block" })).toBeInTheDocument();
  });

  test("renders Delete button with aria-label 'Delete {name}' for each block", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    expect(screen.getByRole("button", { name: "Delete Alpha Block" })).toBeInTheDocument();
  });
});

describe("Editor view", () => {
  test("clicking '+ New Block' switches to editor view with 'New block' heading", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    expect(screen.getByText("New block")).toBeInTheDocument();
  });

  test("clicking '+ New Block' shows empty name input", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    const input = screen.getByPlaceholderText("Block name");
    expect(input).toHaveValue("");
  });

  test("clicking '+ New Block' shows CodeMirror pre-filled with '{}'", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    expect(screen.getByTestId("codemirror-stub")).toHaveValue("{}");
  });

  test("clicking '+ New Block' shows 'Save block' button", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    expect(screen.getByRole("button", { name: "Save block" })).toBeInTheDocument();
  });

  test("Save button is disabled and shows 'Loading…' when blocksLoaded===false", () => {
    setupStore({ blocksLoaded: false, blocks: [] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    const saveBtn = screen.getByRole("button", { name: "Save block" });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveTextContent("Loading…");
  });

  test("clicking '+ New Block' shows Back button", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  test("clicking Edit on a block switches to 'Edit block' heading", () => {
    const block = makeBlock({ id: "b1", name: "My Block", content: '{"foo": 1}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Block" }));
    expect(screen.getByText("Edit block")).toBeInTheDocument();
  });

  test("clicking Edit pre-fills name input with block.name", () => {
    const block = makeBlock({ id: "b1", name: "My Block", content: '{"foo": 1}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Block" }));
    expect(screen.getByPlaceholderText("Block name")).toHaveValue("My Block");
  });

  test("clicking Edit pre-fills CodeMirror with block.content", () => {
    const block = makeBlock({ id: "b1", name: "My Block", content: '{"foo": 1}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Block" }));
    expect(screen.getByTestId("codemirror-stub")).toHaveValue('{"foo": 1}');
  });

  test("Back button in editor view returns to list view without calling addBlock/updateBlock", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Block Library")).toBeInTheDocument();
    expect(mockAddBlock).not.toHaveBeenCalled();
    expect(mockUpdateBlock).not.toHaveBeenCalled();
  });
});

describe("Save validation", () => {
  test("clicking Save with empty name shows 'Name is required' error", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  test("clicking Save with invalid JSON shows 'Invalid JSON' error", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.change(screen.getByPlaceholderText("Block name"), {
      target: { value: "My Block" },
    });
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: "not valid json{{{" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
  });

  test("clicking Save with valid JSON array shows 'JSON must be an object' error", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.change(screen.getByPlaceholderText("Block name"), {
      target: { value: "My Block" },
    });
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: "[1, 2, 3]" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    expect(screen.getByText("JSON must be an object")).toBeInTheDocument();
  });

  test("clicking Save with valid JSON null shows 'JSON must be an object' error", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.change(screen.getByPlaceholderText("Block name"), {
      target: { value: "My Block" },
    });
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: "null" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    expect(screen.getByText("JSON must be an object")).toBeInTheDocument();
  });

  test("clicking Save with valid JSON object (new block) calls addBlock and returns to list", async () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.change(screen.getByPlaceholderText("Block name"), {
      target: { value: "My Block" },
    });
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: '{"key": "value"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    await waitFor(() => {
      expect(mockAddBlock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My Block", content: '{"key": "value"}' })
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Block Library")).toBeInTheDocument();
    });
  });

  test("clicking Save with valid JSON object (edit block) calls updateBlock with id + {name, content}", async () => {
    const block = makeBlock({ id: "b1", name: "Old Name", content: '{"old": 1}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Old Name" }));
    fireEvent.change(screen.getByPlaceholderText("Block name"), {
      target: { value: "New Name" },
    });
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: '{"new": 2}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    await waitFor(() => {
      expect(mockUpdateBlock).toHaveBeenCalledWith("b1", {
        name: "New Name",
        content: '{"new": 2}',
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Block Library")).toBeInTheDocument();
    });
  });

  test("persistence failure in handleSave shows error message and stays in editor view", async () => {
    mockAddBlock.mockRejectedValueOnce(new Error("Disk full"));
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    fireEvent.change(screen.getByPlaceholderText("Block name"), {
      target: { value: "My Block" },
    });
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: '{"key": "value"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    await waitFor(() => {
      expect(screen.getByText("Disk full")).toBeInTheDocument();
    });
    // Must remain in editor view
    expect(screen.getByRole("button", { name: "Save block" })).toBeInTheDocument();
  });
});

describe("Delete confirmation", () => {
  test("clicking Delete button opens AlertDialog with title containing block name", async () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha Block" }));
    await waitFor(() => {
      expect(screen.getByText(/Delete "Alpha Block"\?/)).toBeInTheDocument();
    });
  });

  test("clicking 'Keep block' closes dialog without calling deleteBlock", async () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha Block" }));
    await waitFor(() => {
      expect(screen.getByText("Keep block")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Keep block"));
    await waitFor(() => {
      expect(screen.queryByText(/Delete "Alpha Block"\?/)).not.toBeInTheDocument();
    });
    expect(mockDeleteBlock).not.toHaveBeenCalled();
  });

  test("clicking 'Delete block' calls deleteBlock with correct id and closes dialog", async () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha Block" }));
    await waitFor(() => {
      expect(screen.getByText("Delete block")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Delete block"));
    await waitFor(() => {
      expect(mockDeleteBlock).toHaveBeenCalledWith("b1");
    });
    expect(screen.queryByText(/Delete "Alpha Block"\?/)).not.toBeInTheDocument();
  });
});

describe("Mount hydration", () => {
  test("on mount when blocksLoaded===false, loadBlocks() is called once", () => {
    setupStore({ blocksLoaded: false });
    render(<BlockLibraryPanel />);
    expect(mockLoadBlocks).toHaveBeenCalledTimes(1);
  });

  test("on mount when blocksLoaded===true, loadBlocks() is NOT called", () => {
    setupStore({ blocksLoaded: true });
    render(<BlockLibraryPanel />);
    expect(mockLoadBlocks).not.toHaveBeenCalled();
  });
});
