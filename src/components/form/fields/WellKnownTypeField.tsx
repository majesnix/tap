import { Controller, useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { FieldSchema } from "@/lib/types";
import { FieldLabel } from "./FieldLabel";
import { useFieldDepth } from "./FieldDepthContext";

const DURATION_PATTERN = /^(\d+h)?(\d+m)?(\d+(\.\d+)?s)?$/;

interface WellKnownTypeFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Renders a WellKnownType field.
 * - Timestamp → datetime-local input (ISO 8601 string sent to Rust)
 * - Duration  → text input with placeholder "e.g. 1h30m" and regex validation
 * - All other WKTs → plain text input, type name shown via FieldLabel's fieldMeta (G-8)
 */
export function WellKnownTypeField({ field, path }: WellKnownTypeFieldProps) {
  const { control } = useFormContext();
  const depth = useFieldDepth();

  if (field.kind.type !== "well_known") return null;

  const { wkt } = field.kind;

  const isTimestamp = wkt === "Timestamp";
  const isDuration = wkt === "Duration";
  const isFallback = !isTimestamp && !isDuration;

  const depthClassName =
    depth === 0 ? "" : cn("h-[34px]", depth % 2 === 1 ? "bg-card" : "bg-background");
  const inputClassName = cn("font-mono text-13", depthClassName);

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel field={field} htmlFor={path} />

      {isTimestamp && (
        <Controller
          name={path}
          control={control}
          defaultValue=""
          render={({ field: rhfField }) => (
            <Input
              id={path}
              type="datetime-local"
              value={rhfField.value as string}
              onChange={rhfField.onChange}
              onBlur={rhfField.onBlur}
              className={inputClassName}
            />
          )}
        />
      )}

      {isDuration && (
        <Controller
          name={path}
          control={control}
          defaultValue=""
          rules={{
            validate: (val: string) => {
              if (!val) return true;
              return (
                DURATION_PATTERN.test(val) ||
                "Must be a duration like 1h30m, 90s, or 2h15m30s"
              );
            },
          }}
          render={({ field: rhfField, fieldState }) => (
            <>
              <Input
                id={path}
                type="text"
                placeholder="e.g. 1h30m"
                value={rhfField.value as string}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
                aria-invalid={!!fieldState.error}
                className={inputClassName}
              />
              {fieldState.error && (
                <p className="text-12 text-danger" role="alert">
                  {field.label}: {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      )}

      {isFallback && (
        <Controller
          name={path}
          control={control}
          defaultValue=""
          render={({ field: rhfField }) => {
            const shortName = wkt.split(".").pop() ?? wkt;
            const isJsonType = ["Any", "Struct", "Value", "ListValue"].includes(
              shortName
            );
            const placeholder = isJsonType
              ? `${shortName} (JSON)`
              : `${shortName} value`;
            return (
              <Input
                id={path}
                type="text"
                value={rhfField.value as string}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
                placeholder={placeholder}
                className={inputClassName}
              />
            );
          }}
        />
      )}
    </div>
  );
}
