import { ClipboardList } from "lucide-react";

/**
 * Shared empty state for "no plan selected" (main area) and "plan without steps"
 * (above the add-step row) — handoff §5 renders both the same way.
 */
export function PlanEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <ClipboardList size={40} className="text-ghost" aria-hidden="true" />
      <p className="text-13 font-semibold">Select a plan to get started</p>
      <p className="text-12 text-ghost">
        Choose a plan from the list to view and edit its steps
      </p>
    </div>
  );
}
