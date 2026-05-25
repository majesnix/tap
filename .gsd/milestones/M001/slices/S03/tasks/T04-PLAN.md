---
estimated_steps: 7
estimated_files: 3
skills_used: []
---

# T04: Added 23 unit and integration tests covering draft store logic, FormPanel draft wiring, and PublishBar connection quick-switch with plan-run guard

Why: Verify R017-R023 requirements with automated tests. Must cover store logic (LRU, persistence), FormPanel save/restore round-trip, clear-clears-draft, and PublishBar quick-switch with plan-run guard.

Do:
1. Create src/stores/__tests__/useDraftStore.test.ts: test loadDrafts from mocked store, saveDraft persists, getDraft returns and updates accessedAt, clearDraft removes entry, LRU evicts at 51st entry, no-op when not loaded.
2. Create src/components/form/__tests__/FormPanel-drafts.test.tsx: test that changing debouncedValues triggers save (mock useDraftStore), that selecting a message type with existing draft calls setPendingReplayValues, that handleClear calls clearDraft, that save is skipped during restore (isRestoring guard).
3. Create src/components/publish/__tests__/PublishBar-quickswitch.test.tsx: test that profile Select renders with profiles, that selecting a profile calls activateProfile, that selecting while isRunning=true shows toast.warning and does NOT call activateProfile, that connection error shows toast.error.
4. All tests use vi.mock for tauri-plugin-store and IPC functions.

Done when: All new tests pass via pnpm vitest run, zero regressions in existing test suite

## Inputs

- `src/stores/useDraftStore.ts`
- `src/components/form/FormPanel.tsx`
- `src/components/publish/PublishBar.tsx`

## Expected Output

- `src/stores/__tests__/useDraftStore.test.ts`
- `src/components/form/__tests__/FormPanel-drafts.test.tsx`
- `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx`

## Verification

pnpm vitest run
