import { buildDefaultValues } from "@/components/form/ProtoFormRenderer";
import { ScalarField } from "@/components/form/fields/ScalarField";
import { EnumField } from "@/components/form/fields/EnumField";
import { NestedMessageField } from "@/components/form/fields/NestedMessageField";
import { OneofField } from "@/components/form/fields/OneofField";
import { BytesField } from "@/components/form/fields/BytesField";
import { MapField } from "@/components/form/fields/MapField";
import { WellKnownTypeField } from "@/components/form/fields/WellKnownTypeField";
import type { FieldSchema, MessageSchema } from "@/lib/types";

const MAX_DEPTH = 5;

// ── safeParseFieldValues ──────────────────────────────────────────────────────
// Never call JSON.parse directly on step.field_values — falls back to
// buildDefaultValues on any parse error or non-object result (T-21-07).
export function safeParseFieldValues(
  fieldValues: string,
  schema: MessageSchema | null
): Record<string, unknown> {
  if (!schema) return {};
  try {
    const parsed = JSON.parse(fieldValues);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // corrupt JSON — fall back to schema defaults
  }
  return buildDefaultValues(schema);
}

// ── renderField (mirrors ProtoFormRenderer dispatch switch) ───────────────────
export function renderField(
  field: FieldSchema,
  path: string,
  depth: number
): React.ReactNode {
  if (depth > MAX_DEPTH) {
    return (
      <div key={path} className="text-11 text-muted-foreground">
        (max depth reached)
      </div>
    );
  }

  // bytes fields bypass the switch (pre-dispatch, ProtoFormRenderer FROZEN pattern)
  if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
    return <BytesField key={path} field={field} path={path} />;
  }

  // map fields bypass the switch (pre-dispatch, ProtoFormRenderer FROZEN pattern)
  if (field.kind.type === "map") {
    return (
      <MapField
        key={path}
        field={field}
        path={path}
        depth={depth}
        renderValue={renderField}
      />
    );
  }

  switch (field.kind.type) {
    case "scalar":
      return <ScalarField key={path} field={field} path={path} />;

    case "message":
      return (
        <NestedMessageField
          key={path}
          field={field}
          path={path}
          depth={depth}
          renderChildField={renderField}
        />
      );

    case "enum":
      return <EnumField key={path} field={field} path={path} />;

    case "oneof":
      return (
        <OneofField
          key={path}
          field={field}
          path={path}
          depth={depth}
          renderBranchField={renderField}
        />
      );

    case "well_known":
      return <WellKnownTypeField key={path} field={field} path={path} />;

    default:
      return null;
  }
}

/** Top-level values that read as "not filled in": "", null, [] or 0. */
export function countEmptyValues(values: Record<string, unknown>): number {
  return Object.values(values).filter(
    (v) =>
      v === "" ||
      v === null ||
      v === undefined ||
      v === 0 ||
      (Array.isArray(v) && v.length === 0)
  ).length;
}
