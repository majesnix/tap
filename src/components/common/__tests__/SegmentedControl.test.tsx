import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SegmentedControl, type SegmentedItem } from "@/components/common/SegmentedControl";

const items = [
  { value: "queue", label: "Queue" },
  { value: "exchange", label: "Exchange" },
] as const;

/**
 * The control is controlled by its parent, so arrow-key wrapping can only be
 * exercised through a host that actually applies the new value.
 */
function Controlled({
  onChange,
  items: allItems,
}: {
  onChange: (v: string) => void;
  items: SegmentedItem<string>[];
}) {
  const [value, setValue] = useState("queue");
  return (
    <SegmentedControl
      aria-label="T"
      value={value}
      items={allItems}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
    />
  );
}

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
  it("moves DOM focus onto the newly selected segment", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} items={[...items]} />);
    const queue = screen.getByRole("radio", { name: "Queue" });
    queue.focus();

    fireEvent.keyDown(queue, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("exchange");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Exchange" }));
  });

  it("moves with arrow keys and skips disabled items", () => {
    const onChange = vi.fn();
    render(
      <Controlled onChange={onChange} items={[...items, { value: "x", label: "X", disabled: true }]} />
    );
    const queue = screen.getByRole("radio", { name: "Queue" });
    queue.focus();

    // Two presses from the same starting point: the second lands on whatever the
    // first press focused, which is the whole point of the roving tabindex.
    fireEvent.keyDown(queue, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("exchange");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("queue"); // wraps, skipping the disabled item
  });

  it("moves backwards with ArrowLeft", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} items={[...items]} />);
    const queue = screen.getByRole("radio", { name: "Queue" });
    queue.focus();

    fireEvent.keyDown(queue, { key: "ArrowLeft" });

    expect(onChange).toHaveBeenCalledWith("exchange"); // wraps to the last segment
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Exchange" }));
  });
  it("disables every segment when disabled", () => {
    render(<SegmentedControl aria-label="T" value="queue" onChange={() => {}} items={[...items]} disabled />);
    expect(screen.getByRole("radio", { name: "Queue" })).toBeDisabled();
  });
});
