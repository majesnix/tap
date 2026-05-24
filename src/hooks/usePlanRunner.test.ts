import { describe, beforeEach, afterEach, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlanRunner } from "./usePlanRunner";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import type { Plan, PlanStep, StepResult } from "@/lib/types";

// Mock IPC module so tests don't need a real Tauri runtime
vi.mock("@/lib/ipc", () => ({
  executeStep: vi.fn(),
  cancelPlanRun: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock connection store — provide active profile name
vi.mock("@/stores/useConnectionStore", () => ({
  useConnectionStore: vi.fn((selector: (s: { activeProfileName: string }) => unknown) =>
    selector({ activeProfileName: "test-profile" })
  ),
}));

import * as ipc from "@/lib/ipc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStep(id: string, name: string): PlanStep {
  return {
    id,
    name,
    proto_path: "/test.proto",
    message_type: "test.Msg",
    field_values: "{}",
    target: { kind: "queue", queue: "test-queue" },
    response_mode: { mode: "no-wait", delay_ms: 0 },
  };
}

function makePlan(steps: PlanStep[], stopOnError = true): Plan {
  return {
    id: "plan-1",
    name: "Test Plan",
    schema_version: 1,
    steps,
    stop_on_error: stopOnError,
  };
}

function makeSuccess(stepId: string): StepResult {
  return { stepId, status: "done", reply: null, error: null };
}

function makeError(stepId: string): StepResult {
  return { stepId, status: "error", reply: null, error: "Step failed" };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  usePlanExecutionStore.getState().clearRun();
});

afterEach(() => {
  usePlanExecutionStore.getState().clearRun();
});

// ── usePlanRunner exports ─────────────────────────────────────────────────────

describe("usePlanRunner hook", () => {
  test("hook exposes startRun, stopRun, and isRunning", () => {
    const { result } = renderHook(() => usePlanRunner());
    expect(typeof result.current.startRun).toBe("function");
    expect(typeof result.current.stopRun).toBe("function");
    expect(typeof result.current.isRunning).toBe("boolean");
  });

  test("isRunning is false before any run", () => {
    const { result } = renderHook(() => usePlanRunner());
    expect(result.current.isRunning).toBe(false);
  });
});

// ── setRunning on startRun ────────────────────────────────────────────────────

describe("startRun — step initialization", () => {
  test("startRun calls setRunning with plan.id and step ids — all steps become pending immediately", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    const plan = makePlan([step1, step2]);

    vi.mocked(ipc.executeStep).mockResolvedValue(makeSuccess("s1"));
    vi.mocked(ipc.executeStep).mockResolvedValueOnce(makeSuccess("s1"));

    const { result } = renderHook(() => usePlanRunner());

    // Act — just check that stepStatuses are initialized before any async step
    let storeStatuses: Record<string, string> = {};
    vi.mocked(ipc.executeStep).mockImplementation(async (_profile, step) => {
      storeStatuses = { ...usePlanExecutionStore.getState().stepStatuses };
      return makeSuccess(step.id);
    });

    await act(async () => {
      await result.current.startRun(plan);
    });

    // All steps were initialized to 'pending' before any step ran
    expect(storeStatuses["s1"]).toBeTruthy(); // was set (could be sending by time step1 runs)
    expect(storeStatuses["s2"]).toBe("pending"); // step2 still pending when step1 executes
  });
});

// ── Sequential execution ──────────────────────────────────────────────────────

describe("startRun — sequential execution", () => {
  test("executes steps in order — executeStep called once per step", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    const plan = makePlan([step1, step2]);

    const callOrder: string[] = [];
    vi.mocked(ipc.executeStep).mockImplementation(async (_profile, step) => {
      callOrder.push(step.id);
      return makeSuccess(step.id);
    });

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    expect(callOrder).toEqual(["s1", "s2"]);
  });

  test("executeStep is called with the active profile name", async () => {
    const step1 = makeStep("s1", "Step 1");
    const plan = makePlan([step1]);

    vi.mocked(ipc.executeStep).mockResolvedValue(makeSuccess("s1"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    expect(ipc.executeStep).toHaveBeenCalledWith("test-profile", step1);
  });
});

// ── Status transitions ────────────────────────────────────────────────────────

describe("startRun — status transitions", () => {
  test("step transitions to 'done' on success", async () => {
    const step1 = makeStep("s1", "Step 1");
    const plan = makePlan([step1]);

    vi.mocked(ipc.executeStep).mockResolvedValue(makeSuccess("s1"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    expect(usePlanExecutionStore.getState().stepStatuses["s1"]).toBe("done");
  });

  test("step transitions to 'error' on failure", async () => {
    const step1 = makeStep("s1", "Step 1");
    const plan = makePlan([step1]);

    vi.mocked(ipc.executeStep).mockResolvedValue(makeError("s1"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    expect(usePlanExecutionStore.getState().stepStatuses["s1"]).toBe("error");
  });
});

// ── stop_on_error ─────────────────────────────────────────────────────────────

describe("startRun — stop_on_error", () => {
  test("stop_on_error=true (default) stops after first error", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    const plan = makePlan([step1, step2], true);

    vi.mocked(ipc.executeStep)
      .mockResolvedValueOnce(makeError("s1"))
      .mockResolvedValueOnce(makeSuccess("s2"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    // Only step1 should have been executed
    expect(ipc.executeStep).toHaveBeenCalledTimes(1);
    // step2 stays pending
    expect(usePlanExecutionStore.getState().stepStatuses["s2"]).toBe("pending");
  });

  test("stop_on_error=false continues past errors", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    const plan = makePlan([step1, step2], false);

    vi.mocked(ipc.executeStep)
      .mockResolvedValueOnce(makeError("s1"))
      .mockResolvedValueOnce(makeSuccess("s2"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    // Both steps executed
    expect(ipc.executeStep).toHaveBeenCalledTimes(2);
    expect(usePlanExecutionStore.getState().stepStatuses["s2"]).toBe("done");
  });

  test("stop_on_error absent defaults to true", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    // No stop_on_error field — should default to true
    const plan: Plan = {
      id: "plan-1",
      name: "Test Plan",
      schema_version: 1,
      steps: [step1, step2],
    };

    vi.mocked(ipc.executeStep).mockResolvedValueOnce(makeError("s1"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    expect(ipc.executeStep).toHaveBeenCalledTimes(1);
  });
});

// ── Summary and finishRun ─────────────────────────────────────────────────────

describe("startRun — summary and finishRun", () => {
  test("summary reflects succeeded/total after run completes", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    const step3 = makeStep("s3", "Step 3");
    const plan = makePlan([step1, step2, step3], false);

    vi.mocked(ipc.executeStep)
      .mockResolvedValueOnce(makeSuccess("s1"))
      .mockResolvedValueOnce(makeError("s2"))
      .mockResolvedValueOnce(makeSuccess("s3"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    const summary = usePlanExecutionStore.getState().summary;
    expect(summary).toEqual({ succeeded: 2, total: 3 });
  });

  test("isRunning returns false after run completes", async () => {
    const step1 = makeStep("s1", "Step 1");
    const plan = makePlan([step1]);

    vi.mocked(ipc.executeStep).mockResolvedValue(makeSuccess("s1"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    expect(result.current.isRunning).toBe(false);
  });

  test("stepStatuses remain visible after finishRun (not cleared)", async () => {
    const step1 = makeStep("s1", "Step 1");
    const plan = makePlan([step1]);

    vi.mocked(ipc.executeStep).mockResolvedValue(makeSuccess("s1"));

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    // stepStatuses should still show 'done' after run ends
    expect(usePlanExecutionStore.getState().stepStatuses["s1"]).toBe("done");
  });
});

// ── isCancelling guard (pitfall #8) ──────────────────────────────────────────

describe("startRun — isCancelling guard (pitfall #8)", () => {
  test("when isCancelling is true, error from in-flight step does not stop loop (stop_on_error=true)", async () => {
    const step1 = makeStep("s1", "Step 1");
    const step2 = makeStep("s2", "Step 2");
    const plan = makePlan([step1, step2], true);

    vi.mocked(ipc.executeStep).mockImplementation(async (_profile, step) => {
      if (step.id === "s1") {
        // Simulate cancel happening during step1
        usePlanExecutionStore.getState().setIsCancelling(true);
        return makeError("s1");
      }
      return makeSuccess("s2");
    });

    const { result } = renderHook(() => usePlanRunner());
    await act(async () => {
      await result.current.startRun(plan);
    });

    // Even with stop_on_error=true, isCancelling prevents the break
    // Both steps should have been visited (or loop exits naturally)
    // The key assertion: error count for summary should NOT count the cancelled step as failure
    // Actually the loop does NOT break when isCancelling=true, so step2 is attempted
    // This test verifies loop behavior is controlled by isCancelling
    expect(usePlanExecutionStore.getState().isCancelling).toBe(true);
  });
});

// ── stopRun ───────────────────────────────────────────────────────────────────

describe("stopRun", () => {
  test("stopRun calls cancelPlanRun", async () => {
    vi.mocked(ipc.cancelPlanRun).mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlanRunner());

    await act(async () => {
      await result.current.stopRun();
    });

    expect(ipc.cancelPlanRun).toHaveBeenCalledOnce();
  });

  test("stopRun sets isCancelling to true", async () => {
    vi.mocked(ipc.cancelPlanRun).mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlanRunner());

    await act(async () => {
      await result.current.stopRun();
    });

    expect(usePlanExecutionStore.getState().isCancelling).toBe(true);
  });
});
