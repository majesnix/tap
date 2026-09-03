import { useEffect, useMemo } from "react";
import { Controller, useWatch, useFormContext } from "react-hook-form";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { useMessageMap } from "@/components/form/ProtoSchemaContext";
import type { FieldSchema, MessageSchema, RenderFieldFn } from "@/lib/types";
import { fieldMeta, typeLabel } from "./fieldMeta";
import { FieldTooltip } from "./FieldTooltip";

export interface OneofFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderBranchField: RenderFieldFn;
}

/** "card_number" → "Card Number" — used for the segmented-control label and branch header. */
function titleCase(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/** Resolves the message schema for a message-kind branch field, or undefined otherwise. */
function resolveBranchMessage(
  branchField: FieldSchema | undefined,
  messageMap: Record<string, MessageSchema> | null
): MessageSchema | undefined {
  if (!branchField || branchField.kind.type !== "message") return undefined;
  return messageMap?.[branchField.kind.full_name];
}

/**
 * Renders a oneof group field as a SegmentedControl with conditional branch mounting.
 *
 * Branch field path convention: `${path}.${branchField.name}` (flat — not double-nested).
 * This matches the Rust encoder's expected oneof form shape:
 *   { payment: { _selected: "card_number", card_number: "" } }
 * NOT:
 *   { payment: { _selected: "card_number", card_number: { card_number: "" } } }
 *
 * A message-kind branch's own fields are flattened into the branch container
 * (`${path}.${branchField.name}.${childField.name}`) so the selected-branch UI reads as one
 * container of fields rather than a doubly-nested message chrome.
 *
 * On branch switch, sibling branch paths are unregistered (proto wire semantics:
 * only one oneof field may be set at a time).
 */
export function OneofField({ field, path, depth, renderBranchField }: OneofFieldProps) {
  const { control, unregister } = useFormContext();
  const messageMap = useMessageMap();

  // Hooks run unconditionally; the "not a oneof" early return comes after them.
  const branches = field.kind.type === "oneof" ? field.kind.branches : [];

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

  if (field.kind.type !== "oneof") return null;

  const selectedBranchField = branches[branchNames.indexOf(selected)]?.[0];
  const selectedMessageSchema = resolveBranchMessage(selectedBranchField, messageMap);

  const branchTypeLabel = !selectedBranchField
    ? ""
    : selectedMessageSchema
      ? `${typeLabel(selectedBranchField)} · ${selectedMessageSchema.fields.length} fields`
      : typeLabel(selectedBranchField);

  // Message branch → flatten the resolved message's own fields; anything else → the single branch field.
  const branchFields: { field: FieldSchema; path: string }[] = selectedMessageSchema
    ? selectedMessageSchema.fields.map((childField) => ({
        field: childField,
        path: `${path}.${selectedBranchField!.name}.${childField.name}`,
      }))
    : selectedBranchField
      ? [{ field: selectedBranchField, path: `${path}.${selectedBranchField.name}` }]
      : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FieldTooltip field={field}>
          <span className="text-13 font-medium">{field.label}</span>
        </FieldTooltip>
        <span className="font-mono text-11 text-ghost whitespace-nowrap">{fieldMeta(field)}</span>
      </div>

      <Controller
        name={`${path}._selected`}
        control={control}
        defaultValue={firstBranch}
        render={({ field: rhfField }) => (
          <SegmentedControl
            variant="choice"
            mono
            stretch
            aria-label={field.label}
            value={rhfField.value}
            onChange={rhfField.onChange}
            items={branchNames.map((name) => ({ value: name, label: titleCase(name) }))}
          />
        )}
      />

      {/* Conditional branch mount — not CSS-hidden: actually unmounted from DOM. */}
      {selectedBranchField && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-13 font-medium">{titleCase(selected)}</span>
            <span className="font-mono text-11 text-ghost whitespace-nowrap">{branchTypeLabel}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {branchFields.map(({ field: branchField, path: branchPath }) =>
              renderBranchField(branchField, branchPath, depth)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
