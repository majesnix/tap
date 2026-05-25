import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DepthCapPlaceholder } from "./DepthCapPlaceholder";
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
 * Renders a nested message field as a collapsible sub-form, indented 16px per level.
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

  // Depth gate: at depth >= 5, show placeholder — prevents unbounded recursion (FORM-08)
  if (depth >= 5) return <DepthCapPlaceholder />;

  if (field.kind.type !== "message") return null;

  const messageFullName = field.kind.full_name;
  const messageSchema = messageMap?.[messageFullName];

  if (!messageSchema) {
    return (
      <div className="ml-4 pl-3 text-xs text-muted-foreground">
        Unknown message type: {messageFullName}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="ml-4 border-l border-border pl-3 mb-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground py-1 cursor-pointer">
        {open ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <FieldTooltip field={field}>
          <span>{field.label}</span>
        </FieldTooltip>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Render child fields via renderChildField prop — never import ProtoFormRenderer here */}
        {messageSchema.fields.map((childField) =>
          renderChildField(childField, `${path}.${childField.name}`, depth + 1)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
