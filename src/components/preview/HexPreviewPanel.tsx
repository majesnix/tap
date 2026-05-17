import { useProtoStore } from "@/stores/useProtoStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function HexPreviewPanel() {
  const { hexPreview, isEncoding, encodeError } = useProtoStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Hex Preview</h2>
        {isEncoding && (
          <span className="text-xs text-muted-foreground animate-pulse">
            encoding...
          </span>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1 p-4">
        {encodeError && (
          <div className="text-xs text-destructive font-mono break-all">
            {encodeError}
          </div>
        )}

        {!encodeError && hexPreview && (
          <pre className="text-xs font-mono break-all whitespace-pre-wrap text-foreground">
            {hexPreview}
          </pre>
        )}

        {!encodeError && !hexPreview && (
          <p className="text-xs text-muted-foreground">
            Fill in the form fields to see binary encoding
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
