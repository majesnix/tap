import type { FieldSchema } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FieldTooltipProps {
  field: FieldSchema;
  children: React.ReactNode;
}

function formatTypeLabel(field: FieldSchema): string {
  const { kind } = field;
  switch (kind.type) {
    case "scalar":
      return kind.scalar;
    case "enum":
      return "enum";
    case "message":
      return kind.full_name.split(".").pop() ?? kind.full_name;
    case "well_known":
      return kind.wkt;
    case "oneof":
      return "oneof";
    case "map":
      return `map<${kind.key_type}, ${kind.value_kind.type === "scalar" ? kind.value_kind.scalar : kind.value_kind.type}>`;
    default:
      return "unknown";
  }
}

function formatCardinality(field: FieldSchema): string {
  if (field.repeated) return "repeated";
  if (field.kind.type === "map") return "map";
  return "optional";
}

export function FieldTooltip({ field, children }: FieldTooltipProps) {
  const typeLabel = formatTypeLabel(field);
  const fieldNumber = field.field_number > 0 ? `field ${field.field_number}` : null;
  const cardinality = formatCardinality(field);
  const parts = [typeLabel, fieldNumber, cardinality].filter(Boolean);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{parts.join(" · ")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
