import { describe, it, expect } from "vitest";
import { filterHistoryEntries, findReplayTabIndex } from "./historyHelpers";
import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { ProtoSchema } from "@/lib/types";

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "test-id",
    timestamp: new Date().toISOString(),
    messageTypeName: "com.example.MyMessage",
    exchange: "",
    routingKey: "my.queue",
    status: "sent",
    fieldValues: {},
    payloadBytes: [],
    ...overrides,
  };
}

function makeOpenFile(
  filePath: string,
  messageTypeNames: string[]
): { filePath: string; schema: ProtoSchema } {
  const messages = messageTypeNames.map((full_name) => ({
    name: full_name.split(".").pop() ?? full_name,
    full_name,
    fields: [],
  }));
  return {
    filePath,
    schema: {
      messages,
      message_map: Object.fromEntries(messages.map((m) => [m.full_name, m])),
    },
  };
}

// ── filterHistoryEntries ──────────────────────────────────────────────────────

describe("filterHistoryEntries", () => {
  const entries = [
    makeEntry({
      id: "1",
      messageTypeName: "com.example.MyMessage",
      exchange: "orders.exchange",
      routingKey: "orders.queue",
    }),
    makeEntry({
      id: "2",
      messageTypeName: "com.example.OtherMessage",
      exchange: "",
      routingKey: "payments.queue",
    }),
    makeEntry({
      id: "3",
      messageTypeName: "com.example.AnotherMsg",
      exchange: "events.exchange",
      routingKey: "misc.key",
    }),
  ];

  it("returns all entries when both filters are empty", () => {
    const result = filterHistoryEntries(entries, "", "");
    expect(result).toHaveLength(3);
    expect(result).toEqual(entries);
  });

  it("filters by type (case-insensitive substring match)", () => {
    const result = filterHistoryEntries(entries, "MyMessage", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by type case-insensitively (lowercase query)", () => {
    const result = filterHistoryEntries(entries, "mymessage", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty array when typeFilter matches nothing", () => {
    const result = filterHistoryEntries(entries, "xyz", "");
    expect(result).toHaveLength(0);
  });

  it("filters by target matching exchange name", () => {
    const result = filterHistoryEntries(entries, "", "orders");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by target matching routingKey", () => {
    const result = filterHistoryEntries(entries, "", "payments");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("applies both filters with AND logic", () => {
    const result = filterHistoryEntries(entries, "MyMessage", "orders");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty when filters conflict (AND logic with no match)", () => {
    const result = filterHistoryEntries(entries, "MyMessage", "payments");
    expect(result).toHaveLength(0);
  });

  it("returns empty array when entries array is empty", () => {
    const result = filterHistoryEntries([], "anything", "anything");
    expect(result).toHaveLength(0);
  });
});

// ── findReplayTabIndex ────────────────────────────────────────────────────────

describe("findReplayTabIndex", () => {
  it("returns -1 when openFiles is empty", () => {
    const result = findReplayTabIndex([], "com.example.Foo");
    expect(result).toBe(-1);
  });

  it("returns 0 when first file contains the messageTypeName", () => {
    const openFiles = [makeOpenFile("file1.proto", ["com.example.Foo"])];
    const result = findReplayTabIndex(openFiles, "com.example.Foo");
    expect(result).toBe(0);
  });

  it("returns index of second file when first does not match", () => {
    const openFiles = [
      makeOpenFile("file1.proto", ["com.example.Bar"]),
      makeOpenFile("file2.proto", ["com.example.Foo"]),
    ];
    const result = findReplayTabIndex(openFiles, "com.example.Foo");
    expect(result).toBe(1);
  });

  it("returns -1 when no file contains the messageTypeName", () => {
    const openFiles = [
      makeOpenFile("file1.proto", ["com.example.Bar"]),
      makeOpenFile("file2.proto", ["com.example.Baz"]),
    ];
    const result = findReplayTabIndex(openFiles, "com.example.Foo");
    expect(result).toBe(-1);
  });

  it("returns index of FIRST matching file when multiple files match", () => {
    const openFiles = [
      makeOpenFile("file1.proto", ["com.example.Foo"]),
      makeOpenFile("file2.proto", ["com.example.Foo"]),
    ];
    const result = findReplayTabIndex(openFiles, "com.example.Foo");
    expect(result).toBe(0);
  });
});
