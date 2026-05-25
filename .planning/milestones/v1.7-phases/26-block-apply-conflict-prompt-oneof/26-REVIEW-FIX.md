---
phase: 26-block-apply-conflict-prompt-oneof
fixed_at: 2026-05-25T18:00:00Z
review_path: .planning/phases/26-block-apply-conflict-prompt-oneof/26-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 26: Code Review Fix Report

**Fixed at:** 2026-05-25T18:00:00Z
**Source review:** .planning/phases/26-block-apply-conflict-prompt-oneof/26-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Non-empty map with zero collisions silently replaces all existing rows

**Files modified:** `src/lib/blockApply.ts`
**Commit:** `424b2d6`
**Applied fix:** Inside the `if (Array.isArray(current) && current.length > 0)` block, after the collision path short-circuits with `continue`, added an explicit zero-collision handler that: (1) skips when `nonCollidingRows.length === 0` (nothing to add), (2) skips when `dirtyFields[key]` is truthy, (3) builds a `mergedValue` array of `[...existing, ...nonCollidingRows]` and emits that as the `toApply` value instead of the raw block array. The outer dirty-guard and `toApply.push` are now only reached for the empty/non-array map path.

---

### WR-01: Unsafe cast on `dirtyFields[key]` for oneof silently disables dirty-protection

**Files modified:** `src/lib/blockApply.ts`
**Commit:** `015f508` (initial guard), `081411a` (corrected semantics)
**Applied fix:** Replaced `(dirtyFields[key] as Record<string, unknown> | undefined) ?? {}` with a proper runtime type guard. When `rawDirtyEntry === true` (whole-field dirty boolean), the entire oneof field is now skipped silently with `continue` before entering the sub-field loop — consistent with the scalar dirty guard. When `rawDirtyEntry` is an object, per-sub-field dirty checks proceed as before.

---

### WR-02: `isJsonMode` read inside `useDndMonitor` before its declaration

**Files modified:** `src/components/form/FormPanel.tsx`
**Commit:** `64c18e8`
**Applied fix:** Moved the four `useState` declarations (`isJsonMode`, `entrySnapshot`, `jsonDraft`, `parseError`) from after the `useDndMonitor` call to before it. Added a comment explaining the ordering requirement: the `onDragEnd` closure captures `isJsonMode` by reference and ordering must be preserved if the hook is ever extracted or a lint rule enforcing hook call order is added.

---

### IN-02: Test suite missing coverage for the non-empty, zero-collision map path

**Files modified:** `src/lib/blockApply.test.ts`
**Commit:** `081411a`
**Applied fix:** Added test `"appends block rows to non-empty map when no keys collide (IN-02 — regression guard for CR-01)"`. Verifies that given an existing row `{ key: "env", value: "prod" }` and a block row `{ key: "team", value: "infra" }`, `buildApplyPlan` produces no conflicts and a single `toApply` item whose value is the merged array.

---

### IN-03: No test for whole-field-dirty oneof (the WR-01 scenario)

**Files modified:** `src/lib/blockApply.test.ts`
**Commit:** `081411a`
**Applied fix:** Added test `"treats all sub-fields as dirty when whole oneof field is marked dirty (IN-03 — regression guard for WR-01)"`. Sets `dirtyFields = { payment: true }` (boolean, not per-sub-field object) and verifies both `plan.toApply` and `plan.conflicts` are empty — the field must be silently skipped when whole-field dirty.

---

### IN-01: `subFieldName` optional type does not match guaranteed usage at `oneof_dirty_subfield` callsite

**Files modified:** `src/lib/blockApply.ts`, `src/components/form/ProtoFormRenderer.tsx`
**Commit:** `f34e43a`
**Applied fix:** Refactored `ConflictItem` from a flat single type into a three-variant discriminated union keyed on `kind`:
- `map_key_collision`: `collisionKey` (string) and `nonCollidingBlockRows` (unknown[]) are now required fields.
- `oneof_dirty_subfield`: `subFieldName` is now required (was `string | undefined`).
- `oneof_branch_switch`: `currentBranch` and `blockBranch` are both now required.

In `ProtoFormRenderer.tsx`, typed `mapCollisionsByField` as `Map<string, Extract<ConflictItem, { kind: "map_key_collision" }>[]>` so that `collisionKey` and `nonCollidingBlockRows` are accessible without casts inside the merge loop. Removed the redundant `item.blockBranch!` non-null assertion since `blockBranch` is required on the `oneof_branch_switch` variant. `ConflictItemKind` kept as a deprecated type alias for backwards compatibility. TypeScript reports zero errors after the refactor.

---

_Fixed: 2026-05-25T18:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
