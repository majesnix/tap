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
  field_number: number;
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

export interface EnumSchema {
  name: string;
  full_name: string;
  values: EnumValue[];
}

export interface ProtoSchema {
  messages: MessageSchema[];
  message_map: Record<string, MessageSchema>;
  enums: EnumSchema[];
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
  correlationId: string | null;
  timestamp: number | null;        // milliseconds since epoch (client receipt time); null = not set
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

// ── Phase 19: Plan library types ──────────────────────────────────────────────

/**
 * Publish target for a plan step. Discriminated union on `kind`.
 * Phase 22 exhaustive-switches on `kind`. (D-03)
 */
export type PublishTarget =
  | { kind: 'queue'; queue: string }
  | { kind: 'exchange'; exchange: string; routing_key: string };

/**
 * Response mode for a plan step. Discriminated union on `mode`.
 * Default values: delay_ms: 200, timeout_ms: 10000. (D-04)
 * Phase 22 exhaustive-switches on `mode`.
 */
export type ResponseMode =
  | { mode: 'no-wait'; delay_ms: number }
  | { mode: 'correlation-id'; reply_queue: string; timeout_ms: number }
  | { mode: 'first-arrival'; reply_queue: string; timeout_ms: number };

/**
 * Runtime execution status for a plan step.
 * Defined in Phase 19 for type contract stability; consumed by Phase 22's
 * usePlanExecutionStore (which is NOT implemented in Phase 19). (D-08)
 */
export type StepStatus = 'pending' | 'sending' | 'waiting-response' | 'done' | 'error';

/**
 * A single step within a Plan. All fields are defined now (Phase 19) to avoid
 * a schema_version bump mid-milestone when Phase 21 (Step Editor) and Phase 22
 * (Runner) use them. (D-01, D-02)
 *
 * field_values: serialized JSON string — mirrors Block.content: string from
 * useBlockStore. Never stored as Record<string, unknown>: undefined→null coercion
 * in JSON.stringify can silently corrupt saved plans. Consumers parse on use. (D-12)
 *
 * NOTE: PlanStep does NOT have schema_version — versioning lives on Plan only. (D-06)
 */
export interface PlanStep {
  id: string;            // crypto.randomUUID() at creation time
  name: string;          // user-defined step label
  proto_path: string;    // absolute path to the .proto file
  message_type: string;  // fully-qualified message type name
  /**
   * Serialized JSON string (not Record<string, unknown>).
   * Mirrors Block.content: string. Parse at use-time only.
   */
  field_values: string;
  target: PublishTarget;
  response_mode: ResponseMode;
}

/**
 * A saved plan containing an ordered list of steps.
 * schema_version starts at 1. Migration logic is written when the first
 * schema change happens — no migration stubs now. (D-05, D-06, D-07)
 */
export interface Plan {
  id: string;             // crypto.randomUUID() at creation time
  name: string;           // user-defined plan name
  schema_version: number; // starts at 1; incremented only when Plan shape changes
  steps: PlanStep[];
  /**
   * When true (or absent), the runner stops on the first step that returns
   * status 'error'. When false, the runner continues to the next step.
   * Absence is treated as true for backward compatibility — old plans without
   * this field behave as stop_on_error = true. See isPlan() in usePlanStore. (D-07)
   */
  stop_on_error?: boolean;
}

/** Current schema version constant. Bump only when Plan shape changes. (D-07) */
export const PLAN_SCHEMA_VERSION = 1 as const;

// ── Phase 22: Plan runner types ───────────────────────────────────────────────

/**
 * Decoded reply message received in response to a plan step.
 * Q4 resolved: decoded via pool_state using step.message_type (same type as request).
 * decoded is null when protobuf decode failed — this is not a step error. (D-03)
 */
export interface ReplyMessage {
  routingKey: string;
  exchange: string;
  contentType: string | null;
  correlationId: string | null;
  /** Decoded protobuf payload; null when decode failed (not a step error). */
  decoded: Record<string, unknown> | null;
  /** step.message_type on decode success; null on failure. */
  decodedAs: string | null;
  hexString: string;
}

/**
 * Terminal result of a single plan step execution.
 * status is 'done' | 'error' — the two terminal states the runner cares about.
 * reply is null for no-wait steps or when no reply was received. (D-02)
 */
export interface StepResult {
  stepId: string;
  status: 'done' | 'error';
  /** Decoded reply message; null for no-wait mode or when no reply arrived. */
  reply: ReplyMessage | null;
  /** Error description when status is 'error'; null when status is 'done'. */
  error: string | null;
}
