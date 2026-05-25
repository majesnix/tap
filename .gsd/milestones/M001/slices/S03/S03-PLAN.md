# S03: Connection Quick-Switch + Draft Persistence

**Goal:** User fills a complex form with map rows and oneof, switches to a different message type, comes back and sees values restored; closes app, reopens, values still there; switches connection profile from publish bar dropdown without opening sidebar
**Demo:** User fills a complex form with map rows and oneof, switches to a different message type, comes back and sees values restored; closes app, reopens, values still there; switches connection profile from publish bar dropdown

## Must-Haves

- 1. Draft auto-saves on form change (debounced 200ms) and restores on message type re-selection including map/repeated/oneof fields\n2. Drafts persist across app restart via tauri-plugin-store drafts.json\n3. LRU eviction at 50 entries keeps storage bounded\n4. Clear button also clears the stored draft\n5. Connection quick-switch dropdown in PublishBar reconnects on selection\n6. Quick-switch blocked with toast warning when plan is running

## Proof Level

- This slice proves: Contract + Integration — verified via unit tests on store logic and integration tests on component wiring; no real Tauri runtime required (mocked IPC)

## Integration Closure

Upstream: useProtoStore (latestValues, selectedMessageType, activeFilePath, setPendingReplayValues), useConnectionStore (profiles, activeProfileName, setActiveProfile), usePlanExecutionStore (isRunning), tauri-plugin-store (load/get/set/save pattern from useHistoryStore). New wiring: useDraftStore loaded in App.tsx on mount; FormPanel watches debouncedValues for save and selectedMessageType for restore; PublishBar adds profile Select with reconnect flow. Downstream for S04: draft persistence enables randomized values to be saveable.

## Verification

- toast.error on draft load failure (non-fatal, app continues without drafts); toast.warning on blocked connection switch during plan run; toast.error on connection switch failure with error message

## Tasks

- [x] **T01: Created useDraftStore with tauri-plugin-store persistence, LRU eviction at 50 entries, and App.tsx mount loading** `est:45m`
  Why: All draft save/restore logic needs a centralized store that persists to disk. This is the foundation for R019, R021, R023.
  - Files: `src/stores/useDraftStore.ts`, `src/App.tsx`
  - Verify: pnpm tsc --noEmit

- [x] **T02: Wired draft save/restore/clear in FormPanel: auto-saves on debounced change, restores on message type switch via setPendingReplayValues, clears draft on Clear button** `est:40m`
  Why: The store exists but needs to be connected to the form lifecycle. Save on value change (R019), restore on message type selection (R020), clear on explicit action (R022). Must route through setPendingReplayValues per MEM003.
  - Files: `src/components/form/FormPanel.tsx`
  - Verify: pnpm tsc --noEmit

- [x] **T03: Added connection quick-switch dropdown in PublishBar with colored status dot, profile loading on mount, and plan-run guard that blocks switching with toast warning** `est:35m`
  Why: R017 requires profile switching from publish bar without opening sidebar. R018 requires blocking switch during plan execution.
  - Files: `src/components/publish/PublishBar.tsx`
  - Verify: pnpm tsc --noEmit

- [x] **T04: Added 23 unit and integration tests covering draft store logic, FormPanel draft wiring, and PublishBar connection quick-switch with plan-run guard** `est:50m`
  Why: Verify R017-R023 requirements with automated tests. Must cover store logic (LRU, persistence), FormPanel save/restore round-trip, clear-clears-draft, and PublishBar quick-switch with plan-run guard.
  - Files: `src/stores/__tests__/useDraftStore.test.ts`, `src/components/form/__tests__/FormPanel-drafts.test.tsx`, `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`
  - Verify: pnpm vitest run

## Files Likely Touched

- src/stores/useDraftStore.ts
- src/App.tsx
- src/components/form/FormPanel.tsx
- src/components/publish/PublishBar.tsx
- src/stores/__tests__/useDraftStore.test.ts
- src/components/form/__tests__/FormPanel-drafts.test.tsx
- src/components/publish/__tests__/PublishBar-quickswitch.test.tsx
