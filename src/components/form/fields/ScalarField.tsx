import { Controller, useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema, ScalarKind } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { FieldTooltip } from "./FieldTooltip";

interface ScalarFieldProps {
  field: FieldSchema;
  /** Field path in the form value tree — matches ProtoFormRenderer callsite: `path` */
  path: string;
}

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;

/**
 * Returns a zod schema for the given scalar kind.
 * Used for per-field inline validation (FORM-06).
 */
function getZodSchema(scalar: ScalarKind): z.ZodTypeAny {
  switch (scalar) {
    case "int32":
    case "sint32":
    case "sfixed32":
      return z
        .number()
        .int("Must be an integer")
        .min(INT32_MIN, `Must be >= ${INT32_MIN} (int32 min)`)
        .max(INT32_MAX, `Must be <= ${INT32_MAX} (int32 max)`);

    case "uint32":
    case "fixed32":
      return z
        .number()
        .int("Must be an integer")
        .min(0, "Must be >= 0 (uint32 is unsigned)")
        .max(UINT32_MAX, `Must be <= ${UINT32_MAX} (uint32 max)`);

    case "int64":
    case "sint64":
    case "sfixed64":
      return z
        .string()
        .regex(/^-?\d+$/, "Must be an integer (e.g. -9223372036854775808)");

    case "uint64":
    case "fixed64":
      return z
        .string()
        .regex(/^\d+$/, "Must be a non-negative integer");

    case "float":
    case "double":
      return z.number({ error: "Must be a number" });

    case "bool":
      return z.boolean();

    case "string":
    default:
      return z.string();
  }
}

/**
 * Determines the HTML input type for a given scalar kind.
 * 64-bit integer types use "text" to avoid JS precision loss.
 */
function getInputType(scalar: ScalarKind): "text" | "number" | "checkbox" {
  if (scalar === "bool") return "checkbox";
  const textKinds: ScalarKind[] = [
    "int64",
    "uint64",
    "sint64",
    "fixed64",
    "sfixed64",
    "string",
  ];
  if (textKinds.includes(scalar)) return "text";
  return "number";
}

/**
 * Resolves the fallback default value when the field schema provides none.
 */
function getFallbackDefault(inputType: "text" | "number" | "checkbox"): unknown {
  if (inputType === "checkbox") return false;
  if (inputType === "number") return 0;
  return "";
}

/**
 * ScalarField renders all 16 proto scalar types with the correct HTML input
 * control, per-field zod validation (FORM-06), and pre-populated defaults (FORM-07).
 *
 * Scalar-to-control mapping (from PATTERNS.md):
 *   bool           → Checkbox
 *   string         → Input type="text"
 *   int32 / sint32 / sfixed32   → Input type="number", range [-2147483648, 2147483647]
 *   uint32 / fixed32            → Input type="number", range [0, 4294967295]
 *   int64 / sint64 / sfixed64   → Input type="text", regex /^-?\d+$/
 *   uint64 / fixed64            → Input type="text", regex /^\d+$/
 *   float / double  → Input type="number"
 */
export function ScalarField({ field, path }: ScalarFieldProps) {
  const { control } = useFormContext();
  const watchedValue = useWatch({ control, name: path });

  if (field.kind.type !== "scalar") return null;

  const scalar = field.kind.scalar;
  const inputType = getInputType(scalar);
  const zodSchema = getZodSchema(scalar);

  const defaultValue =
    field.default_value !== undefined && field.default_value !== null
      ? field.default_value
      : getFallbackDefault(inputType);

  const validate = (value: unknown) => {
    const result = zodSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Invalid value";
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-1 mb-3 group">
      {/* Label row with scalar type badge */}
      <div className="flex items-center gap-2">
        <FieldTooltip field={field}>
          <Label
            className="text-xs font-semibold text-foreground"
            htmlFor={path}
          >
            {field.label}
          </Label>
        </FieldTooltip>
        <Badge variant="outline" className="text-xs px-1.5 py-0 w-fit">
          {scalar}
        </Badge>
        <CopyButton value={String(watchedValue ?? "")} />
      </div>

      {/* Single Controller wraps both the input and the error display */}
      <Controller
        name={path}
        control={control}
        defaultValue={defaultValue}
        rules={{ validate }}
        render={({ field: rhfField, fieldState }) => (
          <>
            {inputType === "checkbox" ? (
              <Checkbox
                id={path}
                checked={!!rhfField.value}
                onCheckedChange={rhfField.onChange}
              />
            ) : (
              <Input
                id={path}
                type={inputType}
                value={rhfField.value ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (inputType === "number") {
                    rhfField.onChange(raw === "" ? "" : Number(raw));
                  } else {
                    rhfField.onChange(raw);
                  }
                }}
                onBlur={rhfField.onBlur}
                aria-invalid={!!fieldState.error}
                className={fieldState.error ? "border-destructive" : ""}
              />
            )}

            {/* Inline validation error (FORM-06) */}
            {fieldState.error && (
              <p className="text-xs text-destructive" role="alert">
                {field.label}: {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />
    </div>
  );
}
