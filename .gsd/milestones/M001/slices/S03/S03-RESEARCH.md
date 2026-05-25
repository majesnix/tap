# S03: Connection Quick-Switch + Draft Persistence — Research

**Date:** 2026-05-25

## Summary

S03 has two independent feature tracks: (1) a connection profile quick-switch dropdown in the PublishBar, and (2) draft auto-save/restore per message type using tauri-plugin-store. Both tracks are well-constrained by existing codebase patterns and architectural decisions (MEM003, MEM006).

The connection quick-switch is straightforward — `useConnectionStore` already has `profiles`, `activeProfileName`, and `setActiveProfile`. The sidebar `ConnectionSection.tsx` has the full connect/activate flow (`handleProfileChange`). The PublishBar needs a compact `Select` dropdown that mirrors this logic, gated by `usePlanExecutionStore.isRunning` (R018). No new IPC commands needed.

Draft persistence is the higher-risk track. The key constraint is that restore **must** route through `setPendingReplayValues` (MEM003) — never `form.reset()` directly — to correctly handle map/repeated/oneof fields via the mapReplaceRegistry pattern. Storage uses `tauri-plugin-store` with a dedicated `drafts.json` file (not `tap.json` — separate concern, separate file, matching `history.json` and `blocks.json` patterns). LRU eviction at 50 entries requires tracking access order.

## Recommendation

Split into 4-5 tasks: (1) useDraftStore with tauri-plugin-store persistence + LRU, (2) draft save wiring in FormPanel via debounced latestValues watch, (3) draft restore on message type selection via setPendingReplayValues, (4) connection quick-switch in PublishBar with plan-run guard, (5) tests. Tasks 1-3 are sequential (store → save → restore); task 4 is independent.

## Implementation Landscape

### Key Files

- `src/stores/useConnectionStore.ts` — Has `profiles`, `activeProfileName`, `setActiveProfile` actions. No changes needed to the store itself.
- `src/components/publish/PublishBar.tsx` — Add compact profile `Select` dropdown. Must import `useConnectionStore` (already imported), `usePlanExecutionStore` (new import), and `activateProfile` from ipc (new import). Insert between the mode RadioGroup and the target picker.
- `src/components/sidebar/ConnectionSection.tsx` — Reference for `handleProfileChange` flow: `setActiveProfile(name) → setConnectionStatus("disconnected") → activateProfile(name) → setConnectionStatus("connected"|"error")`. The quick-switch must replicate this exact sequence.
- `src/stores/usePlanExecutionStore.ts` — `isRunning` field (boolean) used as the guard for connection switch (R018).
- `src/components/form/FormPanel.tsx` — Wire draft save (watch `latestValues` changes debounced 200ms) and draft restore (on `selectedMessageType` change). `debouncedValues` already exists at line 58 — reuse for save trigger.
- `src/stores/useProtoStore.ts` — `selectedMessageType`, `activeFilePath`, `latestValues`, `setPendingReplayValues` — all needed for draft key computation and restore signal.
- `src/stores/useHistoryStore.ts` — Reference pattern for tauri-plugin-store persistence: `load(path) → store.get() / store.set() → store.save()`. Follow identically for drafts.
- `src/stores/useBlockStore.ts` — Same persistence pattern. Confirms: never use `autoSave: true`, always explicit `.save()`.

### New Files

- `src/stores/useDraftStore.ts` — New Zustand store for draft persistence. Shape:
  ```
  interface DraftStore {
    drafts: Record<string, DraftEntry>;  // key = `${filePath}::${messageFullName}`
    draftsLoaded: boolean;
    loadDrafts: () => Promise<void>;
    saveDraft: (filePath: string, messageType: string, values: Record<string, unknown>) => Promise<void>;
    getDraft: (filePath: string, messageType: string) => Record<string, unknown> | null;
    clearDraft: (filePath: string, messageType: string) => Promise<void>;
  }
  
  interface DraftEntry {
    values: Record<string, unknown>;
    accessedAt: number;  // Date.now() for LRU ordering
  }
  ```
  LRU: on saveDraft, if entries > 50, sort by `accessedAt` ascending and drop oldest. Key format uses `::` separator (safe — file paths use `/` or `\`, message names use `.`).

### Build Order

1. **useDraftStore** — foundational; all other draft work depends on it. Prove: store loads from `drafts.json`, saves, LRU evicts at 50.
2. **Draft save wiring** in FormPanel — watch `debouncedValues` + `selectedMessageType` + `activeFilePath`, call `saveDraft`. Skip save when values match `buildDefaultValues` (pristine form = no draft).
3. **Draft restore** — on `selectedMessageType` change in FormPanel (existing effect at line 167), check `getDraft()` and call `setPendingReplayValues`. Must run after the message type switch resets the form, so timing matters.
4. **Clear draft action** (R022) — wire to the existing Clear button's `handleClear` callback in FormPanel (line 147). After `setPendingReplayValues(buildDefaultValues(msg))`, also call `clearDraft`.
5. **Connection quick-switch** in PublishBar — independent of draft work. Add `Select` with profile list, plan-run guard dialog, and reconnect flow.

### Pitfalls and Constraints

1. **Draft restore timing (CRITICAL):** When `selectedMessageType` changes, `useProtoStore` resets `hexPreview` and `encodeError` (line 179-180). The form also remounts. Draft restore must happen via `setPendingReplayValues` AFTER the form component has remounted and `resetRef.current` is available. The existing `pendingReplayValues` consumption effect (FormPanel:177-187) already handles this timing correctly — setting `setPendingReplayValues` triggers the effect on next render.

2. **Draft save must not fire on restore:** When draft restore sets `setPendingReplayValues`, this triggers form update → `handleValuesChange` → `setLatestValues` → `debouncedValues` change → draft save. This would be a no-op (same values) but wasteful. Mitigation: use a `isRestoring` ref flag in FormPanel, set before restore, cleared after, skip save while true.

3. **Draft key stability:** Key is `${activeFilePath}::${selectedMessageType}`. Both are available from `useProtoStore` state. `activeFilePath` is an absolute path (stable). `selectedMessageType` is `full_name` (e.g., `mypackage.MyMessage`).

4. **LRU implementation:** On each `saveDraft`, update `accessedAt` to `Date.now()`. On each `getDraft`, also update `accessedAt` (read = access). When count exceeds 50, evict entries with lowest `accessedAt`. This is a simple sort+slice — no need for a linked list at 50 entries.

5. **Connection quick-switch plan-run guard (R018):** Before switching, check `usePlanExecutionStore.getState().isRunning`. If true, show warning toast and abort — do NOT show an AlertDialog (too heavy for a guard; toast.warning matches the app's existing pattern for blocking operations).

6. **Profile list in PublishBar:** `useConnectionStore` stores `profiles` but they're loaded in `ConnectionSection` on mount. If the user hasn't opened the sidebar, profiles array is empty. Fix: call `listProfiles()` on PublishBar mount if `profiles.length === 0`.

7. **Draft store loading:** Load `drafts.json` in `App.tsx` on mount (same pattern as `usePlanStore.loadPlans()` at App.tsx:61). Must complete before any draft restore attempt — use `draftsLoaded` guard.

### Existing Patterns to Follow

- **Store persistence:** `load(path) → store.get() → store.set() → store.save()` (never `autoSave: true`). Files: `history.json`, `blocks.json`, `tap.json`.
- **Monotonic counter signal:** `sendRequested`, `openFileRequested`, `reloadRequested` — increment counter, consumer watches via useEffect. Draft restore should NOT add a new counter; it uses `setPendingReplayValues` directly.
- **Debounce pattern:** `useDebounce(latestValues, 200)` already exists in FormPanel (line 58). Reuse `debouncedValues` for draft save trigger.
- **Plan-run guard:** Check `usePlanExecutionStore.getState().isRunning` synchronously. Pattern used in plan runner code.

### Connection Quick-Switch UI Placement

The PublishBar already has a left-to-right layout: `RadioGroup (queue/exchange) → target picker → routing key → Properties → outcome badge → Send button`. The connection dropdown should go at the **far left**, before the mode RadioGroup, with a compact `Select` showing just the profile name and a colored dot for connection status. This mirrors the sidebar's `ConnectionSection` compact layout.

### Dependency on S02

S02 provides `reload_proto` and include path management. Draft persistence does not directly depend on these, but the connection quick-switch should trigger a queue/exchange re-fetch on profile change (already handled by the existing `useEffect` in PublishBar at line 106 that watches `activeProfileName`).

### Open Questions Resolved

- **Draft store key format:** `${filePath}::${messageFullName}` — `::` is safe as separator.
- **fs:allow-exists capability:** Already granted in S02 (capabilities/default.json).
- **JSON-mode draft shape:** Out of scope for v1 (CONTEXT.md lists as stretch goal). Only form-mode values are persisted as `Record<string, unknown>`.

## Verification

- `pnpm tsc --noEmit` — type safety across new store + wiring
- `pnpm vitest run` — all existing tests pass + new tests for useDraftStore (LRU, persistence), draft save/restore round-trip, connection quick-switch (guard, reconnect flow)
- `cargo check` — no Rust changes in this slice
