import type { FieldSchema } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Discriminated union of field kinds eligible for block apply. */
export type ApplyItemKind = "scalar" | "enum" | "well_known" | "map" | "oneof";

/** A single field-value pair that the commit phase will write to the form. */
export type ApplyItem = {
  fieldName: string;
  value: unknown;
  kind: ApplyItemKind;
};

/**
 * Discriminated union for the kind of conflict.
 * - map_key_collision: a block map row's key already exists in the form
 * - oneof_dirty_subfield: same branch, but the sub-field is dirty (user-edited)
 * - oneof_branch_switch: block targets a different branch than the current selection
 */
export type ConflictItemKind =
  | "map_key_collision"
  | "oneof_dirty_subfield"
  | "oneof_branch_switch";

/**
 * A field where the block value conflicts with an existing non-empty form value.
 * Phase 26 populates this for non-empty map key collisions and oneof conflicts.
 *
 * Optional fields are kind-specific:
 * - subFieldName: oneof_dirty_subfield only
 * - currentBranch, blockBranch: oneof_branch_switch only
 * - collisionKey, nonCollidingBlockRows: map_key_collision only
 * - fieldLabel, subFieldLabel: UI rendering hints
 */
export type ConflictItem = {
  fieldName: string;
  blockValue: unknown;
  currentValue: unknown;
  kind: ConflictItemKind;
  /** oneof_dirty_subfield: the sub-field name that is dirty */
  subFieldName?: string;
  /** oneof_branch_switch: the branch currently selected in the form */
  currentBranch?: string;
  /** oneof_branch_switch: the branch targeted by the block */
  blockBranch?: string;
  /** map_key_collision: the map key that collides */
  collisionKey?: string;
  /**
   * map_key_collision: block rows that did NOT collide with existing keys.
   * Carried so commitApply Phase B can append them atomically after resolving
   * the collision. Same array reference on every ConflictItem for this field.
   */
  nonCollidingBlockRows?: unknown[];
  /** Display label for the field row in the conflict dialog UI. */
  fieldLabel?: string;
  /** Display label for the sub-field in oneof_dirty_subfield rows. */
  subFieldLabel?: string;
};

/**
 * User choices for resolving conflicts — keyed by a compound key:
 * - map:             `{fieldName}:{collisionKey}`
 * - dirty-subfield:  `{fieldName}:{subFieldName}`
 * - branch-switch:   bare `{fieldName}`
 */
export type ConflictChoices = Record<string, "skip" | "overwrite">;

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
  commitApply: (plan: ApplyPlan, choices?: ConflictChoices) => void;
};

// ── Eligible kinds ────────────────────────────────────────────────────────────

/**
 * Field kinds eligible for block apply.
 *
 * 'message' is intentionally excluded — shallow setValue on message objects is
 * deprecated in Phase 25. Proper nested-message merge is deferred to Phase 26
 * (BLK-EXT-FUTURE-02). Message-kind keys in a block are silently skipped.
 *
 * Phase 26 adds 'oneof': oneof block values with { _selected, branchName: value }
 * shape enter the processing loop for same-branch fill and branch-switch detection.
 */
const ELIGIBLE_KINDS: ReadonlySet<FieldSchema["kind"]["type"]> = new Set([
  "scalar",
  "enum",
  "well_known",
  "map",
  "oneof",
] as const);

// ── Pure function ─────────────────────────────────────────────────────────────

/**
 * Determines which block values should be applied to the form and which are in
 * conflict with existing form values.
 *
 * Rules (Phase 26):
 * - Only fields with kinds in ELIGIBLE_KINDS are considered.
 * - If a field is dirty (user has edited it), it is skipped — not overwritten
 *   (except oneof, which uses per-sub-field dirty checks).
 * - Map fields with zero collisions: toApply item emitted as before.
 * - Map fields with ANY collision: NO toApply item is emitted. All data flows
 *   through conflicts as map_key_collision ConflictItems (one per colliding key).
 *   nonCollidingBlockRows is carried on each ConflictItem so commitApply Phase B
 *   can append them atomically after the user resolves the collision.
 * - Oneof fields (D-01, D-02, D-03):
 *   - REQUIRED shape: { _selected: "branchName", branchName: value }
 *   - Absent _selected or unrecognized branch → silent skip (NOT in unknownKeys)
 *   - Same branch + clean sub-fields → toApply with kind 'oneof', dotted fieldName
 *   - Same branch + dirty sub-field → oneof_dirty_subfield ConflictItem
 *   - Different branch → oneof_branch_switch ConflictItem
 * - Block keys with no matching field in the schema are collected in `unknownKeys`.
 * - Block keys that exist in the schema but are ineligible (e.g. 'message' kind)
 *   are silently skipped and do NOT appear in `unknownKeys`.
 *
 * Note: shouldDirty: false is a concern of commitApply (ProtoFormRenderer.tsx),
 * NOT this pure function. No form mutations, no side effects, no React imports.
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
  const conflicts: ConflictItem[] = [];
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

    // ── Map field: per-key collision detection ────────────────────────────────
    if (field.kind.type === "map") {
      const current = formValues[key];
      if (Array.isArray(current) && current.length > 0) {
        // Non-empty map — detect collisions per key
        const blockRows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
        const existingKeys = new Set(
          (current as Array<{ key: unknown }>).map((r) => String(r.key))
        );

        const collidingRows: Array<Record<string, unknown>> = [];
        const nonCollidingRows: Array<Record<string, unknown>> = [];

        for (const row of blockRows) {
          if (existingKeys.has(String(row.key))) {
            collidingRows.push(row);
          } else {
            nonCollidingRows.push(row);
          }
        }

        if (collidingRows.length > 0) {
          // ANY collision: suppress toApply for this field entirely.
          // Emit one ConflictItem per colliding row. nonCollidingBlockRows is the
          // same array reference on every item (commitApply reads it from conflicts[0]).
          for (const collidingRow of collidingRows) {
            const existingRow = (current as Array<{ key: unknown; value: unknown }>).find(
              (r) => String(r.key) === String(collidingRow.key)
            );
            conflicts.push({
              fieldName: key,
              kind: "map_key_collision",
              collisionKey: String(collidingRow.key),
              blockValue: collidingRow,
              currentValue: existingRow ?? null,
              nonCollidingBlockRows: nonCollidingRows,
              fieldLabel: field.label ?? key,
            });
          }
          continue; // no toApply item for this field
        }
        // No collisions — fall through to push toApply as before
      }

      if (dirtyFields[key]) {
        // Dirty protection for non-collision map path
        continue;
      }
      toApply.push({ fieldName: key, value, kind: "map" });
      continue;
    }

    // ── Oneof field ───────────────────────────────────────────────────────────
    if (field.kind.type === "oneof") {
      // Block value must be an object with a _selected discriminator (D-01)
      if (typeof value !== "object" || value === null) {
        continue; // silent skip
      }
      const blockObj = value as Record<string, unknown>;
      const blockBranch = blockObj["_selected"];

      if (typeof blockBranch !== "string" || blockBranch === "") {
        // _selected absent or not a string → silent skip (D-02)
        continue;
      }

      // Validate _selected against known branch names (branch[0].name per OneofField convention)
      const knownBranches = field.kind.branches;
      const matchedBranch = knownBranches.find(
        (branch) => branch[0]?.name === blockBranch
      );
      if (!matchedBranch) {
        // Unrecognized branch → silent skip (D-02), NOT in unknownKeys
        continue;
      }

      // Read current selected branch from form values
      const currentFormValue = formValues[key];
      const currentSelectedBranch =
        typeof currentFormValue === "object" &&
        currentFormValue !== null &&
        "_selected" in currentFormValue
          ? String((currentFormValue as Record<string, unknown>)["_selected"])
          : undefined;

      // Branch-switch: current branch is set and differs from block branch (BLK-EXT-05)
      if (
        currentSelectedBranch !== undefined &&
        currentSelectedBranch !== "" &&
        currentSelectedBranch !== blockBranch
      ) {
        conflicts.push({
          fieldName: key,
          kind: "oneof_branch_switch",
          currentBranch: currentSelectedBranch,
          blockBranch,
          blockValue: value,
          currentValue: currentFormValue,
          fieldLabel: field.label ?? key,
        });
        continue;
      }

      // Same branch (or no current branch yet): process sub-fields (BLK-EXT-04)
      const dirtyForField = (dirtyFields[key] as Record<string, unknown> | undefined) ?? {};

      for (const [subFieldName, subValue] of Object.entries(blockObj)) {
        if (subFieldName === "_selected") continue; // skip discriminator key

        const isSubFieldDirty = dirtyForField[subFieldName] === true;

        if (isSubFieldDirty) {
          // Dirty sub-field → conflict
          const currentSubValue =
            typeof currentFormValue === "object" && currentFormValue !== null
              ? (currentFormValue as Record<string, unknown>)[subFieldName]
              : undefined;
          conflicts.push({
            fieldName: key,
            kind: "oneof_dirty_subfield",
            subFieldName,
            blockValue: subValue,
            currentValue: currentSubValue,
            fieldLabel: field.label ?? key,
            subFieldLabel: subFieldName,
          });
        } else {
          // Clean sub-field → toApply with dotted path
          toApply.push({
            fieldName: `${key}.${subFieldName}`,
            value: subValue,
            kind: "oneof",
          });
        }
      }
      continue;
    }

    // ── Scalar / enum / well_known ────────────────────────────────────────────
    if (dirtyFields[key]) {
      // Dirty protection — field already touched by user; do not overwrite
      continue;
    }
    toApply.push({ fieldName: key, value, kind: field.kind.type as ApplyItemKind });
  }

  return { toApply, conflicts, unknownKeys };
}
