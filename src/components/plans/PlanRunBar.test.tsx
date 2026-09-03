import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import type { Plan } from "@/lib/types";

vi.mock("@/lib/ipc", () => ({
  executeStep: vi.fn(),
  cancelPlanRun: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { PlanRunBar } from "@/components/plans/PlanRunBar";

const PROFILE = {
  name: "dev",
  host: "localhost",
  port: 5672,
  vhost: "/",
  username: "dev",
  management_port: 15672,
  management_ssl: false,
};

const PLAN: Plan = {
  id: "plan-1",
  name: "Smoke plan",
  schema_version: 1,
  steps: [
    {
      id: "step-1",
      name: "send order",
      proto_path: "/tmp/order.proto",
      message_type: "Order",
      field_values: "{}",
      target: { kind: "queue", queue: "orders" },
      response_mode: { mode: "no-wait", delay_ms: 0 },
    },
  ],
};

beforeEach(() => {
  useConnectionStore.setState({ activeProfileName: "dev", profiles: [PROFILE] });
  usePlanExecutionStore.setState({
    isRunning: false,
    runningPlanId: null,
    summary: null,
    stepStatuses: {},
    activeStepId: null,
  });
});

describe("PlanRunBar", () => {
  test("shows the plan name and the step count", () => {
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByText("Smoke plan")).toBeInTheDocument();
    expect(screen.getByText(/1 steps/)).toBeInTheDocument();
  });

  test("adds the last run time and duration when they are known", () => {
    const at = new Date(2026, 0, 2, 14, 2, 0).getTime();
    render(<PlanRunBar plan={PLAN} lastRunAt={at} lastRunMs={3900} />);
    expect(screen.getByText("1 steps · last run 14:02 · 3.9 s")).toBeInTheDocument();
  });

  test("Run is enabled for a writable profile", () => {
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run plan/i })).not.toBeDisabled();
  });

  test("Run is disabled for a read-only profile", () => {
    useConnectionStore.setState({ profiles: [{ ...PROFILE, read_only: true }] });
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run plan/i })).toBeDisabled();
  });

  test("Run is disabled when the plan has no steps", () => {
    render(<PlanRunBar plan={{ ...PLAN, steps: [] }} />);
    expect(screen.getByRole("button", { name: /run plan/i })).toBeDisabled();
  });

  test("Run is disabled without an active profile", () => {
    useConnectionStore.setState({ activeProfileName: null });
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run plan/i })).toBeDisabled();
  });

  test("after a run the button reads 'Run again' and shows the result pill", () => {
    usePlanExecutionStore.setState({ summary: { succeeded: 1, total: 1 } });
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    expect(screen.getByText("1 / 1 succeeded")).toBeInTheDocument();
  });

  test("a read-only profile also blocks 'Run again'", () => {
    usePlanExecutionStore.setState({ summary: { succeeded: 0, total: 1 } });
    useConnectionStore.setState({ profiles: [{ ...PROFILE, read_only: true }] });
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run again/i })).toBeDisabled();
  });

  test("while running it offers Stop and a progress chip", () => {
    usePlanExecutionStore.setState({
      isRunning: true,
      runningPlanId: "plan-1",
      activeStepId: "step-1",
      stepStatuses: { "step-1": "waiting-response" },
    });
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByText("0 / 1 · waiting")).toBeInTheDocument();
  });

  test("renders the stop-on-error switch", () => {
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByText("Stop on error")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });
});
