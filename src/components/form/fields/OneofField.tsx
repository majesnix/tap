import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";

interface OneofFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderBranchField: RenderFieldFn;
}

/**
 * Renders a oneof group field.
 * Stub implementation — Wave 2 will add radio group + conditional branch visibility.
 */
export function OneofField({
  field,
  path: _path,
  depth: _depth,
  renderBranchField: _renderBranchField,
}: OneofFieldProps) {
  if (field.kind.type !== "oneof") return null;

  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Badge variant="outline" className="w-fit text-muted-foreground">
        oneof — Wave 2
      </Badge>
    </div>
  );
}
