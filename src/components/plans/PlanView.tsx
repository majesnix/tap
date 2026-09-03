import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { usePlanStore } from "@/stores/usePlanStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import { usePlanProtoAutoLoad } from "@/hooks/usePlanProtoAutoLoad";
import { AppShell } from "@/components/layout/AppShell";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { PlansSidebar } from "@/components/sidebar/PlansSidebar";
import { PlanRunBar } from "./PlanRunBar";
import { StepCardList } from "./StepCardList";
import { StepReplyPanel } from "./StepReplyPanel";
import { PlanEmptyState } from "./PlanEmptyState";

interface PlanViewProps {
  header: ReactNode;
}

interface LastRun {
  planId: string;
  /** Wall clock when the run started. */
  at: number;
  /** Elapsed ms once the run finished; null while it is still going. */
  ms: number | null;
}

export function PlanView({ header }: PlanViewProps) {
  // mod+o / mod+r — see useGlobalShortcuts.ts: App mounts ComposeView or
  // PlanView, never both, so this is the one active instance of the hook.
  useGlobalShortcuts();

  // D-12: selection lives in local React state — NOT in usePlanStore
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});

  const plans = usePlanStore((s) => s.plans);
  const reorderSteps = usePlanStore((s) => s.reorderSteps);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const { activeStepId, runningPlanId, stepStatuses, stepReplies, planReplyFeed } =
    usePlanExecutionStore();
  const isRunning = runningPlanId !== null;

  // Auto-load proto files referenced by the plan's steps
  usePlanProtoAutoLoad(selectedPlan?.steps ?? []);

  // Run timing: a run starts when runningPlanId becomes non-null and ends when
  // it clears again (finishRun keeps the statuses, so this is the only signal).
  const prevRunningRef = useRef<string | null>(null);
  const runStartRef = useRef(0);
  const stepStartsRef = useRef(new Map<string, number>());
  useEffect(() => {
    const previous = prevRunningRef.current;
    prevRunningRef.current = runningPlanId;
    if (runningPlanId !== null && previous !== runningPlanId) {
      runStartRef.current = performance.now();
      stepStartsRef.current.clear();
      setDurations({});
      setLastRun({ planId: runningPlanId, at: Date.now(), ms: null });
    } else if (runningPlanId === null && previous !== null) {
      const elapsed = performance.now() - runStartRef.current;
      setLastRun((run) => (run && run.planId === previous ? { ...run, ms: elapsed } : run));
    }
  }, [runningPlanId]);

  // Per-step wall time: sending → done/error.
  useEffect(() => {
    const starts = stepStartsRef.current;
    const finished: Record<string, number> = {};
    for (const [stepId, status] of Object.entries(stepStatuses)) {
      if (status === "sending" && !starts.has(stepId)) {
        starts.set(stepId, performance.now());
      }
      const start = starts.get(stepId);
      if ((status === "done" || status === "error") && start !== undefined) {
        finished[stepId] = performance.now() - start;
        starts.delete(stepId);
      }
    }
    if (Object.keys(finished).length > 0) {
      // The measurement is a clock reading taken when the runner (an external
      // system) moves a step to a terminal state — it cannot be derived during
      // render, so the effect is the right place to record it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDurations((previous) => ({ ...previous, ...finished }));
    }
  }, [stepStatuses]);

  // PointerSensor with distance: 4 per UI-SPEC (AppLayout uses 8 — intentionally different)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const steps = selectedPlan?.steps ?? [];
  // D-10: during a run the panel follows the active step, not the user's click
  const effectiveStepId = isRunning && activeStepId !== null ? activeStepId : selectedStepId;
  const stepIndex = steps.findIndex((s) => s.id === effectiveStepId);
  const selectedStep = stepIndex >= 0 ? steps[stepIndex] : null;
  const activeDragStep = activeDragId ? steps.find((s) => s.id === activeDragId) ?? null : null;
  const planLastRun = lastRun && lastRun.planId === selectedPlanId ? lastRun : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (selectedPlan && over && active.id !== over.id) {
      const fromIndex = steps.findIndex((s) => s.id === active.id);
      const toIndex = steps.findIndex((s) => s.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderSteps(selectedPlan.id, fromIndex, toIndex).catch(console.error);
      }
    }
    setActiveDragId(null);
  }

  return (
    <AppShell
      header={header}
      sidebar={
        <PlansSidebar
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          lastRunPlanId={lastRun?.planId ?? null}
          lastRunAt={lastRun?.at ?? null}
        />
      }
      main={
        selectedPlan ? (
          <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
            <PlanRunBar
              plan={selectedPlan}
              lastRunAt={planLastRun?.at ?? null}
              lastRunMs={planLastRun?.ms ?? null}
            />
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <StepCardList
                plan={selectedPlan}
                selectedStepId={effectiveStepId}
                onSelectStep={setSelectedStepId}
                durations={durations}
                disabled={isRunning}
              />
              <DragOverlay dropAnimation={null}>
                {activeDragStep ? (
                  <div className="rounded-lg border border-border-strong bg-surface-3 p-[10px_14px] text-13 shadow-lg">
                    {activeDragStep.name}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          <PlanEmptyState />
        )
      }
      aside={
        <StepReplyPanel
          step={selectedStep}
          index={stepIndex >= 0 ? stepIndex : 0}
          reply={effectiveStepId ? stepReplies[effectiveStepId] ?? null : null}
          feed={planReplyFeed}
          durationMs={effectiveStepId ? durations[effectiveStepId] : undefined}
        />
      }
    />
  );
}
