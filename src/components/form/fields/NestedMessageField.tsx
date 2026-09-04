import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { DepthCapPlaceholder } from "./DepthCapPlaceholder";
import { FieldDepthContext } from "./FieldDepthContext";
import { containerColumns, fieldMeta, summarizeValues } from "./fieldMeta";
import { useMessageMap } from "@/components/form/ProtoSchemaContext";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";
import { FieldTooltip } from "./FieldTooltip";

interface NestedMessageFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderChildField: RenderFieldFn;
}

/**
 * Renders a nested message field as a collapsible container. Children are rendered via
 * renderChildField — the same dispatcher ProtoFormRenderer and the plans step editor use —
 * so a nested ScalarField/EnumField/etc. keeps its own full label row and read FieldDepthContext
 * for its input's height/background.
 *
 * At depth >= 5, renders DepthCapPlaceholder instead of recursing (FORM-08, T-03-01).
 * Receives renderChildField as a prop — does NOT import ProtoFormRenderer (avoids circular imports).
 */
export function NestedMessageField({
  field,
  path,
  depth,
  renderChildField,
}: NestedMessageFieldProps) {
  const [open, setOpen] = useState(true);
  const messageMap = useMessageMap();
  const { control } = useFormContext();
  // Only subscribe while collapsed — the summary is the only thing that needs the live value,
  // and re-rendering this subtree on every descendant keystroke while expanded is wasted work.
  const watchedValue = useWatch({ control, name: path, disabled: open });

  // Depth gate: at depth >= 5, show placeholder — prevents unbounded recursion (FORM-08)
  if (depth >= 5) return <DepthCapPlaceholder />;

  if (field.kind.type !== "message") return null;

  const messageFullName = field.kind.full_name;
  const messageSchema = messageMap?.[messageFullName];

  if (!messageSchema) {
    return (
      <div className="text-12 text-muted-foreground">
        Unknown message type: {messageFullName}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-left cursor-pointer"
      >
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={cn(
            "text-muted-foreground transition-transform duration-150",
            !open && "-rotate-90"
          )}
        />
        <FieldTooltip field={field}>
          <span className="text-13 font-medium">{field.label}</span>
        </FieldTooltip>
        <span className="font-mono text-11 text-ghost whitespace-nowrap">
          {fieldMeta(field)}
        </span>
        {!open && (
          <span className="font-mono text-11 text-muted-foreground ml-2 truncate">
            {summarizeValues(watchedValue)}
          </span>
        )}
      </button>

      {open && (
        // Track widths are computed from the first 5 fields (containerColumns); any additional
        // fields wrap onto further rows reusing that same column template.
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: containerColumns(messageSchema) }}
        >
          <FieldDepthContext.Provider value={depth + 1}>
            {messageSchema.fields.map((childField) =>
              renderChildField(childField, `${path}.${childField.name}`, depth + 1)
            )}
          </FieldDepthContext.Provider>
        </div>
      )}
    </div>
  );
}
