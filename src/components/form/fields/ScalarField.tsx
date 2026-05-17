import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema } from "@/lib/types";

interface ScalarFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Renders a scalar field.
 * Full implementation: string fields only.
 * All other scalar types render a "Wave 2" badge placeholder.
 */
export function ScalarField({ field, path }: ScalarFieldProps) {
  const { register } = useFormContext();

  if (field.kind.type !== "scalar") return null;

  const { scalar } = field.kind;

  if (scalar === "string") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={path}>{field.label}</Label>
        <Input
          id={path}
          placeholder={field.label}
          {...register(path)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Badge variant="outline" className="w-fit text-muted-foreground">
        {scalar} — Wave 2
      </Badge>
    </div>
  );
}
