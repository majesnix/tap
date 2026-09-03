import { useState } from "react";
import { ArrowLeft, Binary, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecodedTree } from "@/components/common/DecodedTree";
import { base64ToHex } from "@/lib/bytes";
import { HexViewDialog } from "./HexViewDialog";
import { formatClock, type ActivityItem } from "./activityModel";
import type { ActivityActions } from "./useActivityActions";

const BAD_PAYLOAD_NOTE = "The stored payload is not valid base64 and cannot be shown.";

/** Spaced hex for the row's payload; persisted base64 may be corrupt, so guard it. */
function hexOf(item: ActivityItem): { hex: string; note?: string } {
  if (item.kind === "received") return { hex: item.message.hexString };
  try {
    return { hex: base64ToHex(item.entry.payloadBase64) };
  } catch {
    return { hex: "", note: BAD_PAYLOAD_NOTE };
  }
}

function DecodedBlock({ item }: { item: ActivityItem }) {
  if (item.kind === "received") {
    if (item.message.error) {
      return <p className="font-mono text-12 text-danger break-all">{item.message.error}</p>;
    }
    if (!item.message.decoded) {
      return <p className="text-12 text-ghost">No decoded content</p>;
    }
    return <DecodedTree value={item.message.decoded} />;
  }
  if (Object.keys(item.entry.fieldValues).length === 0) {
    return <p className="text-12 text-ghost">No decoded content</p>;
  }
  return <DecodedTree value={item.entry.fieldValues} />;
}

export function ActivityExpanded({
  id,
  item,
  actions,
}: {
  /** Target of the row button's aria-controls. */
  id: string;
  item: ActivityItem;
  actions: ActivityActions;
}) {
  const [hexOpen, setHexOpen] = useState(false);

  return (
    <div id={id} className="flex min-w-0 flex-col gap-2 p-[0_16px_14px_48px]">
      <div className="rounded-md border border-hairline bg-card p-[10px_12px]">
        <DecodedBlock item={item} />
      </div>
      <div className="flex items-center gap-1.5">
        {item.kind === "sent" && (
          <>
            <Button variant="outline" size="xs" onClick={() => actions.replay(item.entry)}>
              <ArrowLeft size={12} strokeWidth={1.5} />
              Load
            </Button>
            <Button variant="outline" size="xs" onClick={() => void actions.resend(item.entry)}>
              <RotateCcw size={12} strokeWidth={1.5} />
              Resend
            </Button>
          </>
        )}
        <Button variant="outline" size="xs" onClick={() => setHexOpen(true)}>
          <Binary size={12} strokeWidth={1.5} />
          Hex
        </Button>
      </div>
      <HexViewDialog
        open={hexOpen}
        onOpenChange={setHexOpen}
        title={`Binary payload — ${item.typeName}`}
        subtitle={`${formatClock(item.at)} → ${item.target}`}
        {...hexOf(item)}
        truncated={item.kind === "sent" ? item.entry.payloadTruncated : false}
      />
    </div>
  );
}
