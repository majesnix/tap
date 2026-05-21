import type React from "react";

export type ScalarKind =
  | "bool"
  | "string"
  | "bytes"
  | "int32"
  | "int64"
  | "uint32"
  | "uint64"
  | "sint32"
  | "sint64"
  | "fixed32"
  | "fixed64"
  | "sfixed32"
  | "sfixed64"
  | "float"
  | "double";

export type FieldKind =
  | { type: "scalar"; scalar: ScalarKind }
  | { type: "message"; full_name: string }
  | { type: "enum"; values: EnumValue[] }
  | { type: "oneof"; branches: FieldSchema[][] }
  | { type: "well_known"; wkt: "Timestamp" | "Duration" | string }
  | { type: "map"; key_type: ScalarKind; value_kind: FieldKind };

export interface EnumValue {
  name: string;
  number: number;
}

export interface FieldSchema {
  name: string;
  label: string;
  kind: FieldKind;
  repeated: boolean;
  oneof_group?: string;
  default_value?: unknown;
}

export interface MessageSchema {
  name: string;
  full_name: string;
  fields: FieldSchema[];
}

export interface ProtoSchema {
  messages: MessageSchema[];
  message_map: Record<string, MessageSchema>;
}

/**
 * Function signature for rendering a single field in the form tree.
 * Passed as a prop to avoid circular import issues between field components.
 */
export type RenderFieldFn = (
  field: FieldSchema,
  path: string,
  depth: number
) => React.ReactNode;

// ── Phase 2: Connection types ────────────────────────────────────────────────

/**
 * Non-secret connection profile. Password is stored in the OS keychain
 * by the Rust backend only — never included here.
 */
export interface ConnectionProfile {
  name: string;
  host: string;
  port: number;        // default 5672
  vhost: string;       // default "/"
  username: string;
  management_port: number; // default 15672
  management_ssl: boolean; // default false — set true to use HTTPS for Management API
}

export type ConnectionStatus = "connected" | "error" | "disconnected";
export type ManagementStatus = "live" | "manual" | "unknown";

// ── Phase 14: Live subscribe status ──────────────────────────────────────────

export type SubscribeStatus = "Idle" | "Running" | "Stopping" | "Error";

// ── Phase 4: Response queue reader types ─────────────────────────────────────

export interface ConsumeResult {
  empty: boolean;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}

// ── Phase 13: Message feed + drain types ─────────────────────────────────────

/**
 * Per-message result from drain_messages Rust command.
 * decodedAs: winning type name from the candidate list (D-19), null if no candidate succeeded.
 * isTerminal: true when the consumer has self-terminated (e.g., broker closed the session).
 *   The frontend uses this to transition subscribeStatus back to "Idle" (CR-02).
 */
export interface DrainResult {
  routingKey: string;
  exchange: string;
  contentType: string | null;
  timestamp: number | null;        // seconds since epoch; null if publisher did not set it
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
  decodedAs: string | null;        // D-19: first type name that decoded successfully
  isTerminal: boolean;             // CR-02: true signals consumer self-terminated; frontend sets Idle
}

/**
 * Wrapper returned by drain_messages (D-18).
 * partialError is set when basic_get errors mid-loop; messages contains already-acked results.
 */
export interface DrainOutcome {
  messages: DrainResult[];
  partialError: string | null;
}

/**
 * Feed message with stable ID for Accordion key and FIFO-500 store (D-16, D-17, D-21).
 * id is generated at append time via crypto.randomUUID() — never from server (RESEARCH Pitfall 2).
 */
export interface FeedMessage {
  id: string;                      // crypto.randomUUID() at append time
  routingKey: string;
  exchange: string;
  contentType: string | null;
  timestamp: number | null;        // seconds since epoch; null = not set by publisher
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
  decodedAs: string | null;        // D-21: winning type name shown in collapsed metadata row
}

// ── Phase 9: Routing key autocomplete types ───────────────────────────────────

/**
 * Exchange summary returned by the updated fetch_exchanges Rust command.
 * exchange_type values are lowercase per RabbitMQ Management API convention:
 * "direct" | "fanout" | "topic" | "headers"
 */
export interface ExchangeSummary {
  name: string;
  exchange_type: string;
}

// ── Phase 10: Publisher confirms outcome ──────────────────────────────────────

/**
 * Delivery outcome returned by publish_message Rust command.
 * D-02: Flat interface with status as a string literal union.
 * Values match Rust PublishOutcome.status field exactly.
 */
export interface PublishOutcome {
  status: "ack" | "nack" | "returned" | "timeout";
}
