import { describe, it, expect } from "vitest";
import { describeBlockFit, previewJson } from "@/components/blocks/blockFit";
import type { MessageSchema, FieldSchema } from "@/lib/types";

function f(name: string): FieldSchema {
  return { name, label: name, field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: false };
}

const order: MessageSchema = {
  name: "Order",
  full_name: "p.Order",
  fields: [f("order_id"), f("customer_id"), f("status")],
};

describe("describeBlockFit", () => {
  it("returns null without a message or for non-object content", () => {
    expect(describeBlockFit('{"a":1}', null)).toBeNull();
    expect(describeBlockFit("[1]", order)).toBeNull();
    expect(describeBlockFit("{", order)).toBeNull();
    expect(describeBlockFit("{}", order)).toBeNull();
  });

  it("reports a full fit", () => {
    expect(describeBlockFit('{"order_id":"a","status":2}', order)).toEqual({
      tone: "success",
      label: "fits Order · 2 of 3 fields",
    });
  });

  it("reports a partial fit and no fit", () => {
    expect(describeBlockFit('{"order_id":"a","nope":1}', order)).toEqual({
      tone: "warning",
      label: "partly fits Order · 1 of 2 keys",
    });
    expect(describeBlockFit('{"nope":1}', order)).toBeNull();
  });
});

describe("previewJson", () => {
  it("previews JSON on one line", () => {
    expect(previewJson('{\n  "a": 1\n}')).toBe('{ "a": 1 }');
    expect(previewJson(`{"k":"${"x".repeat(80)}"}`).endsWith("…")).toBe(true);
  });
});
