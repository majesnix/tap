import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useDraftStore } from "@/stores/useDraftStore";
import { usePlanStore } from "@/stores/usePlanStore";
import { useBlockStore } from "@/stores/useBlockStore";
import { useProtoStore } from "@/stores/useProtoStore";

/**
 * Wipes everything Tap keeps on this machine apart from connection profiles:
 * history (sent payloads), drafts, plans, blocks and the recent-files list.
 * Useful after working against production data.
 */
export function ClearLocalDataButton() {
  const [open, setOpen] = useState(false);

  const clearAll = async () => {
    try {
      await Promise.all([
        useHistoryStore.getState().clearHistory(),
        useDraftStore.getState().clearAllDrafts(),
        usePlanStore.getState().clearAllPlans(),
        useBlockStore.getState().clearAllBlocks(),
      ]);
      useProtoStore.getState().setRecentFiles([]);
      toast.success("Local data cleared");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not clear local data: ${message}`);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => setOpen(true)}
        aria-label="Clear local data"
        title="Clear local data"
      >
        <Trash2 className="size-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear local data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message history (including stored payloads), drafts, plans,
              blocks and the recent-files list from this machine. Connection profiles and
              their passwords are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep data</AlertDialogCancel>
            <AlertDialogAction onClick={() => void clearAll()}>Clear everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
