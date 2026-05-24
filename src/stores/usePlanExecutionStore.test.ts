import { describe, beforeEach, test, expect } from "vitest";
import { useRawPlanExecutionStore } from "./usePlanExecutionStore";
import type { ReplyMessage, FeedMessage } from "../lib/types";

// Reset store before each test to prevent state pollution
beforeEach(() => {
  useRawPlanExecutionStore.getState().clearRun();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  test("runningPlanId is null initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.runningPlanId).toBeNull();
  });

  test("stepStatuses is empty record initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepStatuses).toEqual({});
  });

  test("activeStepId is null initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.activeStepId).toBeNull();
  });

  test("isCancelling is false initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.isCancelling).toBe(false);
  });

  test("summary is null initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.summary).toBeNull();
  });

  test("isRunning computed selector returns false when runningPlanId is null", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.isRunning).toBe(false);
  });
});

// ── setRunning ────────────────────────────────────────────────────────────────

describe("setRunning", () => {
  test("setRunning sets runningPlanId to given plan id", () => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a", "step-b"]);
    const s = useRawPlanExecutionStore.getState();
    expect(s.runningPlanId).toBe("plan-1");
  });

  test("setRunning initializes all provided stepIds to 'pending'", () => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a", "step-b", "step-c"]);
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepStatuses).toEqual({
      "step-a": "pending",
      "step-b": "pending",
      "step-c": "pending",
    });
  });

  test("setRunning with empty stepIds produces empty stepStatuses", () => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", []);
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepStatuses).toEqual({});
  });

  test("setRunning clears previous summary", () => {
    // Arrange: set a summary first
    useRawPlanExecutionStore.getState().setSummary(3, 4);
    // Act
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a"]);
    // Assert
    const s = useRawPlanExecutionStore.getState();
    expect(s.summary).toBeNull();
  });

  test("setRunning resets isCancelling to false", () => {
    // Arrange: set isCancelling first
    useRawPlanExecutionStore.getState().setIsCancelling(true);
    // Act
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a"]);
    // Assert
    const s = useRawPlanExecutionStore.getState();
    expect(s.isCancelling).toBe(false);
  });

  test("isRunning returns true after setRunning", () => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a"]);
    expect(useRawPlanExecutionStore.getState().isRunning).toBe(true);
  });
});

// ── setStepStatus ─────────────────────────────────────────────────────────────

describe("setStepStatus", () => {
  beforeEach(() => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a", "step-b"]);
  });

  test("setStepStatus updates only the named step", () => {
    useRawPlanExecutionStore.getState().setStepStatus("step-a", "sending");
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepStatuses["step-a"]).toBe("sending");
    expect(s.stepStatuses["step-b"]).toBe("pending"); // unchanged
  });

  test("setStepStatus does not mutate the previous record (immutable update)", () => {
    const before = useRawPlanExecutionStore.getState().stepStatuses;
    useRawPlanExecutionStore.getState().setStepStatus("step-a", "done");
    const after = useRawPlanExecutionStore.getState().stepStatuses;
    // New object reference
    expect(after).not.toBe(before);
  });

  test("setStepStatus can transition through all statuses", () => {
    const statuses = ["sending", "waiting-response", "done", "error"] as const;
    for (const status of statuses) {
      useRawPlanExecutionStore.getState().setStepStatus("step-a", status);
      expect(useRawPlanExecutionStore.getState().stepStatuses["step-a"]).toBe(status);
    }
  });
});

// ── setActiveStep ─────────────────────────────────────────────────────────────

describe("setActiveStep", () => {
  test("setActiveStep updates activeStepId to given stepId", () => {
    useRawPlanExecutionStore.getState().setActiveStep("step-x");
    expect(useRawPlanExecutionStore.getState().activeStepId).toBe("step-x");
  });

  test("setActiveStep(null) clears activeStepId", () => {
    useRawPlanExecutionStore.getState().setActiveStep("step-x");
    useRawPlanExecutionStore.getState().setActiveStep(null);
    expect(useRawPlanExecutionStore.getState().activeStepId).toBeNull();
  });
});

// ── setIsCancelling ───────────────────────────────────────────────────────────

describe("setIsCancelling", () => {
  test("setIsCancelling(true) sets isCancelling to true", () => {
    useRawPlanExecutionStore.getState().setIsCancelling(true);
    expect(useRawPlanExecutionStore.getState().isCancelling).toBe(true);
  });

  test("setIsCancelling(false) sets isCancelling to false", () => {
    useRawPlanExecutionStore.getState().setIsCancelling(true);
    useRawPlanExecutionStore.getState().setIsCancelling(false);
    expect(useRawPlanExecutionStore.getState().isCancelling).toBe(false);
  });
});

// ── setSummary ────────────────────────────────────────────────────────────────

describe("setSummary", () => {
  test("setSummary stores succeeded and total counts", () => {
    useRawPlanExecutionStore.getState().setSummary(3, 5);
    const s = useRawPlanExecutionStore.getState();
    expect(s.summary).toEqual({ succeeded: 3, total: 5 });
  });

  test("setSummary with zero succeeded is valid", () => {
    useRawPlanExecutionStore.getState().setSummary(0, 4);
    expect(useRawPlanExecutionStore.getState().summary).toEqual({ succeeded: 0, total: 4 });
  });
});

// ── finishRun ─────────────────────────────────────────────────────────────────

describe("finishRun", () => {
  beforeEach(() => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a", "step-b"]);
    useRawPlanExecutionStore.getState().setStepStatus("step-a", "done");
    useRawPlanExecutionStore.getState().setStepStatus("step-b", "error");
    useRawPlanExecutionStore.getState().setSummary(1, 2);
  });

  test("finishRun sets runningPlanId to null", () => {
    useRawPlanExecutionStore.getState().finishRun();
    expect(useRawPlanExecutionStore.getState().runningPlanId).toBeNull();
  });

  test("finishRun sets activeStepId to null", () => {
    useRawPlanExecutionStore.getState().setActiveStep("step-a");
    useRawPlanExecutionStore.getState().finishRun();
    expect(useRawPlanExecutionStore.getState().activeStepId).toBeNull();
  });

  test("finishRun keeps stepStatuses intact (for post-run badge display)", () => {
    useRawPlanExecutionStore.getState().finishRun();
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepStatuses).toEqual({ "step-a": "done", "step-b": "error" });
  });

  test("finishRun keeps summary intact (for post-run display)", () => {
    useRawPlanExecutionStore.getState().finishRun();
    expect(useRawPlanExecutionStore.getState().summary).toEqual({ succeeded: 1, total: 2 });
  });

  test("isRunning returns false after finishRun", () => {
    useRawPlanExecutionStore.getState().finishRun();
    expect(useRawPlanExecutionStore.getState().isRunning).toBe(false);
  });
});

// ── clearRun ──────────────────────────────────────────────────────────────────

describe("clearRun", () => {
  beforeEach(() => {
    useRawPlanExecutionStore.getState().setRunning("plan-1", ["step-a"]);
    useRawPlanExecutionStore.getState().setStepStatus("step-a", "done");
    useRawPlanExecutionStore.getState().setSummary(1, 1);
    useRawPlanExecutionStore.getState().setIsCancelling(true);
  });

  test("clearRun resets runningPlanId to null", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().runningPlanId).toBeNull();
  });

  test("clearRun resets stepStatuses to empty record", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().stepStatuses).toEqual({});
  });

  test("clearRun resets activeStepId to null", () => {
    useRawPlanExecutionStore.getState().setActiveStep("step-a");
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().activeStepId).toBeNull();
  });

  test("clearRun resets isCancelling to false", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().isCancelling).toBe(false);
  });

  test("clearRun resets summary to null", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().summary).toBeNull();
  });
});

// ── Phase 23: new fields in INITIAL_STATE ─────────────────────────────────────

describe("initial state — new Phase 23 fields", () => {
  test("stepReplies is empty record initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepReplies).toEqual({});
  });

  test("planReplyFeed is empty array initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.planReplyFeed).toEqual([]);
  });

  test("paneMode is 'editor' initially", () => {
    const s = useRawPlanExecutionStore.getState();
    expect(s.paneMode).toBe("editor");
  });
});

// ── Phase 23: setStepReply ────────────────────────────────────────────────────

const makeReply = (routingKey = "reply.key"): ReplyMessage => ({
  routingKey,
  exchange: "",
  contentType: "application/protobuf",
  correlationId: null,
  decoded: { field: "value" },
  decodedAs: "test.Msg",
  hexString: "deadbeef",
});

describe("setStepReply", () => {
  test("setStepReply stores reply keyed by stepId", () => {
    const reply = makeReply();
    useRawPlanExecutionStore.getState().setStepReply("step-1", reply);
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepReplies["step-1"]).toEqual(reply);
  });

  test("setStepReply does not mutate the previous record (immutable spread)", () => {
    const reply1 = makeReply("key-1");
    useRawPlanExecutionStore.getState().setStepReply("step-1", reply1);
    const before = useRawPlanExecutionStore.getState().stepReplies;

    const reply2 = makeReply("key-2");
    useRawPlanExecutionStore.getState().setStepReply("step-2", reply2);
    const after = useRawPlanExecutionStore.getState().stepReplies;

    // Different object reference
    expect(after).not.toBe(before);
  });

  test("setStepReply called twice for different stepIds accumulates both entries", () => {
    const reply1 = makeReply("key-1");
    const reply2 = makeReply("key-2");
    useRawPlanExecutionStore.getState().setStepReply("step-1", reply1);
    useRawPlanExecutionStore.getState().setStepReply("step-2", reply2);
    const s = useRawPlanExecutionStore.getState();
    expect(s.stepReplies["step-1"]).toEqual(reply1);
    expect(s.stepReplies["step-2"]).toEqual(reply2);
  });
});

// ── Phase 23: appendReplyFeedEntry ────────────────────────────────────────────

const makeFeedEntry = (id = "entry-1"): FeedMessage => ({
  id,
  routingKey: "reply.key",
  exchange: "",
  contentType: "application/protobuf",
  correlationId: null,
  timestamp: 1234567890,
  decoded: { field: "value" },
  hexString: "deadbeef",
  error: null,
  decodedAs: "test.Msg",
});

describe("appendReplyFeedEntry", () => {
  test("single append produces planReplyFeed of length 1 with that entry at index 0", () => {
    const entry = makeFeedEntry("e-1");
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(entry);
    const s = useRawPlanExecutionStore.getState();
    expect(s.planReplyFeed).toHaveLength(1);
    expect(s.planReplyFeed[0]).toEqual(entry);
  });

  test("appendReplyFeedEntry prepends — newest entry is at index 0", () => {
    const entry1 = makeFeedEntry("e-1");
    const entry2 = makeFeedEntry("e-2");
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(entry1);
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(entry2);
    const s = useRawPlanExecutionStore.getState();
    expect(s.planReplyFeed[0].id).toBe("e-2");
    expect(s.planReplyFeed[1].id).toBe("e-1");
  });

  test("appendReplyFeedEntry uses immutable spread (no in-place mutation)", () => {
    const entry1 = makeFeedEntry("e-1");
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(entry1);
    const before = useRawPlanExecutionStore.getState().planReplyFeed;

    const entry2 = makeFeedEntry("e-2");
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(entry2);
    const after = useRawPlanExecutionStore.getState().planReplyFeed;

    expect(after).not.toBe(before);
  });

  test("FIFO-500 cap: 501 appends produce planReplyFeed of length 500", () => {
    for (let i = 0; i < 501; i++) {
      useRawPlanExecutionStore.getState().appendReplyFeedEntry(makeFeedEntry(`e-${i}`));
    }
    expect(useRawPlanExecutionStore.getState().planReplyFeed).toHaveLength(500);
  });

  test("FIFO-500 cap: oldest entries are dropped when cap is exceeded", () => {
    // Append 501 entries; index 0 at start is oldest after 501 appends with prepend order
    // With prepend: entry-0 goes in first, then entry-1 prepends, ..., entry-500 is last prepended
    // After 501 appends and slice(0,500): entry-500 is at [0], entry-1 is at [499], entry-0 is dropped
    for (let i = 0; i < 501; i++) {
      useRawPlanExecutionStore.getState().appendReplyFeedEntry(makeFeedEntry(`e-${i}`));
    }
    const feed = useRawPlanExecutionStore.getState().planReplyFeed;
    // Newest (e-500) should be at index 0
    expect(feed[0].id).toBe("e-500");
    // Oldest (e-0) should NOT be present
    expect(feed.find((m) => m.id === "e-0")).toBeUndefined();
  });
});

// ── Phase 23: setPaneMode ─────────────────────────────────────────────────────

describe("setPaneMode", () => {
  test("setPaneMode('reply') sets paneMode to 'reply'", () => {
    useRawPlanExecutionStore.getState().setPaneMode("reply");
    expect(useRawPlanExecutionStore.getState().paneMode).toBe("reply");
  });

  test("setPaneMode('editor') sets paneMode to 'editor'", () => {
    useRawPlanExecutionStore.getState().setPaneMode("reply");
    useRawPlanExecutionStore.getState().setPaneMode("editor");
    expect(useRawPlanExecutionStore.getState().paneMode).toBe("editor");
  });
});

// ── Phase 23: setRunning resets new fields inline ─────────────────────────────

describe("setRunning — resets Phase 23 fields inline (Pitfall 3)", () => {
  test("setRunning resets stepReplies to empty record", () => {
    // Arrange: put a reply in the store
    useRawPlanExecutionStore.getState().setStepReply("step-1", makeReply());
    // Act
    useRawPlanExecutionStore.getState().setRunning("plan-2", ["step-x"]);
    // Assert
    expect(useRawPlanExecutionStore.getState().stepReplies).toEqual({});
  });

  test("setRunning resets planReplyFeed to empty array", () => {
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(makeFeedEntry("e-1"));
    useRawPlanExecutionStore.getState().setRunning("plan-2", ["step-x"]);
    expect(useRawPlanExecutionStore.getState().planReplyFeed).toEqual([]);
  });

  test("setRunning resets paneMode to 'editor'", () => {
    useRawPlanExecutionStore.getState().setPaneMode("reply");
    useRawPlanExecutionStore.getState().setRunning("plan-2", ["step-x"]);
    expect(useRawPlanExecutionStore.getState().paneMode).toBe("editor");
  });
});

// ── Phase 23: clearRun resets new fields via INITIAL_STATE ───────────────────

describe("clearRun — resets Phase 23 fields via INITIAL_STATE spread", () => {
  beforeEach(() => {
    useRawPlanExecutionStore.getState().setStepReply("step-1", makeReply());
    useRawPlanExecutionStore.getState().appendReplyFeedEntry(makeFeedEntry("e-1"));
    useRawPlanExecutionStore.getState().setPaneMode("reply");
  });

  test("clearRun resets stepReplies to empty record", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().stepReplies).toEqual({});
  });

  test("clearRun resets planReplyFeed to empty array", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().planReplyFeed).toEqual([]);
  });

  test("clearRun resets paneMode to 'editor'", () => {
    useRawPlanExecutionStore.getState().clearRun();
    expect(useRawPlanExecutionStore.getState().paneMode).toBe("editor");
  });
});
