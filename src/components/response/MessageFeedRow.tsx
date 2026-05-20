import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ResponseDecodedView } from "./ResponseDecodedView";
import { ResponseHexSection } from "./ResponseHexSection";
import type { FeedMessage } from "@/lib/types";

interface MessageFeedRowProps {
  message: FeedMessage;
}

/**
 * Single row in the message feed accordion.
 * Collapsed: compact single-line metadata (D-07, D-21).
 * Expanded: ResponseDecodedView + ResponseHexSection with per-row data (D-08).
 */
export function MessageFeedRow({ message }: MessageFeedRowProps) {
  const formattedTimestamp =
    message.timestamp !== null
      ? new Date(message.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : "—";

  const triggerText = [
    message.routingKey,
    message.exchange,
    message.contentType ?? "—",
    formattedTimestamp,
    message.decodedAs ?? "[unknown]",
  ].join(" • ");

  return (
    <AccordionItem value={message.id} className="border-b border-border">
      <AccordionTrigger className="px-4 py-2 text-xs font-mono hover:no-underline hover:bg-muted/50">
        {triggerText}
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <ResponseDecodedView decoded={message.decoded} error={message.error} />
        <ResponseHexSection hexString={message.hexString} decoded={message.decoded} />
      </AccordionContent>
    </AccordionItem>
  );
}
