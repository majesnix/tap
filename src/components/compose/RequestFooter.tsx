import { Copy, Download, LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HexDump } from "@/components/common/HexDump";
import { IconButton } from "@/components/common/IconButton";
import { Kbd } from "@/components/common/Kbd";
import { HexStrip } from "@/components/compose/HexStrip";
import { OutcomeChip } from "@/components/compose/OutcomeChip";
import type { usePublish } from "@/components/compose/usePublish";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";
import { useProtoStore } from "@/stores/useProtoStore";
import { hexToBytes } from "@/lib/bytes";

interface RequestFooterProps {
  publish: ReturnType<typeof usePublish>;
  targetName: string;
  messageFullName: string;
  hexOpen: boolean;
  onToggleHex: () => void;
}

/** The wire bytes, the last delivery outcome and the Send button. */
export function RequestFooter({
  publish,
  targetName,
  messageFullName,
  hexOpen,
  onToggleHex,
}: RequestFooterProps) {
  const hexPreview = useProtoStore((s) => s.hexPreview);
  const encodeError = useProtoStore((s) => s.encodeError);
  const { modSymbol } = usePlatformLabel();

  const byteCount = hexPreview.replace(/\s+/g, "").length / 2;
  const shortName = messageFullName.split(".").pop() || "message";

  const copyHex = async () => {
    try {
      await navigator.clipboard.writeText(hexPreview);
      toast.success("Hex copied");
    } catch {
      toast.error("Could not copy the hex to the clipboard");
    }
  };

  const saveBin = async () => {
    try {
      const path = await save({
        defaultPath: `${shortName}.bin`,
        filters: [{ name: "Binary", extensions: ["bin"] }],
      });
      if (!path) return; // cancelled — say nothing
      await writeFile(path, hexToBytes(hexPreview));
      toast.success(`Saved ${shortName}.bin`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save the payload: ${message}`);
    }
  };

  const sendLabel = publish.isSending
    ? "Sending…"
    : `Send to ${targetName || "a destination"}`;

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-foreground/[.02]">
      <div className="flex items-center gap-3 px-[18px] py-3">
        <HexStrip
          hex={hexPreview}
          byteCount={byteCount}
          encodeError={encodeError}
          open={hexOpen}
          onToggle={onToggleHex}
        />

        {publish.outcome && (
          <OutcomeChip
            outcome={publish.outcome}
            outcomeAt={publish.outcomeAt}
            onDismiss={publish.dismissOutcome}
          />
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* A disabled button swallows pointer events, so the tooltip needs a wrapper. */}
              <span>
                <Button
                  size="lg"
                  className="gap-2 pl-3.5 pr-2"
                  disabled={!publish.canSend || publish.isSending}
                  onClick={publish.send}
                >
                  {publish.isSending ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {sendLabel}
                  <Kbd>{modSymbol}↵</Kbd>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {publish.disabledReason ?? `${modSymbol}+Enter`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {hexOpen && (
        <div className="px-[18px] pb-3.5">
          <div className="flex items-center justify-between pb-2">
            <span className="font-mono text-11 text-ghost">
              wire format · {byteCount} bytes · {messageFullName}
            </span>
            <div className="flex gap-0.5">
              <IconButton size={26} label="Copy hex" onClick={() => void copyHex()}>
                <Copy size={14} />
              </IconButton>
              <IconButton size={26} label="Save .bin" onClick={() => void saveBin()}>
                <Download size={14} />
              </IconButton>
            </div>
          </div>
          <HexDump hex={hexPreview} />
        </div>
      )}
    </div>
  );
}
