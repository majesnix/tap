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

interface HexViewDialogProps {
  entry: HistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HexViewDialog({ entry, open, onOpenChange }: HexViewDialogProps) {
  if (!entry) return null;

  // WR-05: Filter out any values outside [0, 255] before rendering.
  // payloadBytes is typed as number[] but values loaded from persisted JSON may
  // be corrupted (NaN, negative, >255, float) and would produce malformed hex
  // strings (e.g. "-1", "nan", multi-char values > 255).
  const hex = entry.payloadBytes
    .filter((b) => Number.isInteger(b) && b >= 0 && b <= 255)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

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
