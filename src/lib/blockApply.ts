import type { FieldSchema } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Discriminated union of field kinds eligible for block apply. */
export type ApplyItemKind = "scalar" | "enum" | "well_known" | "map";

/** A single field-value pair that the commit phase will write to the form. */
export type ApplyItem = {
  fieldName: string;
  value: unknown;
  kind: ApplyItemKind;
};

/**
 * A field where the block value conflicts with an existing non-empty form value.
 * Always empty in Phase 25 — Phase 26 fills this for non-empty map fields.
 */
export type ConflictItem = {
  fieldName: string;
  blockValue: unknown;
  currentValue: unknown;
  kind: ApplyItemKind;
};

/**
 * The output of buildApplyPlan — items to apply, items in conflict, and keys
 * with no matching field in the schema at all.
 *
 * `unknownKeys` holds block keys that do not correspond to any field in the
 * schema (regardless of kind). Keys that exist in the schema but are ineligible
 * (e.g. 'message' kind) are silently skipped and do NOT appear in unknownKeys.
 */
export type ApplyPlan = {
  toApply: ApplyItem[];
  conflicts: ConflictItem[];
  unknownKeys: string[];
};

/**
 * Ref payload type wired between FormPanel (caller) and ProtoFormRenderer (owner).
 * ProtoFormRenderer sets `applyBlockRef.current` to this object in a useEffect;
 * FormPanel calls `buildPlan` then `commitApply` on every block drag-and-drop.
 *
 * Exported for use in ProtoFormRenderer.tsx and FormPanel.tsx (plan 25-02).
 */
export type ApplyBlockRef = {
  buildPlan: (blockValues: Record<string, unknown>) => ApplyPlan;
  commitApply: (plan: ApplyPlan) => void;
};

// ── Eligible kinds ────────────────────────────────────────────────────────────

/**
 * Field kinds eligible for block apply.
 *
 * 'message' is intentionally excluded — shallow setValue on message objects is
 * deprecated in Phase 25. Proper nested-message merge is deferred to Phase 26
 * (BLK-EXT-FUTURE-02). Message-kind keys in a block are silently skipped.
 */
const ELIGIBLE_KINDS: ReadonlySet<FieldSchema["kind"]["type"]> = new Set([
  "scalar",
  "enum",
  "well_known",
  "map",
] as const);

// ── Pure function ─────────────────────────────────────────────────────────────

/**
 * Determines which block values should be applied to the form and which are in
 * conflict with existing form values.
 *
 * Rules (Phase 25):
 * - Only fields with kinds in ELIGIBLE_KINDS are considered.
 * - If a field is dirty (user has edited it), it is skipped — not overwritten.
 * - Map fields are only applied when the current form value is an empty array
 *   (`[]` or `undefined`/`null`). Non-empty maps are silently skipped in Phase 25;
 *   Phase 26 will surface them as ConflictItems.
 * - Block keys with no matching field in the schema are collected in `unknownKeys`.
 * - Block keys that exist in the schema but are ineligible (e.g. 'message' kind)
 *   are silently skipped and do NOT appear in `unknownKeys`.
 * - `conflicts` is always `[]` in Phase 25.
 *
 * Pure — no form mutations, no side effects, no React imports.
 */
export function buildApplyPlan(
  fields: FieldSchema[],
  formValues: Record<string, unknown>,
  dirtyFields: Partial<Record<string, unknown>>,
  blockValues: Record<string, unknown>
): ApplyPlan {
  // Map over ALL fields (all kinds) — used to detect truly unknown keys
  const allFields = new Map(fields.map((f) => [f.name, f]));

  const eligibleFields = new Map(
    fields
      .filter((f) => ELIGIBLE_KINDS.has(f.kind.type))
      .map((f) => [f.name, f])
  );

  const toApply: ApplyItem[] = [];
  const unknownKeys: string[] = [];

  for (const [key, value] of Object.entries(blockValues)) {
    if (!allFields.has(key)) {
      // Key has no matching field in schema at all — surface to caller
      unknownKeys.push(key);
      continue;
    }
    const field = eligibleFields.get(key);
    if (!field) {
      // Field exists in schema but is ineligible kind (e.g. 'message') — silent skip
      continue;
    }
    if (dirtyFields[key]) {
      // Dirty protection — field already touched by user; do not overwrite
      continue;
    }
    if (field.kind.type === "map") {
      const current = formValues[key];
      // Non-empty map → Phase 26 conflict handling; Phase 25 skips silently
      if (Array.isArray(current) && current.length > 0) {
        continue;
      }
    }
    toApply.push({ fieldName: key, value, kind: field.kind.type as ApplyItemKind });
  }

  return { toApply, conflicts: [], unknownKeys };
}
