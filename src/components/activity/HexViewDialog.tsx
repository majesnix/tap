import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/common/IconButton";
import { HexDump } from "@/components/common/HexDump";
import { MAX_HISTORY_PAYLOAD_BYTES } from "@/lib/bytes";

interface HexViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  hex: string;
  truncated?: boolean;
}

const COPIED_MS = 1500;

export function HexViewDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  hex,
  truncated,
}: HexViewDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard access can be denied; the dump stays selectable either way.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        {truncated && (
          <p className="text-12 text-muted-foreground">
            Only the first {MAX_HISTORY_PAYLOAD_BYTES / 1024} KB were kept; this entry cannot be
            resent.
          </p>
        )}
        <HexDump hex={hex} maxHeight={320} />
        <div className="flex justify-end">
          <IconButton size={26} label="Copy hex" onClick={() => void handleCopy()}>
            {copied ? (
              <Check size={13} strokeWidth={1.5} className="text-success" />
            ) : (
              <Copy size={13} strokeWidth={1.5} />
            )}
          </IconButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
