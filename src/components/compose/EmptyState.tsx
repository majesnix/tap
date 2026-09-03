import { FileCode, Radio, Send } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";

const STEP_CARD_CLASS =
  "flex flex-col gap-1.5 rounded-[10px] border bg-card p-3 text-left";

/** What the card shows before a .proto file is open: the three steps to a sent message. */
export function EmptyState() {
  const requestOpenFile = useProtoStore((s) => s.requestOpenFile);
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);
  const connectionStatus = useConnectionStore((s) => s.connectionStatus);
  const connected = connectionStatus === "connected" && activeProfileName;

  return (
    <div className="m-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-foreground/10">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        <img src="/tap-icon.svg" alt="" className="size-16 rounded-xl" />
        <div className="text-20 font-semibold tracking-[-.02em]">
          Send a real protobuf message in 30 seconds
        </div>
        <p className="text-14 leading-[1.55] text-muted-foreground">
          Open a .proto file and pick a message. Tap builds the form, encodes wire bytes and
          sends them to any queue or exchange.
        </p>

        <div className="grid w-full grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={requestOpenFile}
            className={`${STEP_CARD_CLASS} border-border-strong transition-colors hover:bg-surface-2`}
          >
            <FileCode size={16} strokeWidth={1.5} className="text-violet-bright" />
            <span className="text-13 font-semibold">1 · Open a .proto</span>
            <span className="text-11 text-muted-foreground">
              ⌘O · include paths remembered per file
            </span>
          </button>

          <div className={`${STEP_CARD_CLASS} border-border`}>
            <Radio size={16} strokeWidth={1.5} className="text-teal" />
            <span className="text-13 font-semibold">2 · Pick a destination</span>
            <span className="text-11 text-muted-foreground">
              queues and exchanges from the live catalog
            </span>
          </div>

          <div className={`${STEP_CARD_CLASS} border-border`}>
            <Send size={16} strokeWidth={1.5} className="text-success" />
            <span className="text-13 font-semibold">3 · Send</span>
            <span className="text-11 text-muted-foreground">
              ⌘↵ · publisher confirms shown inline
            </span>
          </div>
        </div>

        <div className="text-12 text-ghost">
          {connected ? (
            <>
              Connected to <span className="text-muted-foreground">{activeProfileName}</span>
            </>
          ) : (
            "Not connected"
          )}{" "}
          · try examples/order.proto
        </div>
      </div>
    </div>
  );
}
