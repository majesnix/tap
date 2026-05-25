---
id: T02
parent: S03
milestone: M001
key_files:
  - src/components/form/FormPanel.tsx
key_decisions:
  - Draft restore uses isRestoringRef with 300ms timeout to prevent save-on-restore feedback loop — 300ms exceeds the 200ms debounce window ensuring the guard covers the debounced save
  - Draft save skips values equal to buildDefaultValues to avoid persisting empty/default forms
  - Restore routes through setPendingReplayValues per MEM003 — never calls resetRef.current directly
duration: 
verification_result: passed
completed_at: 2026-05-25T20:12:48.873Z
blocker_discovered: false
---

# T02: Wired draft save/restore/clear in FormPanel: auto-saves on debounced change, restores on message type switch via setPendingReplayValues, clears draft on Clear button

**Wired draft save/restore/clear in FormPanel: auto-saves on debounced change, restores on message type switch via setPendingReplayValues, clears draft on Clear button**

## What Happened

Connected useDraftStore to FormPanel's form lifecycle with three integration points:

1. **Auto-save effect** — watches `[debouncedValues, selectedMessageType, activeFilePath, draftsLoaded]`. Skips save when `isRestoringRef.current` is true (prevents save-on-restore feedback loop) or when values equal `buildDefaultValues(msg)` (no point persisting defaults). Calls `saveDraft()` which handles LRU eviction and disk persistence.

2. **Draft restore in message type change effect** — extended the existing WR-01 effect that resets JSON mode state. After resetting JSON state, checks `getDraft(activeFilePath, selectedMessageType)`. If a draft exists, sets `isRestoringRef.current = true`, calls `setPendingReplayValues(draft.values)` per MEM003 (never call resetRef.current directly), and clears the restoring flag after 300ms timeout so the debounced save effect doesn't re-persist the restored values.

3. **Clear integration** — extended `handleClear` to call `clearDraft(activeFilePath, selectedMessageType)` after setting default values via `setPendingReplayValues`, ensuring the stored draft is removed when the user explicitly clears the form.

All draft operations are guarded: skip when `!draftsLoaded` or `!activeFilePath`.

## Verification

Ran `pnpm tsc --noEmit` — exited cleanly with no type errors. All imports resolve correctly, useDraftStore integration compiles, and the isRestoringRef/useEffect wiring is type-safe.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 4000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/components/form/FormPanel.tsx`
