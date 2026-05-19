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
    const saved = await store.get<Block[]>(BLOCKS_KEY);
    set({ blocks: saved ?? [], blocksLoaded: true });
  },

  addBlock: async (block) => {
    // Guard: do not write before async store hydration completes (mirrors useHistoryStore appendEntry guard)
    if (!get().blocksLoaded) return;
    const updated = [...get().blocks, block];
    set({ blocks: updated });
    await persistBlocks(updated);
  },

  updateBlock: async (id, updates) => {
    if (!get().blocksLoaded) return;
    const updated = get().blocks.map((b) =>
      b.id === id ? { ...b, ...updates } : b
    );
    set({ blocks: updated });
    await persistBlocks(updated);
  },

  deleteBlock: async (id) => {
    if (!get().blocksLoaded) return;
    const updated = get().blocks.filter((b) => b.id !== id);
    set({ blocks: updated });
    await persistBlocks(updated);
  },
}));
