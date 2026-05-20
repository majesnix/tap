import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import * as ipc from "@/lib/ipc";
import { FormPanel } from "@/components/form/FormPanel";
import { useProtoStore } from "@/stores/useProtoStore";
import { useTheme } from "next-themes";
import type { ProtoSchema } from "@/lib/types";

vi.mock("@/lib/ipc");

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: {
    getState: vi.fn(),
  },
}));
import { useBlockStore } from "@/stores/useBlockStore";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

// vi.hoisted required — plain const at module scope fails Vitest hoisting
const { mockToastWarning } = vi.hoisted(() => ({
  mockToastWarning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { warning: mockToastWarning } }));

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
  vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "light" } as ReturnType<typeof useTheme>);
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

describe("JSON Override Toggle", () => {
  test("toggle button renders with aria-label 'Edit as JSON' in form mode", () => {
    render(<FormPanel />);
    expect(
      screen.getByRole("button", { name: "Edit as JSON" })
    ).toBeInTheDocument();
  });

  test("clicking toggle button enters JSON mode — CodeMirror appears", () => {
    render(<FormPanel />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
    // ProtoFormRenderer is unmounted — its role="form" or the text input is gone
    expect(screen.queryByRole("textbox", { name: /value/i })).not.toBeInTheDocument();
  });

  test("JSON mode prefills editor with JSON.stringify of latestValues snapshot", () => {
    // IMPORTANT: render first, then drive value through the form input.
    // Do NOT seed useProtoStore.getState().setLatestValues before render — ProtoFormRenderer's
    // initial useWatch fires onValuesChange with schema defaults, overwriting any pre-seeded value.
    render(<FormPanel />);
    // Drive a value into the form via the textbox
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    });
    // Enter JSON mode — snapshot is captured from latestValues at this point
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    const stub = screen.getByTestId("codemirror-stub");
    expect(stub).toHaveValue(JSON.stringify({ value: "hello" }, null, 2));
  });

  test("toggle button shows aria-label 'Return to form' in JSON mode", () => {
    render(<FormPanel />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    expect(
      screen.getByRole("button", { name: "Return to form" })
    ).toBeInTheDocument();
  });

  test("clicking toggle with valid JSON exits JSON mode and calls setPendingReplayValues", () => {
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    render(<FormPanel />);
    // Enter JSON mode
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    // Edit the JSON to valid value
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: '{"value":"world"}' },
      });
    });
    // Exit JSON mode
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    expect(spy).toHaveBeenCalled();
    // CodeMirror stub is gone — back in form mode
    expect(screen.queryByTestId("codemirror-stub")).not.toBeInTheDocument();
  });

  test("clicking toggle with invalid JSON stays in JSON mode and shows error banner", () => {
    render(<FormPanel />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: "{bad json" },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    // Must stay in JSON mode
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
    // Error banner visible
    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("Discard changes restores entrySnapshot and exits JSON mode", () => {
    // IMPORTANT: render first, then drive value through the form input.
    // Do NOT seed useProtoStore.getState().setLatestValues before render — ProtoFormRenderer's
    // initial useWatch fires onValuesChange with schema defaults, overwriting any pre-seeded value.
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    render(<FormPanel />);
    // Drive the original value through the form textbox
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "original" } });
    });
    // Enter JSON mode — entrySnapshot is captured here
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    // Corrupt the JSON
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: "{bad json" },
      });
    });
    // Try to exit — banner appears
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    // Click Discard
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    });
    // setPendingReplayValues called with entrySnapshot (the { value: "original" } object)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: "original" }));
    // Exited JSON mode
    expect(screen.queryByTestId("codemirror-stub")).not.toBeInTheDocument();
  });

  test("unknown top-level keys trigger toast.warning with correct message", () => {
    render(<FormPanel />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    // JSON with one known field "value" and one unknown field "ghost"
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: '{"value":"ok","ghost":"here"}' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    expect(mockToastWarning).toHaveBeenCalledWith(
      "1 unknown field ignored: ghost"
    );
  });

  test("Fix JSON clears error banner and keeps isJsonMode=true", () => {
    render(<FormPanel />);
    // Enter JSON mode
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    // Corrupt the JSON
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: "{bad json" },
      });
    });
    // Try to exit — banner appears
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    // Confirm banner is visible
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Click Fix JSON
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Fix JSON" }));
    });
    // Banner must be gone
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Still in JSON mode
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
  });
});

function createDataTransfer(data: Record<string, string>) {
  const store: Record<string, string> = { ...data };
  return {
    getData: (key: string) => store[key] ?? '',
    setData: vi.fn((key: string, value: string) => { store[key] = value; }),
    types: Object.keys(data),
  };
}

describe("Block Library Toggle", () => {
  test("Library button renders with aria-label 'Block library'", () => {
    render(<FormPanel />);
    expect(
      screen.getByRole("button", { name: "Block library" })
    ).toBeInTheDocument();
  });

  test("clicking Library button calls onToggleBlockLibrary prop", () => {
    const mockToggle = vi.fn();
    render(<FormPanel onToggleBlockLibrary={mockToggle} />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Block library" }));
    });
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  test("Library button has bg-muted class when isBlockLibraryOpen=true", () => {
    render(<FormPanel isBlockLibraryOpen={true} />);
    const btn = screen.getByRole("button", { name: "Block library" });
    expect(btn).toHaveClass("bg-muted");
  });

  test("Library button does NOT have bg-muted class when isBlockLibraryOpen=false", () => {
    render(<FormPanel isBlockLibraryOpen={false} />);
    const btn = screen.getByRole("button", { name: "Block library" });
    expect(btn).not.toHaveClass("bg-muted");
  });
});

describe("Drop zone (DnD)", () => {
  beforeEach(() => {
    // DnD tests don't need fake timers; real timers allow async effects to flush correctly
    vi.useRealTimers();
    vi.mocked(useBlockStore.getState).mockReturnValue({
      blocks: [{ id: 'block-1', name: 'My Block', content: '{"ghost": "value"}' }],
    } as ReturnType<typeof useBlockStore.getState>);
  });

  test("dragOver on scroll area adds ring class", () => {
    const { container } = render(<FormPanel />);
    const scrollArea = container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    act(() => {
      fireEvent.dragOver(scrollArea, { dataTransfer: createDataTransfer({}) });
    });
    expect(scrollArea.className).toContain('ring-2');
  });

  test("dragLeave on scroll area removes ring class", () => {
    const { container } = render(<FormPanel />);
    const scrollArea = container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    act(() => {
      fireEvent.dragOver(scrollArea, { dataTransfer: createDataTransfer({}) });
    });
    expect(scrollArea.className).toContain('ring-2');
    act(() => {
      fireEvent.dragLeave(scrollArea, { relatedTarget: document.body });
    });
    expect(scrollArea.className).not.toContain('ring-2');
  });

  test("drop with unknown block key fires toast.warning with correct singular copy", async () => {
    const { container } = render(<FormPanel />);
    const scrollArea = container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const dataTransfer = createDataTransfer({ blockId: 'block-1' });
    // Flush ProtoFormRenderer's useEffect that wires applyBlockRef.current
    await act(async () => {});
    act(() => {
      fireEvent.dragOver(scrollArea, { dataTransfer });
      fireEvent.drop(scrollArea, { dataTransfer });
    });
    expect(mockToastWarning).toHaveBeenCalledWith(
      '1 field from block not in form: ghost'
    );
  });

  test("drop with multi-key block fires toast.warning with correct plural copy", async () => {
    vi.mocked(useBlockStore.getState).mockReturnValue({
      blocks: [{ id: 'block-1', name: 'My Block', content: '{"ghost": "x", "phantom": "y"}' }],
    } as ReturnType<typeof useBlockStore.getState>);
    const { container } = render(<FormPanel />);
    const scrollArea = container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const dataTransfer = createDataTransfer({ blockId: 'block-1' });
    await act(async () => {});
    act(() => {
      fireEvent.dragOver(scrollArea, { dataTransfer });
      fireEvent.drop(scrollArea, { dataTransfer });
    });
    expect(mockToastWarning).toHaveBeenCalledWith(
      '2 fields from block not in form: ghost, phantom'
    );
  });

  test("drop with unknown blockId is silent no-op (no toast)", () => {
    const { container } = render(<FormPanel />);
    const scrollArea = container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
    const dataTransfer = createDataTransfer({ blockId: 'nonexistent' });
    act(() => {
      fireEvent.drop(scrollArea, { dataTransfer });
    });
    expect(mockToastWarning).not.toHaveBeenCalled();
  });
});
