import type { DrainResult } from "@/lib/types";

/** Longest a delivery waits in the buffer before it reaches the store. */
export const FEED_FLUSH_MS = 80;
/** Buffer size that triggers an early flush. */
export const FEED_MAX_BATCH = 50;

interface BatcherOptions {
  /** Receives every buffered delivery, oldest first, as one store update. */
  onFlush: (batch: DrainResult[]) => void;
  /** Runs after the flush that carried a terminal delivery. */
  onTerminal: () => void;
  flushMs?: number;
  maxBatch?: number;
}

export interface DeliveryBatcher {
  push: (delivery: DrainResult) => void;
  /** Flush what is pending and stop accepting deliveries. */
  dispose: () => void;
}

/**
 * Coalesces the one-IPC-message-per-delivery stream of a subscription into a few
 * store updates per second. Without it, a busy queue re-renders the feed for every
 * single message. A terminal delivery (consumer ended) flushes right away so the
 * session state follows without delay.
 */
export function createDeliveryBatcher({
  onFlush,
  onTerminal,
  flushMs = FEED_FLUSH_MS,
  maxBatch = FEED_MAX_BATCH,
}: BatcherOptions): DeliveryBatcher {
  let buffer: DrainResult[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    const terminal = batch.some((d) => d.isTerminal);
    onFlush(batch);
    if (terminal) onTerminal();
  };

  return {
    push: (delivery) => {
      if (disposed) return;
      buffer.push(delivery);
      if (delivery.isTerminal || buffer.length >= maxBatch) {
        flush();
        return;
      }
      if (timer === null) timer = setTimeout(flush, flushMs);
    },
    dispose: () => {
      flush();
      disposed = true;
    },
  };
}
