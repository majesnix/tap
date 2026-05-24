import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import type { Plan, PlanStep } from "../lib/types";
import { PLAN_SCHEMA_VERSION } from "../lib/types";

const PLANS_STORE_PATH = "plans.json";
const PLANS_KEY = "plans";

// ── PlanStore interface ───────────────────────────────────────────────────────

interface PlanStore {
  plans: Plan[];
  plansLoaded: boolean;
  // NOTE: No selectedPlanId — selection is Phase 20 local React state. (D-09)
  loadPlans: () => Promise<void>;
  createPlan: (name: string) => Promise<Plan | null>;
  renamePlan: (id: string, name: string) => Promise<void>;
  /** Apply a partial Plan update optimistically with rollback on persist failure. (D-08) */
  updatePlan: (id: string, partial: Partial<Plan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  duplicatePlan: (id: string) => Promise<Plan | null>;
  // Phase 21: step-level actions
  addStep: (planId: string, step: PlanStep) => Promise<void>;
  updateStep: (planId: string, stepId: string, partial: Partial<PlanStep>) => Promise<void>;
  deleteStep: (planId: string, stepId: string) => Promise<void>;
  duplicateStep: (planId: string, stepId: string) => Promise<PlanStep | null>;
  reorderSteps: (planId: string, fromIndex: number, toIndex: number) => Promise<void>;
}

// ── Type guard ────────────────────────────────────────────────────────────────

function isPlanStep(value: unknown): value is PlanStep {
  if (typeof value !== "object" || value === null) return false;
  const v = value as PlanStep;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.proto_path === "string" &&
    typeof v.message_type === "string" &&
    typeof v.field_values === "string" && // must be string, not object (D-12)
    typeof v.target === "object" && v.target !== null &&
    typeof v.response_mode === "object" && v.response_mode !== null
  );
}

function isPlan(value: unknown): value is Plan {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Plan;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.schema_version === "number" &&
    Array.isArray(v.steps) &&
    v.steps.every(isPlanStep)
  );
}

// ── Persistence helper ────────────────────────────────────────────────────────

// NEVER call load(path, { autoSave: false }) — requires 'defaults' field (Pitfall 2)
async function persistPlans(plans: Plan[]): Promise<void> {
  const store = await load(PLANS_STORE_PATH);
  await store.set(PLANS_KEY, plans);
  await store.save();
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePlanStore = create<PlanStore>((set, get) => ({
  plans: [],
  plansLoaded: false,

  loadPlans: async () => {
    const store = await load(PLANS_STORE_PATH);
    const saved = await store.get<unknown>(PLANS_KEY);
    const plans = Array.isArray(saved) ? saved.filter(isPlan) : [];
    set({ plans, plansLoaded: true });
  },

  createPlan: async (name: string): Promise<Plan | null> => {
    // Guard: do not write before async store hydration completes (D-11)
    if (!get().plansLoaded) return null;
    const newPlan: Plan = {
      id: crypto.randomUUID(),
      name,
      schema_version: PLAN_SCHEMA_VERSION,
      steps: [],
    };
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = [...state.plans, newPlan];
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
    return newPlan;
  },

  renamePlan: async (id: string, name: string): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) => (p.id === id ? { ...p, name } : p));
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  updatePlan: async (id: string, partial: Partial<Plan>): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) => (p.id === id ? { ...p, ...partial } : p));
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  deletePlan: async (id: string): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.filter((p) => p.id !== id);
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  duplicatePlan: async (id: string): Promise<Plan | null> => {
    // Duplicate semantics (D-13):
    //   - New plan UUID
    //   - Name: "Copy of [original name]"
    //   - Steps deep-copied with new UUIDs per step; step names retained
    if (!get().plansLoaded) return null;
    const original = get().plans.find((p) => p.id === id);
    if (!original) return null;
    const duplicate: Plan = {
      id: crypto.randomUUID(),
      name: `Copy of ${original.name}`,
      schema_version: original.schema_version,
      steps: original.steps.map((step) => ({
        ...step,
        id: crypto.randomUUID(), // new UUID per step (D-13)
      })),
    };
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = [...state.plans, duplicate];
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
    return duplicate;
  },

  // ── Phase 21: Step-level actions ──────────────────────────────────────────

  addStep: async (planId: string, step: PlanStep): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) =>
        p.id === planId ? { ...p, steps: [...p.steps, step] } : p
      );
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  updateStep: async (planId: string, stepId: string, partial: Partial<PlanStep>): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) =>
        p.id === planId
          ? { ...p, steps: p.steps.map((s) => s.id === stepId ? { ...s, ...partial } : s) }
          : p
      );
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  deleteStep: async (planId: string, stepId: string): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) =>
        p.id === planId ? { ...p, steps: p.steps.filter((s) => s.id !== stepId) } : p
      );
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  duplicateStep: async (planId: string, stepId: string): Promise<PlanStep | null> => {
    if (!get().plansLoaded) return null;
    const plan = get().plans.find((p) => p.id === planId);
    const original = plan?.steps.find((s) => s.id === stepId);
    if (!original) return null;
    const duplicate: PlanStep = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`, // UI-SPEC copywriting — intentionally different from plan duplication "Copy of {name}"
    };
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) =>
        p.id === planId ? { ...p, steps: [...p.steps, duplicate] } : p
      );
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
      return duplicate;
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },

  reorderSteps: async (planId: string, fromIndex: number, toIndex: number): Promise<void> => {
    if (!get().plansLoaded) return;
    let previous: Plan[] = [];
    let updated: Plan[] = [];
    set((state) => {
      previous = state.plans;
      updated = state.plans.map((p) => {
        if (p.id !== planId) return p;
        const steps = [...p.steps];
        const [moved] = steps.splice(fromIndex, 1);
        steps.splice(toIndex, 0, moved);
        return { ...p, steps };
      });
      return { plans: updated };
    });
    try {
      await persistPlans(updated);
    } catch (err) {
      set({ plans: previous });
      throw err;
    }
  },
}));
