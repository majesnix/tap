import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, describe, test, expect } from "vitest";

vi.mock("@dnd-kit/core", () => ({
  useDraggable: vi.fn(({ id }: { id: string }) => ({
    attributes: { 'data-draggable-id': id },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));
import { useDraggable } from "@dnd-kit/core";

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

// Mock useProtoStore — selector-style hook, used only for the fit hint
vi.mock("@/stores/useProtoStore", () => ({
  useProtoStore: vi.fn(),
}));

import { BlockLibraryPanel } from "@/components/blocks/BlockLibraryPanel";
import { useBlockStore } from "@/stores/useBlockStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useTheme } from "next-themes";
import type { Block } from "@/stores/useBlockStore";
import type { MessageSchema, FieldSchema } from "@/lib/types";

function f(name: string): FieldSchema {
  return { name, label: name, field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: false };
}

const orderMessage: MessageSchema = {
  name: "Order",
  full_name: "p.Order",
  fields: [f("order_id"), f("customer_id"), f("status")],
};

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

interface ProtoState {
  schema: { message_map: Record<string, MessageSchema> } | null;
  selectedMessageType: string | null;
}

function setupProtoStore(state: ProtoState = { schema: null, selectedMessageType: null }) {
  vi.mocked(useProtoStore).mockImplementation(
    ((selector: (s: ProtoState) => unknown) => selector(state)) as typeof useProtoStore
  );
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return { id: "block-1", name: "My Block", content: '{"foo": 1}', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupStore();
  setupProtoStore();
});

describe("List view", () => {
  test("renders 'Blocks' heading in panel header", () => {
    render(<BlockLibraryPanel />);
    expect(screen.getByText("Blocks")).toBeInTheDocument();
  });

  test("renders '+ New Block' button with aria-label 'New block' in panel header", () => {
    render(<BlockLibraryPanel />);
    expect(screen.getByRole("button", { name: "New block" })).toBeInTheDocument();
  });

  test("renders search button with aria-label 'Search blocks'", () => {
    render(<BlockLibraryPanel />);
    expect(screen.getByRole("button", { name: "Search blocks" })).toBeInTheDocument();
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

  test("when blocksLoaded===true and blocks have entries renders one card per block with name", () => {
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

  test("does not render a per-block Delete button (delete moved to editor footer)", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    expect(screen.queryByRole("button", { name: "Delete Alpha Block" })).not.toBeInTheDocument();
  });

  test("renders a single-line JSON preview for each block", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block", content: '{\n  "order_id": "a"\n}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    expect(screen.getByText('{ "order_id": "a" }')).toBeInTheDocument();
  });

  test("renders a success fit line when every block key matches the selected message's fields", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block", content: '{"order_id":"a","status":2}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    setupProtoStore({
      schema: { message_map: { "p.Order": orderMessage } },
      selectedMessageType: "p.Order",
    });
    render(<BlockLibraryPanel />);
    const fitLine = screen.getByText("fits Order · 2 of 3 fields");
    expect(fitLine).toBeInTheDocument();
    expect(fitLine).toHaveClass("text-success");
  });

  test("renders a warning fit line when only some block keys match", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block", content: '{"order_id":"a","nope":1}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    setupProtoStore({
      schema: { message_map: { "p.Order": orderMessage } },
      selectedMessageType: "p.Order",
    });
    render(<BlockLibraryPanel />);
    const fitLine = screen.getByText("partly fits Order · 1 of 2 keys");
    expect(fitLine).toBeInTheDocument();
    expect(fitLine).toHaveClass("text-warning");
  });

  test("omits the fit line when there is no selected message", () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block", content: '{"order_id":"a"}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    setupProtoStore({ schema: null, selectedMessageType: null });
    render(<BlockLibraryPanel />);
    expect(screen.queryByText(/fits/)).not.toBeInTheDocument();
  });
});

describe("Search filter", () => {
  test("filter input is not shown until the search button is clicked", () => {
    render(<BlockLibraryPanel />);
    expect(screen.queryByLabelText("Filter blocks")).not.toBeInTheDocument();
  });

  test("clicking the search button reveals the filter input", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Search blocks" }));
    expect(screen.getByLabelText("Filter blocks")).toBeInTheDocument();
  });

  test("typing in the filter input hides cards whose name does not match", () => {
    const alpha = makeBlock({ id: "b1", name: "Alpha Block" });
    const beta = makeBlock({ id: "b2", name: "Beta Block" });
    setupStore({ blocksLoaded: true, blocks: [alpha, beta] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Search blocks" }));
    fireEvent.change(screen.getByLabelText("Filter blocks"), { target: { value: "alpha" } });
    expect(screen.getByText("Alpha Block")).toBeInTheDocument();
    expect(screen.queryByText("Beta Block")).not.toBeInTheDocument();
  });

  test("filter matches case-insensitively", () => {
    const alpha = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [alpha] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Search blocks" }));
    fireEvent.change(screen.getByLabelText("Filter blocks"), { target: { value: "ALPHA" } });
    expect(screen.getByText("Alpha Block")).toBeInTheDocument();
  });

  test("clicking the search button again hides the input and clears the filter", () => {
    const alpha = makeBlock({ id: "b1", name: "Alpha Block" });
    const beta = makeBlock({ id: "b2", name: "Beta Block" });
    setupStore({ blocksLoaded: true, blocks: [alpha, beta] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Search blocks" }));
    fireEvent.change(screen.getByLabelText("Filter blocks"), { target: { value: "alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Search blocks" }));
    expect(screen.queryByLabelText("Filter blocks")).not.toBeInTheDocument();
    expect(screen.getByText("Alpha Block")).toBeInTheDocument();
    expect(screen.getByText("Beta Block")).toBeInTheDocument();
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

  test("clicking '+ New Block' does NOT show a 'Delete block' button (new block, not editing)", () => {
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New block" }));
    expect(screen.queryByRole("button", { name: "Delete block" })).not.toBeInTheDocument();
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

  test("clicking Edit shows a 'Delete block' button in the editor footer", () => {
    const block = makeBlock({ id: "b1", name: "My Block", content: '{"foo": 1}' });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Block" }));
    expect(screen.getByRole("button", { name: "Delete block" })).toBeInTheDocument();
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
    expect(screen.getByText("Blocks")).toBeInTheDocument();
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
    // role=alert must be on the container so all validation errors are announced
    expect(screen.getByRole("alert")).toBeInTheDocument();
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
    expect(screen.getByRole("alert")).toBeInTheDocument();
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
      expect(screen.getByText("Blocks")).toBeInTheDocument();
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
      expect(screen.getByText("Blocks")).toBeInTheDocument();
    });
  });

  test("persistence failure in handleSave shows error message (not 'Invalid JSON') and stays in editor view", async () => {
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
    // Header must NOT read "Invalid JSON" for a persistence error
    expect(screen.queryByText("Invalid JSON")).not.toBeInTheDocument();
    // role=alert container present
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Must remain in editor view
    expect(screen.getByRole("button", { name: "Save block" })).toBeInTheDocument();
  });
});

describe("Delete confirmation (editor footer)", () => {
  test("clicking 'Delete block' in the editor footer opens AlertDialog with title containing block name", async () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Alpha Block" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete block" }));
    await waitFor(() => {
      expect(screen.getByText(/Delete "Alpha Block"\?/)).toBeInTheDocument();
    });
  });

  test("clicking 'Keep block' closes dialog without calling deleteBlock and stays in editor view", async () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Alpha Block" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete block" }));
    await waitFor(() => {
      expect(screen.getByText("Keep block")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Keep block"));
    await waitFor(() => {
      expect(screen.queryByText(/Delete "Alpha Block"\?/)).not.toBeInTheDocument();
    });
    expect(mockDeleteBlock).not.toHaveBeenCalled();
    expect(screen.getByText("Edit block")).toBeInTheDocument();
  });

  test("confirming delete in the dialog calls deleteBlock with correct id, closes dialog and returns to list", async () => {
    const block = makeBlock({ id: "b1", name: "Alpha Block" });
    setupStore({ blocksLoaded: true, blocks: [block] });
    render(<BlockLibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Alpha Block" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete block" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete block" }));
    await waitFor(() => {
      expect(mockDeleteBlock).toHaveBeenCalledWith("b1");
    });
    await waitFor(() => {
      expect(screen.queryByText(/Delete "Alpha Block"\?/)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Blocks")).toBeInTheDocument();
    });
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

describe('Drag source', () => {
  test('block list row uses useDraggable (dnd-kit pointer-based drag)', () => {
    setupStore({ blocks: [makeBlock()] });
    render(<BlockLibraryPanel />);
    expect(useDraggable).toHaveBeenCalledWith({ id: 'block-1' });
  });

  test('block list row has cursor-grab class', () => {
    setupStore({ blocks: [makeBlock()] });
    render(<BlockLibraryPanel />);
    const row = screen.getByText('My Block').closest('div')!;
    expect(row).toHaveClass('cursor-grab');
  });

  test('useDraggable is called with the correct block id', () => {
    const block = makeBlock({ id: 'block-42', name: 'Test Block' });
    setupStore({ blocks: [block] });
    render(<BlockLibraryPanel />);
    expect(useDraggable).toHaveBeenCalledWith({ id: 'block-42' });
  });

  test('useDraggable is called once per block with the correct ids', () => {
    const block1 = makeBlock({ id: 'block-1', name: 'First Block' });
    const block2 = makeBlock({ id: 'block-2', name: 'Second Block' });
    setupStore({ blocks: [block1, block2] });
    render(<BlockLibraryPanel />);
    expect(useDraggable).toHaveBeenCalledWith({ id: 'block-1' });
    expect(useDraggable).toHaveBeenCalledWith({ id: 'block-2' });
  });
});
