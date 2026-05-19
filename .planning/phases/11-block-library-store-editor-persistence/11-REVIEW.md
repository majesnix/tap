---
phase: 11-block-library-store-editor-persistence
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/stores/useBlockStore.ts
  - src/stores/useBlockStore.test.ts
  - src/components/blocks/BlockLibraryPanel.tsx
  - src/components/blocks/BlockLibraryPanel.test.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/__tests__/FormPanel.test.tsx
findings:
  critical: 2
  warning: 4
  info: 1
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase delivers the block library store (`useBlockStore`), its editor UI (`BlockLibraryPanel`), integration into `AppLayout`, a Library button added to `FormPanel`, and corresponding test suites. The implementation is largely well-structured, uses immutable update patterns throughout the store, and correctly guards hydration with `blocksLoaded`. However, two blockers were found: a silent data-loss path when the user saves before the async store hydration completes, and missing persistence error handling that leaves in-memory and on-disk state diverged with no user feedback. Four warnings address error-handling gaps, unvalidated deserialization, accessibility inconsistency in the error banner, and a concurrency race in the store's read-modify-write pattern.

---

## Critical Issues

### CR-01: Save while loading silently drops the block

**File:** `src/components/blocks/BlockLibraryPanel.tsx:84-89`

`handleSave` calls `addBlock`/`updateBlock` and then immediately calls `setView("list")` with no check on whether the store is ready. The store actions guard on `!blocksLoaded` and silently early-return when hydration has not finished. This creates a real data-loss path: the user opens the editor, fills in a block, and clicks "Save block" before `loadBlocks()` resolves (the `useEffect` at line 40-44 fires the async call at mount; any network or I/O delay keeps `blocksLoaded === false` for a window). The UI transitions to the list view with "No blocks yet" as if the save succeeded, but nothing was written. No error is shown and no retry is possible.

The test suite does not cover this race scenario (`BlockLibraryPanel.test.tsx` always sets up the store with `blocksLoaded: true`).

**Fix:**

Disable the Save button while `!blocksLoaded`, or show an inline loading state. Minimal change:

```tsx
<Button
  variant="default"
  className="w-full mt-auto"
  aria-label="Save block"
  onClick={handleSave}
  disabled={!blocksLoaded}
>
  {blocksLoaded ? "Save block" : "Loading…"}
</Button>
```

Alternatively, guard in `handleSave` itself and surface an error rather than silently returning:

```tsx
function handleSave() {
  if (!blocksLoaded) {
    setSaveError("Store not ready, please try again");
    return;
  }
  // ... rest of validation
}
```

---

### CR-02: Persistence errors diverge in-memory and on-disk state with no user feedback

**File:** `src/stores/useBlockStore.ts:43-44`, `52-53`, `59-60`

All three write operations (`addBlock`, `updateBlock`, `deleteBlock`) optimistically update Zustand state with `set(...)` and then `await persistBlocks(...)`. There is no try/catch around `persistBlocks`. If the `tauri-plugin-store` call fails (disk full, app data directory unavailable, permission denied, corrupted store file), the in-memory state reflects the change but the file does not. On the next app launch, `loadBlocks()` reads the old file and silently reverts any changes the user believed were saved. This is a data-loss risk that is completely invisible to the user.

**Fix:**

Wrap each write path in try/catch and roll back the optimistic state update on failure:

```typescript
addBlock: async (block) => {
  if (!get().blocksLoaded) return;
  const previous = get().blocks;
  const updated = [...previous, block];
  set({ blocks: updated });
  try {
    await persistBlocks(updated);
  } catch (err) {
    // Roll back to prevent in-memory/disk divergence
    set({ blocks: previous });
    // Surface to caller so UI can show an error
    throw err;
  }
},
```

Apply the same pattern to `updateBlock` and `deleteBlock`. The UI in `BlockLibraryPanel` should then handle the thrown error instead of using `void` (see WR-01).

---

## Warnings

### WR-01: Persistence errors are silently swallowed in all UI call sites

**File:** `src/components/blocks/BlockLibraryPanel.tsx:85`, `87`, `226`

`void addBlock(...)`, `void updateBlock(...)`, and `void deleteBlock(...)` all discard their promise return values. If the store actions reject (either now or after CR-02 is fixed), the user sees no feedback and the UI proceeds as normal. The pattern is by project convention for fire-and-forget async, but here the operations have observable side-effects (persistence) and can fail for reasons the user could act on.

**Fix:**

Replace `void` calls with `.catch` handlers that surface a recoverable error:

```tsx
function handleSave() {
  // ... validation ...
  const op = editingBlock
    ? updateBlock(editingBlock.id, { name: nameDraft.trim(), content: contentDraft })
    : addBlock({ id: crypto.randomUUID(), name: nameDraft.trim(), content: contentDraft });
  op.catch((err) => {
    setSaveError(err instanceof Error ? err.message : "Failed to save block");
  });
  setView("list");
}
```

For `deleteBlock`, either stay in the delete handler or show a toast on failure.

---

### WR-02: Unvalidated deserialization from the store can inject malformed `Block` objects

**File:** `src/stores/useBlockStore.ts:35`

```typescript
const saved = await store.get<Block[]>(BLOCKS_KEY);
```

This is a TypeScript type assertion, not runtime validation. If `blocks.json` contains data that does not match the `Block` shape (a corrupted file, a migration from a prior schema, or a manually edited store), the malformed data is treated as `Block[]`. Downstream code in `BlockLibraryPanel.tsx` accesses `block.name`, `block.id`, and `block.content` without null checks; if any are `undefined`, the UI renders incorrectly (empty `aria-label`, failed string methods) or crashes.

**Fix:**

Add a runtime filter or schema validation after deserialization:

```typescript
function isBlock(value: unknown): value is Block {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Block).id === "string" &&
    typeof (value as Block).name === "string" &&
    typeof (value as Block).content === "string"
  );
}

loadBlocks: async () => {
  const store = await load(BLOCKS_STORE_PATH);
  const saved = await store.get<unknown>(BLOCKS_KEY);
  const blocks = Array.isArray(saved) ? saved.filter(isBlock) : [];
  set({ blocks, blocksLoaded: true });
},
```

---

### WR-03: `role="alert"` only present on the JSON-parse error branch — accessibility gap in the error banner

**File:** `src/components/blocks/BlockLibraryPanel.tsx:123-141`

The error banner renders in three logical cases:
1. "Name is required" — rendered as a `<span>` with no `role`
2. "JSON must be an object" — rendered as a `<span>` with no `role`
3. All other errors (JSON parse failure) — rendered as a `<p role="alert">`

Screen readers will only announce the error automatically in case 3. Validation errors for missing name or invalid type are silently invisible to users relying on assistive technology.

**Fix:**

Apply `role="alert"` to the outermost container of the error banner, which fires for all three cases:

```tsx
{saveError && (
  <div
    role="alert"
    className="rounded-md border border-destructive/40 bg-destructive/10 p-3"
  >
    {/* ... icon and message ... */}
  </div>
)}
```

Remove the per-branch `role="alert"` from the inner `<p>`.

---

### WR-04: Concurrent writes race on the store's read-modify-write pattern

**File:** `src/stores/useBlockStore.ts:39-61`

Each write action follows a read-modify-write sequence: `get().blocks` → compute `updated` → `set({ blocks: updated })` → `await persistBlocks(updated)`. Because `get()` reads synchronously before the async `persistBlocks` awaits resolve, two concurrent calls (e.g., `addBlock(A)` followed immediately by `addBlock(B)`) can both read the same `get().blocks` snapshot, compute independent `updated` arrays, and the second `set` will overwrite the first. If B's read happens before A's `set` call, A's block is lost from the next persist cycle.

While concurrency in a desktop form tool is low probability, the risk is real when the UI calls `deleteBlock` immediately after an `addBlock` (the AlertDialog confirm path). The test suite does not cover interleaved calls.

**Fix:**

Sequence writes through a mutex or use a functional `set` with a reducer pattern that always operates on the most recent state:

```typescript
addBlock: async (block) => {
  if (!get().blocksLoaded) return;
  // Functional update — always sees the latest state at commit time
  let updated: Block[] = [];
  set((state) => {
    updated = [...state.blocks, block];
    return { blocks: updated };
  });
  await persistBlocks(updated);
},
```

This is safe for the optimistic write. For a full fix, combine with the rollback pattern from CR-02.

---

## Info

### IN-01: `onClose` prop declared and renamed to `_onClose` — dead interface contract

**File:** `src/components/blocks/BlockLibraryPanel.tsx:21-23`, `27`

The `BlockLibraryPanelProps` interface declares `onClose?: () => void`. At line 27 it is destructured and immediately aliased to `_onClose` (the underscore prefix signals intentionally unused). The `AppLayout` at line 23 does not pass this prop. The comment at line 22 acknowledges it is for "future use." Per YAGNI, this is dead interface surface that should be removed until it is needed — it misleads callers about the component's contract.

**Fix:**

Remove the `onClose` prop and the `BlockLibraryPanelProps` interface entirely. When the prop is genuinely needed in a future phase, add it then:

```tsx
// Before
export function BlockLibraryPanel({ onClose: _onClose }: BlockLibraryPanelProps) {

// After
export function BlockLibraryPanel() {
```

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
