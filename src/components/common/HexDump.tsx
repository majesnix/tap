import { hexRows } from "@/lib/hexDump";
import { cn } from "@/lib/utils";

export function HexDump({
  hex,
  maxHeight = 180,
  className,
}: {
  hex: string;
  maxHeight?: number;
  className?: string;
}) {
  const rows = hexRows(hex);

  return (
    <div
      style={{ maxHeight }}
      className={cn(
        "grid grid-cols-2 gap-x-8 p-3 rounded-md bg-background border border-hairline font-mono text-[11.5px] leading-5 overflow-auto",
        className
      )}
    >
      {rows.map((row) => (
        <div key={row.offset} className="flex gap-2">
          <span className="text-ghost w-9">{row.offset}</span>
          <span className="text-foreground tracking-[.02em] w-[200px]">{row.bytes}</span>
          <span className="text-ghost">{row.ascii}</span>
        </div>
      ))}
    </div>
  );
}
