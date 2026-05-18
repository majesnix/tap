import { useCallback, useRef, useEffect } from "react";
import { useProtoStore } from "@/stores/useProtoStore";
import { encodeMessage } from "@/lib/ipc";
import { useDebounce } from "@/hooks/useDebounce";
import { ProtoFormRenderer } from "./ProtoFormRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Converts a byte array to a formatted hex string.
 * Example: [0x0a, 0x05] → "0a 05"
 */
function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function FormPanel() {
  const {
    schema,
    selectedMessageType,
    setHexPreview,
    setEncoding,
    setEncodeError,
    pendingReplayValues,
    setPendingReplayValues,
  } = useProtoStore();

  // latestValues is now in Zustand store (D-07 / advisor Option A)
  const latestValues = useProtoStore((s) => s.latestValues);
  const debouncedValues = useDebounce(latestValues, 200);

  // resetRef is passed to ProtoFormRenderer so FormPanel can trigger form.reset() for replay (HIST-02)
  const resetRef = useRef<((values: Record<string, unknown>) => void) | null>(
    null
  );

  // Mirror current form values into store for PublishBar / other consumers (D-07)
  const handleValuesChange = useCallback((values: unknown) => {
    useProtoStore
      .getState()
      .setLatestValues(values as Record<string, unknown>);
  }, []);

  useEffect(() => {
    if (!debouncedValues || !selectedMessageType) return;
    void (async () => {
      try {
        setEncoding(true);
        setEncodeError(null);
        const bytes = await encodeMessage(selectedMessageType, debouncedValues);
        setHexPreview(bytesToHex(bytes));
      } catch (err) {
        const msg = typeof err === "string" ? err : "Encoding failed";
        setEncodeError(msg);
        setHexPreview("");
      } finally {
        setEncoding(false);
      }
    })();
  }, [debouncedValues, selectedMessageType, setHexPreview, setEncoding, setEncodeError]);

  // Consume pendingReplayValues: when set by HIST-02, call form.reset() and clear the signal
  useEffect(() => {
    if (pendingReplayValues && resetRef.current) {
      resetRef.current(pendingReplayValues);
      setPendingReplayValues(null);
    }
  }, [pendingReplayValues, setPendingReplayValues]);

  if (!schema || !selectedMessageType) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Open a .proto file to get started
      </div>
    );
  }

  const message = schema.message_map[selectedMessageType];
  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Message type not found in schema
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{message.name}</h2>
        <p className="text-xs text-muted-foreground">{message.full_name}</p>
      </div>
      <ScrollArea className="flex-1">
        <ProtoFormRenderer
          message={message}
          onValuesChange={handleValuesChange}
          resetRef={resetRef}
        />
      </ScrollArea>
    </div>
  );
}
