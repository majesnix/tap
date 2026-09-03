import { Binary } from "lucide-react";
import { inlineHex } from "@/lib/hexDump";

interface HexStripProps {
  /** Spaced lowercase hex of the encoded message; empty until the form has values. */
  hex: string;
  byteCount: number;
  encodeError: string | null;
  open: boolean;
  onToggle: () => void;
}

/** One line of wire bytes in the card footer; clicking it opens the full dump. */
export function HexStrip({ hex, byteCount, encodeError, open, onToggle }: HexStripProps) {
  return (
    <button
      type="button"
      data-testid="hex-strip"
      onClick={onToggle}
      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
    >
      <Binary size={15} className="shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-mono text-[11.5px] text-muted-foreground">
        {encodeError ? (
          <span className="text-danger">{encodeError}</span>
        ) : hex ? (
          <>
            {byteCount} B · <span className="text-foreground">{inlineHex(hex)}</span>
          </>
        ) : (
          <span className="text-ghost">Fill in the form to see the wire bytes</span>
        )}
      </span>
      <span className="shrink-0 text-12 font-medium text-violet-bright">
        {open ? "Collapse" : "Expand"}
      </span>
    </button>
  );
}
