---
phase: 25-block-apply-wkt-map-empty-case
verified: 2026-05-25T14:00:00Z
status: complete
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Drag a block with a Timestamp field onto a form with an empty Timestamp field"
    expected: "The Timestamp field displays the block's value after the drag; no form error appears"
    why_human: "End-to-end drag-and-drop RHF setValue for WKT fields requires a running app to verify the field renders correctly"
  - test: "Drag a block with a Timestamp field onto a form where the user already typed a value in the Timestamp field"
    expected: "The Timestamp field retains the user-typed value; the block value is NOT applied; a toast warning appears listing the skipped field"
    why_human: "Dirty-guard protection for WKT requires live RHF state — dirtyFields is set by user interaction, not by code path tracing"
  - test: "Drag a block with map rows onto a form where the map field is empty"
    expected: "The map field immediately shows the block's rows as rendered key-value pairs with Remove buttons; the map replace() call is visible in the UI"
    why_human: "mapReplaceRegistry → replace() path requires a mounted MapField to exercise the registration useEffect and actual replace() invocation"
  - test: "Drag a block with map rows onto a form where the map field already has user-entered rows"
    expected: "The map field's existing rows are preserved; the block rows are NOT applied; the map field name appears in the skipped-fields toast"
    why_human: "Non-empty map skip path (replace() marks dirty after first fill) requires live RHF state to verify dirty guard triggers on second drag"
  - test: "Drag a block that contains an unknown field name onto the form"
    expected: "A toast warning appears stating '1 field from block not in form: <fieldname>'"
    why_human: "Toast rendering and message text require a running app"
  - test: "Drag block A with { ts: '2026-01-01T00:00:00Z' } onto empty Timestamp field, then drag block B with { ts: '2026-12-31T23:59:59Z' } onto the same form"
    expected: "Confirm Phase 25 intentional behavior: Timestamp field shows block B's value (2026-12-31...). Block-applied WKT/scalar fields stay non-dirty by design (shouldDirty: false) and are re-writable by a subsequent drag. Only user-typed values are protected. If product expectation differs, this is a gap to raise."
    why_human: "SC-3 text ('does not silently overwrite already-filled WKT or scalar fields') is ambiguous about whether block-filled counts as already-filled. CONTEXT.md line 107 confirms the design intent: block-filled fields stay re-writable. Human must confirm the product intent matches the implementation."
---

# Phase 25: Block Apply — WKT + Map Empty Case Verification Report

**Phase Goal:** Create buildApplyPlan pure function + wire block-apply two-phase architecture into MapField, ProtoFormRenderer, and FormPanel
**Verified:** 2026-05-25T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | buildApplyPlan returns toApply items for non-dirty scalar, enum, and well_known fields | VERIFIED | blockApply.ts lines 91-108; tests "fills scalar", "fills enum", "fills well_known" all pass |
| 2 | buildApplyPlan skips well_known fields that are dirty (D-06) | VERIFIED | blockApply.ts line 97 `if (dirtyFields[key]) continue`; test "skips well_known field when dirty" passes |
| 3 | buildApplyPlan returns a toApply map item when the map field is currently empty | VERIFIED | blockApply.ts lines 101-106 (empty array check); test "fills map field when empty" passes |
| 4 | buildApplyPlan skips map fields that are currently non-empty (Phase 26 handles conflict) | VERIFIED | blockApply.ts lines 103-106 `Array.isArray(current) && current.length > 0`; test "skips map field when non-empty" passes |
| 5 | buildApplyPlan silently skips block keys that do not match any eligible field | VERIFIED | blockApply.ts line 93-95 `if (!field) continue`; test "skips unknown block key silently" passes |
| 6 | buildApplyPlan silently skips 'message' kind fields (D-02 + BLK-EXT-FUTURE-02) | VERIFIED | ELIGIBLE_KINDS excludes 'message' (blockApply.ts line 53-58); test "skips message kind field" passes |
| 7 | conflicts is always [] in Phase 25 output | VERIFIED | blockApply.ts line 111 `return { toApply, conflicts: [] }`; test "conflicts is always empty array" passes |
| 8 | ApplyBlockRef type is exported from blockApply.ts | VERIFIED | blockApply.ts lines 39-42 exports ApplyBlockRef; 6 exports confirmed by grep |
| 9 | D-03: buildApplyPlan is standalone pure function — no React imports, no side effects | VERIFIED | Only import in blockApply.ts is `import type { FieldSchema } from "@/lib/types"` (line 1); no React, no RHF |
| 10 | D-04: Unit tests covering wkt-empty-fill, wkt-dirty-skip, map-empty-fill, scalar-fill, unknown-key-skip | VERIFIED | 10 tests in blockApply.test.ts, all passing including all required D-04 cases |
| 11 | FormPanel.onDragEnd calls buildPlan then commitApply (two-phase D-01) | VERIFIED | FormPanel.tsx lines 75-77: `buildPlan(blockValues)` then `commitApply(plan)` |
| 12 | applyBlockRef type is ApplyBlockRef | null in both ProtoFormRenderer and FormPanel | VERIFIED | FormPanel.tsx line 51 `useRef<ApplyBlockRef | null>(null)`; ProtoFormRenderer.tsx line 40 `React.MutableRefObject<ApplyBlockRef | null>` |
| 13 | D-05: mapReplaceRegistry registry pattern wires MapField.replace into commitApply | VERIFIED | ProtoFormRenderer.tsx lines 122-131 declares registry + handleRegisterReplace; MapField.tsx lines 161-166 useEffect registers replace; ProtoFormRenderer.tsx line 178 calls registry fn |
| 14 | D-06: WKT fields use dirty-guard only — no separate empty check | VERIFIED | blockApply.ts: WKT flows through the single `if (dirtyFields[key])` check at line 97; no Array.isArray check for WKT |

**Score:** 14/14 truths verified

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC-1 | Dragging a block fills WKT fields that were empty; dirty fields left unchanged | VERIFIED (code) + HUMAN NEEDED (UI) | buildApplyPlan WKT eligibility + dirty guard + commitApply setValue path confirmed; drag UX requires human |
| SC-2 | Dragging a block replaces entirely empty map field with block rows, visible immediately | VERIFIED (code) + HUMAN NEEDED (UI) | mapReplaceRegistry + replace() wiring confirmed; render behavior requires human |
| SC-3 | Second block drag does not overwrite user-typed (dirty) WKT/scalar fields | VERIFIED (code) + HUMAN NEEDED (UI) | Dirty guard confirmed; design note: block-applied WKT/scalar fields stay non-dirty (shouldDirty:false per CONTEXT.md line 107) and are re-writable by a second drag; only user-typed values are protected from overwrite; SC-3 ambiguity resolved in human check #6 |
| SC-4 | Block apply logic separated into pure plan step + commit step | VERIFIED | buildApplyPlan in blockApply.ts (pure, no side effects); commitApply in ProtoFormRenderer applyBlockRef useEffect |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/blockApply.ts` | buildApplyPlan pure function + 5 exported types | VERIFIED | 113 lines; 6 exports; no React imports; ELIGIBLE_KINDS excludes 'message'; dirty guard + map empty check |
| `src/lib/blockApply.test.ts` | Unit tests for all D-04 cases | VERIFIED | 10 tests in describe("buildApplyPlan"); all pass |
| `src/components/form/fields/MapField.tsx` | replace destructure, onRegisterReplace prop, registration useEffect | VERIFIED | Line 114: replace in useFieldArray destructure; line 28: onRegisterReplace? in MapFieldProps; lines 161-166: registration useEffect with [path, replace, onRegisterReplace] dep array |
| `src/components/form/ProtoFormRenderer.tsx` | mapReplaceRegistry, handleRegisterReplace, two-phase applyBlockRef useEffect | VERIFIED | Lines 122-131: registry + callback; lines 162-194: two-phase useEffect assigning {buildPlan, commitApply}; line 227: onRegisterReplace={handleRegisterReplace} |
| `src/components/form/FormPanel.tsx` | ApplyBlockRef import, updated ref type, two-phase onDragEnd | VERIFIED | Line 14: import; line 51: useRef<ApplyBlockRef | null>(null); lines 75-82: two-phase call + skipped computation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| FormPanel.tsx | blockApply.ts | `import type { ApplyBlockRef }` | WIRED | FormPanel.tsx line 14 |
| ProtoFormRenderer.tsx | blockApply.ts | `import { buildApplyPlan }` | WIRED | ProtoFormRenderer.tsx line 4 |
| ProtoFormRenderer.tsx | blockApply.ts | `import type { ApplyBlockRef }` | WIRED | ProtoFormRenderer.tsx line 5 |
| ProtoFormRenderer.tsx | MapField.tsx | `onRegisterReplace={handleRegisterReplace}` | WIRED | ProtoFormRenderer.tsx line 227 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| FormPanel.tsx onDragEnd | `plan` | `applyBlockRef.current.buildPlan(blockValues)` | Yes — delegates to buildApplyPlan which processes real form values and dirtyFields | FLOWING |
| ProtoFormRenderer.tsx commitApply | `plan.toApply` | buildApplyPlan return value | Yes — iterates real ApplyItem array | FLOWING |
| MapField.tsx registration | `replace` fn | `useFieldArray({ control, name: path })` | Yes — RHF stable function reference | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| blockApply.test.ts — all 10 unit tests | `npx vitest run src/lib/blockApply.test.ts` | PASS (10) FAIL (0) | PASS |
| ProtoFormRenderer.test.tsx — 8 tests including applyBlockRef suite | `npx vitest run src/components/form/__tests__/ProtoFormRenderer.test.tsx` | PASS (8) FAIL (0) | PASS |
| Full test suite | `npx vitest run` | PASS (499) FAIL (0) | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No errors | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BLK-EXT-01 | 25-02 | WKT block apply with dirty-field guard | SATISFIED | buildApplyPlan WKT eligibility + dirty guard + commitApply setValue path |
| BLK-EXT-02 | 25-02 | Empty map block apply via replace() | SATISFIED | mapReplaceRegistry + MapField replace registration + commitApply map path |
| BLK-EXT-07 | 25-01, 25-02 | Two-phase plan/commit architecture | SATISFIED | buildApplyPlan (pure) + commitApply (side effects separated); ApplyBlockRef type wired in both FormPanel and ProtoFormRenderer |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| MapField.tsx | 258 | `placeholder="Key"` | INFO | HTML input placeholder attribute for key column; not a code stub — correct usage |

No debt markers (TBD, FIXME, XXX), no console.log, no `any` types in modified files.

**Note on SUMMARY test count discrepancy:** SUMMARY claimed "16/16 ProtoFormRenderer tests passing" and "997 total passing." Actual counts: ProtoFormRenderer.test.tsx has 8 tests; full suite has 499 tests. The implementation and test results are correct — the SUMMARY numbers appear inflated (possibly double-counted). This is a documentation discrepancy, not an implementation defect.

### Human Verification Required

6 items need human testing in a running application:

#### 1. WKT Fill — Empty Field

**Test:** Open a proto with a Timestamp field. Drag a block containing `{ "created_at": "2026-01-01T00:00:00Z" }` onto the form drop zone.
**Expected:** The Timestamp field shows `2026-01-01T00:00:00Z` after the drop; no error toast appears.
**Why human:** End-to-end WKT setValue rendering requires a mounted app; WellKnownTypeField rendering of the string value must be confirmed visually.

#### 2. WKT Dirty Guard

**Test:** Open a proto with a Timestamp field. Type a value into the Timestamp field to make it dirty. Then drag a block with a different Timestamp value onto the form.
**Expected:** The Timestamp field retains the user-typed value; the block Timestamp value is NOT applied; a warning toast appears naming the skipped field.
**Why human:** `formState.dirtyFields` is populated by user interaction events; requires a live RHF form to verify the guard triggers.

#### 3. Empty Map Fill

**Test:** Open a proto with a map field. Ensure the map is empty (no rows). Drag a block containing `{ "labels": [{ "key": "env", "value": "prod" }] }` onto the form.
**Expected:** The map field immediately shows one row with key `env` and value `prod`; an Add entry button is visible below the row.
**Why human:** `mapReplaceRegistry` registration via `useEffect` and the actual `replace()` call through the registry requires a mounted MapField component.

#### 4. Non-Empty Map Protection

**Test:** Open a proto with a map field. Add one row manually (key: `foo`, value: `bar`). Then drag a block with map rows onto the form.
**Expected:** The existing `foo: bar` row is preserved; no block rows are added; the map field name appears in the skipped-fields toast.
**Why human:** The protection depends on `replace()` marking the field dirty after first fill — requires a running app to confirm RHF's dirtyFields state.

#### 5. Unknown Field Toast

**Test:** Create a block whose JSON contains a field name not in the loaded proto schema. Drag it onto the form.
**Expected:** A warning toast appears: "1 field from block not in form: `<fieldname>`"
**Why human:** Toast display and correct message formatting require a running app.

#### 6. SC-3 Clarification — Block-Applied vs. User-Typed Protection (Product Intent Check)

**Test:** Drag block A containing `{ "ts": "2026-01-01T00:00:00Z" }` onto an empty Timestamp field. Then drag block B containing `{ "ts": "2026-12-31T23:59:59Z" }` onto the same form without typing anything.
**Expected (Phase 25 design intent):** The Timestamp field shows block B's value (`2026-12-31...`). Block-applied WKT/scalar fields stay non-dirty by design (`shouldDirty: false` per CONTEXT.md line 107) and are intentionally re-writable by subsequent block drags. Only user-typed values trigger the dirty guard.
**Why human:** Roadmap SC-3 text ("does not silently overwrite already-filled WKT or scalar fields") is ambiguous about whether "already-filled" includes block-applied values. CONTEXT.md confirms the design: block-filled fields are re-writable. If the product expectation instead is that a block-applied value should also be protected from a second drag, this behavior is a gap requiring a Phase 26 fix (e.g., use `shouldDirty: true` in commitApply).

---

## Gaps Summary

No gaps found. All 14 must-have truths are VERIFIED in the codebase. The phase goal is fully implemented:

- `buildApplyPlan` pure function exists at `src/lib/blockApply.ts` with all required exports and behaviors
- All 10 unit tests pass in `src/lib/blockApply.test.ts`
- The two-phase architecture is wired end-to-end: `FormPanel` calls `buildPlan` then `commitApply`, `ProtoFormRenderer` builds the `{buildPlan, commitApply}` object using `buildApplyPlan` and `mapReplaceRegistry`, and `MapField` registers its `replace` function via `onRegisterReplace`
- TypeScript compiles cleanly; full suite passes 499/499

The 6 human verification items are UI behavior checks that require a running application — they cannot be falsified by code analysis alone.

---

_Verified: 2026-05-25T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
