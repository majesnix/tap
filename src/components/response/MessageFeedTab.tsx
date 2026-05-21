import { useState, useMemo } from "react";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { drainMessages } from "@/lib/ipc";
import { toast } from "sonner";
import { Accordion } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ResponseQueuePicker } from "./ResponseQueuePicker";
import { SubscribePanel } from "./SubscribePanel";
import { MessageFeedRow } from "./MessageFeedRow";

/**
 * Replaces ResponseTab. Renders the queue picker toolbar + FIFO-500 accordion feed.
 * handleDrain: calls drainMessages with selectedDecodeTypes from store (D-19, D-20).
 */
export function MessageFeedTab() {
  const [mode, setMode] = useState<"drain" | "subscribe">("drain");

  // Filter state — local only, not persisted (D-03)
  const [filterRoutingKey, setFilterRoutingKey] = useState("");
  // Three-state: null = All, "__none__" = match null contentType, string = exact match (D-04)
  const [filterContentType, setFilterContentType] = useState<string | null>(null);

  const { connectionStatus, activeProfileName } = useConnectionStore();
  const {
    selectedQueue,
    messages,
    selectedDecodeTypes,
    subscribeStatus,
    appendMessages,
    clearMessages,
    setIsLoading,
    setLastReadAt,
  } = useResponseStore();

  // Dynamic content-type options from current messages (D-04)
  const contentTypeOptions = useMemo(() => {
    const seen = new Set<string | null>();
    for (const msg of messages) {
      seen.add(msg.contentType);
    }
    return Array.from(seen).sort((a, b) => {
      if (a === null) return 1;   // null sorts last, shown as "(none)"
      if (b === null) return -1;
      return a.localeCompare(b);
    });
  }, [messages]);

  // Filtered message list — AND combination of both filters (D-05)
  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => {
      const keyMatch =
        !filterRoutingKey ||
        msg.routingKey.toLowerCase().includes(filterRoutingKey.toLowerCase());
      // Three-state sentinel for content-type (D-04)
      const typeMatch =
        filterContentType === null ||
        (filterContentType === "__none__"
          ? msg.contentType === null
          : msg.contentType === filterContentType);
      return keyMatch && typeMatch;
    });
  }, [messages, filterRoutingKey, filterContentType]);

  // Mode toggle is locked while subscribe is active (D-06)
  const isModeLocked = subscribeStatus === "Running" || subscribeStatus === "Stopping";

  const isConnected = connectionStatus === "connected";

  const handleDrain = async (count: number) => {
    if (!isConnected || !activeProfileName || selectedDecodeTypes.length === 0) return;
    if (!selectedQueue.trim()) return;

    setIsLoading(true);
    try {
      const outcome = await drainMessages(
        activeProfileName,
        selectedQueue,
        selectedDecodeTypes,   // D-19: ordered candidate list
        count,
      );

      if (outcome.messages.length === 0 && !outcome.partialError) {
        toast.info("Queue is empty"); // D-03
      }

      if (outcome.partialError) {
        toast.error(`Drain stopped early: ${outcome.partialError}`);
      }

      if (outcome.messages.length > 0) {
        const totalAfterPrepend = outcome.messages.length + messages.length;
        if (totalAfterPrepend > 500) {
          toast.info(`Feed capped at 500 — ${totalAfterPrepend - 500} older message(s) removed`);
        }
        appendMessages(outcome.messages);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Drain failed: ${message}`);
    } finally {
      setIsLoading(false);
      setLastReadAt(Date.now()); // CONS-04: always refresh queue depth, even on error
    }
  };

  const handleExport = async () => {
    // D-07: default filename with ISO timestamp, colons replaced for filesystem compat
    const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 16);
    const defaultPath = `feed-export-${timestamp}.json`;

    const filePath = await save({
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return; // D-08: user cancelled — silent, no toast

    // D-09: export only visibleMessages (filtered), not full messages[]
    // D-12: wrapped envelope
    const payload = {
      exportedAt: new Date().toISOString(),
      messageCount: visibleMessages.length,
      // D-10: curated subset — omit id and hexString
      messages: visibleMessages.map(({ routingKey, exchange, contentType, timestamp: ts, decodedAs, decoded, error }) => ({
        routingKey,
        exchange,
        contentType,
        // D-11: epoch seconds → ISO string; null if not set by publisher
        timestamp: ts !== null ? new Date(ts * 1000).toISOString() : null,
        decodedAs,
        decoded,
        error,
      })),
    };

    try {
      await writeTextFile(filePath, JSON.stringify(payload, null, 2));
      toast.success(`Exported ${visibleMessages.length} messages`); // D-13
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Export failed: ${message}`);
    }
  };

  const messageCount = messages.length;
  const visibleCount = visibleMessages.length;
  const isFiltered = filterRoutingKey !== "" || filterContentType !== null;
  const countLabel =
    messageCount === 0
      ? "No messages"
      : isFiltered
        ? `${visibleCount} of ${messageCount} messages`
        : messageCount === 1
          ? "1 message"
          : `${messageCount} messages`;

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle — Drain ↔ Subscribe (D-04, D-06) */}
      <div className="px-4 pt-2 pb-1 border-b border-border flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as "drain" | "subscribe")}
          disabled={isModeLocked}
        >
          <ToggleGroupItem value="drain">Drain</ToggleGroupItem>
          <ToggleGroupItem value="subscribe">Subscribe</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Toolbar — queue picker shared between modes; drain controls hidden in subscribe mode */}
      <ResponseQueuePicker
        onDrain={(count) => void handleDrain(count)}
        mode={mode}
      />

      {/* Subscribe controls — shown in subscribe mode only */}
      {mode === "subscribe" && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
          <SubscribePanel
            selectedQueue={selectedQueue}
            decodeTypes={selectedDecodeTypes}
            profileName={activeProfileName ?? ""}
          />
        </div>
      )}

      {/* Filter row — always visible, placement per D-01, layout per D-02 */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Input
          placeholder="Filter by routing key"
          value={filterRoutingKey}
          onChange={(e) => setFilterRoutingKey(e.target.value)}
          className="flex-1 h-7 text-xs"
        />
        <Select
          value={filterContentType ?? "all"}
          onValueChange={(v) => setFilterContentType(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-52 h-7 text-xs">
            <SelectValue placeholder="All content-types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All content-types</SelectItem>
            {contentTypeOptions.map((ct) => (
              <SelectItem key={ct ?? "__none__"} value={ct ?? "__none__"}>
                {ct ?? "(none)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleExport()}
          disabled={visibleMessages.length === 0}
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Feed header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <span className="text-sm font-semibold">{countLabel}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearMessages}
                disabled={messageCount === 0}
                aria-label="Clear feed"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear feed</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Feed body */}
      <ScrollArea className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">
            Select a queue and choose a mode
          </p>
        ) : visibleMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">
            No messages match filter
          </p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {visibleMessages.map((msg) => (
              <MessageFeedRow key={msg.id} message={msg} />
            ))}
          </Accordion>
        )}
      </ScrollArea>
    </div>
  );
}
