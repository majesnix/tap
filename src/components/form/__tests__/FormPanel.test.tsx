import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import * as ipc from "@/lib/ipc";
import { FormPanel } from "@/components/form/FormPanel";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

vi.mock("@/lib/ipc");

const MINIMAL_SCHEMA: ProtoSchema = {
  messages: [
    {
      name: "Msg",
      full_name: "Msg",
      fields: [
        {
          name: "value",
          label: "value",
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
          default_value: null,
        },
      ],
    },
  ],
  message_map: {
    Msg: {
      name: "Msg",
      full_name: "Msg",
      fields: [
        {
          name: "value",
          label: "value",
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
          default_value: null,
        },
      ],
    },
  },
};

beforeEach(() => {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/test.proto", MINIMAL_SCHEMA);
    useProtoStore.getState().setSelectedType("Msg");
  });
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(ipc.encodeMessage).mockResolvedValue([0x0a, 0x05]);
});

afterEach(() => {
  act(() => {
    useProtoStore.getState().reset();
  });
  vi.useRealTimers();
});

test("calls encodeMessage after 200ms debounce delay, not on every keystroke", () => {
  render(<FormPanel />);

  const input = screen.getByRole("textbox");

  // Simulate 3 change events (equivalent to typing 3 characters)
  act(() => {
    fireEvent.change(input, { target: { value: "h" } });
    fireEvent.change(input, { target: { value: "he" } });
    fireEvent.change(input, { target: { value: "hel" } });
  });

  // Debounce window still open — encodeMessage must NOT have been called yet
  expect(ipc.encodeMessage).not.toHaveBeenCalled();

  // Advance timers past the 200ms debounce window
  act(() => {
    vi.advanceTimersByTime(200);
  });

  // Now encodeMessage should have been called exactly once
  expect(ipc.encodeMessage).toHaveBeenCalledTimes(1);
  expect(ipc.encodeMessage).toHaveBeenCalledWith(
    "Msg",
    expect.objectContaining({ value: "hel" })
  );
});

test("encodeMessage is not called more than once when typing rapidly", () => {
  render(<FormPanel />);

  const input = screen.getByRole("textbox");

  // Simulate 5 rapid change events — each fires onValuesChange but debounce resets each time
  act(() => {
    fireEvent.change(input, { target: { value: "h" } });
    fireEvent.change(input, { target: { value: "he" } });
    fireEvent.change(input, { target: { value: "hel" } });
    fireEvent.change(input, { target: { value: "hell" } });
    fireEvent.change(input, { target: { value: "hello" } });
  });

  // Advance timers by only 100ms — still inside the debounce window
  act(() => {
    vi.advanceTimersByTime(100);
  });

  // Should still not be called — 100ms < 200ms debounce
  expect(ipc.encodeMessage).not.toHaveBeenCalled();

  // Advance another 100ms (200ms total since last keystroke)
  act(() => {
    vi.advanceTimersByTime(100);
  });

  // Should have been called exactly once — not 5 times (one per keystroke)
  expect(ipc.encodeMessage).toHaveBeenCalledTimes(1);
});
