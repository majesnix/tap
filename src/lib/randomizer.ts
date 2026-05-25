import type { FieldKind, MessageSchema, ScalarKind } from "./types";

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;

const RANDOM_STRING_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_STRING_LENGTH = 8;
const MAX_RECURSION_DEPTH = 5;
const MIN_COLLECTION_SIZE = 1;
const MAX_COLLECTION_SIZE = 3;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(): string {
  let result = "";
  for (let i = 0; i < RANDOM_STRING_LENGTH; i++) {
    result += RANDOM_STRING_CHARS[randomInt(0, RANDOM_STRING_CHARS.length - 1)];
  }
  return result;
}

function randomBytes(): string {
  const len = randomInt(4, 16);
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomScalar(scalar: ScalarKind): unknown {
  switch (scalar) {
    case "bool":
      return Math.random() > 0.5;
    case "string":
      return randomString();
    case "bytes":
      return randomBytes();
    case "int32":
    case "sint32":
    case "sfixed32":
      return randomInt(INT32_MIN, INT32_MAX);
    case "uint32":
    case "fixed32":
      return randomInt(0, UINT32_MAX);
    case "int64":
    case "sint64":
    case "sfixed64":
      return String(randomInt(-1000000, 1000000));
    case "uint64":
    case "fixed64":
      return String(randomInt(0, 1000000));
    case "float":
    case "double":
      return Math.round(Math.random() * 10000) / 100;
    default:
      return "";
  }
}

function randomWellKnown(wkt: string): string {
  if (wkt === "Timestamp") {
    const now = Date.now();
    const offset = randomInt(-86400000, 86400000);
    return new Date(now + offset).toISOString();
  }
  if (wkt === "Duration") {
    return `${randomInt(0, 3600)}s`;
  }
  return "";
}

function randomFieldValue(
  kind: FieldKind,
  messageMap: Record<string, MessageSchema>,
  depth: number
): unknown {
  switch (kind.type) {
    case "scalar":
      return randomScalar(kind.scalar);
    case "enum": {
      if (kind.values.length === 0) return 0;
      const idx = randomInt(0, kind.values.length - 1);
      return kind.values[idx].number;
    }
    case "well_known":
      return randomWellKnown(kind.wkt);
    case "message": {
      if (depth >= MAX_RECURSION_DEPTH) return {};
      const nestedSchema = messageMap[kind.full_name];
      if (!nestedSchema) return {};
      return generateRandomValuesInternal(nestedSchema, messageMap, depth + 1);
    }
    case "oneof": {
      const branchIdx = randomInt(0, kind.branches.length - 1);
      const branch = kind.branches[branchIdx];
      if (branch.length === 0) return { _selected: "" };
      const selectedField = branch[0];
      const value: Record<string, unknown> = { _selected: selectedField.name };
      for (const bf of branch) {
        value[bf.name] = randomFieldValue(bf.kind, messageMap, depth);
      }
      return value;
    }
    case "map": {
      const count = randomInt(MIN_COLLECTION_SIZE, MAX_COLLECTION_SIZE);
      const entries: Array<{ key: unknown; value: unknown }> = [];
      for (let i = 0; i < count; i++) {
        entries.push({
          key: randomScalar(kind.key_type),
          value: randomFieldValue(kind.value_kind, messageMap, depth),
        });
      }
      return entries;
    }
    default:
      return null;
  }
}

function generateRandomValuesInternal(
  message: MessageSchema,
  messageMap: Record<string, MessageSchema>,
  depth: number
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of message.fields) {
    if (field.repeated) {
      const count = randomInt(MIN_COLLECTION_SIZE, MAX_COLLECTION_SIZE);
      const items: unknown[] = [];
      for (let i = 0; i < count; i++) {
        items.push(randomFieldValue(field.kind, messageMap, depth));
      }
      values[field.name] = items;
    } else {
      values[field.name] = randomFieldValue(field.kind, messageMap, depth);
    }
  }
  return values;
}

export function generateRandomValues(
  message: MessageSchema,
  messageMap: Record<string, MessageSchema>,
  dirtyFields?: Record<string, boolean>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of message.fields) {
    if (dirtyFields?.[field.name]) continue;
    if (field.repeated) {
      const count = randomInt(MIN_COLLECTION_SIZE, MAX_COLLECTION_SIZE);
      const items: unknown[] = [];
      for (let i = 0; i < count; i++) {
        items.push(randomFieldValue(field.kind, messageMap, 0));
      }
      values[field.name] = items;
    } else {
      values[field.name] = randomFieldValue(field.kind, messageMap, 0);
    }
  }
  return values;
}
