import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";

interface RepeatedFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderItem: RenderFieldFn;
}

/**
 * Renders a repeated (array) field with add/remove controls.
 * Uses useFieldArray — ALWAYS keys rows by field.id, never by index (G-6).
 * Receives renderItem as a prop — does NOT import ProtoFormRenderer (avoids circular imports).
 */
export function RepeatedField({ field, path, depth, renderItem }: RepeatedFieldProps) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: path });

  const getDefaultItem = (): unknown => field.default_value ?? "";

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">repeated</Badge>
        <span className="text-sm font-semibold">{field.label}</span>
      </div>

      {fields.map((rhfField, index) => (
        // ALWAYS use rhfField.id as key — never index (G-6)
        <div key={rhfField.id} className="flex items-start gap-2 p-2 border rounded">
          <div className="flex-1">
            {renderItem(
              { ...field, repeated: false, name: `${field.name}[${index}]` },
              `${path}.${index}`,
              depth
            )}
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => remove(index)}
            aria-label="Remove item"
            className="shrink-0 mt-1"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append(getDefaultItem())}
        className="self-start"
      >
        <Plus className="w-4 h-4 mr-1" />
        Add item
      </Button>
    </div>
  );
}
