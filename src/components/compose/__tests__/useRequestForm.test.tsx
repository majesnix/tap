import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import * as ipc from "@/lib/ipc";
import * as randomizer from "@/lib/randomizer";
import { useRequestForm } from "@/components/compose/useRequestForm";
import { ProtoFormRenderer } from "@/components/form/ProtoFormRenderer";
import { JsonEditor } from "@/components/form/JsonEditor";
import { useProtoStore } from "@/stores/useProtoStore";
import { useDraftStore } from "@/stores/useDraftStore";
import type { MessageSchema, ProtoSchema } from "@/lib/types";

vi.mock("@/lib/ipc");

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: { getState: vi.fn() },
}));
import { useBlockStore } from "@/stores/useBlockStore";

// vi.hoisted so the mock factory can share state used to simulate dnd-kit events
const { dndKit } = vi.hoisted(() => ({
  dndKit: {
    onDragEnd: undefined as
      | ((event: { active: { id: string }; over: { id: string } | null }) => void)
      | undefined,
  },
}));
vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  useDndMonitor: vi.fn(
    (handlers: {
      onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
    }) => {
      dndKit.onDragEnd = handlers.onDragEnd;
    }
  ),
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));
import { useDroppable } from "@dnd-kit/core";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

const { mockToastWarning } = vi.hoisted(() => ({ mockToastWarning: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { warning: mockToastWarning, error: vi.fn(), success: vi.fn() },
}));

const FIELDS: MessageSchema["fields"] = [
  {
    name: "value",
    label: "value",
    field_number: 1,
    kind: { type: "scalar", scalar: "string" },
    repeated: false,
    default_value: null,
  },
];

const MSG: MessageSchema = { name: "Msg", full_name: "Msg", fields: FIELDS };

const MINIMAL_SCHEMA: ProtoSchema = {
  messages: [MSG],
  message_map: { Msg: MSG },
  enums: [],
};

/** Exercises the hook through the same surfaces the RequestCard gives it. */
function Harness() {
  const schema = useProtoStore((s) => s.schema);
  const selectedMessageType = useProtoStore((s) => s.selectedMessageType);
  const message =
    schema && selectedMessageType ? (schema.message_map[selectedMessageType] ?? null) : null;
  // Destructured like RequestCard does it: the refs must leave the returned object before
  // render reads it, or the React compiler treats every read as a ref access.
  const {
    resetRef,
    getDirtyFieldsRef,
    applyBlockRef,
    dropZone: { setNodeRef, isOver },
    ...form
  } = useRequestForm(message);

  return (
    <div ref={setNodeRef} data-testid="drop-zone" data-over={String(isOver)}>
      <button onClick={form.toggleJson}>
        {form.isJsonMode ? "Return to form" : "Edit as JSON"}
      </button>
      <button onClick={form.clear}>Clear form</button>
      <button onClick={form.randomize}>Randomize</button>
      <span data-testid="has-draft">{String(form.hasDraft)}</span>
      {form.isJsonMode ? (
        <JsonEditor
          value={form.jsonDraft}
          onChange={form.setJsonDraft}
          resolvedTheme="light"
          parseError={form.parseError}
          onFixJson={form.fixJson}
          onDiscard={form.discardJson}
        />
      ) : (
        message && (
          <ProtoFormRenderer
            message={message}
            onValuesChange={form.handleValuesChange}
            resetRef={resetRef}
            getDirtyFieldsRef={getDirtyFieldsRef}
            applyBlockRef={applyBlockRef}
          />
        )
      )}
    </div>
  );
}

beforeEach(() => {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/test.proto", MINIMAL_SCHEMA);
    useProtoStore.getState().setSelectedType("Msg");
  });
  useDraftStore.setState({ drafts: {}, draftsLoaded: true });
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(ipc.encodeMessage).mockResolvedValue("CgU=");
  vi.mocked(useDroppable).mockReturnValue({
    isOver: false,
    setNodeRef: vi.fn(),
  } as unknown as ReturnType<typeof useDroppable>);
  vi.mocked(useBlockStore.getState).mockReturnValue({
    blocks: [{ id: "block-1", name: "My Block", content: '{"ghost": "value"}' }],
  } as ReturnType<typeof useBlockStore.getState>);
});

afterEach(async () => {
  await act(async () => {});
  act(() => {
    useProtoStore.getState().reset();
  });
  useDraftStore.setState({ drafts: {}, draftsLoaded: false });
  vi.useRealTimers();
});

describe("encode debounce", () => {
  test("calls encodeMessage once per burst, after 200ms", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");

    act(() => {
      fireEvent.change(input, { target: { value: "h" } });
      fireEvent.change(input, { target: { value: "he" } });
      fireEvent.change(input, { target: { value: "hel" } });
    });
    expect(ipc.encodeMessage).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(ipc.encodeMessage).toHaveBeenCalledTimes(1);
    expect(ipc.encodeMessage).toHaveBeenCalledWith(
      "Msg",
      expect.objectContaining({ value: "hel" })
    );
  });

  test("does not encode inside the debounce window", () => {
    render(<Harness />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(ipc.encodeMessage).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(ipc.encodeMessage).toHaveBeenCalledTimes(1);
  });
});

describe("JSON mode", () => {
  test("prefills the editor with the values captured on entry", () => {
    render(<Harness />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    expect(screen.getByTestId("codemirror-stub")).toHaveValue(
      JSON.stringify({ value: "hello" }, null, 2)
    );
  });

  test("valid JSON leaves JSON mode through setPendingReplayValues", () => {
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: '{"value":"world"}' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: "world" }));
    expect(screen.queryByTestId("codemirror-stub")).not.toBeInTheDocument();
  });

  test("invalid JSON stays in JSON mode and reports the parse error", () => {
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), { target: { value: "{bad json" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("a non-object document is rejected", () => {
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), { target: { value: "[1,2]" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    expect(
      screen.getByText("JSON must be an object, not a primitive or array")
    ).toBeInTheDocument();
  });

  test("unknown top-level keys warn and are dropped", () => {
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), {
        target: { value: '{"value":"ok","ghost":"here"}' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    expect(mockToastWarning).toHaveBeenCalledWith("1 unknown field ignored: ghost");
  });

  test("Fix JSON clears the banner and keeps JSON mode", () => {
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), { target: { value: "{bad json" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Fix JSON" }));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
  });

  test("Discard changes restores the entry snapshot", () => {
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    render(<Harness />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "original" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
    });
    act(() => {
      fireEvent.change(screen.getByTestId("codemirror-stub"), { target: { value: "{bad json" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: "original" }));
    expect(screen.queryByTestId("codemirror-stub")).not.toBeInTheDocument();
  });
});

describe("clear and randomize", () => {
  test("clear resets to the schema defaults and drops the draft", () => {
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    const clearSpy = vi.spyOn(useDraftStore.getState(), "clearDraft");
    render(<Harness />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "dirty" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: "" }));
    expect(clearSpy).toHaveBeenCalledWith("/fake/test.proto", "Msg");
  });

  test("randomize passes the dirty fields and current values", () => {
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    const generated = { value: "abc123" };
    vi.spyOn(randomizer, "generateRandomValues").mockReturnValue(generated);

    render(<Harness />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "typed" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Randomize" }));
    });

    expect(randomizer.generateRandomValues).toHaveBeenCalledWith(
      MSG,
      MINIMAL_SCHEMA.message_map,
      expect.any(Object),
      expect.any(Object)
    );
    expect(spy).toHaveBeenCalledWith(generated);
  });
});

describe("drafts", () => {
  test("saves a draft after the debounce settles", async () => {
    const saveSpy = vi.spyOn(useDraftStore.getState(), "saveDraft");
    render(<Harness />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {});
    expect(saveSpy).toHaveBeenCalledWith(
      "/fake/test.proto",
      "Msg",
      expect.objectContaining({ value: "hello" })
    );
  });

  test("skips the save when the values equal the defaults", async () => {
    const saveSpy = vi.spyOn(useDraftStore.getState(), "saveDraft");
    render(<Harness />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {});
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("skips the save while a draft is being restored", async () => {
    useDraftStore.setState({
      drafts: { "/fake/test.proto::Msg": { values: { value: "restored" }, accessedAt: Date.now() } },
      draftsLoaded: true,
    });
    const saveSpy = vi.spyOn(useDraftStore.getState(), "saveDraft");
    render(<Harness />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {});
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("restores an existing draft and reports hasDraft", async () => {
    useDraftStore.setState({
      drafts: {
        "/fake/test.proto::Msg": { values: { value: "saved-draft" }, accessedAt: Date.now() },
      },
      draftsLoaded: true,
    });
    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
    render(<Harness />);
    await act(async () => {});
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: "saved-draft" }));
    expect(screen.getByTestId("has-draft")).toHaveTextContent("true");
  });

  test("reports no draft when none is stored", () => {
    render(<Harness />);
    expect(screen.getByTestId("has-draft")).toHaveTextContent("false");
  });
});

describe("block drops", () => {
  test("isOver mirrors useDroppable", () => {
    vi.mocked(useDroppable).mockReturnValue({
      isOver: true,
      setNodeRef: vi.fn(),
    } as unknown as ReturnType<typeof useDroppable>);
    render(<Harness />);
    expect(screen.getByTestId("drop-zone")).toHaveAttribute("data-over", "true");
  });

  test("a drop over the form warns about unknown block fields", async () => {
    vi.useRealTimers();
    render(<Harness />);
    await act(async () => {});
    act(() => {
      dndKit.onDragEnd?.({ active: { id: "block-1" }, over: { id: "form-drop-zone" } });
    });
    expect(mockToastWarning).toHaveBeenCalledWith("1 field from block not in form: ghost");
  });

  test("plural copy for several unknown fields", async () => {
    vi.useRealTimers();
    vi.mocked(useBlockStore.getState).mockReturnValue({
      blocks: [{ id: "block-1", name: "My Block", content: '{"ghost": "x", "phantom": "y"}' }],
    } as ReturnType<typeof useBlockStore.getState>);
    render(<Harness />);
    await act(async () => {});
    act(() => {
      dndKit.onDragEnd?.({ active: { id: "block-1" }, over: { id: "form-drop-zone" } });
    });
    expect(mockToastWarning).toHaveBeenCalledWith(
      "2 fields from block not in form: ghost, phantom"
    );
  });

  test("an unknown block id is a silent no-op", async () => {
    vi.useRealTimers();
    render(<Harness />);
    await act(async () => {});
    act(() => {
      dndKit.onDragEnd?.({ active: { id: "nonexistent" }, over: { id: "form-drop-zone" } });
    });
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  test("a drop elsewhere is a silent no-op", async () => {
    vi.useRealTimers();
    render(<Harness />);
    await act(async () => {});
    act(() => {
      dndKit.onDragEnd?.({ active: { id: "block-1" }, over: null });
    });
    expect(mockToastWarning).not.toHaveBeenCalled();
  });
});
