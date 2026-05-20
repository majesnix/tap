import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { fetchQueues, fetchQueueDepth } from "@/lib/ipc";

interface ResponseQueuePickerProps {
  onDrain: (count: number) => void;
}

export function ResponseQueuePicker({ onDrain }: ResponseQueuePickerProps) {
  const [managementAuthError, setManagementAuthError] = useState<string | null>(null);
  const [drainCount, setDrainCount] = useState<number>(10);

  const { activeProfileName, connectionStatus } = useConnectionStore();
  const {
    queueList,
    isLiveMode,
    selectedQueue,
    isLoading,
    lastReadAt,
    queueDepth,
    setQueueList,
    setSelectedQueue,
    setQueueDepth,
  } = useResponseStore();

  // Queue fetch on tab focus — useEffect with [activeProfileName] dep (D-06: populates on tab focus)
  useEffect(() => {
    if (!activeProfileName) return;
    let cancelled = false;

    const fetch = async () => {
      try {
        const qs = await fetchQueues(activeProfileName);
        if (cancelled) return;
        setManagementAuthError(null);
        setQueueList(qs, true); // isLive = true
      } catch (err: unknown) {
        if (cancelled) return;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.startsWith("Management API authentication failed")) {
          setManagementAuthError(errMsg);
          setQueueList([], false);
        } else {
          setManagementAuthError(null);
          setQueueList([], false); // isLive = false → Manual mode
        }
      }
    };
    void fetch();
    return () => {
      cancelled = true;
    };
  }, [activeProfileName, setQueueList, setManagementAuthError]);

  // Refresh depth whenever the selected queue or last read changes
  useEffect(() => {
    if (!activeProfileName || !selectedQueue) {
      setQueueDepth(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const depth = await fetchQueueDepth(activeProfileName, selectedQueue);
        if (!cancelled) setQueueDepth(depth);
      } catch {
        if (!cancelled) setQueueDepth(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileName, selectedQueue, lastReadAt, setQueueDepth]);

  const canDrain =
    connectionStatus === "connected" &&
    selectedQueue.trim().length > 0 &&
    !isLoading;

  return (
    <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
      {/* Live dropdown vs Manual text input */}
      {isLiveMode ? (
        <Select value={selectedQueue} onValueChange={setSelectedQueue}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select queue…" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {queueList.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          placeholder="Queue name"
          className="w-48"
          value={selectedQueue}
          onChange={(e) => setSelectedQueue(e.target.value)}
        />
      )}

      {/* Live / Manual / Auth-error badge */}
      {managementAuthError ? (
        <Badge variant="destructive" className="text-xs">
          {managementAuthError}
        </Badge>
      ) : isLiveMode ? (
        <Badge variant="outline" className="text-xs gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Live
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Manual
        </Badge>
      )}

      {/* Queue depth pill — only shown when depth is known */}
      {queueDepth !== null && (
        <Badge variant="secondary" className="text-xs tabular-nums">
          {queueDepth === 0 ? "empty" : `${queueDepth} msg${queueDepth === 1 ? "" : "s"}`}
        </Badge>
      )}

      {/* Drain count input */}
      <input
        type="number"
        min={1}
        max={500}
        value={drainCount}
        onChange={(e) => setDrainCount(Number(e.target.value))}
        onBlur={() => {
          const clamped =
            isNaN(drainCount) || drainCount < 1
              ? 10
              : drainCount > 500
              ? 500
              : drainCount;
          setDrainCount(clamped);
        }}
        className="w-12 h-9 text-sm text-center rounded-md border border-input bg-background px-1"
        aria-label="Drain count"
      />

      {/* Drain button — disabled+tooltip when disconnected */}
      {connectionStatus === "connected" ? (
        <Button
          variant="default"
          disabled={!canDrain}
          onClick={() => onDrain(drainCount)}
          aria-label="Drain"
        >
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Drain
        </Button>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="default" disabled>
                  Drain
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Connect to a RabbitMQ profile to drain.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
