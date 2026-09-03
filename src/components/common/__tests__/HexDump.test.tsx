import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { HexDump } from "@/components/common/HexDump";

it("renders one row per 8 bytes with offsets", () => {
  render(<HexDump hex={"0a ".repeat(9).trim()} />);
  expect(screen.getByText("0000")).toBeInTheDocument();
  expect(screen.getByText("0008")).toBeInTheDocument();
});
