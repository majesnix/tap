import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { NestedMessageField } from "../fields/NestedMessageField";
import { ProtoSchemaContext } from "../ProtoSchemaContext";
import type { FieldSchema, MessageSchema } from "@/lib/types";

// Build a minimal schema for use in all tests
const stringField: FieldSchema = {
  name: "title",
  label: "title",
  field_number: 1,
  kind: { type: "scalar", scalar: "string" },
  repeated: false,
  default_value: "",
};
const innerMessage: MessageSchema = {
  name: "Inner",
  full_name: "com.Inner",
  fields: [stringField],
};
const testSchema = {
  messages: [innerMessage],
  message_map: { "com.Inner": innerMessage },
  enums: [],
};

const innerField: FieldSchema = {
  name: "inner",
  label: "Inner",
  field_number: 2,
  kind: { type: "message", full_name: "com.Inner" },
  repeated: false,
};

/**
 * Wraps NestedMessageField in a FormProvider and ProtoSchemaContext for isolated testing.
 * Uses the `path` prop to match ProtoFormRenderer callsite.
 */
function renderNested(depth: number) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { inner: { title: "" } } });
    return (
      <ProtoSchemaContext.Provider value={testSchema.message_map}>
        <FormProvider {...methods}>
          <NestedMessageField
            field={innerField}
            path="inner"
            depth={depth}
            renderChildField={(_f: FieldSchema, childPath: string) => (
              <input key={childPath} data-testid={childPath} />
            )}
          />
        </FormProvider>
      </ProtoSchemaContext.Provider>
    );
  };
  return render(<Wrapper />);
}

test("renders collapsible with field label", () => {
  renderNested(0);
  expect(screen.getByText(/inner/i)).toBeInTheDocument();
});

test("renders DepthCapPlaceholder at depth 5", () => {
  renderNested(5);
  expect(screen.getByText(/Nesting limit reached/i)).toBeInTheDocument();
});

test("does not render DepthCapPlaceholder at depth 4", () => {
  renderNested(4);
  expect(screen.queryByText(/Nesting limit reached/i)).not.toBeInTheDocument();
});
