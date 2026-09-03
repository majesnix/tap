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

/**
 * The glow is 60 % of the tone, not the flat colour: a fully opaque halo reads as a
 * second ring around the dot rather than a bloom (handoff "Design tokens").
 */
const TONE_GLOW: Record<StatusDotTone, string> = {
  success: "shadow-[0_0_8px_color-mix(in_srgb,var(--success)_60%,transparent)]",
  danger: "shadow-[0_0_8px_color-mix(in_srgb,var(--danger)_60%,transparent)]",
  ghost: "shadow-[0_0_8px_color-mix(in_srgb,var(--ghost)_60%,transparent)]",
  teal: "shadow-[0_0_8px_color-mix(in_srgb,var(--teal)_60%,transparent)]",
  warning: "shadow-[0_0_8px_color-mix(in_srgb,var(--warning)_60%,transparent)]",
  violet: "shadow-[0_0_8px_color-mix(in_srgb,var(--violet-bright)_60%,transparent)]",
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
