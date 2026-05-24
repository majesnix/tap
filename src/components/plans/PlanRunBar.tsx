import { Play, Square } from "lucide-react";
import { usePlanRunner } from "@/hooks/usePlanRunner";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import { usePlanStore } from "@/stores/usePlanStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Plan } from "@/lib/types";

// ── PlanRunBar ─────────────────────────────────────────────────────────────────

interface PlanRunBarProps {
  plan: Plan;
}

export function PlanRunBar({ plan }: PlanRunBarProps) {
  const { startRun, stopRun, isRunning } = usePlanRunner();
  const { summary } = usePlanExecutionStore();
  const { updatePlan } = usePlanStore();
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);

  const stopOnError = plan.stop_on_error ?? true;

  // Disable conditions (T-22-10: double-submit prevented by isRunning check)
  const hasSteps = plan.steps.length > 0;
  const hasProfile = activeProfileName !== null;
  const canRun = hasSteps && hasProfile && !isRunning;

  // Tooltip message for disabled run button
  let disableReason: string | null = null;
  if (!hasSteps) {
    disableReason = "Add at least one step to run this plan";
  } else if (!hasProfile) {
    disableReason = "Connect to a profile first";
  }

  // Summary display — shown when run completed (isRunning is false, summary is set)
  const showSummary = summary !== null && !isRunning;
  const isSuccess = showSummary && summary.succeeded === summary.total;

  function handleToggleStopOnError(checked: boolean) {
    updatePlan(plan.id, { stop_on_error: checked }).catch(console.error);
  }

  // ── Run button slot ───────────────────────────────────────────────────────────
  // Three states: running (Stop Run), post-run (Re-run Plan + summary), idle (Run Plan)

  let runSlot: React.ReactNode;

  if (isRunning) {
    // Running: destructive Stop Run button
    runSlot = (
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5 shrink-0"
        onClick={() => { stopRun().catch(console.error); }}
      >
        <Square size={14} />
        Stop Run
      </Button>
    );
  } else if (showSummary) {
    // Post-run: summary line + Re-run Plan button
    runSlot = (
      <div className="flex items-center gap-3 shrink-0">
        {isSuccess ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            ✓ {summary.succeeded}/{summary.total} succeeded
          </span>
        ) : (
          <span className="text-destructive font-semibold text-sm">
            ✗ {summary.succeeded}/{summary.total} succeeded
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => { startRun(plan).catch(console.error); }}
        >
          Re-run Plan
        </Button>
      </div>
    );
  } else {
    // Idle: Run Plan button (possibly disabled with tooltip)
    const runButton = (
      <Button
        variant="default"
        size="sm"
        className="gap-1.5 shrink-0"
        disabled={!canRun}
        onClick={() => { startRun(plan).catch(console.error); }}
      >
        <Play size={14} />
        Run Plan
      </Button>
    );

    if (!canRun && disableReason) {
      // Wrap in Tooltip using <span> to handle disabled button (shadcn Tooltip + disabled pattern)
      runSlot = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                {runButton}
              </span>
            </TooltipTrigger>
            <TooltipContent>{disableReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      runSlot = runButton;
    }
  }

  return (
    <div className="flex items-center gap-4 bg-card border-b border-border px-4 py-2 shrink-0">
      {/* Plan name — truncated, takes remaining space */}
      <span className="text-sm font-medium truncate flex-1">{plan.name}</span>

      {/* Stop on error toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          id={`stop-on-error-${plan.id}`}
          checked={stopOnError}
          disabled={isRunning}
          onCheckedChange={handleToggleStopOnError}
        />
        <Label
          htmlFor={`stop-on-error-${plan.id}`}
          className="text-sm cursor-pointer"
        >
          Stop on error
        </Label>
      </div>

      {/* Run / Stop / Re-run slot */}
      {runSlot}
    </div>
  );
}
