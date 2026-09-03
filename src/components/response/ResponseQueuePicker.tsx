import { useState, useEffect, useMemo } from "react";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CatalogStatus } from "@/components/compose/CatalogStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { fetchQueueDepth } from "@/lib/ipc";
import { getQueues } from "@/lib/brokerCatalog";
import { findProfile, isReadOnly } from "@/lib/profileSafety";
import type { FeedMode } from "@/lib/types";

interface ResponseQueuePickerProps {
  onDrain: (count: number) => void;
  mode?: FeedMode;
  /**
   * Whether the surface hosting this picker is visible. The decode-as list
   * portals to document.body, so a host that only hides itself with CSS (the
   * force-mounted read-mode popover) would leave the list floating over the app.
   */
  panelOpen?: boolean;
}

const DEFAULT_COUNT = 10;
const MAX_COUNT = 500;

export function ResponseQueuePicker({
  onDrain,
  mode = "drain",
  panelOpen = true,
}: ResponseQueuePickerProps) {
  const isBatchMode = mode === "peek" || mode === "drain";
  const isPeek = mode === "peek";
  const verb = isPeek ? "Peek" : "Consume";
  const [managementAuthError, setManagementAuthError] = useState<string | null>(null);
  const [drainCount, setDrainCount] = useState<number>(DEFAULT_COUNT);
  const [decodeOpen, setDecodeOpen] = useState(false);

  const { activeProfileName, connectionStatus, profiles } = useConnectionStore();
  const readOnly = isReadOnly(findProfile(profiles, activeProfileName));
  const {
    queueList,
    isLiveMode,
    selectedQueue,
    isLoading,
    lastReadAt,
    queueDepth,
    selectedDecodeTypes,
    setQueueList,
    setSelectedQueue,
    setQueueDepth,
    setSelectedDecodeTypes,
  } = useResponseStore();

  const openFiles = useProtoStore((s) => s.openFiles);
  const selectedMessageType = useProtoStore((s) => s.selectedMessageType);

  // Close the portalled decode-as list with its host, so it cannot outlive it.
  useEffect(() => {
    if (!panelOpen) setDecodeOpen(false);
  }, [panelOpen]);

  // Queue fetch on profile change (D-06: populates when the picker becomes visible)
  useEffect(() => {
    if (!activeProfileName) return;
    let cancelled = false;

    const fetch = async () => {
      try {
        const qs = await getQueues(activeProfileName);
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

  // Seed selectedDecodeTypes with active message type on first render (D-20)
  useEffect(() => {
    if (selectedDecodeTypes.length === 0 && selectedMessageType) {
      setSelectedDecodeTypes([selectedMessageType]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessageType]); // intentionally fires once when selectedMessageType becomes available

  // Derive all available type names from all loaded proto files (deduplicated)
  const allTypeNames = useMemo(() => {
    const names = openFiles.flatMap((f) => f.schema.messages.map((m) => m.full_name));
    return [...new Set(names)];
  }, [openFiles]);

  // Toggle a type in/out of selectedDecodeTypes (immutable update)
  const toggleType = (typeName: string) => {
    const next = selectedDecodeTypes.includes(typeName)
      ? selectedDecodeTypes.filter((t) => t !== typeName)
      : [...selectedDecodeTypes, typeName];
    setSelectedDecodeTypes(next);
  };

  const decodeLabel =
    selectedDecodeTypes.length === 0
      ? "Select types…"
      : selectedDecodeTypes.length === 1
        ? selectedDecodeTypes[0]
        : `${selectedDecodeTypes.length} types`;

  const depthMeta =
    queueDepth === null
      ? undefined
      : queueDepth === 0
        ? "empty"
        : `${queueDepth} msg${queueDepth === 1 ? "" : "s"}`;

  // Peek leaves the queue as it was, so read-only profiles may peek but not consume.
  const canDrain =
    connectionStatus === "connected" &&
    selectedQueue.trim().length > 0 &&
    !isLoading &&
    selectedDecodeTypes.length > 0 &&
    !(readOnly && !isPeek);

  return (
    <div className="flex flex-col gap-2">
      {/* Live dropdown vs Manual text input */}
      {isLiveMode ? (
        <SearchableSelect
          className="w-full"
          mono
          size="sm"
          meta={depthMeta}
          value={selectedQueue}
          onChange={setSelectedQueue}
          placeholder="Select queue…"
          searchPlaceholder="Filter queues…"
          emptyText="No queues found."
          items={queueList.map((name) => ({ value: name }))}
        />
      ) : (
        <Input
          placeholder="Queue name"
          className="h-[34px] w-full font-mono text-[12.5px]"
          value={selectedQueue}
          onChange={(e) => setSelectedQueue(e.target.value)}
        />
      )}

      {/* Catalog status — live listing, manual entry, or a rejected management login */}
      <div className="flex items-center gap-1.5 text-11 text-muted-foreground">
        <CatalogStatus
          managementStatus={isLiveMode ? "live" : "manual"}
          managementAuthError={managementAuthError}
        />
        {!isLiveMode && depthMeta && <span className="font-mono text-ghost">· {depthMeta}</span>}
      </div>

      {/* Decode-as multi-select combobox (D-20) */}
      <div className="flex flex-col gap-1">
        <span className="text-11 text-muted-foreground">Decode as</span>
        <Popover open={decodeOpen} onOpenChange={setDecodeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={decodeOpen}
              aria-label="Decode as"
              className="flex h-[34px] w-full items-center gap-2 rounded-md border border-border bg-background pr-2 pl-3 text-left transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35"
            >
              <span className="flex-1 truncate font-mono text-[12.5px]">{decodeLabel}</span>
              <ChevronsUpDown size={14} strokeWidth={1.5} className="shrink-0 text-ghost" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0">
            <Command>
              <CommandInput placeholder="Filter types…" />
              <CommandList>
                <CommandEmpty>No types loaded.</CommandEmpty>
                <CommandGroup>
                  {allTypeNames.map((name) => (
                    <CommandItem key={name} value={name} onSelect={() => toggleType(name)}>
                      <Check
                        size={14}
                        strokeWidth={1.5}
                        className={cn(
                          "mr-2",
                          selectedDecodeTypes.includes(name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Batch controls — Peek and Consume only; live modes have their own panel */}
      {isBatchMode && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={MAX_COUNT}
              value={drainCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDrainCount(isNaN(n) ? DEFAULT_COUNT : n);
              }}
              onBlur={() => {
                const clamped =
                  isNaN(drainCount) || drainCount < 1
                    ? DEFAULT_COUNT
                    : drainCount > MAX_COUNT
                      ? MAX_COUNT
                      : drainCount;
                setDrainCount(clamped);
              }}
              className="h-[34px] w-16 rounded-md border border-border bg-background px-1 text-center font-mono text-[12.5px]"
              aria-label={`${verb} count`}
            />

            {/* "Consume" rather than "Drain": it takes messages off the queue and acks
                them, so other consumers never see them. */}
            {connectionStatus === "connected" ? (
              <Button
                variant="default"
                size="md"
                disabled={!canDrain}
                onClick={() => {
                  const safe =
                    isNaN(drainCount) || drainCount < 1
                      ? DEFAULT_COUNT
                      : Math.min(drainCount, MAX_COUNT);
                  if (safe !== drainCount) setDrainCount(safe);
                  onDrain(safe);
                }}
                aria-label={verb}
                title={
                  isPeek
                    ? "Reads messages and hands them back to the queue (they show as redelivered)."
                    : "Takes messages off the queue and acknowledges them. Other consumers will not receive them."
                }
              >
                {isLoading ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : null}
                {verb}
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="default" size="md" disabled>
                        {verb}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Connect to a RabbitMQ profile to {verb.toLowerCase()}.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span className="text-11 text-ghost">
            {isPeek
              ? "hands messages back to the queue"
              : readOnly
                ? "Read-only profile: consuming is disabled"
                : "removes messages"}
          </span>
        </div>
      )}
    </div>
  );
}
