import { useState, type ReactNode } from "react";
import { usePlanStore } from "@/stores/usePlanStore";
import { AppShell } from "@/components/layout/AppShell";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { PlanListPanel } from "./PlanListPanel";
import { PlanDetailPanel } from "./PlanDetailPanel";

interface PlanViewProps {
  header: ReactNode;
}

export function PlanView({ header }: PlanViewProps) {
  // mod+o / mod+r — see useGlobalShortcuts.ts: App mounts ComposeView or
  // PlanView, never both, so this is the one active instance of the hook.
  useGlobalShortcuts();

  // D-12: selectedPlanId is local React state — NOT in usePlanStore
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const plans = usePlanStore((s) => s.plans);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <AppShell
      header={header}
      sidebar={<PlanListPanel selectedPlanId={selectedPlanId} onSelectPlan={setSelectedPlanId} />}
      main={<PlanDetailPanel selectedPlan={selectedPlan} />}
      aside={<div />}
    />
  );
}
