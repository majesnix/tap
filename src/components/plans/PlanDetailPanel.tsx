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
import { StepListPanel } from "./StepListPanel";
import { StepFieldEditor } from "./StepFieldEditor";
import { usePlanStore } from "@/stores/usePlanStore";
import type { Plan } from "@/lib/types";

interface PlanDetailPanelProps {
  selectedPlan: Plan | null;
}

export function PlanDetailPanel({ selectedPlan }: PlanDetailPanelProps) {
  // selectedStepId is LOCAL React state — NOT in usePlanStore (D-12 pattern, matches Phase 20)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { reorderSteps } = usePlanStore();

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
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

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
    <div className="flex flex-1 min-h-0 min-w-0">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <StepListPanel
          plan={selectedPlan}
          selectedStepId={selectedStepId}
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
      <StepFieldEditor
        step={selectedStep}
        planId={planId}
      />
    </div>
  );
}
