# Phase 26: Block Apply — Conflict Prompt + Oneof - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add conflict resolution UX to block apply: when a block drag targets fields with existing values (non-empty map key collisions, dirty oneof same-branch sub-fields) or requires a oneof branch switch, users see a single batched dialog listing all conflicts. Users choose overwrite or skip per conflict row before any writes happen. The `buildApplyPlan` pure function is extended to detect these cases and populate `ApplyPlan.conflicts`. `FormPanel` shows `BlockApplyConflictDialog` when conflicts are present; `commitApply` executes the user's choices.

Out of scope for Phase 26: block apply in JSON mode (BLK-EXT-FUTURE-01), recursive nested-message merge (BLK-EXT-FUTURE-02).

</domain>

<decisions>
## Implementation Decisions

### Oneof block JSON shape
- **D-01**: `buildApplyPlan` accepts ONLY the RHF-native strict shape for oneof values: `{ payment: { _selected: "card_number", card_number: "value" } }`. The `_selected` discriminator is REQUIRED.
- **D-02**: If `_selected` is absent from the block's oneof object, or contains an unrecognized branch name → **silent skip**. Does NOT appear in `unknownKeys`, not surfaced as a warning. Consistent with how ineligible kinds (`'message'`) are handled.
- **D-03**: `buildApplyPlan` must add `'oneof'` to its eligible kinds. The function currently skips oneof fields entirely — Phase 26 adds full oneof parsing (same-branch and branch-switch detection).

### Branch-switch dialog UX
- **D-04**: A block targeting a **different** oneof branch than the active one produces a **branch-switch conflict row inside the same batched conflict dialog** as all other conflicts (BLK-EXT-06). The row label should make the switch explicit — e.g., "switch [fieldLabel] from [currentBranch] to [blockBranch]". Defaults to skip (Pitfall E).
- **D-05**: When the user selects "overwrite" on a branch-switch row, `commitApply` performs a **single atomic `setValue`** — `setValue(fieldName, { _selected: newBranch, [newBranch]: blockSubValue }, { shouldDirty: false })` — exactly per Pitfall A. All sub-field values from the block are applied at once. No second dialog follows.
- **D-06**: When the user skips a branch-switch row, all block values for that oneof field are discarded (no partial apply).

### Locked from Phase 25 (carry forward as-is)
- `applyBlockRef.current = { buildPlan, commitApply }` — two-phase ref shape unchanged (D-01, Phase 25)
- `mapReplaceRegistry` useRef pattern for map fields (D-05, Phase 25) — unchanged
- `BlockApplyConflictDialog` lives in `FormPanel` (BLK-EXT-07) — already locked
- **Pitfall A**: oneof must be set atomically — `setValue(key, { _selected, [branch]: value }, { shouldDirty: false })`
- **Pitfall D**: `shouldDirty: false` on ALL block apply `setValue` calls; omitting this registers block-filled fields as user-touched and causes false conflicts on next drag
- **Pitfall E**: All conflict rows default to **skip** (not overwrite) — prevents accidental data loss

### commitApply signature
- The planner decides the exact mechanism for passing user conflict choices from `BlockApplyConflictDialog` to `commitApply`. Options include extending the signature `commitApply(plan, choices)` or having `FormPanel` merge confirmed conflicts into a modified plan before calling the existing `commitApply`. Either approach is acceptable — document the chosen shape in the plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Block Apply — Complex Field Types — BLK-EXT-03, BLK-EXT-04, BLK-EXT-05, BLK-EXT-06 define the acceptance criteria for Phase 26

### Core files to read and extend
- `src/lib/blockApply.ts` — extend `buildApplyPlan`: add `'oneof'` to eligible kinds; parse `{ _selected, branchName: value }` shape; detect same-branch dirty sub-fields (→ `ConflictItem`) vs. branch-switch (→ `ConflictItem`); add non-empty map key collision handling (→ `ConflictItem` per colliding key); `ELIGIBLE_KINDS` currently excludes `'oneof'`
- `src/lib/blockApply.test.ts` — extend unit tests: oneof same-branch fill, oneof same-branch dirty conflict, branch-switch conflict row, non-empty map key collision, missing `_selected` silent skip
- `src/components/form/FormPanel.tsx` — add `BlockApplyConflictDialog` component (or import if extracted); update `onDragEnd` to show dialog when `plan.conflicts.length > 0` before calling `commitApply`; pass conflict resolution choices to `commitApply`
- `src/components/form/ProtoFormRenderer.tsx` — update `commitApply` to handle user conflict choices; implement atomic oneof write (Pitfall A) for branch-switch overwrite rows; implement non-empty map overwrite via `mapReplaceRegistry`
- `src/components/form/fields/OneofField.tsx` — read-only: understand how `_selected` is tracked and how unregister fires on branch change; the Phase 26 atomic setValue approach bypasses this entirely (no mount-wait needed)

### Type reference
- `src/lib/types.ts` — `FieldSchema`, `FieldKind` (kind.type `'oneof'`, kind.branches) — needed to validate block oneof shape in `buildApplyPlan`
- `src/lib/blockApply.ts` — `ConflictItem.kind` union needs extending to cover `'oneof_branch_switch'` and `'oneof_dirty_subfield'` (or a single `'oneof'` with a sub-discriminator — planner chooses); `ApplyItemKind` may also need `'oneof'` added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildApplyPlan` in `src/lib/blockApply.ts` — pure function; extend with oneof and non-empty map handling (add `'oneof'` case after the existing `'map'` case)
- `ApplyPlan` / `ApplyItem` / `ConflictItem` types — `ConflictItem` kind union needs new oneof subtypes
- `ELIGIBLE_KINDS` in `blockApply.ts:61` — add `'oneof'` here to make the function eligible-set consistent; oneof block values that pass shape validation go through oneof-specific logic
- `mapReplaceRegistry.current` in `ProtoFormRenderer.tsx:122` — already wired; non-empty map overwrite calls the same `replace()` fn
- AlertDialog pattern (used in block library `BlockList.tsx`) — analogous UI pattern for `BlockApplyConflictDialog`
- `commitApply` in `ProtoFormRenderer.tsx:172` — currently iterates `plan.toApply`; needs to accept and apply conflict resolution choices from `FormPanel`

### Established Patterns
- Dirty-field guard: `methods.formState.dirtyFields[key]` truthy = skip; for oneof sub-fields, `dirtyFields` mirrors the nested form shape (`dirtyFields.payment?.card_number`)
- `shouldDirty: false` on all block apply `setValue` calls (Pitfall D) — established in Phase 12 and re-confirmed in Phase 25
- Atomic oneof `setValue` (Pitfall A): `setValue(fieldName, { _selected: branch, [branch]: value }, { shouldDirty: false })` — documented in STATE.md; prevents OneofField unregister race
- `onRegisterReplace` callback prop style (MapField → ProtoFormRenderer) — established in Phase 25; no new registry pattern needed

### Integration Points
- `FormPanel.tsx:76` — currently: `applyBlockRef.current.commitApply(plan)` called immediately after `buildPlan`. Phase 26: gate on `plan.conflicts.length > 0` → show dialog → call `commitApply` with choices after user decides
- `src/lib/blockApply.ts:130` — `conflicts: []` hardcoded in Phase 25; Phase 26 populates this array with `ConflictItem` entries for oneof and non-empty map cases
- `ApplyBlockRef` type (`blockApply.ts:48`) — `commitApply: (plan: ApplyPlan) => void` may need signature update to `commitApply(plan: ApplyPlan, choices: ConflictChoices) => void`; planner decides

</code_context>

<specifics>
## Specific Ideas

No specific references — standard shadcn/ui AlertDialog approach for the conflict dialog, consistent with the existing block delete confirmation in the block library.

</specifics>

<deferred>
## Deferred Ideas

- Block apply in JSON mode (BLK-EXT-FUTURE-01) — guarded off; complex field type support deferred
- Recursive nested-message merge from a block (BLK-EXT-FUTURE-02) — requires schema-aware deep merge

</deferred>

---

*Phase: 26-Block Apply — Conflict Prompt + Oneof*
*Context gathered: 2026-05-25*
