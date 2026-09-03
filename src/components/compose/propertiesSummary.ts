import { INITIAL_PROPERTIES, type AmqpProperties } from "@/stores/useAmqpStore";

/** One chunk of the destination strip's properties line; `mono` parts are values. */
export interface SummaryPart {
  text: string;
  mono?: boolean;
}

function isUntouched(p: AmqpProperties): boolean {
  return (
    p.contentType === INITIAL_PROPERTIES.contentType &&
    p.deliveryMode === INITIAL_PROPERTIES.deliveryMode &&
    p.ttl === null &&
    p.correlationId === null &&
    p.replyTo === null &&
    p.headers.length === 0
  );
}

/**
 * A one-line description of the AMQP properties that will ride along with the next send.
 * Rendered joined by " · "; "defaults" when the user has changed nothing.
 */
export function summarizeProperties(p: AmqpProperties): SummaryPart[] {
  if (isUntouched(p)) return [{ text: "defaults" }];

  const parts: SummaryPart[] = [];

  if (p.contentType && p.contentType !== INITIAL_PROPERTIES.contentType) {
    parts.push({ text: p.contentType, mono: true });
  }

  parts.push({ text: p.deliveryMode === 2 ? "persistent" : "transient" });

  if (p.ttl !== null) parts.push({ text: `ttl ${p.ttl} ms` });

  if (p.correlationId) {
    parts.push({ text: "corr" }, { text: p.correlationId, mono: true });
  }

  if (p.replyTo) {
    parts.push({ text: "reply-to" }, { text: p.replyTo, mono: true });
  }

  if (p.headers.length > 0) {
    parts.push({ text: `${p.headers.length} header${p.headers.length === 1 ? "" : "s"}` });
  }

  return parts;
}
