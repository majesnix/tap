import { describe, beforeEach, test, expect } from "vitest";
import { useProtoStore } from "./useProtoStore";
import type { ProtoSchema } from "@/lib/types";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeSchema(name: string): ProtoSchema {
  return {
    messages: [
      {
        name,
        full_name: `${name}.Root`,
        fields: [],
      },
      {
        name: `${name}Secondary`,
        full_name: `${name}.Secondary`,
        fields: [],
      },
    ],
    message_map: {
      [`${name}.Root`]: { name, full_name: `${name}.Root`, fields: [] },
      [`${name}.Secondary`]: {
        name: `${name}Secondary`,
        full_name: `${name}.Secondary`,
        fields: [],
      },
    },
  };
}

const schemaA = makeSchema("A");
const schemaB = makeSchema("B");

// Reset store before each test to avoid bleed-over
beforeEach(() => {
  useProtoStore.getState().reset();
});

// ── addOrActivateFile ─────────────────────────────────────────────────────────

describe("addOrActivateFile", () => {
  test("opens first file → openFiles has 1 entry, activeIndex=0", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(1);
    expect(s.openFiles[0].filePath).toBe("a.proto");
    expect(s.activeIndex).toBe(0);
    expect(s.activeFilePath).toBe("a.proto");
    expect(s.schema).toBe(schemaA);
    expect(s.selectedMessageType).toBe("A.Root");
  });

  test("opening same file again when active → no-op (index unchanged, no type reset)", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    // Manually switch to secondary type
    useProtoStore.getState().setSelectedType("A.Secondary");
    // Re-open same file
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    const s = useProtoStore.getState();
    // Should still have 1 file
    expect(s.openFiles).toHaveLength(1);
    expect(s.activeIndex).toBe(0);
    // selectedMessageType should still be "A.Secondary" (no-op)
    expect(s.selectedMessageType).toBe("A.Secondary");
  });

  test("opening second different file → openFiles has 2 entries, activeIndex=1", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().addOrActivateFile("b.proto", schemaB);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(2);
    expect(s.activeIndex).toBe(1);
    expect(s.activeFilePath).toBe("b.proto");
    expect(s.schema).toBe(schemaB);
    expect(s.selectedMessageType).toBe("B.Root");
  });

  test("opening already-open but non-active file switches to it", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().addOrActivateFile("b.proto", schemaB);
    // Now re-open a.proto — should activate index 0
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(2); // no duplicate
    expect(s.activeIndex).toBe(0);
    expect(s.activeFilePath).toBe("a.proto");
  });

  test("caps at 20 files — 21st open is rejected", () => {
    for (let i = 0; i < 20; i++) {
      const schema = makeSchema(`F${i}`);
      useProtoStore.getState().addOrActivateFile(`f${i}.proto`, schema);
    }
    // Attempt to open a 21st file
    const extraSchema = makeSchema("Extra");
    useProtoStore.getState().addOrActivateFile("extra.proto", extraSchema);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(20);
  });
});

// ── closeFile ────────────────────────────────────────────────────────────────

describe("closeFile", () => {
  test("closing first of two files → 1 file remains, active = 0", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().addOrActivateFile("b.proto", schemaB);
    // active is index 1 (b.proto); close index 0 (a.proto)
    useProtoStore.getState().closeFile(0);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(1);
    expect(s.openFiles[0].filePath).toBe("b.proto");
    expect(s.activeIndex).toBe(0);
    expect(s.activeFilePath).toBe("b.proto");
  });

  test("closing only file → openFiles=[], activeIndex=-1, schema/filePath=null", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().closeFile(0);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(0);
    expect(s.activeIndex).toBe(-1);
    expect(s.activeFilePath).toBeNull();
    expect(s.schema).toBeNull();
    expect(s.selectedMessageType).toBeNull();
  });

  test("closing active tab when it is not last → activeIndex clamps to last", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().addOrActivateFile("b.proto", schemaB);
    // Active is index 1; close index 1
    useProtoStore.getState().closeFile(1);
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(1);
    expect(s.activeIndex).toBe(0);
    expect(s.activeFilePath).toBe("a.proto");
  });
});

// ── setActiveIndex ───────────────────────────────────────────────────────────

describe("setActiveIndex", () => {
  test("switching to index 0 from index 1 updates activeFilePath, schema, selectedMessageType (D-06)", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().addOrActivateFile("b.proto", schemaB);
    // Active is 1 (b.proto); switch back to 0
    useProtoStore.getState().setActiveIndex(0);
    const s = useProtoStore.getState();
    expect(s.activeIndex).toBe(0);
    expect(s.activeFilePath).toBe("a.proto");
    expect(s.schema).toBe(schemaA);
    // D-06: selectedMessageType resets to first message of the newly active schema
    expect(s.selectedMessageType).toBe("A.Root");
  });
});

// ── Signal fields ─────────────────────────────────────────────────────────────

describe("latestValues", () => {
  test("setLatestValues stores values", () => {
    useProtoStore.getState().setLatestValues({ foo: "bar" });
    expect(useProtoStore.getState().latestValues).toEqual({ foo: "bar" });
  });

  test("setLatestValues(null) clears values", () => {
    useProtoStore.getState().setLatestValues({ foo: "bar" });
    useProtoStore.getState().setLatestValues(null);
    expect(useProtoStore.getState().latestValues).toBeNull();
  });
});

describe("lastSendAt", () => {
  test("setLastSendAt stores timestamp", () => {
    useProtoStore.getState().setLastSendAt(12345);
    expect(useProtoStore.getState().lastSendAt).toBe(12345);
  });

  test("setLastSendAt(null) clears it", () => {
    useProtoStore.getState().setLastSendAt(12345);
    useProtoStore.getState().setLastSendAt(null);
    expect(useProtoStore.getState().lastSendAt).toBeNull();
  });
});

describe("pendingReplayValues", () => {
  test("setPendingReplayValues stores values", () => {
    useProtoStore.getState().setPendingReplayValues({ x: 1 });
    expect(useProtoStore.getState().pendingReplayValues).toEqual({ x: 1 });
  });

  test("setPendingReplayValues(null) clears values", () => {
    useProtoStore.getState().setPendingReplayValues({ x: 1 });
    useProtoStore.getState().setPendingReplayValues(null);
    expect(useProtoStore.getState().pendingReplayValues).toBeNull();
  });
});

// ── reset ────────────────────────────────────────────────────────────────────

describe("reset", () => {
  test("reset() brings all fields back to initial state", () => {
    useProtoStore.getState().addOrActivateFile("a.proto", schemaA);
    useProtoStore.getState().setLatestValues({ foo: 1 });
    useProtoStore.getState().setLastSendAt(999);
    useProtoStore.getState().setPendingReplayValues({ y: 2 });
    useProtoStore.getState().reset();
    const s = useProtoStore.getState();
    expect(s.openFiles).toHaveLength(0);
    expect(s.activeIndex).toBe(-1);
    expect(s.activeFilePath).toBeNull();
    expect(s.schema).toBeNull();
    expect(s.selectedMessageType).toBeNull();
    expect(s.latestValues).toBeNull();
    expect(s.lastSendAt).toBeNull();
    expect(s.pendingReplayValues).toBeNull();
    expect(s.hexPreview).toBe("");
    expect(s.isEncoding).toBe(false);
    expect(s.encodeError).toBeNull();
  });
});
