import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

// ─── Mock heavy leaf components that don't affect shortcut/copy testing ────────

vi.mock("@/components/sidebar/FilesSidebar", () => ({
  FilesSidebar: () => <div data-testid="sidebar-stub" />,
}));

// The destination strip owns the target picker, which renders a text input of its own when
// the Management API is unavailable; stub it so getByRole("textbox") stays the form field.
vi.mock("@/components/compose/DestinationStrip", () => ({
  DestinationStrip: () => <div data-testid="destination-strip-stub" />,
}));

vi.mock("@/components/blocks/BlockLibraryPanel", () => ({
  BlockLibraryPanel: () => <div data-testid="block-library-stub" />,
}));

// Radix popovers do not portal usefully in jsdom — render the content inline so
// the read-mode popover's contents are queryable, and only while it is open.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (
    <div>{open ? children : null}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: () => <select role="combobox" aria-label="queue select" />,
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => ({
    get: vi.fn(async () => []),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn(), open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn(), readTextFile: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ Channel: class {}, invoke: vi.fn() }));

vi.mock("@/lib/ipc");
import * as ipc from "@/lib/ipc";

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

vi.mock("next-themes", () => ({ useTheme: vi.fn(() => ({ resolvedTheme: "light" })) }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: Object.assign(
    vi.fn((selector: (s: { blocks: unknown[] }) => unknown) => selector({ blocks: [] })),
    { getState: vi.fn(() => ({ blocks: [] })) }
  ),
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  useDndMonitor: vi.fn(),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

import { ComposeView } from "@/components/layout/ComposeView";
import { useHistoryStore } from "@/stores/useHistoryStore";

// cmdk scrolls its active item into view; jsdom has no such method.
Element.prototype.scrollIntoView = function scrollIntoView() {};

const MINIMAL_SCHEMA: ProtoSchema = {
  messages: [
    {
      name: "TestMsg",
      full_name: "TestMsg",
      fields: [
        {
          name: "greeting",
          label: "greeting",
          field_number: 1,
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
          default_value: null,
        },
      ],
    },
  ],
  message_map: {
    TestMsg: {
      name: "TestMsg",
      full_name: "TestMsg",
      fields: [
        {
          name: "greeting",
          label: "greeting",
          field_number: 1,
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
          default_value: null,
        },
      ],
    },
  },
  enums: [],
};

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/test.proto", MINIMAL_SCHEMA);
    useProtoStore.getState().setSelectedType("TestMsg");
  });
  // Seeded so ActivityPanel never calls loadHistory() against the store plugin.
  useHistoryStore.setState({ entries: [], historyLoaded: true });
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(ipc.encodeMessage).mockResolvedValue("CgU=");
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});

afterEach(async () => {
  await act(async () => {});
  act(() => {
    useProtoStore.getState().reset();
  });
  vi.useRealTimers();
});

function renderApp() {
  return render(
    <ComposeView header={<div />} blocksOpen={false} onToggleBlocks={vi.fn()} />
  );
}

const KEY_TO_CODE: Record<string, string> = {
  Enter: "Enter",
  r: "KeyR",
  o: "KeyO",
  "1": "Digit1",
  "2": "Digit2",
  "3": "Digit3",
};

function pressKey(key: string, opts: KeyboardEventInit = {}) {
  const code = KEY_TO_CODE[key] ?? `Key${key.toUpperCase()}`;
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...opts })
  );
  document.dispatchEvent(
    new KeyboardEvent("keyup", { key, code, bubbles: true, cancelable: true, ...opts })
  );
}

// ─── Cmd+Enter: send shortcut ─────────────────────────────────────────────────

describe("Cmd+Enter send shortcut", () => {
  test("increments sendRequested when fired from document", () => {
    renderApp();
    const before = useProtoStore.getState().sendRequested;

    act(() => {
      pressKey("Enter", { ctrlKey: true });
    });

    expect(useProtoStore.getState().sendRequested).toBe(before + 1);
  });

  test("increments sendRequested when fired from a form input", () => {
    renderApp();
    const input = screen.getByRole("textbox");
    const before = useProtoStore.getState().sendRequested;

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", ctrlKey: true, bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Enter", code: "Enter", ctrlKey: true, bubbles: true })
      );
    });

    expect(useProtoStore.getState().sendRequested).toBe(before + 1);
  });
});

// ─── Cmd+Shift+R: clear shortcut ──────────────────────────────────────────────

describe("Cmd+Shift+R clear shortcut", () => {
  test("resets form via setPendingReplayValues when fired from document", () => {
    renderApp();
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");

    // Dirty the form first
    const input = screen.getByRole("textbox");
    act(() => {
      fireEvent.change(input, { target: { value: "dirty" } });
    });

    act(() => {
      pressKey("r", { ctrlKey: true, shiftKey: true });
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ greeting: "" }));
  });
});

// ─── Cmd+O: open file shortcut ────────────────────────────────────────────────

describe("Cmd+O open file shortcut", () => {
  test("increments openFileRequested", () => {
    renderApp();
    const before = useProtoStore.getState().openFileRequested;

    act(() => {
      pressKey("o", { ctrlKey: true });
    });

    expect(useProtoStore.getState().openFileRequested).toBe(before + 1);
  });
});

// ─── Cmd+1/3: Activity panel signals ──────────────────────────────────────────
//
// mod+2 toggles the Request card's hex strip. Nothing in this view registers
// signals.toggleHex yet — the Request card owns that assertion.

describe("Cmd+1/3 Activity panel signals", () => {
  test("Cmd+1 focuses the Activity filter input", () => {
    renderApp();
    const filter = screen.getByLabelText("Filter activity");
    expect(document.activeElement).not.toBe(filter);

    act(() => { pressKey("1", { ctrlKey: true }); });

    expect(document.activeElement).toBe(filter);
  });

  test("Cmd+3 opens the read-mode popover", () => {
    renderApp();
    expect(screen.queryByRole("radiogroup", { name: "Read mode" })).not.toBeInTheDocument();

    act(() => { pressKey("3", { ctrlKey: true }); });

    expect(screen.getByRole("radiogroup", { name: "Read mode" })).toBeInTheDocument();
  });
});

// ─── CopyButton on ScalarField ────────────────────────────────────────────────

describe("CopyButton integration", () => {
  test("CopyButton renders on string scalar field", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Copy value" })).toBeInTheDocument();
  });

  test("clicking CopyButton calls clipboard.writeText", async () => {
    renderApp();

    // Type a value into the field
    const input = screen.getByRole("textbox");
    act(() => {
      fireEvent.change(input, { target: { value: "hello-proto" } });
    });

    const copyBtn = screen.getByRole("button", { name: "Copy value" });
    await act(async () => {
      fireEvent.click(copyBtn);
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith("hello-proto");
  });

  test("CopyButton shows green check icon after copy", async () => {
    renderApp();

    const copyBtn = screen.getByRole("button", { name: "Copy value" });
    expect(copyBtn.querySelector(".text-success")).toBeNull();

    await act(async () => {
      fireEvent.click(copyBtn);
      await Promise.resolve();
    });

    expect(copyBtn.querySelector(".text-success")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(copyBtn.querySelector(".text-success")).toBeNull();
  });
});

// ─── Platform tooltips ────────────────────────────────────────────────────────

describe("Platform-correct tooltips", () => {
  test("Clear button tooltip contains platform shortcut symbol", () => {
    renderApp();
    const clearBtn = screen.getByRole("button", { name: "Clear form" });
    expect(clearBtn.getAttribute("title")).toMatch(/\+Shift\+R/);
  });
});
