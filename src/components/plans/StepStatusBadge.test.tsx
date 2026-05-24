import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepStatusBadge } from "./StepStatusBadge";
import type { StepStatus } from "@/lib/types";

describe("StepStatusBadge", () => {
  test("renders 'Pending' text for pending status", () => {
    render(<StepStatusBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  test("renders 'Sending' text for sending status", () => {
    render(<StepStatusBadge status="sending" />);
    expect(screen.getByText("Sending")).toBeInTheDocument();
  });

  test("renders 'Waiting…' text for waiting-response status", () => {
    render(<StepStatusBadge status="waiting-response" />);
    expect(screen.getByText("Waiting…")).toBeInTheDocument();
  });

  test("renders 'Done' text for done status", () => {
    render(<StepStatusBadge status="done" />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  test("renders 'Error' text for error status", () => {
    render(<StepStatusBadge status="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  test("sending badge has amber tint class", () => {
    const { container } = render(<StepStatusBadge status="sending" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-amber-500/10");
  });

  test("waiting-response badge has amber tint class", () => {
    const { container } = render(<StepStatusBadge status="waiting-response" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-amber-500/10");
  });

  test("done badge has emerald tint class", () => {
    const { container } = render(<StepStatusBadge status="done" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-emerald-500/10");
  });

  test("error badge has destructive tint class", () => {
    const { container } = render(<StepStatusBadge status="error" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-destructive/10");
  });

  test("waiting-response badge shows Loader2 spinner element", () => {
    const { container } = render(<StepStatusBadge status="waiting-response" />);
    // Loader2 renders as svg with animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  test("pending badge has no color override class (neutral)", () => {
    const { container } = render(<StepStatusBadge status="pending" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).not.toContain("bg-amber-");
    expect(badge.className).not.toContain("bg-emerald-");
    expect(badge.className).not.toContain("bg-destructive");
  });

  test("accepts all StepStatus values without TypeScript error", () => {
    const statuses: StepStatus[] = ["pending", "sending", "waiting-response", "done", "error"];
    statuses.forEach((status) => {
      const { unmount } = render(<StepStatusBadge status={status} />);
      unmount();
    });
  });
});
