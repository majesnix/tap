import { Controller, useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { FieldSchema, ScalarKind } from "@/lib/types";
import { FieldLabel } from "./FieldLabel";
import { useFieldDepth } from "./FieldDepthContext";

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
  const depth = useFieldDepth();

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

  // Depth 0 (top level) uses the Input default (h-9, bg-background); nested inputs
  // shrink to 34px and alternate background by depth parity (FieldDepthContext).
  const depthClassName =
    depth === 0 ? "" : cn("h-[34px]", depth % 2 === 1 ? "bg-card" : "bg-background");

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel field={field} htmlFor={path} copyValue={String(watchedValue ?? "")} />

      {/* Single Controller wraps both the input and the error display */}
      <Controller
        name={path}
        control={control}
        defaultValue={defaultValue}
        rules={{ validate }}
        render={({ field: rhfField, fieldState }) => (
          <>
            {inputType === "checkbox" ? (
              <Switch
                id={path}
                checked={!!rhfField.value}
                onCheckedChange={rhfField.onChange}
                aria-label={field.label}
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
                className={cn("font-mono text-13", depthClassName)}
              />
            )}

            {/* Inline validation error (FORM-06) */}
            {fieldState.error && (
              <p className="text-12 text-danger" role="alert">
                {field.label}: {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />
    </div>
  );
}
