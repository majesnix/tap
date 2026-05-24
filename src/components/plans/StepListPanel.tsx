import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical, GripVertical } from "lucide-react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Plan, PlanStep, StepStatus, ReplyMessage } from "@/lib/types";
import { StepStatusBadge } from "./StepStatusBadge";
import { StepHistoryPicker } from "./StepHistoryPicker";
import { StepBlockPicker } from "./StepBlockPicker";

// ── InlineEditRow ─────────────────────────────────────────────────────────────
// Copied verbatim from PlanListPanel.tsx pattern — all three behaviors required:
// 1. autoFocus, 2. select-all on mount, 3. cancellingRef guard on Escape

interface InlineEditRowProps {
  initialValue: string;
  isSelected: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InlineEditRow({ initialValue, isSelected, onCommit, onCancel }: InlineEditRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);  // guard against blur commit after Escape

  // Select all text on mount
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = e.currentTarget.value.trim();
      if (trimmed) onCommit(trimmed);
      else onCancel();
    }
    if (e.key === "Escape") {
      cancellingRef.current = true;  // set flag BEFORE blur fires
      onCancel();
      e.currentTarget.blur();
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return;  // Escape already handled — don't commit
    }
    const trimmed = e.currentTarget.value.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  }

  return (
    <div
      className={cn(
        "flex items-center py-2 px-3",
        isSelected ? "bg-accent text-accent-foreground" : ""
      )}
    >
      <div className="mr-1 w-4 shrink-0" /> {/* grip placeholder — not draggable while renaming */}
      <input
        ref={inputRef}
        type="text"
        autoFocus
        defaultValue={initialValue}
        aria-label="Step name"
        className="text-sm bg-transparent border-b border-border focus:outline-none w-full"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}

// ── SortableStepRow ───────────────────────────────────────────────────────────

interface SortableStepRowProps {
  step: PlanStep;
  isSelected: boolean;
  isActiveStep: boolean;
  stepStatus: StepStatus | undefined;
  stepErrorMsg: string | undefined;
  stepReplies: Record<string, ReplyMessage>;
  onSelect: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableStepRow({
  step,
  isSelected,
  isActiveStep,
  stepStatus,
  stepErrorMsg,
  stepReplies,
  onSelect,
  onStartRename,
  onDuplicate,
  onDelete,
}: SortableStepRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  // D-10: scroll the active step into view when it becomes active
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActiveStep) {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActiveStep]);

  // Combine sortable ref + row ref via callback ref
  function setRef(el: HTMLDivElement | null) {
    (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setSortableRef(el);
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setRef}
      style={style}
      className={cn(
        "flex items-center py-2 px-3 cursor-pointer select-none",
        isSelected || isActiveStep
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/50",
        isDragging && "opacity-50"
      )}
      onClick={onSelect}
    >
      {/* Listeners on GripVertical ONLY — not the whole row (RESEARCH Pitfall 5) */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab mr-1 shrink-0 touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} className="text-muted-foreground" />
      </div>
      <span className="text-sm truncate flex-1">{step.name}</span>
      {/* StepStatusBadge — shown when execution is in progress or completed (RUN-03) */}
      {stepStatus !== undefined && (
        <StepStatusBadge status={stepStatus} errorMsg={stepErrorMsg} />
      )}
      {/* Reply indicator dot — shown when step has a stored reply (RESP-04) */}
      {stepReplies[step.id] != null && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
          aria-label="has reply"
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => onStartRename()}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate()}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();  // prevent menu close before stepToDelete is set (Pitfall 8)
              onDelete();
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── StepListPanel ─────────────────────────────────────────────────────────────

interface StepListPanelProps {
  plan: Plan;
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  activeDragId: string | null;
}

export function StepListPanel({
  plan,
  selectedStepId,
  onSelectStep,
  activeDragId: _activeDragId,
}: StepListPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [stepToDelete, setStepToDelete] = useState<PlanStep | null>(null);
  // Picker open state — pickers implemented in Plan 04
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);

  const { addStep, updateStep, deleteStep, duplicateStep, plansLoaded } = usePlanStore();

  // Execution state — stepStatuses, activeStepId, stepReplies, setPaneMode from usePlanExecutionStore (RUN-03, D-10, RESP-04)
  const { stepStatuses, stepErrors, activeStepId, stepReplies, setPaneMode } = usePlanExecutionStore();

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

  async function handleRenameCommit(stepId: string, newName: string) {
    setRenamingId(null);
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
    <div className="w-60 border-r border-border flex flex-col shrink-0 bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Steps</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              disabled={!plansLoaded}
            >
              <Plus size={14} />
              Add step
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={handleAddBlank}>Blank step</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHistoryPickerOpen(true)}>
              From history
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setBlockPickerOpen(true)}>
              From block library
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Step list */}
      <ScrollArea className="flex-1 min-h-0">
        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-muted-foreground font-medium">No steps yet</p>
            <p className="text-xs text-muted-foreground">
              Use the + button to add your first step.
            </p>
          </div>
        )}
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {steps.map((step) =>
            renamingId === step.id ? (
              <InlineEditRow
                key={step.id}
                initialValue={step.name}
                isSelected={selectedStepId === step.id}
                onCommit={(name) => handleRenameCommit(step.id, name)}
                onCancel={() => setRenamingId(null)}
              />
            ) : (
              <SortableStepRow
                key={step.id}
                step={step}
                isSelected={selectedStepId === step.id}
                isActiveStep={activeStepId === step.id}
                stepStatus={stepStatuses[step.id]}
                stepErrorMsg={stepErrors[step.id]}
                stepReplies={stepReplies}
                onSelect={() => {
                  // D-03: second click on same step while paneMode === 'reply' toggles back to editor
                  const { paneMode } = usePlanExecutionStore.getState();
                  if (selectedStepId === step.id && paneMode === 'reply') {
                    setPaneMode('editor');
                    return;
                  }
                  onSelectStep(step.id);
                  if (stepReplies[step.id]) {
                    setPaneMode('reply');
                  } else {
                    setPaneMode('editor');
                  }
                }}
                onStartRename={() => {
                  onSelectStep(step.id);
                  setRenamingId(step.id);
                }}
                onDuplicate={() => handleDuplicate(step.id)}
                onDelete={() => setStepToDelete(step)}
              />
            )
          )}
        </SortableContext>
      </ScrollArea>

      {/* AlertDialog at component root — NOT inside ScrollArea (RESEARCH Pitfall 8) */}
      <AlertDialog
        open={!!stepToDelete}
        onOpenChange={(open) => { if (!open) setStepToDelete(null); }}
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
        onSelectStep={(id) => {
          onSelectStep(id);
        }}
      />
      <StepBlockPicker
        open={blockPickerOpen}
        onOpenChange={setBlockPickerOpen}
        planId={plan.id}
        onSelectStep={(id) => {
          onSelectStep(id);
        }}
      />
    </div>
  );
}
