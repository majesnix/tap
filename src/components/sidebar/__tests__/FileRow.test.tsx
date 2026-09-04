import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProtoSchema } from "@/lib/types";
import type { OpenFileEntry } from "@/stores/useProtoStore";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { FileRow } from "@/components/sidebar/FileRow";

const SCHEMA: ProtoSchema = {
  messages: [
    {
      name: "Order",
      full_name: "example.Order",
      fields: [],
      oneofs: [],
    },
  ],
  enums: [],
  message_map: {},
} as unknown as ProtoSchema;

const FILE: OpenFileEntry = {
  filePath: "/tmp/order.proto",
  schema: SCHEMA,
} as unknown as OpenFileEntry;

describe("FileRow keyboard activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates the row on Enter aimed at the row itself", () => {
    const onActivate = vi.fn();
    render(<FileRow file={FILE} active={false} onActivate={onActivate} onClose={vi.fn()} />);

    fireEvent.keyDown(screen.getByTitle("/tmp/order.proto"), { key: "Enter" });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("does not activate the row when Enter lands on a nested button", () => {
    const onActivate = vi.fn();
    render(<FileRow file={FILE} active={true} onActivate={onActivate} onClose={vi.fn()} />);

    fireEvent.keyDown(screen.getByLabelText("Include paths for order.proto"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("Close order.proto"), { key: " " });
    expect(onActivate).not.toHaveBeenCalled();
  });
});
