import { describe, beforeEach, test, expect } from "vitest";
import { useRawPlanExecutionStore } from "./usePlanExecutionStore";

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
