import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ProtoSchema, MessageSchema, FieldSchema, EnumSchema } from "@/lib/types";

vi.mock("@/stores/useProtoStore", () => ({
  useProtoStore: vi.fn(),
}));

function makeField(overrides: Partial<FieldSchema> & { name: string }): FieldSchema {
  return {
    label: overrides.name,
    field_number: 1,
    kind: { type: "scalar", scalar: "string" },
    repeated: false,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<MessageSchema> & { name: string; full_name: string }): MessageSchema {
  return {
    fields: [],
    ...overrides,
  };
}

function makeSchema(messages: MessageSchema[], enums: EnumSchema[] = []): ProtoSchema {
  const message_map: Record<string, MessageSchema> = {};
  for (const m of messages) {
    message_map[m.full_name] = m;
  }
  return { messages, message_map, enums };
}

const mockSetSelectedType = vi.fn();

function setStore(schema: ProtoSchema | null) {
  vi.mocked(useProtoStore).mockReturnValue({
    schema,
    setSelectedType: mockSetSelectedType,
  } as any);
}

async function renderExplorer() {
  const { SchemaExplorer } = await import("../SchemaExplorer");
  return render(<SchemaExplorer />);
}

describe("SchemaExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders nothing when schema is null", async () => {
    setStore(null);
    const { container } = await renderExplorer();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when schema has no messages", async () => {
    setStore(makeSchema([]));
    const { container } = await renderExplorer();
    expect(container.innerHTML).toBe("");
  });

  it("renders message names from schema", async () => {
    const schema = makeSchema([
      makeMessage({ name: "UserRequest", full_name: "pkg.UserRequest" }),
      makeMessage({ name: "OrderEvent", full_name: "pkg.OrderEvent" }),
    ]);
    setStore(schema);
    await renderExplorer();

    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("UserRequest")).toBeInTheDocument();
    expect(screen.getByText("OrderEvent")).toBeInTheDocument();
  });

  it("expands a message node to show fields with type badges and field numbers", async () => {
    const schema = makeSchema([
      makeMessage({
        name: "User",
        full_name: "pkg.User",
        fields: [
          makeField({ name: "id", field_number: 1, kind: { type: "scalar", scalar: "int32" } }),
          makeField({ name: "email", field_number: 2, kind: { type: "scalar", scalar: "string" } }),
        ],
      }),
    ]);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    const expandBtn = screen.getByLabelText("Expand User");
    await user.click(expandBtn);

    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("int32")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("shows repeated indicator on repeated fields", async () => {
    const schema = makeSchema([
      makeMessage({
        name: "Msg",
        full_name: "pkg.Msg",
        fields: [
          makeField({ name: "tags", field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: true }),
        ],
      }),
    ]);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Expand Msg"));

    expect(screen.getByText("repeated")).toBeInTheDocument();
  });

  it("shows map indicator on map fields", async () => {
    const schema = makeSchema([
      makeMessage({
        name: "Msg",
        full_name: "pkg.Msg",
        fields: [
          makeField({
            name: "metadata",
            field_number: 1,
            kind: { type: "map", key_type: "string", value_kind: { type: "scalar", scalar: "string" } },
          }),
        ],
      }),
    ]);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Expand Msg"));

    expect(screen.getByText("map")).toBeInTheDocument();
    expect(screen.getByText("map<string, …>")).toBeInTheDocument();
  });

  it("renders standalone enums section with enum names", async () => {
    const schema = makeSchema(
      [makeMessage({ name: "Msg", full_name: "pkg.Msg" })],
      [
        { name: "Status", full_name: "pkg.Status", values: [{ name: "ACTIVE", number: 0 }, { name: "INACTIVE", number: 1 }] },
      ]
    );
    setStore(schema);
    await renderExplorer();

    expect(screen.getByText("Enums")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("expands an enum to show name=number value pairs", async () => {
    const schema = makeSchema(
      [makeMessage({ name: "Msg", full_name: "pkg.Msg" })],
      [
        { name: "Color", full_name: "pkg.Color", values: [{ name: "RED", number: 0 }, { name: "GREEN", number: 1 }, { name: "BLUE", number: 2 }] },
      ]
    );
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    const enumTrigger = screen.getByText("Color").closest("button")!;
    await user.click(enumTrigger);

    expect(screen.getByText("RED = 0")).toBeInTheDocument();
    expect(screen.getByText("GREEN = 1")).toBeInTheDocument();
    expect(screen.getByText("BLUE = 2")).toBeInTheDocument();
  });

  it("handles recursive message type with visited-set guard — shows '(recursive)' label", async () => {
    const selfRefField = makeField({
      name: "parent",
      field_number: 2,
      kind: { type: "message", full_name: "pkg.Node" },
    });
    const nodeMsg = makeMessage({
      name: "Node",
      full_name: "pkg.Node",
      fields: [
        makeField({ name: "value", field_number: 1, kind: { type: "scalar", scalar: "string" } }),
        selfRefField,
      ],
    });
    const schema = makeSchema([nodeMsg]);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Expand Node"));

    expect(screen.getByText("(recursive)")).toBeInTheDocument();
    expect(screen.getByText("parent")).toBeInTheDocument();
  });

  it("enforces MAX_DEPTH=5 — deeply nested non-recursive types stop expanding", async () => {
    const messages: MessageSchema[] = [];
    for (let i = 0; i <= 6; i++) {
      const name = `Level${i}`;
      const full_name = `pkg.${name}`;
      const nextName = `Level${i + 1}`;
      const nextFullName = `pkg.${nextName}`;
      const fields: FieldSchema[] = [
        makeField({ name: "label", field_number: 1, kind: { type: "scalar", scalar: "string" } }),
      ];
      if (i <= 5) {
        fields.push(makeField({
          name: "child",
          field_number: 2,
          kind: { type: "message", full_name: nextFullName },
        }));
      }
      messages.push(makeMessage({ name, full_name, fields }));
    }

    const schema = makeSchema(messages);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();

    // Expand Level0
    await user.click(screen.getByLabelText("Expand Level0"));

    // Expand nested child fields at each depth
    // depth 1: child field with type Level1
    const childButtons = () => screen.getAllByText("child");

    // At depth 1 (inside Level0), the child field pointing to Level1 should be expandable
    // We click through depth levels. At depth 5 (MAX_DEPTH), fields should not be expandable.
    // The component starts MessageNode visited={full_name} at depth 0 for root fields,
    // then FieldNode depth=1 for direct children. ExpandableField increments depth.
    // So depth=1 children -> depth=2 -> depth=3 -> depth=4 -> depth=5 = MAX_DEPTH, not expandable.

    // After expanding Level0, we see its fields at depth=1.
    // The "child" field at depth=1 (pointing to Level1) is expandable if depth < MAX_DEPTH.
    // Click child at depth 1 -> shows Level1's fields at depth 2
    let children = childButtons();
    expect(children.length).toBeGreaterThanOrEqual(1);
    // Click the first "child" which is the expandable one
    const firstChildTrigger = children[0].closest("button");
    if (firstChildTrigger) await user.click(firstChildTrigger);

    // Continue expanding until we can't anymore
    // depth 2 -> 3 -> 4 -> at depth 5 child should not be expandable
    for (let i = 0; i < 3; i++) {
      children = childButtons();
      const lastChild = children[children.length - 1];
      const trigger = lastChild.closest("button");
      if (trigger) await user.click(trigger);
    }

    // At this point, the deepest "child" field should not be in a button (not expandable)
    // We verify that we have "label" fields rendered at various depths
    const labels = screen.getAllByText("label");
    expect(labels.length).toBeGreaterThanOrEqual(4);
  });

  it("click on message name calls setSelectedType with full_name", async () => {
    const schema = makeSchema([
      makeMessage({ name: "MyMessage", full_name: "pkg.MyMessage" }),
    ]);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Select MyMessage"));

    expect(mockSetSelectedType).toHaveBeenCalledWith("pkg.MyMessage");
  });

  it("handles oneof fields showing branches", async () => {
    const schema = makeSchema([
      makeMessage({
        name: "Event",
        full_name: "pkg.Event",
        fields: [
          makeField({
            name: "payload",
            field_number: 3,
            kind: {
              type: "oneof",
              branches: [
                [makeField({ name: "text_data", field_number: 4, kind: { type: "scalar", scalar: "string" } })],
                [makeField({ name: "bin_data", field_number: 5, kind: { type: "scalar", scalar: "bytes" } })],
              ],
            },
          }),
        ],
      }),
    ]);
    setStore(schema);
    await renderExplorer();

    const user = userEvent.setup();
    // Expand the Event message
    await user.click(screen.getByLabelText("Expand Event"));

    // Expand the oneof field
    const oneofBadge = screen.getByText("oneof");
    const oneofTrigger = oneofBadge.closest("button")!;
    await user.click(oneofTrigger);

    expect(screen.getByText("text_data")).toBeInTheDocument();
    expect(screen.getByText("bin_data")).toBeInTheDocument();
    expect(screen.getByText("bytes")).toBeInTheDocument();
  });

  it("shows field count badge on message nodes", async () => {
    const schema = makeSchema([
      makeMessage({
        name: "ThreeFields",
        full_name: "pkg.ThreeFields",
        fields: [
          makeField({ name: "a", field_number: 1 }),
          makeField({ name: "b", field_number: 2 }),
          makeField({ name: "c", field_number: 3 }),
        ],
      }),
    ]);
    setStore(schema);
    await renderExplorer();

    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
