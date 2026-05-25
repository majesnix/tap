# Phase 25: Block Apply — WKT + Map Empty Case - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor `applyBlockRef` in `ProtoFormRenderer` to a two-phase plan/commit model (BLK-EXT-07), then extend the plan to cover WellKnownType fields (Timestamp, Duration, fallback WKTs) and empty map fields. The dirty-field guard already in place for scalars/enums applies uniformly to WKT fields. Empty map fields are replaced via `useFieldArray.replace()` (not `setValue`), accessed through a `mapReplaceRegistry` keyed by full field path.

Out of scope for Phase 25: conflict dialog UI, non-empty map conflict handling, oneof branch-switch. Those are Phase 26.

</domain>

<decisions>
## Implementation Decisions

### D-01: Plan/commit ref shape — object ref
`applyBlockRef` stays as a single `MutableRefObject`, but its payload type changes from a single function to an object:
```ts
applyBlockRef.current = { buildPlan, commitApply }
```
`FormPanel` calls `applyBlockRef.current.buildPlan(blockValues)` to get an `ApplyPlan`, then `applyBlockRef.current.commitApply(plan)` to write to the form. Single ref, no additional prop drilling.

### D-02: ApplyPlan shape — future-proofed now
```ts
type ApplyPlan = {
  toApply: ApplyItem[];
  conflicts: ConflictItem[];  // always [] in Phase 25; Phase 26 fills this
}

type ApplyItem = {
  fieldName: string;
  value: unknown;
  kind: 'scalar' | 'enum' | 'well_known' | 'map';
}

type ConflictItem = {
  fieldName: string;
  blockValue: unknown;
  currentValue: unknown;
  kind: 'scalar' | 'enum' | 'well_known' | 'map';
}
```
`FormPanel` checks `plan.conflicts.length > 0` before showing the Phase 26 dialog. In Phase 25 this is always false.

### D-03: buildApplyPlan — standalone pure function in src/lib/blockApply.ts
Extract to a new file `src/lib/blockApply.ts`. Function signature:
```ts
buildApplyPlan(
  fields: FieldSchema[],
  formValues: Record<string, unknown>,
  dirtyFields: Partial<Record<string, unknown>>,
  blockValues: Record<string, unknown>
): ApplyPlan
```
Pure — no form mutations, no side effects. Unit-tested in `src/lib/blockApply.test.ts` as part of Phase 25.

### D-04: blockApply.test.ts in Phase 25
Unit tests for `buildApplyPlan` are written in Phase 25 (not deferred to Phase 26). Tests cover: WKT empty fill, WKT dirty skip, map empty fill, scalar fill, unknown key skip.

### D-05: Map replace access — registry pattern with full path key
`ProtoFormRenderer` holds a `mapReplaceRegistry` (a plain object `Record<path, (rows: unknown[]) => void>`) as a `useRef`. Each `MapField` receives an `onRegisterReplace(path, replaceFn)` callback prop, calls it in a `useEffect` on mount with `useFieldArray`'s `replace` function, and calls `onRegisterReplace(path, null)` on unmount (or passes a no-op to clear). The registry key is the full field `path` string (e.g., `"myMapField"` for top-level; future nested maps use `"parent.myMapField"` with no interface change).

`commitApply` looks up `mapReplaceRegistry.current[item.fieldName]` for `kind === 'map'` items.

### D-06: WKT field eligibility — dirty-field guard is the only guard
WKT fields (`well_known` kind) are added to the eligible set in `buildApplyPlan`. Eligibility check is identical to existing scalar/enum logic:
- `dirtyFields[fieldName]` is truthy → skip (dirty protection)
- Otherwise → include in `toApply`

No separate "empty" check. Default WKT form value is `null` (from `buildDefaultValues`); non-dirty `null` WKT fields are eligible and get filled by block value.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Block Apply — Complex Field Types — BLK-EXT-01, BLK-EXT-02, BLK-EXT-07 define acceptance criteria for Phase 25

### Core files to read and extend
- `src/components/form/ProtoFormRenderer.tsx` — contains `applyBlockRef` wiring and `buildDefaultValues`; refactor the `applyBlockRef` useEffect to expose `{ buildPlan, commitApply }` object; add `mapReplaceRegistry` ref and `onRegisterReplace` wiring
- `src/components/form/FormPanel.tsx` — call site for `applyBlockRef`; update `onDragEnd` to call `buildPlan` then `commitApply`; check `plan.conflicts.length` (always 0 in Phase 25)
- `src/components/form/fields/MapField.tsx` — add `onRegisterReplace` prop; call it in `useEffect` with `useFieldArray`'s `replace` function

### New file
- `src/lib/blockApply.ts` — new standalone pure function `buildApplyPlan`; types `ApplyPlan`, `ApplyItem`, `ConflictItem`
- `src/lib/blockApply.test.ts` — unit tests for `buildApplyPlan`

### Type reference
- `src/lib/types.ts` — `FieldSchema`, `MessageSchema`, `FieldKind` — needed by `buildApplyPlan` parameter types

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `applyBlockRef.current` (ProtoFormRenderer ~line 150): existing function implementation becomes the basis for `buildApplyPlan` + `commitApply`; extract `eligibleFields` logic into `buildApplyPlan`
- `useFieldArray` in `MapField`: `replace()` function to be registered into `mapReplaceRegistry`
- `buildDefaultValues` (ProtoFormRenderer): documents that `well_known` fields default to `null` and `map` fields default to `[]`

### Established Patterns
- Dirty-field guard: `methods.formState.dirtyFields[key]` — truthy = skip (D-03, Phase 12); `shouldDirty: false` on all `setValue` calls so block-filled fields stay re-writable
- Ref wiring pattern: `useEffect(() => { if (ref) { ref.current = fn; } return () => { if (ref) ref.current = null; }; }, [ref, methods, message])` — already used for `resetRef` and current `applyBlockRef`
- `onValuesChange` callback prop style: established pattern for passing callbacks from FormPanel into ProtoFormRenderer

### Integration Points
- `FormPanel.tsx` `onDragEnd`: update from `const skipped = applyBlockRef.current(blockValues)` to `const plan = applyBlockRef.current.buildPlan(blockValues); applyBlockRef.current.commitApply(plan)`
- `FormPanel.tsx` `applyBlockRef` type: update from `((blockValues) => string[]) | null` to `{ buildPlan: ..., commitApply: ... } | null`
- `ProtoFormRenderer` → `MapField`: add `onRegisterReplace` to `MapFieldProps` and thread it through the `renderField` dispatch

</code_context>

<specifics>
## Specific Ideas

No specific references — standard approach confirmed via discussion.

</specifics>

<deferred>
## Deferred Ideas

- Phase 26: conflict dialog for non-empty map fields (BLK-EXT-03), oneof branch handling (BLK-EXT-04/05), batched conflict dialog (BLK-EXT-06) — all scoped to Phase 26
- Future: recursive nested-message merge from a block (BLK-EXT-FUTURE-02)
- Future: block apply in JSON mode (BLK-EXT-FUTURE-01)

</deferred>

---

*Phase: 25-Block Apply — WKT + Map Empty Case*
*Context gathered: 2026-05-25*
