import { Layers } from "lucide-react";
import { useAmqpStore } from "@/stores/useAmqpStore";
import { summarizeProperties } from "@/components/compose/propertiesSummary";
import { cn } from "@/lib/utils";

interface PropertiesSummaryButtonProps {
  open: boolean;
  onToggle: () => void;
}

/** The AMQP properties that will ride with the next send, and the way into editing them. */
export function PropertiesSummaryButton({ open, onToggle }: PropertiesSummaryButtonProps) {
  const properties = useAmqpStore((s) => s.properties);
  const parts = summarizeProperties(properties);

  return (
    <button
      type="button"
      data-testid="properties-summary"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-12 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35",
        open ? "border-border-strong bg-primary/8" : "border-transparent"
      )}
    >
      <Layers size={14} className="shrink-0" />
      <span className="whitespace-nowrap">
        {parts.map((part, index) => (
          <span key={`${part.text}-${index}`}>
            {index > 0 && " · "}
            <span className={part.mono ? "font-mono text-foreground" : undefined}>
              {part.text}
            </span>
          </span>
        ))}
      </span>
      <span className="font-medium text-violet-bright">{open ? "Done" : "Edit"}</span>
    </button>
  );
}
