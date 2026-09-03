import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { SectionLabel } from "@/components/common/SectionLabel";
import { DecodedTree } from "@/components/common/DecodedTree";
import { HexDump } from "@/components/common/HexDump";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { hexByteLength, receivedItem } from "@/components/activity/activityModel";
import { useActivityActions } from "@/components/activity/useActivityActions";
import type { FeedMessage, PlanStep, ReplyMessage } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function TealTile() {
  return (
    <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md bg-teal/12 text-teal">
      <ArrowLeft size={13} />
    </span>
  );
}

/** Dashed note used for every "there is no reply here" case. */
function ReplyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-[0_16px] rounded-lg border border-dashed border-foreground/10 p-3.5 text-12 leading-[1.5] text-ghost">
      {children}
    </div>
  );
}

// ── StepReplyPanel ────────────────────────────────────────────────────────────

interface StepReplyPanelProps {
  step: PlanStep | null;
  /** 0-based position of the step in the plan; rendered 1-based. */
  index: number;
  reply: ReplyMessage | null;
  feed: FeedMessage[];
  /** Measured wall time of the step that produced this reply. */
  durationMs?: number;
}

/** Right-hand panel of the Plans view (handoff §5 "Right panel"). */
export function StepReplyPanel({
  step,
  index,
  reply,
  feed,
  durationMs,
}: StepReplyPanelProps) {
  const [hexOpen, setHexOpen] = useState(false);
  // The feed rows own their expand state here; the Activity panel keeps its own.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const actions = useActivityActions();

  const meta = reply
    ? [
        reply.routingKey || "(none)",
        reply.correlationId ? `corr:${reply.correlationId}` : null,
        `${hexByteLength(reply.hexString)} B`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-[16px_16px_10px]">
        <SectionLabel>{step ? `Step ${index + 1} · reply` : "Reply"}</SectionLabel>
        <div className="flex-1" />
        <span className="text-12 text-muted-foreground">Reply feed · {feed.length}</span>
      </div>

      {/* Everything below the fixed header scrolls together — a long decoded
          tree must stay reachable inside the fixed-height aside. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
        {reply ? (
          <div className="m-[0_16px] flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-card p-[12px_14px]">
            <div className="flex items-center gap-2">
              <TealTile />
              <span className="min-w-0 flex-1 truncate text-13 font-medium">
                {reply.decodedAs ?? "(not decoded)"}
              </span>
              {durationMs !== undefined && (
                <span className="font-mono text-11 text-ghost">+{Math.round(durationMs)} ms</span>
              )}
            </div>
            <div className="font-mono text-11 text-ghost">{meta}</div>
            {reply.decoded !== null && (
              <div className="rounded-md bg-background p-[10px_12px]">
                <DecodedTree value={reply.decoded} />
              </div>
            )}
            <div className="flex justify-between text-11 text-muted-foreground">
              <span>
                {reply.decodedAs ? `Decoded as ${reply.decodedAs}` : "Not decoded"}
              </span>
              <button
                type="button"
                className="rounded-sm text-violet-bright outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
                onClick={() => setHexOpen(true)}
              >
                Hex
              </button>
            </div>
          </div>
        ) : step === null ? (
          <ReplyNote>Select a step to see its reply.</ReplyNote>
        ) : step.response_mode.mode === "no-wait" ? (
          <ReplyNote>
            This step does not wait for a reply. Switch its response mode to{" "}
            <span className="text-muted-foreground">correlation id</span> or{" "}
            <span className="text-muted-foreground">first arrival</span> to capture one.
          </ReplyNote>
        ) : (
          <ReplyNote>No reply captured for this step yet.</ReplyNote>
        )}

        {feed.length > 0 && (
          <div className="mt-3 flex flex-col">
            {feed.map((message) => (
              <ActivityRow
                key={message.id}
                group={{ item: receivedItem(message), reply: null }}
                expanded={expandedId === message.id}
                replyExpanded={false}
                highlighted={false}
                slideIn={false}
                onToggle={() =>
                  setExpandedId((current) => (current === message.id ? null : message.id))
                }
                onToggleReply={() => {}}
                actions={actions}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={hexOpen} onOpenChange={setHexOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply payload</DialogTitle>
            <DialogDescription>
              {reply?.decodedAs ? `Decoded as ${reply.decodedAs}` : "Wire format"} ·{" "}
              {reply ? hexByteLength(reply.hexString) : 0} bytes
            </DialogDescription>
          </DialogHeader>
          {reply && <HexDump hex={reply.hexString} maxHeight={320} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
