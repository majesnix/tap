import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { OneofField } from "../fields/OneofField";
import type { FieldSchema } from "@/lib/types";

// oneof payment { string card_number = 1; string crypto_address = 2; }
const cardField: FieldSchema = {
  name: "card_number",
  label: "card_number",
  field_number: 1,
  kind: { type: "scalar", scalar: "string" },
  repeated: false,
  oneof_group: "payment",
};
const cryptoField: FieldSchema = {
  name: "crypto_address",
  label: "crypto_address",
  field_number: 2,
  kind: { type: "scalar", scalar: "string" },
  repeated: false,
  oneof_group: "payment",
};

const oneofField: FieldSchema = {
  name: "payment",
  label: "payment",
  field_number: 0,
  kind: { type: "oneof", branches: [[cardField], [cryptoField]] },
  repeated: false,
};

function renderOneof() {
  const Wrapper = () => {
    const methods = useForm({
      defaultValues: {
        payment: { _selected: "card_number", card_number: "", crypto_address: "" },
      },
    });
    return (
      <FormProvider {...methods}>
        <OneofField
          field={oneofField}
          path="payment"
          depth={0}
          renderBranchField={(_f, branchPath) => (
            <input key={branchPath} data-testid={branchPath} />
          )}
        />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}

test("renders radio group with branch options", () => {
  renderOneof();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
});

test("first branch is selected by default", () => {
  renderOneof();
  const radios = screen.getAllByRole("radio");
  expect(radios[0]).toBeChecked();
  expect(radios[1]).not.toBeChecked();
});

test("selecting second branch renders second branch content and hides first", async () => {
  const user = userEvent.setup();
  renderOneof();
  // Initial: card_number branch visible — path is "payment.card_number" (flat, not double-nested)
  expect(screen.getByTestId("payment.card_number")).toBeInTheDocument();
  // Select crypto branch
  await user.click(screen.getAllByRole("radio")[1]);
  await waitFor(() => {
    // After switch: crypto_address branch visible at "payment.crypto_address"
    expect(screen.getByTestId("payment.crypto_address")).toBeInTheDocument();
    // card_number branch unmounted (not just hidden)
    expect(screen.queryByTestId("payment.card_number")).not.toBeInTheDocument();
  });
});
