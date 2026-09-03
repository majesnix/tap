import { Braces, Dices, Library, RotateCcw } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { SectionLabel } from "@/components/common/SectionLabel";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";
import type { MessageSchema } from "@/lib/types";

interface RequestHeaderProps {
  message: MessageSchema;
  hasDraft: boolean;
  isJsonMode: boolean;
  blocksOpen: boolean;
  onToggleBlocks: () => void;
  onRandomize: () => void;
  onClear: () => void;
  onToggleJson: () => void;
  /** Set while a block is dragged over the card, e.g. "Drop to fill Shipping · 5 fields". */
  dropHint: string | null;
}

/** Names the message being composed and holds the four form actions. */
export function RequestHeader({
  message,
  hasDraft,
  isJsonMode,
  blocksOpen,
  onToggleBlocks,
  onRandomize,
  onClear,
  onToggleJson,
  dropHint,
}: RequestHeaderProps) {
  const { modSymbol } = usePlatformLabel();

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-[18px] py-3.5">
      <SectionLabel>Request</SectionLabel>
      <span className="text-16 font-semibold tracking-[-.01em]">{message.name}</span>
      <span className="font-mono text-12 text-ghost">{message.full_name}</span>
      {hasDraft && <span className="whitespace-nowrap text-11 text-ghost">· draft saved</span>}

      <div className="flex-1" />

      {dropHint && <span className="text-12 text-violet-bright">{dropHint}</span>}

      <div className="flex rounded-md border border-border bg-background p-0.5">
        <IconButton
          size={28}
          className="h-[26px]"
          label="Block library"
          active={blocksOpen}
          onClick={onToggleBlocks}
        >
          <Library size={15} />
        </IconButton>
        <IconButton
          size={28}
          className="h-[26px]"
          label="Randomize"
          title="Fill empty fields with random values"
          onClick={onRandomize}
        >
          <Dices size={15} />
        </IconButton>
        <IconButton
          size={28}
          className="h-[26px]"
          label="Clear form"
          title={`Clear form (${modSymbol}+Shift+R)`}
          onClick={onClear}
        >
          <RotateCcw size={15} />
        </IconButton>
        <IconButton
          size={28}
          className="h-[26px]"
          label={isJsonMode ? "Return to form" : "Edit as JSON"}
          active={isJsonMode}
          onClick={onToggleJson}
        >
          <Braces size={15} />
        </IconButton>
      </div>
    </div>
  );
}
