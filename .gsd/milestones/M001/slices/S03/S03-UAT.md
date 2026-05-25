# S03: Connection Quick-Switch + Draft Persistence — UAT

**Milestone:** M001
**Written:** 2026-05-25T20:27:42.674Z

# S03: Connection Quick-Switch + Draft Persistence — UAT

**Milestone:** M001
**Written:** 2026-05-25

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All features are tested via 23 automated tests covering store logic, FormPanel integration, and PublishBar quick-switch. No live RabbitMQ connection needed — draft persistence and quick-switch are UI/store concerns testable in isolation.

## Preconditions

- App builds without TypeScript errors (`pnpm tsc --noEmit` passes)
- All 580 tests pass (`npx vitest run`)
- At least two connection profiles saved in the app

## Smoke Test

Open the app, load a proto file, select a message type, fill in some fields, switch to a different message type, switch back — the filled values should be restored automatically.

## Test Cases

### 1. Draft auto-save and restore on message type switch

1. Load a proto file with multiple message types
2. Select message type A, fill in scalar fields, a map row, and a oneof choice
3. Switch to message type B
4. Switch back to message type A
5. **Expected:** All values from step 2 are restored — scalars, map rows, oneof selection

### 2. Draft survives app restart

1. Fill a form for a message type and wait >200ms (debounce window)
2. Close and reopen the app
3. Load the same proto file and select the same message type
4. **Expected:** Saved values are restored from tauri-plugin-store

### 3. Clear draft

1. Fill a form and wait for auto-save
2. Click the Clear button (RotateCcw icon)
3. **Expected:** Form is cleared and the persisted draft is removed — switching away and back shows empty form

### 4. Connection quick-switch from PublishBar

1. Save two connection profiles (e.g., dev and staging)
2. Use the dropdown in the publish bar to switch from dev to staging
3. **Expected:** Connection switches, status dot updates to reflect new connection state

### 5. Plan-run guard blocks switching

1. Start a plan execution
2. Attempt to switch connection profile via the dropdown
3. **Expected:** Switch is blocked and a toast warning appears

## Edge Cases

### LRU eviction at 50 entries

1. Save drafts for 50 different message types
2. Save a draft for a 51st message type
3. **Expected:** The least-recently-accessed draft is evicted; the 50 most recent remain

### Single profile disables dropdown

1. Have only one connection profile saved
2. **Expected:** The quick-switch dropdown is disabled (greyed out)

### Default/empty values not persisted

1. Select a message type but don't fill any fields
2. Switch away and back
3. **Expected:** No draft is restored (empty/default values are not saved)

## Failure Signals

- TypeScript compilation errors in useDraftStore.ts, FormPanel.tsx, or PublishBar.tsx
- Any of the 23 S03-specific tests failing
- Form values lost on message type switch (draft restore broken)
- Connection dropdown not appearing or not responding to clicks
- Toast warning not showing when switching during plan run

## Not Proven By This UAT

- Actual RabbitMQ connection behavior (mocked in tests)
- Cross-platform persistence file paths (tauri-plugin-store handles this, not tested in unit tests)
- Concurrent access to draft store from multiple windows (single-window app assumption)
- Draft restore after proto schema changes (stale draft vs new schema — deferred to user action)

## Notes for Tester

- The `act()` warnings in test output are cosmetic (Radix component internals) and do not affect test correctness
- PublishBar-quickswitch tests mock Radix Select as plain HTML `<select>` — this is intentional due to jsdom limitations
- Draft persistence uses `${filePath}::${messageType}` as the key format — two colons separate file path from message type
