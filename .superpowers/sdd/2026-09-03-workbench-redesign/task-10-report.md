# Task 10 — Plans view: report

**Worktree:** `/Users/majesnix/gits/tap/.claude/worktrees/agent-ad50551a09b233837`
**Branch:** `worktree-agent-ad50551a09b233837` (based on `f88e5cb`)
**Commit:** single commit at the branch head — `feat(plans): step cards, run bar card and reply panel` (30 files, +2857/−1751, this report included)

## What was implemented

The Plans view was rebuilt onto the Workbench design (handoff §5 and §2 "Plans mode").

- **`src/components/sidebar/PlansSidebar.tsx`** (`git mv` of `plans/PlanListPanel.tsx`) — `p-[16px_12px] gap-1.5` column, `SectionLabel` "Plans" + violet 24px `IconButton` "New plan", plan cards `p-[10px_12px] rounded-lg` (`bg-primary/12` selected, `hover:bg-card` otherwise) with `text-13 font-medium` name over `text-11 text-ghost` `{n} steps` (+ ` · ran HH:MM` for the plan that ran, from `lastRunPlanId`/`lastRunAt` passed by `PlanView`), hover-revealed 22px kebab (Rename/Duplicate/Delete), inline create/rename rows and the delete `AlertDialog` unchanged in behaviour, plus the sidebar footer reproduced inline (`getVersion` + `RELEASE_NAME` + `ClearLocalDataButton`).
- **`src/components/plans/PlanRunBar.tsx`** — run bar card `flex items-center gap-3 rounded-xl border bg-card p-[14px_18px]`: name `text-16 font-semibold tracking-[-.01em]` over `text-12 text-ghost` "`{n} steps · last run HH:MM · 3.9 s`" (unknown parts omitted); result pill (`CircleCheck` success / `CircleAlert` danger, "{succeeded} / {total} succeeded"); while running an amber mono progress chip "{done} / {total} · {sending|waiting|pending}" replaces it; `Switch` + "Stop on error"; `Button size="md"` `Play` "Run plan" / "Run again", running → `variant="destructive"` `Square` "Stop". All three non-Stop states now share the same `canRun` gate + disabled tooltip (previously "Re-run Plan" was never disabled — a read-only profile could re-run).
- **`src/components/plans/StepCard.tsx`** (new) — `useSortable` card, header grid `16px 28px 1fr auto` `p-[14px_16px]`, grip (drag listeners on the grip only), numbered circle with per-status tones, name `text-14 font-semibold` + `StepStatusBadge`, mono meta row `type … · to … · then …` with keys in `text-ghost`, right column duration + "View reply", hover kebab (`aria-label="Step options"`) with inline rename, `border-border-strong` when selected, `opacity-50` while dragging, `StepEditor` rendered when selected. Keeps the D-10 auto-scroll (guarded `scrollIntoView?.`) for the step the runner is on.
- **`src/components/plans/StepCardList.tsx`** (`git mv` of `StepListPanel.tsx`) — `flex flex-col gap-2.5` `SortableContext`, one `StepCard` per step, `AddStepButton`, the delete `AlertDialog` at the list root, both pickers, and the `PlanEmptyState` for an empty plan.
- **`src/components/plans/AddStepButton.tsx`** (new) — dashed `h-11` row "＋ Add step — blank · from history · from block" opening a `DropdownMenu` with the three sources.
- **`src/components/plans/StepEditor.tsx`** (`git mv` of `StepFieldEditor.tsx`) — body `flex flex-col gap-3.5 border-t border-hairline p-[14px_16px_16px_72px]`; grid 1 = Proto file / Message type / Response mode selects (`size="sm"`), grid 2 = Target / Delay-or-Timeout (with "ms" suffix) / Reply queue, then the fields row "Fields · {n} fields · {n} empty" with the `Dices` randomizer and the `Pencil` "Edit fields" toggle that reveals the field form. All persistence logic (reset rules, 300 ms debounce, stale-step guard, randomize semantics) is byte-for-byte the old code.
- **`src/components/plans/StepReplyPanel.tsx`** (new) — header `SectionLabel` "Step N · reply" + "Reply feed · N"; reply card (teal tile, type, `+{ms} ms`, mono meta `routingKey · corr:id · N B`, `DecodedTree` block, "Decoded as …" / "Hex" opening a `Dialog` with `HexDump`); dashed notes for the no-wait, no-reply-yet and no-step-selected cases; reply-feed rows rendered inline in the Activity row style (teal tile, type, `DECODED`/`NO DECODER`/`ERROR` tag, mono `routingKey · HH:MM:SS.mmm · size`).
- **`src/components/plans/PlanView.tsx`** — `AppShell` with `PlansSidebar` / run-bar + `DndContext`(distance 4) + `StepCardList` + `DragOverlay` / `StepReplyPanel`. Local `selectedPlanId`, `selectedStepId`, effective step = `activeStepId` during a run, `usePlanProtoAutoLoad`, `useGlobalShortcuts` at the top, plus run tracking (start/end via `runningPlanId` transitions) and per-step `performance.now()` durations (sending → done/error) fed to the cards and the reply panel.
- **`StepStatusBadge.tsx`** — now a `Tag size="xs"` (DONE/SENDING/WAITING/ERROR/PENDING, success/warning/danger/neutral tones, spinner kept for waiting, error tooltip kept).
- **`step-editor/`** — `LiveCombobox` restyled to `h-[34px] font-mono text-[12.5px]`; `TargetSection` reduced to a single grid cell (`SegmentedControl` Queue|Exchange + combobox, routing key beneath in exchange mode); `ResponseModeSection` split into `useResponseMode` + `ModeSelect` (grid 1) + `ModeParams` (two grid-2 cells as a fragment).
- Deleted: `PlanDetailPanel.tsx`, `StepReplyView.tsx`, `PlanReplyFeedTab.tsx`, `response/ResponseHexSection.test.tsx`. `response/ResponseHexSection.tsx` was **kept** per the controller's decision 1 (`MessageFeedRow` still imports it).
- `src/App.tsx` already passed `header` to `PlanView`; no change was needed.

## Tests and results

TDD order: the three brief-mandated test files were written first and run red before any implementation.

RED (`pnpm exec vitest run src/components/plans src/components/sidebar/__tests__/PlansSidebar.test.tsx`):

```
Test Files  6 failed (6)
     Tests  24 failed | 8 passed (32)
FAIL StepCard.test.tsx / StepReplyPanel.test.tsx / PlansSidebar.test.tsx (module not found)
FAIL PlanRunBar.test.tsx (5) · StepStatusBadge.test.tsx (9) · PlanView.test.tsx
```

GREEN (final):

| command | result |
|---|---|
| `pnpm test` | **71 files / 791 tests passed** |
| `pnpm exec tsc --noEmit` | **No errors found** |
| `pnpm lint` | **0 errors, 23 warnings** (same 23 as the baseline) |
| `pnpm exec vitest run --coverage` | statements **79.07** (≥78) · branches **71.32** (≥70) · functions **78.3** (≥76) · lines **80.45** (≥79) |

New/updated test files:

- `src/components/plans/__tests__/StepCard.test.tsx` — 24 tests (index circle, name style, five status pills + tones, meta row for all three response modes and both target kinds, duration, View reply, header select, kebab actions, rename commit/Escape, editor only when selected, selected border, error tooltip).
- `src/components/sidebar/__tests__/PlansSidebar.test.tsx` — 10 tests (label, rows + step counts, "ran HH:MM", select, inline create + Escape cancel, kebab actions, rename, delete confirm + selection reset, empty state, footer).
- `src/components/plans/__tests__/StepReplyPanel.test.tsx` — 11 tests (header, three notes, reply card content, duration omitted when unknown, Hex dialog, undecoded reply, feed rows + tags + meta).
- `src/components/plans/__tests__/StepCardList.test.tsx` — 7 tests, **written after** the implementation (not TDD) as a regression guard for the rewired add/delete/rename paths and the empty state.
- `PlanRunBar.test.tsx` (10) and `StepStatusBadge.test.tsx` (12) rewritten for the new copy/classes; `PlanView.test.tsx` re-mocked (`PlansSidebar`, `PlanRunBar`, `StepCardList`, `StepReplyPanel`) and given an empty-state test — the mod+O shortcut test still passes.

## Files changed

Renamed: `plans/PlanListPanel.tsx → sidebar/PlansSidebar.tsx`, `plans/StepListPanel.tsx → plans/StepCardList.tsx`, `plans/StepFieldEditor.tsx → plans/StepEditor.tsx` (all via `git mv`).
Created: `plans/StepCard.tsx`, `plans/AddStepButton.tsx`, `plans/StepReplyPanel.tsx`, `plans/PlanEmptyState.tsx`, `plans/step-editor/EditorField.tsx`, `plans/step-editor/stepFields.tsx`, 4 test files.
Modified: `plans/PlanView.tsx`, `PlanRunBar.tsx`, `StepStatusBadge.tsx`, `step-editor/{LiveCombobox,TargetSection,ResponseModeSection}.tsx`, `PlanView.test.tsx`, `PlanRunBar.test.tsx`, `StepStatusBadge.test.tsx`.
Deleted: `plans/PlanDetailPanel.tsx`, `plans/StepReplyView.tsx`, `plans/PlanReplyFeedTab.tsx`, `response/ResponseHexSection.test.tsx`.
Largest file: `StepEditor.tsx` at 317 lines; every file is under the ~350-line budget.

## Self-review

§5 elements: run bar card (name/meta, result pill, progress chip, stop-on-error switch, Run plan/Run again/Stop) ✅ · step card header grid, status pill, mono meta, duration, View reply, hover kebab ✅ · expanded step (two 3-column grids, "ms" suffix, "—" reply queue for no-wait, fields summary + "Edit fields" toggle, disabled fieldset at opacity .6) ✅ · dashed add-step row with the three-source dropdown ✅ · right panel (header, reply card, dashed note, reply feed rows) ✅ · empty states ✅. §2 plans sidebar (label + violet plus, plan cards with "ran HH:MM", kebab, footer) ✅.

Deviations from the brief, all deliberate:

1. `StepReplyPanel` takes an extra optional `durationMs` — the brief's interface had no source for the "+412 ms" its own test required. `PlanRunBar` likewise takes `lastRunAt`/`lastRunMs` from `PlanView`'s run tracking.
2. Three files beyond the brief's list: `PlanEmptyState.tsx` (shared by `PlanView` and `StepCardList` — §5 gives both the same empty state; a cross-import would have been circular), `step-editor/EditorField.tsx` (the labelled grid cell used by four call sites) and `step-editor/stepFields.tsx` (`renderField` + `safeParseFieldValues` + the empty-value predicate, relocated so `StepEditor.tsx` stays under the line budget).
3. `PlansSidebar.test.tsx` lives in `src/components/sidebar/__tests__/` (the path named by the brief's Step-2 verify command, and co-located with the moved component) rather than `plans/__tests__/`.
4. `StepEditor`'s `step` prop is non-nullable now: the editor only exists inside a selected card, so the old "Select a step to edit it." empty state is gone.
5. There is no click-to-collapse: clicking a card's header always selects it (see the self-review fixes below).
6. `paneMode`/`setPaneMode` are no longer used by the Plans view (the reply panel is always visible); the store field is untouched for Task 11.

## Concerns

- **Empty-plan copy.** Per the brief ("copy unchanged"), a plan with zero steps shows "Select a plan to get started" / "Choose a plan from the list…" above the add-step row, which reads oddly when a plan *is* selected. Worth a copy pass in Task 11.
- **`ResponseHexSection.tsx`** now has no test (its test was deleted per decision 1) and shows 0 % coverage until the sibling task retires it.
- **Reply-queue guidance** ("Leave empty and Tap creates a private reply queue…") no longer fits the 3-column grid; it is preserved as a `title` tooltip on the "Reply queue" label. If that warning matters it deserves a real popover.
- **Inline stand-ins.** The reply-feed rows duplicate Task 8's `ActivityRow` markup and the sidebar footer duplicates Task 5's `SidebarFooter`; both are ready to be swapped by the controller.
- **a11y nit.** dnd-kit's `attributes` (which include `role="button"`) sit on the grip span inside the header `<button>`, as they did inside the old row. Harmless in the DOM but worth cleaning up if the shell gets an a11y pass.
- **`ClearLocalDataButton`** still renders a 32 px ghost button rather than the 24 px footer icon the design calls for — it is a shared component owned by Task 5.
- **One targeted `eslint-disable`** (`react-hooks/set-state-in-effect`) on the per-step duration recording in `PlanView`; the warning count is unchanged from the baseline 23.
- **No app-level verification.** The Plans view needs Tauri IPC (`plugin-store`, `getVersion`, broker catalog), so it was verified only through jsdom tests, not by running the desktop app.
- **No collapse affordance.** An expanded step card can only be closed by selecting a different step. Worth a dedicated control in Task 11.
- The baseline coverage run raced the three `git mv`s and was lost, so only the final coverage numbers are reported; all four thresholds pass.


## Self-review fixes (post-review pass, folded into the same commit)

1. **"View reply" blanked the reply panel — fixed.** `StepCardList` had a select *toggle*
   (`onSelectStep(selected ? null : step.id)`), an addition of mine on top of the brief. Since
   "View reply" is a span inside the header button, clicking it on the (usually selected) card
   bubbled to the toggle, cleared `effectiveStepId` and made `StepReplyPanel` fall back to
   "Select a step to see its reply." — the exact opposite of what the control promises.
   `onSelect` now always selects the step. Two regression tests added:
   `StepCard.test.tsx` "'View reply' still selects when the card is already expanded" and
   `StepCardList.test.tsx` "clicking the expanded card keeps it selected".
2. **The reply panel could not scroll — fixed.** Only the feed `<ul>` scrolled, so a long
   `DecodedTree` clipped inside the fixed-height, `overflow-hidden` aside (the deleted
   `StepReplyView` had `flex-1 overflow-auto`). The reply card, the dashed notes and the feed now
   share one `min-h-0 flex-1 overflow-y-auto` column below the fixed header.

Re-verified after the fixes: `pnpm test` 71 files / **791 tests passed**, `pnpm exec tsc --noEmit`
clean, `pnpm lint` **0 errors / 23 warnings**, coverage **79.07 / 71.32 / 78.3 / 80.45**.
This report is committed alongside the code in the amended commit.
