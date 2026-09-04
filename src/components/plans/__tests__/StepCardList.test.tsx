import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Plan, PlanStep } from "@/lib/types";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: "vertical",
  useSortable: ({ id }: { id: string }) => ({
    attributes: { "data-sortable-id": id },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (e: { preventDefault: () => void }) => void;
  }) => (
    <button type="button" onClick={() => onSelect?.({ preventDefault: () => {} })}>
      {children}
    </button>
  ),
}));

vi.mock("../StepEditor", () => ({
  StepEditor: () => <div data-testid="step-editor-stub" />,
}));

import { StepCardList } from "@/components/plans/StepCardList";
import { usePlanStore } from "@/stores/usePlanStore";

function makeStep(id: string, name: string): PlanStep {
  return {
    id,
    name,
    proto_path: "",
    message_type: "example.Order",
    field_values: "{}",
    target: { kind: "queue", queue: "orders" },
    response_mode: { mode: "no-wait", delay_ms: 200 },
  };
}

const PLAN: Plan = {
  id: "plan-1",
  name: "Checkout",
  schema_version: 1,
  steps: [makeStep("s1", "Send order"), makeStep("s2", "Send payment")],
};

function renderList(overrides: Partial<React.ComponentProps<typeof StepCardList>> = {}) {
  const props = {
    plan: PLAN,
    selectedStepId: null as string | null,
    onSelectStep: vi.fn(),
    durations: {},
    disabled: false,
    ...overrides,
  };
  render(<StepCardList {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  usePlanStore.setState({ plansLoaded: true, plans: [PLAN] });
});

describe("StepCardList", () => {
  test("renders one card per step", () => {
    renderList();
    expect(screen.getByText("Send order")).toBeInTheDocument();
    expect(screen.getByText("Send payment")).toBeInTheDocument();
  });

  test("shows the no-steps empty state for a plan without steps", () => {
    const empty: Plan = { ...PLAN, id: "plan-empty", steps: [] };
    usePlanStore.setState({ plansLoaded: true, plans: [empty] });
    renderList({ plan: empty });
    expect(screen.getByText("No steps yet")).toBeInTheDocument();
    expect(screen.getByText("Use the + button to add your first step.")).toBeInTheDocument();
    expect(screen.queryByText("Select a plan to get started")).not.toBeInTheDocument();
    // the add-step row stays available beneath the empty state
    expect(screen.getByRole("button", { name: /add step/i })).toBeInTheDocument();
  });

  test("offers the three add-step sources", () => {
    renderList();
    expect(screen.getByRole("button", { name: /add step/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Blank step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "From history" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "From block library" })).toBeInTheDocument();
  });

  test("adding a blank step appends it and selects it", async () => {
    const props = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Blank step" }));
    await waitFor(() => expect(usePlanStore.getState().plans[0].steps).toHaveLength(3));
    expect(props.onSelectStep).toHaveBeenCalled();
  });

  test("deleting a step confirms first and resets the selection", async () => {
    const props = renderList({ selectedStepId: "s1" });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Send order");
    fireEvent.click(screen.getByRole("button", { name: "Delete step" }));
    await waitFor(() =>
      expect(usePlanStore.getState().plans[0].steps.some((s) => s.id === "s1")).toBe(false)
    );
    expect(props.onSelectStep).toHaveBeenCalledWith(null);
  });

  test("renaming a step through the kebab persists the new name", async () => {
    renderList();
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    const input = screen.getByLabelText("Step name");
    fireEvent.change(input, { target: { value: "Send order v2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(usePlanStore.getState().plans[0].steps[0].name).toBe("Send order v2")
    );
  });

  test("clicking the expanded card keeps it selected", () => {
    // Regression: "View reply" bubbles to the header, so selecting must never
    // toggle the selection off — that would blank the reply panel.
    const props = renderList({ selectedStepId: "s1" });
    fireEvent.click(screen.getByText("Send order"));
    expect(props.onSelectStep).toHaveBeenCalledWith("s1");
  });
});
