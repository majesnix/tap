# Phase 26: Block Apply — Conflict Prompt + Oneof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 26-Block Apply — Conflict Prompt + Oneof
**Areas discussed:** Oneof block JSON shape, Branch-switch dialog UX

---

## Oneof block JSON shape

### Question 1: What format should a block use for a oneof field?

| Option | Description | Selected |
|--------|-------------|----------|
| RHF-native (strict) | `{ payment: { _selected: "card_number", card_number: "..." } }` — exact match to form state; `_selected` required | ✓ |
| Key-inferred (lenient) | `{ payment: { card_number: "..." } }` — branch inferred from first matching key | |
| Both accepted | If `_selected` present → use it; otherwise infer | |

**User's choice:** RHF-native (strict)
**Notes:** Saves from form state naturally produce this shape. No ambiguity about which branch is intended.

### Question 2: What should happen when `_selected` is missing or unrecognized?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent skip (like ineligible kinds) | Field quietly ignored — no toast, no conflict row | ✓ |
| Surface as unknownKey | Field name appears in unknownKeys — toast warning | |
| Separate warning toast | Dedicated toast: "oneof field X: missing _selected" | |

**User's choice:** Silent skip
**Notes:** Consistent with how `'message'` kind fields are handled — schema mismatch = silent skip; does NOT appear in `unknownKeys`.

---

## Branch-switch dialog UX

### Question 1: How should a different-branch block appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Integrated into batched conflict dialog | Branch-switch as a special conflict row in the same dialog as all other conflicts (BLK-EXT-06) | ✓ |
| Separate preliminary modal | "Switch branch?" confirmation appears before the main conflict dialog | |
| Always confirm separately | Branch-switch always gets its own modal regardless of other conflicts | |

**User's choice:** Integrated into batched conflict dialog
**Notes:** One dialog for all conflicts (BLK-EXT-06). Branch-switch row shows "switch [field] from [currentBranch] to [blockBranch]", defaults to skip.

### Question 2: What does "overwrite" on a branch-switch row apply?

| Option | Description | Selected |
|--------|-------------|----------|
| Switch branch + apply sub-field values atomically | Single atomic `setValue` with entire oneof object — Pitfall A approach | ✓ |
| Switch branch only, sub-field conflicts in second dialog | Branch switches first, then field-level conflicts follow | |
| You decide | Let the planner pick the mechanism | |

**User's choice:** Switch branch + apply all sub-field values atomically
**Notes:** `setValue(fieldName, { _selected: newBranch, [newBranch]: blockSubValue }, { shouldDirty: false })` — avoids mount-timing issues (Pitfall A). All or nothing for the oneof field. Skipping the branch-switch row discards all block values for that oneof field.

---

## Claude's Discretion

- **commitApply signature**: planner decides whether to extend to `commitApply(plan, choices)` or have `FormPanel` merge choices into a modified plan before calling existing `commitApply`
- **ConflictItem kind extension**: planner decides whether to use `'oneof_branch_switch'` + `'oneof_dirty_subfield'` subtypes or a single `'oneof'` with a discriminator field

## Deferred Ideas

- Block apply in JSON mode (BLK-EXT-FUTURE-01)
- Recursive nested-message merge from a block (BLK-EXT-FUTURE-02)
