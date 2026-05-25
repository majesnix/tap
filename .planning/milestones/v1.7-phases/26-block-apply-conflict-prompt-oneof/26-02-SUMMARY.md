---
phase: 26-block-apply-conflict-prompt-oneof
plan: "02"
subsystem: ui
tags: [react, block-apply, conflict-dialog, oneof, map-collision, alert-dialog, radio-group, shadcn, dnd-kit]
dependency_graph:
  requires:
    - phase: 26-01
      provides: "ConflictItemKind, ConflictChoices, ConflictItem types; buildApplyPlan oneof + map-collision detection; ApplyBlockRef.commitApply with choices? param"
    - phase: 25-02
      provides: "ApplyBlockRef type, buildPlan/commitApply two-phase API, mapReplaceRegistry, FormPanel onDragEnd wiring"
  provides:
    - BlockApplyConflictDialog inline JSX in FormPanel.tsx
    - conflictPlan/conflictChoices state + onDragEnd conflict gate in FormPanel.tsx
    - commitApply Phase B with three overwrite branches (map atomic merge, oneof_dirty_subfield, oneof_branch_switch)
    - Pitfall D fix: all setValue calls in commitApply now use { shouldDirty: false }
  affects:
    - FormPanel.tsx (conflict dialog state + onDragEnd gate)
    - ProtoFormRenderer.tsx (commitApply two-phase with choices)
tech-stack:
  added: []
  patterns:
    - "Inline JSX instead of nested component function to avoid re-mount on state change"
    - "Phase A / Phase B split in commitApply — toApply items first, then conflict resolutions"
    - "Unconditional map merge in Phase B — always appends nonCollidingBlockRows even when all collisions skipped"
    - "Single atomic setValue for oneof branch-switch (Pitfall A prevention)"
key-files:
  created: []
  modified:
    - src/components/form/FormPanel.tsx
    - src/components/form/ProtoFormRenderer.tsx
key-decisions:
  - "Root cause of 'dialog never opens': worktree was branched from a pre-Phase-25 commit (06a4ae1) and lacked all Phase 25/26 changes — FormPanel had old applyBlockRef type (fn returning string[]) instead of ApplyBlockRef ({buildPlan, commitApply}); fixed by cherry-picking Phase 25 and 26 commits"
  - "Inline dialog JSX in FormPanel return instead of nested function component — avoids re-mount on setConflictChoices (which would reset radio focus and Radix portal state)"
  - "Phase B map merge runs unconditionally (no early exit when overwriteSet is empty) — ensures nonCollidingBlockRows always appended (Scenario A2 invariant)"
  - "shouldDirty: false on ALL setValue calls in commitApply (Phase A + Phase B) — Pitfall D fix prevents false dirty-field conflicts on subsequent block drags"
  - "Template literal path for oneof_dirty_subfield cast to Parameters<typeof methods.setValue>[0] to avoid RHF generic inference failure"
patterns-established:
  - "BlockApplyConflictDialog: inline JSX gated on conflictPlan !== null, not a nested function component"
  - "ConflictChoices default: initialized to {} (empty); read with ?? 'skip' everywhere — Pitfall E compliance"
  - "Map Phase B: group by fieldName → compute overwriteSet → merge existing rows → append nonCollidingBlockRows → single mapReplaceRegistry.current[fieldName](merged) call"
requirements-completed:
  - BLK-EXT-03
  - BLK-EXT-04
  - BLK-EXT-05
  - BLK-EXT-06

duration: ~25min
completed: "2026-05-25"
---

# Phase 26 Plan 02: Conflict Dialog UX + commitApply Phase B Summary

**End-to-end block-apply conflict resolution: AlertDialog shows per-row skip/overwrite choices for map key collisions and oneof branch switches; Apply writes atomic map merge + oneof branch switch; Discard leaves form unchanged**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-25T16:30:00Z
- **Completed:** 2026-05-25T16:55:00Z
- **Tasks:** 3 (Task 1, Task 2, Task 3/fix)
- **Files modified:** 2

## Accomplishments

- Diagnosed root cause of "dialog never opens": worktree branched from pre-Phase-25 commit `06a4ae1` had old FormPanel code (applyBlockRef typed as simple function, not `ApplyBlockRef` object), so `buildPlan` was never called and `plan.conflicts` was never populated.
- Fixed by cherry-picking Phase 25 and Phase 26 source commits from prior worktree branch (`worktree-agent-a565a98a093926567`).
- After cherry-picks: inline `BlockApplyConflictDialog` JSX in FormPanel opens when `plan.conflicts.length > 0`; skips entirely when `plan.conflicts.length === 0` (Phase 25 path preserved).
- `commitApply` extended with optional `choices?: ConflictChoices` param; Phase A uses `{ shouldDirty: false }` on all `setValue` calls (Pitfall D fix).
- Phase B map_key_collision: unconditional atomic `mapReplaceRegistry.current[fieldName](merged)` call per conflicting field — overwrites chosen keys, always appends `nonCollidingBlockRows` (Scenario A2 invariant).
- Phase B oneof_branch_switch: single atomic `setValue(fieldName, { _selected, [branch]: value }, { shouldDirty: false })` — prevents Pitfall A (unregister race).
- Phase B oneof_dirty_subfield: fine-grained dotted-path `setValue` on the specific sub-field only.
- TypeScript: 0 errors. blockApply tests: 51/51 pass. Full suite: 1487/1489 pass (2 pre-existing Phase 9 failures unrelated to this phase).

## Task Commits

Phase 25 foundation (cherry-picked from prior worktree):
1. **test(25-01): buildApplyPlan RED phase** - `d82e32f`
2. **feat(25-01): implement buildApplyPlan GREEN phase** - `74ca5bf`
3. **feat(25-02): FormPanel — switch to ApplyBlockRef type, two-phase onDragEnd** - `7d4e676`
4. **feat(25-02): ProtoFormRenderer — mapReplaceRegistry, two-phase applyBlockRef** - `3844cfb`
5. **feat(25-02): MapField — onRegisterReplace prop and registration useEffect** - `ef31740`
6. **test(260525-jw3): unknownKeys separation RED** - `ca2be88`
7. **feat(260525-jw3): separate unknownKeys from message-kind keys** - `70404d6`
8. **fix(260525-jw3): toast uses plan.unknownKeys** - `e61c513`

Phase 26-01 foundation (cherry-picked):
9. **test(26-01): oneof + map-collision RED** - `d3fb050`
10. **feat(26-01): extend blockApply with oneof + map-collision GREEN** - `887aae5`

Phase 26-02 tasks (cherry-picked):
11. **feat(26-02): add conflict dialog state and onDragEnd gate to FormPanel** - `5f1eb94`
12. **feat(26-02): extend commitApply with choices param, three overwrite branches, shouldDirty:false** - `331ddaf`

## Files Created/Modified

- `src/components/form/FormPanel.tsx` — ApplyBlockRef import; `conflictPlan`/`conflictChoices` state; conflict gate in `onDragEnd`; inline AlertDialog JSX with per-row RadioGroup, Badge, current value preview; Apply/Discard actions
- `src/components/form/ProtoFormRenderer.tsx` — `ConflictChoices`/`ConflictItem` imports; `buildApplyPlan` wired into `buildPlan`; `commitApply` Phase A with `{ shouldDirty: false }` + Phase B map merge and oneof branches; `mapReplaceRegistry` + `handleRegisterReplace`
- `src/lib/blockApply.ts` — `buildApplyPlan` pure function with oneof and map-collision detection
- `src/lib/blockApply.test.ts` — 51 tests covering all branches
- `src/components/form/fields/MapField.tsx` — `onRegisterReplace` prop and `replace` registration useEffect

## Decisions Made

- **Root cause was missing foundation commits**: The worktree had `applyBlockRef` typed as `((blockValues) => string[]) | null` (Phase 12 code), not `ApplyBlockRef | null`. Since `buildPlan` was never called, `plan.conflicts` was never populated, and `setConflictPlan` was never called. The fix was cherry-picking Phase 25 and 26 commits.

- **Inline JSX vs nested component**: AlertDialog JSX is inlined in FormPanel's return fragment, not wrapped in a named function component. A named function component defined inside a parent body gets a new React type on every re-render → full unmount/remount whenever `setConflictChoices` fires → lost radio focus, Radix portal animation restarts. Inline JSX uses the same closures with no re-mount churn.

- **Unconditional map Phase B merge**: `nonCollidingBlockRows` must always be appended even when the user skips all colliding rows. No early exit when `overwriteSet` is empty — this satisfies Scenario A2 (skip-all still adds non-colliding block rows).

- **shouldDirty: false on all commits**: Phase A now passes `{ shouldDirty: false }` to all `setValue` calls, fixing Pitfall D regression from Phase 25. Block-filled fields remain non-dirty, allowing re-drag without triggering false conflict rows.

## Deviations from Plan

### Auto-adapted Issues

**1. [Rule 3 - Blocking] Worktree missing Phase 25 and Phase 26 foundation commits**
- **Found during:** Initial diagnosis of "dialog never opens"
- **Issue:** The worktree was branched from `06a4ae1` (pre-Phase-25). FormPanel had the old Phase 12 `applyBlockRef` type (a plain function returning `string[]`), not the `ApplyBlockRef` object with `{buildPlan, commitApply}`. Since `buildPlan` was never called, `plan.conflicts` was never populated, and the conflict gate was unreachable.
- **Fix:** Cherry-picked 12 source commits from `worktree-agent-a565a98a093926567` covering Phase 25-01, 25-02, jw3 fix, 26-01, and 26-02 tasks.
- **Files modified:** FormPanel.tsx, ProtoFormRenderer.tsx, MapField.tsx, blockApply.ts, blockApply.test.ts
- **Verification:** TypeScript 0 errors; 51/51 blockApply tests pass; 1487/1489 full suite pass (2 pre-existing)

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** Cherry-pick was necessary to bring worktree up to the state expected by the resume instructions. No scope creep — only pre-existing commits were applied.

## Issues Encountered

- Pre-existing test failures: 2 tests in "Phase 9 — Routing Key Autocomplete" fail with "Unable to find a label with the text of: Routing key combobox". These were failing before any changes on this worktree branch. Out of scope for this phase.

## Known Stubs

None. The conflict dialog is fully wired: drag → buildPlan → conflicts → dialog → user choice → commitApply Phase B.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are local React state and UI rendering. T-26-03 through T-26-SC threat register entries are accepted as analyzed in plan threat model.

## Next Phase Readiness

- Full conflict resolution flow working: map key collision, oneof dirty subfield, oneof branch switch
- Requirements BLK-EXT-03/04/05/06 delivered
- Ready for UAT re-verification in Tauri dev

## Self-Check

- [x] FormPanel.tsx has `ApplyBlockRef` type, `conflictPlan`/`conflictChoices` state, conflict gate in `onDragEnd`, inline AlertDialog JSX
- [x] ProtoFormRenderer.tsx has `commitApply` Phase A + Phase B with three overwrite branches
- [x] blockApply.ts has `buildApplyPlan` with map-collision and oneof detection
- [x] TypeScript compiles cleanly (0 errors)
- [x] 51/51 blockApply tests pass
- [x] 1487/1489 full suite (2 pre-existing Phase 9 failures unrelated)
- [x] Cherry-pick commits `5f1eb94` and `331ddaf` in git log

---
*Phase: 26-block-apply-conflict-prompt-oneof*
*Completed: 2026-05-25*
