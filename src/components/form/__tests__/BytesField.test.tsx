import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { BytesField } from "../fields/BytesField";
import type { FieldSchema } from "@/lib/types";

/**
 * Wraps BytesField in a FormProvider for isolated testing.
 * Uses mode: "onBlur" — matches production validation trigger.
 */
function renderField(schema: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({
      defaultValues: { [schema.name]: schema.default_value ?? "" },
      mode: "onBlur",
    });
    return (
      <FormProvider {...methods}>
        <BytesField field={schema} path={schema.name} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

const bytesSchema: FieldSchema = {
  name: "image_data",
  label: "image_data",
  kind: { type: "scalar", scalar: "bytes" },
  repeated: false,
  default_value: "",
};

// ─── render ──────────────────────────────────────────────────────────────────

test("BytesField renders a textbox with placeholder 'base64 encoded value'", () => {
  renderField(bytesSchema);
  expect(screen.getByRole("textbox")).toHaveAttribute(
    "placeholder",
    "base64 encoded value"
  );
});

// ─── badge ───────────────────────────────────────────────────────────────────

test("BytesField renders a 'bytes' badge (NOT 'bytes (base64)')", () => {
  renderField(bytesSchema);
  // Should have exactly "bytes" badge (outline variant)
  expect(screen.getByText("bytes")).toBeInTheDocument();
  // Must NOT have the old "bytes (base64)" label
  expect(screen.queryByText("bytes (base64)")).not.toBeInTheDocument();
});

// ─── valid byte count ─────────────────────────────────────────────────────────

test("BytesField shows byte count label after entering valid base64", async () => {
  const user = userEvent.setup();
  renderField(bytesSchema);
  const input = screen.getByRole("textbox");
  await user.type(input, "aGVsbG8="); // "hello" in base64 = 5 bytes
  await user.tab(); // trigger blur validation
  expect(await screen.findByText(/5 bytes/)).toBeInTheDocument();
  // No error alert should be present
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

// ─── URL-safe chars invalid ───────────────────────────────────────────────────

test("BytesField shows error for URL-safe base64 characters (- or _)", async () => {
  const user = userEvent.setup();
  renderField(bytesSchema);
  const input = screen.getByRole("textbox");
  await user.type(input, "abc-def");
  await user.tab();
  const alert = await screen.findByRole("alert");
  expect(alert).toBeInTheDocument();
  expect(alert.textContent).toContain(
    "Must be valid base64 (standard alphabet, not URL-safe)"
  );
});

// ─── structurally invalid base64 ─────────────────────────────────────────────

test("BytesField shows error for structurally invalid base64 ('abc' — 3 chars, no padding)", async () => {
  const user = userEvent.setup();
  renderField(bytesSchema);
  const input = screen.getByRole("textbox");
  await user.type(input, "abc"); // passes regex but fails atob (length not multiple of 4)
  await user.tab();
  const alert = await screen.findByRole("alert");
  expect(alert).toBeInTheDocument();
});

// ─── empty is valid ───────────────────────────────────────────────────────────

test("BytesField does not show error when input is empty (optional field)", async () => {
  const user = userEvent.setup();
  renderField(bytesSchema);
  const input = screen.getByRole("textbox");
  await user.click(input);
  await user.tab(); // blur without typing
  // No alert should be shown for empty value
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

// ─── From text button ─────────────────────────────────────────────────────────

test("BytesField shows 'From text' button", () => {
  renderField(bytesSchema);
  expect(
    screen.getByRole("button", { name: "From text" })
  ).toBeInTheDocument();
});

// ─── Convert flow ─────────────────────────────────────────────────────────────

test("BytesField Convert flow: opens popover, converts text to base64, closes popover", async () => {
  const user = userEvent.setup();
  renderField(bytesSchema);

  // Open the popover via "From text" button
  const fromTextBtn = screen.getByRole("button", { name: "From text" });
  await user.click(fromTextBtn);

  // The Convert button should now be visible (popover opened)
  const convertBtn = await screen.findByRole("button", { name: "Convert" });
  expect(convertBtn).toBeInTheDocument();

  // Type text into the popover textarea
  const textarea = screen.getByPlaceholderText(
    /Type UTF-8 text to convert to base64/
  );
  await user.type(textarea, "hello");

  // Click Convert
  await user.click(convertBtn);

  // Popover should be closed (Convert button no longer visible)
  expect(screen.queryByRole("button", { name: "Convert" })).toBeNull();

  // The input should now contain a non-empty base64 string
  const input = screen.getByRole("textbox");
  expect((input as HTMLInputElement).value).not.toBe("");
});
