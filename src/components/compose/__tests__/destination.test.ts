import { describe, it, expect } from "vitest";
import {
  buildPublishArgs,
  isAuthError,
  isHintExchange,
  routingKeyHint,
} from "@/components/compose/destination";

describe("buildPublishArgs", () => {
  it("PUBL-01: queue mode uses empty string exchange and queue name as routing key", () => {
    const result = buildPublishArgs("queue", "orders", "", "");
    expect(result).toEqual({ exchange: "", routingKey: "orders" });
  });

  it("PUBL-01: exchange must be empty string (not amq.default or default)", () => {
    const result = buildPublishArgs("queue", "my-queue", "", "");
    expect(result.exchange).toBe("");
  });

  it("PUBL-02: exchange mode uses named exchange and explicit routing key", () => {
    const result = buildPublishArgs("exchange", "", "my-exchange", "my.routing.key");
    expect(result).toEqual({ exchange: "my-exchange", routingKey: "my.routing.key" });
  });
});

describe("isAuthError", () => {
  it("recognises the Management API 401 message", () => {
    expect(
      isAuthError("Management API authentication failed: wrong credentials (HTTP 401)")
    ).toBe(true);
  });

  it("treats an unreachable port as a plain failure", () => {
    expect(isAuthError("error sending request for url (http://localhost:15672)")).toBe(false);
  });
});

describe("isHintExchange", () => {
  it("is true for the exchange types that ignore the routing key", () => {
    expect(isHintExchange("fanout")).toBe(true);
    expect(isHintExchange("headers")).toBe(true);
  });

  it("is false for direct and topic exchanges", () => {
    expect(isHintExchange("direct")).toBe(false);
    expect(isHintExchange("topic")).toBe(false);
    expect(isHintExchange("")).toBe(false);
  });
});

describe("routingKeyHint", () => {
  it("explains fanout and headers exchanges", () => {
    expect(routingKeyHint("fanout")).toBe("Routing key is ignored for fanout exchanges.");
    expect(routingKeyHint("headers")).toBe(
      "Headers exchanges route by message headers, not routing key."
    );
  });

  it("has nothing to say about a direct exchange", () => {
    expect(routingKeyHint("direct")).toBeNull();
  });
});
