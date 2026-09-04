import type { FieldKind, FieldSchema, MessageSchema } from "@/lib/types";

/**
 * Short type name for a message full_name, e.g. "example.order.Address" → "Address".
 */
function shortName(fullName: string): string {
  return fullName.split(".").pop() ?? fullName;
}

/**
 * Human-readable type label for a bare `FieldKind` — no field wrapper, no field number.
 * Recurses for `map` so a map's value side (itself a `FieldKind`, not a `FieldSchema`) gets
 * the same labeling rules, including a map-of-map.
 */
function kindLabel(kind: FieldKind): string {
  switch (kind.type) {
    case "scalar":
      return kind.scalar;
    case "enum":
      return "enum";
    case "message":
      return shortName(kind.full_name);
    case "oneof":
      return "oneof";
    case "well_known":
      return kind.wkt;
    case "map":
      return `map<${kind.key_type}, ${kindLabel(kind.value_kind)}>`;
    default:
      return "unknown";
  }
}

/**
 * Human-readable type label for a field's kind — no field number, no cardinality.
 * Used standalone (oneof branch header) and composed into `fieldMeta` (label row).
 */
export function typeLabel(field: FieldSchema): string {
  return kindLabel(field.kind);
}

/**
 * `${typeLabel} · ${field_number}` — the mono meta string shown next to a field's label.
 * Omits the " · N" suffix when field_number is 0 (synthetic fields — oneof groups — carry no number).
 */
export function fieldMeta(field: FieldSchema): string {
  const label = typeLabel(field);
  return field.field_number > 0 ? `${label} · ${field.field_number}` : label;
}

/**
 * A message is "flat" when every field is a non-repeated scalar (including bytes) or enum,
 * and there are between 1 and 5 fields. Flat messages render as a RepeatedTable when repeated;
 * everything else falls back to stacked containers.
 */
export function isFlatMessage(message: MessageSchema): boolean {
  const { fields } = message;
  if (fields.length < 1 || fields.length > 5) return false;
  return fields.every(
    (f) => !f.repeated && (f.kind.type === "scalar" || f.kind.type === "enum")
  );
}

/** One-line summary of a nested message's current values — shown when its container is collapsed. */
export function summarizeValues(values: unknown): string {
  if (values === null || values === undefined || typeof values !== "object") {
    return "empty";
  }
  const entries = Object.entries(values as Record<string, unknown>);
  if (entries.length === 0) return "empty";

  const parts = entries.map(([, value]) => {
    if (Array.isArray(value)) return `[${value.length}]`;
    if (value !== null && typeof value === "object") return "{…}";
    return String(value);
  });
  return parts.join(", ");
}

/** Grid track width for one flat-message field in a RepeatedTable row: string gets more room, bool less. */
function trackWidth(field: FieldSchema): string {
  if (field.kind.type === "scalar" && field.kind.scalar === "string") return "3fr";
  if (field.kind.type === "scalar" && field.kind.scalar === "bool") return "1fr";
  return "2fr";
}

/**
 * `grid-template-columns` for a RepeatedTable: a 28px index column, one track per field
 * (string fields get more room, bool fields less), then a 28px trailing column for the trash button.
 */
export function tableColumns(message: MessageSchema): string {
  return ["28px", ...message.fields.map(trackWidth), "28px"].join(" ");
}

/**
 * `grid-template-columns` for a NestedMessageField's children grid: up to 5 tracks, one per field.
 * The first track is wider (2fr vs 1fr) when the first field is a string — matches the Address
 * example in the design handoff (`2fr 1fr 1fr 1fr 1fr`).
 */
export function containerColumns(message: MessageSchema): string {
  const fields = message.fields.slice(0, 5);
  const firstIsString =
    fields[0]?.kind.type === "scalar" && fields[0].kind.scalar === "string";
  return fields.map((_, i) => (i === 0 && firstIsString ? "2fr" : "1fr")).join(" ");
}
