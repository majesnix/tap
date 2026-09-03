import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppHeader } from "@/components/layout/AppHeader";

vi.mock("@/components/connection/ConnectionPill", () => ({ ConnectionPill: () => <div data-testid="pill" /> }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderHeader(overrides: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const props = { view: "compose" as const, onViewChange: vi.fn(), blocksOpen: false, onToggleBlocks: vi.fn(), onOpenSheet: vi.fn(), ...overrides };
  render(<AppHeader {...props} />);
  return props;
}

describe("AppHeader", () => {
  it("shows the brand, the view switch and the connection pill", () => {
    renderHeader();
    expect(screen.getByText("Tap")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /compose/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /plans/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("pill")).toBeInTheDocument();
  });
  it("switches views and toggles the blocks drawer", () => {
    const props = renderHeader();
    fireEvent.click(screen.getByRole("radio", { name: /plans/i }));
    expect(props.onViewChange).toHaveBeenCalledWith("plans");
    fireEvent.click(screen.getByRole("button", { name: "Blocks" }));
    expect(props.onToggleBlocks).toHaveBeenCalled();
  });
  it("marks the blocks button pressed when the drawer is open", () => {
    renderHeader({ blocksOpen: true });
    expect(screen.getByRole("button", { name: "Blocks" })).toHaveAttribute("aria-pressed", "true");
  });
  it("lists the shortcuts in the keyboard popover", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    expect(screen.getByText(/send/i)).toBeInTheDocument();
    expect(screen.getByText(/open \.proto/i)).toBeInTheDocument();
  });
});
