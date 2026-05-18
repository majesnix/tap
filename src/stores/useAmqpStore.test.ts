import { describe, beforeEach, test, expect, vi } from "vitest";
import { useAmqpStore } from "./useAmqpStore";

// Mock sonner toast for the header cap test
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Reset store before each test
beforeEach(() => {
  useAmqpStore.getState().reset();
  vi.clearAllMocks();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  test("contentType is 'application/octet-stream' (D-04 default)", () => {
    const s = useAmqpStore.getState();
    expect(s.properties.contentType).toBe("application/octet-stream");
  });

  test("deliveryMode is 2 (persistent, D-04 default)", () => {
    const s = useAmqpStore.getState();
    expect(s.properties.deliveryMode).toBe(2);
  });

  test("ttl is null initially", () => {
    expect(useAmqpStore.getState().properties.ttl).toBeNull();
  });

  test("correlationId is null initially", () => {
    expect(useAmqpStore.getState().properties.correlationId).toBeNull();
  });

  test("replyTo is null initially", () => {
    expect(useAmqpStore.getState().properties.replyTo).toBeNull();
  });

  test("headers is empty array initially", () => {
    expect(useAmqpStore.getState().properties.headers).toEqual([]);
  });
});

// ── setProperties ─────────────────────────────────────────────────────────────

describe("setProperties", () => {
  test("setProperties({deliveryMode: 2}) → store.properties.deliveryMode === 2", () => {
    useAmqpStore.getState().setProperties({ deliveryMode: 2 });
    expect(useAmqpStore.getState().properties.deliveryMode).toBe(2);
  });

  test("setProperties({contentType: 'application/json'}) → store.properties.contentType === 'application/json'", () => {
    useAmqpStore.getState().setProperties({ contentType: "application/json" });
    expect(useAmqpStore.getState().properties.contentType).toBe(
      "application/json"
    );
  });

  test("partial merge: only provided fields change", () => {
    useAmqpStore.getState().setProperties({ correlationId: "abc-123" });
    const s = useAmqpStore.getState();
    // correlationId updated
    expect(s.properties.correlationId).toBe("abc-123");
    // others unchanged
    expect(s.properties.contentType).toBe("application/octet-stream");
    expect(s.properties.deliveryMode).toBe(2);
    expect(s.properties.ttl).toBeNull();
  });
});

// ── addHeader ─────────────────────────────────────────────────────────────────

describe("addHeader", () => {
  test("addHeader({key:'x-trace',value:'abc'}) → headers array has one entry", () => {
    useAmqpStore.getState().addHeader({ key: "x-trace", value: "abc" });
    const headers = useAmqpStore.getState().properties.headers;
    expect(headers).toHaveLength(1);
    expect(headers[0]).toEqual({ key: "x-trace", value: "abc" });
  });

  test("addHeader appends to existing headers immutably", () => {
    useAmqpStore.getState().addHeader({ key: "a", value: "1" });
    useAmqpStore.getState().addHeader({ key: "b", value: "2" });
    const headers = useAmqpStore.getState().properties.headers;
    expect(headers).toHaveLength(2);
    expect(headers[1]).toEqual({ key: "b", value: "2" });
  });

  test("T-03-02-01: addHeader with empty key is rejected (no-op)", () => {
    useAmqpStore.getState().addHeader({ key: "", value: "somevalue" });
    expect(useAmqpStore.getState().properties.headers).toHaveLength(0);
  });

  test("T-03-02-01: addHeader with whitespace-only key is rejected (no-op)", () => {
    useAmqpStore.getState().addHeader({ key: "   ", value: "somevalue" });
    expect(useAmqpStore.getState().properties.headers).toHaveLength(0);
  });

  test("T-03-02-02: cap headers at 20 — 21st add is rejected", () => {
    for (let i = 0; i < 20; i++) {
      useAmqpStore.getState().addHeader({ key: `key-${i}`, value: `val-${i}` });
    }
    expect(useAmqpStore.getState().properties.headers).toHaveLength(20);
    // Attempt to add 21st
    useAmqpStore.getState().addHeader({ key: "key-extra", value: "v" });
    expect(useAmqpStore.getState().properties.headers).toHaveLength(20);
  });
});

// ── removeHeader ──────────────────────────────────────────────────────────────

describe("removeHeader", () => {
  test("removeHeader(0) when headers.length=1 → headers=[]", () => {
    useAmqpStore.getState().addHeader({ key: "x-trace", value: "abc" });
    useAmqpStore.getState().removeHeader(0);
    expect(useAmqpStore.getState().properties.headers).toHaveLength(0);
  });

  test("removeHeader(1) removes the correct element by index", () => {
    useAmqpStore.getState().addHeader({ key: "a", value: "1" });
    useAmqpStore.getState().addHeader({ key: "b", value: "2" });
    useAmqpStore.getState().addHeader({ key: "c", value: "3" });
    useAmqpStore.getState().removeHeader(1);
    const headers = useAmqpStore.getState().properties.headers;
    expect(headers).toHaveLength(2);
    expect(headers[0]).toEqual({ key: "a", value: "1" });
    expect(headers[1]).toEqual({ key: "c", value: "3" });
  });
});

// ── setHeaders ────────────────────────────────────────────────────────────────

describe("setHeaders", () => {
  test("setHeaders replaces the entire headers array", () => {
    useAmqpStore.getState().addHeader({ key: "old", value: "v" });
    useAmqpStore.getState().setHeaders([{ key: "new", value: "n" }]);
    const headers = useAmqpStore.getState().properties.headers;
    expect(headers).toHaveLength(1);
    expect(headers[0]).toEqual({ key: "new", value: "n" });
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe("reset", () => {
  test("reset() → back to all defaults (contentType 'application/octet-stream', deliveryMode 2, others null/empty)", () => {
    useAmqpStore.getState().setProperties({
      contentType: "application/json",
      deliveryMode: 1,
      ttl: 5000,
      correlationId: "corr-id",
      replyTo: "reply-queue",
    });
    useAmqpStore.getState().addHeader({ key: "x-custom", value: "val" });
    useAmqpStore.getState().reset();
    const s = useAmqpStore.getState();
    expect(s.properties.contentType).toBe("application/octet-stream");
    expect(s.properties.deliveryMode).toBe(2);
    expect(s.properties.ttl).toBeNull();
    expect(s.properties.correlationId).toBeNull();
    expect(s.properties.replyTo).toBeNull();
    expect(s.properties.headers).toEqual([]);
  });
});
