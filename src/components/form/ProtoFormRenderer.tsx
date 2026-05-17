import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useEffect } from "react";
import type { FieldSchema, MessageSchema, RenderFieldFn } from "@/lib/types";
import { ScalarField } from "./fields/ScalarField";
import { NestedMessageField } from "./fields/NestedMessageField";
import { RepeatedField } from "./fields/RepeatedField";
import { EnumField } from "./fields/EnumField";
import { OneofField } from "./fields/OneofField";
import { WellKnownTypeField } from "./fields/WellKnownTypeField";

const MAX_DEPTH = 5;

interface ProtoFormRendererProps {
  message: MessageSchema;
  onValuesChange: (values: unknown) => void;
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
        defaults[field.name] = "";
        break;
      case "enum":
        defaults[field.name] =
          field.kind.values.length > 0 ? field.kind.values[0].name : "";
        break;
      case "oneof":
        defaults[field.name] = { _selected: "" };
        break;
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
}: ProtoFormRendererProps) {
  const methods = useForm({
    defaultValues: buildDefaultValues(message),
  });

  const watchedValues = useWatch({ control: methods.control });

  useEffect(() => {
    onValuesChange(watchedValues);
  }, [watchedValues, onValuesChange]);

  // Reset form when message type changes
  useEffect(() => {
    methods.reset(buildDefaultValues(message));
  }, [message.full_name, methods]);

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
