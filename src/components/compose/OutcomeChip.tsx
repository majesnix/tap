import { CircleCheck, X } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { cn } from "@/lib/utils";
import type { PublishOutcome } from "@/lib/types";

interface OutcomeChipProps {
  outcome: PublishOutcome;
  /** When the broker answered; rendered as HH:MM:SS next to an ACK. */
  outcomeAt: number | null;
  onDismiss: () => void;
}

const TONE: Record<PublishOutcome["status"], string> = {
  ack: "bg-success/10 text-success",
  returned: "bg-warning/10 text-warning",
  nack: "bg-danger/10 text-danger",
  timeout: "bg-danger/10 text-danger",
};

const LABEL: Record<PublishOutcome["status"], string> = {
  ack: "ACK",
  returned: "RETURNED",
  nack: "NACK",
  timeout: "TIMEOUT",
};

/** What the broker said about the last send. Only a timeout waits for the user to dismiss it. */
export function OutcomeChip({ outcome, outcomeAt, onDismiss }: OutcomeChipProps) {
  const time = outcomeAt !== null ? new Date(outcomeAt).toLocaleTimeString("en-GB") : null;

  return (
    <span
      data-testid="outcome-chip"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs px-2 font-mono text-11 font-semibold",
        TONE[outcome.status]
      )}
    >
      {outcome.status === "ack" && <CircleCheck size={12} />}
      {LABEL[outcome.status]}
      {outcome.status === "ack" && time && ` · ${time}`}
      {outcome.status === "timeout" && (
        <IconButton
          size={22}
          label="Dismiss timeout badge"
          className="-mr-1 text-danger"
          onClick={onDismiss}
        >
          <X size={12} />
        </IconButton>
      )}
    </span>
  );
}
