import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useEffect, useRef } from "react";
import type { FieldSchema, MessageSchema, RenderFieldFn } from "@/lib/types";
import { ScalarField } from "./fields/ScalarField";
import { NestedMessageField } from "./fields/NestedMessageField";
import { RepeatedField } from "./fields/RepeatedField";
import { EnumField } from "./fields/EnumField";
import { OneofField } from "./fields/OneofField";
import { WellKnownTypeField } from "./fields/WellKnownTypeField";
import { BytesField } from "./fields/BytesField";

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
}

/**
 * Builds default form values from a message schema.
 * Uses empty strings for scalars, null for messages/oneofs.
 */
function buildDefaultValues(
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
}: ProtoFormRendererProps) {
  const methods = useForm({
    defaultValues: buildDefaultValues(message),
    mode: "onBlur",
  });

  const watchedValues = useWatch({ control: methods.control });

  useEffect(() => {
    onValuesChange(watchedValues);
  }, [watchedValues, onValuesChange]);

  // Reset form when message type changes
  useEffect(() => {
    methods.reset(buildDefaultValues(message));
  }, [message.full_name, methods]);

  // Wire up the resetRef so FormPanel can trigger form.reset() for replay (HIST-02)
  const resetRefInternal = useRef(resetRef);
  resetRefInternal.current = resetRef;
  useEffect(() => {
    if (resetRefInternal.current) {
      resetRefInternal.current.current = (values: Record<string, unknown>) => {
        methods.reset(values);
      };
    }
    // WR-03: Nullify the ref when this component unmounts so callers holding
    // the ref do not invoke reset() on an unmounted react-hook-form instance.
    return () => {
      if (resetRefInternal.current) {
        resetRefInternal.current.current = null;
      }
    };
  }); // intentionally no dep array — runs after every render to stay in sync

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
    <FormProvider {...methods}>
      <form className="flex flex-col gap-4 p-4">
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
  );
}
