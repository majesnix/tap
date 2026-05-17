import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { EnumField } from "../fields/EnumField";
import type { FieldSchema } from "@/lib/types";

const statusField: FieldSchema = {
  name: "status",
  label: "status",
  kind: {
    type: "enum",
    values: [
      { name: "PENDING", number: 0 },
      { name: "ACTIVE", number: 1 },
      { name: "INACTIVE", number: 2 },
    ],
  },
  repeated: false,
  default_value: 0,
};

function renderEnum(field: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { [field.name]: field.default_value ?? 0 } });
    return (
      <FormProvider {...methods}>
        <EnumField field={field} path={field.name} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

test("renders Select with value name options", () => {
  renderEnum(statusField);
  // shadcn Select renders a trigger button
  expect(screen.getByRole("combobox")).toBeInTheDocument();
});

test("shows enum value names (not numbers) as options", async () => {
  const user = userEvent.setup();
  renderEnum(statusField);
  await user.click(screen.getByRole("combobox"));
  expect(await screen.findByText("PENDING")).toBeInTheDocument();
  expect(await screen.findByText("ACTIVE")).toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument(); // numbers must NOT appear
});

test("stores number value when option selected", async () => {
  const user = userEvent.setup();
  let capturedValue: unknown;
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { status: 0 } });
    capturedValue = methods.watch("status");
    return (
      <FormProvider {...methods}>
        <EnumField field={statusField} path="status" />
      </FormProvider>
    );
  };
  render(<Wrapper />);
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByText("ACTIVE"));
  // Value should be 1 (number), not "ACTIVE" (string)
  expect(capturedValue).toBe(1);
});
