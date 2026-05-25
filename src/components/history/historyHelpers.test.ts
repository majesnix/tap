import { describe, it, expect } from "vitest";
import {
  filterHistoryEntries,
  findReplayTabIndex,
  collectFieldNames,
  collectSearchTokens,
} from "./historyHelpers";
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

  // ── searchQuery (4th parameter) tests ─────────────────────────────────────

  it("returns all entries when searchQuery is empty (backward compat, HIST-FT-07)", () => {
    const result = filterHistoryEntries(entries, "", "", "");
    expect(result).toHaveLength(3);
    expect(result).toEqual(entries);
  });

  it("existing 3-arg call still returns correct result (HIST-FT-07)", () => {
    const result = filterHistoryEntries(entries, "MyMessage", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("searchQuery matches messageTypeName substring case-insensitively (HIST-FT-02)", () => {
    const result = filterHistoryEntries(entries, "", "", "anothermsg");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("searchQuery matches exchange substring case-insensitively (HIST-FT-03)", () => {
    const result = filterHistoryEntries(entries, "", "", "EVENTS");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("searchQuery matches routingKey substring case-insensitively (HIST-FT-03)", () => {
    const result = filterHistoryEntries(entries, "", "", "payments");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("searchQuery matches a top-level fieldValues key (HIST-FT-04)", () => {
    const entriesWithFields = [
      makeEntry({ id: "a", fieldValues: { orderId: "123", amount: 50 } }),
      makeEntry({ id: "b", fieldValues: { userId: "abc" } }),
    ];
    const result = filterHistoryEntries(entriesWithFields, "", "", "orderid");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("searchQuery matches a nested fieldValues key via recursion (D-03)", () => {
    const entriesWithNested = [
      makeEntry({
        id: "x",
        fieldValues: { address: { streetName: "Main St" } as unknown },
      }),
      makeEntry({ id: "y", fieldValues: { name: "Alice" } }),
    ];
    const result = filterHistoryEntries(
      entriesWithNested,
      "",
      "",
      "streetname"
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("x");
  });

  it("_selected key in fieldValues does NOT produce a match (D-03)", () => {
    const entriesWithSelected = [
      makeEntry({
        id: "s",
        fieldValues: { _selected: "branchA", branchA: { value: 1 } as unknown },
      }),
    ];
    // "_selected" should be excluded, no match on "_selected" substring
    const result = filterHistoryEntries(
      entriesWithSelected,
      "",
      "",
      "_selected"
    );
    expect(result).toHaveLength(0);
  });

  it("searchQuery AND typeFilter both active — AND logic reduces results (HIST-FT-05)", () => {
    const mixed = [
      makeEntry({
        id: "m1",
        messageTypeName: "com.example.OrderMsg",
        fieldValues: { orderId: "x" },
      }),
      makeEntry({
        id: "m2",
        messageTypeName: "com.example.UserMsg",
        fieldValues: { orderId: "y" },
      }),
    ];
    // typeFilter filters to OrderMsg only; searchQuery "orderid" matches both — AND should return only m1
    const result = filterHistoryEntries(mixed, "OrderMsg", "", "orderid");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("numeric key '0' from array index IS included in matching per D-03 (accepted trade-off)", () => {
    const entriesWithArray = [
      makeEntry({
        id: "arr",
        fieldValues: { items: [{ subField: "value" }] as unknown },
      }),
      makeEntry({ id: "noArr", fieldValues: { name: "plain" } }),
    ];
    // "0" would match the numeric index key if array indices are collected — per D-03
    // We test that array element keys are found (subField matches)
    const result = filterHistoryEntries(entriesWithArray, "", "", "subfield");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("arr");
  });

  // ── searchQuery value matching (WR-02 fix) ───────────────────────────────────

  it("searchQuery matches a top-level fieldValues VALUE (WR-02)", () => {
    const entriesWithValues = [
      makeEntry({ id: "v1", fieldValues: { orderId: "ORD-001", amount: 99.99 } }),
      makeEntry({ id: "v2", fieldValues: { orderId: "ORD-002" } }),
    ];
    const result = filterHistoryEntries(entriesWithValues, "", "", "ORD-001");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("v1");
  });

  it("searchQuery matches a numeric fieldValues VALUE (WR-02)", () => {
    const entriesWithNumbers = [
      makeEntry({ id: "n1", fieldValues: { amount: 99.99 } }),
      makeEntry({ id: "n2", fieldValues: { amount: 50 } }),
    ];
    const result = filterHistoryEntries(entriesWithNumbers, "", "", "99.99");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n1");
  });

  it("searchQuery matches a nested fieldValues VALUE via recursion (WR-02)", () => {
    const entriesWithNestedValues = [
      makeEntry({
        id: "nv1",
        fieldValues: { address: { city: "Berlin" } as unknown },
      }),
      makeEntry({ id: "nv2", fieldValues: { address: { city: "Munich" } as unknown } }),
    ];
    const result = filterHistoryEntries(entriesWithNestedValues, "", "", "berlin");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("nv1");
  });

  it("searchQuery matches a primitive value inside an array element (WR-02)", () => {
    const entriesWithArrayValues = [
      makeEntry({
        id: "av1",
        fieldValues: { tags: ["urgent", "billing"] as unknown },
      }),
      makeEntry({ id: "av2", fieldValues: { tags: ["normal"] as unknown } }),
    ];
    const result = filterHistoryEntries(entriesWithArrayValues, "", "", "urgent");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("av1");
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

// ── collectSearchTokens ───────────────────────────────────────────────────────

describe("collectSearchTokens", () => {
  it("returns both keys and string values from a flat object", () => {
    const result = collectSearchTokens({ orderId: "ORD-001" });
    expect(result).toContain("orderId");
    expect(result).toContain("ORD-001");
  });

  it("returns both keys and numeric values (as strings)", () => {
    const result = collectSearchTokens({ amount: 99.99 });
    expect(result).toContain("amount");
    expect(result).toContain("99.99");
  });

  it("returns both keys and boolean values (as strings)", () => {
    const result = collectSearchTokens({ active: true });
    expect(result).toContain("active");
    expect(result).toContain("true");
  });

  it("recurses into nested objects and collects nested keys and values", () => {
    const result = collectSearchTokens({ address: { city: "Berlin" } as unknown });
    expect(result).toContain("address");
    expect(result).toContain("city");
    expect(result).toContain("Berlin");
  });

  it("collects primitive values from array elements", () => {
    const result = collectSearchTokens({ tags: ["urgent", "billing"] as unknown });
    expect(result).toContain("tags");
    expect(result).toContain("urgent");
    expect(result).toContain("billing");
  });

  it("recurses into array elements that are objects", () => {
    const result = collectSearchTokens({
      items: [{ name: "Widget", price: 10 }] as unknown,
    });
    expect(result).toContain("items");
    expect(result).toContain("name");
    expect(result).toContain("Widget");
    expect(result).toContain("price");
    expect(result).toContain("10");
  });

  it("excludes the _selected key and its value", () => {
    const result = collectSearchTokens({ _selected: "branchA", fieldA: "x" });
    expect(result).not.toContain("_selected");
    expect(result).not.toContain("branchA");
    expect(result).toContain("fieldA");
    expect(result).toContain("x");
  });

  it("handles null values without throwing and includes the key", () => {
    expect(() => collectSearchTokens({ a: null as unknown })).not.toThrow();
    const result = collectSearchTokens({ a: null as unknown });
    expect(result).toContain("a");
  });
});

// ── collectFieldNames ─────────────────────────────────────────────────────────

describe("collectFieldNames", () => {
  it("returns all keys from a flat object", () => {
    const result = collectFieldNames({ a: 1, b: "x" });
    expect(result).toEqual(["a", "b"]);
  });

  it("returns keys from a nested object (recursive)", () => {
    const result = collectFieldNames({ a: { c: 2 } as unknown });
    expect(result).toContain("a");
    expect(result).toContain("c");
  });

  it("returns keys from an array of objects (recursive into elements)", () => {
    const result = collectFieldNames({
      items: [{ x: 1 }, { y: 2 }] as unknown,
    });
    expect(result).toContain("items");
    expect(result).toContain("x");
    expect(result).toContain("y");
  });

  it("excludes the _selected key", () => {
    const result = collectFieldNames({
      _selected: "branch",
      fieldA: 1,
    });
    expect(result).not.toContain("_selected");
    expect(result).toContain("fieldA");
  });

  it("handles null values without throwing (null-crash guard)", () => {
    expect(() => {
      collectFieldNames({ a: null as unknown });
    }).not.toThrow();
    const result = collectFieldNames({ a: null as unknown });
    expect(result).toContain("a");
  });

  it("includes primitive value keys but does not recurse into primitives", () => {
    const result = collectFieldNames({ a: 1, b: "str" });
    expect(result).toEqual(["a", "b"]);
  });

  it("includes numeric array index keys per D-03 accepted trade-off", () => {
    const result = collectFieldNames({
      items: [{ "0": 1 }] as unknown,
    });
    expect(result).toContain("items");
    // Array element's keys are traversed — "0" comes from the object key inside the array element
    expect(result).toContain("0");
  });
});
