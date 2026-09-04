import { z } from "zod";
import type { ScalarKind } from "@/lib/types";

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;

/**
 * Returns a zod schema for the given scalar kind.
 * Used for per-field inline validation (FORM-06) — shared by ScalarField and
 * RepeatedTable's cells so a repeated flat message keeps the same per-kind rules.
 */
export function getZodSchema(scalar: ScalarKind): z.ZodTypeAny {
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
export function getInputType(scalar: ScalarKind): "text" | "number" | "checkbox" {
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
 * react-hook-form `validate` rule for a scalar value — runs the kind's zod schema and
 * returns the first issue's message, or true when valid. Shared so every place that
 * accepts a scalar value (ScalarField, RepeatedTable cells) enforces the same rules.
 */
export function validateScalar(scalar: ScalarKind, value: unknown): true | string {
  const result = getZodSchema(scalar).safeParse(value);
  if (!result.success) {
    return result.error.issues[0]?.message ?? "Invalid value";
  }
  return true;
}
