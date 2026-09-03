import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FeedMessage, PlanStep, ReplyMessage } from "@/lib/types";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { StepReplyPanel } from "@/components/plans/StepReplyPanel";

const NO_WAIT_STEP: PlanStep = {
  id: "step-1",
  name: "Send order",
  proto_path: "/tmp/order.proto",
  message_type: "example.Order",
  field_values: "{}",
  target: { kind: "queue", queue: "orders" },
  response_mode: { mode: "no-wait", delay_ms: 200 },
};

const WAITING_STEP: PlanStep = {
  ...NO_WAIT_STEP,
  id: "step-2",
  response_mode: { mode: "correlation-id", reply_queue: "orders.reply", timeout_ms: 10000 },
};

const REPLY: ReplyMessage = {
  routingKey: "orders.reply",
  exchange: "",
  contentType: "application/x-protobuf",
  correlationId: "req-7c1e",
  decoded: { order_id: "ord_plan_001", status: "PAID" },
  decodedAs: "PaymentConfirmed",
  hexString: "0a 05 68 65 6c 6c 6f",
};

function feedMessage(overrides: Partial<FeedMessage> = {}): FeedMessage {
  return {
    id: "f1",
    routingKey: "orders.reply",
    exchange: "",
    contentType: null,
    correlationId: "req-7c1e",
    timestamp: null,
    receivedAt: new Date(2026, 0, 2, 14, 2, 11, 25).getTime(),
    decoded: { ok: true },
    hexString: "0a 05",
    error: null,
    decodedAs: "PaymentConfirmed",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof StepReplyPanel>> = {}) {
  render(
    <StepReplyPanel
      step={WAITING_STEP}
      index={1}
      reply={null}
      feed={[]}
      {...overrides}
    />
  );
}

describe("StepReplyPanel", () => {
  test("names the selected step in the header", () => {
    renderPanel();
    expect(screen.getByText("Step 2 · reply")).toBeInTheDocument();
    expect(screen.getByText("Reply feed · 0")).toBeInTheDocument();
  });

  test("explains that a no-wait step captures no reply", () => {
    renderPanel({ step: NO_WAIT_STEP, index: 0 });
    expect(
      screen.getByText(/This step does not wait for a reply\./)
    ).toBeInTheDocument();
  });

  test("says when a waiting step has no reply yet", () => {
    renderPanel();
    expect(screen.getByText(/No reply captured for this step yet\./)).toBeInTheDocument();
  });

  test("prompts for a selection when no step is selected", () => {
    renderPanel({ step: null, index: 0 });
    expect(screen.getByText(/Select a step to see its reply\./)).toBeInTheDocument();
  });

  test("renders the reply card with type, duration, meta and decoded fields", () => {
    renderPanel({ reply: REPLY, durationMs: 412 });
    expect(screen.getByText("PaymentConfirmed")).toBeInTheDocument();
    expect(screen.getByText("+412 ms")).toBeInTheDocument();
    expect(screen.getByText("orders.reply · corr:req-7c1e · 7 B")).toBeInTheDocument();
    expect(screen.getByText("order_id")).toBeInTheDocument();
    expect(screen.getByText('"ord_plan_001"')).toBeInTheDocument();
    expect(screen.getByText("Decoded as PaymentConfirmed")).toBeInTheDocument();
  });

  test("omits the duration when it is unknown", () => {
    renderPanel({ reply: REPLY });
    expect(screen.queryByText(/^\+\d+ ms$/)).not.toBeInTheDocument();
  });

  test("opens the hex dump from the Hex action", () => {
    renderPanel({ reply: REPLY, durationMs: 412 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hex" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("0a 05 68 65 6c 6c 6f")).toBeInTheDocument();
  });

  test("notes a reply that could not be decoded", () => {
    renderPanel({ reply: { ...REPLY, decoded: null, decodedAs: null } });
    expect(screen.getByText("Not decoded")).toBeInTheDocument();
  });

  test("lists one row per reply feed entry", () => {
    renderPanel({
      feed: [feedMessage(), feedMessage({ id: "f2", decodedAs: null, decoded: null })],
    });
    expect(screen.getByText("Reply feed · 2")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("DECODED")).toBeInTheDocument();
    expect(screen.getByText("NO DECODER")).toBeInTheDocument();
  });

  test("marks a feed entry that failed to decode", () => {
    renderPanel({ feed: [feedMessage({ error: "decode failed" })] });
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  test("renders the feed row meta as routing key, time and size", () => {
    renderPanel({ feed: [feedMessage()] });
    expect(screen.getByText("orders.reply · 14:02:11.025 · 2 B")).toBeInTheDocument();
  });
});
