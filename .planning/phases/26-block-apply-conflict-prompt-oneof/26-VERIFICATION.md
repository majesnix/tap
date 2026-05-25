---
phase: 26-block-apply-conflict-prompt-oneof
verified: 2026-05-25T17:30:00Z
status: complete
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Drag a block onto a map field that already has rows with a colliding key"
    expected: "Conflict dialog opens with one row for the colliding key (badge: 'map key'); setting to Overwrite then Apply updates the key's value, appends non-colliding block rows, and preserves non-colliding existing rows; Discard leaves everything unchanged"
    why_human: "Requires running Tauri dev app; tests exercise pure logic but not the AlertDialog open/close lifecycle or the mapReplaceRegistry integration at runtime"
  - test: "Drag a block onto a map field with a colliding key, leave choice as Skip, click Apply block"
    expected: "Colliding key's value unchanged (skip respected); non-colliding block rows are appended (nonCollidingBlockRows always applied regardless of skip); existing non-colliding rows preserved"
    why_human: "Scenario A2 unconditional-append behavior requires runtime verification through the full mapReplaceRegistry path"
  - test: "Drag a block targeting a different oneof branch than the currently active one"
    expected: "Conflict dialog opens with one row, badge 'branch switch', label 'Switch \"field\" from \"currentBranch\" to \"blockBranch\"'; choosing Overwrite + Apply switches the branch atomically; Discard leaves branch unchanged"
    why_human: "Branch-switch involves React form state (OneofField re-render + _selected update); cannot verify single-atomic-setValue behavior without runtime"
  - test: "Drag a block with no conflicts (empty fields or non-dirty fields)"
    expected: "No dialog opens; fields filled immediately (Phase 25 behavior preserved)"
    why_human: "Dialog conditional rendering (open=false vs not-rendered) requires visual runtime verification"
  - test: "Drag the same block twice with no form edits between drags (Pitfall D regression)"
    expected: "No false conflict dialog on second drag — fields were written with shouldDirty:false so remain non-dirty"
    why_human: "RHF dirty-field state after shouldDirty:false requires runtime verification to confirm no regression"
---

# Phase 26: Block Apply — Conflict Prompt + Oneof Verification Report

**Phase Goal:** Wire conflict resolution dialog and oneof support for block apply — users can resolve map-key collisions and oneof branch switches interactively when dragging blocks onto the form
**Verified:** 2026-05-25T17:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-03: buildApplyPlan lists 'oneof' in ELIGIBLE_KINDS | VERIFIED | `blockApply.ts:107-113` — ELIGIBLE_KINDS Set contains "oneof" literal |
| 2 | D-01: oneof block values with { _selected, branchName } shape are parsed | VERIFIED | `blockApply.ts:229-245` — reads `blockObj["_selected"]`, validates against branches |
| 3 | D-02: oneof without _selected or unrecognized branch → silent skip, NOT in unknownKeys | VERIFIED | `blockApply.ts:235-246` — early `continue` before unknownKeys path; tests pass for both cases |
| 4 | BLK-EXT-04: same-branch clean sub-fields → toApply kind 'oneof' with dotted-path fieldName | VERIFIED | `blockApply.ts:301-307` — `toApply.push({ fieldName: \`${key}.${subFieldName}\`, kind: "oneof" })`; test "fills oneof field when same branch" passes |
| 5 | BLK-EXT-04: same-branch dirty sub-field → ConflictItem kind 'oneof_dirty_subfield' | VERIFIED | `blockApply.ts:287-300` — dirty check via `dirtyForField[subFieldName] === true`; test passes |
| 6 | BLK-EXT-05: different-branch oneof → ConflictItem kind 'oneof_branch_switch' | VERIFIED | `blockApply.ts:259-275` — branch mismatch check with `currentSelectedBranch !== blockBranch`; test passes |
| 7 | BLK-EXT-03: non-empty map + ANY collision → NO toApply item; per-colliding-key ConflictItem; nonCollidingBlockRows carried | VERIFIED | `blockApply.ts:195-213` — `if (collidingRows.length > 0)` suppresses toApply, pushes conflict per row with `nonCollidingBlockRows: nonCollidingRows`; tests pass |
| 8 | D-04: map_key_collision ConflictItem carries nonCollidingBlockRows | VERIFIED | `blockApply.ts:209` — `nonCollidingBlockRows: nonCollidingRows` on every ConflictItem for field |
| 9 | ConflictItem.kind is the three-literal flat union | VERIFIED | `blockApply.ts:21-24` — `"map_key_collision" \| "oneof_dirty_subfield" \| "oneof_branch_switch"` |
| 10 | ConflictItem carries fieldLabel? and subFieldLabel? | VERIFIED | `blockApply.ts:56-58`, populated at conflict push sites lines 204, 273, 297-298 |
| 11 | ConflictChoices is Record<string, 'skip' \| 'overwrite'> with compound keys | VERIFIED | `blockApply.ts:67` — type declaration; FormPanel line 269-273 and ProtoFormRenderer lines 214, 247 use compound key format |
| 12 | ApplyBlockRef.commitApply signature accepts choices? | VERIFIED | `blockApply.ts:92` — `commitApply: (plan: ApplyPlan, choices?: ConflictChoices) => void` |
| 13 | All 17 tests pass | VERIFIED | `npx vitest run src/lib/blockApply.test.ts` — 17 pass, 0 fail |
| 14 | BLK-EXT-06: BlockApplyConflictDialog opens when plan.conflicts.length > 0 | VERIFIED | `FormPanel.tsx:94-97` — gate sets conflictPlan; `AlertDialog open={conflictPlan !== null}` at line 255 |
| 15 | Pitfall E: conflict rows default to skip; choices initialized to {} | VERIFIED | `FormPanel.tsx:68` — `useState<ConflictChoices>({})`, line 300 — `?? "skip"`, RadioGroup defaultValue behavior preserved |
| 16 | Apply calls commitApply(conflictPlan, conflictChoices) and closes dialog | VERIFIED | `FormPanel.tsx:348-351` — `commitApply(conflictPlan, conflictChoices)` then `setConflictPlan(null)` |
| 17 | Discard closes dialog without commitApply | VERIFIED | `FormPanel.tsx:340-345` — AlertDialogCancel onClick only calls `setConflictPlan(null)` |
| 18 | D-05: branch-switch overwrite → single atomic setValue with { _selected, [branch]: subValue } | VERIFIED | `ProtoFormRenderer.tsx:265-271` — single `methods.setValue(item.fieldName, { _selected: blockBranch, [blockBranch]: subValue }, { shouldDirty: false })` |
| 19 | D-06: branch-switch skip → no partial write | VERIFIED | `ProtoFormRenderer.tsx:251` — `if ((choices[choiceKey] ?? "skip") !== "overwrite") continue` |
| 20 | Pitfall D: all setValue in commitApply use { shouldDirty: false } | VERIFIED | `ProtoFormRenderer.tsx:188, 260, 270` — all three setValue calls carry `{ shouldDirty: false }` |
| 21 | BLK-EXT-03: map overwrite → single atomic mapReplaceRegistry call with merged rows | VERIFIED | `ProtoFormRenderer.tsx:210-239` — one `mapReplaceRegistry.current[fieldName]?.(merged)` call per field |
| 22 | BlockApplyConflictDialog is inline in FormPanel.tsx, NOT a separate file | VERIFIED | `FormPanel.tsx:254-358` — AlertDialog JSX is inline in the return fragment; no separate component file created |
| 23 | Row label formats match UI-SPEC | VERIFIED | `FormPanel.tsx:277-281` — map uses collisionKey, branch-switch uses currentBranch/blockBranch, dirty-subfield uses subFieldName |
| 24 | AlertDialogContent className='sm:max-w-lg'; AlertDialogCancel has autoFocus | VERIFIED | `FormPanel.tsx:256` — `className="sm:max-w-lg"`; line 341 — `autoFocus` |
| 25 | Singular/plural description text | VERIFIED | `FormPanel.tsx:260-263` — "1 field already has a value." vs "N fields already have values." |
| 26 | ROADMAP SC1: map collision dialog with per-key overwrite/skip | VERIFIED (code) | Detection in blockApply.ts; dialog in FormPanel.tsx; commit in ProtoFormRenderer.tsx — runtime UAT needed |
| 27 | ROADMAP SC2: same-branch oneof fill + dirty sub-fields listed as conflicts | VERIFIED (code) | `blockApply.ts:278-308`; FormPanel dialog; ProtoFormRenderer Phase B |
| 28 | ROADMAP SC3: different-branch confirmation + branch switch on overwrite | VERIFIED (code) | `blockApply.ts:259-275`; dialog row; ProtoFormRenderer lines 262-272 |
| 29 | ROADMAP SC4: all conflicts batched into one dialog with Apply/Cancel | VERIFIED | `FormPanel.tsx:255-358` — single AlertDialog, single Apply + Discard action |
| 30 | ROADMAP SC5: conflict rows default to skip | VERIFIED | `FormPanel.tsx:300` — `?? "skip"`; `ProtoFormRenderer.tsx:214, 251` — same guard |

**Score:** 17/17 PLAN must-have truths verified (all VERIFIED); all 5 ROADMAP success criteria VERIFIED at code level; 5 items require human runtime UAT

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/blockApply.ts` | Extended types, ELIGIBLE_KINDS with oneof, buildApplyPlan oneof + map-collision logic | VERIFIED | Exports ConflictItemKind, ConflictChoices, extended ConflictItem, updated ApplyBlockRef; ELIGIBLE_KINDS includes "oneof"; buildApplyPlan returns populated conflicts |
| `src/lib/blockApply.test.ts` | TDD suite covering all 6 new cases | VERIFIED | makeOneofField helper present; 17 total tests; all pass |
| `src/components/form/FormPanel.tsx` | BlockApplyConflictDialog inline, conflictPlan/conflictChoices state, onDragEnd gate | VERIFIED | Inline AlertDialog JSX; conflict state declarations; gate at line 94-99 |
| `src/components/form/ProtoFormRenderer.tsx` | Extended commitApply with choices param, atomic oneof write, atomic map merge, shouldDirty:false | VERIFIED | Phase A + Phase B; three overwrite branches; shouldDirty:false on all setValue |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| buildApplyPlan oneof branch | dirtyFields nested access | `(dirtyFields[key] as Record<string, unknown>)?.[subFieldName] === true` | VERIFIED | `blockApply.ts:282-283` — exact pattern present |
| ConflictItem.kind | ConflictChoices key format | compound key construction at conflict push sites | VERIFIED | FormPanel lines 269-273 and ProtoFormRenderer lines 214, 247 build keys consistently |
| buildApplyPlan map_key_collision | nonCollidingBlockRows on ConflictItem | only first collision item carries ref; commitApply reads from conflicts[0] | VERIFIED | `blockApply.ts:209`; `ProtoFormRenderer.tsx:235` |
| FormPanel.tsx onDragEnd | BlockApplyConflictDialog | setConflictPlan(plan); setConflictChoices({}) | VERIFIED | `FormPanel.tsx:95-96` |
| BlockApplyConflictDialog Apply button | applyBlockRef.current.commitApply | commitApply(conflictPlan, conflictChoices) | VERIFIED | `FormPanel.tsx:349` |
| ProtoFormRenderer commitApply Phase B map_key_collision | mapReplaceRegistry | single replace() call with merged = existing.map(overwrite) + nonCollidingBlockRows | VERIFIED | `ProtoFormRenderer.tsx:210-239` |
| commitApply oneof branch-switch | methods.setValue (atomic) | single setValue call with { _selected, [branch]: value, shouldDirty:false } | VERIFIED | `ProtoFormRenderer.tsx:267-271` |

### Data-Flow Trace (Level 4)

Not applicable to this phase — artifacts are logic/behavior components (pure function + state management), not data-fetching components. There is no external data source; all state is local RHF form state.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 17 blockApply tests pass | `npx vitest run src/lib/blockApply.test.ts` | 17 pass, 0 fail | PASS |
| Full suite has no regressions | `npx vitest run` | 506 pass, 0 fail | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | 0 errors | PASS |

### Probe Execution

No probe scripts found or declared for this phase. Step 7c: SKIPPED (no probe files in `scripts/`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BLK-EXT-03 | 26-01, 26-02 | Map collision dialog with per-key overwrite/skip | SATISFIED | blockApply.ts collision detection; FormPanel dialog; ProtoFormRenderer atomic merge |
| BLK-EXT-04 | 26-01, 26-02 | Oneof same-branch: fill clean, conflict dirty sub-fields | SATISFIED | blockApply.ts lines 278-308; test "emits oneof_dirty_subfield conflict" passes |
| BLK-EXT-05 | 26-01, 26-02 | Oneof different-branch confirmation + switch | SATISFIED | blockApply.ts lines 259-275; ProtoFormRenderer lines 262-272 |
| BLK-EXT-06 | 26-02 | All conflicts batched in one dialog with Apply/Cancel | SATISFIED | FormPanel.tsx single AlertDialog with all conflict rows mapped; Apply and Cancel actions wired |

All four requirement IDs declared in plan frontmatter are SATISFIED. No orphaned requirements found (traceability table in REQUIREMENTS.md maps exactly BLK-EXT-03/04/05/06 to Phase 26).

Note: REQUIREMENTS.md traceability table still shows these as "Pending" — this reflects the pre-phase state of the file and is a documentation artifact, not a code failure.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No anti-patterns found | — | — | — | — |

Scanned for TBD/FIXME/XXX (zero matches), console.log (zero matches), return null/return []/return {} (one `return null` at ProtoFormRenderer:357 is the legitimate `default:` case in the field-type dispatch switch — not a stub). No empty implementations, no hardcoded empty props.

### Human Verification Required

#### 1. Map Key Collision — Overwrite Path (BLK-EXT-03 / Scenario A)

**Test:** Run `npm run tauri dev`. Load a .proto with a map field (e.g. `labels: map<string, string>`). Add entries: `env=prod`, `region=us`. Create a block `{ "labels": [{ "key": "env", "value": "staging" }, { "key": "team", "value": "infra" }] }`. Drag the block onto the form drop zone.
**Expected:** Conflict dialog opens with one row for key "env" (badge: "map key"), defaulting to Skip. Set "env" to Overwrite, click "Apply block". Result: `env=staging`, `region=us` preserved, `team=infra` appended. Dialog closes.
**Why human:** Requires Tauri dev runtime; tests verify pure logic but not AlertDialog lifecycle or mapReplaceRegistry field-array integration at runtime.

#### 2. Map Key Collision — Skip-All with Non-Colliding Rows (BLK-EXT-03 / Scenario A2)

**Test:** Same setup as Scenario A. Drag block. Leave "env" row on Skip (default). Click "Apply block".
**Expected:** `env=prod` unchanged (skip respected); `region=us` unchanged (existing non-colliding row); `team=infra` ADDED (non-colliding block row always applied unconditionally). Dialog closes.
**Why human:** The unconditional `nonCollidingBlockRows` append path in Phase B runs even when `overwriteSet` is empty — this invariant requires runtime verification through mapReplaceRegistry.

#### 3. Oneof Branch-Switch (BLK-EXT-05 / Scenario B)

**Test:** Load a .proto with a oneof field (e.g. `payment: oneof { string card_number = 1; string bank_transfer = 2; }`). Select `card_number` branch and fill it. Create a block `{ "payment": { "_selected": "bank_transfer", "bank_transfer": "IBAN123" } }`. Drag block.
**Expected:** Dialog opens with one row — badge "branch switch", label `Switch "payment" from "card_number" to "bank_transfer"`. Choose Overwrite, click Apply. Result: oneof switches to `bank_transfer` branch with value "IBAN123". Dialog closes.
**Why human:** Branch-switch involves OneofField re-render and RHF internal state (unregister/register cycle); single atomic setValue is verified in code but behavior at runtime needs confirmation.

#### 4. No Conflict (Regression Guard / Scenario C)

**Test:** Load form with empty fields. Create a block matching scalar/enum fields that are not dirty. Drag block.
**Expected:** No dialog opens; fields filled immediately (Phase 25 behavior unchanged).
**Why human:** Dialog conditional rendering when `open=false` vs not-rendered requires visual verification.

#### 5. Pitfall D Regression Check (Scenario E)

**Test:** Apply a block with no conflicts (Scenario C). Drag the same block again immediately without editing any fields.
**Expected:** No dialog on second drag — fields were applied with `shouldDirty:false` and remain non-dirty; second drag also applies cleanly without triggering false conflict rows.
**Why human:** RHF `dirtyFields` state after `shouldDirty:false` requires runtime observation.

### Gaps Summary

No code gaps identified. All 17 PLAN must-have truths are VERIFIED in the codebase. All 4 requirement IDs (BLK-EXT-03/04/05/06) are implemented. All 5 ROADMAP success criteria are satisfied at the code level. TypeScript compiles with 0 errors. All 506 tests pass (17 blockApply-specific, 489 others).

The `human_needed` status is driven by the blocking `checkpoint:human-verify` task in Plan 26-02 (Task 3), which documents 5 scenarios that require the Tauri dev application to be running to verify dialog lifecycle, field-array integration, and branch-switch behavior at runtime.

---

_Verified: 2026-05-25T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
