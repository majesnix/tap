import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePlanStore } from "@/stores/usePlanStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import type { Plan, PlanStep } from "@/lib/types";
import { StepCard } from "./StepCard";
import { AddStepButton } from "./AddStepButton";
import { PlanEmptyState } from "./PlanEmptyState";
import { StepHistoryPicker } from "./StepHistoryPicker";
import { StepBlockPicker } from "./StepBlockPicker";

interface StepCardListProps {
  plan: Plan;
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  /** Measured wall time per step id, filled in by PlanView during a run. */
  durations: Record<string, number>;
  /** True while a run is in progress — freezes the inline editors. */
  disabled: boolean;
}

/** The stack of expandable step cards plus the add-step row (handoff §5). */
export function StepCardList({
  plan,
  selectedStepId,
  onSelectStep,
  durations,
  disabled,
}: StepCardListProps) {
  const [stepToDelete, setStepToDelete] = useState<PlanStep | null>(null);
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);

  const { addStep, updateStep, deleteStep, duplicateStep, plansLoaded } = usePlanStore();
  const { stepStatuses, stepErrors, stepReplies } = usePlanExecutionStore();

  const steps = plan.steps;

  async function handleAddBlank() {
    if (!plansLoaded) return;
    const newStep: PlanStep = {
      id: crypto.randomUUID(),
      name: "Untitled Step",
      proto_path: "",
      message_type: "",
      field_values: "{}",
      target: { kind: "queue", queue: "" },
      response_mode: { mode: "no-wait", delay_ms: 200 },
    };
    try {
      await addStep(plan.id, newStep);
      onSelectStep(newStep.id);
    } catch (err) {
      console.error("Failed to add step:", err);
    }
  }

  async function handleRename(stepId: string, newName: string) {
    try {
      await updateStep(plan.id, stepId, { name: newName });
    } catch (err) {
      console.error("Failed to rename step:", err);
    }
  }

  async function handleDuplicate(stepId: string) {
    try {
      const dup = await duplicateStep(plan.id, stepId);
      if (dup) onSelectStep(dup.id);
    } catch (err) {
      console.error("Failed to duplicate step:", err);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {steps.length === 0 && (
        <PlanEmptyState
          title="No steps yet"
          hint="Use the + button to add your first step."
        />
      )}

      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            planId={plan.id}
            selected={selectedStepId === step.id}
            status={stepStatuses[step.id]}
            errorMsg={stepErrors[step.id]}
            hasReply={stepReplies[step.id] != null}
            durationMs={durations[step.id]}
            disabled={disabled}
            onSelect={() => onSelectStep(step.id)}
            onRename={(name) => handleRename(step.id, name)}
            onDuplicate={() => handleDuplicate(step.id)}
            onDelete={() => setStepToDelete(step)}
          />
        ))}
      </SortableContext>

      <AddStepButton
        disabled={!plansLoaded}
        onAddBlank={handleAddBlank}
        onFromHistory={() => setHistoryPickerOpen(true)}
        onFromBlock={() => setBlockPickerOpen(true)}
      />

      {/* AlertDialog at the list root — never inside a card or a menu item */}
      <AlertDialog
        open={!!stepToDelete}
        onOpenChange={(open) => {
          if (!open) setStepToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{stepToDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep step</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (stepToDelete) {
                  const wasSelected = selectedStepId === stepToDelete.id;
                  deleteStep(plan.id, stepToDelete.id).catch(console.error);
                  if (wasSelected) onSelectStep(null);
                  setStepToDelete(null);
                }
              }}
            >
              Delete step
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StepHistoryPicker
        open={historyPickerOpen}
        onOpenChange={setHistoryPickerOpen}
        planId={plan.id}
        onSelectStep={onSelectStep}
      />
      <StepBlockPicker
        open={blockPickerOpen}
        onOpenChange={setBlockPickerOpen}
        planId={plan.id}
        onSelectStep={onSelectStep}
      />
    </div>
  );
}
