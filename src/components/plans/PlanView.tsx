import { useState } from "react";
import { usePlanStore } from "@/stores/usePlanStore";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PlanListPanel } from "./PlanListPanel";
import { PlanDetailPanel } from "./PlanDetailPanel";

interface PlanViewProps {
  onViewChange: (mode: "main" | "plans") => void;
}

export function PlanView({ onViewChange }: PlanViewProps) {
  // D-12: selectedPlanId is local React state — NOT in usePlanStore
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const plans = usePlanStore((s) => s.plans);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar — receives viewMode="plans" for active Plans nav button */}
      <aside className="w-72 min-w-60 max-w-xs border-r border-border flex flex-col shrink-0">
        <Sidebar viewMode="plans" onViewChange={onViewChange} />
      </aside>
      {/* Two-pane plan content area */}
      <div className="flex flex-1 min-w-0">
        <PlanListPanel
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
        />
        <PlanDetailPanel selectedPlan={selectedPlan} />
      </div>
    </div>
  );
}
