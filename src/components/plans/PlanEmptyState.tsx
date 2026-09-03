import { ClipboardList } from "lucide-react";

/**
 * Centred empty state for the Plans view (handoff §5): the main area when no
 * plan is selected, and the step list when the selected plan has no steps.
 */
export function PlanEmptyState({
  title = "Select a plan to get started",
  hint = "Choose a plan from the list to view and edit its steps",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <ClipboardList strokeWidth={1.5} size={40} className="text-ghost" aria-hidden="true" />
      <p className="text-13 font-semibold">{title}</p>
      <p className="text-12 text-ghost">{hint}</p>
    </div>
  );
}
