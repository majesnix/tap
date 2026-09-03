import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconButton } from "@/components/common/IconButton";
import type { FieldSchema, MessageSchema, ScalarKind } from "@/lib/types";
import { tableColumns } from "./fieldMeta";

interface RepeatedTableProps {
  field: FieldSchema;
  path: string;
  message: MessageSchema;
}

// 64-bit ints and strings/bytes render as text (precision / raw text); everything else is numeric.
const TEXT_SCALARS: ScalarKind[] = [
  "string",
  "bytes",
  "int64",
  "uint64",
  "sint64",
  "fixed64",
  "sfixed64",
];

function defaultCellValue(childField: FieldSchema): unknown {
  if (childField.kind.type === "enum") return childField.kind.values[0]?.number ?? 0;
  if (childField.kind.type !== "scalar") return "";
  const { scalar } = childField.kind;
  if (scalar === "bool") return false;
  if (TEXT_SCALARS.includes(scalar)) return scalar === "string" || scalar === "bytes" ? "" : "0";
  return 0;
}

function defaultRow(message: MessageSchema): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const childField of message.fields) row[childField.name] = defaultCellValue(childField);
  return row;
}

const CELL_INPUT_CLASSNAME =
  "h-7 rounded-sm border border-transparent bg-transparent px-2 font-mono text-12 focus-visible:border-border-strong focus-visible:bg-card focus-visible:ring-0";

/**
 * Renders a repeated field of a flat message (≤5 scalar/enum fields) as a compact table:
 * a header row of field names, then one borderless-input row per array item.
 * Used by RepeatedField when `isFlatMessage(message)` is true; owns its own "Add item" control
 * so it renders correctly when tested standalone (outside RepeatedField's label row).
 */
export function RepeatedTable({ field, path, message }: RepeatedTableProps) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: path });
  const gridTemplateColumns = tableColumns(message);

  return (
    <div className="flex flex-col gap-2" aria-label={`${field.label} rows`}>
      <div
        className="grid gap-2 px-3 font-mono text-[10.5px] text-ghost whitespace-nowrap"
        style={{ gridTemplateColumns }}
      >
        <span />
        {message.fields.map((childField) => (
          <span key={childField.name}>{childField.name}</span>
        ))}
        <span />
      </div>

      {fields.map((rowField, index) => (
        <div
          key={rowField.id}
          className="grid items-center gap-2 rounded-md border border-border bg-background p-[6px_12px] hover:border-border-strong/40"
          style={{ gridTemplateColumns }}
        >
          <span className="font-mono text-11 text-ghost">{index}</span>

          {message.fields.map((childField) => {
            const cellPath = `${path}.${index}.${childField.name}`;

            if (childField.kind.type === "enum") {
              const values = childField.kind.values;
              return (
                <Controller
                  key={childField.name}
                  name={cellPath}
                  control={control}
                  render={({ field: rhf }) => (
                    <Select value={String(rhf.value)} onValueChange={(v) => rhf.onChange(Number(v))}>
                      <SelectTrigger className={cn(CELL_INPUT_CLASSNAME, "h-7 justify-between")}>
                        <SelectValue />
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
              );
            }

            const isBool = childField.kind.type === "scalar" && childField.kind.scalar === "bool";
            if (isBool) {
              return (
                <Controller
                  key={childField.name}
                  name={cellPath}
                  control={control}
                  render={({ field: rhf }) => (
                    <Switch
                      size="sm"
                      checked={!!rhf.value}
                      onCheckedChange={rhf.onChange}
                      aria-label={childField.label}
                    />
                  )}
                />
              );
            }

            const scalar = childField.kind.type === "scalar" ? childField.kind.scalar : "string";
            const isNumber = !TEXT_SCALARS.includes(scalar);

            return (
              <Controller
                key={childField.name}
                name={cellPath}
                control={control}
                render={({ field: rhf }) => (
                  <Input
                    type={isNumber ? "number" : "text"}
                    value={rhf.value ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      rhf.onChange(isNumber ? (raw === "" ? "" : Number(raw)) : raw);
                    }}
                    className={CELL_INPUT_CLASSNAME}
                  />
                )}
              />
            );
          })}

          <IconButton size={22} danger label="Remove item" onClick={() => remove(index)}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="self-start text-violet-bright"
        onClick={() => append(defaultRow(message))}
      >
        <Plus size={13} className="mr-1" />
        Add item
      </Button>
    </div>
  );
}
