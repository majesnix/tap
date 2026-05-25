# Phase 25: Block Apply — WKT + Map Empty Case - Research

**Researched:** 2026-05-25
**Domain:** React Hook Form — useFieldArray, setValue, dirtyFields; TypeScript refactor of applyBlockRef
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Plan/commit ref shape — object ref**
`applyBlockRef` stays as a single `MutableRefObject`, but its payload type changes from a single function to an object:
```ts
applyBlockRef.current = { buildPlan, commitApply }
```
`FormPanel` calls `applyBlockRef.current.buildPlan(blockValues)` to get an `ApplyPlan`, then `applyBlockRef.current.commitApply(plan)` to write to the form.

**D-02: ApplyPlan shape — future-proofed now**
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

**D-03: buildApplyPlan — standalone pure function in src/lib/blockApply.ts**
Signature:
```ts
buildApplyPlan(
  fields: FieldSchema[],
  formValues: Record<string, unknown>,
  dirtyFields: Partial<Record<string, unknown>>,
  blockValues: Record<string, unknown>
): ApplyPlan
```
Pure — no form mutations.

**D-04: blockApply.test.ts in Phase 25**
Tests cover: WKT empty fill, WKT dirty skip, map empty fill, scalar fill, unknown key skip.

**D-05: Map replace access — registry pattern**
`ProtoFormRenderer` holds `mapReplaceRegistry` as `useRef<Record<string, ((rows: unknown[]) => void) | null>>`. Each `MapField` receives `onRegisterReplace(path, replaceFn)`, calls it in `useEffect` on mount with `replace`, and on unmount calls `onRegisterReplace(path, null)`. `commitApply` looks up `mapReplaceRegistry.current[item.fieldName]` for `kind === 'map'` items.

**D-06: WKT field eligibility — dirty-field guard is the only guard**
`well_known` fields added to eligible set. No separate empty check. Dirty protection is the only gate.

### Claude's Discretion

None specified.

### Deferred Ideas (OUT OF SCOPE)

- Phase 26: conflict dialog (BLK-EXT-03), oneof (BLK-EXT-04/05), batched dialog (BLK-EXT-06)
- Future: recursive nested-message merge (BLK-EXT-FUTURE-02)
- Future: block apply in JSON mode (BLK-EXT-FUTURE-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLK-EXT-01 | User can apply a block to a WellKnownType field when empty; dirty-field guard respected | D-06: eligibility via dirty guard only; WKT default is `null` per `buildDefaultValues`; `setValue(key, value)` with `shouldDirty: false` default covers this |
| BLK-EXT-02 | User can apply a block to a map field when the form map is currently empty via `useFieldArray.replace()` | D-05: registry pattern; `replace()` verified in installed RHF — no shouldDirty option (see Pitfall 1 below) |
| BLK-EXT-07 | `applyBlockRef` refactored to two-phase plan/commit model | D-01 through D-06 define the full shape; `buildApplyPlan` extracted to `src/lib/blockApply.ts` |
</phase_requirements>

---

## Summary

Phase 25 is a focused code refactor with a well-specified design (D-01 through D-06 in CONTEXT.md). There is no ecosystem selection to do — the standard stack is already locked. The primary research value is API verification of react-hook-form internals that the plan depends on.

The most significant finding is the behavior of `useFieldArray.replace()` regarding dirty state. The installed version of react-hook-form (7.76.1, the current latest) confirms via its type definitions that `replace()` accepts no options — no `shouldDirty: false` override is possible. This is a known unresolved issue in the RHF ecosystem (GitHub discussions #8223 and #8309, issue #8968 marked "duplicated"). **The consequence for Phase 25 is that calling `replace()` will mark the map field as dirty, which means a subsequent block drop will see `dirtyFields[mapField]` as truthy and skip that field.** The phase plan must account for this behavior — the options are: (a) accept this as the intended behavior for Phase 25 (a replaced map field is protected from re-replacement on a second drag), or (b) use `setValue` with the array value instead of `replace()`.

The `setValue` default `shouldDirty: false` is confirmed by the installed type definitions (`SetValueConfig = Partial<{ shouldValidate, shouldDirty, shouldTouch }>`, all optional, none default to true). This means all `setValue` calls in `commitApply` for scalar/enum/well_known items will not mark fields dirty, matching the existing behavior in the current `applyBlockRef`.

**Primary recommendation:** Implement the plan/commit refactor as specified in D-01 through D-06. Treat `replace()` marking the field dirty as acceptable behavior for Phase 25 (empty map filled by block becomes "touched" and protected from subsequent block drops). Document this in the plan as the explicit choice.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dirty-guard logic + plan building | Frontend (pure lib) | — | `buildApplyPlan` is a pure function; no side effects; lives in `src/lib/` |
| Form write (setValue / replace) | Frontend (React component) | — | `commitApply` must run inside the `useForm` context; wired via ref from ProtoFormRenderer |
| Map replace access | Frontend (React component) | — | `useFieldArray.replace` is a React hook return value; must be accessed in component scope, passed out via registry |
| Block drop orchestration | Frontend (FormPanel) | — | Already established: `useDndMonitor.onDragEnd` calls the ref |
| Type definitions (ApplyPlan etc.) | Frontend (lib) | — | Lives in `src/lib/blockApply.ts`, imported by both ProtoFormRenderer and FormPanel |

---

## Standard Stack

No new packages are installed in this phase. The phase uses exclusively existing dependencies.

| Library | Installed Version | Purpose | Source |
|---------|-----------------|---------|--------|
| `react-hook-form` | 7.76.1 | Form state, `useFieldArray`, `setValue`, `dirtyFields` | [VERIFIED: npm registry + local node_modules] |
| `vitest` | 4.1.7 | Unit testing for `buildApplyPlan` | [VERIFIED: package.json] |
| `@testing-library/react` | 16.3.2 | React component testing (if needed) | [VERIFIED: package.json] |

**Installation:** None required.

---

## Package Legitimacy Audit

No new packages installed in this phase. Slopcheck not run — no new dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
FormPanel.onDragEnd
  │
  ├─ parse block JSON
  │
  ├─→ applyBlockRef.current.buildPlan(blockValues)
  │       │
  │       └─ buildApplyPlan(fields, formValues, dirtyFields, blockValues)
  │               ├─ for each blockValues key:
  │               │   ├─ not in eligible fields → skip silently
  │               │   ├─ dirtyFields[key] truthy → skip (protect dirty)
  │               │   └─ else → toApply item (kind: scalar|enum|well_known|map)
  │               └─ returns ApplyPlan { toApply, conflicts: [] }
  │
  ├─ check plan.conflicts.length (always 0 in Phase 25 → no dialog)
  │
  └─→ applyBlockRef.current.commitApply(plan)
          │
          ├─ for each toApply item:
          │   ├─ kind 'map' → mapReplaceRegistry.current[fieldName]?.(rows)
          │   └─ kind scalar|enum|well_known → methods.setValue(fieldName, value)
          │                                    (shouldDirty defaults false)
          └─ returns void

MapField (mount)
  │
  └─→ onRegisterReplace(path, replace)  ← useEffect, registers replace fn
MapField (unmount)
  └─→ onRegisterReplace(path, null)     ← cleanup
```

### Recommended Project Structure

No structural changes to the project layout. New files:

```
src/
├── lib/
│   ├── blockApply.ts        # NEW — buildApplyPlan, ApplyPlan, ApplyItem, ConflictItem types
│   └── blockApply.test.ts   # NEW — unit tests for buildApplyPlan
└── components/form/
    ├── ProtoFormRenderer.tsx  # MODIFIED — ref type, mapReplaceRegistry, onRegisterReplace wiring
    ├── FormPanel.tsx          # MODIFIED — applyBlockRef type, onDragEnd call pattern
    └── fields/
        └── MapField.tsx       # MODIFIED — add onRegisterReplace prop + useEffect
```

### Pattern 1: Plan/Commit Ref (D-01)

**What:** Replace the single-function ref with an object ref containing `buildPlan` and `commitApply`.

**When to use:** Any time FormPanel needs to split read-then-write on the form.

```typescript
// Source: CONTEXT.md D-01 (locked decision); existing ref wiring pattern in ProtoFormRenderer lines 134-145

// OLD (ProtoFormRenderer)
applyBlockRef.current = (blockValues: Record<string, unknown>): string[] => { ... };

// NEW (ProtoFormRenderer)
applyBlockRef.current = {
  buildPlan: (blockValues: Record<string, unknown>): ApplyPlan =>
    buildApplyPlan(message.fields, methods.getValues(), methods.formState.dirtyFields, blockValues),
  commitApply: (plan: ApplyPlan): void => {
    for (const item of plan.toApply) {
      if (item.kind === 'map') {
        mapReplaceRegistry.current[item.fieldName]?.(item.value as unknown[]);
      } else {
        methods.setValue(
          item.fieldName,
          item.value as Parameters<typeof methods.setValue>[1],
          // shouldDirty defaults to false — block-filled fields stay re-writable
        );
      }
    }
  },
};

// OLD (FormPanel.onDragEnd)
const skipped = applyBlockRef.current(blockValues);

// NEW (FormPanel.onDragEnd)
const plan = applyBlockRef.current.buildPlan(blockValues);
// In Phase 25 plan.conflicts is always []; Phase 26 checks conflicts.length
applyBlockRef.current.commitApply(plan);
```

### Pattern 2: MapField Registry (D-05)

**What:** `MapField` registers its `replace` function into a parent-owned registry so `commitApply` can call it without prop-drilling through the render tree.

**When to use:** Any case where a React hook return value needs to be called from outside the component.

```typescript
// Source: CONTEXT.md D-05 (locked decision)

// ProtoFormRenderer — add ref
const mapReplaceRegistry = useRef<Record<string, ((rows: unknown[]) => void) | null>>({});

// ProtoFormRenderer — add callback (stable reference via useCallback)
const handleRegisterReplace = useCallback(
  (path: string, fn: ((rows: unknown[]) => void) | null) => {
    mapReplaceRegistry.current[path] = fn;
  },
  [] // stable — mapReplaceRegistry ref never changes
);

// MapField — add prop and useEffect
interface MapFieldProps {
  // ... existing ...
  onRegisterReplace?: (path: string, fn: ((rows: unknown[]) => void) | null) => void;
}

// In MapField:
const { fields, append, remove, replace } = useFieldArray({ control, name: path });

useEffect(() => {
  onRegisterReplace?.(path, replace);
  return () => { onRegisterReplace?.(path, null); };
}, [path, replace, onRegisterReplace]);

// ProtoFormRenderer renderField dispatch — pass prop to MapField:
<MapField
  key={path}
  field={field}
  path={path}
  depth={depth}
  renderValue={renderField}
  onRegisterReplace={handleRegisterReplace}
/>
```

### Pattern 3: buildApplyPlan Pure Function (D-03)

**What:** Extract eligibility logic from `applyBlockRef.current` into a standalone pure function.

> **NOTE — OQ-1:** The code below implements the locked D-02 shape (`ApplyPlan = { toApply, conflicts }`
> with no `skipped` field). If OQ-1 resolves to option (a) — adding `skipped: string[]` to
> `ApplyPlan` — the type and return value must be extended. See Open Question OQ-1 below.

```typescript
// Source: CONTEXT.md D-02, D-03 (locked decisions); existing logic at ProtoFormRenderer lines 151-174

// src/lib/blockApply.ts
import type { FieldSchema } from './types';

export type ApplyItemKind = 'scalar' | 'enum' | 'well_known' | 'map';

export type ApplyItem = {
  fieldName: string;
  value: unknown;
  kind: ApplyItemKind;
};

export type ConflictItem = {
  fieldName: string;
  blockValue: unknown;
  currentValue: unknown;
  kind: ApplyItemKind;
};

// D-02 locked shape — no skipped field; see OQ-1 if skipped tracking is needed
export type ApplyPlan = {
  toApply: ApplyItem[];
  conflicts: ConflictItem[];
};

// NOTE — OQ-4: Existing applyBlockRef eligible set includes 'message' (ProtoFormRenderer lines 153-161).
// D-02 ApplyItemKind drops 'message'. Confirm whether this is intentional before implementing.
const ELIGIBLE_KINDS: ReadonlySet<FieldSchema['kind']['type']> = new Set([
  'scalar', 'enum', 'well_known', 'map',
]);

export function buildApplyPlan(
  fields: FieldSchema[],
  formValues: Record<string, unknown>,
  dirtyFields: Partial<Record<string, unknown>>,
  blockValues: Record<string, unknown>,
): ApplyPlan {
  const eligibleFields = new Map(
    fields
      .filter(f => ELIGIBLE_KINDS.has(f.kind.type))
      .map(f => [f.name, f])
  );

  const toApply: ApplyItem[] = [];
  const conflicts: ConflictItem[] = [];

  for (const [key, value] of Object.entries(blockValues)) {
    const field = eligibleFields.get(key);
    if (!field) {
      // Unknown key or ineligible kind — skip silently
      continue;
    }
    if (dirtyFields[key]) {
      // Dirty protection — field already touched by user; do not overwrite
      continue;
    }
    // Phase 25: map fields only enter toApply when empty
    if (field.kind.type === 'map') {
      const current = formValues[key];
      if (Array.isArray(current) && current.length > 0) {
        // Non-empty map → Phase 26 conflict handling; Phase 25 skips
        continue;
      }
    }
    toApply.push({ fieldName: key, value, kind: field.kind.type as ApplyItemKind });
  }

  return { toApply, conflicts };
}
```

### Anti-Patterns to Avoid

- **Calling `replace()` with `shouldDirty: false`:** This option does not exist on `replace()` in RHF 7.76.1. No workaround is available. Calling `replace()` will mark `isDirty` true on the field array. This is acceptable for Phase 25.
- **Using `setValue` for map array values (instead of `replace`):** CONTEXT.md D-05 and existing `STATE.md` Pitfall B explicitly flag this. `setValue` on a `useFieldArray`-managed path may not refresh row IDs, causing stale keys and React reconciliation issues. Use `replace()` via the registry.
- **Calling `replace()` from outside the `useFieldArray` owner component directly:** The `replace` function is a closure; it must be extracted from inside `MapField` where `useFieldArray` is called, then registered into the parent's registry.
- **Mutating `applyBlockRef.current` shape outside the ProtoFormRenderer `useEffect`:** The existing cleanup pattern (`return () => { ref.current = null; }`) must be preserved.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map row id generation | Custom UUID for rows | `useFieldArray.replace()` | RHF generates stable `id` keys; custom IDs break RHF's internal reconciliation |
| Dirty state tracking | Manual dirty flag | `methods.formState.dirtyFields` | RHF tracks dirty state per field; hand-rolled tracking diverges |
| Form value snapshot | Capture values manually | `methods.getValues()` | Synchronous snapshot of all current values; safe to call in event handlers |

---

## Runtime State Inventory

Not applicable — this is a pure code refactor with no stored data, OS-registered state, or external service configuration. No runtime state inventory needed.

**Nothing found in any category:** None — verified by codebase inspection. This phase modifies only TypeScript/React source files.

---

## Common Pitfalls

### Pitfall 1: `replace()` marks the map field dirty (CRITICAL — verify before finalizing plan)

**What goes wrong:** After `commitApply` calls `mapReplaceRegistry.current[fieldName](rows)`, the map field's `dirtyFields[fieldName]` becomes truthy. A second block drag onto the same form will see the field as dirty and skip it.

**Why it happens:** `UseFieldArrayReplace` (confirmed in installed RHF 7.76.1 type definitions at `node_modules/react-hook-form/dist/types/fieldArray.d.ts:183`) has signature `(value: FieldArray | FieldArray[]) => void` — no options parameter. All field array actions mark the form dirty. GitHub discussions #8223 and #8309 document this as a known limitation; issue #8968 ("Add options to useFieldArray functions") was marked "duplicated" without a resolution shipping a `shouldDirty` option.

**How to avoid:** Phase 25 accepts this behavior. A block-filled map is treated as "user-touched" after the first apply. Document explicitly in the plan task.

**Warning signs:** If the planner generates a task asserting that a second block drag re-fills a map field, that task is incorrect — the dirty guard will block it.

### Pitfall 2: WKT Controller `defaultValue=""` vs form state `null`

**What goes wrong:** `WellKnownTypeField.tsx` sets `defaultValue=""` on all three Controller variants (lines 54, 72, 108). `buildDefaultValues` sets `well_known: null`. If `buildApplyPlan` compares `formValues[key] === null` to determine "empty", this is reliable — the form state holds the `useForm` defaultValues, not the Controller fallback. The Controller `defaultValue` is only used when RHF has no registered value for the path.

**Why it happens:** The Controller `defaultValue` prop is a fallback for unregistered fields, not an override of `useForm` defaultValues. With `buildDefaultValues` setting `null`, an untouched WKT field's form state is `null`, not `""`.

**How to avoid:** D-06 says no empty check for WKT — dirty guard only. `buildApplyPlan` does not need to inspect `formValues` for WKT fields at all; it only checks `dirtyFields[key]`.

**Warning signs:** Any code checking `formValues[key] === ""` for WKT eligibility is wrong for Phase 25.

### Pitfall 3: `shouldDirty: false` omitted on `setValue` in `commitApply`

**What goes wrong:** The `SetValueConfig.shouldDirty` option defaults to `false` in RHF 7.76.1 (confirmed at `node_modules/react-hook-form/dist/types/form.d.ts:40-44`). Omitting it is safe. However, if future code adds `{ shouldDirty: true }`, block-applied scalar/enum/WKT fields become dirty and are skipped on the next drag.

**Why it happens:** `SetValueConfig = Partial<{ shouldValidate: boolean; shouldDirty: boolean; shouldTouch: boolean }>` — all optional, all default false.

**How to avoid:** Do not pass `{ shouldDirty: true }` to `setValue` in `commitApply`. A comment in the code explaining the default is valuable.

### Pitfall 4: `dirtyFields` access pattern for nested fields

**What goes wrong:** `formState.dirtyFields` is typed `Partial<Readonly<FieldNamesMarkedBoolean<TFieldValues>>>` — a deep nested map. For top-level fields `dirtyFields['myField']` returns `true | undefined`. For nested fields like `oneof` branches, it returns a nested object.

**Why it happens:** `FieldNamesMarkedBoolean` is `DeepMap<DeepPartial<TFieldValues>, boolean>` — every leaf is `boolean`, every intermediate is a nested object.

**How to avoid:** `buildApplyPlan` receives `dirtyFields: Partial<Record<string, unknown>>` — it only checks `dirtyFields[key]` (top-level truthiness check), which is correct for Phase 25 because all eligible fields (scalar, enum, well_known, map) are top-level. WKT and map fields do not have nested dirty state that needs walking.

### Pitfall 5: `onRegisterReplace` prop change causing infinite re-registration

**What goes wrong:** If `onRegisterReplace` is an inline arrow function in `renderField`, it recreates on every render, causing `MapField`'s `useEffect` to re-fire constantly.

**Why it happens:** `renderField` is a function defined in the component body — new reference on every render.

**How to avoid:** Wrap `handleRegisterReplace` in `useCallback` with stable dependencies (the `mapReplaceRegistry` ref never changes). Pass `handleRegisterReplace` — not an inline lambda — to `MapField`.

### Pitfall 6: Type change in two locations must be synchronized

**What goes wrong:** `applyBlockRef` type is declared in two places — `ProtoFormRendererProps` (lines 38-40) and `FormPanel.tsx` `useRef` declaration (lines 50-52). Updating only one causes a TypeScript error.

**Why it happens:** The ref is declared in `FormPanel` and passed to `ProtoFormRenderer` as a prop. Both sides must use the same type.

**How to avoid:** Define the `ApplyBlockRef` type in `src/lib/blockApply.ts` (alongside `ApplyPlan`) and import it in both files.

---

## Code Examples

### Verified: `replace()` type signature (no options)

```typescript
// Source: node_modules/react-hook-form/dist/types/fieldArray.d.ts:183
// RHF 7.76.1 — installed version
export type UseFieldArrayReplace<
  TFieldValues extends FieldValues,
  TFieldArrayName extends FieldArrayPath<TFieldValues> = FieldArrayPath<TFieldValues>
> = (
  value: FieldArray<TFieldValues, TFieldArrayName> | FieldArray<TFieldValues, TFieldArrayName>[]
) => void;
// No options parameter — shouldDirty is NOT available.
```

### Verified: `setValue` options (shouldDirty defaults false)

```typescript
// Source: node_modules/react-hook-form/dist/types/form.d.ts:40-44
// RHF 7.76.1 — installed version
export type SetValueConfig = Partial<{
  shouldValidate: boolean;
  shouldDirty: boolean;   // default: false (undefined = false)
  shouldTouch: boolean;
}>;
// Calling setValue(name, value) without options → shouldDirty is false by default.
```

### Verified: `dirtyFields` is a deep partial map

```typescript
// Source: node_modules/react-hook-form/dist/types/form.d.ts:108
// RHF 7.76.1
dirtyFields: Partial<Readonly<FieldNamesMarkedBoolean<TFieldValues>>>;
// For top-level field access: dirtyFields['fieldName'] → boolean | undefined
// Truthiness check is correct: if (dirtyFields[key]) { skip }
```

### Existing test pattern (reference for blockApply.test.ts)

```typescript
// Source: src/components/history/historyHelpers.test.ts (existing file)
import { describe, it, expect } from "vitest";
import { buildApplyPlan } from "@/lib/blockApply";
import type { FieldSchema } from "@/lib/types";

// All tests follow AAA pattern per project conventions
describe("buildApplyPlan", () => {
  it("fills WKT field when not dirty and form value is null", () => {
    // Arrange
    const fields: FieldSchema[] = [{ name: "ts", label: "Timestamp", kind: { type: "well_known", wkt: "Timestamp" }, repeated: false }];
    const formValues = { ts: null };
    const dirtyFields = {};
    const blockValues = { ts: "2026-01-01T00:00:00" };
    // Act
    const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);
    // Assert
    expect(plan.toApply).toHaveLength(1);
    expect(plan.toApply[0]).toEqual({ fieldName: "ts", value: "2026-01-01T00:00:00", kind: "well_known" });
  });
  // ... more cases per D-04
});
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `applyBlockRef.current = fn` (single function) | `applyBlockRef.current = { buildPlan, commitApply }` | Phase 25 refactor per D-01 |
| Inline eligibility logic in ProtoFormRenderer | `buildApplyPlan` pure function in `src/lib/blockApply.ts` | Enables unit testing per D-04 |
| No map support | Map empty-case via `replace()` registry | Phase 25 adds BLK-EXT-02 |
| No WKT support | WKT handled identically to scalar (dirty guard only) | Phase 25 adds BLK-EXT-01 |

**Deprecated/outdated in this phase:**
- `applyBlockRef` type `((blockValues: Record<string, unknown>) => string[]) | null` — replaced by object ref type

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Non-empty map handling (block value for currently-non-empty map) falls through to `continue` in Phase 25 — no `ConflictItem` is generated | Architecture Patterns — Pattern 3 | If a non-empty map generates a ConflictItem, Phase 26's conflict dialog would fire prematurely; verify with planner |

**Note:** All critical API claims in this research are VERIFIED against the installed `react-hook-form` 7.76.1 type definitions in `node_modules/react-hook-form/dist/types/`.

---

## Open Questions (RESOLVED)

1. **OQ-1: Does `ApplyPlan` need a `skipped` field?** **[RESOLVED — option b]**
   - What we know: Current `FormPanel.onDragEnd` (lines 76-81) calls `applyBlockRef.current(blockValues)` and receives a `string[]` of skipped keys, then shows a toast. D-02 defines `ApplyPlan = { toApply, conflicts }` with no `skipped` field. The code example in Pattern 3 implements the locked D-02 shape (no `skipped`).
   - What's unclear: After the refactor, where does the skipped-keys list come from? Options: (a) add `skipped: string[]` to `ApplyPlan` (extends D-02 — needs user confirmation); (b) compute skipped in `FormPanel` as `Object.keys(blockValues).filter(k => !plan.toApply.some(i => i.fieldName === k) && !plan.conflicts.some(i => i.fieldName === k))`; (c) remove the toast entirely.
   - Recommendation: Option (a) — add `skipped: string[]` to `ApplyPlan` for clarity, but this requires amending D-02. The planner should surface this to the user before locking the type.
   - **RESOLVED:** Plan 25-02 Task 3 uses option (b) — `FormPanel` derives the skipped list inline as `Object.keys(blockValues).filter(k => !plan.toApply.some(...) && !plan.conflicts.some(...))`. D-02 is unchanged; no `skipped` field is added to `ApplyPlan`.

2. **OQ-2: Registry cleanup — null or no-op?** **[RESOLVED — null]**
   - What we know: D-05 says "passes a no-op to clear" OR "null". Both are mentioned.
   - What's unclear: Mixing both creates inconsistency. `commitApply` uses `?.()` optional call on the registry value — both `null` and a no-op will work.
   - Recommendation: Use `null`. The `?.()` pattern in `commitApply` is the correct guard. A no-op is unnecessary indirection.
   - **RESOLVED:** D-05 locks `onRegisterReplace(path, null)` on unmount. Plans use `null` consistently; the `?.()` optional-call pattern in `commitApply` is the guard. No-op variant is not used.

3. **OQ-3: `replace()` dirty state — explicit plan note needed?** **[RESOLVED — accepted]**
   - What we know: After `commitApply` calls `replace()` for a map field, `dirtyFields[mapField]` becomes truthy. A second block drag will skip that field.
   - What's unclear: Is this acceptable per the product requirements, or does it need a note in the toast?
   - Recommendation: Accept for Phase 25 (per Pitfall 1 reasoning). The behavior is consistent with how RHF tracks user interaction — once filled, the map is "owned" by the user. Include a code comment in `commitApply` noting this.
   - **RESOLVED:** Accepted as intended Phase 25 behavior. Pitfall 1 in this document documents it explicitly. Plan 25-01 Task 2 notes in the action text that `replace()` marks the field dirty and that a second drag will skip it — a code comment in `commitApply` is required per the plan.

4. **OQ-4: Does dropping `'message'` from eligible kinds cause a regression?**
   - What we know: The existing `applyBlockRef` in `ProtoFormRenderer.tsx` lines 153-161 currently includes `'message'` in its eligible set:
     ```typescript
     .filter(f =>
       f.kind.type === 'scalar' ||
       f.kind.type === 'enum' ||
       f.kind.type === 'message'   // currently eligible
     )
     ```
     D-02's `ApplyItemKind = 'scalar' | 'enum' | 'well_known' | 'map'` drops `'message'`. The Pattern 3 `ELIGIBLE_KINDS` set also excludes `'message'`.
   - What's unclear: Is this intentional? The deferred ideas in CONTEXT.md mention "recursive nested-message merge (BLK-EXT-FUTURE-02)" — which suggests the current shallow `setValue(messageField, object)` behavior is being intentionally retired rather than silently dropped. But the CONTEXT.md does not explicitly say "remove message support in Phase 25."
   - Risk: If the existing shallow message-apply behavior was relied on by users, Phase 25 silently removes it without replacement. Any proto block containing a message field will now have that field silently skipped.
   - Recommendation: **Planner must confirm with user** before the implementation tasks lock `ELIGIBLE_KINDS`. If intentional: add a note to the deprecation log and update D-02 to explicitly state "message kind removed". If unintentional: add `'message'` back to `ApplyItemKind` and `ELIGIBLE_KINDS` with a `setValue` path in `commitApply`.
   - **RESOLVED — intentional regression, documented.** Dropping `'message'` from `ELIGIBLE_KINDS` is confirmed intentional: BLK-EXT-FUTURE-02 tracks proper nested-message merge; shallow `setValue(messageField, object)` behavior is deprecated in Phase 25. Message-kind block fields are silently skipped. Deprecation note added to CONTEXT.md Deferred Ideas.

---

## Environment Availability

Step 2.6: SKIPPED (code-only phase — no external dependencies beyond existing installed packages).

---

## Security Domain

This phase has no authentication, session, or input validation surface. The `buildApplyPlan` function receives values from a block the user created (trusted, local), not from a network source. Standard project constraints apply (no `any`, no console.log, validated via existing RHF validation rules). No new ASVS controls needed.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Partial | Existing RHF validation rules on fields are unaffected; `buildApplyPlan` does not bypass them |
| All others | No | No auth, session, crypto, or external data in this phase |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/react-hook-form/dist/types/fieldArray.d.ts` — `UseFieldArrayReplace` type signature (verified: no options parameter)
- `node_modules/react-hook-form/dist/types/form.d.ts` — `SetValueConfig` (shouldDirty defaults false), `FormState.dirtyFields` type
- `src/components/form/ProtoFormRenderer.tsx` — existing `applyBlockRef` implementation, `buildDefaultValues`, ref wiring pattern
- `src/components/form/FormPanel.tsx` — existing `onDragEnd` call site, `applyBlockRef` ref declaration
- `src/components/form/fields/MapField.tsx` — `useFieldArray({ fields, append, remove })` — `replace` not yet destructured
- `src/components/form/fields/WellKnownTypeField.tsx` — `Controller defaultValue=""` vs form state `null`
- `.planning/phases/25-block-apply-wkt-map-empty-case/25-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- [react-hook-form npm registry](https://www.npmjs.com/package/react-hook-form) — current version 7.76.1
- [GitHub Discussion #8223](https://github.com/orgs/react-hook-form/discussions/8223) — `replace()` marks isDirty (unresolved limitation)
- [GitHub Issue #8309](https://github.com/react-hook-form/react-hook-form/issues/8309) — `isDirty should remain false when using useFieldArray replace` (closed, no shouldDirty option added)
- [GitHub Issue #8968](https://github.com/react-hook-form/react-hook-form/issues/8968) — Add options to useFieldArray functions (marked duplicated)
- react-hook-form CHANGELOG.md — 7.76.0 (2026-05-16): "Prevent useFieldArray from marking unrelated fields as dirty" (scoped to unrelated fields, not the replaced array itself)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed node_modules type definitions
- Architecture: HIGH — all decisions are locked in CONTEXT.md; research confirms API behavior
- Pitfalls: HIGH — replace() dirty behavior confirmed via installed type defs + GitHub issues

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (react-hook-form 7.x is stable; dirty behavior unchanged since 2022)
