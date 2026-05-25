---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T02: Wired draft save/restore/clear in FormPanel: auto-saves on debounced change, restores on message type switch via setPendingReplayValues, clears draft on Clear button

Why: The store exists but needs to be connected to the form lifecycle. Save on value change (R019), restore on message type selection (R020), clear on explicit action (R022). Must route through setPendingReplayValues per MEM003.

Do:
1. In FormPanel, add useEffect watching [debouncedValues, selectedMessageType, activeFilePath, draftsLoaded]: call saveDraft when all are present and values differ from buildDefaultValues(msg). Use isRestoringRef to skip save during restore.
2. Add draft restore in existing selectedMessageType change effect (near line 167): after JSON mode reset, check getDraft(activeFilePath, selectedMessageType) and if found, call setPendingReplayValues(draft). Set isRestoringRef.current = true before, clear after a timeout or in the save effect guard.
3. In handleClear callback (line 147): after setPendingReplayValues(buildDefaultValues(msg)), also call clearDraft(activeFilePath, selectedMessageType).
4. Guard: skip all draft operations when !draftsLoaded or !activeFilePath.

Done when: Form values auto-save on change, restore on message type switch, clear button removes draft, no save-on-restore feedback loop

## Inputs

- `src/stores/useDraftStore.ts`
- `src/components/form/FormPanel.tsx`
- `src/stores/useProtoStore.ts`

## Expected Output

- `src/components/form/FormPanel.tsx`

## Verification

pnpm tsc --noEmit
