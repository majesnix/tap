import React, { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { RepeatedTable } from "../fields/RepeatedTable";
import type { FieldSchema, MessageSchema } from "@/lib/types";

// Mock shadcn Select with a native <select> — Radix Select needs pointer events/portals
// jsdom doesn't support. Copied verbatim from EnumField.test.tsx.
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
  return <SelectCtx.Provider value={{ value, onValueChange }}>{children}</SelectCtx.Provider>;
}
function MockSelectTrigger() {
  return <button data-testid="select-trigger" aria-label="select trigger" />;
}
function MockSelectContent({ children }: { children?: React.ReactNode }) {
  const ctx = React.useContext(SelectCtx);
  const options: { value: string; label: React.ReactNode }[] = [];
  React.Children.forEach(children, (child) => {
    const el = child as React.ReactElement<{ value: string; children: React.ReactNode }>;
    if (el?.props?.value !== undefined) options.push({ value: el.props.value, label: el.props.children });
  });
  return (
    <select data-testid="native-select" value={ctx.value} onChange={(e) => ctx.onValueChange?.(e.target.value)}>
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

const lineItemMessage: MessageSchema = {
  name: "LineItem",
  full_name: "p.LineItem",
  fields: [
    { name: "sku", label: "sku", field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: false },
    { name: "qty", label: "qty", field_number: 2, kind: { type: "scalar", scalar: "int32" }, repeated: false },
  ],
};

const itemsField: FieldSchema = {
  name: "items",
  label: "Items",
  field_number: 3,
  kind: { type: "message", full_name: "p.LineItem" },
  repeated: true,
};

function renderTable() {
  const apiRef: { current: ((name: string) => unknown) | null } = { current: null };
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { items: [] } });
    useEffect(() => {
      apiRef.current = methods.getValues;
    });
    return (
      <FormProvider {...methods}>
        <RepeatedTable field={itemsField} path="items" message={lineItemMessage} />
      </FormProvider>
    );
  };
  render(<Wrapper />);
  return { getValues: (name: string) => apiRef.current!(name) };
}

test("header lists the flat message's field names", () => {
  renderTable();
  expect(screen.getByText("sku")).toBeInTheDocument();
  expect(screen.getByText("qty")).toBeInTheDocument();
});

test("Add item appends a row with one input per field", async () => {
  const user = userEvent.setup();
  renderTable();
  await user.click(screen.getByText(/Add item/i));
  // sku (text) + qty (number) — two inputs in the new row
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
});

test("the trash button removes the row", async () => {
  const user = userEvent.setup();
  renderTable();
  await user.click(screen.getByText(/Add item/i));
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /remove item/i }));
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
});

test("typing into a cell updates getValues for that row/field", async () => {
  const user = userEvent.setup();
  const { getValues } = renderTable();
  await user.click(screen.getByText(/Add item/i));
  const skuInput = screen.getAllByRole("textbox")[0];
  await user.type(skuInput, "ABC-1");
  expect(getValues("items.0.sku")).toBe("ABC-1");
});

// ─── enum + bool cells ────────────────────────────────────────────────────────

const flagMessage: MessageSchema = {
  name: "Flag",
  full_name: "p.Flag",
  fields: [
    {
      name: "level",
      label: "level",
      field_number: 1,
      kind: { type: "enum", values: [{ name: "LOW", number: 0 }, { name: "HIGH", number: 1 }] },
      repeated: false,
    },
    { name: "active", label: "active", field_number: 2, kind: { type: "scalar", scalar: "bool" }, repeated: false },
  ],
};

const flagsField: FieldSchema = {
  name: "flags",
  label: "Flags",
  field_number: 4,
  kind: { type: "message", full_name: "p.Flag" },
  repeated: true,
};

function renderFlagsTable() {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { flags: [] } });
    return (
      <FormProvider {...methods}>
        <RepeatedTable field={flagsField} path="flags" message={flagMessage} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

test("renders an enum cell as a select and a bool cell as a switch", async () => {
  const user = userEvent.setup();
  renderFlagsTable();
  await user.click(screen.getByText(/Add item/i));
  expect(screen.getByTestId("native-select")).toBeInTheDocument();
  expect(screen.getByRole("switch")).toBeInTheDocument();
});

// ─── per-cell scalar validation (shared scalarRules) ─────────────────────────

const amountMessage: MessageSchema = {
  name: "Amount",
  full_name: "p.Amount",
  fields: [
    { name: "qty", label: "qty", field_number: 1, kind: { type: "scalar", scalar: "int32" }, repeated: false },
    { name: "total", label: "total", field_number: 2, kind: { type: "scalar", scalar: "uint64" }, repeated: false },
  ],
};

const amountsField: FieldSchema = {
  name: "amounts",
  label: "Amounts",
  field_number: 5,
  kind: { type: "message", full_name: "p.Amount" },
  repeated: true,
};

function renderAmountsTable() {
  const Wrapper = () => {
    // mode: "onBlur" — matches production (ProtoFormRenderer's useForm), and is what
    // makes the Controller's validate rule run on blur rather than only on submit.
    const methods = useForm({ defaultValues: { amounts: [] }, mode: "onBlur" });
    return (
      <FormProvider {...methods}>
        <RepeatedTable field={amountsField} path="amounts" message={amountMessage} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

test("an int32 cell with an out-of-range value shows aria-invalid after blur", async () => {
  const user = userEvent.setup();
  renderAmountsTable();
  await user.click(screen.getByText(/Add item/i));
  const qtyInput = screen.getByRole("spinbutton");
  await user.type(qtyInput, "9999999999");
  await user.tab();
  expect(await screen.findByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
});

test("a uint64 cell rejects a negative value", async () => {
  const user = userEvent.setup();
  renderAmountsTable();
  await user.click(screen.getByText(/Add item/i));
  // qty (int32 → spinbutton) + total (uint64 → text) in the same row
  const totalInput = screen.getAllByRole("textbox")[0];
  await user.type(totalInput, "-1");
  await user.tab();
  expect(totalInput).toHaveAttribute("aria-invalid", "true");
});
