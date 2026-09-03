import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { IconButton } from "@/components/common/IconButton";

it("IconButton exposes its label to assistive tech and forwards clicks", () => {
  const onClick = vi.fn();
  render(<IconButton label="Reload" onClick={onClick} size={24}><span>i</span></IconButton>);
  const btn = screen.getByRole("button", { name: "Reload" });
  expect(btn).toHaveAttribute("title", "Reload");
  fireEvent.click(btn);
  expect(onClick).toHaveBeenCalled();
});
it("IconButton marks the active state with aria-pressed", () => {
  render(<IconButton label="Blocks" active><span>i</span></IconButton>);
  expect(screen.getByRole("button", { name: "Blocks" })).toHaveAttribute("aria-pressed", "true");
});
