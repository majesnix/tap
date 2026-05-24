import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StepStatus } from "@/lib/types";

// ── Badge config map ──────────────────────────────────────────────────────────

interface BadgeConfig {
  className: string;
  text: string;
  showSpinner: boolean;
}

const BADGE_CONFIG: Record<StepStatus, BadgeConfig> = {
  pending: {
    className: "",
    text: "Pending",
    showSpinner: false,
  },
  sending: {
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    text: "Sending",
    showSpinner: false,
  },
  "waiting-response": {
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    text: "Waiting…",
    showSpinner: true,
  },
  done: {
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    text: "Done",
    showSpinner: false,
  },
  error: {
    className: "bg-destructive/10 text-destructive border-destructive/20",
    text: "Error",
    showSpinner: false,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface StepStatusBadgeProps {
  status: StepStatus;
  errorMsg?: string;
}

/**
 * Renders a shadcn Badge for the given step execution status.
 * When status is 'error' and errorMsg is provided, wraps the badge in a
 * Tooltip so the user can inspect the failure reason after the toast is gone.
 */
export function StepStatusBadge({ status, errorMsg }: StepStatusBadgeProps) {
  const { className, text, showSpinner } = BADGE_CONFIG[status];

  const badge = (
    <Badge variant="outline" className={className}>
      {showSpinner && (
        <Loader2 size={14} className="animate-spin mr-1" />
      )}
      {text}
    </Badge>
  );

  if (status === "error" && errorMsg) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="left" className="max-w-64 break-words">
            {errorMsg}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
