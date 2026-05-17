import { Controller, useFormContext } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema } from "@/lib/types";

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

  if (field.kind.type !== "enum") return null;

  const values = field.kind.values;
  const defaultNumber = (field.default_value as number) ?? values[0]?.number ?? 0;

  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold" htmlFor={path}>
          {field.label}
        </Label>
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          enum
        </Badge>
      </div>
      <Controller
        name={path}
        control={control}
        defaultValue={defaultNumber}
        render={({ field: rhfField }) => (
          <Select
            value={String(rhfField.value)}
            onValueChange={(strVal) => rhfField.onChange(Number(strVal))}
          >
            <SelectTrigger id={path}>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {values.map((v) => (
                <SelectItem key={v.number} value={String(v.number)}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
