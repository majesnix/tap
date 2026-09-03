import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Pencil } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { previewJson, type BlockFit } from "@/components/blocks/blockFit";
import type { Block } from "@/stores/useBlockStore";
import { cn } from "@/lib/utils";

interface BlockCardProps {
  block: Block;
  fit: BlockFit;
  onEdit: (block: Block) => void;
}

/** A single block in the drawer list — draggable onto the request form, with a JSON preview and optional fit hint. */
export function BlockCard({ block, fit, onEdit }: BlockCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border bg-background p-[10px_12px] cursor-grab active:cursor-grabbing hover:border-border-strong",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-center gap-2">
        <GripVertical size={14} strokeWidth={1.5} className="shrink-0 text-ghost" />
        <span className="flex-1 truncate text-13 font-medium">{block.name}</span>
        <IconButton size={22} label={`Edit ${block.name}`} onClick={() => onEdit(block)}>
          <Pencil size={13} strokeWidth={1.5} />
        </IconButton>
      </div>
      <div className="truncate pl-[22px] font-mono text-11 text-ghost">
        {previewJson(block.content)}
      </div>
      {fit && (
        <div className={cn("pl-[22px] text-11", fit.tone === "success" ? "text-success" : "text-warning")}>
          {fit.label}
        </div>
      )}
    </div>
  );
}
