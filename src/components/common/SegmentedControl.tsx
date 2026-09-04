import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
  disabled?: boolean;
  /** extra classes when active, e.g. "text-warning" for the Shared environment segment */
  activeClassName?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: SegmentedItem<T>[];
  /** tabs: container bg-card, active bg-surface-2 (view switch, activity filter). choice: container bg-background, active bg-surface-3 (Queue|Exchange, delivery, oneof, environment) */
  variant?: "tabs" | "choice";
  size?: "xs" | "sm" | "md";
  mono?: boolean;
  stretch?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}

const SIZE_CLASS = {
  xs: "h-[22px] px-2 text-11",
  sm: "h-[26px] px-2.5 text-12",
  md: "h-7 px-3 text-[12.5px]",
} as const;

export function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  variant = "tabs",
  size = "sm",
  mono,
  stretch,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  // Roving tabindex: only the checked radio is tabbable, so an arrow key must move DOM
  // focus along with the selection or the next press lands on the old button (and Tab
  // would exit from a tabIndex=-1 element).
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const move = useCallback(
    (from: number, step: 1 | -1) => {
      const enabled = items.filter((i) => !i.disabled);
      if (enabled.length === 0) return;
      const current = enabled.findIndex((i) => i.value === items[from].value);
      const next = enabled[(current + step + enabled.length) % enabled.length];
      onChange(next.value);
      buttonsRef.current[items.findIndex((i) => i.value === next.value)]?.focus();
    },
    [items, onChange]
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-md border border-border p-0.5",
        variant === "tabs" ? "bg-card" : "bg-background",
        stretch && "flex w-full",
        className
      )}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            title={item.title}
            disabled={disabled || item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(index, 1);
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50",
              SIZE_CLASS[size],
              mono && "font-mono",
              stretch && "flex-1",
              active
                ? cn(
                    "font-semibold text-foreground",
                    variant === "tabs" ? "bg-surface-2" : "bg-surface-3",
                    item.activeClassName
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
