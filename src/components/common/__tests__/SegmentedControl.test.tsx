import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SegmentedControl } from "@/components/common/SegmentedControl";

const items = [
  { value: "queue", label: "Queue" },
  { value: "exchange", label: "Exchange" },
] as const;

describe("SegmentedControl", () => {
  it("renders a radiogroup and marks the current value checked", () => {
    render(<SegmentedControl aria-label="Target" value="queue" onChange={() => {}} items={[...items]} />);
    expect(screen.getByRole("radiogroup", { name: "Target" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Queue" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Exchange" })).toHaveAttribute("aria-checked", "false");
  });
  it("calls onChange with the clicked value", () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="Target" value="queue" onChange={onChange} items={[...items]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Exchange" }));
    expect(onChange).toHaveBeenCalledWith("exchange");
  });
  it("moves with arrow keys and skips disabled items", () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="T" value="queue" onChange={onChange}
      items={[...items, { value: "x", label: "X", disabled: true }]} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Queue" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("exchange");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Exchange" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("queue"); // wraps, skipping the disabled item
  });
  it("disables every segment when disabled", () => {
    render(<SegmentedControl aria-label="T" value="queue" onChange={() => {}} items={[...items]} disabled />);
    expect(screen.getByRole("radio", { name: "Queue" })).toBeDisabled();
  });
});
