import {
  containerColumns,
  fieldMeta,
  isFlatMessage,
  summarizeValues,
  tableColumns,
  typeLabel,
} from "../fields/fieldMeta";
import type { FieldKind, FieldSchema, MessageSchema } from "@/lib/types";

function f(name: string, kind: FieldKind, overrides: Partial<FieldSchema> = {}): FieldSchema {
  return {
    name,
    label: name,
    field_number: 1,
    kind,
    repeated: false,
    ...overrides,
  };
}

// ─── fieldMeta / typeLabel ───────────────────────────────────────────────────

it("formats the type and number", () => {
  expect(
    fieldMeta({ name: "id", label: "Id", field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: false })
  ).toBe("string · 1");
  expect(
    fieldMeta({ name: "s", label: "S", field_number: 0, kind: { type: "enum", values: [] }, repeated: false })
  ).toBe("enum");
});

it("labels a message field by its short type name", () => {
  expect(typeLabel(f("addr", { type: "message", full_name: "example.order.Address" }))).toBe("Address");
});

it("labels a oneof field as 'oneof'", () => {
  expect(typeLabel(f("payment", { type: "oneof", branches: [] }))).toBe("oneof");
});

it("labels a well_known field by its wkt name", () => {
  expect(typeLabel(f("ts", { type: "well_known", wkt: "Timestamp" }))).toBe("Timestamp");
});

it("labels a map field as map<key, value>", () => {
  expect(
    typeLabel(f("labels", { type: "map", key_type: "string", value_kind: { type: "scalar", scalar: "int32" } }))
  ).toBe("map<string, int32>");
  expect(
    typeLabel(
      f("nested", {
        type: "map",
        key_type: "string",
        value_kind: { type: "message", full_name: "p.Address" },
      })
    )
  ).toBe("map<string, Address>");
});

// ─── isFlatMessage ───────────────────────────────────────────────────────────

it("detects flat messages", () => {
  const flat: MessageSchema = {
    name: "LineItem",
    full_name: "p.LineItem",
    fields: [f("sku", { type: "scalar", scalar: "string" }), f("qty", { type: "scalar", scalar: "int32" })],
  };
  expect(isFlatMessage(flat)).toBe(true);
  expect(
    isFlatMessage({ ...flat, fields: [...flat.fields, f("addr", { type: "message", full_name: "p.Address" })] })
  ).toBe(false);
  expect(
    isFlatMessage({
      ...flat,
      fields: Array.from({ length: 6 }, (_, i) => f(`f${i}`, { type: "scalar", scalar: "string" })),
    })
  ).toBe(false);
});

it("rejects a message with zero fields", () => {
  expect(isFlatMessage({ name: "Empty", full_name: "p.Empty", fields: [] })).toBe(false);
});

it("rejects a message with a repeated field", () => {
  const withRepeated: MessageSchema = {
    name: "Bag",
    full_name: "p.Bag",
    fields: [f("tags", { type: "scalar", scalar: "string" }, { repeated: true })],
  };
  expect(isFlatMessage(withRepeated)).toBe(false);
});

// ─── summarizeValues ─────────────────────────────────────────────────────────

it("summarizes values on one line", () => {
  expect(
    summarizeValues({ street: "12 Hafenstrasse", city: "Hamburg", zip: 20457, tags: ["a"], geo: { lat: 1 } })
  ).toBe("12 Hafenstrasse, Hamburg, 20457, [1], {…}");
  expect(summarizeValues({})).toBe("empty");
});

it("treats null, undefined and non-objects as empty", () => {
  expect(summarizeValues(null)).toBe("empty");
  expect(summarizeValues(undefined)).toBe("empty");
  expect(summarizeValues("not an object")).toBe("empty");
});

// ─── tableColumns / containerColumns ────────────────────────────────────────

it("builds table columns: 28px index, per-field track, 28px trash", () => {
  const message: MessageSchema = {
    name: "LineItem",
    full_name: "p.LineItem",
    fields: [
      f("product_id", { type: "scalar", scalar: "string" }),
      f("name", { type: "scalar", scalar: "string" }),
      f("quantity", { type: "scalar", scalar: "int32" }),
      f("active", { type: "scalar", scalar: "bool" }),
    ],
  };
  expect(tableColumns(message)).toBe("28px 3fr 3fr 2fr 1fr 28px");
});

it("builds container columns with a wide first track for a leading string field", () => {
  const address: MessageSchema = {
    name: "Address",
    full_name: "p.Address",
    fields: [
      f("street", { type: "scalar", scalar: "string" }),
      f("city", { type: "scalar", scalar: "string" }),
      f("state", { type: "scalar", scalar: "string" }),
      f("zip", { type: "scalar", scalar: "string" }),
      f("country", { type: "scalar", scalar: "string" }),
    ],
  };
  expect(containerColumns(address)).toBe("2fr 1fr 1fr 1fr 1fr");
});

it("builds equal-width container columns when the first field is not a string", () => {
  const stats: MessageSchema = {
    name: "Stats",
    full_name: "p.Stats",
    fields: [f("count", { type: "scalar", scalar: "int32" }), f("active", { type: "scalar", scalar: "bool" })],
  };
  expect(containerColumns(stats)).toBe("1fr 1fr");
});
