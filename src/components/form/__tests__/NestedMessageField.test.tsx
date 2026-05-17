import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { NestedMessageField } from "../fields/NestedMessageField";
import type { FieldSchema } from "@/lib/types";

/**
 * Wraps NestedMessageField in a FormProvider for isolated testing.
 * Uses the `path` prop to match ProtoFormRenderer callsite.
 */
function renderNested(depth: number) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { inner: { title: "" } } });
    return (
      <FormProvider {...methods}>
        <NestedMessageField
          field={{
            name: "inner",
            label: "Inner",
            kind: { type: "message", full_name: "com.Inner" },
            repeated: false,
          }}
          path="inner"
          depth={depth}
          renderChildField={(f: FieldSchema, childPath: string) => (
            <input key={childPath} data-testid={childPath} />
          )}
        />
      </FormProvider>
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
