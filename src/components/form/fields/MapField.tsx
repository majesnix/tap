import React, { useMemo, useEffect } from "react";
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldKind, FieldSchema, RenderFieldFn, ScalarKind } from "@/lib/types";

// ---- Types ----------------------------------------------------------------

interface MapFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderValue: RenderFieldFn;
}

// ---- Helpers ---------------------------------------------------------------

/** Default key value for a new row, based on proto key type. */
function defaultKeyValue(keyType: ScalarKind): string | number {
  if (keyType === "bool") return "false";
  if (
    keyType === "int32" ||
    keyType === "uint32" ||
    keyType === "sint32" ||
    keyType === "fixed32" ||
    keyType === "sfixed32" ||
    keyType === "int64" ||
    keyType === "uint64" ||
    keyType === "sint64" ||
    keyType === "fixed64" ||
    keyType === "sfixed64"
  )
    return 0;
  return "";
}

/** Whether the proto key type uses a number input (32-bit ints) */
function is32BitInt(keyType: ScalarKind): boolean {
  return (
    keyType === "int32" ||
    keyType === "uint32" ||
    keyType === "sint32" ||
    keyType === "fixed32" ||
    keyType === "sfixed32"
  );
}

/** Whether the proto key type is a 64-bit integer (rendered as text with regex) */
function is64BitInt(keyType: ScalarKind): boolean {
  return (
    keyType === "int64" ||
    keyType === "uint64" ||
    keyType === "sint64" ||
    keyType === "fixed64" ||
    keyType === "sfixed64"
  );
}

/** Regex pattern for 64-bit key text inputs */
function int64Regex(keyType: ScalarKind): RegExp {
  // Unsigned types: no negative sign
  if (keyType === "uint64" || keyType === "fixed64") return /^[0-9]+$/;
  return /^-?[0-9]+$/;
}

/** Sensible default value for a new map value row, based on the value's FieldKind.
 *  Prevents the "uncontrolled to controlled" React warning caused by `undefined` values.
 */
function defaultValueForKind(kind: FieldKind): unknown {
  if (kind.type === "scalar") {
    if (kind.scalar === "bool") return false;
    if (["int64", "uint64", "sint64", "fixed64", "sfixed64"].includes(kind.scalar)) return "0";
    if (kind.scalar === "string" || kind.scalar === "bytes") return "";
    return 0;
  }
  return null;
}

// ---- Component -------------------------------------------------------------

/**
 * MapField renders a proto map<K,V> field as a list of key-value rows.
 *
 * Features:
 * - useFieldArray rows — keyed by rhfField.id (never index)
 * - Key input dispatched by key_type: text (string), number (int32), text+regex (int64), Select (bool)
 * - Duplicate key detection via useWatch + useMemo — fires on onChange
 * - Inline "Duplicate key" error shown on every affected row
 * - setError/clearErrors on `${path}.__mapDuplicateGuard` keeps formState.isValid false while duplicates exist
 * - renderValue prop renders the value column — depth+1 prevents MAX_DEPTH bypass
 */
export function MapField({ field, path, depth, renderValue }: MapFieldProps): React.ReactNode {
  // All hook calls are unconditional — Rules of Hooks compliance.
  // ProtoFormRenderer already guarantees field.kind.type === "map" at the call site;
  // the cast below is safe by construction.
  const { control, setError, clearErrors } = useFormContext();
  const { key_type, value_kind } = field.kind as Extract<FieldKind, { type: "map" }>;

  const { fields, append, remove } = useFieldArray({ control, name: path });

  // Watch all rows to detect duplicate keys — fires on every onChange
  const rows = useWatch({ control, name: path }) as Array<{ key: unknown }> | undefined;

  const duplicateKeys = useMemo(() => {
    if (!rows || rows.length === 0) return new Set<string>();
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const row of rows) {
      const k = String(row?.key ?? "");
      if (seen.has(k)) dupes.add(k);
      seen.add(k);
    }
    return dupes;
  }, [rows]);

  const hasDuplicates = duplicateKeys.size > 0;
  const guardName = `${path}.__mapDuplicateGuard`;

  // Keep hidden guard field error in sync with duplicate state.
  // setError/clearErrors is the authoritative mechanism that keeps formState.isValid false.
  // No Controller is needed — RHF only runs Controller validate rules when the field's
  // own value changes, and the guard field has no input.
  useEffect(() => {
    if (hasDuplicates) {
      setError(guardName, { type: "manual", message: "Duplicate key" });
    } else {
      clearErrors(guardName);
    }
  }, [hasDuplicates, guardName, setError, clearErrors]);

  // Build badge label — e.g. "map<string, int32>"
  const valueSummary =
    value_kind.type === "scalar"
      ? value_kind.scalar
      : value_kind.type === "message"
        ? value_kind.full_name
        : value_kind.type === "enum"
          ? "enum"
          : value_kind.type === "well_known"
            ? value_kind.wkt
            : "map";
  const badgeLabel = `map<${key_type}, ${valueSummary}>`;

  function handleAppend() {
    append({ key: defaultKeyValue(key_type), value: defaultValueForKind(value_kind) });
  }

  return (
    <div className="mb-3">
      {/* Field header */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="text-xs">
          {badgeLabel}
        </Badge>
        <span className="text-sm font-semibold">{field.label}</span>
      </div>

      {/* Row list */}
      {fields.map((rhfField, index) => {
        const keyPath = `${path}.${index}.key`;
        const rowKey = String(
          (rows?.[index] as { key?: unknown } | undefined)?.key ?? ""
        );
        // Per MFLD-03: empty-string keys count as valid duplicate keys
        const isDupe = duplicateKeys.has(rowKey);

        // Synthetic FieldSchema for the value renderer (per D-08)
        const valueFieldSchema: FieldSchema = {
          name: `${field.name}[${index}].value`,
          label: "Value",
          kind: value_kind,
          repeated: false,
        };
        const valuePath = `${path}.${index}.value`;

        return (
          <div
            key={rhfField.id}
            className="flex items-start gap-2 p-2 border rounded mb-2"
          >
            {/* Key column */}
            <div className="w-1/3">
              {key_type === "bool" ? (
                <Controller
                  name={keyPath}
                  control={control}
                  render={({ field: ctrl }) => (
                    <Select
                      value={String(ctrl.value ?? "false")}
                      onValueChange={ctrl.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <Controller
                  name={keyPath}
                  control={control}
                  rules={
                    is64BitInt(key_type)
                      ? {
                          pattern: {
                            value: int64Regex(key_type),
                            message: "Integer required",
                          },
                        }
                      : undefined
                  }
                  render={({ field: ctrl, fieldState }) => (
                    <>
                      <Input
                        {...ctrl}
                        type={is32BitInt(key_type) ? "number" : "text"}
                        placeholder="Key"
                        value={ctrl.value ?? ""}
                        aria-describedby={
                          isDupe || fieldState.error
                            ? `${keyPath}-error`
                            : undefined
                        }
                      />
                      {(isDupe || fieldState.error) && (
                        <p
                          id={`${keyPath}-error`}
                          className="text-xs text-destructive mt-1"
                          role="alert"
                        >
                          {isDupe ? "Duplicate key" : fieldState.error?.message}
                        </p>
                      )}
                    </>
                  )}
                />
              )}
            </div>

            {/* Value column */}
            <div className="flex-1">
              {renderValue(valueFieldSchema, valuePath, depth + 1)}
            </div>

            {/* Remove button */}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Remove entry"
              className="shrink-0 mt-1"
              onClick={() => remove(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      })}

      {/* Add entry button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={handleAppend}
      >
        <Plus className="w-4 h-4 mr-1" />
        Add entry
      </Button>
    </div>
  );
}
