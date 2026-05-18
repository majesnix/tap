import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

const HISTORY_STORE_PATH = "history.json";
const HISTORY_KEY = "entries";
const MAX_ENTRIES = 100; // D-02: FIFO cap at 100 entries

export interface HistoryEntry {
  id: string;                           // crypto.randomUUID() — no uuid dep needed
  timestamp: string;                    // new Date().toISOString()
  messageTypeName: string;              // selectedMessageType from store
  exchange: string;                     // exchange arg passed to publishMessage
  routingKey: string;                   // routingKey arg passed to publishMessage
  status: "sent" | "failed";
  errorMessage?: string;                // only on failed
  fieldValues: Record<string, unknown>; // latestValues from useProtoStore at send time
  payloadBytes: number[];               // hexToBytes(hexPreview) captured before await
}

interface HistoryStore {
  entries: HistoryEntry[];
  historyLoaded: boolean;
  loadHistory: () => Promise<void>;
  appendEntry: (entry: HistoryEntry) => Promise<void>;
  clearHistory: () => Promise<void>;
}

async function persistEntries(entries: HistoryEntry[]): Promise<void> {
  const store = await load(HISTORY_STORE_PATH, { autoSave: false });
  await store.set(HISTORY_KEY, entries);
  await store.save();
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [] as HistoryEntry[],
  historyLoaded: false,

  loadHistory: async () => {
    const store = await load(HISTORY_STORE_PATH, { autoSave: false });
    const saved = await store.get<HistoryEntry[]>(HISTORY_KEY);
    set({ entries: saved ?? [], historyLoaded: true });
  },

  appendEntry: async (entry) => {
    // Guard: do not write before async store hydration completes (T-03-03-06)
    // Prevents race condition where appendEntry fires before loadHistory() resolves,
    // which would cause loadHistory() to silently overwrite the newly-added entry.
    if (!get().historyLoaded) return;
    const current = get().entries;
    // Add to front (newest first); cap at MAX_ENTRIES — drops oldest (D-02)
    const updated = [entry, ...current].slice(0, MAX_ENTRIES);
    set({ entries: updated });
    await persistEntries(updated);
  },

  clearHistory: async () => {
    set({ entries: [] });
    await persistEntries([]);
  },
}));
