import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { CopyButton } from "../fields/CopyButton";

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
  writeTextMock.mockClear();
});

test("renders copy icon by default", () => {
  render(<CopyButton value="hello" />);
  expect(screen.getByRole("button", { name: "Copy value" })).toBeInTheDocument();
});

test("copies value to clipboard on click", async () => {
  render(<CopyButton value="test-value" />);

  fireEvent.click(screen.getByRole("button", { name: "Copy value" }));

  await waitFor(() => {
    expect(writeTextMock).toHaveBeenCalledWith("test-value");
  });
});

test("swaps to check icon after copy and reverts after timeout", async () => {
  vi.useFakeTimers();
  render(<CopyButton value="v" />);

  const button = screen.getByRole("button", { name: "Copy value" });

  expect(button.querySelector(".text-green-500")).toBeNull();

  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });

  expect(button.querySelector(".text-green-500")).not.toBeNull();

  act(() => {
    vi.advanceTimersByTime(1500);
  });
  expect(button.querySelector(".text-green-500")).toBeNull();

  vi.useRealTimers();
});

test("handles clipboard error without throwing", async () => {
  writeTextMock.mockRejectedValueOnce(new Error("denied"));
  render(<CopyButton value="x" />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy value" }));
    await Promise.resolve();
  });

  expect(writeTextMock).toHaveBeenCalled();
});
