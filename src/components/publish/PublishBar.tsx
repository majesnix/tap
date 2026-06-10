import { useState, useEffect, useRef, useCallback } from "react";
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
import { useHistoryStore } from "@/stores/useHistoryStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import { fetchExchanges, fetchQueues, publishMessage, fetchBindings, listProfiles, activateProfile, encodeMessage } from "@/lib/ipc";
import { AmqpPropertiesSheet } from "@/components/publish/AmqpPropertiesSheet";
import { RoutingKeyCombobox } from "@/components/publish/RoutingKeyCombobox";
import type { PublishOutcome } from "@/lib/types";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";

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


export function PublishBar() {
  const [mode, setMode] = useState<Mode>("queue");
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [routingKey, setRoutingKey] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [bindingKeys, setBindingKeys] = useState<string[]>([]);
  const [isLoadingBindings, setIsLoadingBindings] = useState(false);
  const [useCombobox, setUseCombobox] = useState(false);

  // Phase 10: Delivery outcome badge state (D-06, D-07, D-08)
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  // D-08: ref holds the active auto-dismiss timer ID; null means no timer pending
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    profiles,
    activeProfileName,
    connectionStatus,
    managementStatus,
    managementAuthError,
    queues,
    exchanges,
    setProfiles,
    setActiveProfile,
    setConnectionStatus,
    setQueues,
    setExchanges,
    setManagementStatus,
    setManagementAuthError,
  } = useConnectionStore();

  useEffect(() => {
    if (profiles.length === 0) {
      listProfiles()
        .then((ps) => setProfiles(ps))
        .catch(() => {});
    }
  }, []);

  const handleQuickSwitch = useCallback(async (name: string) => {
    if (usePlanExecutionStore.getState().isRunning) {
      toast.warning("Cannot switch profile while a plan is running");
      return;
    }
    setActiveProfile(name);
    setConnectionStatus("disconnected");
    try {
      await activateProfile(name);
      setConnectionStatus("connected");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setConnectionStatus("error", message);
      toast.error(`Connection failed: ${message}`);
    }
  }, [setActiveProfile, setConnectionStatus]);

  // Phase 9: Derived state for combobox eligibility and hint text
  const selectedExchangeObj = exchanges.find((ex) => ex.name === selectedExchange);
  const selectedExchangeType = selectedExchangeObj?.exchange_type ?? "";
  const isHintExchange =
    selectedExchangeType === "headers" || selectedExchangeType === "fanout";
  const isEligibleForCombobox =
    !isHintExchange && managementStatus === "live" && Boolean(selectedExchange);

  const { encodeError } = useProtoStore();
  const sendRequested = useProtoStore((s) => s.sendRequested);
  const { modSymbol } = usePlatformLabel();

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

  // Phase 9: Fetch binding routing keys when eligible exchange is selected.
  // Uses stale-request guard (cancelled flag) — see ResponseQueuePicker.tsx pattern.
  // D-10: ALL errors fall back silently — never call setManagementAuthError here.
  useEffect(() => {
    if (!activeProfileName || !isEligibleForCombobox) {
      setBindingKeys([]);
      setIsLoadingBindings(false);
      setUseCombobox(false);
      return;
    }

    let cancelled = false; // stale-request guard: prevents race condition on rapid exchange switch
    setIsLoadingBindings(true);
    setUseCombobox(true); // show combobox optimistically while loading

    fetchBindings(activeProfileName, selectedExchange)
      .then((keys) => {
        if (!cancelled) {
          setBindingKeys(keys);
          setIsLoadingBindings(false);
        }
      })
      .catch(() => {
        // D-10: silent fallback — ANY error (including 401) reverts to plain <Input>.
        // CRITICAL: do NOT call setManagementAuthError here — that is reserved for
        // fetch_exchanges / fetch_queues 401 errors only.
        if (!cancelled) {
          setBindingKeys([]);
          setIsLoadingBindings(false);
          setUseCombobox(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProfileName, selectedExchange, isEligibleForCombobox]);

  // Pitfall 4: Clean up dismiss timer on unmount to prevent setOutcome on unmounted component.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const isConnected = connectionStatus === "connected";
  const hasTarget = mode === "queue" ? Boolean(selectedQueue) : Boolean(selectedExchange);
  const canSend = isConnected && hasTarget && !encodeError;

  const handleSendRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (sendRequested === 0) return;
    handleSendRef.current();
  }, [sendRequested]);

  const handleSend = useCallback(async () => {
    if (!activeProfileName || !canSend) return;

    const targetName = mode === "queue" ? selectedQueue : selectedExchange;
    if (!targetName) return;

    // D-09: cancel prior dismiss timer and clear prior badge immediately on new send.
    // Pitfall 3: without this, a fast double-click creates two timers and the first
    // prematurely clears the second send's badge.
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setOutcome(null);

    // Use buildPublishArgs to compute PUBL-01 / PUBL-02 args
    const { exchange, routingKey: targetRoutingKey } = buildPublishArgs(
      mode,
      selectedQueue,
      selectedExchange,
      routingKey,
    );

    // BUG-7 fix: re-encode from current latestValues to prevent stale-bytes race.
    // The hexPreview may be stale if the user typed values faster than the debounce settled.
    // Capturing latestValues synchronously (getState is sync) guarantees fresh bytes.
    const { latestValues, selectedMessageType, activeFilePath } = useProtoStore.getState();
    if (!selectedMessageType || !latestValues) {
      toast.error("Send failed: No form values. Fill out the form first.");
      return;
    }

    // Capture AMQP properties synchronously BEFORE any await (Pitfall 3)
    const { properties } = useAmqpStore.getState();

    let freshPayload: number[];
    try {
      freshPayload = await encodeMessage(selectedMessageType, latestValues);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Send failed: encoding error — ${msg}`);
      return;
    }
    const payload = freshPayload;
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
      // D-01: capture delivery outcome; badge replaces the success toast (PATTERNS.md §Modified Patterns).
      const result = await publishMessage(activeProfileName, exchange, targetRoutingKey, payload, amqpProps);
      setOutcome(result);

      // D-08: ACK auto-dismisses after 3s; Returned and NACK after 5s; Timeout never auto-dismisses.
      const delay: number | null =
        result.status === "ack"      ? 3000 :
        result.status === "returned" ? 5000 :
        result.status === "nack"     ? 5000 :
        null; // "timeout" — no auto-dismiss per PUBL-08

      if (delay !== null) {
        dismissTimerRef.current = setTimeout(() => setOutcome(null), delay);
      }

      // D-15: form retains all field values — do NOT reset the form

      // Record successful send to history
      void useHistoryStore.getState().appendEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        messageTypeName: selectedMessageType ?? "unknown",
        exchange,
        routingKey: targetRoutingKey,
        protoPath: activeFilePath ?? undefined, // D-10: captures active file path at send time
        status: "sent",
        fieldValues: latestValues ?? {},
        payloadBytes: payload,
      });

      // Signal RightPanel to auto-switch to History tab
      useProtoStore.getState().setLastSendAt(Date.now());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // D-14: failure toast, destructive, 5 seconds
      toast.error(`Send failed: ${message}`, { duration: 5000 });

      // Record failed send to history
      void useHistoryStore.getState().appendEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        messageTypeName: selectedMessageType ?? "unknown",
        exchange,
        routingKey: targetRoutingKey,
        protoPath: activeFilePath ?? undefined, // D-10: captures active file path at send time
        status: "failed",
        errorMessage: message,
        fieldValues: latestValues ?? {},
        payloadBytes: payload,
      });
    } finally {
      setIsSending(false);
    }
  }, [activeProfileName, canSend, mode, selectedQueue, selectedExchange, routingKey]);

  handleSendRef.current = handleSend;

  return (
    <div className="flex items-center gap-4 flex-wrap bg-card border-b border-border px-4 py-2">
      {/* Connection quick-switch dropdown (R017) */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            connectionStatus === "connected"
              ? "bg-emerald-500"
              : connectionStatus === "error"
                ? "bg-red-500"
                : "bg-amber-500"
          }`}
        />
        <Select
          value={activeProfileName ?? ""}
          onValueChange={handleQuickSwitch}
          disabled={profiles.length <= 1}
        >
          <SelectTrigger className="w-36 h-7 text-xs">
            <SelectValue placeholder="No profile" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {profiles.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            <SelectContent position="popper" className="max-h-60">
              {/* Queue list (plain) or exchange list with type badge per D-05 */}
              {mode === "exchange"
                ? exchanges.map((ex) => (
                    <SelectItem key={ex.name} value={ex.name}>
                      <span className="flex items-center gap-2">
                        {ex.name}
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground font-semibold"
                        >
                          [{ex.exchange_type}]
                        </Badge>
                      </span>
                    </SelectItem>
                  ))
                : queues.map((name) => (
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

      {/* Routing key — Exchange mode only (Phase 9: conditional combobox vs plain Input) */}
      {mode === "exchange" && (
        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Routing Key</label>
            {isEligibleForCombobox && useCombobox ? (
              <RoutingKeyCombobox
                value={routingKey}
                onChange={setRoutingKey}
                bindingKeys={bindingKeys}
                isLoading={isLoadingBindings}
              />
            ) : (
              <Input
                placeholder="Routing key"
                className="w-48"
                value={routingKey}
                onChange={(e) => setRoutingKey(e.target.value)}
              />
            )}
          </div>
          {/* D-06: Hint text for headers/fanout exchanges — routing key is irrelevant */}
          {isHintExchange && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedExchangeType === "fanout"
                ? "Routing key is ignored for fanout exchanges."
                : "Headers exchanges route by message headers, not routing key."}
            </p>
          )}
        </div>
      )}

      {/* Properties button — opens AMQP properties sheet */}
      <Button variant="outline" size="sm" onClick={() => setPropertiesOpen(true)}>
        Properties
      </Button>

      {/* D-06: Delivery outcome badge — appears inline to the left of the Send button.
          D-07: Reuses Badge component with className overrides (not new variants).
          Pattern: variant="outline" + className matches existing management status badges
          (see the Live/Manual badge pattern at the managementAuthError conditional above). */}
      {outcome && (
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={
              outcome.status === "ack"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : outcome.status === "returned"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                : outcome.status === "nack"
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : /* timeout */ "bg-muted text-muted-foreground border-border"
            }
          >
            {outcome.status === "ack"
              ? "ACK"
              : outcome.status === "returned"
              ? "Returned"
              : outcome.status === "nack"
              ? "NACK"
              : /* timeout */ "Timeout"}
          </Badge>
          {/* D-08: Pitfall 6 — ONLY the Timeout badge has a manual dismiss button.
              ACK/Returned/NACK auto-dismiss; they do not show a dismiss button. */}
          {outcome.status === "timeout" && (
            <button
              onClick={() => setOutcome(null)}
              className="text-muted-foreground hover:text-foreground text-xs ml-1"
              aria-label="Dismiss timeout badge"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Send button — disabled with tooltip when no active connection */}
      {isConnected ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>{modSymbol}+Enter</TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
