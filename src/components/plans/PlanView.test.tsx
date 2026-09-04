import { render, act, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useProtoStore } from "@/stores/useProtoStore";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/components/sidebar/PlansSidebar", () => ({
  PlansSidebar: () => <div data-testid="plans-sidebar-stub" />,
}));

vi.mock("./PlanRunBar", () => ({
  PlanRunBar: () => <div data-testid="plan-run-bar-stub" />,
}));

vi.mock("./StepCardList", () => ({
  StepCardList: () => <div data-testid="step-card-list-stub" />,
}));

vi.mock("./StepReplyPanel", () => ({
  StepReplyPanel: () => <div data-testid="step-reply-panel-stub" />,
}));

import { PlanView } from "@/components/plans/PlanView";

function pressKey(key: string, code: string, opts: KeyboardEventInit = {}) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...opts })
  );
  document.dispatchEvent(
    new KeyboardEvent("keyup", { key, code, bubbles: true, cancelable: true, ...opts })
  );
}

describe("PlanView", () => {
  it("binds mod+o so Cmd+O works from the Plans view too", () => {
    render(<PlanView header={<div />} />);
    const before = useProtoStore.getState().openFileRequested;

    act(() => {
      pressKey("o", "KeyO", { ctrlKey: true });
    });

    expect(useProtoStore.getState().openFileRequested).toBe(before + 1);
  });

  it("shows the plans empty state until a plan is selected", () => {
    render(<PlanView header={<div />} />);
    expect(screen.getByText("Select a plan to get started")).toBeInTheDocument();
    expect(screen.queryByTestId("plan-run-bar-stub")).not.toBeInTheDocument();
  });
});
