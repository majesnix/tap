import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { RepeatedField } from "../fields/RepeatedField";
import { ProtoSchemaContext } from "../ProtoSchemaContext";
import type { FieldSchema, MessageSchema } from "@/lib/types";

const stringFieldSchema: FieldSchema = {
  name: "tags",
  label: "tags",
  field_number: 1,
  kind: { type: "scalar", scalar: "string" },
  repeated: true,
  default_value: "",
};

const lineItemMessage: MessageSchema = {
  name: "LineItem",
  full_name: "p.LineItem",
  fields: [
    { name: "sku", label: "sku", field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: false },
    { name: "qty", label: "qty", field_number: 2, kind: { type: "scalar", scalar: "int32" }, repeated: false },
  ],
};

const itemsFieldSchema: FieldSchema = {
  name: "items",
  label: "Items",
  field_number: 3,
  kind: { type: "message", full_name: "p.LineItem" },
  repeated: true,
};

/**
 * Wraps RepeatedField in a FormProvider for isolated testing.
 * Uses the `path` prop to match ProtoFormRenderer callsite.
 */
function renderRepeated(field: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { [field.name]: [] } });
    return (
      <FormProvider {...methods}>
        <RepeatedField
          field={field}
          path={field.name}
          depth={0}
          renderItem={(_f: FieldSchema, itemPath: string) => (
            <input key={itemPath} data-testid={itemPath} type="text" />
          )}
        />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

test("renders empty list initially with Add item button", () => {
  renderRepeated(stringFieldSchema);
  expect(screen.getByText(/Add item/i)).toBeInTheDocument();
});

test("clicking Add item appends a new row", async () => {
  const user = userEvent.setup();
  renderRepeated(stringFieldSchema);
  await user.click(screen.getByText(/Add item/i));
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
});

test("clicking remove deletes the row", async () => {
  const user = userEvent.setup();
  renderRepeated(stringFieldSchema);
  await user.click(screen.getByText(/Add item/i));
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  const removeBtn = screen.getByRole("button", { name: /remove/i });
  await user.click(removeBtn);
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
});

// ─── flat-message repeated field → RepeatedTable ─────────────────────────────
// Exercises the actual RepeatedField → RepeatedTable wiring (message.kind.type === "message"
// resolved via ProtoSchemaContext, then isFlatMessage) — not just RepeatedTable in isolation.

test("a repeated flat message renders as a RepeatedTable (field-name header, single Add item button)", () => {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { items: [] } });
    return (
      <ProtoSchemaContext.Provider value={{ "p.LineItem": lineItemMessage }}>
        <FormProvider {...methods}>
          <RepeatedField
            field={itemsFieldSchema}
            path="items"
            depth={0}
            renderItem={(_f: FieldSchema, itemPath: string) => (
              <input key={itemPath} data-testid={itemPath} type="text" />
            )}
          />
        </FormProvider>
      </ProtoSchemaContext.Provider>
    );
  };
  render(<Wrapper />);

  // Table-only markup: a header row of the flat message's field names.
  expect(screen.getByText("sku")).toBeInTheDocument();
  expect(screen.getByText("qty")).toBeInTheDocument();
  // RepeatedTable owns "Add item" on this path — RepeatedField's label row must not add a second one.
  expect(screen.getAllByText(/Add item/i)).toHaveLength(1);
});
