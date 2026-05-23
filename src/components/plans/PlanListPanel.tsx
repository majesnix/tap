import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical } from "lucide-react";
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
import type { Plan } from "@/lib/types";

interface PlanListPanelProps {
  selectedPlanId: string | null;
  onSelectPlan: (id: string | null) => void;
}

interface PlanRowProps {
  plan: Plan;
  isSelected: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function PlanRow({ plan, isSelected, onSelect, onStartRename, onDuplicate, onDelete }: PlanRowProps) {
  return (
    <div
      className={cn(
        "flex items-center py-2 px-3 cursor-pointer",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <span className="text-sm truncate flex-1">{plan.name}</span>
      {/* Kebab button (D-04): always visible, stops row click propagation (Pitfall 4) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Plan options"
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
              e.preventDefault();  // Pitfall 3: keep menu open until AlertDialog state is set
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

interface InlineEditRowProps {
  initialValue: string;
  isSelected: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function InlineEditRow({ initialValue, isSelected, onCommit, onCancel }: InlineEditRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);  // Pitfall 2: guard against blur commit after Escape

  // Select all text on mount (D-07/D-08: pre-fill + all text selected)
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = e.currentTarget.value.trim();
      if (trimmed) onCommit(trimmed);  // non-empty: commit
      else onCancel();                 // D-09: empty name = cancel (do not persist blank)
    }
    if (e.key === "Escape") {
      cancellingRef.current = true;    // set flag BEFORE blur fires
      onCancel();
      e.currentTarget.blur();
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return;                          // Escape already handled — don't commit
    }
    const trimmed = e.currentTarget.value.trim();
    if (trimmed) onCommit(trimmed);    // blur = commit (non-empty)
    else onCancel();                   // D-09: empty name = cancel
  }

  return (
    <div className={cn(
      "flex items-center py-2 px-3",
      isSelected ? "bg-accent text-accent-foreground" : ""
    )}>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        defaultValue={initialValue}
        aria-label="Plan name"
        className="text-sm bg-transparent border-b border-border focus:outline-none w-full"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}

export function PlanListPanel({ selectedPlanId, onSelectPlan }: PlanListPanelProps) {
  const { plans, plansLoaded, renamePlan, duplicatePlan, deletePlan, createPlan } = usePlanStore();
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);  // controlled AlertDialog state
  const [renamingId, setRenamingId] = useState<string | null>(null);    // which row is in inline-rename mode
  const [isCreating, setIsCreating] = useState(false);                   // inline create row visible

  // D-11: loadPlans() is called in App.tsx at mount — PlanListPanel does NOT call loadPlans()
  // PlanListPanel reads plansLoaded only to gate the list render

  return (
    <div className="w-72 border-r border-border flex flex-col shrink-0 bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Plans</h2>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          disabled={!plansLoaded}
          onClick={() => setIsCreating(true)}
        >
          <Plus size={14} />New Plan
        </Button>
      </div>
      {/* Plan list */}
      <ScrollArea className="flex-1 min-h-0">
        {plansLoaded && plans.length === 0 && !isCreating && (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-muted-foreground font-medium">No plans yet</p>
            <p className="text-xs text-muted-foreground">
              Create a plan to get started
            </p>
          </div>
        )}
        {plansLoaded && plans.map((plan) => (
          renamingId === plan.id
            ? <InlineEditRow
                key={plan.id}
                initialValue={plan.name}
                isSelected={plan.id === selectedPlanId}
                onCommit={(name) => {
                  void renamePlan(plan.id, name);
                  setRenamingId(null);
                }}
                onCancel={() => setRenamingId(null)}
              />
            : <PlanRow
                key={plan.id}
                plan={plan}
                isSelected={plan.id === selectedPlanId}
                onSelect={() => onSelectPlan(plan.id)}
                onStartRename={() => setRenamingId(plan.id)}
                onDuplicate={() => void duplicatePlan(plan.id)}
                onDelete={() => setPlanToDelete(plan)}
              />
        ))}
        {/* Inline create row — appears at bottom when isCreating */}
        {plansLoaded && isCreating && (
          <InlineEditRow
            key="__new__"
            initialValue="Untitled Plan"
            isSelected={false}
            onCommit={(name) => {
              setIsCreating(false);
              void createPlan(name);
            }}
            onCancel={() => setIsCreating(false)}
          />
        )}
      </ScrollArea>
      {/* AlertDialog rendered at component root — NEVER inside DropdownMenuItem or ScrollArea (Pitfall 3) */}
      <AlertDialog
        open={!!planToDelete}
        onOpenChange={(open) => { if (!open) setPlanToDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{planToDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep plan</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (planToDelete) {
                  const id = planToDelete.id;
                  setPlanToDelete(null);
                  void deletePlan(id);
                  if (selectedPlanId === id) onSelectPlan(null);  // D-13: reset selection on delete
                }
              }}
            >
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
