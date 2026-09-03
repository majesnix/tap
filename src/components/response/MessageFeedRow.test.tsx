import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Accordion } from "@/components/ui/accordion";
import { MessageFeedRow } from "./MessageFeedRow";
import type { FeedMessage } from "@/lib/types";

const MESSAGE: FeedMessage = {
  id: "msg-1",
  routingKey: "reply.key",
  exchange: "",
  contentType: "application/protobuf",
  correlationId: null,
  timestamp: null,
  receivedAt: new Date(2026, 8, 3, 14, 2, 11, 412).getTime(),
  decoded: { field: "value" },
  hexString: "deadbeef",
  error: null,
  decodedAs: "test.Msg",
};

describe("MessageFeedRow", () => {
  test("formats the collapsed row's time from receivedAt (client clock), not the null publisher timestamp", () => {
    render(
      <Accordion type="single" collapsible>
        <MessageFeedRow message={MESSAGE} />
      </Accordion>
    );
    expect(screen.getByRole("button")).toHaveTextContent("14:02:11.412");
  });
});
