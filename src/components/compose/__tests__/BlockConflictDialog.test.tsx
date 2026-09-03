import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlockConflictDialog } from "@/components/compose/BlockConflictDialog";
import type { useRequestForm } from "@/components/compose/useRequestForm";
import type { ApplyPlan, ConflictItem } from "@/lib/blockApply";

type Conflict = ReturnType<typeof useRequestForm>["conflict"];

const MAP_COLLISION: ConflictItem = {
  kind: "map_key_collision",
  fieldName: "labels",
  fieldLabel: "Labels",
  blockValue: { env: "prod" },
  currentValue: "staging",
  collisionKey: "env",
  nonCollidingBlockRows: [],
};

const DIRTY_SUBFIELD: ConflictItem = {
  kind: "oneof_dirty_subfield",
  fieldName: "payment",
  fieldLabel: "Payment",
  subFieldName: "card_number",
  subFieldLabel: "Card number",
  blockValue: "4111",
  currentValue: "5500",
};

const BRANCH_SWITCH: ConflictItem = {
  kind: "oneof_branch_switch",
  fieldName: "payment",
  fieldLabel: "Payment",
  blockValue: {},
  currentValue: null,
  currentBranch: "card",
  blockBranch: "invoice",
};

function makeConflict(conflicts: ConflictItem[], overrides: Partial<Conflict> = {}): Conflict {
  const plan: ApplyPlan = { toApply: [], conflicts, unknownKeys: [] };
  return {
    plan,
    choices: {},
    setChoices: vi.fn(),
    apply: vi.fn(),
    discard: vi.fn(),
    ...overrides,
  } as Conflict;
}

describe("BlockConflictDialog", () => {
  it("stays closed without a plan", () => {
    render(<BlockConflictDialog conflict={makeConflict([], { plan: null })} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("counts a single conflict in the singular", () => {
    render(<BlockConflictDialog conflict={makeConflict([MAP_COLLISION])} />);
    expect(
      screen.getByText("1 field already has a value. Choose what to do.")
    ).toBeInTheDocument();
    expect(
      screen.getByText('"Labels" — key "env" already exists')
    ).toBeInTheDocument();
    expect(screen.getByText("map key")).toBeInTheDocument();
    expect(screen.getByText('"staging"')).toBeInTheDocument();
  });

  it("describes every conflict kind", () => {
    render(
      <BlockConflictDialog conflict={makeConflict([DIRTY_SUBFIELD, BRANCH_SWITCH])} />
    );
    expect(
      screen.getByText("2 fields already have values. Choose what to do for each.")
    ).toBeInTheDocument();
    expect(screen.getByText('"Payment.Card number" already has a value')).toBeInTheDocument();
    expect(screen.getByText('Switch "Payment" from "card" to "invoice"')).toBeInTheDocument();
    expect(screen.getByText("dirty field")).toBeInTheDocument();
    expect(screen.getByText("branch switch")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("truncates a long current value", () => {
    render(
      <BlockConflictDialog
        conflict={makeConflict([{ ...MAP_COLLISION, currentValue: "x".repeat(100) }])}
      />
    );
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });

  it("defaults each row to Skip and records a choice", () => {
    const setChoices = vi.fn();
    render(<BlockConflictDialog conflict={makeConflict([MAP_COLLISION], { setChoices })} />);
    expect(screen.getByRole("radio", { name: "Skip" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Overwrite" }));
    expect(setChoices).toHaveBeenCalledTimes(1);
    const updater = setChoices.mock.calls[0][0] as (
      prev: Record<string, string>
    ) => Record<string, string>;
    expect(updater({})).toEqual({ "labels:env": "overwrite" });
  });

  it("applies and discards through the hook", () => {
    const apply = vi.fn();
    const discard = vi.fn();
    render(<BlockConflictDialog conflict={makeConflict([BRANCH_SWITCH], { apply, discard })} />);

    fireEvent.click(screen.getByRole("button", { name: "Apply block" }));
    expect(apply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Discard block" }));
    expect(discard).toHaveBeenCalledTimes(1);
  });
});
