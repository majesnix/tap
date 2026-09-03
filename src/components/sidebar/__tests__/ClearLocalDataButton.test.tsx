import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

const { mockToastSuccess } = vi.hoisted(() => ({ mockToastSuccess: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: mockToastSuccess, error: vi.fn() }),
}));

import { ClearLocalDataButton } from "@/components/sidebar/ClearLocalDataButton";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useDraftStore } from "@/stores/useDraftStore";
import { usePlanStore } from "@/stores/usePlanStore";
import { useBlockStore } from "@/stores/useBlockStore";
import { useProtoStore } from "@/stores/useProtoStore";

beforeEach(() => {
  vi.clearAllMocks();
  useHistoryStore.setState({
    historyLoaded: true,
    entries: [
      {
        id: "h1",
        timestamp: new Date().toISOString(),
        messageTypeName: "M",
        exchange: "",
        routingKey: "q",
        status: "sent",
        fieldValues: {},
        payloadBase64: "CgU=",
      },
    ],
  });
  useDraftStore.setState({ draftsLoaded: true, drafts: { "f::M": { values: { a: 1 }, accessedAt: 1 } } });
  usePlanStore.setState({ plansLoaded: true, plans: [{ id: "p1", name: "Plan", schema_version: 1, steps: [] }] });
  useBlockStore.setState({ blocksLoaded: true, blocks: [{ id: "b1", name: "Block", content: "{}" }] });
  useProtoStore.setState({ recentFiles: ["/tmp/a.proto"] });
});

describe("ClearLocalDataButton", () => {
  test("asks for confirmation and clears history, drafts, plans, blocks and recent files", async () => {
    render(<ClearLocalDataButton />);
    fireEvent.click(screen.getByRole("button", { name: /clear local data/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/history/i);
    fireEvent.click(screen.getByRole("button", { name: /^clear everything$/i }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(useDraftStore.getState().drafts).toEqual({});
    expect(usePlanStore.getState().plans).toHaveLength(0);
    expect(useBlockStore.getState().blocks).toHaveLength(0);
    expect(useProtoStore.getState().recentFiles).toHaveLength(0);
  });

  test("keeps everything when cancelled", async () => {
    render(<ClearLocalDataButton />);
    fireEvent.click(screen.getByRole("button", { name: /clear local data/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^keep data$/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(useHistoryStore.getState().entries).toHaveLength(1);
    expect(usePlanStore.getState().plans).toHaveLength(1);
  });
});
