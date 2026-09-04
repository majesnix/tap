import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StepStatus } from "@/lib/types";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { StepStatusBadge } from "./StepStatusBadge";

describe("StepStatusBadge", () => {
  test.each([
    ["pending", "PENDING"],
    ["sending", "SENDING"],
    ["waiting-response", "WAITING"],
    ["done", "DONE"],
    ["error", "ERROR"],
  ] as const)("renders the %s label in caps", (status, label) => {
    render(<StepStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test("done uses the success tone", () => {
    render(<StepStatusBadge status="done" />);
    expect(screen.getByText("DONE").className).toContain("text-success");
  });

  test("sending and waiting use the warning tone", () => {
    const { unmount } = render(<StepStatusBadge status="sending" />);
    expect(screen.getByText("SENDING").className).toContain("text-warning");
    unmount();
    render(<StepStatusBadge status="waiting-response" />);
    expect(screen.getByText("WAITING").className).toContain("text-warning");
  });

  test("error uses the danger tone", () => {
    render(<StepStatusBadge status="error" />);
    expect(screen.getByText("ERROR").className).toContain("text-danger");
  });

  test("pending uses the neutral surface tone", () => {
    render(<StepStatusBadge status="pending" />);
    const badge = screen.getByText("PENDING");
    expect(badge.className).toContain("bg-surface-2");
    expect(badge.className).not.toContain("text-success");
    expect(badge.className).not.toContain("text-warning");
    expect(badge.className).not.toContain("text-danger");
  });

  test("waiting-response still shows the spinner", () => {
    const { container } = render(<StepStatusBadge status="waiting-response" />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  test("shows the error message in a tooltip", () => {
    render(<StepStatusBadge status="error" errorMsg="channel closed" />);
    expect(screen.getByText("channel closed")).toBeInTheDocument();
  });

  test("accepts all StepStatus values without TypeScript error", () => {
    const statuses: StepStatus[] = ["pending", "sending", "waiting-response", "done", "error"];
    statuses.forEach((status) => {
      const { unmount } = render(<StepStatusBadge status={status} />);
      unmount();
    });
  });
});
