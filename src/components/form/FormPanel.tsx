import { useCallback, useState, useEffect } from "react";
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
  const { schema, selectedMessageType, setHexPreview, setEncoding, setEncodeError } =
    useProtoStore();

  const [latestValues, setLatestValues] = useState<unknown>(null);
  const debouncedValues = useDebounce(latestValues, 200);

  const handleValuesChange = useCallback((values: unknown) => {
    setLatestValues(values);
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
        <ProtoFormRenderer message={message} onValuesChange={handleValuesChange} />
      </ScrollArea>
    </div>
  );
}
