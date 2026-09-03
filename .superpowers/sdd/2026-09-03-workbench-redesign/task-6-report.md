# Task 6 — Request card: implementation report

**Worktree:** `/Users/majesnix/gits/tap/.claude/worktrees/agent-a0049b95ad89d7068`
**Branch:** `worktree-agent-a0049b95ad89d7068` (based on `f88e5cb`)
**Commit:** `27d775f feat(compose): request card merges the form, destination, properties and send`

## What was implemented

The legacy publish bar, form panel, AMQP properties sheet and hex preview are now one Request card
under `src/components/compose/`.

Pure modules
- `destination.ts` — `TargetMode`, `buildPublishArgs` (moved verbatim from `PublishBar.tsx:57-70`),
  `isAuthError`, `isHintExchange`, `routingKeyHint`.
- `propertiesSummary.ts` — `SummaryPart`, `summarizeProperties`. "defaults" is a whole-object
  comparison against `{...INITIAL_PROPERTIES, headers: []}`; otherwise content type (only when
  non-default, mono), delivery mode (always), `ttl {n} ms`, `corr` + id, `reply-to` + queue and the
  pluralised header count.
- `src/lib/bytes.ts` gains `hexToBytes` (inverse of `base64ToHex`).

Hooks
- `useDestination.ts` — mode/target/routing key state, catalog fetch with the 401 discrimination
  (auth error surfaced, everything else falls back to manual entry), binding suggestions with the
  D-10 silent fallback and the stale-request guard, and `queueDepth` via `fetchQueueDepth` with its
  own cancelled guard (null in exchange mode).
- `usePublish.ts` — the whole send pipeline from `PublishBar.tsx:216-335`: re-encode from
  `latestValues`, publish, outcome + `outcomeAt`, auto-dismiss (ack 3 s, returned/nack 5 s, timeout
  never), production confirmation, history entries now carrying `outcome`, `correlationId` and
  `replyTo`, `canSend` / `readOnly` / `disabledReason`, and the `sendRequested` signal for mod+enter.
- `useRequestForm.ts` — FormPanel's state without the JSX: 200 ms encode debounce with the tagged
  values guard, draft save/restore, `hasDraft`, JSON mode round trip, clear/randomize, the block
  drop monitor with its conflict plan, and the `mod+shift+r` / `mod+enter` hotkeys.

Components
- `RequestCard.tsx` (header, destination strip, optional properties section, form or JSON body,
  footer), `RequestHeader.tsx`, `DestinationStrip.tsx`, `CatalogStatus.tsx`,
  `PropertiesSummaryButton.tsx`, `PropertiesSection.tsx`, `RequestFooter.tsx`, `HexStrip.tsx`,
  `OutcomeChip.tsx`, `EmptyState.tsx`, `BlockConflictDialog.tsx`, plus the restyled
  `RoutingKeyCombobox.tsx` (moved with `git mv`, test moved with it).
- `RequestCard` registers `signals.toggleHex.current` in an effect and clears it on unmount; every
  hook runs before the empty-state branch so the shortcuts stay registered without a schema.

Wiring / deletions
- `ComposeView.tsx`: the `main` slot is now
  `<RequestCard signals={signals} blocksOpen={blocksOpen} onToggleBlocks={onToggleBlocks} />`;
  nothing else in that file changed.
- Deleted `FormPanel.tsx`, `PublishBar.tsx`, `AmqpPropertiesSheet.tsx` and the three FormPanel test
  files plus `PublishBar.test.tsx`.

## Tests and results

TDD evidence
1. Wrote every test file first (`destination`, `propertiesSummary`, `useDestination`, `usePublish`,
   `useRequestForm`, `DestinationStrip`, `PropertiesSection`, `RequestFooter`, `RequestCard`, plus
   the `hexToBytes` cases in `src/lib/__tests__/bytes.test.ts`).
2. `pnpm exec vitest run src/components/compose src/lib/__tests__/bytes.test.ts` → RED:
   `Test Files 10 failed (10) / Tests 2 failed | 4 passed`, with
   `Error: Failed to resolve import "@/components/compose/destination" …` for each new module and
   `TypeError: hexToBytes is not a function` for the bytes cases.
3. Implemented the pure modules and hooks → `Test Files 6 passed (6) / Tests 61 passed (61)`.
4. Implemented the components one at a time, each run RED→GREEN
   (DestinationStrip 15, PropertiesSection 12, RequestFooter 19, RequestCard 14).
5. Added `BlockConflictDialog.test.tsx` (6) after coverage showed the dialog untested.

Final commands
- `pnpm exec tsc --noEmit` → `TypeScript: No errors found`
- `pnpm test` → `Test Files 74 passed (74) / Tests 800 passed (800)`
- `pnpm lint` → `21 problems (0 errors, 21 warnings)` — below the 23-warning baseline
- `pnpm exec vitest run --coverage` → **statements 83.55 · branches 75.63 · functions 84.2 ·
  lines 84.93** (thresholds 78/70/76/79 all met). `src/components/compose` itself:
  91.02 / 83.48 / 92.41 / 93.51.

## Files changed

40 files, +4254 / −3160. Added: the 16 modules above under `src/components/compose/` and their 10
test files. Renamed: `publish/RoutingKeyCombobox.tsx` and its test → `compose/`. Modified:
`src/lib/bytes.ts`, `src/lib/__tests__/bytes.test.ts`, `src/components/layout/ComposeView.tsx`,
`src/__tests__/keyboard-shortcuts.test.tsx`. Deleted: `form/FormPanel.tsx`,
`publish/PublishBar.tsx`, `publish/AmqpPropertiesSheet.tsx` and their five test files.

## Deviations from the brief (all deliberate, all verified)

1. **`HexPreviewPanel.tsx` was NOT deleted.** `src/components/layout/RightPanel.tsx` (owned by the
   Activity-panel task, with two test files of its own) still imports it, and
   `src/__tests__/keyboard-shortcuts.test.tsx` mocks it. Deleting it here would have meant editing
   another branch's component. **Merge-order item:** whoever replaces `RightPanel` must delete
   `src/components/preview/HexPreviewPanel.tsx` and its two mocks.
2. **`PropertiesSummary.tsx` is named `PropertiesSummaryButton.tsx`** (exporting
   `PropertiesSummaryButton`). With both `propertiesSummary.ts` and `PropertiesSummary.tsx` in the
   same directory, Vite resolved `@/components/compose/PropertiesSummary` to the pure `.ts` module
   (extension order plus a case-insensitive filesystem), so the component rendered as `undefined`.
   Proven with a probe test before renaming; the pure module keeps the brief's name.
3. **`src/__tests__/keyboard-shortcuts.test.tsx`** had `vi.mock("@/components/publish/PublishBar")`,
   which cannot resolve once the module is gone. It now stubs
   `@/components/compose/DestinationStrip` instead — needed anyway, because the destination strip
   renders a text input in manual mode and that test queries `getByRole("textbox")` for the form
   field. All 12 of its tests still pass unchanged.
4. **`useDestination` drops PublishBar's `listProfiles` effect and its profile quick-switch.** The
   header `ConnectionPill` already loads profiles and owns switching (decision 3 in the task) — and
   `AppHeader` mounts that pill in both Compose and Plans, so nothing is left without a profile list.
5. `RequestCard` takes `signals`, `blocksOpen` and `onToggleBlocks` (per the wiring instruction),
   not the single-prop signature in the brief's interface block.

## Self-review against §3

- Header toolbar: SectionLabel "Request", name, full name, "· draft saved", drop hint, four
  `IconButton size={28}` (`h-[26px]`) — Library (aria-pressed follows `blocksOpen`), Dices,
  RotateCcw (title carries the platform shortcut), Braces (label flips to "Return to form"). ✓
- Destination strip: "To" label, Queue|Exchange choice control, 280px target picker (SearchableSelect
  when live with `mono`/`meta`, plain Input otherwise), exchange mode's ArrowRight + routing key
  (combobox or prefixed input), catalog status (Live catalog / Manual entry / Auth failed with the
  broker message as its title), properties summary button with Edit/Done, and the fanout/headers
  hint as a second row. ✓
- Properties section: the two grids, delivery segmented control, TTL with "ms" and its validation,
  header pills with remove buttons, the `n / 20` counter, the dashed "+ header" popover, Reset and
  Apply. Draft/validation logic moved verbatim. ✓
- Footer: hex strip (`{n} B · {inline hex}`, encode error, empty hint, Expand/Collapse), outcome chip
  (ACK · HH:MM:SS, RETURNED, NACK, TIMEOUT with its dismiss button), Send with the icon, target name
  and `⌘↵` kbd, tooltip carrying `disabledReason`; expanded dump with the wire-format header, copy
  (toast "Hex copied") and save (`{ShortName}.bin` through `save` + `writeFile(hexToBytes(hex))`). ✓
- Empty state, drop-target styling (`ring-4 ring-primary/12 border-border-strong` plus the header
  drop hint), conflict dialog (restyled, `border-hairline` rows, `Tag tone="neutral"` kind badge). ✓

## Concerns

- `useRequestForm.ts` is 343 lines, past the ~300 guidance. It is one cohesive hook (debounce,
  drafts, JSON mode, block drops) ported from `FormPanel.tsx`; splitting it was not invented here.
- Three of the 21 remaining lint warnings are mine: one `react-hooks/immutability` in `RequestCard`
  (assigning `toggleHex.current`, the same pattern `RightPanel` uses for `setActiveTabRef`) and four
  `react-hooks/set-state-in-effect` carried over verbatim from `PublishBar`/`FormPanel` effects.
  Total warnings are still below the 23-warning baseline.
- The React compiler lint treats a hook return object containing refs as a ref: `RequestCard` and the
  `useRequestForm` test harness therefore destructure `resetRef`/`getDirtyFieldsRef`/`applyBlockRef`/
  `dropZone` out of the return before render reads it. Consumers added later should do the same.
- `RequestFooter` reads `hexPreview` from the store rather than taking it as a prop, so the hex strip
  keeps updating without re-rendering the card's parents.
- The empty state's "try examples/order.proto" is plain text, as in the prototype; it is not a link.
- No end-to-end assertion covers drop → `conflicts.length > 0` → dialog visible: `BlockConflictDialog`
  is tested with a fabricated plan and every `useRequestForm` drop test takes the no-conflict path.
  The deleted FormPanel tests did not cover it either and the brief's port list does not ask for it.
- Coverage rows for the small components (CatalogStatus, EmptyState, HexStrip, RequestHeader,
  PropertiesSummaryButton) and the two pure modules are omitted by the reporter because they are at
  100%; the `src/components/compose` aggregate (91.02 / 83.48 / 92.41 / 93.51) includes them.

---

# Fix round 1 — review findings addressed

**Commit:** the single commit `fix(compose): 1.5 icon stroke, no drop affordance in JSON mode,
always-mounted confirm dialog` on top of `27d775f`, same worktree and branch.

## What changed

1. **`strokeWidth={1.5}` on every lucide icon in this task** — RequestHeader (Library, Dices,
   RotateCcw, Braces), RequestFooter (LoaderCircle, Send, Copy, Download), HexStrip (Binary),
   OutcomeChip (CircleCheck, X), DestinationStrip (ArrowRight), EmptyState (FileCode, Radio, Send),
   PropertiesSection (X, Plus), PropertiesSummaryButton (Layers), RoutingKeyCombobox (LoaderCircle,
   ChevronsUpDown, and the `Check` in the suggestion list — three, one more than the review counted,
   for consistency inside the file). `StatusDot` in CatalogStatus is not a lucide icon and is
   unchanged.
2. **The drop affordance no longer fires in JSON mode.** `RequestCard` derives
   `const isDropTarget = isDragOver && !form.isJsonMode;` and both the `cn()` ring branch and the
   `dropHint` prop use it. The droppable ref and `useRequestForm`'s `onDragEnd` guard are untouched,
   so the drop is still discarded the same way — it just no longer advertises itself.
3. **`BrokerConfirmDialog` is mounted in every branch.** It is built once as `confirmDialog` above
   the branches and rendered in the empty state, the "Message type not found" fallback and the card,
   so a production ⌘↵ without a selected type still shows a dialog instead of leaving a dangling
   `pendingPublish`.
4. **Two ported/added `usePublish` tests**: the deleted "D-09: new send replaces prior badge
   immediately without queuing" case (ack then nack, and the first send's 3 s timer must not clear
   the second outcome) and an assertion that a successful send stamps `lastSendAt`.

Stale comments in `ProtoFormRenderer.tsx`, `JsonEditor.tsx` and the plans files were left alone.

## Covering tests

- `RequestCard.test.tsx` → "shows no drop affordance in JSON mode — a block cannot land there":
  enters JSON mode, sets `isOver` true, asserts no `ring-4` class and no "Drop to fill" hint.
  Verified non-vacuous: with the `&& !form.isJsonMode` gate removed it fails with
  `AssertionError: expected 'flex min-h-0 flex-1 flex-col overflow…' not to contain 'ring-4'`;
  restored, it passes.
- `usePublish.test.tsx` → "D-09: a new send replaces the prior outcome immediately without queuing"
  and "stamps lastSendAt so the Activity panel can highlight the new row".

## Commands and output

- `pnpm exec vitest run src/components/compose src/__tests__` → `Test Files 12 passed (12) /
  Tests 149 passed (149)`
- `pnpm test` → `Test Files 74 passed (74) / Tests 803 passed (803)`
- `pnpm exec tsc --noEmit` → `TypeScript: No errors found`
- `pnpm lint` → `21 problems (0 errors, 21 warnings)` (unchanged from before the fixes)
- `pnpm exec vitest run --coverage` → statements 83.63 · branches 75.7 · functions 84.2 ·
  lines 85.01 (thresholds 78/70/76/79 met)
