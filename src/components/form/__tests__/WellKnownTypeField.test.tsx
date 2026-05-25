import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { WellKnownTypeField } from "../fields/WellKnownTypeField";
import type { FieldSchema } from "@/lib/types";

function makeWktField(wkt: string): FieldSchema {
  return { name: "ts", label: "ts", field_number: 1, kind: { type: "well_known", wkt }, repeated: false };
}

function renderWkt(field: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { [field.name]: "" }, mode: "onBlur" });
    return (
      <FormProvider {...methods}>
        <WellKnownTypeField field={field} path={field.name} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

test("Timestamp renders datetime-local input", () => {
  renderWkt(makeWktField("Timestamp"));
  const input = document.querySelector('input[type="datetime-local"]');
  expect(input).not.toBeNull();
});

test("Duration renders text input with e.g. 1h30m placeholder", () => {
  renderWkt(makeWktField("Duration"));
  const input = screen.getByRole("textbox");
  expect(input).toHaveAttribute("placeholder", expect.stringContaining("1h30m"));
});

test("Duration shows validation error for invalid pattern", async () => {
  const user = userEvent.setup();
  renderWkt(makeWktField("Duration"));
  const input = screen.getByRole("textbox");
  await user.type(input, "not-a-duration");
  await user.tab();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

test("unknown WKT renders text input with badge showing wkt name", () => {
  renderWkt(makeWktField("google.protobuf.Empty"));
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.getByText(/google\.protobuf\.Empty/i)).toBeInTheDocument();
});

test("google.protobuf.Any renders as fallback plain input (not specialized)", () => {
  renderWkt(makeWktField("Any"));
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  // Must NOT render a special Any control — fallback only (G-8)
  expect(screen.queryByText(/any.*editor/i)).not.toBeInTheDocument();
});
