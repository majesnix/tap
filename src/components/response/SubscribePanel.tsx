import { useRef } from "react";
import { Channel } from "@tauri-apps/api/core";
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { startSubscribe, stopSubscribe } from "@/lib/ipc";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { DrainResult } from "@/lib/types";

// ── useEffect must be imported from React (not globals) in this codebase ───────
import { useEffect } from "react";

interface SubscribePanelProps {
  selectedQueue: string;
  decodeTypes: string[];
  profileName: string;
}

export function SubscribePanel({
  selectedQueue,
  decodeTypes,
  profileName,
}: SubscribePanelProps) {
  const { subscribeStatus, subscribeError, setSubscribeStatus, appendMessages } =
    useResponseStore();
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);
  const connectionStatus = useConnectionStore((s) => s.connectionStatus);

  const channelRef = useRef<Channel<DrainResult> | null>(null);

  // prevProfileRef tracks profile transitions (not a prop comparison — see D-11 / plan comment)
  // Initialized to activeProfileName on mount so the first render doesn't fire auto-stop
  const prevProfileRef = useRef<string | null>(activeProfileName);

  // CR-03: guard against double-click / concurrent start calls during IPC await.
  // The Start button's disabled state only updates after startSubscribe resolves (~500ms–3s),
  // so a second click during that window would fire a second IPC call. This ref prevents it.
  const isStartingRef = useRef(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    // CR-03: bail out immediately if a start is already in progress
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    const channel = new Channel<DrainResult>((msg) => {
      appendMessages([msg]);
      // CR-02: if the consumer self-terminated (e.g., broker closed, ack failure),
      // transition status back to Idle without requiring user to click Stop.
      if (msg.isTerminal) {
        setSubscribeStatus("Idle");
      }
    });
    channelRef.current = channel;
    try {
      await startSubscribe(profileName, selectedQueue, decodeTypes, channel);
      setSubscribeStatus("Running");
    } catch (e) {
      // WR-04: clear stale channel ref on failure so handleStop / cleanup never sees
      // a ref from a failed session.
      channelRef.current = null;
      // T-14-11: never surface raw error.message if it might contain AMQP URI/credentials
      // The Rust AppError variants are already sanitized (see plan 01 security mitigations),
      // but we use a fallback to be safe.
      const message = e instanceof Error ? e.message : "Subscribe failed";
      setSubscribeStatus("Error", message);
    } finally {
      // CR-03: always reset the guard so subsequent clicks work after the IPC resolves
      isStartingRef.current = false;
    }
  };

  const handleStop = async () => {
    setSubscribeStatus("Stopping");
    try {
      await stopSubscribe();
      setSubscribeStatus("Idle");
    } catch {
      setSubscribeStatus("Error", "Stop failed");
    }
  };

  // ── Unmount cleanup (CR-04) ──────────────────────────────────────────────────
  //
  // When the component unmounts while a session is active (e.g., user switches from
  // subscribe to drain mode, or navigates away), the backend consumer keeps running.
  // This effect fires on unmount and stops any active session so the backend is not
  // left running with no UI to control it.

  useEffect(() => {
    return () => {
      const { subscribeStatus: status, setSubscribeStatus: setStatus } =
        useResponseStore.getState();
      if (status === "Running" || status === "Stopping") {
        void stopSubscribe().catch(() => {});
        setStatus("Idle");
      }
    };
  }, []); // empty deps — runs only on unmount

  // ── Auto-stop useEffect (D-11, CONS-07) ─────────────────────────────────────
  //
  // Profile-change detection MUST use prevProfileRef rather than comparing
  // activeProfileName against the profileName prop. Both originate from the same
  // store selector in the parent (MessageFeedTab reads activeProfileName and passes
  // it as profileName), so they update to the same value in the same render —
  // activeProfileName !== profileName is always false at render time.
  //
  // The ref captures the previous value across renders and detects the transition.
  //
  // WR-05: subscribeStatus is intentionally excluded from deps to prevent a re-trigger
  // loop. When handleStop() fires it sets status to "Stopping"; including subscribeStatus
  // would re-run the effect with status==="Stopping" + connectionStatus!=="connected",
  // causing a second handleStop() call. The stale closure risk is safe here because:
  // (a) profile/connection changes always accompany status changes that need stopping,
  // (b) the "Running"/"Stopping" check uses the captured value which is only stale
  //     between renders — at worst we miss a one-tick window, not a correctness issue.

  useEffect(() => {
    if (subscribeStatus === "Running" || subscribeStatus === "Stopping") {
      if (connectionStatus !== "connected" || activeProfileName !== prevProfileRef.current) {
        void handleStop();
      }
    }
    // Always update the ref AFTER the check so the next render can compare against this value
    prevProfileRef.current = activeProfileName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileName, connectionStatus]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const isRunningOrStopping =
    subscribeStatus === "Running" || subscribeStatus === "Stopping";

  // ── Status badge ─────────────────────────────────────────────────────────────

  const renderStatusBadge = () => {
    switch (subscribeStatus) {
      case "Idle":
        return (
          <Badge variant="outline">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-muted-foreground inline-block" />
            Idle
          </Badge>
        );
      case "Running":
        return (
          <Badge variant="outline">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            Running
          </Badge>
        );
      case "Stopping":
        return (
          <Badge variant="outline">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-amber-500 inline-block" />
            Stopping
          </Badge>
        );
      case "Error":
        return (
          <Badge variant="destructive" title={subscribeError ?? undefined}>
            Error
          </Badge>
        );
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status badge */}
      {renderStatusBadge()}

      {/* Start button — shown when Idle or Error */}
      {!isRunningOrStopping && (
        <Button
          variant="default"
          onClick={() => void handleStart()}
          disabled={subscribeStatus !== "Idle" || !selectedQueue || isStartingRef.current}
        >
          <Play className="mr-2 h-4 w-4" />
          Start
        </Button>
      )}

      {/* Stop button — shown when Running or Stopping */}
      {isRunningOrStopping && (
        <Button
          variant="outline"
          onClick={() => void handleStop()}
          disabled={subscribeStatus === "Stopping"}
        >
          {subscribeStatus === "Stopping" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Square className="mr-2 h-4 w-4" />
          )}
          Stop
        </Button>
      )}
    </div>
  );
}
