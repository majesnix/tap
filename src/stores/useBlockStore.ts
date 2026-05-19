import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

const BLOCKS_STORE_PATH = "blocks.json";
const BLOCKS_KEY = "blocks";

export interface Block {
  id: string; // crypto.randomUUID() at creation time
  name: string; // user-defined label
  content: string; // raw JSON string — not parsed here, only at apply time (Phase 12)
}

interface BlockStore {
  blocks: Block[];
  blocksLoaded: boolean;
  loadBlocks: () => Promise<void>;
  addBlock: (block: Block) => Promise<void>;
  updateBlock: (id: string, updates: Pick<Block, "name" | "content">) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
}

function isBlock(value: unknown): value is Block {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Block).id === "string" &&
    typeof (value as Block).name === "string" &&
    typeof (value as Block).content === "string"
  );
}

// NEVER call load(path, { autoSave: false }) — requires 'defaults' field (Pitfall 2)
async function persistBlocks(blocks: Block[]): Promise<void> {
  const store = await load(BLOCKS_STORE_PATH);
  await store.set(BLOCKS_KEY, blocks);
  await store.save();
}

export const useBlockStore = create<BlockStore>((set, get) => ({
  blocks: [],
  blocksLoaded: false,

  loadBlocks: async () => {
    const store = await load(BLOCKS_STORE_PATH);
    const saved = await store.get<unknown>(BLOCKS_KEY);
    const blocks = Array.isArray(saved) ? saved.filter(isBlock) : [];
    set({ blocks, blocksLoaded: true });
  },

  addBlock: async (block) => {
    // Guard: do not write before async store hydration completes (mirrors useHistoryStore appendEntry guard)
    if (!get().blocksLoaded) return;
    let previous: Block[] = [];
    let updated: Block[] = [];
    set((state) => {
      previous = state.blocks;
      updated = [...state.blocks, block];
      return { blocks: updated };
    });
    try {
      await persistBlocks(updated);
    } catch (err) {
      // Roll back to prevent in-memory/disk divergence
      set({ blocks: previous });
      throw err;
    }
  },

  updateBlock: async (id, updates) => {
    if (!get().blocksLoaded) return;
    let previous: Block[] = [];
    let updated: Block[] = [];
    set((state) => {
      previous = state.blocks;
      updated = state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b));
      return { blocks: updated };
    });
    try {
      await persistBlocks(updated);
    } catch (err) {
      set({ blocks: previous });
      throw err;
    }
  },

  deleteBlock: async (id) => {
    if (!get().blocksLoaded) return;
    let previous: Block[] = [];
    let updated: Block[] = [];
    set((state) => {
      previous = state.blocks;
      updated = state.blocks.filter((b) => b.id !== id);
      return { blocks: updated };
    });
    try {
      await persistBlocks(updated);
    } catch (err) {
      set({ blocks: previous });
      throw err;
    }
  },
}));
