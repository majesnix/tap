import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Plan } from "@/lib/types";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn().mockResolvedValue("1.9.0") }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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

import { PlansSidebar } from "@/components/sidebar/PlansSidebar";
import { usePlanStore } from "@/stores/usePlanStore";

const PLAN_A: Plan = {
  id: "plan-a",
  name: "Checkout happy path",
  schema_version: 1,
  steps: [
    {
      id: "s1",
      name: "step",
      proto_path: "",
      message_type: "",
      field_values: "{}",
      target: { kind: "queue", queue: "" },
      response_mode: { mode: "no-wait", delay_ms: 200 },
    },
  ],
};

const PLAN_B: Plan = { id: "plan-b", name: "Refund flow", schema_version: 1, steps: [] };

function renderSidebar(overrides: Partial<React.ComponentProps<typeof PlansSidebar>> = {}) {
  const props = {
    selectedPlanId: null as string | null,
    onSelectPlan: vi.fn(),
    lastRunPlanId: null as string | null,
    lastRunAt: null as number | null,
    ...overrides,
  };
  render(<PlansSidebar {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  usePlanStore.setState({ plansLoaded: true, plans: [PLAN_A, PLAN_B] });
});

describe("PlansSidebar", () => {
  test("renders the PLANS section label and the plan rows", () => {
    renderSidebar();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("Checkout happy path")).toBeInTheDocument();
    expect(screen.getByText("1 steps")).toBeInTheDocument();
    expect(screen.getByText("0 steps")).toBeInTheDocument();
  });

  test("appends the last run time to the plan that ran", () => {
    const at = new Date(2026, 0, 2, 14, 2, 0).getTime();
    renderSidebar({ lastRunPlanId: "plan-a", lastRunAt: at });
    expect(screen.getByText("1 steps · ran 14:02")).toBeInTheDocument();
    expect(screen.getByText("0 steps")).toBeInTheDocument();
  });

  test("selects a plan when its row is clicked", () => {
    const props = renderSidebar();
    fireEvent.click(screen.getByText("Refund flow"));
    expect(props.onSelectPlan).toHaveBeenCalledWith("plan-b");
  });

  test("creates a plan from the inline row", async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    const input = screen.getByLabelText("Plan name");
    fireEvent.change(input, { target: { value: "Fresh plan" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(usePlanStore.getState().plans.some((p) => p.name === "Fresh plan")).toBe(true)
    );
  });

  test("Escape cancels the inline create row", async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    const input = screen.getByLabelText("Plan name");
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.queryByLabelText("Plan name")).not.toBeInTheDocument());
    expect(usePlanStore.getState().plans.some((p) => p.name === "Discarded")).toBe(false);
  });

  test("the kebab offers Rename, Duplicate and Delete", () => {
    renderSidebar();
    expect(screen.getAllByRole("button", { name: "Plan options" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Duplicate" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  test("Rename commits a new name", async () => {
    renderSidebar();
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    const input = screen.getByLabelText("Plan name");
    fireEvent.change(input, { target: { value: "Checkout v2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(usePlanStore.getState().plans[0].name).toBe("Checkout v2")
    );
  });

  test("Delete asks for confirmation and resets the selection", async () => {
    const props = renderSidebar({ selectedPlanId: "plan-a" });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Checkout happy path");
    fireEvent.click(screen.getByRole("button", { name: "Delete plan" }));
    await waitFor(() =>
      expect(usePlanStore.getState().plans.some((p) => p.id === "plan-a")).toBe(false)
    );
    expect(props.onSelectPlan).toHaveBeenCalledWith(null);
  });

  test("shows the empty state when there are no plans", () => {
    usePlanStore.setState({ plansLoaded: true, plans: [] });
    renderSidebar();
    expect(screen.getByText("No plans yet")).toBeInTheDocument();
  });

  test("renders the sidebar footer with the version and release name", async () => {
    renderSidebar();
    expect(await screen.findByText(/v1\.9\.0 · Steady Signal/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear local data/i })).toBeInTheDocument();
  });
});
