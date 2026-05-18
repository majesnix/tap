import { ScrollArea } from "@/components/ui/scroll-area";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { consumeMessage } from "@/lib/ipc";
import { ResponseQueuePicker } from "./ResponseQueuePicker";
import { ResponseDecodedView } from "./ResponseDecodedView";
import { ResponseHexSection } from "./ResponseHexSection";

export function ResponseTab() {
  const { connectionStatus, activeProfileName } = useConnectionStore();
  const { selectedMessageType } = useProtoStore();
  const {
    selectedQueue,
    lastResult,
    setIsLoading,
    setLastResult,
    setLastReadAt,
  } = useResponseStore();

  const isConnected = connectionStatus === "connected";
  const canRead =
    isConnected &&
    selectedQueue.trim().length > 0 &&
    selectedMessageType !== null;

  /**
   * handleRead: invoke consume_message IPC.
   * NOTE (D-10): ack happens server-side before decode returns. The client
   * receives a ConsumeResult that covers all outcomes — no client-side ack needed.
   */
  const handleRead = async () => {
    if (!canRead || !activeProfileName || !selectedMessageType) return;
    setIsLoading(true);
    try {
      const result = await consumeMessage(
        activeProfileName,
        selectedQueue,
        selectedMessageType,
      );
      setLastResult({
        empty: result.empty,
        decoded: result.decoded,
        hexString: result.hexString,
        error: result.error,
      });
      if (!result.empty) {
        setLastReadAt(Date.now()); // triggers RightPanel auto-switch via D-12
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastResult({ empty: false, decoded: null, hexString: "", error: msg });
      setLastReadAt(Date.now()); // switch to Response tab to surface the error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ResponseQueuePicker onRead={() => void handleRead()} />
      <ScrollArea className="flex-1 overflow-hidden">
        {lastResult === null && (
          <p className="text-xs text-muted-foreground p-4">
            Select a reply queue and click Read
          </p>
        )}
        {lastResult !== null && lastResult.empty && (
          <p className="text-xs text-muted-foreground p-4">Queue empty</p>
        )}
        {lastResult !== null && !lastResult.empty && (
          <>
            <ResponseDecodedView
              decoded={lastResult.decoded}
              error={lastResult.error}
            />
            <ResponseHexSection />
          </>
        )}
      </ScrollArea>
    </div>
  );
}
