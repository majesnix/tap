---
estimated_steps: 6
estimated_files: 3
skills_used: []
---

# T04: Added 18 unit and integration tests covering reload, recent files, and include path management

**Why:** Slice verification requires test coverage for the new IPC flows, store logic, and UI interactions. Tests prove the reload counter pattern works, recent files are managed correctly, and stale detection renders disabled entries.

**Do:**
1. Create `src/stores/__tests__/useProtoStore-reload.test.ts`: test addRecentFile (dedup, cap at 10, prepend order), updateFileSchema (preserves selectedMessageType when type exists, falls back otherwise), reloadRequested counter increment.
2. Create `src/components/sidebar/__tests__/FileSection-reload.test.tsx`: mock ipc.reloadProto and ipc.checkPathsExist. Test: reload button calls reloadProto with correct args; recent file click calls parseProto; stale file rendered as disabled; Cmd+R via native KeyboardEvent dispatch triggers reload.
3. Create `src/components/sidebar/__tests__/IncludePathManager.test.tsx`: mock dialog.open and ipc.reloadProto. Test: renders current paths; remove path triggers reload; add path opens directory picker and triggers reload on selection.

**Done when:** `pnpm vitest run` passes with all new test files green; no regressions in existing 534+ tests.

## Inputs

- `src/stores/useProtoStore.ts`
- `src/components/sidebar/FileSection.tsx`
- `src/components/sidebar/IncludePathManager.tsx`
- `src/lib/ipc.ts`
- `src/components/layout/AppLayout.tsx`

## Expected Output

- `src/stores/__tests__/useProtoStore-reload.test.ts`
- `src/components/sidebar/__tests__/FileSection-reload.test.tsx`
- `src/components/sidebar/__tests__/IncludePathManager.test.tsx`

## Verification

pnpm vitest run
