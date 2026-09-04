import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useIncludePaths } from "@/components/sidebar/useIncludePaths";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema } from "@/lib/types";

let mockGet: ReturnType<typeof vi.fn>;
let mockSet: ReturnType<typeof vi.fn>;
let mockSave: ReturnType<typeof vi.fn>;

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() => Promise.resolve({ get: mockGet, set: mockSet, save: mockSave })),
}));
vi.mock("@/lib/ipc", () => ({
  reloadProto: vi.fn().mockResolvedValue([]),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const makeSchema = (): ProtoSchema => ({ messages: [], message_map: {}, enums: [] });

/** Stands in for FileRow: reads paths for the meta text. */
function ConsumerA({ filePath }: { filePath: string }) {
  const { paths } = useIncludePaths(filePath);
  return <span data-testid="a">{paths.join(",")}</span>;
}

/** Stands in for IncludePathManager inside the popover: also writes. */
function ConsumerB({
  filePath,
  onReady,
}: {
  filePath: string;
  onReady: (setPaths: (p: string[]) => Promise<void>) => void;
}) {
  const { paths, setPaths } = useIncludePaths(filePath);
  onReady(setPaths);
  return <span data-testid="b">{paths.join(",")}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  useProtoStore.getState().reset();
  mockGet = vi.fn().mockResolvedValue(["/one"]);
  mockSet = vi.fn().mockResolvedValue(undefined);
  mockSave = vi.fn().mockResolvedValue(undefined);
  useProtoStore.setState({
    openFiles: [{ filePath: "/test.proto", schema: makeSchema() }],
    activeIndex: 0,
  });
});

describe("useIncludePaths", () => {
  it("keeps every mounted instance for the same filePath in sync when one of them calls setPaths", async () => {
    let setPathsB: ((p: string[]) => Promise<void>) | null = null;

    render(
      <>
        <ConsumerA filePath="/test.proto" />
        <ConsumerB
          filePath="/test.proto"
          onReady={(fn) => {
            setPathsB = fn;
          }}
        />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId("a")).toHaveTextContent("/one");
    });
    expect(screen.getByTestId("b")).toHaveTextContent("/one");

    await act(async () => {
      await setPathsB!(["/one", "/two"]);
    });

    // Both instances re-render with the new value, not just the one that wrote it.
    expect(screen.getByTestId("a")).toHaveTextContent("/one,/two");
    expect(screen.getByTestId("b")).toHaveTextContent("/one,/two");
  });
});
