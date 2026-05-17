import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema } from "@/lib/types";

const DURATION_PATTERN = /^(\d+h)?(\d+m)?(\d+(\.\d+)?s)?$/;

interface WellKnownTypeFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Renders a WellKnownType field.
 * - Timestamp → datetime-local input (ISO 8601 string sent to Rust)
 * - Duration  → text input with placeholder "e.g. 1h30m" and regex validation
 * - All other WKTs → plain text input with badge showing the WKT name (G-8)
 */
export function WellKnownTypeField({ field, path }: WellKnownTypeFieldProps) {
  const { control } = useFormContext();

  if (field.kind.type !== "well_known") return null;

  const { wkt } = field.kind;

  const isTimestamp = wkt === "Timestamp";
  const isDuration = wkt === "Duration";
  const isFallback = !isTimestamp && !isDuration;

  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold" htmlFor={path}>
          {field.label}
        </Label>
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          wkt
        </Badge>
        {isFallback && (
          <Badge
            variant="secondary"
            className="text-xs px-1.5 py-0 max-w-[200px] truncate"
          >
            {wkt}
          </Badge>
        )}
      </div>

      {isTimestamp && (
        <Controller
          name={path}
          control={control}
          defaultValue=""
          render={({ field: rhfField }) => (
            <input
              id={path}
              type="datetime-local"
              value={rhfField.value as string}
              onChange={rhfField.onChange}
              onBlur={rhfField.onBlur}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                className={fieldState.error ? "border-destructive" : ""}
              />
              {fieldState.error && (
                <p className="text-xs text-destructive" role="alert">
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
          render={({ field: rhfField }) => (
            <Input
              id={path}
              type="text"
              value={rhfField.value as string}
              onChange={rhfField.onChange}
              onBlur={rhfField.onBlur}
              placeholder={`${wkt} value`}
            />
          )}
        />
      )}
    </div>
  );
}
