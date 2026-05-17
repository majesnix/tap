import { useEffect, useMemo } from "react";
import { Controller, useWatch, useFormContext } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";

export interface OneofFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderBranchField: RenderFieldFn;
}

/**
 * Renders a oneof group field as a RadioGroup with conditional branch mounting.
 *
 * Branch field path convention: `${path}.${branchField.name}` (flat — not double-nested).
 * This matches the Rust encoder's expected oneof form shape:
 *   { payment: { _selected: "card_number", card_number: "" } }
 * NOT:
 *   { payment: { _selected: "card_number", card_number: { card_number: "" } } }
 *
 * On branch switch, sibling branch paths are unregistered (proto wire semantics:
 * only one oneof field may be set at a time).
 */
export function OneofField({ field, path, depth, renderBranchField }: OneofFieldProps) {
  const { control, unregister } = useFormContext();

  if (field.kind.type !== "oneof") return null;

  const branches = field.kind.branches;

  // Branch name = first field's name in each branch.
  // useMemo ensures stable reference so useEffect deps don't trigger infinite loops.
  const branchNames = useMemo(
    () => branches.map((branch) => branch[0]?.name ?? "unknown"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // branches shape is stable for the lifetime of this field schema
  );
  const firstBranch = branchNames[0] ?? "";

  const selected = useWatch({
    control,
    name: `${path}._selected`,
    defaultValue: firstBranch,
  });

  // When selected branch changes: unregister all non-selected branches (proto wire semantics)
  useEffect(() => {
    branchNames.forEach((name) => {
      if (name !== selected) {
        unregister(`${path}.${name}`);
      }
    });
  }, [selected, path, unregister, branchNames]);

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold">{field.label}</Label>
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          oneof
        </Badge>
      </div>
      <Controller
        name={`${path}._selected`}
        control={control}
        defaultValue={firstBranch}
        render={({ field: rhfField }) => (
          <RadioGroup
            value={rhfField.value}
            onValueChange={rhfField.onChange}
            className="flex flex-col gap-1"
          >
            {branchNames.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <RadioGroupItem value={name} id={`${path}._${name}`} />
                <Label htmlFor={`${path}._${name}`} className="text-sm">
                  {name}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
      />
      {/* Conditional branch mount — not CSS-hidden: actually unmounted from DOM.
          Path convention: ${path}.${branchField.name} — flat, matches Rust encoder shape. */}
      {branchNames.map((name, idx) =>
        selected === name ? (
          <div key={name} className="ml-4 border-l border-border pl-3">
            {branches[idx]?.map((branchField) =>
              renderBranchField(branchField, `${path}.${branchField.name}`, depth)
            )}
          </div>
        ) : null
      )}
    </div>
  );
}
