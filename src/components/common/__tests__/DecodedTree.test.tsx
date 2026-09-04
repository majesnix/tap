import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { DecodedTree } from "@/components/common/DecodedTree";

it("renders scalar keys and values with the design colors", () => {
  render(<DecodedTree value={{ order_id: "ord_1", amount: 2.5, status: "ORDER_STATUS_PAID", ok: true, none: null }} />);
  expect(screen.getByText("order_id").className).toContain("text-muted-foreground");
  expect(screen.getByText('"ord_1"').className).toContain("text-violet-bright");
  expect(screen.getByText("2.5").className).toContain("text-foreground");
  expect(screen.getByText("ORDER_STATUS_PAID").className).toContain("text-teal");
  expect(screen.getByText("true")).toBeInTheDocument();
  expect(screen.getByText("null").className).toContain("text-ghost");
});
it("collapses nested values behind a summary that expands on click", () => {
  render(<DecodedTree value={{ items: [{ sku: "a" }], shipping: { city: "Hamburg" } }} />);
  expect(screen.getByText("[1 items]")).toBeInTheDocument();
  expect(screen.queryByText('"Hamburg"')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("{…}"));
  expect(screen.getByText('"Hamburg"')).toBeInTheDocument();
});
