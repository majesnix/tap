import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { HistoryTable } from "./HistoryTable";

export function MessageHistoryPanel() {
  const { entries, historyLoaded, loadHistory, clearHistory } = useHistoryStore();

  useEffect(() => {
    if (!historyLoaded) {
      void loadHistory();
    }
  }, [historyLoaded, loadHistory]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {entries.length} / 100
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => void clearHistory()}
        >
          Clear
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <HistoryTable entries={entries} />
      </ScrollArea>
    </div>
  );
}
