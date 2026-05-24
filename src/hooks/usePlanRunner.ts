import { toast } from "sonner";
import { executeStep, cancelPlanRun } from "../lib/ipc";
import { usePlanExecutionStore } from "../stores/usePlanExecutionStore";
import { useConnectionStore } from "../stores/useConnectionStore";
import type { Plan } from "../lib/types";

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Sequential plan runner hook. Orchestrates the execution loop:
 * iterate steps → invoke execute_step → update usePlanExecutionStore status
 * → check stop_on_error → continue or abort. (D-15, RUN-01)
 *
 * Pattern analog: SubscribePanel.tsx — encapsulates IPC lifecycle (start/stop
 * actions, reactive state from Zustand store, in-flight cancellation guard).
 */
export function usePlanRunner() {
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);

  const {
    setRunning,
    setStepStatus,
    setActiveStep,
    setIsCancelling,
    setSummary,
    finishRun,
    isRunning,
    setStepReply,
    setPaneMode,
    setStepError,
    appendReplyFeedEntry,
  } = usePlanExecutionStore();

  /**
   * Execute all steps in the plan sequentially, one at a time.
   * Transitions each step through Pending → Sending → (WaitingResponse) → Done/Error.
   * Respects stop_on_error (default: true) and isCancelling flag (pitfall #8).
   */
  async function startRun(plan: Plan): Promise<void> {
    // D-13 guard: caller (PlanRunBar) ensures activeProfileName is set, but be
    // defensive — if no profile, bail immediately (Rule 2: missing input validation)
    if (!activeProfileName) {
      toast.error("No active connection profile — select a profile first");
      return;
    }

    const stepIds = plan.steps.map((s) => s.id);

    // Initialize all steps to 'pending' immediately so Pending badges appear
    // before any step executes. (D-14, RUN-03, success criteria SC#1)
    setRunning(plan.id, stepIds);

    const total = plan.steps.length;
    // D-07: absence of stop_on_error is treated as true for backward compat
    const stopOnError = plan.stop_on_error ?? true;
    let succeeded = 0;

    for (const step of plan.steps) {
      setActiveStep(step.id);

      // Transition to 'sending' before the IPC call
      setStepStatus(step.id, "sending");

      // For reply modes, transition to 'waiting-response' immediately before
      // the await — both amber states use the same className per UI-SPEC
      if (step.response_mode.mode !== "no-wait") {
        setStepStatus(step.id, "waiting-response");
      }

      try {
        // D-04: reset pane to editor before each step so the next step starts fresh
        setPaneMode('editor');
        const result = await executeStep(activeProfileName, step);

        if (result.status === "done") {
          setStepStatus(step.id, "done");
          if (result.reply !== null) {
            setStepReply(step.id, result.reply);
            setPaneMode('reply');
            appendReplyFeedEntry({
              id: crypto.randomUUID(),
              routingKey: result.reply.routingKey,
              exchange: '',
              contentType: result.reply.contentType,
              timestamp: Date.now(),
              decoded: result.reply.decoded,
              hexString: result.reply.hexString,
              error: null,
              decodedAs: result.reply.decodedAs,
            });
          }
          succeeded++;
        } else {
          // result.status === 'error'
          const errMsg = result.error ?? "Unknown error";
          setStepStatus(step.id, "error");
          setStepError(step.id, errMsg);
          toast.error(`Step '${step.name}' failed: ${errMsg}`);

          // Break on stopOnError (user-configured) OR isCancelling (Stop clicked).
          // Both require aborting remaining steps. The Rust guard is cleared after
          // cancel, so the loop must break before the next executeStep call.
          const { isCancelling } = usePlanExecutionStore.getState();
          if (stopOnError || isCancelling) {
            break;
          }
        }
      } catch (err: unknown) {
        // Unexpected throw from executeStep (should not happen in normal operation)
        const message = err instanceof Error ? err.message : "Unknown error";
        setStepStatus(step.id, "error");
        setStepError(step.id, message);
        toast.error(`Step '${step.name}' failed: ${message}`);

        const { isCancelling } = usePlanExecutionStore.getState();
        if (stopOnError || isCancelling) {
          break;
        }
      }
    }

    setActiveStep(null);

    // Store summary then mark run complete. finishRun() clears runningPlanId +
    // activeStepId but keeps stepStatuses and summary visible for UI display.
    // Do NOT call clearRun() here — that would erase the badges and summary line.
    setSummary(succeeded, total);
    finishRun();
  }

  /**
   * Stop the in-flight plan run.
   * Sets isCancelling=true BEFORE calling cancelPlanRun() so that by the time
   * the in-flight execute_step resolves with an error, the flag is already set
   * (pitfall #8, T-22-09 isCancelling flag race mitigation).
   *
   * Does NOT call clearRun() — stepStatuses remain visible post-cancel.
   */
  async function stopRun(): Promise<void> {
    setIsCancelling(true);
    await cancelPlanRun();
  }

  return { startRun, stopRun, isRunning };
}
