import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect } from "vitest";
import { FieldTooltip } from "@/components/form/fields/FieldTooltip";
import type { FieldSchema } from "@/lib/types";

function makeField(overrides: Partial<FieldSchema> & Pick<FieldSchema, "kind">): FieldSchema {
  return {
    name: "test_field",
    label: "test_field",
    field_number: 1,
    repeated: false,
    ...overrides,
  };
}

async function expectTooltipText(text: string) {
  const matches = await screen.findAllByText(text);
  expect(matches.length).toBeGreaterThanOrEqual(1);
  return matches[0];
}

describe("FieldTooltip", () => {
  test("scalar field tooltip shows type, field number, and cardinality", async () => {
    const field = makeField({
      field_number: 3,
      kind: { type: "scalar", scalar: "int32" },
    });
    render(
      <FieldTooltip field={field}>
        <span>Label</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Label"));
    await expectTooltipText("int32 · field 3 · optional");
  });

  test("enum field tooltip shows 'enum'", async () => {
    const field = makeField({
      field_number: 2,
      kind: { type: "enum", values: [{ name: "OK", number: 0 }] },
    });
    render(
      <FieldTooltip field={field}>
        <span>Status</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Status"));
    await expectTooltipText("enum · field 2 · optional");
  });

  test("map field tooltip shows 'map' cardinality", async () => {
    const field = makeField({
      field_number: 5,
      kind: {
        type: "map",
        key_type: "string",
        value_kind: { type: "scalar", scalar: "int32" },
      },
    });
    render(
      <FieldTooltip field={field}>
        <span>Tags</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Tags"));
    await expectTooltipText("map<string, int32> · field 5 · map");
  });

  test("oneof field tooltip omits field number when field_number is 0", async () => {
    const field = makeField({
      field_number: 0,
      kind: {
        type: "oneof",
        branches: [[{
          name: "a",
          label: "a",
          field_number: 1,
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
        }]],
      },
    });
    render(
      <FieldTooltip field={field}>
        <span>Choice</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Choice"));
    const el = await expectTooltipText("oneof · optional");
    expect(el.textContent).not.toContain("field 0");
  });

  test("repeated field shows 'repeated' cardinality", async () => {
    const field = makeField({
      field_number: 4,
      kind: { type: "scalar", scalar: "string" },
      repeated: true,
    });
    render(
      <FieldTooltip field={field}>
        <span>Items</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Items"));
    await expectTooltipText("string · field 4 · repeated");
  });

  test("message field tooltip shows short type name", async () => {
    const field = makeField({
      field_number: 6,
      kind: { type: "message", full_name: "my.package.Address" },
    });
    render(
      <FieldTooltip field={field}>
        <span>Address</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Address"));
    await expectTooltipText("Address · field 6 · optional");
  });

  test("well-known type tooltip shows wkt name", async () => {
    const field = makeField({
      field_number: 7,
      kind: { type: "well_known", wkt: "Timestamp" },
    });
    render(
      <FieldTooltip field={field}>
        <span>Created</span>
      </FieldTooltip>
    );

    await userEvent.hover(screen.getByText("Created"));
    await expectTooltipText("Timestamp · field 7 · optional");
  });
});
