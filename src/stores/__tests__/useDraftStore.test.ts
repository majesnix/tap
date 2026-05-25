import { describe, beforeEach, test, expect, vi } from "vitest";

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

import { useDraftStore, type DraftEntry } from "../useDraftStore";

beforeEach(() => {
  useDraftStore.setState({ drafts: {}, draftsLoaded: false });
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
});

describe("loadDrafts", () => {
  test("loads drafts from persisted store and sets draftsLoaded=true", async () => {
    const saved: Record<string, DraftEntry> = {
      "/a.proto::Msg": { values: { x: 1 }, accessedAt: 100 },
    };
    mockGet.mockResolvedValueOnce(saved);

    await useDraftStore.getState().loadDrafts();

    const { drafts, draftsLoaded } = useDraftStore.getState();
    expect(draftsLoaded).toBe(true);
    expect(drafts["/a.proto::Msg"]).toEqual({ values: { x: 1 }, accessedAt: 100 });
  });

  test("loads empty object when store returns null", async () => {
    mockGet.mockResolvedValueOnce(null);

    await useDraftStore.getState().loadDrafts();

    const { drafts, draftsLoaded } = useDraftStore.getState();
    expect(draftsLoaded).toBe(true);
    expect(Object.keys(drafts)).toHaveLength(0);
  });
});

describe("saveDraft", () => {
  test("saves draft and persists to store", async () => {
    useDraftStore.setState({ draftsLoaded: true });

    await useDraftStore.getState().saveDraft("/a.proto", "Msg", { name: "test" });

    const { drafts } = useDraftStore.getState();
    expect(drafts["/a.proto::Msg"]).toBeDefined();
    expect(drafts["/a.proto::Msg"].values).toEqual({ name: "test" });
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("no-op when draftsLoaded is false", async () => {
    await useDraftStore.getState().saveDraft("/a.proto", "Msg", { name: "test" });

    expect(Object.keys(useDraftStore.getState().drafts)).toHaveLength(0);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("LRU evicts oldest entry at 51st draft", async () => {
    useDraftStore.setState({ draftsLoaded: true });

    const baseDrafts: Record<string, DraftEntry> = {};
    for (let i = 0; i < 50; i++) {
      baseDrafts[`/file${i}.proto::Msg`] = {
        values: { i },
        accessedAt: i,
      };
    }
    useDraftStore.setState({ drafts: baseDrafts });

    await useDraftStore.getState().saveDraft("/new.proto", "NewMsg", { val: "new" });

    const { drafts } = useDraftStore.getState();
    const keys = Object.keys(drafts);
    expect(keys).toHaveLength(50);
    expect(drafts["/new.proto::NewMsg"]).toBeDefined();
    expect(drafts["/file0.proto::Msg"]).toBeUndefined();
  });
});

describe("getDraft", () => {
  test("returns draft entry and updates accessedAt", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 5000);

    useDraftStore.setState({
      draftsLoaded: true,
      drafts: {
        "/a.proto::Msg": { values: { x: 1 }, accessedAt: now },
      },
    });

    const result = useDraftStore.getState().getDraft("/a.proto", "Msg");

    expect(result).toBeDefined();
    expect(result!.values).toEqual({ x: 1 });
    expect(useDraftStore.getState().drafts["/a.proto::Msg"].accessedAt).toBe(now + 5000);

    vi.restoreAllMocks();
  });

  test("returns undefined for non-existent draft", () => {
    useDraftStore.setState({ draftsLoaded: true, drafts: {} });

    const result = useDraftStore.getState().getDraft("/a.proto", "Missing");
    expect(result).toBeUndefined();
  });
});

describe("clearDraft", () => {
  test("removes draft entry and persists", async () => {
    useDraftStore.setState({
      draftsLoaded: true,
      drafts: {
        "/a.proto::Msg": { values: { x: 1 }, accessedAt: 100 },
        "/b.proto::Other": { values: { y: 2 }, accessedAt: 200 },
      },
    });

    await useDraftStore.getState().clearDraft("/a.proto", "Msg");

    const { drafts } = useDraftStore.getState();
    expect(drafts["/a.proto::Msg"]).toBeUndefined();
    expect(drafts["/b.proto::Other"]).toBeDefined();
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("no-op when draftsLoaded is false", async () => {
    useDraftStore.setState({
      draftsLoaded: false,
      drafts: { "/a.proto::Msg": { values: { x: 1 }, accessedAt: 100 } },
    });

    await useDraftStore.getState().clearDraft("/a.proto", "Msg");

    expect(useDraftStore.getState().drafts["/a.proto::Msg"]).toBeDefined();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
