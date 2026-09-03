import { cn } from "@/lib/utils";

type StatusDotTone = "success" | "danger" | "ghost" | "teal" | "warning" | "violet";

const TONE_BG: Record<StatusDotTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  ghost: "bg-ghost",
  teal: "bg-teal",
  warning: "bg-warning",
  violet: "bg-violet-bright",
};

const TONE_GLOW: Record<StatusDotTone, string> = {
  success: "shadow-[0_0_8px_var(--success)]",
  danger: "shadow-[0_0_8px_var(--danger)]",
  ghost: "shadow-[0_0_8px_var(--ghost)]",
  teal: "shadow-[0_0_8px_var(--teal)]",
  warning: "shadow-[0_0_8px_var(--warning)]",
  violet: "shadow-[0_0_8px_var(--violet-bright)]",
};

export function StatusDot({
  tone,
  size = 8,
  pulse,
  glow,
}: {
  tone: StatusDotTone;
  size?: 6 | 8;
  pulse?: boolean;
  glow?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        size === 6 ? "size-1.5" : "size-2",
        TONE_BG[tone],
        glow && TONE_GLOW[tone],
        pulse && "animate-tap-pulse"
      )}
    />
  );
}
