import { useEffect, useState } from "react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { fetchBindings, fetchQueueDepth } from "@/lib/ipc";
import { getExchanges, getQueues } from "@/lib/brokerCatalog";
import { isAuthError, isHintExchange, type TargetMode } from "@/components/compose/destination";

/**
 * Everything the destination strip needs: the chosen target, the broker catalog behind it
 * and the routing-key suggestions for the selected exchange.
 *
 * Behaviour is unchanged from the pre-workbench publish bar: the 401 discrimination (a wrong
 * password is shown, an unreachable Management API falls back to manual entry) and the D-10
 * rule that a failing bindings fetch reverts to a plain input without ever raising an auth
 * error.
 */
export function useDestination() {
  const [mode, setMode] = useState<TargetMode>("queue");
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [routingKey, setRoutingKey] = useState<string>("");
  const [bindingKeys, setBindingKeys] = useState<string[]>([]);
  const [isLoadingBindings, setIsLoadingBindings] = useState(false);
  const [comboboxReady, setComboboxReady] = useState(false);
  const [queueDepth, setQueueDepth] = useState<number | null>(null);

  const {
    activeProfileName,
    managementStatus,
    managementAuthError,
    queues,
    exchanges,
    setQueues,
    setExchanges,
    setManagementStatus,
    setManagementAuthError,
  } = useConnectionStore();

  const selectedExchangeType =
    exchanges.find((ex) => ex.name === selectedExchange)?.exchange_type ?? "";
  const isEligibleForCombobox =
    !isHintExchange(selectedExchangeType) &&
    managementStatus === "live" &&
    Boolean(selectedExchange);

  // Fetch queues or exchanges on mount and whenever the profile or mode changes.
  // 401 → visible auth error; anything else → silent Manual fallback.
  useEffect(() => {
    if (!activeProfileName) return;

    void (async () => {
      try {
        if (mode === "queue") {
          const qs = await getQueues(activeProfileName);
          setManagementAuthError(null); // clear a stale error only on success
          setQueues(qs);
          setManagementStatus("live");
        } else {
          const exs = await getExchanges(activeProfileName);
          setManagementAuthError(null);
          setExchanges(exs);
          setManagementStatus("live");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (isAuthError(message)) {
          // Surface it; leave managementStatus alone so we never claim "manual" for a 401.
          setManagementAuthError(message);
        } else {
          setManagementAuthError(null);
          setManagementStatus("manual");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileName, mode]);

  // Routing-key suggestions for the selected exchange. Guarded against a stale response
  // when the user switches exchanges quickly.
  useEffect(() => {
    if (!activeProfileName || !isEligibleForCombobox) {
      setBindingKeys([]);
      setIsLoadingBindings(false);
      setComboboxReady(false);
      return;
    }

    let cancelled = false;
    setIsLoadingBindings(true);
    setComboboxReady(true); // show the combobox optimistically while loading

    fetchBindings(activeProfileName, selectedExchange)
      .then((keys) => {
        if (cancelled) return;
        setBindingKeys(keys);
        setIsLoadingBindings(false);
      })
      .catch(() => {
        // D-10: ANY error (401 included) reverts to a plain input. Never setManagementAuthError
        // here — that belongs to fetch_queues / fetch_exchanges only.
        if (cancelled) return;
        setBindingKeys([]);
        setIsLoadingBindings(false);
        setComboboxReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProfileName, selectedExchange, isEligibleForCombobox]);

  // How many messages are waiting in the selected queue; meaningless in exchange mode.
  useEffect(() => {
    if (!activeProfileName || mode !== "queue" || !selectedQueue) {
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
  }, [activeProfileName, mode, selectedQueue]);

  const targetName = mode === "queue" ? selectedQueue : selectedExchange;

  return {
    mode,
    setMode,
    selectedQueue,
    setSelectedQueue,
    selectedExchange,
    setSelectedExchange,
    routingKey,
    setRoutingKey,
    queues,
    exchanges,
    managementStatus,
    managementAuthError,
    bindingKeys,
    isLoadingBindings,
    useCombobox: isEligibleForCombobox && comboboxReady,
    selectedExchangeType,
    targetName,
    hasTarget: Boolean(targetName),
    queueDepth,
  };
}
