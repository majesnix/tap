import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";

interface RepeatedFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderItem: RenderFieldFn;
}

/**
 * Renders a repeated (array) field.
 * Stub implementation — Wave 2 will add dynamic add/remove rows.
 */
export function RepeatedField({
  field,
  path: _path,
  depth: _depth,
  renderItem: _renderItem,
}: RepeatedFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Badge variant="outline" className="w-fit text-muted-foreground">
        repeated — Wave 2
      </Badge>
    </div>
  );
}
