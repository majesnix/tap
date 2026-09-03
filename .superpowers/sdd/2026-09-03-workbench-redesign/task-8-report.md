# Task 8 report — Activity panel (history + response merged) and read-mode popover

**Worktree:** `/Users/majesnix/gits/tap/.claude/worktrees/agent-a441deeb92d700dca`
**Branch:** `worktree-agent-a441deeb92d700dca` (based on `f88e5cb`)
**Commit:** `45439fb feat(activity): one timeline for sent and received messages with reply grouping` (32 files, +2564 / −2164)

## What I implemented

### New — `src/components/activity/`
| File | Purpose |
|---|---|
| `activityModel.ts` (224 l) | Pure model: `SentItem`/`ReceivedItem`/`ActivityGroup`, `buildActivity`, `groupReplies`, `activityGroups`, `formatClock`, `formatBytes`, `summarizeActivity`, `STATUS_LABEL`, `STATUS_TONE`, `shortTypeName`, `describeTarget`, `hexByteLength`, `REPLY_WINDOW_MS`. |
| `useActivityActions.ts` (181 l) | `replay` / `resend` (ported verbatim from `MessageHistoryPanel`, de-duplicated into one `loadIntoForm` helper), `exportVisible`, `clearAll`. |
| `useQueueRead.ts` (113 l) | Drain + consume-confirmation, ported from `MessageFeedTab` 98–155. `{ read, pending, confirm, cancel, isLoading }`. |
| `ActivityPanel.tsx` (207 l) | Header + filter segmented control, filter input + read-mode button, scrolling rows, footer summary/Clear/Export, empty states, clear confirmation, signal registration, send highlight, slide-in. |
| `ActivityRow.tsx` (109 l) | Row tile / type / status / mono meta, reply row, expanded block. Exports `TONE_TEXT` (`STATUS_TONE` → text-colour class). |
| `ReplyRow.tsx` (45 l) | Teal-ruled reply under its request, `REPLY` tag, `{routingKey} · {corr} · +{Δ} ms · {size}` meta, own expand. |
| `ActivityExpanded.tsx` (79 l) | `DecodedTree` for `fieldValues` / `decoded`, decode error in `font-mono text-12 text-danger`, "No decoded content" fallback, Load / Resend (sent only) / Hex actions, owns the hex dialog. |
| `ReadModeButton.tsx` (46 l) | h30 pill: pulsing teal dot + `Tapping {queue}` / `Subscribed {queue}` / `Read queue`, chevron. |
| `ReadModePopover.tsx` (81 l) | Popover anchored on the button: Tap/Subscribe/Peek/Consume segmented (locked while running) + `ResponseQueuePicker` + `SubscribePanel` (live modes) + `BrokerConfirmDialog`. |
| `HexViewDialog.tsx` (71 l) | `git mv`d from `history/`; new props `{ open, onOpenChange, title, subtitle?, hex, truncated? }`, renders `HexDump maxHeight={320}` + a copy button, keeps the truncation copy. |

### Modified
- `ComposeView.tsx` — aside is `<ActivityPanel signals={signals} />`; `setActiveTabRef` ref and its three `.current?.(…)` calls removed; imports fixed. Nothing else touched.
- `ResponseQueuePicker.tsx` — vertical popover layout (`flex flex-col gap-2`), full-width `SearchableSelect` (mono, `meta={depthMeta}`) or `Input`, inline catalog-status line (success dot + "Live catalog" / warning dot + "Manual entry" / `Tag tone="danger"` "Auth failed" with the error as `title`), "Decode as" label + h34 combobox trigger, batch row with `w-16 h-[34px]` mono count input + `size="md"` Peek/Consume + `text-11 text-ghost` helper copy. All `aria-label`/`title` values kept.
- `SubscribePanel.tsx` — `Badge` → `Tag` (Idle neutral / Running teal / Stopping warning / Error danger with `title`), `size="md"` Start/Stop, `text-11 text-ghost` safety copy. Behaviour untouched.
- `historyHelpers.ts` / `.test.ts` — `filterHistoryEntries` and its describe block removed; `collectFieldNames`, `collectSearchTokens`, `findReplayTabIndex` kept.
- `keyboard-shortcuts.test.tsx` — see deviation 2.

### Deleted
`layout/RightPanel.tsx`, `layout/RightPanel.test.tsx`, `layout/__tests__/RightPanel.test.tsx`, `history/MessageHistoryPanel.tsx`, `history/HistoryTable.tsx`, `history/HistoryFilterBar.tsx`, `response/MessageFeedTab.tsx`, `response/MessageFeedTab.test.tsx`, `response/ResponseDecodedView.test.tsx`.

## Deviations from the brief (each verified, each deliberate)

1. **`MessageFeedRow.tsx` kept** (brief listed it for deletion). `PlanDetailPanel.tsx:18 → PlanReplyFeedTab.tsx:3 → MessageFeedRow` is a live chain; deleting it fails `tsc --noEmit`. This is the same carve-out the controller made for `ResponseDecodedView`. `MessageFeedRow.test.tsx` and `ResponseHexSection.tsx` stay for the same reason. `PlanReplyFeedTab.tsx` was **not** edited (sibling territory). Nothing in the Activity code imports either.
2. **mod+2 assertion dropped from `keyboard-shortcuts.test.tsx`.** Nothing in this worktree registers `signals.toggleHex` and no `"wire format"` string exists — the Request-card task owns the hex strip. The replaced block asserts mod+1 (focus `aria-label="Filter activity"`) and mod+3 (the "Read mode" radiogroup appears), with a comment naming the owner of the missing assertion. The CopyButton blocks were not touched.
3. **`activityModel.test.ts` asserts `sizeBytes: 2` for the sent item, not the brief's 3.** `"CgU="` decodes to two bytes; verified `base64ByteLength("CgU=") === Buffer.from("CgU=","base64").length === 2`. The brief's example value was arithmetically wrong; the implementation is exactly as specified.
4. **`summarizeActivity([])` returns `"0 sent · 0 received"`** — the `· today` suffix is guarded on `items.length > 0` so an empty footer does not claim "today" from a vacuous `.every()`. Covered by a test.
5. **The filter input is `type="search"`.** As a plain input it collided with `screen.getByRole("textbox")` in three untouched `keyboard-shortcuts.test.tsx` blocks (including CopyButton ones the controller told me not to edit). `type="search"` gives it role `searchbox`, which is also the correct semantic; `[&::-webkit-search-cancel-button]:hidden` keeps the visual unchanged.
6. **`formatClock` is built from `getHours/...` + `padStart`**, not `toLocaleTimeString({hour12:false})`, which renders `24:` at midnight on some ICU builds.
7. **Slide-in uses an id baseline, not a clock.** `useRef(Date.now())` is an eslint **error** under `react-hooks/purity`. Received ids present at mount are captured in a lazy `useState` initializer; anything not in that set gets `animate-row-in` (the CSS animation runs once when the class is first applied). Same observable behaviour, no impure render call.
8. **Export toast copy** is `Exported {n} sent and {m} received` (the old copy counted only received rows, which is now wrong when only sent rows are visible). The envelope is unchanged: `{ exportedAt, messageCount, messages }` for received rows, plus `sent`.
9. **`HexViewDialog` title is lowercase** `Binary payload — {type}` (was `Binary Payload`), per the brief's Step 4.
10. **`src/components/ui/popover.tsx` gained `forceMount` pass-through (4 lines, additive), and `ReadModePopover` uses it.** Radix unmounts popover content on close; `SubscribePanel`'s CR-04 unmount cleanup calls `stopSubscribe()`, so without this, closing the popover would kill a running tap and the design's `Tapping {queue}` button state would be unreachable. `PopoverContent` now forwards `forceMount` to both the Portal and the Content and the read-mode content carries `data-[state=closed]:hidden`. The prop is opt-in — every other popover in the app is byte-for-byte unchanged. Covered by `__tests__/ReadModePopoverMount.test.tsx`, which uses the **real** primitive and was verified to fail (`Unable to find … name /stop/i`) when `forceMount` is removed.

## Tests and results

TDD order: `activityModel.test.ts` written first → `pnpm exec vitest run src/components/activity` **failed to resolve `../activityModel`** (RED) → implemented → 14 passed. Same test-then-implement loop for `useActivityActions`, then `ReadModePopover`, then `ActivityPanel`.

| Command | Result |
|---|---|
| `pnpm exec vitest run src/components/activity` | 5 files, **65 passed** |
| `pnpm exec vitest run src/__tests__/keyboard-shortcuts.test.tsx` | **10 passed** |
| `pnpm test` | **69 files, 736 passed, 0 failed** |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | **0 errors**, 24 warnings (pre-change tree: 0 errors, 27 warnings) |
| `pnpm exec vitest run --coverage` | exit 0, thresholds met |

**Coverage (thresholds 78 / 70 / 76 / 79):** statements **83.70**, branches **74.58**, functions **83.54**, lines **85.30**.
`src/components/activity` alone: 88.73 / 81.19 / 92.47 / 90.43.

New test files:
- `__tests__/activityModel.test.ts` — 14 cases: the brief's six plus MB formatting, the empty/older-day summary, name/target/hex helpers, the status maps, failed-send and decode-error statuses, missing-outcome fallback, content-type/decoded matching, reply-only query match, unparseable timestamp.
- `__tests__/useActivityActions.test.tsx` — 13 cases: replay (happy + file-not-open toast), resend (truncated refusal, publish + history append, no profile, publish failure), export (envelope + curated received fields + ISO timestamp, null timestamp, `activity-export-` filename, grouped reply included, cancel silence, write failure), clearAll.
- `__tests__/ReadModePopover.test.tsx` — 15 cases ported from `MessageFeedTab.test.tsx`: mode set + lock + live-controls visibility; drain with `selectedDecodeTypes`, Peek `requeue=true` / Consume `false`, "Queue is empty", partial error, failed drain, "Feed capped at 500"; remote-host confirm/confirmed/cancelled, Peek without confirmation; production tag, read-only profile.
- `__tests__/ReadModePopoverMount.test.tsx` — 1 case with the real Popover primitive: closing the popover leaves the live controls mounted, issues no `stopSubscribe`, and leaves `subscribeStatus === "Running"`.
- `__tests__/ActivityPanel.test.tsx` — 22 cases: empty state, rows with type/status/meta, footer summary, segmented filter, text filter (debounced) + no-match copy, REPLY grouping, expand (decoded keys + Load/Resend/Hex), Load happy + toast, Resend base64, Hex dialog "Binary payload", collapse, received decode error with no Resend, Export disabled/envelope, Clear confirm + disabled, read-mode label idle/Tapping, signal registration + unmount clearing.

## Self-review against handoff §4

| §4 element | Status |
|---|---|
| Header: "ACTIVITY" label + All/Sent/Received segmented (xs) | done |
| Filter input h30 with search icon + placeholder | done (`type="search"`, see deviation 5) |
| Read-mode button: 6px dot, pulse + teal border while running, chevron | done |
| Rows: 22px tile (violet sent / teal received), type + status 10/700, mono target · clock · size | done |
| Reply grouping (correlation id, else reply-to within window), hidden under the Sent filter | done |
| Expanded: `bg-foreground/[.03]`, decoded block, Load / Resend / Hex | done |
| Footer: summary left, Clear + Export right | done |
| Empty states (no items / no matches) | done |
| Popover: mode segmented + queue picker + subscribe panel + confirmations | done |
| Highlight after send (1.5 s), slide-in for new received rows | done |
| `⌘1` focus filter, `⌘3` toggle popover | done (`⌘2` not owned here) |

Other notes: every new file is under 300 lines (largest: `activityModel.ts` 224, `ActivityPanel.tsx` 207). No mutation of store state. `groupReplies` is O(n²) in the worst case but n ≤ 600 (100 history + 500 feed) and it only runs in a `useMemo`.

## Concerns for the controller

1. **mod+2 has no test anywhere yet.** Route the assertion (hex strip toggling via `signals.toggleHex`) to whoever owns the Request card, and re-add it to `keyboard-shortcuts.test.tsx` when that lands.
2. **`CatalogStatus` is inlined** in `ResponseQueuePicker` (controller decision 2) — swap it for `@/components/compose/CatalogStatus` when Task 6 lands. Same three states, same copy.
3. **`MessageFeedRow.tsx`, `MessageFeedRow.test.tsx`, `ResponseDecodedView.tsx`, `ResponseHexSection.tsx` are now only used by the plans view.** Once the plans tasks stop importing them they can be deleted; nothing under `activity/` references them.
4. **`ActivityPanel` contributes one lint warning** (`react-hooks/immutability` — assigning `signals.*.current` inside an effect). That is inherent to the ref-signal contract the brief specifies. Total is 24 warnings, 0 errors, down from 27 on the pre-change tree.
5. **`src/components/ui/popover.tsx` is a shared primitive** and §8 of the handoff may have another task restyling it. My change is 4 additive lines (deviation 10); if it conflicts, keep both — dropping `forceMount` silently breaks the running-tap state, and `ReadModePopoverMount.test.tsx` will catch that.
6. **The queue-depth pill moved** into the `SearchableSelect` `meta` slot in live mode and onto the status line in manual mode; no test covered it before or after.

---

# Fix report — review round 1

**Commit:** see `git log -1` (single commit on top of `9c167c6`).

| # | Finding | What changed |
|---|---|---|
| 1 | Decode-as list survived closing the force-mounted read-mode popover | `ResponseQueuePicker` takes `panelOpen?: boolean` (default `true`) and closes `decodeOpen` in an effect when it goes false; `ReadModePopover` passes its own `open`. |
| 2 | `useQueueRead` subscribed to whole stores | Now uses five individual selectors; the feed size for the 500-cap warning is read via `useResponseStore.getState()` at drain time, so arriving messages no longer re-render the permanently mounted subtree. |
| 3 | Corrupt base64 fed into `HexDump` | `HexViewDialog` takes `note?: string` (rendered `font-mono text-12 text-danger` in place of the dump, copy button disabled); `hexOf()` returns `{ hex: "", note }` for unreadable payloads. |
| 4 | Missing `strokeWidth` | `ChevronsUpDown`, `Check`, `Loader2` in `ResponseQueuePicker` and `Loader2` in `SubscribePanel` now use `size={14} strokeWidth={1.5}`. |
| 5 | Export conflated status and outcome | `sent[].status` is now `entry.status` verbatim; `outcome` stays separate. |
| 6 | Unused `isLoading` | Removed from `QueueRead` and the return value. |
| 7 | Per-render tone map with a colliding name | Hoisted to module scope as `SUBSCRIBE_STATUS_TONE`, typed `Record<SubscribeStatus, TagTone>`. |
| 8 | Animations untested | Three new cases in `ActivityPanel.test.tsx`. |
| 9 | Stale comments | `historyHelpers.ts` now names `useActivityActions`; `SubscribePanel.tsx` names `ReadModePopover`. No other stale references in files I touched. |
| 10 | `aria-controls` | Row and reply buttons point at `activity-detail-{id}`; `ActivityExpanded` takes an `id` prop and sets it on its container. |

## Covering tests

- `ReadModePopoverMount.test.tsx` (real Popover primitive) — new case *"closes the portalled decode-as list when the read-mode popover closes"*: opens the popover, opens the decode-as list, closes the popover, asserts `Filter types…` is gone. **Verified to fail without the fix** (`expect(element).not.toBeInTheDocument()`); the pre-existing running-tap case still passes.
- `ActivityPanel.test.tsx` — three new cases: newest sent row gains `animate-row-highlight` after `lastSendAt` bumps (asserted absent first); a received row arriving after mount gains `animate-row-in`; a row present at mount does not.
- `useActivityActions.test.tsx` — the envelope case now exports `status: "sent"` with `outcome: "ack"` as distinct fields; a new case asserts `status: "failed"` with `outcome: null`.

## Commands and output

```
pnpm exec vitest run src/components/activity src/components/response src/__tests__
  → 10 files, 134 passed

pnpm test                 → 69 files, 741 passed, 0 failed
pnpm exec tsc --noEmit    → clean
pnpm lint                 → 0 errors, 25 warnings
pnpm exec vitest run --coverage → exit 0
  statements 84.03 · branches 74.85 · functions 83.83 · lines 85.58   (thresholds 78/70/76/79)
```

Note: warnings went 24 → 25. The new one is `react-hooks/set-state-in-effect` on the `panelOpen` effect from finding 1 — inherent to that instruction (the alternative, `open={decodeOpen && panelOpen}`, leaves `decodeOpen` true so the list reopens on its own next time the popover opens). Same rule already fires elsewhere in the codebase; still 0 errors.
