import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { FeedMessage } from "@/lib/types";
import { base64ByteLength } from "@/lib/bytes";
import { collectSearchTokens } from "@/components/history/historyHelpers";
import type { TagTone } from "@/components/common/Tag";

/**
 * Pure model behind the Activity panel: history entries (sent) and feed messages
 * (received) merged into one timeline, with replies grouped under their request.
 */

export type ActivityFilter = "all" | "sent" | "received";
export type SentStatus = "ack" | "nack" | "returned" | "timeout" | "sent" | "failed";
export type ReceivedStatus = "decoded" | "no-decoder" | "error";
export type ActivityStatus = SentStatus | ReceivedStatus;

export interface SentItem {
  kind: "sent";
  id: string;
  at: number;
  typeName: string;
  target: string;
  sizeBytes: number;
  status: SentStatus;
  correlationId: string | null;
  replyTo: string | null;
  entry: HistoryEntry;
}

export interface ReceivedItem {
  kind: "received";
  id: string;
  at: number;
  typeName: string;
  target: string;
  sizeBytes: number;
  status: ReceivedStatus;
  correlationId: string | null;
  message: FeedMessage;
}

export type ActivityItem = SentItem | ReceivedItem;

export interface ActivityGroup {
  item: ActivityItem;
  reply: ReceivedItem | null;
}

/** How long after a send a message on its reply-to queue still counts as its reply. */
export const REPLY_WINDOW_MS = 30_000;

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  ack: "ACK",
  nack: "NACK",
  returned: "RETURNED",
  timeout: "TIMEOUT",
  sent: "SENT",
  failed: "FAILED",
  decoded: "DECODED",
  "no-decoder": "NO DECODER",
  error: "ERROR",
};

export const STATUS_TONE: Record<ActivityStatus, TagTone> = {
  ack: "success",
  sent: "success",
  nack: "danger",
  failed: "danger",
  timeout: "danger",
  error: "danger",
  returned: "warning",
  "no-decoder": "warning",
  decoded: "teal",
};

export function shortTypeName(fullName: string): string {
  return fullName.split(".").pop() || fullName || "unknown";
}

export function describeTarget(exchange: string, routingKey: string): string {
  return exchange ? `${exchange} → ${routingKey}` : routingKey;
}

export function hexByteLength(hex: string): number {
  return Math.floor(hex.replace(/\s+/g, "").length / 2);
}

export function sentItem(entry: HistoryEntry): SentItem {
  const parsed = Date.parse(entry.timestamp);
  return {
    kind: "sent",
    id: entry.id,
    at: Number.isNaN(parsed) ? 0 : parsed,
    typeName: shortTypeName(entry.messageTypeName),
    target: describeTarget(entry.exchange, entry.routingKey),
    sizeBytes: base64ByteLength(entry.payloadBase64),
    status: entry.status === "failed" ? "failed" : (entry.outcome ?? "sent"),
    correlationId: entry.correlationId ?? null,
    replyTo: entry.replyTo ?? null,
    entry,
  };
}

export function receivedItem(message: FeedMessage): ReceivedItem {
  const status: ReceivedStatus = message.error
    ? "error"
    : message.decodedAs
      ? "decoded"
      : "no-decoder";
  return {
    kind: "received",
    id: message.id,
    at: message.receivedAt,
    typeName: message.decodedAs ? shortTypeName(message.decodedAs) : "unknown",
    target: describeTarget(message.exchange, message.routingKey),
    sizeBytes: hexByteLength(message.hexString),
    status,
    correlationId: message.correlationId,
    message,
  };
}

/** Merged timeline, newest first. */
export function buildActivity(entries: HistoryEntry[], messages: FeedMessage[]): ActivityItem[] {
  return [...entries.map(sentItem), ...messages.map(receivedItem)].sort((a, b) => b.at - a.at);
}

/**
 * A correlation id set on both sides is authoritative — it either matches or the
 * two are unrelated. Only when one side lacks it do we fall back to the reply-to
 * queue plus a time window.
 */
function isReplyTo(sent: SentItem, received: ReceivedItem, windowMs: number): boolean {
  if (sent.correlationId && received.correlationId) {
    return sent.correlationId === received.correlationId;
  }
  return (
    sent.replyTo !== null &&
    sent.replyTo === received.message.routingKey &&
    received.at - sent.at <= windowMs
  );
}

export function groupReplies(items: ActivityItem[], windowMs = REPLY_WINDOW_MS): ActivityGroup[] {
  // O(n·m) by the nested find below, but bounded: history is capped at 100 entries
  // (useHistoryStore MAX_ENTRIES) and the received feed at 500 (useResponseStore
  // FEED_MAX_SIZE), so the worst case is a few tens of thousands of comparisons.
  const replies = new Map<string, ReceivedItem>(); // sent id → its reply
  const paired = new Set<string>();
  for (const received of items) {
    if (received.kind !== "received") continue;
    // items are newest first, so the first match is the newest eligible send.
    const match = items.find(
      (s): s is SentItem =>
        s.kind === "sent" && s.at <= received.at && !replies.has(s.id) && isReplyTo(s, received, windowMs)
    );
    if (match) {
      replies.set(match.id, received);
      paired.add(received.id);
    }
  }
  return items
    .filter((i) => !paired.has(i.id))
    .map((item) => ({ item, reply: item.kind === "sent" ? (replies.get(item.id) ?? null) : null }));
}

function matches(item: ActivityItem, q: string): boolean {
  const fields = [item.typeName, item.target, STATUS_LABEL[item.status]];
  if (item.kind === "sent") {
    fields.push(...collectSearchTokens(item.entry.fieldValues));
  } else {
    if (item.message.decoded) fields.push(...collectSearchTokens(item.message.decoded));
    if (item.message.contentType) fields.push(item.message.contentType);
  }
  return fields.some((f) => f.toLowerCase().includes(q));
}

export function activityGroups(
  items: ActivityItem[],
  filter: ActivityFilter,
  query: string,
  windowMs = REPLY_WINDOW_MS
): ActivityGroup[] {
  const q = query.trim().toLowerCase();
  const groups: ActivityGroup[] =
    filter === "received"
      ? items.map((item) => ({ item, reply: null }))
      : groupReplies(items, windowMs);
  return groups
    .filter(({ item }) => filter === "all" || item.kind === filter)
    .map((g) => (filter === "sent" ? { ...g, reply: null } : g))
    .filter((g) => !q || matches(g.item, q) || (g.reply !== null && matches(g.reply, q)));
}

/** Local wall clock as HH:MM:SS.mmm — built by hand so midnight never renders as 24. */
export function formatClock(at: number): string {
  const d = new Date(at);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Local wall clock as HH:MM — the compact form used by plan rows and the run bar. */
export function formatClockShort(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const KB = 1024;
const MB = 1024 * 1024;

export function formatBytes(n: number): string {
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  return `${(n / MB).toFixed(1)} MB`;
}

function isSameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export function summarizeActivity(items: ActivityItem[], now = Date.now()): string {
  const sentCount = items.filter((i) => i.kind === "sent").length;
  const base = `${sentCount} sent · ${items.length - sentCount} received`;
  // An empty timeline is not "today" — every() is vacuously true on it.
  const allToday = items.length > 0 && items.every((i) => isSameDay(i.at, now));
  return allToday ? `${base} · today` : base;
}
