---
phase: 26-block-apply-conflict-prompt-oneof
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/form/FormPanel.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/lib/blockApply.ts
  - src/lib/blockApply.test.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 26 adds conflict resolution for block drag-and-drop: a dialog prompts the user when a dragged block would overwrite an existing map key or oneof sub-field. The implementation is largely sound — the discriminated union types are clean, the two-phase `buildPlan`/`commitApply` split is correct, and the conflict dialog renders accurately per the UI spec.

One confirmed data-loss bug exists: the no-collision-but-non-empty map path in `buildApplyPlan` produces a `toApply` item that causes `replace()` to erase all existing rows. The collision path correctly merges; the no-collision path does not. Two warnings concern a defensive cast that silently disables dirty-protection for oneof fields, and a forward-reference in `useDndMonitor` that can break in future refactoring. Three info items cover type-safety gaps and missing test coverage.

---

## Critical Issues

### CR-01: Non-empty map with zero collisions silently replaces all existing rows (data loss)

**File:** `src/lib/blockApply.ts:215-222`

**Issue:** When a map field is non-empty (`current.length > 0`) but the block rows have no key collision with the existing rows (`collidingRows.length === 0`), execution falls through to line 222 and pushes a plain `toApply` item carrying the block's raw array as `value`. In `ProtoFormRenderer.tsx:181`, `commitApply` calls `mapReplaceRegistry.current[item.fieldName]?.(item.value)` — which is `useFieldArray.replace()`. This replaces the entire field contents with the block's array, silently dropping all existing rows.

The collision path (lines 195–213) was specifically fixed in commit `5db54e6` to *append* non-colliding block rows to existing rows. The zero-collision path is inconsistent and produces contradictory behavior: a block that happens to share one key triggers the dialog and preserves existing rows; a block with entirely new keys silently destroys them.

**Reachable scenario:** a map field is populated by HIST-02 replay or a JSON-mode round-trip (both use `form.reset()`, which does not set `dirtyFields[key]`), so the dirty guard on line 218 passes. The user drags a block whose keys do not collide — all existing rows are erased without warning.

**Fix:** When the map is non-empty and has zero collisions, emit a `toApply` item whose `value` is the merged array (existing rows + block rows), not the raw block array. Alternatively, treat this as a second non-colliding append path identical to the resolution in Phase B of `commitApply`:

```typescript
// blockApply.ts — after the `if (collidingRows.length > 0)` block (line 214)
// No collisions — fall through to push toApply as before
// FIXED: emit merged rows (existing + non-colliding block rows) to avoid replacing
if (nonCollidingRows.length === 0) {
  continue; // nothing to add
}
if (dirtyFields[key]) {
  continue;
}
const mergedValue = [
  ...(current as Array<Record<string, unknown>>),
  ...nonCollidingRows,
];
toApply.push({ fieldName: key, value: mergedValue, kind: "map" });
continue;
```

---

## Warnings

### WR-01: Unsafe cast on `dirtyFields[key]` for oneof silently disables dirty-protection

**File:** `src/lib/blockApply.ts:278`

**Issue:**

```typescript
const dirtyForField = (dirtyFields[key] as Record<string, unknown> | undefined) ?? {};
```

`dirtyFields` is typed as `Partial<Record<string, unknown>>`. For a oneof field, react-hook-form records per-sub-field dirty state as `{ card_number: true }`. But RHF can also mark the entire field as `true` (a boolean) when `reset()` is called with partial values or when `setDirty` is triggered at the top level. If `dirtyFields[key]` is `true` (a boolean), the cast to `Record<string, unknown>` succeeds at the TypeScript level but yields a boolean at runtime. Then `dirtyForField[subFieldName]` is `undefined` for every sub-field name (booleans have no string-indexed properties), so `isSubFieldDirty` is always `false`, and every sub-field is treated as clean — the dirty-protection silently fails and block values overwrite user edits.

**Fix:** Add a runtime type guard before using `dirtyForField`:

```typescript
const rawDirtyEntry = dirtyFields[key];
const dirtyForField: Record<string, unknown> =
  typeof rawDirtyEntry === "object" && rawDirtyEntry !== null
    ? (rawDirtyEntry as Record<string, unknown>)
    : {};
// If rawDirtyEntry === true (whole-field dirty), treat every sub-field as dirty
const wholeFieldDirty = rawDirtyEntry === true;
```

Then replace `const isSubFieldDirty = dirtyForField[subFieldName] === true;` with:

```typescript
const isSubFieldDirty = wholeFieldDirty || dirtyForField[subFieldName] === true;
```

---

### WR-02: `isJsonMode` read inside `useDndMonitor` before its declaration

**File:** `src/components/form/FormPanel.tsx:74`

**Issue:** `useDndMonitor` (line 72) captures `isJsonMode` in its `onDragEnd` closure. `isJsonMode` is declared via `useState` at line 109, well below the hook call. This works at runtime because the closure captures the state variable by reference in the render-function closure, not by hoisting — but it is a code-order violation. A developer extracting `useDndMonitor` to a custom hook, or adding a lint rule that enforces hook call order, will silently break the guard without a compile error. The `isJsonMode` check exists specifically to prevent block drops while in JSON mode; breaking it means a block drag can trigger `applyBlockRef.current.buildPlan` on unmounted `ProtoFormRenderer` state.

**Fix:** Move the `useState` declarations for `isJsonMode`, `entrySnapshot`, `jsonDraft`, and `parseError` (lines 109–112) above the `useDndMonitor` call (currently line 72), and add a brief comment explaining the ordering requirement.

---

## Info

### IN-01: `subFieldName` optional type does not match guaranteed usage at `oneof_dirty_subfield` callsite

**File:** `src/components/form/ProtoFormRenderer.tsx:256`

**Issue:**

```typescript
const dottedPath = `${item.fieldName}.${item.subFieldName}` as Parameters<typeof methods.setValue>[0];
```

`ConflictItem.subFieldName` is typed `string | undefined`. The discriminant `item.kind === "oneof_dirty_subfield"` is checked at line 253, but TypeScript does not narrow optional fields based on `kind` in a plain union — `item.subFieldName` remains `string | undefined`. If a malformed plan were constructed with `kind: "oneof_dirty_subfield"` but no `subFieldName`, the path becomes `"field.undefined"` and silently writes to the wrong form key. Consider narrowing the type so `subFieldName` is required when `kind === "oneof_dirty_subfield"` (a discriminated union per `kind`).

**Fix:** Refactor `ConflictItem` into a proper discriminated union:

```typescript
export type ConflictItem =
  | { kind: "map_key_collision"; fieldName: string; collisionKey: string; blockValue: unknown; currentValue: unknown; nonCollidingBlockRows: unknown[]; fieldLabel?: string }
  | { kind: "oneof_dirty_subfield"; fieldName: string; subFieldName: string; subFieldLabel?: string; blockValue: unknown; currentValue: unknown; fieldLabel?: string }
  | { kind: "oneof_branch_switch"; fieldName: string; currentBranch: string; blockBranch: string; blockValue: unknown; currentValue: unknown; fieldLabel?: string };
```

---

### IN-02: Test suite missing coverage for the non-empty, zero-collision map path

**File:** `src/lib/blockApply.test.ts`

**Issue:** There is no test that exercises the map path where the form has existing rows and the block has only non-colliding keys (the scenario that triggers CR-01). The existing "fills map field when empty" test covers `current.length === 0`; "emits map_key_collision" covers the collision branch. The gap means the regression introduced in CR-01 was not caught before ship.

**Fix:** Add a test:

```typescript
it("appends block rows to non-empty map when no keys collide", () => {
  const fields = [makeMapField("labels")];
  const formValues = { labels: [{ key: "env", value: "prod" }] };
  const dirtyFields = {};
  const blockValues = { labels: [{ key: "team", value: "infra" }] };

  const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

  expect(plan.conflicts).toEqual([]);
  expect(plan.toApply).toHaveLength(1);
  // value should contain both existing and new rows
  expect(plan.toApply[0].value).toEqual([
    { key: "env", value: "prod" },
    { key: "team", value: "infra" },
  ]);
});
```

---

### IN-03: No test for whole-field-dirty oneof (the WR-01 scenario)

**File:** `src/lib/blockApply.test.ts`

**Issue:** There is no test where `dirtyFields[oneofKey] === true` (boolean, whole-field dirty). Without a test, the WR-01 regression would be invisible. The existing "emits oneof_dirty_subfield" test only covers `dirtyFields = { payment: { card_number: true } }` (per-sub-field shape).

**Fix:** Add a test:

```typescript
it("treats all sub-fields as dirty when whole oneof field is marked dirty (WR-01 guard)", () => {
  const fields = [makeOneofField("payment", ["card_number"])];
  const formValues = { payment: { _selected: "card_number", card_number: "existing" } };
  const dirtyFields: Record<string, unknown> = { payment: true }; // whole-field dirty
  const blockValues = { payment: { _selected: "card_number", card_number: "4111" } };

  const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

  // Whole-field dirty — block should not overwrite
  expect(plan.toApply).toEqual([]);
});
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
