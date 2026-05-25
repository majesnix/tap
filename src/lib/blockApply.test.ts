import { describe, it, expect } from "vitest";
import { buildApplyPlan } from "@/lib/blockApply";
import type { FieldSchema, ScalarKind } from "@/lib/types";

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeScalarField(name: string, scalar: ScalarKind = "string"): FieldSchema {
  return {
    name,
    label: name,
    kind: { type: "scalar", scalar },
    repeated: false,
  };
}

function makeEnumField(name: string): FieldSchema {
  return {
    name,
    label: name,
    kind: { type: "enum", values: [{ name: "OK", number: 0 }, { name: "ERR", number: 1 }] },
    repeated: false,
  };
}

function makeWktField(name: string, wkt: string = "Timestamp"): FieldSchema {
  return {
    name,
    label: name,
    kind: { type: "well_known", wkt },
    repeated: false,
  };
}

function makeMapField(name: string): FieldSchema {
  return {
    name,
    label: name,
    kind: {
      type: "map",
      key_type: "string",
      value_kind: { type: "scalar", scalar: "string" },
    },
    repeated: false,
  };
}

function makeMessageField(name: string): FieldSchema {
  return {
    name,
    label: name,
    kind: { type: "message", full_name: "com.Nested" },
    repeated: false,
  };
}

function makeOneofField(name: string, branchNames: string[]): FieldSchema {
  return {
    name,
    label: name,
    kind: {
      type: "oneof",
      branches: branchNames.map((b) => [makeScalarField(b)]),
    },
    repeated: false,
  };
}

// ── describe("buildApplyPlan") ────────────────────────────────────────────────

describe("buildApplyPlan", () => {
  it("fills scalar field when not dirty", () => {
    // Arrange
    const fields: FieldSchema[] = [makeScalarField("qty", "int32")];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { qty: 5 };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0]).toEqual({ fieldName: "qty", value: 5, kind: "scalar" });
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("fills enum field when not dirty", () => {
    // Arrange
    const fields: FieldSchema[] = [makeEnumField("status")];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { status: 1 };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0]).toEqual({ fieldName: "status", value: 1, kind: "enum" });
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("fills well_known field when not dirty (D-06)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeWktField("ts")];
    const formValues = { ts: null };
    const dirtyFields = {};
    const blockValues = { ts: "2026-01-01T00:00:00Z" };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0]).toEqual({
      fieldName: "ts",
      value: "2026-01-01T00:00:00Z",
      kind: "well_known",
    });
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("skips well_known field when dirty (D-06)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeWktField("ts")];
    const formValues = { ts: null };
    const dirtyFields = { ts: true };
    const blockValues = { ts: "2026-01-01T00:00:00Z" };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(0);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("fills map field when empty (BLK-EXT-02)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeMapField("labels")];
    const formValues = { labels: [] };
    const dirtyFields = {};
    const blockValues = { labels: [{ key: "env", value: "prod" }] };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0]).toEqual({
      fieldName: "labels",
      value: [{ key: "env", value: "prod" }],
      kind: "map",
    });
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("emits map_key_collision when all block rows collide", () => {
    // Arrange
    const fields: FieldSchema[] = [makeMapField("labels")];
    const formValues = { labels: [{ key: "existing", value: "v" }] };
    const dirtyFields = {};
    const blockValues = { labels: [{ key: "existing", value: "new" }] };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].kind).toBe("map_key_collision");
    expect((plan.conflicts[0] as any).collisionKey).toBe("existing");
    expect((plan.conflicts[0] as any).nonCollidingBlockRows).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("skips unknown block key silently", () => {
    // Arrange
    const fields: FieldSchema[] = [makeScalarField("name")];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { unknownField: "x" };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(0);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual(["unknownField"]);
  });

  it("skips message kind field (D-02 + BLK-EXT-FUTURE-02)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeMessageField("nested")];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { nested: { foo: "bar" } };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(0);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("separates unknown keys from message-kind keys in mixed block", () => {
    // Arrange — scalar field, message field, plus one key not in schema at all
    const fields: FieldSchema[] = [
      makeScalarField("qty", "int32"),
      makeMessageField("nested"),
    ];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { qty: 5, nested: { foo: "bar" }, extra: "unknown" };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0]).toEqual({ fieldName: "qty", value: 5, kind: "scalar" });
    expect(plan.unknownKeys).toEqual(["extra"]);
    expect(plan.conflicts).toEqual([]);
  });

  it("conflicts collects items when map or oneof fields have existing values (BLK-EXT-03/04)", () => {
    // Arrange — map field with a colliding key
    const fields: FieldSchema[] = [
      makeScalarField("name"),
      makeMapField("labels"),
    ];
    const formValues = { labels: [{ key: "env", value: "prod" }] };
    const dirtyFields = {};
    const blockValues = { name: "test", labels: [{ key: "env", value: "staging" }] };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(Array.isArray(plan.conflicts)).toBe(true);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("returns empty toApply and conflicts when blockValues is empty", () => {
    // Arrange
    const fields: FieldSchema[] = [makeScalarField("name")];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = {};

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(0);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  // ── Oneof tests (BLK-EXT-04, BLK-EXT-05, D-02, D-03) ────────────────────────

  it("fills oneof field when same branch and sub-fields not dirty (BLK-EXT-04)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeOneofField("payment", ["card_number", "bank_transfer"])];
    const formValues = { payment: { _selected: "card_number", card_number: "" } };
    const dirtyFields = {};
    const blockValues = { payment: { _selected: "card_number", card_number: "4111" } };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0].fieldName).toBe("payment.card_number");
    expect(plan.toApply[0].kind).toBe("oneof");
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("emits oneof_dirty_subfield conflict when same branch sub-field is dirty (BLK-EXT-04)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeOneofField("payment", ["card_number", "bank_transfer"])];
    const formValues = { payment: { _selected: "card_number", card_number: "existing" } };
    const dirtyFields = { payment: { card_number: true } };
    const blockValues = { payment: { _selected: "card_number", card_number: "4111" } };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].kind).toBe("oneof_dirty_subfield");
    expect(plan.conflicts[0].fieldName).toBe("payment");
    expect((plan.conflicts[0] as any).subFieldName).toBe("card_number");
    expect(plan.unknownKeys).toEqual([]);
  });

  it("emits oneof_branch_switch conflict when block targets different branch (BLK-EXT-05)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeOneofField("payment", ["card_number", "bank_transfer"])];
    const formValues = { payment: { _selected: "card_number", card_number: "old" } };
    const dirtyFields = {};
    const blockValues = { payment: { _selected: "bank_transfer", bank_transfer: "IBAN123" } };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].kind).toBe("oneof_branch_switch");
    expect((plan.conflicts[0] as any).currentBranch).toBe("card_number");
    expect((plan.conflicts[0] as any).blockBranch).toBe("bank_transfer");
    expect(plan.unknownKeys).toEqual([]);
  });

  it("silently skips oneof block value when _selected is absent (D-02)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeOneofField("payment", ["card_number"])];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { payment: { card_number: "4111" } }; // no _selected

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("silently skips oneof block value when branch name is unrecognized (D-02)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeOneofField("payment", ["card_number"])];
    const formValues = {};
    const dirtyFields = {};
    const blockValues = { payment: { _selected: "crypto_wallet", crypto_wallet: "0x..." } };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("emits map_key_collision conflicts for colliding keys; no toApply item; nonCollidingBlockRows carried (BLK-EXT-03)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeMapField("labels")];
    const formValues = { labels: [{ key: "env", value: "prod" }, { key: "region", value: "us" }] };
    const dirtyFields = {};
    const blockValues = { labels: [{ key: "env", value: "staging" }, { key: "team", value: "infra" }] };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toEqual([]); // no toApply item for "labels" — collision path suppresses it entirely
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].kind).toBe("map_key_collision");
    expect((plan.conflicts[0] as any).collisionKey).toBe("env");
    const nonColliding = (plan.conflicts[0] as any).nonCollidingBlockRows as Array<{ key: string; value: string }>;
    expect(nonColliding).toHaveLength(1);
    expect(nonColliding[0].key).toBe("team");
    // "team" is NOT in conflicts (only colliding keys produce ConflictItems)
    expect(plan.conflicts.filter((c) => (c as any).collisionKey === "team")).toHaveLength(0);
    expect(plan.unknownKeys).toEqual([]);
  });

  it("appends block rows to non-empty map when no keys collide (IN-02 — regression guard for CR-01)", () => {
    // Arrange: existing row that the block does NOT collide with
    const fields = [makeMapField("labels")];
    const formValues = { labels: [{ key: "env", value: "prod" }] };
    const dirtyFields = {};
    const blockValues = { labels: [{ key: "team", value: "infra" }] };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert: no conflicts, toApply carries the merged (existing + new) array
    expect(plan.conflicts).toEqual([]);
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0].value).toEqual([
      { key: "env", value: "prod" },
      { key: "team", value: "infra" },
    ]);
  });

  it("treats all sub-fields as dirty when whole oneof field is marked dirty (IN-03 — regression guard for WR-01)", () => {
    // Arrange: dirtyFields[payment] = true (boolean, not per-sub-field object)
    const fields = [makeOneofField("payment", ["card_number"])];
    const formValues = { payment: { _selected: "card_number", card_number: "existing" } };
    const dirtyFields: Record<string, unknown> = { payment: true }; // whole-field dirty
    const blockValues = { payment: { _selected: "card_number", card_number: "4111" } };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert: whole-field dirty — block must not overwrite any sub-field
    expect(plan.toApply).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });
});
