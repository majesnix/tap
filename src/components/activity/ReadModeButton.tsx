import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { StatusDot } from "@/components/common/StatusDot";
import { cn } from "@/lib/utils";
import type { FeedMode, SubscribeStatus } from "@/lib/types";

interface ReadModeButtonProps extends ComponentProps<"button"> {
  mode: FeedMode;
  status: SubscribeStatus;
  queue: string;
}

/** "Tapping orders" while a live session runs, otherwise the idle "Read queue". */
export function readModeLabel(mode: FeedMode, status: SubscribeStatus, queue: string): string {
  if (status !== "Running") return "Read queue";
  if (mode === "tap") return `Tapping ${queue}`;
  if (mode === "subscribe") return `Subscribed ${queue}`;
  return "Read queue";
}

export function ReadModeButton({
  mode,
  status,
  queue,
  className,
  ...rest
}: ReadModeButtonProps) {
  const running = status === "Running" && (mode === "tap" || mode === "subscribe");

  return (
    <button
      type="button"
      title="Read mode"
      className={cn(
        "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border bg-card px-2.5 text-12 whitespace-nowrap text-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
        running ? "border-teal/35" : "border-border hover:border-border-strong",
        className
      )}
      {...rest}
    >
      <StatusDot tone={running ? "teal" : "ghost"} size={6} pulse={running} />
      {readModeLabel(mode, status, queue)}
      <ChevronDown size={13} strokeWidth={1.5} className="text-ghost" />
    </button>
  );
}
