import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { bytesToBase64, truncatePayloadForHistory } from "@/lib/bytes";

const HISTORY_STORE_PATH = "history.json";
const HISTORY_KEY = "entries";
const MAX_ENTRIES = 100; // D-02: FIFO cap at 100 entries
/** Entries older than this are dropped on load; history is a scratchpad, not an archive. */
export const MAX_HISTORY_AGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function isFresh(entry: HistoryEntry, now: number): boolean {
  const at = Date.parse(entry.timestamp);
  if (Number.isNaN(at)) return true; // never destroy data over a malformed timestamp
  return now - at <= MAX_HISTORY_AGE_DAYS * DAY_MS;
}

export interface HistoryEntry {
  id: string;                           // crypto.randomUUID() — no uuid dep needed
  timestamp: string;                    // new Date().toISOString()
  messageTypeName: string;              // selectedMessageType from store
  exchange: string;                     // exchange arg passed to publishMessage
  routingKey: string;                   // routingKey arg passed to publishMessage
  protoPath?: string;                   // D-10: activeFilePath at send time; undefined for entries created before Phase 21
  status: "sent" | "failed";
  errorMessage?: string;                // only on failed
  fieldValues: Record<string, unknown>; // latestValues from useProtoStore at send time
  payloadBase64: string;                // wire bytes as base64, capped by truncatePayloadForHistory
  payloadTruncated?: boolean;           // true when only the first MAX_HISTORY_PAYLOAD_BYTES were kept
}

/**
 * Bring a persisted entry up to the current shape. Entries written before 1.10 stored
 * `payloadBytes` as a JSON number array; anything without a usable payload is dropped.
 */
export function normalizeHistoryEntry(raw: unknown): HistoryEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { payloadBytes, payloadBase64, payloadTruncated, ...rest } = raw as Record<string, unknown>;
  let stored: { payloadBase64: string; payloadTruncated: boolean };
  if (typeof payloadBase64 === "string") {
    stored = { payloadBase64, payloadTruncated: payloadTruncated === true };
  } else if (
    Array.isArray(payloadBytes) &&
    payloadBytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    stored = truncatePayloadForHistory(bytesToBase64(Uint8Array.from(payloadBytes as number[])));
  } else {
    return null;
  }
  return { ...(rest as Omit<HistoryEntry, "payloadBase64" | "payloadTruncated">), ...stored };
}

interface HistoryStore {
  entries: HistoryEntry[];
  historyLoaded: boolean;
  loadHistory: () => Promise<void>;
  appendEntry: (entry: HistoryEntry) => Promise<void>;
  clearHistory: () => Promise<void>;
}

async function persistEntries(entries: HistoryEntry[]): Promise<void> {
  // NEVER use autoSave: true — always call .save() explicitly.
  // Note: load() without options works; passing { autoSave: false } requires 'defaults' field.
  const store = await load(HISTORY_STORE_PATH);
  await store.set(HISTORY_KEY, entries);
  await store.save();
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [] as HistoryEntry[],
  historyLoaded: false,

  loadHistory: async () => {
    const store = await load(HISTORY_STORE_PATH);
    const saved = await store.get<unknown[]>(HISTORY_KEY);
    const now = Date.now();
    const entries = (saved ?? [])
      .map(normalizeHistoryEntry)
      .filter((e): e is HistoryEntry => e !== null)
      .filter((e) => isFresh(e, now));
    set({ entries, historyLoaded: true });
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
