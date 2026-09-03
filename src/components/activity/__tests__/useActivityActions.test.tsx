import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockPublishMessage } = vi.hoisted(() => ({ mockPublishMessage: vi.fn() }));

vi.mock("@/lib/ipc", () => ({
  publishMessage: mockPublishMessage,
  drainMessages: vi.fn(),
  fetchQueues: vi.fn(),
  fetchQueueDepth: vi.fn(),
}));

const { mockToast, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(mockToast, {
    error: mockToastError,
    success: mockToastSuccess,
    info: vi.fn(),
  }),
}));

const { mockSave, mockWriteTextFile } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mockSave, open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: mockWriteTextFile,
  readTextFile: vi.fn(),
}));

const { mockStoreLoad } = vi.hoisted(() => ({
  mockStoreLoad: vi.fn(async () => ({
    get: vi.fn(async () => []),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}));
vi.mock("@tauri-apps/plugin-store", () => ({ load: mockStoreLoad }));

import { useHistoryStore, type HistoryEntry } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import type { FeedMessage, ProtoSchema } from "@/lib/types";
import { useActivityActions } from "../useActivityActions";
import { buildActivity, groupReplies } from "../activityModel";

const SCHEMA: ProtoSchema = {
  messages: [{ name: "Order", full_name: "example.Order", fields: [] }],
  message_map: { "example.Order": { name: "Order", full_name: "example.Order", fields: [] } },
  enums: [],
};

const ENTRY: HistoryEntry = {
  id: "s1",
  timestamp: "2026-09-03T14:02:11.412Z",
  messageTypeName: "example.Order",
  exchange: "",
  routingKey: "orders",
  status: "sent",
  fieldValues: { order_id: "ord_1" },
  payloadBase64: "CgU=",
};

const MESSAGE_A: FeedMessage = {
  id: "msg-a",
  routingKey: "order.created",
  exchange: "orders",
  correlationId: null,
  contentType: "application/json",
  timestamp: 1716300718, // epoch seconds
  receivedAt: Date.parse("2026-09-03T14:02:12.000Z"),
  decoded: { orderId: "abc" },
  hexString: "0a03616263",
  error: null,
  decodedAs: "OrderEvent",
};

const MESSAGE_B: FeedMessage = { ...MESSAGE_A, id: "msg-b", timestamp: null, decodedAs: null };

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.getState().reset();
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/order.proto", SCHEMA);
  });
  useHistoryStore.setState({ entries: [], historyLoaded: true });
  useResponseStore.setState({ messages: [] });
  useConnectionStore.setState({ activeProfileName: "dev", connectionStatus: "connected" });
  mockSave.mockResolvedValue("/tmp/activity-export.json");
  mockWriteTextFile.mockResolvedValue(undefined);
  mockPublishMessage.mockResolvedValue({ status: "ack" });
});

afterEach(async () => {
  await act(async () => {});
});

function actions() {
  return renderHook(() => useActivityActions()).result;
}

describe("replay", () => {
  test("loads the entry's field values into the form", () => {
    const { current } = actions();
    act(() => current.replay(ENTRY));
    expect(useProtoStore.getState().pendingReplayValues).toEqual({ order_id: "ord_1" });
    expect(useProtoStore.getState().selectedMessageType).toBe("example.Order");
  });

  test("refuses when the .proto file is not open", () => {
    useProtoStore.getState().reset();
    const { current } = actions();
    act(() => current.replay(ENTRY));
    expect(mockToastError).toHaveBeenCalledWith(
      "Replay failed: .proto file not open. Open the file first."
    );
  });
});

describe("resend", () => {
  test("refuses a truncated payload with the existing copy", async () => {
    const { current } = actions();
    await act(async () => {
      await current.resend({ ...ENTRY, payloadTruncated: true });
    });
    expect(mockToastError).toHaveBeenCalledWith(
      "Resend unavailable: this payload was too large and only its start was kept."
    );
    expect(mockPublishMessage).not.toHaveBeenCalled();
  });

  test("publishes the stored bytes and records a history entry", async () => {
    const { current } = actions();
    await act(async () => {
      await current.resend(ENTRY);
    });
    expect(mockPublishMessage).toHaveBeenCalledWith("dev", "", "orders", "CgU=");
    await waitFor(() => {
      expect(useHistoryStore.getState().entries).toHaveLength(1);
    });
    expect(useHistoryStore.getState().entries[0]).toMatchObject({
      messageTypeName: "example.Order",
      routingKey: "orders",
      payloadBase64: "CgU=",
      status: "sent",
    });
  });

  test("refuses without an active profile", async () => {
    useConnectionStore.setState({ activeProfileName: null });
    const { current } = actions();
    await act(async () => {
      await current.resend(ENTRY);
    });
    expect(mockToastError).toHaveBeenCalledWith("Resend failed: No active connection profile.");
  });

  test("surfaces a publish failure and writes no history", async () => {
    mockPublishMessage.mockRejectedValueOnce(new Error("broker down"));
    const { current } = actions();
    await act(async () => {
      await current.resend(ENTRY);
    });
    expect(mockToastError).toHaveBeenCalledWith("Resend failed: broker down", { duration: 5000 });
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });
});

describe("exportVisible", () => {
  function visibleGroups(entries: HistoryEntry[], messages: FeedMessage[]) {
    return groupReplies(buildActivity(entries, messages));
  }

  test("writes the envelope with curated received fields and an ISO timestamp", async () => {
    const { current } = actions();
    await act(async () => {
      // status "sent" with outcome "ack": the two must export as separate fields.
      await current.exportVisible(visibleGroups([{ ...ENTRY, outcome: "ack" }], [MESSAGE_A]));
    });
    expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as {
      exportedAt: string;
      messageCount: number;
      messages: Array<Record<string, unknown>>;
      sent: Array<Record<string, unknown>>;
    };
    expect(parsed).toHaveProperty("exportedAt");
    expect(parsed.messageCount).toBe(1);
    expect(parsed.messages).toHaveLength(1);
    const msg = parsed.messages[0];
    expect(msg).not.toHaveProperty("id");
    expect(msg).not.toHaveProperty("hexString");
    expect(msg).toHaveProperty("routingKey", "order.created");
    expect(msg).toHaveProperty("exchange", "orders");
    expect(msg).toHaveProperty("contentType", "application/json");
    expect(typeof msg.timestamp).toBe("string");
    expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(msg).toHaveProperty("decodedAs", "OrderEvent");
    expect(msg).toHaveProperty("error", null);
    expect(parsed.sent).toEqual([
      {
        id: "s1",
        timestamp: "2026-09-03T14:02:11.412Z",
        messageTypeName: "example.Order",
        exchange: "",
        routingKey: "orders",
        status: "sent",
        outcome: "ack",
        fieldValues: { order_id: "ord_1" },
      },
    ]);
  });

  test("keeps a failed send's status distinct from its (absent) outcome", async () => {
    const { current } = actions();
    await act(async () => {
      await current.exportVisible(
        visibleGroups([{ ...ENTRY, status: "failed", outcome: undefined }], [])
      );
    });
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as { sent: Array<Record<string, unknown>> };
    expect(parsed.sent[0]).toMatchObject({ status: "failed", outcome: null });
  });

  test("serializes a null publisher timestamp as null", async () => {
    const { current } = actions();
    await act(async () => {
      await current.exportVisible(visibleGroups([], [MESSAGE_B]));
    });
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as { messages: Array<Record<string, unknown>> };
    expect(parsed.messages[0].timestamp).toBeNull();
  });

  test("defaults the filename to the activity-export stamp", async () => {
    const { current } = actions();
    await act(async () => {
      await current.exportVisible(visibleGroups([ENTRY], []));
    });
    const saveArg = mockSave.mock.calls[0][0] as { defaultPath: string };
    expect(saveArg.defaultPath).toMatch(/^activity-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/);
  });

  test("includes a grouped reply among the exported messages", async () => {
    const reply: FeedMessage = { ...MESSAGE_A, correlationId: "req-1" };
    const groups = visibleGroups([{ ...ENTRY, correlationId: "req-1" }], [reply]);
    expect(groups).toHaveLength(1);
    const { current } = actions();
    await act(async () => {
      await current.exportVisible(groups);
    });
    const [, jsonStr] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(jsonStr) as { messageCount: number; sent: unknown[] };
    expect(parsed.messageCount).toBe(1);
    expect(parsed.sent).toHaveLength(1);
  });

  test("stays silent when the save dialog is cancelled", async () => {
    mockSave.mockResolvedValueOnce(null);
    const { current } = actions();
    await act(async () => {
      await current.exportVisible(visibleGroups([ENTRY], []));
    });
    expect(mockWriteTextFile).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  test("reports a write failure", async () => {
    mockWriteTextFile.mockRejectedValueOnce(new Error("disk full"));
    const { current } = actions();
    await act(async () => {
      await current.exportVisible(visibleGroups([ENTRY], []));
    });
    expect(mockToastError).toHaveBeenCalledWith("Export failed: disk full");
  });
});

describe("clearAll", () => {
  test("empties history and the received feed", async () => {
    useHistoryStore.setState({ entries: [ENTRY], historyLoaded: true });
    useResponseStore.setState({ messages: [MESSAGE_A] });
    const { current } = actions();
    await act(async () => {
      await current.clearAll();
    });
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(useResponseStore.getState().messages).toHaveLength(0);
  });
});
