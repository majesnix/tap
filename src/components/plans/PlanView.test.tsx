import { render, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useProtoStore } from "@/stores/useProtoStore";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("./PlanListPanel", () => ({
  PlanListPanel: () => <div data-testid="plan-list-stub" />,
}));

vi.mock("./PlanDetailPanel", () => ({
  PlanDetailPanel: () => <div data-testid="plan-detail-stub" />,
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
});
