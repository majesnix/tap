import { render, screen, act } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import { useRef } from "react";
import { RightPanel, type RightPanelTab } from "@/components/layout/RightPanel";
import { useProtoStore } from "@/stores/useProtoStore";

vi.mock("@/components/preview/HexPreviewPanel", () => ({
  HexPreviewPanel: () => <div data-testid="hex-panel">Hex</div>,
}));
vi.mock("@/components/history/MessageHistoryPanel", () => ({
  MessageHistoryPanel: () => <div data-testid="history-panel">History</div>,
}));
vi.mock("@/components/response/MessageFeedTab", () => ({
  MessageFeedTab: () => <div data-testid="response-panel">Response</div>,
}));

beforeEach(() => {
  useProtoStore.setState({
    lastSendAt: null,
    pendingReplayValues: null,
  });
});

describe("RightPanel tab tooltips", () => {
  test("tab triggers show platform-correct shortcut tooltips", () => {
    render(<RightPanel />);
    const hexTab = screen.getByRole("tab", { name: "Hex" });
    const historyTab = screen.getByRole("tab", { name: "History" });
    const responseTab = screen.getByRole("tab", { name: "Response" });

    expect(hexTab.getAttribute("title")).toMatch(/1$/);
    expect(historyTab.getAttribute("title")).toMatch(/2$/);
    expect(responseTab.getAttribute("title")).toMatch(/3$/);
  });
});

describe("RightPanel setActiveTabRef", () => {
  function Wrapper() {
    const tabRef = useRef<((tab: RightPanelTab) => void) | null>(null);
    return (
      <div>
        <RightPanel setActiveTabRef={tabRef} />
        <button
          data-testid="switch-history"
          onClick={() => tabRef.current?.("history")}
        />
        <button
          data-testid="switch-response"
          onClick={() => tabRef.current?.("response")}
        />
      </div>
    );
  }

  test("external ref switches active tab", () => {
    render(<Wrapper />);
    expect(screen.getByRole("tab", { name: "Hex", selected: true })).toBeInTheDocument();

    act(() => {
      screen.getByTestId("switch-history").click();
    });
    expect(screen.getByRole("tab", { name: "History", selected: true })).toBeInTheDocument();

    act(() => {
      screen.getByTestId("switch-response").click();
    });
    expect(screen.getByRole("tab", { name: "Response", selected: true })).toBeInTheDocument();
  });
});
