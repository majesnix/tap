import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { publishMessage } from "@/lib/ipc";
import { HistoryTable } from "./HistoryTable";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { filterHistoryEntries, findReplayTabIndex } from "./historyHelpers";
import type { HistoryEntry } from "@/stores/useHistoryStore";

export function MessageHistoryPanel() {
  const { entries, historyLoaded, loadHistory, clearHistory } = useHistoryStore();
  const [typeFilter, setTypeFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!historyLoaded) {
      void loadHistory();
    }
  }, [historyLoaded, loadHistory]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const filteredEntries = useMemo(
    () => filterHistoryEntries(entries, typeFilter, targetFilter, debouncedSearch),
    [entries, typeFilter, targetFilter, debouncedSearch]
  );

  const handleReplay = (entry: HistoryEntry) => {
    const { openFiles, activeIndex, setActiveIndex, setSelectedType, setPendingReplayValues } =
      useProtoStore.getState();
    const tabIndex = findReplayTabIndex(openFiles, entry.messageTypeName);
    if (tabIndex === -1) {
      toast.error("Replay failed: .proto file not open. Open the file first.");
      return;
    }
    // BUG-4 fix: only switch tabs if needed (setActiveIndex already no-ops on same index,
    // but we also verify the message type exists before calling setSelectedType)
    if (tabIndex !== activeIndex) {
      setActiveIndex(tabIndex);
    }
    // Verify message type exists in the target file's schema
    const targetFile = openFiles[tabIndex];
    const targetSchema = targetFile?.schema;
    if (!targetSchema?.message_map[entry.messageTypeName]) {
      toast.error("Replay failed: message type not found in schema.");
      return;
    }
    setSelectedType(entry.messageTypeName);
    setPendingReplayValues(entry.fieldValues);
    // NOTE: No explicit tab-switch-to-Hex needed here.
    // RightPanel watches pendingReplayValues (null → non-null) and auto-switches to "hex" tab.
  };

  const handleResend = async (entry: HistoryEntry) => {
    const { activeProfileName } = useConnectionStore.getState();
    if (!activeProfileName) {
      toast.error("Resend failed: No active connection profile.");
      return;
    }

    // Step 1: Pre-populate form (same as handleReplay, so user sees the form values)
    const { openFiles, activeIndex, setActiveIndex, setSelectedType, setPendingReplayValues } =
      useProtoStore.getState();
    const tabIndex = findReplayTabIndex(openFiles, entry.messageTypeName);
    if (tabIndex === -1) {
      toast.error("Message type not found in active schema");
      return;
    }
    // BUG-4 fix: only switch tabs if needed
    if (tabIndex !== activeIndex) {
      setActiveIndex(tabIndex);
    }
    // Verify message type exists in the target file's schema
    const targetFile = openFiles[tabIndex];
    const targetSchema = targetFile?.schema;
    if (!targetSchema?.message_map[entry.messageTypeName]) {
      toast.error("Resend failed: message type not found in schema.");
      return;
    }
    setSelectedType(entry.messageTypeName);
    setPendingReplayValues(entry.fieldValues);
    // NOTE: RightPanel auto-switches to "hex" tab via pendingReplayValues edge-detection.

    // Step 2: Send immediately using stored payload bytes (no re-encoding).
    // WR-02: Separate publish from history write so appendEntry failures do not
    // show a misleading "Resend failed" toast when the message was actually sent.
    try {
      await publishMessage(
        activeProfileName,
        entry.exchange,
        entry.routingKey,
        entry.payloadBytes
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Resend failed: ${message}`, { duration: 5000 });
      return;
    }

    const target = entry.exchange
      ? `${entry.exchange} → ${entry.routingKey}`
      : entry.routingKey;
    toast(`Message resent to ${target}`, { duration: 3000 });

    // History write is best-effort — a store/persistence failure must not
    // show "Resend failed" when the message was delivered successfully.
    try {
      await useHistoryStore.getState().appendEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        messageTypeName: entry.messageTypeName,
        exchange: entry.exchange,
        routingKey: entry.routingKey,
        status: "sent",
        fieldValues: entry.fieldValues,
        payloadBytes: entry.payloadBytes,
      });
    } catch (err: unknown) {
      // Non-fatal: message was sent; history record could not be persisted.
      // Log for diagnostics but do not surface to the user as a "Resend failed" toast.
      console.error("[history] appendEntry after resend failed:", err);
    }
  };

  const isFiltered = !!(typeFilter || targetFilter || debouncedSearch);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {isFiltered
            ? `${filteredEntries.length} of ${entries.length} / 100`
            : `${entries.length} / 100`}
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
      <HistoryFilterBar
        typeFilter={typeFilter}
        targetFilter={targetFilter}
        searchQuery={searchQuery}
        onTypeChange={setTypeFilter}
        onTargetChange={setTargetFilter}
        onSearchChange={setSearchQuery}
      />
      <ScrollArea className="flex-1">
        <HistoryTable
          entries={filteredEntries}
          isFiltered={isFiltered}
          onReplay={handleReplay}
          onResend={(e) => void handleResend(e)}
        />
      </ScrollArea>
    </div>
  );
}
