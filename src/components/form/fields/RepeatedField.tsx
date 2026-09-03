import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/common/IconButton";
import { useMessageMap } from "@/components/form/ProtoSchemaContext";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";
import { isFlatMessage, typeLabel } from "./fieldMeta";
import { RepeatedTable } from "./RepeatedTable";

interface RepeatedFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderItem: RenderFieldFn;
}

/**
 * Renders a repeated (array) field. A repeated flat message (≤5 scalar/enum fields, per
 * isFlatMessage) renders as a RepeatedTable — which owns its own "Add item" control — so
 * the label row here only carries the "+ Add item" button on the stacked-container path.
 *
 * Uses useFieldArray — ALWAYS keys rows by field.id, never by index (G-6).
 * Receives renderItem as a prop — does NOT import ProtoFormRenderer (avoids circular imports).
 */
export function RepeatedField({ field, path, depth, renderItem }: RepeatedFieldProps) {
  const { control } = useFormContext();
  const messageMap = useMessageMap();
  const { fields, append, remove } = useFieldArray({ control, name: path });

  const getDefaultItem = (): unknown => field.default_value ?? "";

  const messageSchema =
    field.kind.type === "message" ? messageMap?.[field.kind.full_name] : undefined;
  const useTable = !!messageSchema && isFlatMessage(messageSchema);

  const metaLabel = `repeated ${typeLabel(field)} · ${field.field_number} · ${fields.length} rows`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-13 font-medium">{field.label}</span>
        <span className="font-mono text-11 text-ghost whitespace-nowrap">{metaLabel}</span>
        <div className="flex-1" />
        {!useTable && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-violet-bright"
            onClick={() => append(getDefaultItem())}
          >
            <Plus size={13} className="mr-1" />
            Add item
          </Button>
        )}
      </div>

      {useTable && messageSchema ? (
        <RepeatedTable field={field} path={path} message={messageSchema} />
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((rhfField, index) => (
            // ALWAYS use rhfField.id as key — never index (G-6)
            <div
              key={rhfField.id}
              className="flex items-start gap-2 rounded-lg border border-border p-3"
            >
              <span className="pt-2 font-mono text-11 text-ghost">#{index}</span>
              <div className="flex-1">
                {renderItem(
                  { ...field, repeated: false, name: `${field.name}[${index}]` },
                  `${path}.${index}`,
                  depth
                )}
              </div>
              <IconButton size={22} danger label="Remove item" onClick={() => remove(index)}>
                <Trash2 size={13} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
