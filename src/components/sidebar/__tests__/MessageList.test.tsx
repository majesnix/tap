import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageList } from "@/components/sidebar/MessageList";
import type { ProtoSchema, MessageSchema, EnumSchema } from "@/lib/types";

function msg(fullName: string, fieldCount: number): MessageSchema {
  return {
    name: fullName.split(".").pop() ?? fullName,
    full_name: fullName,
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      name: `f${i}`,
      label: "optional",
      field_number: i + 1,
      kind: { type: "scalar" as const, scalar: "string" as const },
      repeated: false,
    })),
  };
}

function makeSchema(messages: MessageSchema[], enums: EnumSchema[] = []): ProtoSchema {
  return {
    messages,
    message_map: Object.fromEntries(messages.map((m) => [m.full_name, m])),
    enums,
  };
}

describe("MessageList", () => {
  it("lists messages with field counts and enums with value counts, and selects on click", () => {
    const schema = makeSchema(
      [msg("pkg.Order", 6), msg("pkg.LineItem", 4)],
      [{ name: "OrderStatus", full_name: "pkg.OrderStatus", values: [{ name: "A", number: 0 }] }]
    );
    const onSelect = vi.fn();
    render(<MessageList schema={schema} selected="pkg.Order" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Order 6/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /LineItem 4/ }));
    expect(onSelect).toHaveBeenCalledWith("pkg.LineItem");
    expect(screen.getByText("Enums")).toBeInTheDocument();
    expect(screen.getByText("OrderStatus")).toBeInTheDocument();
  });

  it("does not render an Enums section when there are none", () => {
    const schema = makeSchema([msg("pkg.Order", 6)]);
    render(<MessageList schema={schema} selected={null} onSelect={vi.fn()} />);
    expect(screen.queryByText("Enums")).not.toBeInTheDocument();
  });

  it("marks the non-selected rows without aria-current true", () => {
    const schema = makeSchema([msg("pkg.Order", 6), msg("pkg.LineItem", 4)]);
    render(<MessageList schema={schema} selected="pkg.Order" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /LineItem 4/ })).toHaveAttribute(
      "aria-current",
      "false"
    );
  });
});
