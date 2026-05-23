import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { usePlanStore } from "@/stores/usePlanStore";
import { useProtoStore } from "@/stores/useProtoStore";
import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { PlanStep } from "@/lib/types";

interface StepHistoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  onSelectStep: (id: string) => void;
}

export function StepHistoryPicker({
  open,
  onOpenChange,
  planId,
  onSelectStep,
}: StepHistoryPickerProps) {
  const entries = useHistoryStore((s) => s.entries);
  const { addStep } = usePlanStore();
  const openFiles = useProtoStore((s) => s.openFiles);

  async function handleSelectEntry(entry: HistoryEntry) {
    // D-10: resolve proto path — use entry.protoPath if present, else auto-match by messageTypeName
    const resolvedPath =
      entry.protoPath ??
      openFiles.find(
        (f) => f.schema?.message_map[entry.messageTypeName] !== undefined
      )?.filePath ??
      null;

    if (!resolvedPath) {
      toast.error(
        `Open the .proto file for ${entry.messageTypeName} first, then retry.`
      );
      return;
    }

    // D-11: construct new PlanStep from history entry
    const newStep: PlanStep = {
      id: crypto.randomUUID(),
      name:
        entry.messageTypeName.split(".").pop() ?? entry.messageTypeName,
      proto_path: resolvedPath,
      message_type: entry.messageTypeName,
      field_values: JSON.stringify(entry.fieldValues),
      // Reconstruct target: exchange==="" means queue-mode (RESEARCH §Open Questions)
      target:
        entry.exchange === ""
          ? { kind: "queue", queue: entry.routingKey }
          : {
              kind: "exchange",
              exchange: entry.exchange,
              routing_key: entry.routingKey,
            },
      response_mode: { mode: "no-wait", delay_ms: 200 },
    };

    try {
      await addStep(planId, newStep);
      onSelectStep(newStep.id);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to import step from history:", err);
      toast.error("Failed to add step. Please try again.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 flex flex-col">
        <SheetHeader>
          <SheetTitle>Import from history</SheetTitle>
          <SheetDescription>
            Select an entry to pre-fill the new step.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0 mt-4">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center text-muted-foreground text-xs p-4 text-center h-full">
              No history yet. Send a message first.
            </div>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="cursor-pointer hover:bg-muted/50 px-4 py-2 flex flex-col gap-0.5"
                  onClick={() => handleSelectEntry(entry)}
                >
                  <span className="text-xs font-mono text-muted-foreground">
                    {entry.timestamp.slice(11, 19)}
                  </span>
                  <span
                    className="text-sm truncate"
                    title={entry.messageTypeName}
                  >
                    {entry.messageTypeName.split(".").pop() ??
                      entry.messageTypeName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {entry.exchange
                      ? `${entry.exchange} → ${entry.routingKey}`
                      : entry.routingKey}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
