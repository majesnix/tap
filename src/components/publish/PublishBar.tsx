import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useProtoStore } from "@/stores/useProtoStore";
import { useAmqpStore } from "@/stores/useAmqpStore";
import { fetchExchanges, fetchQueues, publishMessage } from "@/lib/ipc";
import { AmqpPropertiesSheet } from "@/components/publish/AmqpPropertiesSheet";

type Mode = "queue" | "exchange";

/**
 * Compute the exchange + routingKey args for publish_message IPC.
 *
 * PUBL-01 (queue mode): exchange = "" (AMQP default exchange), routingKey = queue name.
 *   exchange MUST be empty string — NOT "amq.default" or "default".
 * PUBL-02 (exchange mode): exchange = named exchange, routingKey = explicit routing key.
 */
export function buildPublishArgs(
  mode: "queue" | "exchange",
  selectedQueue: string,
  selectedExchange: string,
  routingKey: string,
): { exchange: string; routingKey: string } {
  if (mode === "queue") {
    return { exchange: "", routingKey: selectedQueue };
  }
  return { exchange: selectedExchange, routingKey };
}

/** Decode a hex string like "0a 05 68 65 6c 6c 6f" to an array of bytes. */
function hexToBytes(hex: string): number[] {
  // hexPreview format: "0a 05 68 65 6c 6c 6f" (space-separated hex pairs)
  return hex
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((h) => parseInt(h, 16))
    .filter((b) => Number.isInteger(b) && b >= 0 && b <= 255);
}

export function PublishBar() {
  const [mode, setMode] = useState<Mode>("queue");
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [routingKey, setRoutingKey] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);

  const {
    activeProfileName,
    connectionStatus,
    managementStatus,
    managementAuthError,
    queues,
    exchanges,
    setQueues,
    setExchanges,
    setManagementStatus,
    setManagementAuthError,
    setConnectionStatus,
  } = useConnectionStore();

  const { hexPreview } = useProtoStore();

  // Fetch queues or exchanges on mount and whenever profile or mode changes.
  // Implements 401 discrimination: auth failure → destructive badge, NOT silent Manual fallback.
  useEffect(() => {
    if (!activeProfileName) return;

    const fetchTargets = async () => {
      try {
        if (mode === "queue") {
          const qs = await fetchQueues(activeProfileName);
          // Clear stale auth error only on successful fetch
          setManagementAuthError(null);
          setQueues(qs);
          setManagementStatus("live");
        } else {
          const exs = await fetchExchanges(activeProfileName);
          // Clear stale auth error only on successful fetch
          setManagementAuthError(null);
          setExchanges(exs);
          setManagementStatus("live");
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // CRITICAL: Discriminate 401 (auth error) from unavailability (port/404).
        // AppError::ManagementApiAuthFailed serializes to:
        //   "Management API authentication failed: wrong credentials (HTTP 401)"
        // We match on the substring "authentication failed" to distinguish it.
        if (errMsg.includes("authentication failed")) {
          // 401 — surface as a visible error; do NOT fall back to Manual
          setManagementAuthError(errMsg);
          // Leave managementStatus unchanged — do not set "manual"
        } else {
          // Port unreachable (is_connect) or 404 (plugin not enabled) — silent fallback
          // Clear any stale auth error before showing Manual badge
          setManagementAuthError(null);
          setManagementStatus("manual");
        }
      }
    };

    fetchTargets();
  }, [activeProfileName, mode]);

  const isConnected = connectionStatus === "connected";
  const hasTarget = mode === "queue" ? Boolean(selectedQueue) : Boolean(selectedExchange);
  const canSend = isConnected && hasTarget;

  const handleSend = async () => {
    if (!activeProfileName || !canSend) return;

    const targetName = mode === "queue" ? selectedQueue : selectedExchange;
    if (!targetName) return;

    // Use buildPublishArgs to compute PUBL-01 / PUBL-02 args
    const { exchange, routingKey: targetRoutingKey } = buildPublishArgs(
      mode,
      selectedQueue,
      selectedExchange,
      routingKey,
    );

    if (!hexPreview) {
      toast.error("Send failed: No encoded message. Fill out the form first.");
      return;
    }

    const payload = hexToBytes(hexPreview);
    // Capture AMQP properties synchronously BEFORE any await (Pitfall 3)
    const { properties } = useAmqpStore.getState();
    const amqpProps = {
      contentType: properties.contentType ?? undefined,
      deliveryMode: properties.deliveryMode ?? undefined,
      ttl: properties.ttl ?? undefined,
      correlationId: properties.correlationId ?? undefined,
      replyTo: properties.replyTo ?? undefined,
      headers:
        properties.headers.length > 0
          ? properties.headers.map((h) => [h.key, h.value] as [string, string])
          : null,
    };

    setIsSending(true);
    try {
      await publishMessage(activeProfileName, exchange, targetRoutingKey, payload, amqpProps);
      // D-13: success toast, 3 seconds, non-blocking
      toast(`Message sent to ${targetName}`, { duration: 3000 });
      // D-15: form retains all field values — do NOT reset the form
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // D-14: failure toast, destructive, 5 seconds
      toast.error(`Send failed: ${message}`, { duration: 5000 });
      // On AMQP error, update connection status to error
      setConnectionStatus("error", message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center gap-4 flex-wrap bg-card border-b border-border px-4 py-2">
      {/* Mode toggle: Queue | Exchange */}
      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
        className="flex gap-1 w-auto grid-cols-none"
      >
        <div className="flex items-center">
          <RadioGroupItem
            value="queue"
            id="mode-queue"
            aria-label="Queue"
            className="sr-only"
          />
          <label
            htmlFor="mode-queue"
            className={`cursor-pointer rounded border px-3 py-1 text-sm font-semibold transition-colors ${
              mode === "queue"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-input hover:bg-muted"
            }`}
          >
            Queue
          </label>
        </div>
        <div className="flex items-center">
          <RadioGroupItem
            value="exchange"
            id="mode-exchange"
            aria-label="Exchange"
            className="sr-only"
          />
          <label
            htmlFor="mode-exchange"
            className={`cursor-pointer rounded border px-3 py-1 text-sm font-semibold transition-colors ${
              mode === "exchange"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-input hover:bg-muted"
            }`}
          >
            Exchange
          </label>
        </div>
      </RadioGroup>

      {/* Target picker + Management API status badge */}
      <div className="flex items-center gap-2">
        {managementStatus === "live" ? (
          <Select
            value={mode === "queue" ? selectedQueue : selectedExchange}
            onValueChange={mode === "queue" ? setSelectedQueue : setSelectedExchange}
          >
            <SelectTrigger className="w-48">
              <SelectValue
                placeholder={mode === "queue" ? "Select queue…" : "Select exchange…"}
              />
            </SelectTrigger>
            <SelectContent>
              {(mode === "queue" ? queues : exchanges).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder={mode === "queue" ? "Queue name" : "Exchange name"}
            className="w-48"
            value={mode === "queue" ? selectedQueue : selectedExchange}
            onChange={(e) =>
              mode === "queue"
                ? setSelectedQueue(e.target.value)
                : setSelectedExchange(e.target.value)
            }
          />
        )}

        {/* Management API status badge — 401 takes priority over Live/Manual */}
        {managementAuthError ? (
          <Badge variant="destructive" className="text-xs">
            {managementAuthError}
          </Badge>
        ) : managementStatus === "live" ? (
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
      </div>

      {/* Routing key — Exchange mode only */}
      {mode === "exchange" && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Routing Key</label>
          <Input
            placeholder="Routing key"
            className="w-48"
            value={routingKey}
            onChange={(e) => setRoutingKey(e.target.value)}
          />
        </div>
      )}

      {/* Properties button — opens AMQP properties sheet */}
      <Button variant="outline" size="sm" onClick={() => setPropertiesOpen(true)}>
        Properties
      </Button>

      {/* Send button — disabled with tooltip when no active connection */}
      {isConnected ? (
        <Button
          variant="default"
          disabled={!canSend || isSending}
          onClick={handleSend}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send
        </Button>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="default" disabled>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Connect to a RabbitMQ profile to send.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <AmqpPropertiesSheet open={propertiesOpen} onOpenChange={setPropertiesOpen} />
    </div>
  );
}
