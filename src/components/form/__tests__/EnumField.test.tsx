import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { EnumField } from "../fields/EnumField";
import type { FieldSchema } from "@/lib/types";

/**
 * Mock shadcn Select with a native HTML <select> so JSDOM handles events correctly.
 * The critical contract: options display names, selected value is stored as a number.
 */
vi.mock("@/components/ui/select", () => {
  const React = require("react");

  // Context to pass onValueChange through the component tree
  const SelectCtx = React.createContext<{
    value?: string;
    onValueChange?: (v: string) => void;
  }>({});

  function Select({ value, onValueChange, children }: {
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

  function SelectTrigger({ children }: { children?: React.ReactNode }) {
    const ctx = React.useContext(SelectCtx);
    // Render a button that identifies the trigger (native <select> is the actual combobox)
    return <button data-testid="select-trigger" aria-label="select trigger">{ctx.value}</button>;
  }

  function SelectContent({ children }: { children?: React.ReactNode }) {
    const ctx = React.useContext(SelectCtx);
    // Render a native select with the items as options
    const collectOptions = (nodes: React.ReactNode): { value: string; label: string }[] => {
      const opts: { value: string; label: string }[] = [];
      React.Children.forEach(nodes, (child: React.ReactElement) => {
        if (child?.props?.value !== undefined && typeof child.props.children === "string") {
          opts.push({ value: child.props.value, label: child.props.children });
        }
      });
      return opts;
    };
    const options = collectOptions(children);
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

  function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    return <option value={value}>{children}</option>;
  }

  function SelectValue() {
    return null;
  }

  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
});

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

test("renders Select trigger", () => {
  renderEnum(statusField);
  expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
});

test("shows enum value names (not numbers) as options", () => {
  renderEnum(statusField);
  expect(screen.getByText("PENDING")).toBeInTheDocument();
  expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  expect(screen.getByText("INACTIVE")).toBeInTheDocument();
  // Numbers must NOT appear as standalone options
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
