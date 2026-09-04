/** Where a message is published: straight to a queue, or through an exchange. */
export type TargetMode = "queue" | "exchange";

/**
 * Compute the exchange + routingKey args for publish_message IPC.
 *
 * PUBL-01 (queue mode): exchange = "" (AMQP default exchange), routingKey = queue name.
 *   exchange MUST be empty string — NOT "amq.default" or "default".
 * PUBL-02 (exchange mode): exchange = named exchange, routingKey = explicit routing key.
 */
export function buildPublishArgs(
  mode: TargetMode,
  selectedQueue: string,
  selectedExchange: string,
  routingKey: string
): { exchange: string; routingKey: string } {
  if (mode === "queue") {
    return { exchange: "", routingKey: selectedQueue };
  }
  return { exchange: selectedExchange, routingKey };
}

/**
 * Discriminate a Management API 401 from plain unavailability.
 *
 * AppError::ManagementApiAuthFailed serializes to
 * "Management API authentication failed: wrong credentials (HTTP 401)"; a closed port or a
 * missing plugin says something else entirely and falls back to manual entry silently.
 */
export function isAuthError(message: string): boolean {
  return message.includes("authentication failed");
}

/** Exchange types that ignore the routing key altogether. */
export function isHintExchange(type: string): boolean {
  return type === "headers" || type === "fanout";
}

/** D-06: why the routing key does not matter for this exchange, or null when it does. */
export function routingKeyHint(type: string): string | null {
  if (type === "fanout") return "Routing key is ignored for fanout exchanges.";
  if (type === "headers") return "Headers exchanges route by message headers, not routing key.";
  return null;
}
