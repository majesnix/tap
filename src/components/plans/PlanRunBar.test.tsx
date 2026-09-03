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
  usePlanExecutionStore.setState({ isRunning: false, runningPlanId: null, summary: null });
});

describe("PlanRunBar and read-only profiles", () => {
  test("Run is enabled for a writable profile", () => {
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run plan/i })).not.toBeDisabled();
  });

  test("Run is disabled for a read-only profile", () => {
    useConnectionStore.setState({ profiles: [{ ...PROFILE, read_only: true }] });
    render(<PlanRunBar plan={PLAN} />);
    expect(screen.getByRole("button", { name: /run plan/i })).toBeDisabled();
  });
});
