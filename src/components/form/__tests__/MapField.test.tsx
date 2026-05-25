import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, it, expect, vi } from "vitest";
import { MapField } from "../fields/MapField";
import type { FieldSchema } from "@/lib/types";

/**
 * Mock shadcn Select with a native HTML <select> so JSDOM handles events correctly.
 *
 * Radix UI Select relies on pointer events and portals that JSDOM doesn't fully support.
 * This mock preserves the API surface (Select + trigger + content + items) while using
 * native HTML elements for testability.
 *
 * Copied verbatim from EnumField.test.tsx lines 1-82.
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

// ---- Schema fixtures -------------------------------------------------------

const stringIntSchema: FieldSchema = {
  name: "labels",
  label: "Labels",
  field_number: 1,
  kind: { type: "map", key_type: "string", value_kind: { type: "scalar", scalar: "int32" } },
  repeated: false,
};

const boolStringSchema: FieldSchema = {
  name: "flags",
  label: "Flags",
  field_number: 2,
  kind: { type: "map", key_type: "bool", value_kind: { type: "scalar", scalar: "string" } },
  repeated: false,
};

// ---- Test harness ----------------------------------------------------------

function TestWrapper({
  schema,
  renderValue = () => <div data-testid="value-slot" />,
}: {
  schema: FieldSchema;
  renderValue?: (field: FieldSchema, path: string, depth: number) => React.ReactNode;
}) {
  const methods = useForm({ defaultValues: { [schema.name]: [] } });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => {})}>
        <MapField
          field={schema}
          path={schema.name}
          depth={0}
          renderValue={renderValue}
        />
        <button type="submit">Send</button>
      </form>
    </FormProvider>
  );
}

// ---- Tests -----------------------------------------------------------------

describe("MapField", () => {
  it("renders Add entry button", () => {
    render(<TestWrapper schema={stringIntSchema} />);
    expect(screen.getByRole("button", { name: /add entry/i })).toBeInTheDocument();
  });

  it("appends a row on Add entry click", async () => {
    render(<TestWrapper schema={stringIntSchema} />);
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /remove entry/i })).toBeInTheDocument();
    });
  });

  it("removes a row on Remove click", async () => {
    render(<TestWrapper schema={stringIntSchema} />);
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    await waitFor(() => screen.getByRole("button", { name: /remove entry/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove entry/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /remove entry/i })).not.toBeInTheDocument();
    });
  });

  it("shows Duplicate key error on duplicate string keys", async () => {
    render(<TestWrapper schema={stringIntSchema} />);
    // Add two rows
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    await waitFor(() => {
      const keyInputs = screen.getAllByRole("textbox");
      // Type same key value into both key inputs
      fireEvent.change(keyInputs[0], { target: { value: "x" } });
      fireEvent.change(keyInputs[1], { target: { value: "x" } });
    });
    await waitFor(() => {
      expect(screen.getAllByText(/duplicate key/i).length).toBeGreaterThan(0);
    });
  });

  it("renders bool key as Select with true/false options", async () => {
    render(<TestWrapper schema={boolStringSchema} />);
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    await waitFor(() => {
      // The mock renders a native <select>; look for option text
      expect(screen.getByRole("option", { name: "true" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "false" })).toBeInTheDocument();
    });
  });

  it("formState.isValid is false while duplicates exist", async () => {
    const onSubmit = vi.fn();
    function TestWithSubmit() {
      const methods = useForm({ defaultValues: { labels: [] }, mode: "onChange" });
      return (
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <MapField
              field={stringIntSchema}
              path="labels"
              depth={0}
              renderValue={() => <div />}
            />
            <button type="submit" disabled={!methods.formState.isValid}>Send</button>
          </form>
        </FormProvider>
      );
    }
    render(<TestWithSubmit />);
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    await waitFor(() => {
      const keyInputs = screen.getAllByRole("textbox");
      fireEvent.change(keyInputs[0], { target: { value: "dup" } });
      fireEvent.change(keyInputs[1], { target: { value: "dup" } });
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    });
  });

  it("shows Duplicate key error on two empty-key rows", async () => {
    render(<TestWrapper schema={stringIntSchema} />);
    // Add two rows without typing any key — both keys default to ""
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    // Trigger onChange for both key inputs by changing to empty string
    await waitFor(() => {
      const keyInputs = screen.getAllByRole("textbox");
      fireEvent.change(keyInputs[0], { target: { value: "" } });
      fireEvent.change(keyInputs[1], { target: { value: "" } });
    });
    await waitFor(() => {
      // Two empty-string keys are duplicates per MFLD-03 — error must appear
      expect(screen.getAllByText(/duplicate key/i).length).toBeGreaterThan(0);
    });
  });
});
