import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

const DRAFT_STORE_PATH = "drafts.json";
const DRAFTS_KEY = "drafts";
const MAX_DRAFTS = 50;

export interface DraftEntry {
  values: Record<string, unknown>;
  accessedAt: number;
}

interface DraftStore {
  drafts: Record<string, DraftEntry>;
  draftsLoaded: boolean;
  loadDrafts: () => Promise<void>;
  saveDraft: (filePath: string, messageType: string, values: Record<string, unknown>) => Promise<void>;
  getDraft: (filePath: string, messageType: string) => DraftEntry | undefined;
  clearDraft: (filePath: string, messageType: string) => Promise<void>;
}

function draftKey(filePath: string, messageType: string): string {
  return `${filePath}::${messageType}`;
}

async function persistDrafts(drafts: Record<string, DraftEntry>): Promise<void> {
  const store = await load(DRAFT_STORE_PATH);
  await store.set(DRAFTS_KEY, drafts);
  await store.save();
}

function evictLRU(drafts: Record<string, DraftEntry>): Record<string, DraftEntry> {
  const keys = Object.keys(drafts);
  if (keys.length <= MAX_DRAFTS) return drafts;

  const sorted = keys.sort(
    (a, b) => (drafts[a]?.accessedAt ?? 0) - (drafts[b]?.accessedAt ?? 0)
  );
  const toRemove = sorted.slice(0, keys.length - MAX_DRAFTS);
  const result: Record<string, DraftEntry> = {};
  for (const k of keys) {
    if (!toRemove.includes(k)) {
      result[k] = drafts[k];
    }
  }
  return result;
}

export const useDraftStore = create<DraftStore>((set, get) => ({
  drafts: {} as Record<string, DraftEntry>,
  draftsLoaded: false,

  loadDrafts: async () => {
    const store = await load(DRAFT_STORE_PATH);
    const saved = await store.get<Record<string, DraftEntry>>(DRAFTS_KEY);
    set({ drafts: saved ?? {}, draftsLoaded: true });
  },

  saveDraft: async (filePath, messageType, values) => {
    if (!get().draftsLoaded) return;
    const key = draftKey(filePath, messageType);
    const current = get().drafts;
    const updated = evictLRU({
      ...current,
      [key]: { values, accessedAt: Date.now() },
    });
    set({ drafts: updated });
    await persistDrafts(updated);
  },

  getDraft: (filePath, messageType) => {
    const key = draftKey(filePath, messageType);
    const entry = get().drafts[key];
    if (!entry) return undefined;
    const updated = {
      ...get().drafts,
      [key]: { ...entry, accessedAt: Date.now() },
    };
    set({ drafts: updated });
    return entry;
  },

  clearDraft: async (filePath, messageType) => {
    if (!get().draftsLoaded) return;
    const key = draftKey(filePath, messageType);
    const current = get().drafts;
    const { [key]: _, ...rest } = current;
    set({ drafts: rest });
    await persistDrafts(rest);
  },
}));
