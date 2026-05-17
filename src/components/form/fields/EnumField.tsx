import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FieldSchema } from "@/lib/types";

interface EnumFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Renders an enum field.
 * Stub implementation — Wave 2 will add a Select dropdown.
 */
export function EnumField({ field, path: _path }: EnumFieldProps) {
  if (field.kind.type !== "enum") return null;

  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Badge variant="outline" className="w-fit text-muted-foreground">
        enum — Wave 2
      </Badge>
    </div>
  );
}
