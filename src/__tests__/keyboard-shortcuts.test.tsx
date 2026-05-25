import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

// ─── Mock heavy leaf components that don't affect shortcut/copy testing ────────

vi.mock("@/components/sidebar/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar-stub" />,
}));

vi.mock("@/components/publish/PublishBar", () => ({
  PublishBar: () => <div data-testid="publishbar-stub" />,
}));

vi.mock("@/components/blocks/BlockLibraryPanel", () => ({
  BlockLibraryPanel: () => <div data-testid="block-library-stub" />,
}));

vi.mock("@/components/preview/HexPreviewPanel", () => ({
  HexPreviewPanel: () => <div data-testid="hex-panel-stub" />,
}));

vi.mock("@/components/history/MessageHistoryPanel", () => ({
  MessageHistoryPanel: () => <div data-testid="history-panel-stub" />,
}));

vi.mock("@/components/response/MessageFeedTab", () => ({
  MessageFeedTab: () => <div data-testid="response-tab-stub" />,
}));

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

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: Object.assign(
    vi.fn((selector: (s: { blocks: unknown[] }) => unknown) => selector({ blocks: [] })),
    { getState: vi.fn(() => ({ blocks: [] })) }
  ),
}));

vi.mock("@/stores/useResponseStore", () => ({
  useResponseStore: vi.fn((selector: (s: { lastReadAt: null }) => unknown) =>
    selector({ lastReadAt: null })
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

import { AppLayout } from "@/components/layout/AppLayout";

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
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(ipc.encodeMessage).mockResolvedValue([0x0a, 0x05]);
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
    <AppLayout viewMode="main" onViewChange={vi.fn()} />
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

// ─── Cmd+1/2/3: tab switching ─────────────────────────────────────────────────

describe("Cmd+1/2/3 tab switching", () => {
  function getActiveTab() {
    const tabs = screen.getAllByRole("tab");
    return tabs.find((t) => t.getAttribute("data-state") === "active");
  }

  test("Cmd+1 switches to Hex tab", () => {
    renderApp();
    // Switch away from hex first
    act(() => { pressKey("2", { ctrlKey: true }); });
    expect(getActiveTab()?.textContent).toContain("History");

    // Switch back
    act(() => { pressKey("1", { ctrlKey: true }); });
    expect(getActiveTab()?.textContent).toContain("Hex");
  });

  test("Cmd+2 switches to History tab", () => {
    renderApp();
    act(() => { pressKey("2", { ctrlKey: true }); });
    expect(getActiveTab()?.textContent).toContain("History");
  });

  test("Cmd+3 switches to Response tab", () => {
    renderApp();
    act(() => { pressKey("3", { ctrlKey: true }); });
    expect(getActiveTab()?.textContent).toContain("Response");
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
    expect(copyBtn.querySelector(".text-green-500")).toBeNull();

    await act(async () => {
      fireEvent.click(copyBtn);
      await Promise.resolve();
    });

    expect(copyBtn.querySelector(".text-green-500")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(copyBtn.querySelector(".text-green-500")).toBeNull();
  });
});

// ─── Platform tooltips ────────────────────────────────────────────────────────

describe("Platform-correct tooltips", () => {
  test("Clear button tooltip contains platform shortcut symbol", () => {
    renderApp();
    const clearBtn = screen.getByRole("button", { name: "Clear form" });
    expect(clearBtn.getAttribute("title")).toMatch(/\+Shift\+R/);
  });

  test("RightPanel tab triggers show platform shortcut symbols", () => {
    renderApp();
    const tabs = screen.getAllByRole("tab");
    const hexTab = tabs.find((t) => t.textContent?.includes("Hex"));
    const historyTab = tabs.find((t) => t.textContent?.includes("History"));
    const responseTab = tabs.find((t) => t.textContent?.includes("Response"));

    expect(hexTab).toBeDefined();
    expect(historyTab).toBeDefined();
    expect(responseTab).toBeDefined();

    // All tab triggers should have title attributes with shortcut symbols
    expect(hexTab!.getAttribute("title")).toMatch(/1$/);
    expect(historyTab!.getAttribute("title")).toMatch(/2$/);
    expect(responseTab!.getAttribute("title")).toMatch(/3$/);
  });
});
