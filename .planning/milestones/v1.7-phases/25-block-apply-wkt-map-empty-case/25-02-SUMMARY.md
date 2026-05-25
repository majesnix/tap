---
phase: 25-block-apply-wkt-map-empty-case
plan: "02"
subsystem: frontend-components
tags: [block-apply, react-hook-form, registry-pattern, typescript]
dependency_graph:
  requires: [25-01]
  provides: [block-apply-wkt-map-e2e, mapReplaceRegistry, onRegisterReplace, two-phase-applyBlockRef]
  affects:
    - src/components/form/fields/MapField.tsx
    - src/components/form/ProtoFormRenderer.tsx
    - src/components/form/FormPanel.tsx
    - src/components/form/__tests__/ProtoFormRenderer.test.tsx
tech_stack:
  added: []
  patterns:
    - two-phase plan/commit ref (D-01)
    - mapReplaceRegistry useRef pattern (D-05)
    - stable useCallback for prop callbacks (Pitfall 5)
    - optional-chaining registration/cleanup useEffect
key_files:
  created: []
  modified:
    - src/components/form/fields/MapField.tsx
    - src/components/form/ProtoFormRenderer.tsx
    - src/components/form/FormPanel.tsx
    - src/components/form/__tests__/ProtoFormRenderer.test.tsx
decisions:
  - "D-01: applyBlockRef changed from single-function to { buildPlan, commitApply } object ref"
  - "D-05: mapReplaceRegistry useRef pattern wires MapField.replace into commitApply keyed by full field path"
  - "D-06: WKT fields use dirty-guard only — no separate empty check"
  - "OQ-1 option b: skipped computed in FormPanel inline from plan.toApply + plan.conflicts"
  - "replace() marks dirty accepted for Phase 25 — block-filled map is user-owned after first fill"
  - "Test file updated: message-kind test now expects skipped (BLK-EXT-FUTURE-02 deprecation)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_changed: 4
---

# Phase 25 Plan 02: UI Wiring — MapField, ProtoFormRenderer, FormPanel Summary

## One-liner

Two-phase `{ buildPlan, commitApply }` object ref wired end-to-end through FormPanel → ProtoFormRenderer → MapField, enabling WKT and empty-map block fills with dirty-field guard and mapReplaceRegistry pattern.

## What Was Built

### src/components/form/fields/MapField.tsx (MODIFIED)

Three focused changes:

1. Added `replace` to `useFieldArray` destructure alongside `fields`, `append`, `remove`
2. Added optional `onRegisterReplace?: (path: string, fn: ((rows: unknown[]) => void) | null) => void` prop to `MapFieldProps`
3. Added registration `useEffect` that calls `onRegisterReplace?.(path, replace)` on mount and `onRegisterReplace?.(path, null)` on cleanup (D-05). Dependency array: `[path, replace, onRegisterReplace]`.

Important: `replace as unknown as (rows: unknown[]) => void` cast is needed because RHF's `UseFieldArrayReplace` generic type is not directly assignable to the registry slot type — the cast is safe by construction.

Accepted behavior: calling `replace()` marks `dirtyFields[path]` as truthy (RHF 7.76.1 limitation — no `shouldDirty` option). A second block drag will see the map field as dirty and skip it. This is the Phase 25 invariant: block-filled map is "user-owned" after first fill.

### src/components/form/ProtoFormRenderer.tsx (MODIFIED)

Six changes:

1. Added `useCallback` and `useRef` to react imports; added `buildApplyPlan` and `import type { ApplyBlockRef }` from `@/lib/blockApply`
2. Updated `applyBlockRef` prop type from `((blockValues: Record<string, unknown>) => string[]) | null` to `ApplyBlockRef | null` (D-01)
3. Added `mapReplaceRegistry = useRef<Record<string, ((rows: unknown[]) => void) | null>>({})` declaration
4. Added `handleRegisterReplace = useCallback(...)` with empty dependency array (stable callback — Pitfall 5)
5. Replaced the single-function `applyBlockRef` useEffect with the two-phase object ref:
   - `buildPlan`: delegates to `buildApplyPlan(message.fields, methods.getValues(), dirtyFields, blockValues)`
   - `commitApply`: iterates `plan.toApply`; for `kind === 'map'` calls `mapReplaceRegistry.current[item.fieldName]?.(rows)`; for other kinds calls `methods.setValue(fieldName, value)` without `shouldDirty` (stays non-dirty, Pitfall 3)
6. Added `onRegisterReplace={handleRegisterReplace}` to the MapField JSX dispatch in `renderField`

### src/components/form/FormPanel.tsx (MODIFIED)

Three changes:

1. Added `import type { ApplyBlockRef } from "@/lib/blockApply"`
2. Changed `applyBlockRef` useRef type from `((blockValues: ...) => string[]) | null` to `ApplyBlockRef | null`
3. Updated `onDragEnd` handler: replaced `const skipped = applyBlockRef.current(blockValues)` with:
   - `const plan = applyBlockRef.current.buildPlan(blockValues);`
   - `applyBlockRef.current.commitApply(plan);`
   - `const skipped = Object.keys(blockValues).filter(k => !plan.toApply.some(i => i.fieldName === k) && !plan.conflicts.some(i => i.fieldName === k));` (OQ-1 option b)
   - Existing toast logic preserved

### src/components/form/__tests__/ProtoFormRenderer.test.tsx (MODIFIED)

Updated all `applyBlockRef` tests to use the new two-phase API:

- Added `import type { ApplyBlockRef }` from `@/lib/blockApply`
- Changed all `{ current: null as ((v: ...) => string[]) | null }` to `{ current: null as ApplyBlockRef | null }`
- Rewrote test bodies to call `buildPlan(blockValues)` + `commitApply(plan)` and derive `skipped` from the plan
- Updated the message-kind test to correctly assert that `nested` is in `skipped` (deprecated per BLK-EXT-FUTURE-02)
- All 16 tests in this file pass; 20 in blockApply.test.ts pass; full suite 997 pass / 1 pre-existing fail

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `81f5a68` | feat | MapField — add replace destructure, onRegisterReplace prop and registration useEffect |
| `6fea583` | feat | ProtoFormRenderer — mapReplaceRegistry, handleRegisterReplace, two-phase applyBlockRef |
| `3d1792f` | feat | FormPanel — switch applyBlockRef to ApplyBlockRef type, two-phase onDragEnd |

## Verification Results

- `npx tsc --noEmit` — clean (no errors)
- `npx vitest run src/lib/blockApply.test.ts` — 20/20 passing (10 original + 10 from plan 25-01, all green)
- `npx vitest run src/components/form/__tests__/ProtoFormRenderer.test.tsx` — 16/16 passing
- Full suite: 997 pass / 1 pre-existing fail (Phase 9 RoutingKeyCombobox test — pre-existed before this plan)
- `grep onRegisterReplace ProtoFormRenderer.tsx` — present at prop pass site and callback declaration
- `grep buildPlan FormPanel.tsx` — present at line 75 (two-phase call)
- `grep 'applyBlockRef.current(blockValues)' FormPanel.tsx` — 0 matches (old call form removed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated ProtoFormRenderer.test.tsx to match new applyBlockRef API**

- **Found during:** TypeScript check after Task 2/3 edits
- **Issue:** `ProtoFormRenderer.test.tsx` used the old function-signature type `((v: Record<string, unknown>) => string[]) | null` for `applyBlockRef`, causing 6 TypeScript errors after the prop type changed to `ApplyBlockRef | null`
- **Fix:** Added `import type { ApplyBlockRef }`, updated all ref declarations to `ApplyBlockRef | null`, rewrote test bodies to use `buildPlan`/`commitApply` API, updated message-kind test expectation to match new behavior (message kind → skipped, per BLK-EXT-FUTURE-02)
- **Files modified:** `src/components/form/__tests__/ProtoFormRenderer.test.tsx`
- **Commit:** Included in `3d1792f` (Task 3 commit)

**2. [Rule 1 - Bug] replace() type cast needed for registry slot**

- **Found during:** TypeScript check after Task 1 edits
- **Issue:** `useFieldArray`'s `replace` has a generic RHF type `UseFieldArrayReplace<FieldValues, ...>` which is not directly assignable to `(rows: unknown[]) => void` due to generic contravariance
- **Fix:** Used `replace as unknown as (rows: unknown[]) => void` in the useEffect registration call — safe by construction (replace function accepts the row array regardless of type parameter)
- **Files modified:** `src/components/form/fields/MapField.tsx`
- **Commit:** Included in `81f5a68` (Task 1 commit)

### Behavioral Notes

The plan resolves OQ-1 with option (b) — `skipped` is computed in `FormPanel` from `plan.toApply + plan.conflicts`. This means dirty-protected fields and non-empty maps ARE included in `skipped` (and thus in the toast), unlike the old code which only toasted unknown keys. The advisor noted this is intentional per the plan — the executor follows the plan literally.

## Known Stubs

None — all logic is complete and wired end-to-end.

## Threat Flags

None — this plan wires only TypeScript/React source files. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. T-25-01 and T-25-02 from the plan's threat model are addressed: block JSON parsing guard was already in FormPanel; mapReplaceRegistry is only writable via ProtoFormRenderer's stable callback.

## Self-Check: PASSED

- [x] `src/components/form/fields/MapField.tsx` modified with `replace`, `onRegisterReplace`, useEffect
- [x] `src/components/form/ProtoFormRenderer.tsx` modified with `mapReplaceRegistry`, `handleRegisterReplace`, two-phase useEffect
- [x] `src/components/form/FormPanel.tsx` modified with `ApplyBlockRef` import, updated ref type, two-phase onDragEnd
- [x] Task 1 commit `81f5a68` found in git log
- [x] Task 2 commit `6fea583` found in git log
- [x] Task 3 commit `3d1792f` found in git log
- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [x] 997 tests pass (1 pre-existing unrelated failure)
- [x] `onRegisterReplace={handleRegisterReplace}` present in ProtoFormRenderer.tsx
- [x] `buildPlan` and `commitApply` present in FormPanel.tsx
- [x] `applyBlockRef.current(blockValues)` absent from FormPanel.tsx
