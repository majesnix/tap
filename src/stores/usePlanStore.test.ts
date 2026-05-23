import { describe, beforeEach, test, expect, vi } from "vitest";
import type { Plan, PlanStep } from "../lib/types";

// Use vi.hoisted for mock factories (Vitest hoisting requirement)
const { mockStore, mockGet, mockSet, mockSave } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(null);
  const mockStore = { get: mockGet, set: mockSet, save: mockSave };
  return { mockStore, mockGet, mockSet, mockSave };
});

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));

import { usePlanStore } from "./usePlanStore";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: crypto.randomUUID(),
    name: "My Step",
    proto_path: "/some/path.proto",
    message_type: "my.package.MyMessage",
    field_values: '{"foo":"bar"}',
    target: { kind: "queue", queue: "test-queue" },
    response_mode: { mode: "no-wait", delay_ms: 200 },
    ...overrides,
  };
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: crypto.randomUUID(),
    name: "My Plan",
    schema_version: 1,
    steps: [],
    ...overrides,
  };
}

beforeEach(() => {
  // Reset store state to prevent Zustand singleton bleed across tests
  usePlanStore.setState({ plans: [], plansLoaded: false });
  vi.clearAllMocks();
  // Default: store.get returns null (no persisted plans)
  mockGet.mockResolvedValue(null);
});

// ── loadPlans ─────────────────────────────────────────────────────────────────

describe("loadPlans", () => {
  test("loadPlans when store returns null sets plans=[] and plansLoaded=true", async () => {
    mockGet.mockResolvedValueOnce(null);
    await usePlanStore.getState().loadPlans();
    const { plans, plansLoaded } = usePlanStore.getState();
    expect(plansLoaded).toBe(true);
    expect(plans).toHaveLength(0);
  });

  test("loadPlans when store has saved plans populates plans array correctly", async () => {
    const step = makeStep({ id: "step-1", name: "Step A" });
    const saved = [
      makePlan({ id: "plan-1", name: "Plan A", steps: [step] }),
      makePlan({ id: "plan-2", name: "Plan B" }),
    ];
    mockGet.mockResolvedValueOnce(saved);
    await usePlanStore.getState().loadPlans();
    const { plans, plansLoaded } = usePlanStore.getState();
    expect(plansLoaded).toBe(true);
    expect(plans).toHaveLength(2);
    expect(plans[0].id).toBe("plan-1");
    expect(plans[1].id).toBe("plan-2");
  });

  test("loadPlans filters out malformed entries — only valid Plan objects survive", async () => {
    const validPlan = makePlan({ id: "valid-1", name: "Valid Plan" });
    const malformed = [
      { garbage: true },
      { id: 123, name: "Bad id type", schema_version: 1, steps: [] },
      { id: "ok", name: "Missing version", steps: [] },
      null,
      "a string",
    ];
    mockGet.mockResolvedValueOnce([...malformed, validPlan]);
    await usePlanStore.getState().loadPlans();
    const { plans, plansLoaded } = usePlanStore.getState();
    expect(plansLoaded).toBe(true);
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("valid-1");
  });
});

// ── D-14 condition 2: plansLoaded hydration gate ──────────────────────────────

describe("plansLoaded hydration gate (D-14 condition 2)", () => {
  test("createPlan when plansLoaded===false is a no-op — returns null, store.set never called, plans unchanged", async () => {
    // plansLoaded is false (set in beforeEach)
    const result = await usePlanStore.getState().createPlan("Should Not Create");
    expect(result).toBeNull();
    expect(usePlanStore.getState().plans).toHaveLength(0);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("renamePlan when plansLoaded===false is a no-op — store.set never called", async () => {
    const plan = makePlan({ id: "plan-a", name: "Original" });
    usePlanStore.setState({ plans: [plan], plansLoaded: false });
    await usePlanStore.getState().renamePlan("plan-a", "Renamed");
    expect(usePlanStore.getState().plans[0].name).toBe("Original");
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("deletePlan when plansLoaded===false is a no-op — store.set never called", async () => {
    const plan = makePlan({ id: "plan-b" });
    usePlanStore.setState({ plans: [plan], plansLoaded: false });
    await usePlanStore.getState().deletePlan("plan-b");
    expect(usePlanStore.getState().plans).toHaveLength(1);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("duplicatePlan when plansLoaded===false returns null — store.set never called", async () => {
    const plan = makePlan({ id: "plan-c" });
    usePlanStore.setState({ plans: [plan], plansLoaded: false });
    const result = await usePlanStore.getState().duplicatePlan("plan-c");
    expect(result).toBeNull();
    expect(usePlanStore.getState().plans).toHaveLength(1);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

// ── CRUD round-trips (D-14 condition 1) ──────────────────────────────────────

describe("createPlan (D-14 condition 1)", () => {
  test("createPlan when plansLoaded===true appends plan, calls store.set + store.save, returns new plan", async () => {
    usePlanStore.setState({ plansLoaded: true });
    const created = await usePlanStore.getState().createPlan("New Plan");
    const { plans } = usePlanStore.getState();
    expect(plans).toHaveLength(1);
    expect(plans[0].name).toBe("New Plan");
    expect(plans[0].id).toBeTruthy();
    expect(plans[0].schema_version).toBe(1);
    expect(plans[0].steps).toHaveLength(0);
    expect(created).not.toBeNull();
    expect(created!.id).toBe(plans[0].id);
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("createPlan rolls back in-memory state and throws when persistPlans fails", async () => {
    usePlanStore.setState({ plans: [], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("Disk full"));
    await expect(usePlanStore.getState().createPlan("Failing Plan")).rejects.toThrow("Disk full");
    expect(usePlanStore.getState().plans).toHaveLength(0);
  });
});

describe("renamePlan (D-14 condition 1)", () => {
  test("renamePlan updates name in-memory and persists", async () => {
    const plan = makePlan({ id: "rename-me", name: "Before" });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    await usePlanStore.getState().renamePlan("rename-me", "After");
    expect(usePlanStore.getState().plans[0].name).toBe("After");
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("renamePlan rolls back and throws when persist fails", async () => {
    const plan = makePlan({ id: "rename-fail", name: "Original" });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("Permission denied"));
    await expect(usePlanStore.getState().renamePlan("rename-fail", "Updated")).rejects.toThrow(
      "Permission denied"
    );
    expect(usePlanStore.getState().plans[0].name).toBe("Original");
  });
});

describe("deletePlan (D-14 condition 1)", () => {
  test("deletePlan removes matching plan and persists", async () => {
    const planA = makePlan({ id: "del-a" });
    const planB = makePlan({ id: "del-b" });
    usePlanStore.setState({ plans: [planA, planB], plansLoaded: true });
    await usePlanStore.getState().deletePlan("del-a");
    const { plans } = usePlanStore.getState();
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("del-b");
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("deletePlan rolls back and throws when persist fails", async () => {
    const plan = makePlan({ id: "del-fail" });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("Store unavailable"));
    await expect(usePlanStore.getState().deletePlan("del-fail")).rejects.toThrow(
      "Store unavailable"
    );
    expect(usePlanStore.getState().plans).toHaveLength(1);
  });
});

// ── D-14 condition 4: duplicatePlan semantics ─────────────────────────────────

describe("duplicatePlan (D-14 condition 4)", () => {
  test("duplicate produces new plan UUID different from original", async () => {
    const original = makePlan({ id: "orig-id", name: "Original Plan" });
    usePlanStore.setState({ plans: [original], plansLoaded: true });
    const dup = await usePlanStore.getState().duplicatePlan("orig-id");
    expect(dup).not.toBeNull();
    expect(dup!.id).not.toBe("orig-id");
    expect(dup!.id).toBeTruthy();
  });

  test("duplicate name is 'Copy of [original name]'", async () => {
    const original = makePlan({ id: "orig-name", name: "My Workflow" });
    usePlanStore.setState({ plans: [original], plansLoaded: true });
    const dup = await usePlanStore.getState().duplicatePlan("orig-name");
    expect(dup!.name).toBe("Copy of My Workflow");
  });

  test("duplicate steps have new UUIDs distinct from original step UUIDs", async () => {
    const step = makeStep({ id: "step-orig", name: "Step One", field_values: '{"x":1}' });
    const original = makePlan({ id: "orig-steps", steps: [step] });
    usePlanStore.setState({ plans: [original], plansLoaded: true });
    const dup = await usePlanStore.getState().duplicatePlan("orig-steps");
    expect(dup!.steps).toHaveLength(1);
    // New UUID per step (D-13)
    expect(dup!.steps[0].id).not.toBe("step-orig");
    // Name retained
    expect(dup!.steps[0].name).toBe("Step One");
    // field_values retained
    expect(dup!.steps[0].field_values).toBe('{"x":1}');
  });

  test("duplicate does not mutate original plan's steps", async () => {
    const step = makeStep({ id: "step-immut" });
    const original = makePlan({ id: "orig-immut", steps: [step] });
    usePlanStore.setState({ plans: [original], plansLoaded: true });
    await usePlanStore.getState().duplicatePlan("orig-immut");
    // Original plan's step id is unchanged in store
    const stored = usePlanStore.getState().plans.find((p) => p.id === "orig-immut");
    expect(stored!.steps[0].id).toBe("step-immut");
  });

  test("duplicatePlan returns null when id not found", async () => {
    usePlanStore.setState({ plansLoaded: true });
    const result = await usePlanStore.getState().duplicatePlan("nonexistent");
    expect(result).toBeNull();
  });

  test("duplicatePlan rolls back and throws when persist fails", async () => {
    const original = makePlan({ id: "dup-fail", name: "Plan" });
    usePlanStore.setState({ plans: [original], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("IO error"));
    await expect(usePlanStore.getState().duplicatePlan("dup-fail")).rejects.toThrow("IO error");
    expect(usePlanStore.getState().plans).toHaveLength(1);
  });
});

// ── D-14 condition 3: field_values JSON round-trip ────────────────────────────

describe("field_values JSON round-trip (D-14 condition 3)", () => {
  test("field_values string survives JSON.stringify / JSON.parse without coercion corruption", () => {
    // The concern: if field_values were Record<string, unknown>, undefined values
    // become null after JSON.stringify+parse, silently corrupting nested objects.
    // As a string, the raw JSON is preserved exactly as the author wrote it.
    const rawFieldValues = '{"name":"Alice","count":42,"nested":{"key":"value"}}';
    const step = makeStep({ field_values: rawFieldValues });
    const plan = makePlan({ steps: [step] });

    // Simulate the JSON serialize/deserialize cycle that tauri-plugin-store performs
    const serialized = JSON.stringify([plan]);
    const deserialized = JSON.parse(serialized) as Plan[];

    // field_values must survive the cycle unchanged — no undefined→null coercion (D-12)
    expect(deserialized[0].steps[0].field_values).toBe(rawFieldValues);
    expect(typeof deserialized[0].steps[0].field_values).toBe("string");
  });

  test("field_values containing JSON null values survives round-trip without type change", () => {
    const rawFieldValues = '{"a":null,"b":"str","c":0}';
    const step = makeStep({ field_values: rawFieldValues });
    const plan = makePlan({ steps: [step] });
    const serialized = JSON.stringify([plan]);
    const deserialized = JSON.parse(serialized) as Plan[];
    expect(deserialized[0].steps[0].field_values).toBe(rawFieldValues);
  });
});

// ── Step actions (Phase 21) ───────────────────────────────────────────────────

describe("addStep (STEP-01)", () => {
  test("addStep when plansLoaded===false is a no-op", async () => {
    const plan = makePlan({ id: "plan-add" });
    const step = makeStep({ id: "step-add" });
    usePlanStore.setState({ plans: [plan], plansLoaded: false });
    await usePlanStore.getState().addStep("plan-add", step);
    expect(usePlanStore.getState().plans[0].steps).toHaveLength(0);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("addStep appends step to correct plan and persists", async () => {
    const plan = makePlan({ id: "plan-add2" });
    const step = makeStep({ id: "step-new", name: "My Step" });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    await usePlanStore.getState().addStep("plan-add2", step);
    const { plans } = usePlanStore.getState();
    expect(plans[0].steps).toHaveLength(1);
    expect(plans[0].steps[0].id).toBe("step-new");
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("addStep rolls back on persist failure", async () => {
    const plan = makePlan({ id: "plan-add-fail" });
    const step = makeStep();
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("disk"));
    await expect(usePlanStore.getState().addStep("plan-add-fail", step)).rejects.toThrow("disk");
    expect(usePlanStore.getState().plans[0].steps).toHaveLength(0);
  });
});

describe("updateStep (STEP-01, STEP-06)", () => {
  test("updateStep merges partial into the correct step", async () => {
    const step = makeStep({ id: "s1", name: "Original" });
    const plan = makePlan({ id: "p1", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    await usePlanStore.getState().updateStep("p1", "s1", { name: "Renamed" });
    const stored = usePlanStore.getState().plans[0].steps[0];
    expect(stored.name).toBe("Renamed");
    expect(stored.proto_path).toBe(step.proto_path); // other fields untouched
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("updateStep when plansLoaded===false is a no-op", async () => {
    const step = makeStep({ id: "s2", name: "A" });
    const plan = makePlan({ id: "p2", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: false });
    await usePlanStore.getState().updateStep("p2", "s2", { name: "B" });
    expect(usePlanStore.getState().plans[0].steps[0].name).toBe("A");
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("updateStep rolls back on persist failure", async () => {
    const step = makeStep({ id: "s3", name: "Before" });
    const plan = makePlan({ id: "p3", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("err"));
    await expect(usePlanStore.getState().updateStep("p3", "s3", { name: "After" })).rejects.toThrow("err");
    expect(usePlanStore.getState().plans[0].steps[0].name).toBe("Before");
  });
});

describe("deleteStep (STEP-06)", () => {
  test("deleteStep removes the correct step and persists", async () => {
    const s1 = makeStep({ id: "del1" });
    const s2 = makeStep({ id: "del2" });
    const plan = makePlan({ id: "pdel", steps: [s1, s2] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    await usePlanStore.getState().deleteStep("pdel", "del1");
    const { plans } = usePlanStore.getState();
    expect(plans[0].steps).toHaveLength(1);
    expect(plans[0].steps[0].id).toBe("del2");
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("deleteStep rolls back on persist failure", async () => {
    const step = makeStep({ id: "dfail" });
    const plan = makePlan({ id: "pdfail", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("err"));
    await expect(usePlanStore.getState().deleteStep("pdfail", "dfail")).rejects.toThrow("err");
    expect(usePlanStore.getState().plans[0].steps).toHaveLength(1);
  });
});

describe("duplicateStep (STEP-04)", () => {
  test("duplicateStep returns null when step not found", async () => {
    const plan = makePlan({ id: "pdup0" });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    const result = await usePlanStore.getState().duplicateStep("pdup0", "nonexistent");
    expect(result).toBeNull();
  });

  test("duplicateStep name is '{original} (copy)' not 'Copy of {original}'", async () => {
    const step = makeStep({ id: "orig", name: "My Step" });
    const plan = makePlan({ id: "pdup1", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    const dup = await usePlanStore.getState().duplicateStep("pdup1", "orig");
    expect(dup!.name).toBe("My Step (copy)");
  });

  test("duplicateStep produces a new UUID different from original", async () => {
    const step = makeStep({ id: "orig2", name: "Step" });
    const plan = makePlan({ id: "pdup2", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    const dup = await usePlanStore.getState().duplicateStep("pdup2", "orig2");
    expect(dup!.id).not.toBe("orig2");
  });

  test("duplicateStep appends duplicate after original in the steps array", async () => {
    const step = makeStep({ id: "orig3" });
    const plan = makePlan({ id: "pdup3", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    await usePlanStore.getState().duplicateStep("pdup3", "orig3");
    expect(usePlanStore.getState().plans[0].steps).toHaveLength(2);
    expect(usePlanStore.getState().plans[0].steps[0].id).toBe("orig3"); // original first
  });

  test("duplicateStep rolls back on persist failure", async () => {
    const step = makeStep({ id: "dfail2" });
    const plan = makePlan({ id: "pdfail2", steps: [step] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("err"));
    await expect(usePlanStore.getState().duplicateStep("pdfail2", "dfail2")).rejects.toThrow("err");
    expect(usePlanStore.getState().plans[0].steps).toHaveLength(1);
  });
});

describe("reorderSteps (STEP-05)", () => {
  test("reorderSteps moves a step from fromIndex to toIndex", async () => {
    const s1 = makeStep({ id: "r1", name: "A" });
    const s2 = makeStep({ id: "r2", name: "B" });
    const s3 = makeStep({ id: "r3", name: "C" });
    const plan = makePlan({ id: "preorder", steps: [s1, s2, s3] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    // Move index 2 (C) to index 0 → [C, A, B]
    await usePlanStore.getState().reorderSteps("preorder", 2, 0);
    const steps = usePlanStore.getState().plans[0].steps;
    expect(steps[0].id).toBe("r3");
    expect(steps[1].id).toBe("r1");
    expect(steps[2].id).toBe("r2");
    expect(mockSave).toHaveBeenCalledOnce();
  });

  test("reorderSteps rolls back on persist failure", async () => {
    const s1 = makeStep({ id: "rr1" });
    const s2 = makeStep({ id: "rr2" });
    const plan = makePlan({ id: "preo2", steps: [s1, s2] });
    usePlanStore.setState({ plans: [plan], plansLoaded: true });
    mockSave.mockRejectedValueOnce(new Error("err"));
    await expect(usePlanStore.getState().reorderSteps("preo2", 0, 1)).rejects.toThrow("err");
    // Original order preserved
    expect(usePlanStore.getState().plans[0].steps[0].id).toBe("rr1");
  });
});
