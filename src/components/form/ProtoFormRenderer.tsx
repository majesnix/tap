import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useCallback, useEffect, useRef } from "react";
import type { FieldSchema, MessageSchema, RenderFieldFn } from "@/lib/types";
import { buildApplyPlan } from "@/lib/blockApply";
import type { ApplyBlockRef, ConflictChoices, ConflictItem } from "@/lib/blockApply";
import { ScalarField } from "./fields/ScalarField";
import { NestedMessageField } from "./fields/NestedMessageField";
import { RepeatedField } from "./fields/RepeatedField";
import { EnumField } from "./fields/EnumField";
import { OneofField } from "./fields/OneofField";
import { WellKnownTypeField } from "./fields/WellKnownTypeField";
import { BytesField } from "./fields/BytesField";
import { MapField } from "./fields/MapField";
import { useProtoStore } from "@/stores/useProtoStore";
import { ProtoSchemaContext } from "./ProtoSchemaContext";

const MAX_DEPTH = 5;

interface ProtoFormRendererProps {
  message: MessageSchema;
  onValuesChange: (values: unknown) => void;
  /**
   * Optional ref that will be populated with a form.reset function once the
   * form is mounted. FormPanel uses this to trigger replay without prop-drilling
   * all the way through the component tree.
   */
  resetRef?: React.MutableRefObject<
    ((values: Record<string, unknown>) => void) | null
  >;
  /**
   * Optional ref populated with a two-phase { buildPlan, commitApply } object (D-01).
   * FormPanel calls `buildPlan(blockValues)` to get an ApplyPlan, then
   * `commitApply(plan)` to write eligible field values to the form.
   *
   * Eligibility: top-level scalar, enum, well_known, and map fields (BLK-EXT-01/02).
   * Protection: fields where formState.dirtyFields[key] is truthy are not overwritten (BLK-07).
   * Map fields: applied only when the current form value is empty ([] or null); non-empty
   * maps are silently skipped in Phase 25 — Phase 26 adds conflict resolution.
   */
  applyBlockRef?: React.MutableRefObject<ApplyBlockRef | null>;
}

/**
 * Builds default form values from a message schema.
 * Uses empty strings for scalars, null for messages/oneofs.
 */
export function buildDefaultValues(
  message: MessageSchema
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of message.fields) {
    if (field.repeated) {
      defaults[field.name] = [];
      continue;
    }

    switch (field.kind.type) {
      case "scalar":
        // FORM-07: use default_value from schema when available; fall back to
        // sensible zero-values by scalar type (string → "", bool → false, number → 0)
        if (field.default_value !== undefined && field.default_value !== null) {
          defaults[field.name] = field.default_value;
        } else {
          const sk = field.kind.scalar;
          if (sk === "bool") {
            defaults[field.name] = false;
          } else if (
            ["int64", "uint64", "sint64", "fixed64", "sfixed64"].includes(sk)
          ) {
            defaults[field.name] = "0";
          } else if (sk === "string" || sk === "bytes") {
            defaults[field.name] = "";
          } else {
            defaults[field.name] = 0;
          }
        }
        break;
      case "enum":
        // Store the integer number (not the name string) — matches EnumField's Controller value
        defaults[field.name] =
          field.kind.values.length > 0 ? field.kind.values[0].number : 0;
        break;
      case "oneof": {
        // _selected must start on the first branch name — OneofField's useWatch default matches this
        const firstBranch = field.kind.branches[0]?.[0]?.name ?? "";
        defaults[field.name] = { _selected: firstBranch };
        break;
      }
      case "message":
      case "well_known":
        defaults[field.name] = null;
        break;
      case "map":
        defaults[field.name] = [];
        break;
    }
  }

  return defaults;
}

/**
 * ProtoFormRenderer is the stable dispatch layer between the schema and
 * the field component implementations. It is NOT modified in Wave 2 —
 * Wave 2 only replaces the stub field components with real implementations.
 */
export function ProtoFormRenderer({
  message,
  onValuesChange,
  resetRef,
  applyBlockRef,
}: ProtoFormRendererProps) {
  const messageMap = useProtoStore((s) => s.schema?.message_map ?? null);
  const methods = useForm({
    defaultValues: buildDefaultValues(message),
    mode: "onBlur",
  });

  // Registry keyed by full field path string; value is MapField's replace fn (or null after unmount).
  // Used by commitApply to replace map rows when block fill targets an empty map field (D-05).
  const mapReplaceRegistry = useRef<Record<string, ((rows: unknown[]) => void) | null>>({});

  // Stable callback passed as onRegisterReplace prop to MapField instances.
  // useCallback with empty deps: mapReplaceRegistry ref object identity never changes (Pitfall 5).
  const handleRegisterReplace = useCallback(
    (path: string, fn: ((rows: unknown[]) => void) | null) => {
      mapReplaceRegistry.current[path] = fn;
    },
    [] // stable: mapReplaceRegistry.current is mutated in place, no reference change
  );

  const watchedValues = useWatch({ control: methods.control });

  useEffect(() => {
    onValuesChange(watchedValues);
  }, [watchedValues, onValuesChange]);

  // Reset form when message type changes
  useEffect(() => {
    methods.reset(buildDefaultValues(message));
  }, [message.full_name, methods]);

  // Wire up the resetRef so FormPanel can trigger form.reset() for replay (HIST-02).
  // Dependency array [resetRef, methods] ensures the effect re-runs only when these
  // stable references change, and cleanup runs only on actual unmount (not every render).
  useEffect(() => {
    if (resetRef) {
      resetRef.current = (values: Record<string, unknown>) => {
        methods.reset(values);
      };
    }
    return () => {
      if (resetRef) {
        resetRef.current = null;  // Nullify on actual unmount only
      }
    };
  }, [resetRef, methods]);

  // Wire up applyBlockRef with the two-phase { buildPlan, commitApply } object (D-01, BLK-EXT-07).
  // Dependency array [applyBlockRef, methods, message] — message.fields drives the eligible set.
  useEffect(() => {
    if (applyBlockRef) {
      applyBlockRef.current = {
        buildPlan: (blockValues: Record<string, unknown>) =>
          buildApplyPlan(
            message.fields,
            methods.getValues(),
            methods.formState.dirtyFields as Partial<Record<string, unknown>>,
            blockValues
          ),
        commitApply: (plan, choices?: ConflictChoices) => {
          // ── Phase A: write toApply items ──────────────────────────────────────
          // Pitfall D fix: ALL setValue calls use { shouldDirty: false } so
          // block-filled fields stay non-dirty and remain eligible on the next drag.
          for (const item of plan.toApply) {
            if (item.kind === "map") {
              // Map fields: call the registered replace fn (D-05).
              // replace() marks the field dirty — a second block drag will skip it.
              // This is accepted Phase 25 behavior: a block-filled map is "user-owned".
              mapReplaceRegistry.current[item.fieldName]?.(item.value as unknown[]);
            } else {
              // Scalar / enum / well_known / oneof dotted-path sub-fields:
              // setValue with { shouldDirty: false } (Pitfall D fix).
              methods.setValue(
                item.fieldName,
                item.value as Parameters<typeof methods.setValue>[1],
                { shouldDirty: false }
              );
            }
          }

          // ── Phase B: write conflict items where choice is 'overwrite' ─────────
          // Only when choices is provided (conflict dialog was shown).
          if (!choices) return;

          // Group map_key_collision items by fieldName for atomic per-field merge.
          const mapCollisionsByField = new Map<string, ConflictItem[]>();
          for (const item of plan.conflicts) {
            if (item.kind === "map_key_collision") {
              const existing = mapCollisionsByField.get(item.fieldName) ?? [];
              existing.push(item);
              mapCollisionsByField.set(item.fieldName, existing);
            }
          }

          // Atomic merge per map field that has collisions.
          // Runs unconditionally (even if all rows skipped) to ensure
          // nonCollidingBlockRows are always appended to the existing rows.
          for (const [fieldName, conflictItemsForField] of mapCollisionsByField) {
            // Collect keys the user chose to overwrite
            const overwriteSet = new Set<string>(
              conflictItemsForField
                .filter((c) => (choices[`${fieldName}:${c.collisionKey}`] ?? "skip") === "overwrite")
                .map((c) => String(c.collisionKey))
            );

            // Get current existing rows
            const existingRows = methods.getValues(fieldName) as Array<Record<string, unknown>>;

            // Replace colliding rows where user chose overwrite; preserve others
            const mergedExisting = existingRows.map((row) => {
              const rowKey = String((row as { key: unknown }).key);
              if (overwriteSet.has(rowKey)) {
                // Find the ConflictItem carrying the block value for this key
                const conflictItem = conflictItemsForField.find(
                  (c) => String(c.collisionKey) === rowKey
                );
                return conflictItem?.blockValue ?? row;
              }
              return row;
            });

            // Append non-colliding block rows (same array ref on all items for this field)
            const nonCollidingRows = conflictItemsForField[0]?.nonCollidingBlockRows ?? [];
            const merged = [...mergedExisting, ...nonCollidingRows];

            // Single atomic replace() call — the ONLY write for this field
            mapReplaceRegistry.current[fieldName]?.(merged as unknown[]);
          }

          // Handle non-map conflict items (oneof_dirty_subfield, oneof_branch_switch)
          for (const item of plan.conflicts) {
            if (item.kind === "map_key_collision") continue;

            const choiceKey =
              item.kind === "oneof_dirty_subfield"
                ? `${item.fieldName}:${item.subFieldName}`
                : item.fieldName; // oneof_branch_switch: bare field name

            if ((choices[choiceKey] ?? "skip") !== "overwrite") continue;

            if (item.kind === "oneof_dirty_subfield") {
              // Fine-grained dotted-path write to the specific sub-field.
              // Cast via string to avoid template-literal generic inference issues.
              const dottedPath = `${item.fieldName}.${item.subFieldName}` as Parameters<typeof methods.setValue>[0];
              methods.setValue(
                dottedPath,
                item.blockValue as Parameters<typeof methods.setValue>[1],
                { shouldDirty: false }
              );
            } else if (item.kind === "oneof_branch_switch") {
              // D-05: single atomic setValue to switch branch — prevents Pitfall A
              // (setting _selected then branch field separately triggers unregister)
              const blockBranch = item.blockBranch!;
              const subValue = (item.blockValue as Record<string, unknown>)[blockBranch];
              methods.setValue(
                item.fieldName,
                { _selected: blockBranch, [blockBranch]: subValue } as Parameters<typeof methods.setValue>[1],
                { shouldDirty: false }
              );
            }
          }
        },
      };
    }
    return () => {
      if (applyBlockRef) applyBlockRef.current = null;
    };
  }, [applyBlockRef, methods, message]);

  /**
   * Main dispatch function. Determines which field component to render
   * based on the field's kind. Uses prop-passing to avoid circular imports.
   */
  const renderField: RenderFieldFn = (
    field: FieldSchema,
    path: string,
    depth: number
  ) => {
    if (depth > MAX_DEPTH) {
      return (
        <div key={path} className="text-xs text-muted-foreground">
          (max depth reached)
        </div>
      );
    }

    // Phase 6: bytes fields bypass ScalarField — ProtoFormRenderer switch is FROZEN (D-01)
    if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
      return <BytesField key={path} field={field} path={path} />;
    }

    // Phase 7: map fields bypass the switch block — ProtoFormRenderer switch is FROZEN (D-01)
    if (field.kind.type === "map") {
      return (
        <MapField
          key={path}
          field={field}
          path={path}
          depth={depth}
          renderValue={renderField}
          onRegisterReplace={handleRegisterReplace}
        />
      );
    }

    switch (field.kind.type) {
      case "scalar":
        return (
          <ScalarField key={path} field={field} path={path} />
        );

      case "message":
        return (
          <NestedMessageField
            key={path}
            field={field}
            path={path}
            depth={depth}
            renderChildField={renderField}
          />
        );

      case "enum":
        return (
          <EnumField key={path} field={field} path={path} />
        );

      case "oneof":
        return (
          <OneofField
            key={path}
            field={field}
            path={path}
            depth={depth}
            renderBranchField={renderField}
          />
        );

      case "well_known":
        return (
          <WellKnownTypeField key={path} field={field} path={path} />
        );

      default:
        return null;
    }
  };

  return (
    <ProtoSchemaContext.Provider value={messageMap}>
      <FormProvider {...methods}>
        <form className="flex flex-col gap-4 p-4" onSubmit={(e) => e.preventDefault()}>
          {message.fields.map((field) => {
            const path = field.name;

            // Repeated fields are dispatched to RepeatedField regardless of inner kind
            if (field.repeated) {
              return (
                <RepeatedField
                  key={path}
                  field={field}
                  path={path}
                  depth={0}
                  renderItem={renderField}
                />
              );
            }

            return renderField(field, path, 0);
          })}
        </form>
      </FormProvider>
    </ProtoSchemaContext.Provider>
  );
}
