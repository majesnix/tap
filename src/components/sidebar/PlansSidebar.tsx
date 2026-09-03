import { useState, useEffect, useRef } from "react";
import { MoreVertical, Plus } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { SectionLabel } from "@/components/common/SectionLabel";
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
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";
import { formatClockShort } from "@/components/activity/activityModel";
import { usePlanStore } from "@/stores/usePlanStore";
import type { Plan } from "@/lib/types";

interface PlansSidebarProps {
  selectedPlanId: string | null;
  onSelectPlan: (id: string | null) => void;
  /** Plan of the most recent run in this session — adds "· ran HH:MM" to its row. */
  lastRunPlanId: string | null;
  lastRunAt: number | null;
}

// ── PlanRow ───────────────────────────────────────────────────────────────────

interface PlanRowProps {
  plan: Plan;
  isSelected: boolean;
  meta: string;
  onSelect: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function PlanRow({
  plan,
  isSelected,
  meta,
  onSelect,
  onStartRename,
  onDuplicate,
  onDelete,
}: PlanRowProps) {
  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-1 rounded-lg p-[10px_12px]",
        isSelected
          ? "bg-primary/12 text-foreground"
          : "text-muted-foreground hover:bg-card"
      )}
      onClick={onSelect}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-13 font-medium">{plan.name}</span>
        <span className="text-11 text-ghost">{meta}</span>
      </span>
      {/* Kebab (D-04): hover-revealed, stops row click propagation (Pitfall 4) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            size={22}
            label="Plan options"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical strokeWidth={1.5} size={14} />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onStartRename()}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate()}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault(); // Pitfall 3: keep menu open until AlertDialog state is set
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

// ── InlineEditRow ─────────────────────────────────────────────────────────────

interface InlineEditRowProps {
  initialValue: string;
  isSelected: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function InlineEditRow({ initialValue, isSelected, onCommit, onCancel }: InlineEditRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false); // Pitfall 2: guard against blur commit after Escape

  // Select all text on mount (D-07/D-08: pre-fill + all text selected)
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = e.currentTarget.value.trim();
      if (trimmed) onCommit(trimmed); // non-empty: commit
      else onCancel(); // D-09: empty name = cancel (do not persist blank)
    }
    if (e.key === "Escape") {
      cancellingRef.current = true; // set flag BEFORE blur fires
      onCancel();
      e.currentTarget.blur();
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return; // Escape already handled — don't commit
    }
    const trimmed = e.currentTarget.value.trim();
    if (trimmed) onCommit(trimmed); // blur = commit (non-empty)
    else onCancel(); // D-09: empty name = cancel
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-lg p-[10px_12px]",
        isSelected ? "bg-primary/12" : ""
      )}
    >
      <input
        ref={inputRef}
        type="text"
        autoFocus
        defaultValue={initialValue}
        aria-label="Plan name"
        className="w-full border-b border-border bg-transparent text-13 font-medium outline-none"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}

// ── PlansSidebar ──────────────────────────────────────────────────────────────

export function PlansSidebar({
  selectedPlanId,
  onSelectPlan,
  lastRunPlanId,
  lastRunAt,
}: PlansSidebarProps) {
  const { plans, plansLoaded, renamePlan, duplicatePlan, deletePlan, createPlan } =
    usePlanStore();
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null); // controlled AlertDialog state
  const [renamingId, setRenamingId] = useState<string | null>(null); // which row is in inline-rename mode
  const [isCreating, setIsCreating] = useState(false); // inline create row visible

  // D-11: loadPlans() is called in App.tsx at mount — PlansSidebar does NOT call it.
  function metaFor(plan: Plan): string {
    const steps = `${plan.steps.length} steps`;
    return plan.id === lastRunPlanId && lastRunAt !== null
      ? `${steps} · ran ${formatClockShort(lastRunAt)}`
      : steps;
  }

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-[16px_12px]">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <SectionLabel>Plans</SectionLabel>
        <IconButton
          size={24}
          tone="violet"
          label="New plan"
          disabled={!plansLoaded}
          onClick={() => setIsCreating(true)}
        >
          <Plus strokeWidth={1.5} size={15} />
        </IconButton>
      </div>

      {plansLoaded && plans.length === 0 && !isCreating && (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-13 font-medium text-muted-foreground">No plans yet</p>
          <p className="text-11 text-ghost">Create a plan to get started</p>
        </div>
      )}

      {plansLoaded &&
        plans.map((plan) =>
          renamingId === plan.id ? (
            <InlineEditRow
              key={plan.id}
              initialValue={plan.name}
              isSelected={plan.id === selectedPlanId}
              onCommit={(name) => {
                renamePlan(plan.id, name).catch((err) =>
                  console.error("[PlansSidebar] renamePlan failed:", err)
                );
                setRenamingId(null);
              }}
              onCancel={() => setRenamingId(null)}
            />
          ) : (
            <PlanRow
              key={plan.id}
              plan={plan}
              meta={metaFor(plan)}
              isSelected={plan.id === selectedPlanId}
              onSelect={() => onSelectPlan(plan.id)}
              onStartRename={() => setRenamingId(plan.id)}
              onDuplicate={() =>
                duplicatePlan(plan.id).catch((err) =>
                  console.error("[PlansSidebar] duplicatePlan failed:", err)
                )
              }
              onDelete={() => setPlanToDelete(plan)}
            />
          )
        )}

      {/* Inline create row — appears at the bottom of the list */}
      {plansLoaded && isCreating && (
        <InlineEditRow
          key="__new__"
          initialValue="Untitled Plan"
          isSelected={false}
          onCommit={(name) => {
            setIsCreating(false);
            createPlan(name).catch((err) =>
              console.error("[PlansSidebar] createPlan failed:", err)
            );
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <div className="flex-1" />

      <SidebarFooter />

      {/* AlertDialog rendered at component root — NEVER inside DropdownMenuItem (Pitfall 3) */}
      <AlertDialog
        open={!!planToDelete}
        onOpenChange={(open) => {
          if (!open) setPlanToDelete(null);
        }}
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
                  const wasSelected = selectedPlanId === id;
                  deletePlan(id).catch((err) =>
                    console.error("[PlansSidebar] deletePlan failed:", err)
                  );
                  if (wasSelected) onSelectPlan(null); // D-13: reset selection on delete
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
