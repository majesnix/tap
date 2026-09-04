import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The default `bg-foreground/10` reads on both themes and on any surface. Hosts that
 * sit on a saturated fill (the primary Send button) pass their own tint instead.
 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 items-center rounded-sm bg-foreground/10 px-1.5 font-mono text-11 font-medium",
        className
      )}
    >
      {children}
    </kbd>
  );
}
