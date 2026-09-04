import { Controller, useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldSchema } from "@/lib/types";
import { FieldLabel } from "./FieldLabel";
import { useFieldDepth } from "./FieldDepthContext";

export interface EnumFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Renders an enum field as a shadcn Select dropdown.
 * Displays value names in the dropdown options, stores the integer number
 * in the form state (matching protobuf wire encoding expectations).
 */
export function EnumField({ field, path }: EnumFieldProps) {
  const { control } = useFormContext();
  const watchedValue = useWatch({ control, name: path });
  const depth = useFieldDepth();

  if (field.kind.type !== "enum") return null;

  const values = field.kind.values;
  const defaultNumber = (field.default_value as number) ?? values[0]?.number ?? 0;
  const resolvedEnumName = values.find((v) => v.number === watchedValue)?.name ?? "";

  // Depth 0 (top level) uses the trigger default (h-9, bg-background); nested triggers
  // shrink to 34px (size="sm") and alternate background by depth parity — same as ScalarField.
  const depthBg = depth === 0 ? "" : depth % 2 === 1 ? "bg-card" : "bg-background";

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel field={field} htmlFor={path} copyValue={resolvedEnumName} />
      <Controller
        name={path}
        control={control}
        defaultValue={defaultNumber}
        render={({ field: rhfField }) => (
          <Select
            value={String(rhfField.value)}
            onValueChange={(strVal) => rhfField.onChange(Number(strVal))}
          >
            <SelectTrigger
              id={path}
              size={depth === 0 ? "default" : "sm"}
              className={cn("font-mono text-13", depthBg)}
            >
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {values.map((v) => (
                <SelectItem key={v.number} value={String(v.number)}>
                  {v.name} <span className="text-ghost">= {v.number}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
