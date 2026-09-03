import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { createDeliveryBatcher, FEED_FLUSH_MS, FEED_MAX_BATCH } from "@/lib/feedBatcher";
import type { DrainResult } from "@/lib/types";

const delivery = (routingKey: string, isTerminal = false): DrainResult => ({
  routingKey,
  exchange: "",
  contentType: null,
  timestamp: null,
  decoded: null,
  hexString: "0a",
  error: null,
  decodedAs: null,
  isTerminal,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createDeliveryBatcher", () => {
  test("coalesces deliveries into one flush after the interval", () => {
    const onFlush = vi.fn();
    const batcher = createDeliveryBatcher({ onFlush, onTerminal: vi.fn() });
    batcher.push(delivery("a"));
    batcher.push(delivery("b"));
    batcher.push(delivery("c"));
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FEED_FLUSH_MS);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].map((m: DrainResult) => m.routingKey)).toEqual(["a", "b", "c"]);
  });

  test("flushes early once the batch reaches the size cap", () => {
    const onFlush = vi.fn();
    const batcher = createDeliveryBatcher({ onFlush, onTerminal: vi.fn() });
    for (let i = 0; i < FEED_MAX_BATCH; i++) batcher.push(delivery(String(i)));
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0]).toHaveLength(FEED_MAX_BATCH);
  });

  test("a terminal delivery flushes immediately, in order, and reports termination", () => {
    const onFlush = vi.fn();
    const onTerminal = vi.fn();
    const batcher = createDeliveryBatcher({ onFlush, onTerminal });
    batcher.push(delivery("a"));
    batcher.push(delivery("end", true));
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].map((m: DrainResult) => m.routingKey)).toEqual(["a", "end"]);
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  test("dispose flushes what is pending and ignores later pushes", () => {
    const onFlush = vi.fn();
    const batcher = createDeliveryBatcher({ onFlush, onTerminal: vi.fn() });
    batcher.push(delivery("a"));
    batcher.dispose();
    expect(onFlush).toHaveBeenCalledTimes(1);
    batcher.push(delivery("late"));
    vi.advanceTimersByTime(FEED_FLUSH_MS * 2);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });
});
