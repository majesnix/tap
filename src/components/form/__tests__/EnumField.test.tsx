import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { EnumField } from "../fields/EnumField";
import type { FieldSchema } from "@/lib/types";

/**
 * Mock shadcn Select with a native HTML <select> so JSDOM handles events correctly.
 * The critical contract: options display names, selected value is stored as a number.
 *
 * Radix UI Select relies on pointer events and portals that JSDOM doesn't fully support.
 * This mock preserves the API surface (Select + trigger + content + items) while using
 * native HTML elements for testability.
 */

interface SelectContextValue {
  value?: string;
  onValueChange?: (v: string) => void;
}

const SelectCtx = React.createContext<SelectContextValue>({});

function MockSelect({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <SelectCtx.Provider value={{ value, onValueChange }}>
      {children}
    </SelectCtx.Provider>
  );
}

function MockSelectTrigger({ children: _children }: { children?: React.ReactNode }) {
  return <button data-testid="select-trigger" aria-label="select trigger" />;
}

function MockSelectContent({ children }: { children?: React.ReactNode }) {
  const ctx = React.useContext(SelectCtx);
  const options: { value: string; label: React.ReactNode }[] = [];
  React.Children.forEach(children, (child) => {
    const el = child as React.ReactElement<{ value: string; children: React.ReactNode }>;
    if (el?.props?.value !== undefined) {
      options.push({ value: el.props.value, label: el.props.children });
    }
  });
  return (
    <select
      data-testid="native-select"
      value={ctx.value}
      onChange={(e) => ctx.onValueChange?.(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function MockSelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}

function MockSelectValue() {
  return null;
}

vi.mock("@/components/ui/select", () => ({
  Select: MockSelect,
  SelectTrigger: MockSelectTrigger,
  SelectContent: MockSelectContent,
  SelectItem: MockSelectItem,
  SelectValue: MockSelectValue,
}));

const statusField: FieldSchema = {
  name: "status",
  label: "status",
  field_number: 1,
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

test("renders Select trigger", () => {
  renderEnum(statusField);
  expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
});

test("shows enum value names (not numbers) as options", () => {
  renderEnum(statusField);
  expect(screen.getByText("PENDING")).toBeInTheDocument();
  expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  expect(screen.getByText("INACTIVE")).toBeInTheDocument();
  // Numbers must NOT appear as standalone option labels
  expect(screen.queryByRole("option", { name: "0" })).not.toBeInTheDocument();
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
  // Select ACTIVE (stored as number 1) via the native select element
  await user.selectOptions(screen.getByTestId("native-select"), "1");
  // Value should be 1 (number), not "1" (string) or "ACTIVE" (string)
  expect(capturedValue).toBe(1);
});
