import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { Tag } from "@/components/common/Tag";
import { EnvironmentPill } from "@/components/common/EnvironmentPill";

it("Tag renders uppercase text with the tone classes", () => {
  render(<Tag tone="success">ack</Tag>);
  const el = screen.getByText("ack");
  expect(el.className).toContain("text-success");
  expect(el.className).toContain("uppercase");
});
it("EnvironmentPill maps environments to tones and labels", () => {
  const { rerender } = render(<EnvironmentPill environment="production" />);
  expect(screen.getByTestId("environment-badge")).toHaveTextContent("PRODUCTION");
  expect(screen.getByTestId("environment-badge").className).toContain("text-danger");
  rerender(<EnvironmentPill environment="local" />);
  expect(screen.getByTestId("environment-badge").className).toContain("text-success");
});
