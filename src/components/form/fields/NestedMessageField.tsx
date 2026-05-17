import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";

interface NestedMessageFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderChildField: RenderFieldFn;
}

/**
 * Renders a nested message field.
 * Stub implementation — Wave 2 will add recursive rendering.
 */
export function NestedMessageField({
  field,
  path: _path,
  depth: _depth,
  renderChildField: _renderChildField,
}: NestedMessageFieldProps) {
  if (field.kind.type !== "message") return null;

  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Badge variant="outline" className="w-fit text-muted-foreground">
        nested message ({field.kind.full_name}) — Wave 2
      </Badge>
    </div>
  );
}
