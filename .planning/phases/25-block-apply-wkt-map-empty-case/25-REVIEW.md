---
phase: 25-block-apply-wkt-map-empty-case
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/blockApply.ts
  - src/lib/blockApply.test.ts
  - src/components/form/fields/MapField.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/__tests__/ProtoFormRenderer.test.tsx
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 25 introduces the two-phase block apply API (`buildPlan` + `commitApply`)
with eligibility extension to `well_known` and `map` kinds. The
`buildApplyPlan` pure function is well-tested and the wiring through
`ProtoFormRenderer`/`FormPanel` follows the documented plan.

Three correctness/robustness concerns deserve attention before this ships:

1. Block-supplied values for map fields are passed to RHF's `replace()` with
   no shape validation — a non-array map payload throws at runtime.
2. `onDragEnd` has no `try/catch` around `buildPlan` / `commitApply`, leaving
   exceptions from malformed blocks unhandled.
3. Scalar/enum/well_known block values are written to the form without type
   validation, silently corrupting form state until encoding fails downstream.

Six lower-severity items cover test coverage gaps, a duplicated 64-bit scalar
list, type-signature drift, and inconsistent enum defaults in map rows.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Map block value is not validated as an array before `replace()`

**File:** `src/lib/blockApply.ts:91-109`, `src/components/form/ProtoFormRenderer.tsx:178`
**Issue:** `buildApplyPlan` checks whether the *current form value* is a non-empty
array (line 104) but never validates that the *incoming block value* is an array.
A malformed block whose map payload is an object or scalar — e.g.
`{ "labels": { "env": "prod" } }` instead of
`{ "labels": [{ "key": "env", "value": "prod" }] }` — passes the eligibility
check and lands in `toApply`. `commitApply` then calls
`mapReplaceRegistry.current[item.fieldName]?.(item.value as unknown[])`. The
`as unknown[]` cast suppresses TypeScript; at runtime RHF's `useFieldArray.replace`
will attempt to iterate the value and throw `TypeError: value.map is not a function`
when it receives a plain object.

Because block content comes from a user-edited JSON string (FormPanel lines 65-72),
this path is reachable from the UI with any wrongly-typed block.

**Fix:**
```ts
// In buildApplyPlan, inside the field.kind.type === "map" branch:
if (field.kind.type === "map") {
  const current = formValues[key];
  if (Array.isArray(current) && current.length > 0) {
    continue; // non-empty: Phase 26 conflict path
  }
  if (!Array.isArray(value)) {
    continue; // invalid shape: silently skip in Phase 25
  }
}
```

### WR-02: `onDragEnd` has no error boundary around `buildPlan` / `commitApply`

**File:** `src/components/form/FormPanel.tsx:55-89`
**Issue:** The `useDndMonitor` `onDragEnd` handler calls
`applyBlockRef.current.buildPlan(blockValues)` and
`applyBlockRef.current.commitApply(plan)` without any `try/catch`. An exception
thrown by WR-01 (or any future schema bug) propagates out of the dnd event
handler unhandled. The user gets no feedback, and any `toApply` items committed
before the throw remain in form state without a corresponding completion toast.

**Fix:**
```ts
try {
  const plan = applyBlockRef.current.buildPlan(blockValues);
  applyBlockRef.current.commitApply(plan);
  // derive skipped...
  if (skipped.length > 0) {
    toast.warning(`${skipped.length} ${label} from block not in form: ${skipped.join(', ')}`);
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Block apply failed';
  toast.error(`Could not apply block: ${msg}`);
}
```

### WR-03: Scalar/enum/well_known block values written to RHF without type validation

**File:** `src/components/form/ProtoFormRenderer.tsx:181-186`
**Issue:** `commitApply` calls `methods.setValue(item.fieldName, item.value as ...)` for
scalar, enum, and well_known items. The `as` cast is a lie — no runtime guard is in
place. A block with `{ "qty": "not-a-number" }` for an `int32` field writes a string
into RHF state. The textbox displays the bad value; the form stays apparently valid;
the hex preview breaks asynchronously via the debounced encoding path with a generic
"Encoding failed" toast that gives no indication the source was the dropped block.

**Fix:** Add a lightweight `validateBlockValue` step in `buildApplyPlan` (or before
pushing to `toApply`) that skips values whose JavaScript type does not match the
field's scalar kind:

```ts
function valueMatchesScalar(value: unknown, scalar: ScalarKind): boolean {
  if (scalar === "bool") return typeof value === "boolean";
  if (scalar === "string" || scalar === "bytes") return typeof value === "string";
  if (["int64","uint64","sint64","fixed64","sfixed64"].includes(scalar))
    return typeof value === "string" || typeof value === "number";
  return typeof value === "number"; // int32 / float / double family
}
```

Silently skipping and including the field name in the skipped-keys toast gives the
user actionable feedback.

## Info

### IN-01: Dirty-protection test uses a weaker assertion than necessary

**File:** `src/components/form/__tests__/ProtoFormRenderer.test.tsx:175`
**Issue:** The test asserts `expect(...).not.toHaveValue('block value')` to confirm the
dirty field was not overwritten. This passes as long as the textbox holds *anything*
other than `'block value'` — including an empty string, which would represent silent
data loss. The stronger and correct assertion is positive.

**Fix:**
```ts
// Replace the final assertion with:
expect(screen.getByRole('textbox')).toHaveValue('user typed this');
```

### IN-02: 64-bit scalar set duplicated across multiple modules

**File:** `src/components/form/fields/MapField.tsx:64-72,75-79,87`,
`src/components/form/ProtoFormRenderer.tsx:69`
**Issue:** The sets `["int64","uint64","sint64","fixed64","sfixed64"]` and
`["uint64","fixed64"]` are hard-coded in at least four sites across two files.
Adding a new wide-integer scalar would require updating each site independently.

**Fix:** Extract to `src/lib/types.ts` (or a small `scalarUtils.ts`):
```ts
export const WIDE_INT_SCALARS: ReadonlySet<ScalarKind> = new Set([
  "int64", "uint64", "sint64", "fixed64", "sfixed64",
]);
export const UNSIGNED_WIDE_INT_SCALARS: ReadonlySet<ScalarKind> = new Set([
  "uint64", "fixed64",
]);
```

### IN-03: `dirtyFields` parameter type understates real RHF shape

**File:** `src/lib/blockApply.ts:80`
**Issue:** The signature declares `dirtyFields: Partial<Record<string, unknown>>`.
RHF's actual `formState.dirtyFields` is `Partial<{[K in keyof T]: ...}>` with nested
boolean/object values. The current lookup `dirtyFields[key]` works because any nested
truthy value also makes the top-level key truthy — but the declared type misleads future
readers who may try to do more precise dirty checks.

**Fix:** Add a JSDoc comment clarifying the contract:
```ts
/**
 * Top-level dirty-field map. For nested fields (map, repeated, message),
 * a truthy value at the top key (e.g. `labels: [{key: true}]`) is sufficient
 * to treat the field as dirty for block-apply purposes.
 */
dirtyFields: Partial<Record<string, unknown>>,
```
Or import and use RHF's `FieldNamesMarkedBoolean` alias for precision.

### IN-04: `skipped` derivation inlined at three call sites

**File:** `src/components/form/FormPanel.tsx:80-82`,
`src/components/form/__tests__/ProtoFormRenderer.test.tsx:120-122,138-140`
**Issue:** The "block key not in toApply and not in conflicts" filter is duplicated
at the FormPanel call site and at two test sites. Phase 26 will add real conflict
entries; every site would need updating.

**Fix:** Export a helper from `src/lib/blockApply.ts`:
```ts
export function deriveSkipped(
  blockValues: Record<string, unknown>,
  plan: ApplyPlan,
): string[] {
  const applied = new Set<string>([
    ...plan.toApply.map((i) => i.fieldName),
    ...plan.conflicts.map((i) => i.fieldName),
  ]);
  return Object.keys(blockValues).filter((k) => !applied.has(k));
}
```

### IN-05: Comment on `setValue` option is misleading

**File:** `src/components/form/ProtoFormRenderer.tsx:181-182`
**Issue:** The comment reads "setValue without shouldDirty so block-filled fields stay
non-dirty". No `shouldDirty: false` option is actually passed — RHF's default is already
`false`. The comment implies a deliberate opt-out when it is the default, which could
confuse a future maintainer who searches for where `shouldDirty: true` is set.

**Fix:** Rephrase the comment to clarify it is relying on the default:
```ts
// setValue default leaves shouldDirty as false — block-filled scalars/enums/wkt
// stay non-dirty and remain eligible on subsequent drags (contrast with map's
// replace(), which unconditionally marks dirty — see Pitfall note in MapField).
```

### IN-06: `defaultValueForKind` returns `null` for enum-valued map rows

**File:** `src/components/form/fields/MapField.tsx:84-92`
**Issue:** `defaultValueForKind` handles only `scalar` and falls through to `null` for
`enum`, `message`, and `well_known` kinds. A newly appended row in a `map<string, MyEnum>`
therefore has `value: null`, while the top-level default for a standalone enum field is
`field.kind.values[0].number` (`buildDefaultValues` line 82). This inconsistency is minor
now but will surface as encoding noise once Phase 26 exposes map data more visibly.

**Fix:**
```ts
function defaultValueForKind(kind: FieldKind): unknown {
  if (kind.type === "scalar") {
    if (kind.scalar === "bool") return false;
    if (["int64","uint64","sint64","fixed64","sfixed64"].includes(kind.scalar)) return "0";
    if (kind.scalar === "string" || kind.scalar === "bytes") return "";
    return 0;
  }
  if (kind.type === "enum") {
    return kind.values.length > 0 ? kind.values[0].number : 0;
  }
  return null;
}
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
