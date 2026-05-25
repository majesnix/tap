---
id: S03
parent: M001
milestone: M001
provides:
  - useDraftStore with tauri-plugin-store persistence and LRU eviction at 50 entries
  - Draft save/restore pipeline via setPendingReplayValues in FormPanel
  - Connection quick-switch dropdown in PublishBar with plan-run guard
requires:
  - slice: S02
    provides: reload_proto command and recent files list in useProtoStore
affects:
  - S04
key_files:
  - src/stores/useDraftStore.ts
  - src/components/form/FormPanel.tsx
  - src/components/publish/PublishBar.tsx
  - src/App.tsx
  - src/stores/__tests__/useDraftStore.test.ts
  - src/components/form/__tests__/FormPanel-drafts.test.tsx
  - src/components/publish/__tests__/PublishBar-quickswitch.test.tsx
key_decisions:
  - Draft key format uses ${filePath}::${messageType} with :: as safe separator
  - LRU eviction runs on saveDraft only, not getDraft — avoids unnecessary disk writes on reads
  - Draft restore uses isRestoringRef with 300ms timeout to prevent save-on-restore feedback loop
  - Plan-run guard uses getState().isRunning imperatively, not reactively — avoids re-renders
  - Mocked Radix Select as plain HTML select in jsdom tests due to missing Radix internals
patterns_established:
  - Debounced auto-save with restore guard (isRestoringRef pattern) for bidirectional store sync
  - Fire-and-forget mount loading with silent catch for data that may already be loaded elsewhere
  - Imperative store access via getState() for event-time checks that don't need reactivity
observability_surfaces:
  - none — client-side persistence with no runtime monitoring needs
drill_down_paths:
  - milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - milestones/M001/slices/S03/tasks/T02-SUMMARY.md
  - milestones/M001/slices/S03/tasks/T03-SUMMARY.md
  - milestones/M001/slices/S03/tasks/T04-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-25T20:27:42.673Z
blocker_discovered: false
---

# S03: Connection Quick-Switch + Draft Persistence

**Draft auto-save/restore per message type with tauri-plugin-store persistence and LRU eviction, plus connection quick-switch dropdown in PublishBar with plan-run guard**

## What Happened

**T01 — useDraftStore foundation.** Created `useDraftStore` with tauri-plugin-store persistence using `${filePath}::${messageType}` composite keys. Implements LRU eviction capped at 50 entries (eviction runs on `saveDraft` only to avoid unnecessary disk writes on reads). `getDraft` updates `accessedAt` in memory for LRU ordering. App.tsx loads persisted drafts on mount.

**T02 — FormPanel draft wiring.** Wired draft save/restore/clear into FormPanel. Auto-saves on debounced change (200ms), restores on message type switch via `setPendingReplayValues` (per MEM003 — never calls `resetRef.current` directly). Uses `isRestoringRef` with 300ms timeout to prevent save-on-restore feedback loop (300ms exceeds the 200ms debounce window). Save skips values equal to `buildDefaultValues` to avoid persisting empty/default forms. Clear button clears both the form and the persisted draft.

**T03 — Connection quick-switch.** Added a compact dropdown in PublishBar showing all saved connection profiles with colored status dots. Select is disabled when ≤1 profiles (switching with one profile is a no-op). Plan-run guard uses `usePlanExecutionStore.getState().isRunning` imperatively (not reactively) to avoid unnecessary re-renders — only checked at switch time, blocks switching with a toast warning. Profile loading on mount uses fire-and-forget pattern with silent catch.

**T04 — Test coverage.** Added 23 unit and integration tests across three files: `useDraftStore.test.ts` (store logic, LRU eviction, persistence), `FormPanel-drafts.test.tsx` (save/restore/clear wiring), `PublishBar-quickswitch.test.tsx` (dropdown rendering, profile switching, plan-run guard). Mocked Radix Select as plain HTML `<select>` in PublishBar tests because Radix internals are unavailable in jsdom.

## Verification

- `pnpm tsc --noEmit` — zero errors, all S03 code compiles cleanly
- 23/23 S03-specific tests pass (useDraftStore, FormPanel-drafts, PublishBar-quickswitch)
- 580/580 full suite tests pass across 45 files — zero failures
- All key files verified present: useDraftStore.ts, PublishBar.tsx, FormPanel.tsx

## Requirements Advanced

- R017 — Connection quick-switch dropdown in PublishBar with colored status dot, disabled when ≤1 profiles
- R018 — Plan-run guard blocks profile switching with toast warning when isRunning is true
- R019 — Debounced 200ms auto-save on form value changes via useDraftStore.saveDraft
- R020 — Draft restore on message type switch via setPendingReplayValues — handles map/repeated/oneof through existing mapReplaceRegistry path
- R021 — useDraftStore backed by tauri-plugin-store with loadFromDisk on mount
- R022 — Clear button in FormPanel clears both form and persisted draft via clearDraft
- R023 — LRU eviction at 50 entries runs on saveDraft, oldest accessedAt entries evicted first

## Requirements Validated

- R017 — PublishBar-quickswitch tests verify dropdown renders profiles, switching invokes connect, disabled at ≤1 profiles
- R018 — PublishBar-quickswitch test verifies toast warning fires and switch is blocked when plan is running
- R019 — FormPanel-drafts test verifies saveDraft called on form value change
- R020 — FormPanel-drafts test verifies setPendingReplayValues called with saved draft on message type switch
- R021 — useDraftStore tests verify persistence round-trip via tauri-plugin-store mock
- R022 — FormPanel-drafts test verifies clearDraft called on Clear button click
- R023 — useDraftStore test verifies 51st entry evicts oldest by accessedAt

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

none

## Known Limitations

Pre-existing act() warnings in Radix component tests (non-blocking, cosmetic only). Draft restore does not trigger proto reload — if the proto file changed externally while the app was closed, the restored draft may reference stale schema (reload handles this on next user action).

## Follow-ups

S04 should verify that randomized values are saveable as drafts (draft persistence integration with randomizer). The isRestoringRef 300ms timeout is a heuristic — if debounce timing changes, this guard needs updating.

## Files Created/Modified

- `src/stores/useDraftStore.ts` — New store: draft persistence with LRU eviction, tauri-plugin-store backend
- `src/components/form/FormPanel.tsx` — Wired draft save (debounced), restore (on message type switch), and clear
- `src/components/publish/PublishBar.tsx` — Added connection quick-switch dropdown with colored status dot and plan-run guard
- `src/App.tsx` — Added useDraftStore.loadFromDisk() on mount
- `src/stores/__tests__/useDraftStore.test.ts` — 10 tests: store logic, LRU eviction, persistence round-trip
- `src/components/form/__tests__/FormPanel-drafts.test.tsx` — 4 tests: save/restore/clear integration with FormPanel
- `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx` — 9 tests: dropdown rendering, switching, plan-run guard toast
