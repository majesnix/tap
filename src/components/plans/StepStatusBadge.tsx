import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}

/**
 * Renders a shadcn Badge for the given step execution status.
 * Variant is always "outline"; className overrides apply tint + border color
 * per the UI-SPEC for each status. (RUN-03, D-14)
 */
export function StepStatusBadge({ status }: StepStatusBadgeProps) {
  const { className, text, showSpinner } = BADGE_CONFIG[status];

  return (
    <Badge variant="outline" className={className}>
      {showSpinner && (
        <Loader2 size={14} className="animate-spin mr-1" />
      )}
      {text}
    </Badge>
  );
}
