import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 items-center rounded-sm bg-[var(--kbd-bg)] px-1.5 font-mono text-11 font-medium",
        className
      )}
    >
      {children}
    </kbd>
  );
}
