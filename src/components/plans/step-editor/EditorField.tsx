import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One labelled cell of the expanded step's two 3-column grids (handoff §5). */
export function EditorField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** Long-form guidance the compact grid has no room for — shown as a title tooltip. */
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} title={hint} className="text-12 text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
