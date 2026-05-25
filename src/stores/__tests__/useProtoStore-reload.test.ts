import { describe, beforeEach, test, expect, vi } from "vitest";
import { useProtoStore } from "../useProtoStore";
import type { ProtoSchema } from "@/lib/types";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const makeSchema = (messageNames: string[]): ProtoSchema => ({
  messages: messageNames.map((name) => ({
    full_name: name,
    fields: [],
  })),
  enums: [],
  file_name: "test.proto",
});

beforeEach(() => {
  useProtoStore.getState().reset();
  vi.clearAllMocks();
});

describe("addRecentFile", () => {
  test("adds a file path to the front of recentFiles", () => {
    useProtoStore.getState().addRecentFile("/a.proto");
    expect(useProtoStore.getState().recentFiles).toEqual(["/a.proto"]);
  });

  test("deduplicates by moving existing entry to front", () => {
    useProtoStore.getState().addRecentFile("/a.proto");
    useProtoStore.getState().addRecentFile("/b.proto");
    useProtoStore.getState().addRecentFile("/a.proto");
    expect(useProtoStore.getState().recentFiles).toEqual([
      "/a.proto",
      "/b.proto",
    ]);
  });

  test("caps at 10 entries", () => {
    for (let i = 0; i < 12; i++) {
      useProtoStore.getState().addRecentFile(`/file-${i}.proto`);
    }
    expect(useProtoStore.getState().recentFiles).toHaveLength(10);
    expect(useProtoStore.getState().recentFiles[0]).toBe("/file-11.proto");
  });

  test("prepend order — newest first", () => {
    useProtoStore.getState().addRecentFile("/first.proto");
    useProtoStore.getState().addRecentFile("/second.proto");
    useProtoStore.getState().addRecentFile("/third.proto");
    const files = useProtoStore.getState().recentFiles;
    expect(files[0]).toBe("/third.proto");
    expect(files[1]).toBe("/second.proto");
    expect(files[2]).toBe("/first.proto");
  });
});

describe("updateFileSchema", () => {
  test("preserves selectedMessageType when the type still exists in new schema", () => {
    const schema = makeSchema(["pkg.MsgA", "pkg.MsgB"]);
    useProtoStore.getState().addOrActivateFile("/test.proto", schema);
    useProtoStore.getState().setSelectedType("pkg.MsgB");

    const newSchema = makeSchema(["pkg.MsgB", "pkg.MsgC"]);
    useProtoStore.getState().updateFileSchema("/test.proto", newSchema);

    expect(useProtoStore.getState().selectedMessageType).toBe("pkg.MsgB");
  });

  test("falls back to first message when selected type no longer exists", () => {
    const schema = makeSchema(["pkg.MsgA", "pkg.MsgB"]);
    useProtoStore.getState().addOrActivateFile("/test.proto", schema);
    useProtoStore.getState().setSelectedType("pkg.MsgB");

    const newSchema = makeSchema(["pkg.MsgC", "pkg.MsgD"]);
    useProtoStore.getState().updateFileSchema("/test.proto", newSchema);

    expect(useProtoStore.getState().selectedMessageType).toBe("pkg.MsgC");
  });

  test("falls back to null when new schema has no messages", () => {
    const schema = makeSchema(["pkg.MsgA"]);
    useProtoStore.getState().addOrActivateFile("/test.proto", schema);

    const emptySchema = makeSchema([]);
    useProtoStore.getState().updateFileSchema("/test.proto", emptySchema);

    expect(useProtoStore.getState().selectedMessageType).toBeNull();
  });

  test("does not change selectedMessageType when updating a non-active file", () => {
    const schemaA = makeSchema(["pkg.A"]);
    const schemaB = makeSchema(["pkg.B"]);
    useProtoStore.getState().addOrActivateFile("/a.proto", schemaA);
    useProtoStore.getState().addOrActivateFile("/b.proto", schemaB);
    // b.proto is active, selectedMessageType = pkg.B
    expect(useProtoStore.getState().selectedMessageType).toBe("pkg.B");

    const newSchemaA = makeSchema(["pkg.NewA"]);
    useProtoStore.getState().updateFileSchema("/a.proto", newSchemaA);

    // Still on pkg.B — non-active file update doesn't touch selectedMessageType
    expect(useProtoStore.getState().selectedMessageType).toBe("pkg.B");
  });

  test("no-ops for unknown file path", () => {
    const schema = makeSchema(["pkg.A"]);
    useProtoStore.getState().addOrActivateFile("/a.proto", schema);
    const before = useProtoStore.getState();

    useProtoStore.getState().updateFileSchema("/unknown.proto", makeSchema(["pkg.X"]));

    expect(useProtoStore.getState().openFiles).toBe(before.openFiles);
  });
});

describe("reloadRequested counter", () => {
  test("requestReload increments counter", () => {
    expect(useProtoStore.getState().reloadRequested).toBe(0);
    useProtoStore.getState().requestReload();
    expect(useProtoStore.getState().reloadRequested).toBe(1);
    useProtoStore.getState().requestReload();
    expect(useProtoStore.getState().reloadRequested).toBe(2);
  });
});

describe("setRecentFiles", () => {
  test("replaces the entire recent files list", () => {
    useProtoStore.getState().addRecentFile("/old.proto");
    useProtoStore.getState().setRecentFiles(["/new1.proto", "/new2.proto"]);
    expect(useProtoStore.getState().recentFiles).toEqual([
      "/new1.proto",
      "/new2.proto",
    ]);
  });
});
