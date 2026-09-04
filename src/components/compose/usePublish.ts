import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useAmqpStore } from "@/stores/useAmqpStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { encodeMessage, publishMessage } from "@/lib/ipc";
import { truncatePayloadForHistory } from "@/lib/bytes";
import {
  describeBroker,
  findProfile,
  isReadOnly,
  recordsHistory,
  requiresConfirmation,
} from "@/lib/profileSafety";
import { buildPublishArgs } from "@/components/compose/destination";
import type { useDestination } from "@/components/compose/useDestination";
import type { BrokerConfirmRequest } from "@/components/response/BrokerConfirmDialog";
import type { PublishOutcome } from "@/lib/types";

/** How long each outcome stays on screen; a timeout waits for the user. */
const DISMISS_DELAY_MS: Record<PublishOutcome["status"], number | null> = {
  ack: 3000,
  returned: 5000,
  nack: 5000,
  timeout: null,
};

/**
 * The send pipeline: re-encode the current form values, publish them, then show what the
 * broker said. Production profiles are asked for confirmation before anything leaves.
 */
export function usePublish(destination: ReturnType<typeof useDestination>) {
  const { mode, selectedQueue, selectedExchange, routingKey, hasTarget } = destination;

  const [isSending, setIsSending] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const [outcomeAt, setOutcomeAt] = useState<number | null>(null);
  const [pendingPublish, setPendingPublish] = useState<BrokerConfirmRequest | null>(null);

  // Holds the active auto-dismiss timer; null means nothing is pending.
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profiles = useConnectionStore((s) => s.profiles);
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);
  const connectionStatus = useConnectionStore((s) => s.connectionStatus);
  const encodeError = useProtoStore((s) => s.encodeError);
  const sendRequested = useProtoStore((s) => s.sendRequested);

  const activeProfile = findProfile(profiles, activeProfileName);
  const readOnly = isReadOnly(activeProfile);
  const isConnected = connectionStatus === "connected";
  const canSend = isConnected && hasTarget && !encodeError && !readOnly;

  const disabledReason = !isConnected
    ? "Connect to a RabbitMQ profile to send."
    : readOnly
      ? "Profile is read-only"
      : !hasTarget
        ? mode === "queue"
          ? "Pick a queue to send to"
          : "Pick an exchange to send to"
        : encodeError
          ? "Fix the encoding error first"
          : null;

  // Clean up the dismiss timer so a late timeout cannot touch an unmounted component.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const dismissOutcome = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setOutcome(null);
    setOutcomeAt(null);
  }, []);

  const handleSend = useCallback(async () => {
    if (!activeProfileName || !canSend) return;

    const targetName = mode === "queue" ? selectedQueue : selectedExchange;
    if (!targetName) return;

    // D-09: cancel the prior timer and clear the badge immediately, so a fast double send
    // cannot have the first timer wipe the second result.
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setOutcome(null);
    setOutcomeAt(null);

    const { exchange, routingKey: targetRoutingKey } = buildPublishArgs(
      mode,
      selectedQueue,
      selectedExchange,
      routingKey
    );

    // Re-encode from the live values: hexPreview can lag behind the debounce.
    const { latestValues, selectedMessageType, activeFilePath } = useProtoStore.getState();
    if (!selectedMessageType || !latestValues) {
      toast.error("Send failed: No form values. Fill out the form first.");
      return;
    }

    // Capture the AMQP properties synchronously, before the first await.
    const { properties } = useAmqpStore.getState();

    let payload: string;
    try {
      payload = await encodeMessage(selectedMessageType, latestValues);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Send failed: encoding error — ${msg}`);
      return;
    }

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
      const result = await publishMessage(
        activeProfileName,
        exchange,
        targetRoutingKey,
        payload,
        amqpProps
      );
      setOutcome(result);
      setOutcomeAt(Date.now());

      const delay = DISMISS_DELAY_MS[result.status];
      if (delay !== null) {
        dismissTimerRef.current = setTimeout(() => {
          setOutcome(null);
          setOutcomeAt(null);
        }, delay);
      }

      // D-15: the form keeps every value — never reset it after a send.

      if (recordsHistory(activeProfile)) {
        void useHistoryStore.getState().appendEntry({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          messageTypeName: selectedMessageType,
          exchange,
          routingKey: targetRoutingKey,
          protoPath: activeFilePath ?? undefined,
          status: "sent",
          outcome: result.status,
          correlationId: properties.correlationId ?? undefined,
          replyTo: properties.replyTo ?? undefined,
          fieldValues: latestValues,
          ...truncatePayloadForHistory(payload),
        });
      }

      useProtoStore.getState().setLastSendAt(Date.now());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Send failed: ${message}`, { duration: 5000 });

      if (recordsHistory(activeProfile)) {
        void useHistoryStore.getState().appendEntry({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          messageTypeName: selectedMessageType,
          exchange,
          routingKey: targetRoutingKey,
          protoPath: activeFilePath ?? undefined,
          status: "failed",
          errorMessage: message,
          correlationId: properties.correlationId ?? undefined,
          replyTo: properties.replyTo ?? undefined,
          fieldValues: latestValues,
          ...truncatePayloadForHistory(payload),
        });
      }
    } finally {
      setIsSending(false);
    }
  }, [
    activeProfileName,
    activeProfile,
    canSend,
    mode,
    selectedQueue,
    selectedExchange,
    routingKey,
  ]);

  // Production profiles get a confirmation before anything leaves the machine.
  const send = useCallback(() => {
    if (!canSend) return;
    if (!requiresConfirmation(activeProfile, "publish")) {
      void handleSend();
      return;
    }
    setPendingPublish({
      kind: "publish",
      target:
        mode === "queue"
          ? selectedQueue
          : `${selectedExchange} with routing key "${routingKey}"`,
      broker: describeBroker(activeProfile),
    });
  }, [canSend, activeProfile, handleSend, mode, selectedQueue, selectedExchange, routingKey]);

  // mod+enter reaches us through the store signal; keep the latest closure in a ref so the
  // effect below does not need `send` in its dependency list.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    if (sendRequested === 0) return;
    sendRef.current();
  }, [sendRequested]);

  const confirmPublish = useCallback(() => {
    setPendingPublish(null);
    void handleSend();
  }, [handleSend]);

  const cancelPublish = useCallback(() => setPendingPublish(null), []);

  return {
    send,
    isSending,
    canSend,
    readOnly,
    isConnected,
    disabledReason,
    outcome,
    outcomeAt,
    dismissOutcome,
    pendingPublish,
    confirmPublish,
    cancelPublish,
  };
}
