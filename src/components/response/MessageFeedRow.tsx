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
  const formattedTimestamp = (() => {
    if (message.timestamp === null) return "—";
    const d = new Date(message.timestamp);
    const base = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${base}.${ms}`;
  })();

  const parts = [
    message.routingKey,
    message.exchange || null,
    message.contentType ?? "—",
    message.correlationId ? `corr:${message.correlationId.slice(0, 8)}` : null,
    formattedTimestamp,
    message.decodedAs ?? "[unknown]",
  ].filter(Boolean);
  const triggerText = parts.join(" • ");

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
