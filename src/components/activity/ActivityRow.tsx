import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TagTone } from "@/components/common/Tag";
import { ActivityExpanded } from "./ActivityExpanded";
import { ReplyRow } from "./ReplyRow";
import {
  formatBytes,
  formatClock,
  STATUS_LABEL,
  STATUS_TONE,
  type ActivityGroup,
} from "./activityModel";
import type { ActivityActions } from "./useActivityActions";

/** Status text uses the tone as a bare color — no pill — on the row's first line. */
export const TONE_TEXT: Record<TagTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  teal: "text-teal",
  violet: "text-violet-bright",
  neutral: "text-muted-foreground",
};

interface ActivityRowProps {
  group: ActivityGroup;
  expanded: boolean;
  replyExpanded: boolean;
  highlighted: boolean;
  slideIn: boolean;
  onToggle: () => void;
  onToggleReply: () => void;
  actions: ActivityActions;
}

export function ActivityRow({
  group,
  expanded,
  replyExpanded,
  highlighted,
  slideIn,
  onToggle,
  onToggleReply,
  actions,
}: ActivityRowProps) {
  const { item, reply } = group;
  const isSent = item.kind === "sent";

  return (
    <div
      className={cn(
        "flex flex-col border-t border-hairline",
        expanded && "bg-foreground/[.03]",
        highlighted && "animate-row-highlight",
        slideIn && "animate-row-in"
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`activity-detail-${item.id}`}
        onClick={onToggle}
        className="flex w-full gap-2.5 p-[10px_16px] text-left hover:bg-foreground/[.03]"
      >
        <span
          className={cn(
            "mt-px inline-flex size-[22px] shrink-0 items-center justify-center rounded-md",
            isSent ? "bg-primary/12 text-violet-bright" : "bg-teal/12 text-teal"
          )}
        >
          {isSent ? (
            <ArrowRight size={13} strokeWidth={1.5} />
          ) : (
            <ArrowLeft size={13} strokeWidth={1.5} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate text-13 font-medium">{item.typeName}</span>
            <span
              className={cn(
                "text-10 font-bold tracking-[.06em]",
                TONE_TEXT[STATUS_TONE[item.status]]
              )}
            >
              {STATUS_LABEL[item.status]}
            </span>
          </span>
          <span className="flex gap-1.5 font-mono text-11 whitespace-nowrap text-ghost">
            <span className="truncate text-muted-foreground">{item.target}</span>
            <span>·</span>
            <span>{formatClock(item.at)}</span>
            <span>·</span>
            <span>{formatBytes(item.sizeBytes)}</span>
          </span>
        </span>
      </button>
      {reply && (
        <ReplyRow
          reply={reply}
          sentAt={item.at}
          expanded={replyExpanded}
          onToggle={onToggleReply}
          actions={actions}
        />
      )}
      {expanded && (
        <ActivityExpanded id={`activity-detail-${item.id}`} item={item} actions={actions} />
      )}
    </div>
  );
}
