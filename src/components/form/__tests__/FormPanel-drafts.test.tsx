import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import * as ipc from "@/lib/ipc";
import { FormPanel } from "@/components/form/FormPanel";
import { useProtoStore } from "@/stores/useProtoStore";
import { useDraftStore } from "@/stores/useDraftStore";
import { useTheme } from "next-themes";
import type { ProtoSchema } from "@/lib/types";

vi.mock("@/lib/ipc");

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: { getState: vi.fn() },
}));

vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  useDndMonitor: vi.fn(),
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  useDraggable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, isDragging: false })),
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="codemirror-stub" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const MINIMAL_SCHEMA: ProtoSchema = {
  messages: [
    {
      name: "Msg",
      full_name: "Msg",
      fields: [
        { name: "value", label: "value", kind: { type: "scalar", scalar: "string" }, repeated: false, default_value: null },
      ],
    },
  ],
  message_map: {
    Msg: {
      name: "Msg",
      full_name: "Msg",
      fields: [
        { name: "value", label: "value", kind: { type: "scalar", scalar: "string" }, repeated: false, default_value: null },
      ],
    },
  },
};

beforeEach(() => {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/test.proto", MINIMAL_SCHEMA);
    useProtoStore.getState().setSelectedType("Msg");
  });
  useDraftStore.setState({ drafts: {}, draftsLoaded: true });
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(ipc.encodeMessage).mockResolvedValue([0x0a, 0x05]);
  vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "light" } as ReturnType<typeof useTheme>);
});

afterEach(async () => {
  await act(async () => {});
  act(() => {
    useProtoStore.getState().reset();
  });
  useDraftStore.setState({ drafts: {}, draftsLoaded: false });
  vi.useRealTimers();
});

describe("Draft auto-save", () => {
  test("saves draft after debounced form change", async () => {
    const saveSpy = vi.spyOn(useDraftStore.getState(), "saveDraft");

    render(<FormPanel />);

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

  test("skips save when values equal defaults", async () => {
    const saveSpy = vi.spyOn(useDraftStore.getState(), "saveDraft");

    render(<FormPanel />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await act(async () => {});

    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("skips save during restore (isRestoring guard)", async () => {
    useDraftStore.setState({
      drafts: {
        "/fake/test.proto::Msg": { values: { value: "restored" }, accessedAt: Date.now() },
      },
      draftsLoaded: true,
    });

    const saveSpy = vi.spyOn(useDraftStore.getState(), "saveDraft");

    render(<FormPanel />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(saveSpy).not.toHaveBeenCalled();
  });
});

describe("Draft restore on message type selection", () => {
  test("restores draft via setPendingReplayValues when draft exists", async () => {
    useDraftStore.setState({
      drafts: {
        "/fake/test.proto::Msg": { values: { value: "saved-draft" }, accessedAt: Date.now() },
      },
      draftsLoaded: true,
    });

    const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");

    render(<FormPanel />);

    await act(async () => {});

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ value: "saved-draft" })
    );
  });
});

describe("Draft clear on Clear button", () => {
  test("handleClear calls clearDraft", async () => {
    const clearSpy = vi.spyOn(useDraftStore.getState(), "clearDraft");

    render(<FormPanel />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    });

    expect(clearSpy).toHaveBeenCalledWith("/fake/test.proto", "Msg");
  });
});
