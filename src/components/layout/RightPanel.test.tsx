import { describe, beforeEach, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

vi.mock("@/stores/useProtoStore", () => ({
  useProtoStore: vi.fn((selector: (s: { lastSendAt: number | null; pendingReplayValues: Record<string, unknown> | null }) => unknown) =>
    selector({ lastSendAt: null, pendingReplayValues: null })
  ),
}));

vi.mock("@/stores/useResponseStore", () => ({
  useResponseStore: vi.fn((selector: (s: { lastReadAt: number | null }) => unknown) =>
    selector({ lastReadAt: null })
  ),
}));

vi.mock("@/components/preview/HexPreviewPanel", () => ({
  HexPreviewPanel: () => <div data-testid="hex-panel" />,
}));

vi.mock("@/components/history/MessageHistoryPanel", () => ({
  MessageHistoryPanel: () => <div data-testid="history-panel" />,
}));

vi.mock("@/components/response/MessageFeedTab", () => ({
  MessageFeedTab: () => <div data-testid="feed-tab" />,
}));

import { useProtoStore } from "@/stores/useProtoStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { RightPanel } from "./RightPanel";

// ── Helpers ────────────────────────────────────────────────────────────────────

function setProtoStore(overrides: { lastSendAt?: number | null; pendingReplayValues?: Record<string, unknown> | null }) {
  (useProtoStore as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: typeof overrides) => unknown) =>
      selector({ lastSendAt: null, pendingReplayValues: null, ...overrides })
  );
}

function setResponseStore(overrides: { lastReadAt?: number | null }) {
  (useResponseStore as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: typeof overrides) => unknown) =>
      selector({ lastReadAt: null, ...overrides })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setProtoStore({});
  setResponseStore({});
});

// ── GAP-2: Tab-switch guard ───────────────────────────────────────────────────

describe("RightPanel auto-switch on send (GAP-2)", () => {
  test("switches to history when send fires while on hex tab (default behavior preserved)", () => {
    // Start on hex tab (default). Render, then simulate a send.
    const { rerender, getByTestId } = render(<RightPanel />);

    // Simulate send: update lastSendAt to a new value
    setProtoStore({ lastSendAt: 1000 });
    act(() => {
      rerender(<RightPanel />);
    });

    // history panel should be visible
    expect(getByTestId("history-panel")).toBeDefined();
  });

  test("does NOT switch to history when send fires while on response tab", () => {
    // First switch to response tab by simulating lastReadAt change
    const { rerender, queryByTestId } = render(<RightPanel />);

    setResponseStore({ lastReadAt: 500 });
    act(() => {
      rerender(<RightPanel />);
    });

    // Now on response tab. Simulate a send while on response tab.
    setProtoStore({ lastSendAt: 1000 });
    act(() => {
      rerender(<RightPanel />);
    });

    // Should still be on response tab — NOT on history
    expect(queryByTestId("history-panel")).toBeNull();
    expect(queryByTestId("feed-tab")).toBeDefined();
  });
});
