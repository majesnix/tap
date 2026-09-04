import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const SIZE: Record<22 | 24 | 26 | 28 | 32, string> = {
  22: "size-[22px]",
  24: "size-6",
  26: "size-[26px]",
  28: "size-7",
  32: "size-8",
};

interface IconButtonProps extends ComponentProps<"button"> {
  size?: 22 | 24 | 26 | 28 | 32;
  tone?: "ghost" | "violet";
  active?: boolean;
  danger?: boolean;
  /** aria-label + title */
  label: string;
}

export function IconButton({
  size = 24,
  tone = "ghost",
  active,
  danger,
  label,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        SIZE[size],
        tone === "violet"
          ? "text-violet-bright hover:bg-primary/12"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        active && "bg-primary/12 text-violet-bright",
        danger && "hover:text-danger hover:bg-danger/12",
        className
      )}
      {...rest}
    />
  );
}
