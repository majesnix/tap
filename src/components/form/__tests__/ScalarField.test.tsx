import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { ScalarField } from "../fields/ScalarField";
import type { FieldSchema } from "@/lib/types";

/**
 * Wraps ScalarField in a FormProvider for isolated testing.
 * Uses the `path` prop (not `fieldPath`) to match ProtoFormRenderer callsite.
 */
function renderField(schema: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({
      defaultValues: { [schema.name]: schema.default_value },
      mode: "onBlur",
    });
    return (
      <FormProvider {...methods}>
        <ScalarField field={schema} path={schema.name} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

// ─── bool ────────────────────────────────────────────────────────────────────

test("bool field renders checkbox", () => {
  renderField({
    name: "active",
    label: "active",
    field_number: 1,
    kind: { type: "scalar", scalar: "bool" },
    repeated: false,
    default_value: false,
  });
  expect(screen.getByRole("checkbox")).toBeInTheDocument();
});

// ─── string ──────────────────────────────────────────────────────────────────

test("string field renders text input", () => {
  renderField({
    name: "name",
    label: "name",
    field_number: 1,
    kind: { type: "scalar", scalar: "string" },
    repeated: false,
    default_value: "",
  });
  expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
});

// ─── int32 (and sint32 / sfixed32 pattern) ───────────────────────────────────

test("int32 field renders number input", () => {
  renderField({
    name: "count",
    label: "count",
    field_number: 1,
    kind: { type: "scalar", scalar: "int32" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

test("sint32 field renders number input", () => {
  renderField({
    name: "sint",
    label: "sint",
    field_number: 1,
    kind: { type: "scalar", scalar: "sint32" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

test("sfixed32 field renders number input", () => {
  renderField({
    name: "sf32",
    label: "sf32",
    field_number: 1,
    kind: { type: "scalar", scalar: "sfixed32" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

// ─── uint32 / fixed32 ────────────────────────────────────────────────────────

test("uint32 field renders number input", () => {
  renderField({
    name: "uid",
    label: "uid",
    field_number: 1,
    kind: { type: "scalar", scalar: "uint32" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

test("fixed32 renders same as int32 (number input)", () => {
  renderField({
    name: "f",
    label: "f",
    field_number: 1,
    kind: { type: "scalar", scalar: "fixed32" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

// ─── int64 (and sint64 / sfixed64) ───────────────────────────────────────────

test("int64 field renders text input (not number — precision)", () => {
  renderField({
    name: "big",
    label: "big",
    field_number: 1,
    kind: { type: "scalar", scalar: "int64" },
    repeated: false,
    default_value: "0",
  });
  expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
});

test("sint64 field renders text input", () => {
  renderField({
    name: "si64",
    label: "si64",
    field_number: 1,
    kind: { type: "scalar", scalar: "sint64" },
    repeated: false,
    default_value: "0",
  });
  expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
});

test("sfixed64 renders as text input (int64 precision)", () => {
  renderField({
    name: "sf",
    label: "sf",
    field_number: 1,
    kind: { type: "scalar", scalar: "sfixed64" },
    repeated: false,
    default_value: "0",
  });
  expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
});

// ─── uint64 / fixed64 ────────────────────────────────────────────────────────

test("uint64 field renders text input", () => {
  renderField({
    name: "ts",
    label: "ts",
    field_number: 1,
    kind: { type: "scalar", scalar: "uint64" },
    repeated: false,
    default_value: "0",
  });
  expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
});

test("fixed64 field renders text input", () => {
  renderField({
    name: "f64",
    label: "f64",
    field_number: 1,
    kind: { type: "scalar", scalar: "fixed64" },
    repeated: false,
    default_value: "0",
  });
  expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
});

// ─── float / double ──────────────────────────────────────────────────────────

test("float field renders number input", () => {
  renderField({
    name: "ratio",
    label: "ratio",
    field_number: 1,
    kind: { type: "scalar", scalar: "float" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

test("double field renders number input", () => {
  renderField({
    name: "pi",
    label: "pi",
    field_number: 1,
    kind: { type: "scalar", scalar: "double" },
    repeated: false,
    default_value: 0,
  });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
});

// ─── Inline validation errors ────────────────────────────────────────────────

test("int32 shows validation error on out-of-range value", async () => {
  const user = userEvent.setup();
  renderField({
    name: "count",
    label: "count",
    field_number: 1,
    kind: { type: "scalar", scalar: "int32" },
    repeated: false,
    default_value: 0,
  });
  const input = screen.getByRole("spinbutton");
  await user.clear(input);
  await user.type(input, "9999999999");
  await user.tab(); // trigger blur validation
  // Should surface an error message containing "int32" or range text
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

test("uint32 shows validation error on negative value", async () => {
  const user = userEvent.setup();
  renderField({
    name: "uid",
    label: "uid",
    field_number: 1,
    kind: { type: "scalar", scalar: "uint32" },
    repeated: false,
    default_value: 0,
  });
  const input = screen.getByRole("spinbutton");
  await user.clear(input);
  await user.type(input, "-5");
  await user.tab();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

test("int64 shows validation error on non-integer string", async () => {
  const user = userEvent.setup();
  renderField({
    name: "big",
    label: "big",
    field_number: 1,
    kind: { type: "scalar", scalar: "int64" },
    repeated: false,
    default_value: "0",
  });
  const input = screen.getByRole("textbox");
  await user.clear(input);
  await user.type(input, "abc");
  await user.tab();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

// ─── Default values (FORM-07) ────────────────────────────────────────────────

test("field pre-populates with default_value from schema", () => {
  renderField({
    name: "score",
    label: "score",
    field_number: 1,
    kind: { type: "scalar", scalar: "int32" },
    repeated: false,
    default_value: 42,
  });
  expect(screen.getByRole("spinbutton")).toHaveValue(42);
});

// ─── CopyButton integration ─────────────────────────────────────────────────

test("string field renders a CopyButton with aria-label 'Copy value'", () => {
  renderField({
    name: "name",
    label: "name",
    field_number: 1,
    kind: { type: "scalar", scalar: "string" },
    repeated: false,
    default_value: "hello",
  });
  expect(screen.getByRole("button", { name: "Copy value" })).toBeInTheDocument();
});

test("bool field pre-populates as checked when default_value is true", () => {
  renderField({
    name: "enabled",
    label: "enabled",
    field_number: 1,
    kind: { type: "scalar", scalar: "bool" },
    repeated: false,
    default_value: true,
  });
  expect(screen.getByRole("checkbox")).toBeChecked();
});
