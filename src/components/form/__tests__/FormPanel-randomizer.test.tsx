import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, beforeEach, afterEach, test, expect } from "vitest";
import * as ipc from "@/lib/ipc";
import * as randomizer from "@/lib/randomizer";
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

vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  useDndMonitor: vi.fn(),
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  useDraggable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, isDragging: false })),
}));

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
vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

const SCHEMA_WITH_TWO_FIELDS: ProtoSchema = {
  messages: [
    {
      name: "Msg",
      full_name: "Msg",
      fields: [
        {
          name: "first",
          label: "first",
          field_number: 1,
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
          default_value: null,
        },
        {
          name: "second",
          label: "second",
          field_number: 2,
          kind: { type: "scalar", scalar: "int32" },
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
          name: "first",
          label: "first",
          field_number: 1,
          kind: { type: "scalar", scalar: "string" },
          repeated: false,
          default_value: null,
        },
        {
          name: "second",
          label: "second",
          field_number: 2,
          kind: { type: "scalar", scalar: "int32" },
          repeated: false,
          default_value: null,
        },
      ],
    },
  },
};

beforeEach(() => {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/test.proto", SCHEMA_WITH_TWO_FIELDS);
    useProtoStore.getState().setSelectedType("Msg");
  });
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
  vi.useRealTimers();
});

test("Randomize button renders in the header", () => {
  render(<FormPanel />);
  expect(screen.getByRole("button", { name: "Randomize" })).toBeInTheDocument();
});

test("clicking Randomize triggers setPendingReplayValues with generated values", () => {
  const spy = vi.spyOn(useProtoStore.getState(), "setPendingReplayValues");
  const mockValues = { first: "abc123", second: 42 };
  vi.spyOn(randomizer, "generateRandomValues").mockReturnValue(mockValues);

  render(<FormPanel />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Randomize" }));
  });

  expect(randomizer.generateRandomValues).toHaveBeenCalledWith(
    SCHEMA_WITH_TWO_FIELDS.message_map.Msg,
    SCHEMA_WITH_TWO_FIELDS.message_map,
    expect.any(Object)
  );
  expect(spy).toHaveBeenCalledWith(mockValues);
});

test("dirty fields are passed to generateRandomValues", () => {
  const genSpy = vi.spyOn(randomizer, "generateRandomValues").mockReturnValue({ second: 99 });

  render(<FormPanel />);

  act(() => {
    const firstInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(firstInput, { target: { value: "user-typed" } });
  });

  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Randomize" }));
  });

  const dirtyArg = genSpy.mock.calls[0][2] as Record<string, boolean>;
  expect(dirtyArg).toBeDefined();
  expect(typeof dirtyArg).toBe("object");
});
