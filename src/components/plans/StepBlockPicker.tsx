import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockStore } from "@/stores/useBlockStore";
import { usePlanStore } from "@/stores/usePlanStore";
import type { Block } from "@/stores/useBlockStore";
import type { PlanStep } from "@/lib/types";

interface StepBlockPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  onSelectStep: (id: string) => void;
}

export function StepBlockPicker({
  open,
  onOpenChange,
  planId,
  onSelectStep,
}: StepBlockPickerProps) {
  const blocks = useBlockStore((s) => s.blocks);
  const { addStep } = usePlanStore();

  async function handleSelectBlock(block: Block) {
    // D-12: proto_path and message_type left blank — user sets manually after import
    const newStep: PlanStep = {
      id: crypto.randomUUID(),
      name: block.name,
      proto_path: "",
      message_type: "",
      field_values: block.content,
      target: { kind: "queue", queue: "" },
      response_mode: { mode: "no-wait", delay_ms: 200 },
    };

    try {
      await addStep(planId, newStep);
      onSelectStep(newStep.id);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to import step from block library:", err);
      toast.error("Failed to add step. Please try again.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 flex flex-col">
        <SheetHeader>
          <SheetTitle>Import from block library</SheetTitle>
          <SheetDescription>
            Select a block to pre-fill the new step.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0 mt-4">
          {blocks.length === 0 ? (
            <div className="flex items-center justify-center text-muted-foreground text-xs p-4 text-center h-full">
              No blocks saved yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="px-4 py-2 hover:bg-muted/50 cursor-pointer flex flex-col gap-0.5"
                  onClick={() => handleSelectBlock(block)}
                >
                  <span className="text-sm truncate">{block.name}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
