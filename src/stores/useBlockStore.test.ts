import { describe, beforeEach, test, expect, vi } from "vitest";

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

import { useBlockStore, type Block } from "./useBlockStore";

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: crypto.randomUUID(),
    name: "My Block",
    content: "{}",
    ...overrides,
  };
}

beforeEach(() => {
  // Reset store state to prevent Zustand singleton bleed across tests
  useBlockStore.setState({ blocks: [], blocksLoaded: false });
  vi.clearAllMocks();
  // Default: store.get returns null (no persisted blocks)
  mockGet.mockResolvedValue(null);
});

// ── loadBlocks ────────────────────────────────────────────────────────────────

describe("loadBlocks", () => {
  test("loadBlocks when store returns null sets blocks=[] and blocksLoaded=true", async () => {
    mockGet.mockResolvedValueOnce(null);
    await useBlockStore.getState().loadBlocks();
    const { blocks, blocksLoaded } = useBlockStore.getState();
    expect(blocksLoaded).toBe(true);
    expect(blocks).toHaveLength(0);
  });

  test("loadBlocks when store has saved blocks populates blocks array correctly", async () => {
    const saved = [
      makeBlock({ id: "saved-1", name: "Block A", content: '{"key":"value"}' }),
      makeBlock({ id: "saved-2", name: "Block B", content: '{"foo":"bar"}' }),
    ];
    mockGet.mockResolvedValueOnce(saved);
    await useBlockStore.getState().loadBlocks();
    const { blocks, blocksLoaded } = useBlockStore.getState();
    expect(blocksLoaded).toBe(true);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBe("saved-1");
    expect(blocks[1].id).toBe("saved-2");
  });
});

// ── addBlock ──────────────────────────────────────────────────────────────────

describe("addBlock", () => {
  test("addBlock when blocksLoaded===false returns early — store.set never called", async () => {
    // blocksLoaded is false (set in beforeEach)
    const block = makeBlock({ id: "guarded-block" });
    await useBlockStore.getState().addBlock(block);
    expect(useBlockStore.getState().blocks).toHaveLength(0);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("addBlock when blocksLoaded===true appends block to end, calls store.set + store.save", async () => {
    useBlockStore.setState({ blocksLoaded: true });
    const block = makeBlock({ id: "new-block", name: "My Block", content: "{}" });
    await useBlockStore.getState().addBlock(block);
    const { blocks } = useBlockStore.getState();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe("new-block");
    expect(mockSet).toHaveBeenCalledWith("blocks", [block]);
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("addBlock appends to end (not prepend)", async () => {
    const first = makeBlock({ id: "first" });
    const second = makeBlock({ id: "second" });
    useBlockStore.setState({ blocks: [first], blocksLoaded: true });
    await useBlockStore.getState().addBlock(second);
    const { blocks } = useBlockStore.getState();
    expect(blocks[0].id).toBe("first");
    expect(blocks[1].id).toBe("second");
  });
});

// ── updateBlock ───────────────────────────────────────────────────────────────

describe("updateBlock", () => {
  test("updateBlock when blocksLoaded===false returns early", async () => {
    const block = makeBlock({ id: "some-block" });
    useBlockStore.setState({ blocks: [block], blocksLoaded: false });
    await useBlockStore.getState().updateBlock("some-block", { name: "Updated", content: "{}" });
    // Block should remain unchanged
    expect(useBlockStore.getState().blocks[0].name).toBe("My Block");
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("updateBlock when blocksLoaded===true replaces matching block by id (immutable map), persists", async () => {
    const original = makeBlock({ id: "block-to-update", name: "Original", content: '{"old":true}' });
    useBlockStore.setState({ blocks: [original], blocksLoaded: true });

    await useBlockStore.getState().updateBlock("block-to-update", {
      name: "Updated Name",
      content: '{"new":true}',
    });

    const { blocks } = useBlockStore.getState();
    expect(blocks).toHaveLength(1);

    // Verify updated fields
    expect(blocks[0].name).toBe("Updated Name");
    expect(blocks[0].content).toBe('{"new":true}');
    expect(blocks[0].id).toBe("block-to-update");

    // Verify immutability — original object is not mutated
    expect(original.name).toBe("Original");
    expect(original.content).toBe('{"old":true}');

    // Verify persistence calls
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

// ── deleteBlock ───────────────────────────────────────────────────────────────

describe("deleteBlock", () => {
  test("deleteBlock when blocksLoaded===false returns early", async () => {
    const block = makeBlock({ id: "block-to-keep" });
    useBlockStore.setState({ blocks: [block], blocksLoaded: false });
    await useBlockStore.getState().deleteBlock("block-to-keep");
    // Block should not be removed
    expect(useBlockStore.getState().blocks).toHaveLength(1);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("deleteBlock when blocksLoaded===true removes matching block by id (immutable filter), persists", async () => {
    const blockA = makeBlock({ id: "block-a" });
    const blockB = makeBlock({ id: "block-b" });
    useBlockStore.setState({ blocks: [blockA, blockB], blocksLoaded: true });

    await useBlockStore.getState().deleteBlock("block-a");

    const { blocks } = useBlockStore.getState();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe("block-b");

    // Verify persistence calls
    expect(mockSet).toHaveBeenCalledWith("blocks", [blockB]);
    expect(mockSave).toHaveBeenCalledOnce();
  });
});
