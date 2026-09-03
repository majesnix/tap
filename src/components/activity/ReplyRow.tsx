import { ArrowLeft } from "lucide-react";
import { ActivityExpanded } from "./ActivityExpanded";
import { formatBytes, type ReceivedItem } from "./activityModel";
import type { ActivityActions } from "./useActivityActions";

interface ReplyRowProps {
  reply: ReceivedItem;
  /** Timestamp of the request this is a reply to, for the "+278 ms" delta. */
  sentAt: number;
  expanded: boolean;
  onToggle: () => void;
  actions: ActivityActions;
}

export function ReplyRow({ reply, sentAt, expanded, onToggle, actions }: ReplyRowProps) {
  const meta = [
    reply.message.routingKey,
    reply.correlationId ?? (reply.message.decodedAs ? "no correlation id" : "no decoder matched"),
    `+${Math.max(0, reply.at - sentAt)} ms`,
    formatBytes(reply.sizeBytes),
  ].join(" · ");

  return (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="m-[2px_16px_12px_27px] flex gap-2.5 border-l border-teal/35 pt-1.5 pl-3.5 text-left"
      >
        <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md bg-teal/12 text-teal">
          <ArrowLeft size={13} strokeWidth={1.5} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate text-13 font-medium">{reply.typeName}</span>
            <span className="text-10 font-bold tracking-[.06em] text-teal">REPLY</span>
          </span>
          <span className="truncate font-mono text-11 text-ghost">{meta}</span>
        </span>
      </button>
      {expanded && <ActivityExpanded item={reply} actions={actions} />}
    </>
  );
}
