import { describe, test, expect, vi, beforeEach } from "vitest";
import { generateRandomValues } from "@/lib/randomizer";
import type { FieldSchema, MessageSchema } from "@/lib/types";

function makeField(overrides: Partial<FieldSchema> & Pick<FieldSchema, "name" | "kind">): FieldSchema {
  return {
    label: overrides.name,
    field_number: 1,
    repeated: false,
    ...overrides,
  };
}

function makeMessage(fields: FieldSchema[], name = "TestMsg"): MessageSchema {
  return { name, full_name: name, fields };
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockRestore();
});

describe("generateRandomValues", () => {
  describe("scalar types", () => {
    test("bool returns true or false", () => {
      const msg = makeMessage([makeField({ name: "flag", kind: { type: "scalar", scalar: "bool" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.flag).toBe("boolean");
    });

    test("string returns non-empty alphanumeric string", () => {
      const msg = makeMessage([makeField({ name: "name", kind: { type: "scalar", scalar: "string" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.name).toBe("string");
      expect((result.name as string).length).toBeGreaterThan(0);
      expect(result.name).toMatch(/^[a-z0-9]+$/);
    });

    test("bytes returns hex string", () => {
      const msg = makeMessage([makeField({ name: "data", kind: { type: "scalar", scalar: "bytes" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.data).toBe("string");
      expect(result.data).toMatch(/^[0-9a-f]+$/);
    });

    test("int32 returns a number within int32 range", () => {
      const msg = makeMessage([makeField({ name: "count", kind: { type: "scalar", scalar: "int32" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.count).toBe("number");
      expect(result.count as number).toBeGreaterThanOrEqual(-2147483648);
      expect(result.count as number).toBeLessThanOrEqual(2147483647);
    });

    test("uint32 returns a non-negative number", () => {
      const msg = makeMessage([makeField({ name: "id", kind: { type: "scalar", scalar: "uint32" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.id).toBe("number");
      expect(result.id as number).toBeGreaterThanOrEqual(0);
    });

    test("int64 returns a string representation", () => {
      const msg = makeMessage([makeField({ name: "big", kind: { type: "scalar", scalar: "int64" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.big).toBe("string");
      expect(Number(result.big)).not.toBeNaN();
    });

    test("uint64 returns a non-negative string representation", () => {
      const msg = makeMessage([makeField({ name: "ubig", kind: { type: "scalar", scalar: "uint64" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.ubig).toBe("string");
      expect(Number(result.ubig)).toBeGreaterThanOrEqual(0);
    });

    test("float returns a number", () => {
      const msg = makeMessage([makeField({ name: "ratio", kind: { type: "scalar", scalar: "float" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.ratio).toBe("number");
    });

    test("double returns a number", () => {
      const msg = makeMessage([makeField({ name: "precise", kind: { type: "scalar", scalar: "double" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.precise).toBe("number");
    });

    test("sint32 returns a number", () => {
      const msg = makeMessage([makeField({ name: "v", kind: { type: "scalar", scalar: "sint32" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.v).toBe("number");
    });

    test("sfixed32 returns a number", () => {
      const msg = makeMessage([makeField({ name: "v", kind: { type: "scalar", scalar: "sfixed32" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.v).toBe("number");
    });

    test("fixed32 returns a non-negative number", () => {
      const msg = makeMessage([makeField({ name: "v", kind: { type: "scalar", scalar: "fixed32" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.v).toBe("number");
      expect(result.v as number).toBeGreaterThanOrEqual(0);
    });

    test("sint64 returns a string", () => {
      const msg = makeMessage([makeField({ name: "v", kind: { type: "scalar", scalar: "sint64" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.v).toBe("string");
    });

    test("sfixed64 returns a string", () => {
      const msg = makeMessage([makeField({ name: "v", kind: { type: "scalar", scalar: "sfixed64" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.v).toBe("string");
    });

    test("fixed64 returns a non-negative string", () => {
      const msg = makeMessage([makeField({ name: "v", kind: { type: "scalar", scalar: "fixed64" } })]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.v).toBe("string");
      expect(Number(result.v)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("enum type", () => {
    test("returns a valid enum number from values array", () => {
      const msg = makeMessage([
        makeField({
          name: "status",
          kind: { type: "enum", values: [{ name: "OK", number: 0 }, { name: "ERR", number: 1 }, { name: "WARN", number: 2 }] },
        }),
      ]);
      const result = generateRandomValues(msg, {});
      expect([0, 1, 2]).toContain(result.status);
    });

    test("returns 0 for empty enum values", () => {
      const msg = makeMessage([
        makeField({ name: "empty_enum", kind: { type: "enum", values: [] } }),
      ]);
      const result = generateRandomValues(msg, {});
      expect(result.empty_enum).toBe(0);
    });
  });

  describe("nested message", () => {
    test("recurses and returns object with nested fields", () => {
      const innerMsg: MessageSchema = {
        name: "Inner",
        full_name: "Inner",
        fields: [makeField({ name: "val", kind: { type: "scalar", scalar: "string" } })],
      };
      const outerMsg = makeMessage([
        makeField({ name: "child", kind: { type: "message", full_name: "Inner" } }),
      ]);
      const messageMap = { Inner: innerMsg, TestMsg: outerMsg };
      const result = generateRandomValues(outerMsg, messageMap);
      expect(typeof result.child).toBe("object");
      expect(result.child).toHaveProperty("val");
      expect(typeof (result.child as Record<string, unknown>).val).toBe("string");
    });

    test("returns empty object when message not found in map", () => {
      const msg = makeMessage([
        makeField({ name: "unknown_child", kind: { type: "message", full_name: "Missing" } }),
      ]);
      const result = generateRandomValues(msg, {});
      expect(result.unknown_child).toEqual({});
    });
  });

  describe("depth cap", () => {
    test("returns empty object for nested messages at depth 5", () => {
      const selfRef: MessageSchema = {
        name: "Self",
        full_name: "Self",
        fields: [makeField({ name: "next", kind: { type: "message", full_name: "Self" } })],
      };
      const messageMap = { Self: selfRef };
      const result = generateRandomValues(selfRef, messageMap);

      let current = result as Record<string, unknown>;
      let depth = 0;
      while (current.next && typeof current.next === "object" && Object.keys(current.next as object).length > 0) {
        current = current.next as Record<string, unknown>;
        depth++;
      }
      expect(depth).toBeLessThanOrEqual(5);
      expect(current.next).toEqual({});
    });
  });

  describe("oneof", () => {
    test("picks a branch and sets _selected with branch fields", () => {
      const msg = makeMessage([
        makeField({
          name: "choice",
          kind: {
            type: "oneof",
            branches: [
              [makeField({ name: "a_str", kind: { type: "scalar", scalar: "string" } })],
              [makeField({ name: "b_num", kind: { type: "scalar", scalar: "int32" } })],
            ],
          },
        }),
      ]);
      const result = generateRandomValues(msg, {});
      const choice = result.choice as Record<string, unknown>;
      expect(choice).toHaveProperty("_selected");
      expect(["a_str", "b_num"]).toContain(choice._selected);
      if (choice._selected === "a_str") {
        expect(typeof choice.a_str).toBe("string");
      } else {
        expect(typeof choice.b_num).toBe("number");
      }
    });
  });

  describe("map", () => {
    test("returns array of {key, value} entries", () => {
      const msg = makeMessage([
        makeField({
          name: "tags",
          kind: {
            type: "map",
            key_type: "string",
            value_kind: { type: "scalar", scalar: "int32" },
          },
        }),
      ]);
      const result = generateRandomValues(msg, {});
      const tags = result.tags as Array<{ key: unknown; value: unknown }>;
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(1);
      expect(tags.length).toBeLessThanOrEqual(3);
      for (const entry of tags) {
        expect(entry).toHaveProperty("key");
        expect(entry).toHaveProperty("value");
        expect(typeof entry.key).toBe("string");
        expect(typeof entry.value).toBe("number");
      }
    });
  });

  describe("repeated", () => {
    test("returns array of 1-3 items", () => {
      const msg = makeMessage([
        makeField({ name: "items", kind: { type: "scalar", scalar: "string" }, repeated: true }),
      ]);
      const result = generateRandomValues(msg, {});
      const items = result.items as unknown[];
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.length).toBeLessThanOrEqual(3);
      for (const item of items) {
        expect(typeof item).toBe("string");
      }
    });
  });

  describe("dirty field skip", () => {
    test("fields in dirtyFields are not overwritten", () => {
      const msg = makeMessage([
        makeField({ name: "keep", kind: { type: "scalar", scalar: "string" } }),
        makeField({ name: "fill", kind: { type: "scalar", scalar: "string" } }),
      ]);
      const result = generateRandomValues(msg, {}, { keep: true });
      expect(result).not.toHaveProperty("keep");
      expect(result).toHaveProperty("fill");
    });
  });

  describe("well-known types", () => {
    test("Timestamp returns ISO-like string", () => {
      const msg = makeMessage([
        makeField({ name: "created_at", kind: { type: "well_known", wkt: "Timestamp" } }),
      ]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.created_at).toBe("string");
      expect(new Date(result.created_at as string).toString()).not.toBe("Invalid Date");
    });

    test("Duration returns seconds string ending with 's'", () => {
      const msg = makeMessage([
        makeField({ name: "timeout", kind: { type: "well_known", wkt: "Duration" } }),
      ]);
      const result = generateRandomValues(msg, {});
      expect(typeof result.timeout).toBe("string");
      expect(result.timeout).toMatch(/^\d+s$/);
    });
  });
});
