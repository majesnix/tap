import { Loader2 } from "lucide-react";
import { Tag, type TagTone } from "@/components/common/Tag";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StepStatus } from "@/lib/types";

// ── Badge config map ──────────────────────────────────────────────────────────

interface BadgeConfig {
  tone: TagTone;
  text: string;
  showSpinner: boolean;
}

const BADGE_CONFIG: Record<StepStatus, BadgeConfig> = {
  pending: { tone: "neutral", text: "PENDING", showSpinner: false },
  sending: { tone: "warning", text: "SENDING", showSpinner: false },
  "waiting-response": { tone: "warning", text: "WAITING", showSpinner: true },
  done: { tone: "success", text: "DONE", showSpinner: false },
  error: { tone: "danger", text: "ERROR", showSpinner: false },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface StepStatusBadgeProps {
  status: StepStatus;
  errorMsg?: string;
}

/**
 * Status pill for a plan step (handoff §5: h18 px7 radius 999, 10/700 caps).
 * When status is 'error' and errorMsg is provided, wraps the pill in a Tooltip
 * so the user can inspect the failure reason after the toast is gone.
 */
export function StepStatusBadge({ status, errorMsg }: StepStatusBadgeProps) {
  const { tone, text, showSpinner } = BADGE_CONFIG[status];

  const badge = (
    <Tag tone={tone} size="xs" className="gap-1">
      {showSpinner && <Loader2 size={9} strokeWidth={1.5} className="animate-spin" />}
      {text}
    </Tag>
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
