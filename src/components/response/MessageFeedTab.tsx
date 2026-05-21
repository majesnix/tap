import { useState } from "react";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { drainMessages } from "@/lib/ipc";
import { toast } from "sonner";
import { Accordion } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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

  const messageCount = messages.length;
  const countLabel =
    messageCount === 0
      ? "No messages"
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
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {messages.map((msg) => (
              <MessageFeedRow key={msg.id} message={msg} />
            ))}
          </Accordion>
        )}
      </ScrollArea>
    </div>
  );
}
