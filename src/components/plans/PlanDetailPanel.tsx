import { ClipboardList, ListChecks } from "lucide-react";
import type { Plan } from "@/lib/types";

interface PlanDetailPanelProps {
  selectedPlan: Plan | null;
}

export function PlanDetailPanel({ selectedPlan }: PlanDetailPanelProps) {
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
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 h-full p-6 text-center">
      <ListChecks size={40} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold">No steps yet</p>
      <p className="text-xs text-muted-foreground">
        Steps will appear here once you add them
      </p>
    </div>
  );
}
