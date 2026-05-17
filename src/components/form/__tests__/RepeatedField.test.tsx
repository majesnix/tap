import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { RepeatedField } from "../fields/RepeatedField";
import type { FieldSchema } from "@/lib/types";

const stringFieldSchema: FieldSchema = {
  name: "tags",
  label: "tags",
  kind: { type: "scalar", scalar: "string" },
  repeated: true,
  default_value: "",
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
