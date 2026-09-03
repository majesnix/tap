import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/stores/useHistoryStore";
import { base64ToHex, MAX_HISTORY_PAYLOAD_BYTES } from "@/lib/bytes";

interface HexViewDialogProps {
  entry: HistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HexViewDialog({ entry, open, onOpenChange }: HexViewDialogProps) {
  if (!entry) return null;

  // Persisted base64 may have been edited or corrupted; show a message rather than crash.
  let hex: string;
  try {
    hex = base64ToHex(entry.payloadBase64);
  } catch {
    hex = "(stored payload is not valid base64)";
  }

  // Format target: "exchange → routingKey" (arrow format per UI-SPEC)
  const target = entry.exchange
    ? `${entry.exchange} → ${entry.routingKey}`
    : entry.routingKey;

  // Format timestamp as HH:mm:ss
  const time = entry.timestamp.slice(11, 19);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Binary Payload — {entry.messageTypeName}</DialogTitle>
          <DialogDescription>
            {time} → {target}
          </DialogDescription>
        </DialogHeader>
        {entry.payloadTruncated && (
          <p className="text-xs text-muted-foreground">
            Only the first {MAX_HISTORY_PAYLOAD_BYTES / 1024} KB were kept; this entry cannot be resent.
          </p>
        )}
        <pre className="text-xs font-mono break-all whitespace-pre-wrap bg-muted rounded p-4 max-h-80 overflow-auto">
          {hex}
        </pre>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
