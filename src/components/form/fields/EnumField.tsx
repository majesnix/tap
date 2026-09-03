import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldSchema } from "@/lib/types";
import { FieldLabel } from "./FieldLabel";

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

  if (field.kind.type !== "enum") return null;

  const values = field.kind.values;
  const defaultNumber = (field.default_value as number) ?? values[0]?.number ?? 0;
  const resolvedEnumName = values.find((v) => v.number === watchedValue)?.name ?? "";

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
            <SelectTrigger id={path} className="font-mono text-13">
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
