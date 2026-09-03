import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import type { FieldSchema } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { FieldTooltip } from "./FieldTooltip";
import { fieldMeta } from "./fieldMeta";

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
 */
export function FieldLabel({ field, htmlFor, copyValue, children }: FieldLabelProps) {
  return (
    <div className="flex items-center gap-2">
      <FieldTooltip field={field}>
        <Label className="text-13 font-medium text-foreground" htmlFor={htmlFor}>
          {field.label}
        </Label>
      </FieldTooltip>
      <span className="font-mono text-11 text-ghost whitespace-nowrap">{fieldMeta(field)}</span>
      <div className="flex-1" />
      {children}
      {copyValue !== undefined && <CopyButton value={copyValue} />}
    </div>
  );
}
