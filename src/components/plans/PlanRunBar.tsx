import { CircleAlert, CircleCheck, Play, Square } from "lucide-react";
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
import type { Plan, StepStatus } from "@/lib/types";
import { findProfile, isReadOnly } from "@/lib/profileSafety";

// ── PlanRunBar ─────────────────────────────────────────────────────────────────

interface PlanRunBarProps {
  plan: Plan;
  /** Clock time the last run in this session started. */
  lastRunAt?: number | null;
  /** Wall time the last run took, in ms. */
  lastRunMs?: number | null;
}

const RUNNING_LABEL: Partial<Record<StepStatus, string>> = {
  sending: "sending",
  "waiting-response": "waiting",
  pending: "pending",
};

/** The run bar card above the step list (handoff §5 "Run bar card"). */
export function PlanRunBar({ plan, lastRunAt, lastRunMs }: PlanRunBarProps) {
  const { startRun, stopRun, isRunning } = usePlanRunner();
  const { summary, stepStatuses, activeStepId } = usePlanExecutionStore();
  const { updatePlan } = usePlanStore();
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);
  const profiles = useConnectionStore((s) => s.profiles);
  const readOnly = isReadOnly(findProfile(profiles, activeProfileName));

  const stopOnError = plan.stop_on_error ?? true;

  // Disable conditions (T-22-10: double-submit prevented by isRunning check)
  const hasSteps = plan.steps.length > 0;
  const hasProfile = activeProfileName !== null;
  const canRun = hasSteps && hasProfile && !readOnly && !isRunning;

  // Tooltip message for the disabled run button
  let disableReason: string | null = null;
  if (!hasSteps) {
    disableReason = "Add at least one step to run this plan";
  } else if (!hasProfile) {
    disableReason = "Connect to a profile first";
  } else if (readOnly) {
    disableReason = "Profile is read-only";
  }

  // Summary display — shown when a run completed (isRunning false, summary set)
  const showSummary = summary !== null && !isRunning;
  const isSuccess = showSummary && summary.succeeded === summary.total;

  const subtitle = [
    `${plan.steps.length} steps`,
    lastRunAt != null
      ? `last run ${new Date(lastRunAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}`
      : null,
    lastRunMs != null ? `${(lastRunMs / 1000).toFixed(1)} s` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function handleToggleStopOnError(checked: boolean) {
    updatePlan(plan.id, { stop_on_error: checked }).catch(console.error);
  }

  // ── Status slot: progress chip while running, result pill after a run ───────

  let statusSlot: React.ReactNode = null;

  if (isRunning) {
    const finished = plan.steps.filter((s) => {
      const status = stepStatuses[s.id];
      return status === "done" || status === "error";
    }).length;
    const activeStatus = activeStepId ? stepStatuses[activeStepId] : undefined;
    const activeLabel = (activeStatus && RUNNING_LABEL[activeStatus]) ?? "running";
    statusSlot = (
      <span className="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-2.5 font-mono text-11 font-semibold text-warning">
        {finished} / {plan.steps.length} · {activeLabel}
      </span>
    );
  } else if (showSummary) {
    statusSlot = (
      <span
        className={`inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-12 font-semibold ${
          isSuccess ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        }`}
      >
        {isSuccess ? <CircleCheck size={13} /> : <CircleAlert size={13} />}
        {summary.succeeded} / {summary.total} succeeded
      </span>
    );
  }

  // ── Run button slot: Stop while running, Run plan / Run again otherwise ─────

  let runSlot: React.ReactNode;

  if (isRunning) {
    runSlot = (
      <Button
        variant="destructive"
        size="md"
        className="shrink-0"
        onClick={() => {
          stopRun().catch(console.error);
        }}
      >
        <Square size={14} />
        Stop
      </Button>
    );
  } else {
    const runButton = (
      <Button
        variant="default"
        size="md"
        className="shrink-0"
        disabled={!canRun}
        onClick={() => {
          startRun(plan).catch(console.error);
        }}
      >
        <Play size={14} />
        {showSummary ? "Run again" : "Run plan"}
      </Button>
    );

    if (!canRun && disableReason) {
      // Wrap in Tooltip using <span> to handle the disabled button (shadcn pattern)
      runSlot = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">{runButton}</span>
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
    <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-[14px_18px]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-16 font-semibold tracking-[-.01em]">{plan.name}</span>
        <span className="text-12 text-ghost">{subtitle}</span>
      </div>

      <div className="flex-1" />

      {statusSlot}

      <div className="flex shrink-0 items-center gap-2">
        <Switch
          id={`stop-on-error-${plan.id}`}
          checked={stopOnError}
          disabled={isRunning}
          onCheckedChange={handleToggleStopOnError}
        />
        <Label
          htmlFor={`stop-on-error-${plan.id}`}
          className="cursor-pointer text-12 text-muted-foreground"
        >
          Stop on error
        </Label>
      </div>

      {runSlot}
    </div>
  );
}
