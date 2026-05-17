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
