import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-11 font-semibold uppercase tracking-[.1em] text-ghost", className)}
      {...props}
    />
  );
}
