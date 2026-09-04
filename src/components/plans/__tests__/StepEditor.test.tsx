import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { FieldSchema, MessageSchema, PlanStep, ProtoSchema } from "@/lib/types";

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

vi.mock("@/lib/brokerCatalog", () => ({
  getQueues: vi.fn().mockResolvedValue([]),
  getExchanges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select role="combobox" value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { StepEditor } from "@/components/plans/StepEditor";
import { useProtoStore } from "@/stores/useProtoStore";
import { usePlanStore } from "@/stores/usePlanStore";
import { useConnectionStore } from "@/stores/useConnectionStore";

const PROTO_PATH = "/tmp/order.proto";
const TYPE = "example.Order";

function scalarField(name: string, index: number): FieldSchema {
  return {
    name,
    label: name,
    field_number: index + 1,
    kind: { type: "scalar", scalar: "string" },
    repeated: false,
  } as FieldSchema;
}

const MESSAGE: MessageSchema = {
  name: "Order",
  full_name: TYPE,
  fields: ["order_id", "customer", "sku", "quantity", "note", "channel"].map(scalarField),
};

const SCHEMA = {
  messages: [MESSAGE],
  message_map: { [TYPE]: MESSAGE },
  enums: [],
} as ProtoSchema;

function makeStep(fieldValues: string): PlanStep {
  return {
    id: "step-1",
    name: "Send order",
    proto_path: PROTO_PATH,
    message_type: TYPE,
    field_values: fieldValues,
    target: { kind: "queue", queue: "orders" },
    response_mode: { mode: "no-wait", delay_ms: 200 },
  };
}

function planWith(step: PlanStep) {
  return { id: "plan-1", name: "Checkout", schema_version: 1, steps: [step] };
}

function storedStep(): PlanStep {
  return usePlanStore.getState().plans[0].steps[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.setState({ openFiles: [{ filePath: PROTO_PATH, schema: SCHEMA }] });
  usePlanStore.setState({ plansLoaded: true, plans: [] });
  useConnectionStore.setState({ activeProfileName: null, queues: [], exchanges: [] });
});

describe("StepEditor field summary", () => {
  test("counts every schema field as empty for a fresh step", () => {
    render(<StepEditor step={makeStep("{}")} planId="plan-1" />);
    expect(screen.getByText("· 6 fields · 6 empty")).toBeInTheDocument();
  });

  test("counts only the unfilled fields once values exist", () => {
    render(
      <StepEditor
        step={makeStep(JSON.stringify({ order_id: "ord_1", customer: "acme" }))}
        planId="plan-1"
      />
    );
    expect(screen.getByText("· 6 fields · 4 empty")).toBeInTheDocument();
  });

  test("treats \"\", null, [] and 0 as empty but keeps real values", () => {
    render(
      <StepEditor
        step={makeStep(
          JSON.stringify({
            order_id: "ord_1",
            customer: "",
            sku: null,
            quantity: 0,
            note: [],
            channel: "web",
          })
        )}
        planId="plan-1"
      />
    );
    expect(screen.getByText("· 6 fields · 4 empty")).toBeInTheDocument();
  });

  test("hides the field form until 'Edit fields' is toggled", () => {
    render(<StepEditor step={makeStep("{}")} planId="plan-1" />);
    const toggle = screen.getByRole("button", { name: /edit fields/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("order_id")).not.toBeInTheDocument();
  });

  test("associates the grid labels with their controls", () => {
    render(<StepEditor step={makeStep("{}")} planId="plan-1" />);
    expect(screen.getByText("Proto file")).toHaveAttribute("for", "proto-file-step-1");
    expect(screen.getByText("Message type")).toHaveAttribute("for", "message-type-step-1");
    expect(screen.getByText("Response mode")).toHaveAttribute("for", "mode-step-1");
    expect(screen.getByText("Target")).toHaveAttribute("for", "queue-name-step-1");
  });
});

describe("StepEditor grids", () => {
  test("reveals the field form when 'Edit fields' is toggled", () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    fireEvent.click(screen.getByRole("button", { name: /edit fields/i }));

    expect(screen.getByRole("button", { name: /edit fields/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("order_id")).toBeInTheDocument();
    expect(screen.getByText("channel")).toBeInTheDocument();
  });

  test("randomizing fills the empty fields", async () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Randomize fields" }));

    await waitFor(() => expect(screen.getByText("· 6 fields · 0 empty")).toBeInTheDocument());
  });

  test("tells the user to open a proto file that is not loaded", () => {
    const step: PlanStep = { ...makeStep("{}"), proto_path: "/tmp/missing.proto" };
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    expect(screen.getByText(/Open missing\.proto in the file picker/)).toBeInTheDocument();
    // message type falls back to a read-only cell while the schema is missing
    expect(screen.getByText("Order")).toBeInTheDocument();
  });

  test("switching the target to an exchange persists the new target and shows the routing key", async () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    fireEvent.click(screen.getByRole("radio", { name: "Exchange" }));
    await waitFor(() => expect(storedStep().target.kind).toBe("exchange"));

    const routingKey = screen.getByLabelText("Routing key");
    fireEvent.change(routingKey, { target: { value: "order.created" } });
    fireEvent.blur(routingKey);
    await waitFor(() =>
      expect(storedStep().target).toEqual({
        kind: "exchange",
        exchange: "",
        routing_key: "order.created",
      })
    );
  });

  test("editing the queue name persists it", async () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    const queue = screen.getByLabelText("Target");
    fireEvent.change(queue, { target: { value: "orders.v2" } });
    fireEvent.blur(queue);
    await waitFor(() =>
      expect(storedStep().target).toEqual({ kind: "queue", queue: "orders.v2" })
    );
  });

  test("switching to correlation id swaps the delay cell for a timeout and a reply queue", async () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    expect(screen.getByLabelText("Delay")).toHaveValue(200);
    expect(screen.getByText("—")).toBeInTheDocument();

    // the Select mock drops the trigger id, so address the selects by order:
    // 0 = proto file, 1 = message type, 2 = response mode
    fireEvent.change(screen.getAllByRole("combobox")[2], {
      target: { value: "correlation-id" },
    });

    await waitFor(() => expect(storedStep().response_mode.mode).toBe("correlation-id"));
    const timeout = screen.getByLabelText("Timeout");
    expect(timeout).toHaveValue(10000);

    fireEvent.change(timeout, { target: { value: "2500" } });
    fireEvent.blur(timeout);
    await waitFor(() => {
      const mode = storedStep().response_mode;
      expect(mode.mode !== "no-wait" && mode.timeout_ms).toBe(2500);
    });

    const replyQueue = screen.getByLabelText("Reply queue");
    fireEvent.change(replyQueue, { target: { value: "orders.reply" } });
    fireEvent.blur(replyQueue);
    await waitFor(() => {
      const mode = storedStep().response_mode;
      expect(mode.mode !== "no-wait" && mode.reply_queue).toBe("orders.reply");
    });
  });

  test("the delay input persists a new value", async () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    const delay = screen.getByLabelText("Delay");
    fireEvent.change(delay, { target: { value: "750" } });
    fireEvent.blur(delay);
    await waitFor(() => {
      const mode = storedStep().response_mode;
      expect(mode.mode === "no-wait" && mode.delay_ms).toBe(750);
    });
  });

  test("changing the proto file clears the message type", async () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    render(<StepEditor step={step} planId="plan-1" />);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "" } });
    await waitFor(() => expect(storedStep().message_type).toBe(""));
  });

  test("disables the editor while a run is in progress", () => {
    const step = makeStep("{}");
    usePlanStore.setState({ plansLoaded: true, plans: [planWith(step)] });
    const { container } = render(<StepEditor step={step} planId="plan-1" disabled />);
    const fieldset = container.querySelector("fieldset") as HTMLFieldSetElement;
    expect(fieldset).toBeDisabled();
    expect(fieldset.className).toContain("opacity-60");
  });
});
