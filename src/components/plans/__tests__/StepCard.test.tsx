import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PlanStep, ResponseMode } from "@/lib/types";

vi.mock("@dnd-kit/sortable", () => ({
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

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../StepEditor", () => ({
  StepEditor: ({ step }: { step: PlanStep }) => (
    <div data-testid="step-editor-stub">{step.id}</div>
  ),
}));

import { StepCard } from "@/components/plans/StepCard";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";

const STEP: PlanStep = {
  id: "step-1",
  name: "Send order",
  proto_path: "/tmp/order.proto",
  message_type: "example.Order",
  field_values: "{}",
  target: { kind: "queue", queue: "orders" },
  response_mode: { mode: "no-wait", delay_ms: 200 },
};

function renderCard(
  overrides: Partial<React.ComponentProps<typeof StepCard>> = {},
  step: PlanStep = STEP
) {
  const props = {
    step,
    index: 0,
    planId: "plan-1",
    selected: false,
    hasReply: false,
    disabled: false,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<StepCard {...props} />);
  return props;
}

/** Meta cells joined the way the design reads them: "type Order · to orders · then …". */
function metaText() {
  const row = screen.getByTestId("step-meta");
  return Array.from(row.children)
    .map((cell) => cell.textContent?.trim() ?? "")
    .join(" · ");
}

function withMode(mode: ResponseMode): PlanStep {
  return { ...STEP, response_mode: mode };
}

beforeEach(() => {
  vi.clearAllMocks();
  usePlanExecutionStore.setState({ activeStepId: null });
});

describe("StepCard", () => {
  test("renders the numbered circle with the 1-based index", () => {
    renderCard({ index: 2 });
    expect(screen.getByTestId("step-number")).toHaveTextContent("3");
  });

  test("renders the step name in the design's heading style", () => {
    renderCard();
    const name = screen.getByText("Send order");
    expect(name.className).toContain("text-14");
    expect(name.className).toContain("font-semibold");
  });

  test.each([
    ["done", "DONE", "text-success"],
    ["sending", "SENDING", "text-warning"],
    ["waiting-response", "WAITING", "text-warning"],
    ["error", "ERROR", "text-danger"],
    ["pending", "PENDING", "bg-surface-2"],
  ] as const)("renders the %s status pill", (status, label, toneClass) => {
    renderCard({ status });
    expect(screen.getByText(label).className).toContain(toneClass);
  });

  test("omits the status pill before a run", () => {
    renderCard();
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
  });

  test("renders the meta row for a no-wait step", () => {
    renderCard();
    expect(metaText()).toBe("type Order · to orders · then wait 200 ms");
  });

  test("renders the meta row for a correlation-id step", () => {
    renderCard(
      {},
      withMode({ mode: "correlation-id", reply_queue: "orders.reply", timeout_ms: 10000 })
    );
    expect(metaText()).toBe(
      "type Order · to orders · then wait for correlation id · 10 s"
    );
  });

  test("renders the meta row for a first-arrival step", () => {
    renderCard(
      {},
      withMode({ mode: "first-arrival", reply_queue: "", timeout_ms: 10000 })
    );
    expect(metaText()).toBe(
      "type Order · to orders · then wait for first arrival · 10 s"
    );
  });

  test("renders an exchange target as exchange → routing key", () => {
    renderCard({}, { ...STEP, target: { kind: "exchange", exchange: "orders.x", routing_key: "created" } });
    expect(metaText()).toContain("to orders.x → created");
  });

  test("shows the duration when it is known", () => {
    renderCard({ durationMs: 412 });
    expect(screen.getByText("412 ms")).toBeInTheDocument();
  });

  test("shows 'View reply' only when the step has a reply", () => {
    renderCard();
    expect(screen.queryByText("View reply")).not.toBeInTheDocument();
  });

  test("'View reply' selects the step", () => {
    const props = renderCard({ hasReply: true });
    fireEvent.click(screen.getByText("View reply"));
    expect(props.onSelect).toHaveBeenCalled();
  });

  test("'View reply' still selects when the card is already expanded", () => {
    const props = renderCard({ hasReply: true, selected: true });
    fireEvent.click(screen.getByText("View reply"));
    expect(props.onSelect).toHaveBeenCalled();
  });

  test("clicking the header selects the step", () => {
    const props = renderCard();
    fireEvent.click(screen.getByText("Send order"));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  test("the kebab offers Rename, Duplicate and Delete", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Step options" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  test("Duplicate and Delete call their handlers", () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(props.onDuplicate).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  test("Rename selects the card and commits the edited name on Enter", () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(props.onSelect).toHaveBeenCalled();
    const input = screen.getByLabelText("Step name");
    fireEvent.change(input, { target: { value: "Renamed step" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("Renamed step");
  });

  test("Rename is cancelled by Escape", () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Step name");
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.getByText("Send order")).toBeInTheDocument();
  });

  test("renders the inline editor only when selected", () => {
    renderCard();
    expect(screen.queryByTestId("step-editor-stub")).not.toBeInTheDocument();
  });

  test("renders the inline editor when selected", () => {
    renderCard({ selected: true });
    expect(screen.getByTestId("step-editor-stub")).toBeInTheDocument();
  });

  test("marks the selected card with the strong border", () => {
    const { container } = render(
      <StepCard
        step={STEP}
        index={0}
        planId="plan-1"
        selected
        hasReply={false}
        disabled={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("border-border-strong");
  });

  test("scrolls into view when it becomes the active step", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    usePlanExecutionStore.setState({ activeStepId: STEP.id });
    renderCard({ status: "waiting-response" });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  test("does not scroll a card that is not the active step", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    usePlanExecutionStore.setState({ activeStepId: "another-step" });
    renderCard();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test("shows the error message in a tooltip for a failed step", () => {
    renderCard({ status: "error", errorMsg: "channel closed" });
    expect(screen.getByText("channel closed")).toBeInTheDocument();
  });
});
