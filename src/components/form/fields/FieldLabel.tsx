import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { FieldSchema } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { FieldTooltip } from "./FieldTooltip";
import { fieldMeta } from "./fieldMeta";
import { useFieldDepth } from "./FieldDepthContext";

interface FieldLabelProps {
  field: FieldSchema;
  htmlFor?: string;
  /** When provided, a CopyButton is rendered for this value. Omit to hide it entirely. */
  copyValue?: string;
  children?: ReactNode;
}

/**
 * Shared label row for every field type: label + mono type/field-number meta,
 * a flexible spacer, optional extra content, then the CopyButton (when copyValue is set).
 *
 * Reads FieldDepthContext directly so every field component gets the handoff's compact
 * treatment for nested-message children and oneof branch fields (depth > 0) without each
 * field component having to thread a prop through: label drops to `text-12 text-muted-foreground`
 * and the type/number meta to `font-mono text-[10.5px] text-ghost`. Top level (depth 0) keeps
 * the full `text-13 font-medium` label and `text-11` meta.
 */
export function FieldLabel({ field, htmlFor, copyValue, children }: FieldLabelProps) {
  const depth = useFieldDepth();
  const compact = depth > 0;

  return (
    <div className="flex items-center gap-2">
      <FieldTooltip field={field}>
        <Label
          className={cn(
            compact ? "text-12 text-muted-foreground" : "text-13 font-medium text-foreground"
          )}
          htmlFor={htmlFor}
        >
          {field.label}
        </Label>
      </FieldTooltip>
      <span
        className={cn(
          "font-mono text-ghost whitespace-nowrap",
          compact ? "text-[10.5px]" : "text-11"
        )}
      >
        {fieldMeta(field)}
      </span>
      <div className="flex-1" />
      {children}
      {copyValue !== undefined && <CopyButton value={copyValue} />}
    </div>
  );
}
