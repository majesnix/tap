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
  });

  it("skips map field when non-empty (Phase 26 conflict path)", () => {
    // Arrange
    const fields: FieldSchema[] = [makeMapField("labels")];
    const formValues = { labels: [{ key: "existing", value: "v" }] };
    const dirtyFields = {};
    const blockValues = { labels: [{ key: "env", value: "prod" }] };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.toApply).toHaveLength(0);
    expect(plan.conflicts).toEqual([]);
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
  });

  it("conflicts is always empty array in Phase 25", () => {
    // Arrange — any valid input
    const fields: FieldSchema[] = [
      makeScalarField("name"),
      makeEnumField("status"),
      makeWktField("ts"),
    ];
    const formValues = { ts: null };
    const dirtyFields = {};
    const blockValues = { name: "test", status: 0, ts: "2026-06-01T00:00:00Z" };

    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

    // Assert
    expect(plan.conflicts).toEqual([]);
    expect(Array.isArray(plan.conflicts)).toBe(true);
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
  });
});
