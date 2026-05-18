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
  | { type: "well_known"; wkt: "Timestamp" | "Duration" | string };

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

// ── Phase 4: Response queue reader types ─────────────────────────────────────

export interface ConsumeResult {
  empty: boolean;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
