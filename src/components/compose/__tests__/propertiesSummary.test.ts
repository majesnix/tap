import { describe, it, expect } from "vitest";
import { summarizeProperties } from "@/components/compose/propertiesSummary";
import { INITIAL_PROPERTIES } from "@/stores/useAmqpStore";

describe("summarizeProperties", () => {
  it("says defaults when nothing was changed", () => {
    expect(summarizeProperties({ ...INITIAL_PROPERTIES, headers: [] })).toEqual([
      { text: "defaults" },
    ]);
  });

  it("lists delivery, reply-to and header count", () => {
    const parts = summarizeProperties({
      ...INITIAL_PROPERTIES,
      replyTo: "orders.reply",
      headers: [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ],
    });
    expect(parts.map((p) => p.text)).toEqual([
      "persistent",
      "reply-to",
      "orders.reply",
      "2 headers",
    ]);
    expect(parts[2].mono).toBe(true);
  });

  it("mentions transient delivery, ttl and a non-default content type", () => {
    const parts = summarizeProperties({
      ...INITIAL_PROPERTIES,
      contentType: "application/x-protobuf",
      deliveryMode: 1,
      ttl: 500,
      headers: [],
    });
    expect(parts.map((p) => p.text)).toEqual([
      "application/x-protobuf",
      "transient",
      "ttl 500 ms",
    ]);
    expect(parts[0].mono).toBe(true);
  });

  it("names the correlation id and uses the singular for one header", () => {
    const parts = summarizeProperties({
      ...INITIAL_PROPERTIES,
      correlationId: "req-7c1e",
      headers: [{ key: "x-tenant", value: "acme" }],
    });
    expect(parts.map((p) => p.text)).toEqual(["persistent", "corr", "req-7c1e", "1 header"]);
  });
});
