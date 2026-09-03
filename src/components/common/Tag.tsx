import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TagTone = "success" | "warning" | "danger" | "teal" | "violet" | "neutral";

const TONE: Record<TagTone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  teal: "bg-teal/12 text-teal",
  violet: "bg-primary/12 text-violet-bright",
  neutral: "bg-surface-2 text-muted-foreground",
};

const SIZE = {
  xs: "h-[18px] px-[7px]",
  sm: "h-5 px-2",
  md: "h-[22px] px-[9px]",
} as const;

interface TagProps extends Omit<ComponentProps<"span">, "children"> {
  tone: TagTone;
  size?: keyof typeof SIZE;
  children: ReactNode;
}

/** Give Tag a ...rest spread of span props so data-testid (used by EnvironmentPill) passes through. */
export function Tag({ tone, size = "sm", className, children, title, ...rest }: TagProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full text-10 font-bold uppercase tracking-[.08em] whitespace-nowrap",
        TONE[tone],
        SIZE[size],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
