import { describe, it, expect } from "vitest";
import {
  buildActivity,
  groupReplies,
  activityGroups,
  formatBytes,
  formatClock,
  summarizeActivity,
  shortTypeName,
  describeTarget,
  hexByteLength,
  STATUS_LABEL,
  STATUS_TONE,
} from "../activityModel";
import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { FeedMessage } from "@/lib/types";

const sent = (o: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "s1",
  timestamp: "2026-09-03T14:02:11.412Z",
  messageTypeName: "example.Order",
  exchange: "",
  routingKey: "orders",
  status: "sent",
  fieldValues: { order_id: "ord_1" },
  payloadBase64: "CgU=",
  outcome: "ack",
  ...o,
});

const recv = (o: Partial<FeedMessage> = {}): FeedMessage => ({
  id: "r1",
  routingKey: "orders.reply",
  exchange: "",
  contentType: null,
  correlationId: null,
  timestamp: null,
  receivedAt: Date.parse("2026-09-03T14:02:11.690Z"),
  decoded: { ok: true },
  hexString: "0a 01 02",
  error: null,
  decodedAs: "example.OrderConfirmed",
  ...o,
});

describe("activityModel", () => {
  it("builds items newest first with sizes and statuses", () => {
    const items = buildActivity([sent()], [recv()]);
    expect(items.map((i) => i.kind)).toEqual(["received", "sent"]);
    // "CgU=" decodes to two bytes — the brief's example said 3, base64ByteLength says 2.
    expect(items[1]).toMatchObject({
      typeName: "Order",
      target: "orders",
      sizeBytes: 2,
      status: "ack",
    });
    expect(items[0]).toMatchObject({
      typeName: "OrderConfirmed",
      sizeBytes: 3,
      status: "decoded",
    });
  });

  it("pairs a reply by correlation id", () => {
    const groups = groupReplies(
      buildActivity([sent({ correlationId: "req-1" })], [recv({ correlationId: "req-1" })])
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reply?.id).toBe("r1");
  });

  it("pairs a reply by reply-to within the window and not outside it", () => {
    const items = buildActivity([sent({ replyTo: "orders.reply" })], [recv()]);
    expect(groupReplies(items)[0].reply?.id).toBe("r1");
    expect(groupReplies(items, 100)).toHaveLength(2);
  });

  it("does not pair when neither correlation id nor reply-to match", () => {
    expect(groupReplies(buildActivity([sent()], [recv()]))).toHaveLength(2);
  });

  it("filters by kind and query, dropping replies for the sent filter", () => {
    const items = buildActivity(
      [sent({ correlationId: "req-1" })],
      [recv({ correlationId: "req-1" })]
    );
    expect(activityGroups(items, "sent", "")[0].reply).toBeNull();
    expect(activityGroups(items, "received", "")).toHaveLength(1);
    expect(activityGroups(items, "all", "ord_1")).toHaveLength(1);
    expect(activityGroups(items, "all", "nothing")).toHaveLength(0);
  });

  it("formats clocks, sizes and the summary", () => {
    expect(formatBytes(142)).toBe("142 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatClock(new Date(2026, 8, 3, 14, 2, 11, 412).getTime())).toBe("14:02:11.412");
    expect(
      summarizeActivity(buildActivity([sent({ timestamp: new Date().toISOString() })], []))
    ).toBe("1 sent · 0 received · today");
  });

  it("formats megabytes and drops the today suffix for older items", () => {
    expect(formatBytes(3.4 * 1024 * 1024)).toBe("3.4 MB");
    expect(
      summarizeActivity(buildActivity([sent()], [recv()]), Date.parse("2027-01-01T12:00:00Z"))
    ).toBe("1 sent · 1 received");
    // An empty timeline must not claim "today" from a vacuous every().
    expect(summarizeActivity([])).toBe("0 sent · 0 received");
  });

  it("derives type names, targets and hex lengths", () => {
    expect(shortTypeName("a.b.Order")).toBe("Order");
    expect(shortTypeName("")).toBe("unknown");
    expect(describeTarget("orders", "created")).toBe("orders → created");
    expect(describeTarget("", "created")).toBe("created");
    expect(hexByteLength("0a01 02")).toBe(3);
    expect(hexByteLength("")).toBe(0);
  });

  it("maps every status to a label and a tone", () => {
    expect(STATUS_LABEL["no-decoder"]).toBe("NO DECODER");
    expect(STATUS_LABEL.ack).toBe("ACK");
    expect(STATUS_TONE.decoded).toBe("teal");
    expect(STATUS_TONE.returned).toBe("warning");
    expect(STATUS_TONE.failed).toBe("danger");
  });

  it("treats a failed send as failed and a decode error as error", () => {
    const items = buildActivity(
      [sent({ status: "failed", outcome: undefined })],
      [recv({ error: "boom", decodedAs: null })]
    );
    expect(items.map((i) => i.status)).toEqual(["error", "failed"]);
    expect(items[0]).toMatchObject({ typeName: "unknown" });
  });

  it("falls back to sent when a send has no recorded outcome", () => {
    expect(buildActivity([sent({ outcome: undefined })], [])[0].status).toBe("sent");
  });

  it("matches received rows on content type and decoded values", () => {
    const items = buildActivity([], [recv({ contentType: "application/x-protobuf" })]);
    expect(activityGroups(items, "all", "x-protobuf")).toHaveLength(1);
    expect(activityGroups(items, "all", "true")).toHaveLength(1);
  });

  it("keeps a group when only its reply matches the query", () => {
    const items = buildActivity(
      [sent({ correlationId: "req-1" })],
      [recv({ correlationId: "req-1" })]
    );
    expect(activityGroups(items, "all", "OrderConfirmed")).toHaveLength(1);
  });

  it("tolerates an unparseable timestamp", () => {
    expect(buildActivity([sent({ timestamp: "not-a-date" })], [])[0].at).toBe(0);
  });
});
