---
estimated_steps: 9
estimated_files: 2
skills_used: []
---

# T01: Created useDraftStore with tauri-plugin-store persistence, LRU eviction at 50 entries, and App.tsx mount loading

Why: All draft save/restore logic needs a centralized store that persists to disk. This is the foundation for R019, R021, R023.

Do:
1. Create src/stores/useDraftStore.ts following useHistoryStore pattern exactly: load() from tauri-plugin-store, explicit .save(), never autoSave:true
2. Interface: DraftEntry { values: Record<string, unknown>; accessedAt: number }, DraftStore { drafts: Record<string, DraftEntry>; draftsLoaded: boolean; loadDrafts(); saveDraft(filePath, messageType, values); getDraft(filePath, messageType); clearDraft(filePath, messageType) }
3. Key format: `${filePath}::${messageType}` — :: is safe separator
4. LRU: on saveDraft, if entries > 50, sort by accessedAt ascending and drop oldest. On getDraft, update accessedAt (read = access)
5. Guard: saveDraft/clearDraft no-op if !draftsLoaded (same pattern as useHistoryStore.appendEntry)
6. Add loadDrafts() call in App.tsx alongside existing loadPlans() call

Done when: Store compiles, exports correct interface, load/save/get/clear/LRU logic implemented, App.tsx loads on mount

## Inputs

- `src/stores/useHistoryStore.ts`
- `src/App.tsx`

## Expected Output

- `src/stores/useDraftStore.ts`

## Verification

pnpm tsc --noEmit
