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

import { useHistoryStore, type HistoryEntry } from "./useHistoryStore";

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    messageTypeName: "test.MyMessage",
    exchange: "",
    routingKey: "test-queue",
    status: "sent",
    fieldValues: {},
    payloadBytes: [0x0a, 0x05],
    ...overrides,
  };
}

beforeEach(() => {
  // Reset store state to prevent Zustand singleton bleed across tests
  useHistoryStore.setState({ entries: [], historyLoaded: false });
  vi.clearAllMocks();
  // Default: store.get returns null (no persisted history)
  mockGet.mockResolvedValue(null);
});

// ── appendEntry ───────────────────────────────────────────────────────────────

describe("appendEntry", () => {
  test("appendEntry when historyLoaded===false returns early (race guard)", async () => {
    // historyLoaded is false (set in beforeEach)
    const entry = makeEntry({ id: "guarded-entry" });
    await useHistoryStore.getState().appendEntry(entry);
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  test("appendEntry prepends to front (newest first)", async () => {
    useHistoryStore.setState({ historyLoaded: true });
    const first = makeEntry({ id: "first" });
    const second = makeEntry({ id: "second" });
    await useHistoryStore.getState().appendEntry(first);
    await useHistoryStore.getState().appendEntry(second);
    const { entries } = useHistoryStore.getState();
    // second was added last, so it should be at index 0 (newest first)
    expect(entries[0].id).toBe("second");
    expect(entries[1].id).toBe("first");
  });

  test("appendEntry caps at 100 entries (FIFO — oldest dropped)", async () => {
    useHistoryStore.setState({ historyLoaded: true });
    // Add 100 entries with ids "1".."100"
    for (let i = 1; i <= 100; i++) {
      await useHistoryStore.getState().appendEntry(makeEntry({ id: String(i) }));
    }
    expect(useHistoryStore.getState().entries).toHaveLength(100);
    // Add 101st
    await useHistoryStore.getState().appendEntry(makeEntry({ id: "101" }));
    const { entries } = useHistoryStore.getState();
    // Still capped at 100
    expect(entries).toHaveLength(100);
    // Newest is at front
    expect(entries[0].id).toBe("101");
    // Oldest (id "1") is dropped
    expect(entries.find((e) => e.id === "1")).toBeUndefined();
  });

  test("appendEntry calls store.set and store.save after updating state", async () => {
    useHistoryStore.setState({ historyLoaded: true });
    const entry = makeEntry({ id: "persist-test" });
    await useHistoryStore.getState().appendEntry(entry);
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

// ── clearHistory ──────────────────────────────────────────────────────────────

describe("clearHistory", () => {
  test("clearHistory empties entries", async () => {
    useHistoryStore.setState({ entries: [makeEntry()], historyLoaded: true });
    await useHistoryStore.getState().clearHistory();
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  test("clearHistory persists empty array to store", async () => {
    useHistoryStore.setState({ entries: [makeEntry()], historyLoaded: true });
    await useHistoryStore.getState().clearHistory();
    expect(mockSet).toHaveBeenCalledWith("entries", []);
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

// ── loadHistory ───────────────────────────────────────────────────────────────

describe("loadHistory", () => {
  test("loadHistory populates entries from persisted store data and sets historyLoaded=true", async () => {
    const saved = [makeEntry({ id: "persisted-1" }), makeEntry({ id: "persisted-2" })];
    mockGet.mockResolvedValueOnce(saved);
    await useHistoryStore.getState().loadHistory();
    const { entries, historyLoaded } = useHistoryStore.getState();
    expect(historyLoaded).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe("persisted-1");
    expect(entries[1].id).toBe("persisted-2");
  });

  test("loadHistory when store returns null → entries=[] and historyLoaded=true", async () => {
    mockGet.mockResolvedValueOnce(null);
    await useHistoryStore.getState().loadHistory();
    const { entries, historyLoaded } = useHistoryStore.getState();
    expect(historyLoaded).toBe(true);
    expect(entries).toHaveLength(0);
  });
});
