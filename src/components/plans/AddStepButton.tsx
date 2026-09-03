import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AddStepButtonProps {
  disabled?: boolean;
  onAddBlank: () => void;
  onFromHistory: () => void;
  onFromBlock: () => void;
}

/** Dashed "+ Add step — blank · from history · from block" row (handoff §5). */
export function AddStepButton({
  disabled = false,
  onAddBlank,
  onFromHistory,
  onFromBlock,
}: AddStepButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/12 text-12 text-muted-foreground transition-colors outline-none hover:border-border-strong hover:text-violet-bright focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus size={14} />
          Add step
          <span className="text-ghost">— blank · from history · from block</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onAddBlank()}>Blank step</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onFromHistory()}>From history</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onFromBlock()}>
          From block library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
