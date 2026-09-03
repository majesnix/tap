import { useState } from "react";
import { toast } from "sonner";
import { drainMessages } from "@/lib/ipc";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { describeBroker, findProfile, requiresConfirmation } from "@/lib/profileSafety";
import type { BrokerConfirmRequest } from "@/components/response/BrokerConfirmDialog";
import type { FeedMode } from "@/lib/types";

const FEED_MAX_SIZE = 500;

export interface QueueRead {
  /** Peek or Consume up to `count` messages, asking first when the broker is not the user's own. */
  read: (count: number) => void;
  pending: BrokerConfirmRequest | null;
  confirm: () => void;
  cancel: () => void;
  isLoading: boolean;
}

/**
 * Batch reads for the read-mode popover. Peek hands everything back and never
 * needs a confirmation; Consume removes messages for every other consumer of the
 * queue, so anywhere but the developer's own machine it asks first.
 */
export function useQueueRead(mode: FeedMode): QueueRead {
  const [pending, setPending] = useState<BrokerConfirmRequest | null>(null);

  const { connectionStatus, activeProfileName, profiles } = useConnectionStore();
  const activeProfile = findProfile(profiles, activeProfileName);

  const {
    selectedQueue,
    messages,
    selectedDecodeTypes,
    isLoading,
    appendMessages,
    setIsLoading,
    setLastReadAt,
  } = useResponseStore();

  const isConnected = connectionStatus === "connected";

  const drain = async (count: number, requeue: boolean) => {
    if (!isConnected || !activeProfileName || selectedDecodeTypes.length === 0) return;
    if (!selectedQueue.trim()) return;
    const verb = requeue ? "Peek" : "Consume";

    setIsLoading(true);
    try {
      const outcome = await drainMessages(
        activeProfileName,
        selectedQueue,
        selectedDecodeTypes, // D-19: ordered candidate list
        count,
        requeue
      );

      if (outcome.messages.length === 0 && !outcome.partialError) {
        toast.info("Queue is empty"); // D-03
      }

      if (outcome.partialError) {
        toast.error(`${verb} stopped early: ${outcome.partialError}`);
      }

      if (outcome.messages.length > 0) {
        const totalAfterPrepend = outcome.messages.length + messages.length;
        if (totalAfterPrepend > FEED_MAX_SIZE) {
          toast.info(
            `Feed capped at ${FEED_MAX_SIZE} — ${totalAfterPrepend - FEED_MAX_SIZE} older message(s) removed`
          );
        }
        appendMessages(outcome.messages);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`${verb} failed: ${message}`);
    } finally {
      setIsLoading(false);
      setLastReadAt(Date.now()); // CONS-04: always refresh queue depth, even on error
    }
  };

  const read = (count: number) => {
    if (mode === "peek") {
      void drain(count, true);
      return;
    }
    if (!requiresConfirmation(activeProfile, "consume")) {
      void drain(count, false);
      return;
    }
    setPending({
      kind: "consume",
      queue: selectedQueue,
      broker: describeBroker(activeProfile),
      count,
    });
  };

  return {
    read,
    pending,
    confirm: () => {
      const request = pending;
      setPending(null);
      if (request?.kind === "consume") void drain(request.count, false);
    },
    cancel: () => setPending(null),
    isLoading,
  };
}
