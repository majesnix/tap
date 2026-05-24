import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PlanRunBar } from "./PlanRunBar";
import { StepListPanel } from "./StepListPanel";
import { StepFieldEditor } from "./StepFieldEditor";
import { StepReplyView } from "./StepReplyView";
import { PlanReplyFeedTab } from "./PlanReplyFeedTab";
import { usePlanStore } from "@/stores/usePlanStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import type { Plan, ReplyMessage } from "@/lib/types";

interface PlanDetailPanelProps {
  selectedPlan: Plan | null;
}

export function PlanDetailPanel({ selectedPlan }: PlanDetailPanelProps) {
  // selectedStepId is LOCAL React state — NOT in usePlanStore (D-12 pattern, matches Phase 20)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { reorderSteps } = usePlanStore();

  // D-10: during a run, auto-switch the editor to show the active step's fields
  // NOTE: must be called before any early return to comply with React rules of hooks
  const { activeStepId, runningPlanId, paneMode, stepReplies, planReplyFeed, stepStatuses } = usePlanExecutionStore();
  const isRunning = runningPlanId !== null;

  // Local tab state — NOT in global store (tab strip is UI-only; paneMode controls content inside editor tab)
  const [activeTab, setActiveTab] = useState<'editor' | 'reply-feed'>('editor');

  // Pitfall 4: hasRunStarted must use stepStatuses/planReplyFeed — NOT isRunning or runningPlanId (which clear post-run)
  const hasRunStarted = Object.keys(stepStatuses).length > 0 || planReplyFeed.length > 0;

  // PointerSensor with distance: 4 per UI-SPEC (AppLayout uses 8 — intentionally different)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  if (!selectedPlan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 h-full p-6 text-center">
        <ClipboardList size={40} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold">Select a plan to get started</p>
        <p className="text-xs text-muted-foreground">
          Choose a plan from the list to view and edit its steps
        </p>
      </div>
    );
  }

  const planId = selectedPlan.id;
  const steps = selectedPlan.steps;
  const activeDragStep = activeDragId ? steps.find((s) => s.id === activeDragId) ?? null : null;

  // effectiveSelectedStepId: prefer activeStepId during run; fall back to user selection
  const effectiveSelectedStepId =
    isRunning && activeStepId !== null ? activeStepId : selectedStepId;

  const selectedStep = steps.find((s) => s.id === effectiveSelectedStepId) ?? null;

  // Derive selected step's stored reply and name for StepReplyView
  const selectedStepReply: ReplyMessage | null =
    effectiveSelectedStepId ? (stepReplies[effectiveSelectedStepId] ?? null) : null;
  const selectedStepName = selectedStep?.name ?? '';

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const fromIndex = steps.findIndex((s) => s.id === active.id);
      const toIndex = steps.findIndex((s) => s.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderSteps(planId, fromIndex, toIndex).catch(console.error);
      }
    }
    setActiveDragId(null);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0">
      {/* PlanRunBar sits above the step list + editor split (D-12, RUN-01) */}
      <PlanRunBar plan={selectedPlan} />
      <div className="flex flex-1 min-h-0 min-w-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <StepListPanel
            plan={selectedPlan}
            selectedStepId={effectiveSelectedStepId}
            onSelectStep={setSelectedStepId}
            activeDragId={activeDragId}
          />
          <DragOverlay dropAnimation={null}>
            {activeDragStep ? (
              <div className="bg-background border border-border shadow-md rounded px-3 py-2 text-sm">
                {activeDragStep.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {/* D-09: StepFieldEditor inputs disabled during run */}
        {/* RESP-04/RESP-05: show tab strip after first run; bare editor before */}
        {!hasRunStarted ? (
          <StepFieldEditor
            step={selectedStep}
            planId={planId}
            disabled={isRunning}
          />
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'editor' | 'reply-feed')}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="w-full rounded-none border-b border-border justify-start px-2">
              <TabsTrigger value="editor" className="text-xs">Step Editor</TabsTrigger>
              <TabsTrigger value="reply-feed" className="text-xs">
                Reply Feed{planReplyFeed.length > 0 ? ` (${planReplyFeed.length})` : ''}
              </TabsTrigger>
            </TabsList>
            {/* forceMount keeps StepFieldEditor mounted during Reply Feed tab display (Pitfall 1) */}
            <TabsContent
              value="editor"
              forceMount
              className={cn("flex flex-col flex-1 overflow-hidden m-0 p-0", activeTab !== 'editor' && 'hidden')}
            >
              {paneMode === 'reply' && selectedStepReply !== null
                ? <StepReplyView reply={selectedStepReply} stepName={selectedStepName} />
                : <StepFieldEditor step={selectedStep} planId={planId} disabled={isRunning} />}
            </TabsContent>
            <TabsContent value="reply-feed" className="flex flex-col flex-1 overflow-hidden m-0 p-0">
              <PlanReplyFeedTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
