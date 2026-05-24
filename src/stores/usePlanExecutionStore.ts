import { create } from "zustand";
import type { StepStatus, ReplyMessage, FeedMessage } from "../lib/types";

// ── State shape ───────────────────────────────────────────────────────────────

interface PlanExecutionState {
  runningPlanId: string | null;
  /** Step execution statuses, keyed by step.id */
  stepStatuses: Record<string, StepStatus>;
  activeStepId: string | null;
  isCancelling: boolean;
  summary: { succeeded: number; total: number } | null;
  /** Computed selector: true when runningPlanId is not null */
  isRunning: boolean;
  /** Decoded reply messages keyed by step.id (D-13) */
  stepReplies: Record<string, ReplyMessage>;
  /** Shared reply feed — FIFO-500 (D-11) */
  planReplyFeed: FeedMessage[];
  /** Controls which pane the editor/reply split shows (D-04) */
  paneMode: 'editor' | 'reply';
}

// ── Actions ───────────────────────────────────────────────────────────────────

interface PlanExecutionActions {
  /**
   * Start a new run: set runningPlanId, initialize all stepIds to 'pending',
   * clear summary and reset isCancelling. (D-14, RUN-03)
   * Also resets stepReplies, planReplyFeed, and paneMode inline (Pitfall 3, D-09).
   */
  setRunning: (planId: string, stepIds: string[]) => void;
  /**
   * Update a single step's status (immutable — does not mutate previous record).
   */
  setStepStatus: (stepId: string, status: StepStatus) => void;
  /** Update the actively executing step id (or null when between steps). */
  setActiveStep: (stepId: string | null) => void;
  /** Set the cancellation flag. Checked by runner to avoid inflating error count (pitfall #8). */
  setIsCancelling: (value: boolean) => void;
  /** Store run summary for PlanRunBar display. */
  setSummary: (succeeded: number, total: number) => void;
  /**
   * Mark run complete: clears runningPlanId and activeStepId.
   * Intentionally keeps stepStatuses, summary, stepReplies, planReplyFeed, and
   * paneMode intact so the UI can display post-run state. (D-11)
   * Do NOT call clearRun() here — that erases badges. clearRun() is called by
   * setRunning() at the start of the next run.
   */
  finishRun: () => void;
  /** Reset all state to initial values. */
  clearRun: () => void;
  /** Store a decoded reply for the given step (immutable record spread). (D-13) */
  setStepReply: (stepId: string, reply: ReplyMessage) => void;
  /** Prepend entry to planReplyFeed, capped at 500 entries (FIFO-500). (D-11) */
  appendReplyFeedEntry: (entry: FeedMessage) => void;
  /** Switch the editor/reply pane mode. (D-04) */
  setPaneMode: (mode: 'editor' | 'reply') => void;
}

type PlanExecutionStore = PlanExecutionState & PlanExecutionActions;

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: PlanExecutionState = {
  runningPlanId: null,
  stepStatuses: {},
  activeStepId: null,
  isCancelling: false,
  summary: null,
  isRunning: false,
  stepReplies: {} as Record<string, ReplyMessage>,
  planReplyFeed: [] as FeedMessage[],
  paneMode: 'editor' as const,
};

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * Ephemeral Zustand store for plan execution state. NOT persisted — no persist
 * middleware. Clears on app restart, which is intentional: partially-run plan
 * state should not survive restarts. (D-14, RUN-01)
 */
export const usePlanExecutionStore = create<PlanExecutionStore>((set) => ({
  ...INITIAL_STATE,

  setRunning: (planId, stepIds) =>
    set({
      runningPlanId: planId,
      stepStatuses: Object.fromEntries(
        stepIds.map((id) => [id, "pending" as StepStatus])
      ),
      summary: null,
      isCancelling: false,
      isRunning: true,
      stepReplies: {},
      planReplyFeed: [],
      paneMode: 'editor',
    }),

  setStepStatus: (stepId, status) =>
    set((state) => ({
      stepStatuses: { ...state.stepStatuses, [stepId]: status },
    })),

  setActiveStep: (stepId) => set({ activeStepId: stepId }),

  setIsCancelling: (value) => set({ isCancelling: value }),

  setSummary: (succeeded, total) => set({ summary: { succeeded, total } }),

  finishRun: () =>
    set({
      runningPlanId: null,
      activeStepId: null,
      isRunning: false,
    }),

  clearRun: () => set({ ...INITIAL_STATE }),

  setStepReply: (stepId, reply) =>
    set((state) => ({ stepReplies: { ...state.stepReplies, [stepId]: reply } })),

  appendReplyFeedEntry: (entry) =>
    set((s) => ({ planReplyFeed: [entry, ...s.planReplyFeed].slice(0, 500) })),

  setPaneMode: (mode) => set({ paneMode: mode }),
}));

/**
 * Raw store reference for direct `.getState()` access in tests.
 * Aliased to help differentiate hook usage (reactive) from imperative test access.
 */
export const useRawPlanExecutionStore = usePlanExecutionStore;
