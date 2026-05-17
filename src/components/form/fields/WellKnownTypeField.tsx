import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FieldSchema } from "@/lib/types";

interface WellKnownTypeFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Renders a well-known type field (Timestamp, Duration, etc).
 * Stub implementation — Wave 2 will add date/time pickers.
 */
export function WellKnownTypeField({ field, path: _path }: WellKnownTypeFieldProps) {
  if (field.kind.type !== "well_known") return null;

  const { wkt } = field.kind;

  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Badge variant="outline" className="w-fit text-muted-foreground">
        {wkt} — Wave 2
      </Badge>
    </div>
  );
}
