import { describe, it, expect } from "vitest";
import {
  findReplayTabIndex,
  collectFieldNames,
  collectSearchTokens,
} from "./historyHelpers";
import type { ProtoSchema } from "@/lib/types";

// ── Test helpers ─────────────────────────────────────────────────────────────

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
      enums: [],
    },
  };
}

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
