---
phase: 12-block-library-drag-and-drop-layer
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/blocks/BlockLibraryPanel.test.tsx
  - src/components/blocks/BlockLibraryPanel.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/components/form/__tests__/FormPanel.test.tsx
  - src/components/form/__tests__/ProtoFormRenderer.test.tsx
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 12 adds HTML5 drag-and-drop to the tap app: block library rows as drag sources, `applyBlockRef` merge engine in `ProtoFormRenderer`, and a drop zone with BLK-08 toast in `FormPanel`. The implementation is structurally sound — toast copy is correct (singular/plural, no "(s)"), ref lifecycle cleanup is correct, and `dragStart` data transfer encoding is correct. Five warnings were found: a crash-path when block content parses to `null`, a misleading type cast in the drag-leave containment guard, a missing user-facing error when block content is unparseable, an affordance shown for non-block drags (fix includes an important case-sensitivity note about the HTML5 DnD spec), and a test that passes for the wrong reason (null ref guard instead of unknown-id guard). No blockers were found.

## Warnings

### WR-01: `handleDrop` crashes if `block.content` parses to `null`

**File:** `src/components/form/FormPanel.tsx:219-226`

**Issue:** `JSON.parse(block.content) as Record<string, unknown>` is a lying cast. When `block.content` is the string `"null"` (valid JSON), `JSON.parse` succeeds and returns `null` at runtime; the cast does not guard against this. `blockValues` is then `null`. Four lines later, `applyBlockRef.current(blockValues)` passes `null` into `ProtoFormRenderer`'s closure which calls `Object.entries(blockValues)` at line 155. `Object.entries(null)` throws `TypeError: Cannot convert undefined or null to object`. This error is not inside the surrounding `try-catch` (which ends at line 224), so it propagates uncaught through the React event handler.

`BlockLibraryPanel.handleSave` validates content as a non-null object before persisting, but `blocks.json` is disk-resident user-editable storage (see `useBlockStore.ts:4`), so tampered or hand-written entries can contain `"null"` or `"[]"`.

**Fix:**
```typescript
function handleDrop(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setIsDraggingOver(false);

  const blockId = e.dataTransfer.getData('blockId');
  if (!blockId || !applyBlockRef.current) return;

  const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
  if (!block) return;

  let blockValues: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(block.content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
    blockValues = parsed as Record<string, unknown>;
  } catch {
    return;
  }

  const skipped = applyBlockRef.current(blockValues);
  // ...
}
```

---

### WR-02: `handleDragLeave` uses `as Node` cast, suppressing a legitimate null

**File:** `src/components/form/FormPanel.tsx:204`

**Issue:** `e.relatedTarget` is typed `EventTarget | null` in React's `DragEvent`. The code casts it to `Node`:

```typescript
if (!e.currentTarget.contains(e.relatedTarget as Node)) {
```

`Element.contains()` accepts `Node | null` per the DOM spec and returns `false` for `null`, so the runtime behavior is correct when the cursor leaves the window (where `relatedTarget` is `null`). However, `EventTarget` is a broader type than `Node` — an `EventTarget` that is not a `Node` (e.g., a `Window` or `ServiceWorker`) would be silently miscast. With `"strict": true` in `tsconfig.json`, the cast suppresses a genuine type-safety warning. The fix is to widen the cast to include `null`, which is what the DOM API actually accepts.

**Fix:**
```typescript
function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
    setIsDraggingOver(false);
  }
}
```

---

### WR-03: `handleDrop` silently swallows unparseable block content with no user feedback

**File:** `src/components/form/FormPanel.tsx:222-224`

**Issue:** When `JSON.parse(block.content)` throws (malformed JSON in stored block), the handler returns silently:

```typescript
} catch {
  return;
}
```

The user drops a block and nothing happens — no toast, no error. The BLK-08 requirement (per `12-UI-SPEC.md`) specifically calls for user feedback via `toast.warning`. Malformed block content is a real user-visible failure case: the block was saved, a drop was attempted, and the form was not updated. Silent failure makes the feature appear broken.

**Fix:**
```typescript
} catch {
  toast.warning(`Block "${block.name}" has invalid JSON content.`);
  return;
}
```

---

### WR-04: `handleDragOver` lights up the drop affordance for non-block drags

**File:** `src/components/form/FormPanel.tsx:198-201`

**Issue:** `handleDragOver` calls `setIsDraggingOver(true)` unconditionally — it does not check `e.dataTransfer.types` to verify the drag payload is a block. Any drag (a file from Finder, selected text from the browser, an image from another tab) will add the `ring-2 ring-primary/50` visual highlight to the scroll area, then silently no-op on drop. This is misleading: the affordance tells the user "you can drop here" but nothing happens.

**Fix — important case-sensitivity constraint:** The HTML5 spec normalizes `DataTransfer` format strings to ASCII lowercase at write time (step 1 of `setData`: "convert format to ASCII lowercase"). `setData('blockId', ...)` therefore stores under the key `'blockid'`. `getData('blockId')` works because both sides normalize identically. However, `dataTransfer.types` (the read-only list) contains the already-lowercased key `'blockid'`, not `'blockId'`. The check must use the lowercased key:

```typescript
// HTML5 DnD spec lowercases setData format keys in DataTransfer.types.
// 'blockId' becomes 'blockid' in types even though getData('blockId') still works.
const BLOCK_DND_TYPE = 'blockid';

function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
  if (!e.dataTransfer.types.includes(BLOCK_DND_TYPE)) return;
  e.preventDefault();
  setIsDraggingOver(true);
}
```

The existing test for `dragOver` (`FormPanel.test.tsx:369-376`) fires `dragOver` with an empty `createDataTransfer({})`. With the guard added, that test will fail because `types` is empty. The test must be updated to use `createDataTransfer({ blockId: 'block-1' })` to simulate a real block drag before asserting `ring-2`. The mock `createDataTransfer`'s `types: Object.keys(data)` does not lowercase keys, so the test should use `blockid` (lowercase) as the key or update the mock to replicate spec behavior.

Note: `e.dataTransfer.types` is available during `dragover` (unlike `getData`, which is restricted to the `drop` event). Removing `preventDefault()` when not handling the drag lets the browser's default rejection cursor show for non-block drags.

---

### WR-05: "Unknown blockId" test passes for the wrong reason — the null-ref guard fires, not the not-found guard

**File:** `src/components/form/__tests__/FormPanel.test.tsx:423-431`

**Issue:** The test titled "drop with unknown blockId is silent no-op (no toast)" fires `fireEvent.drop` without first flushing `ProtoFormRenderer`'s mount effect that wires `applyBlockRef.current`. The other two drop tests correctly call `await act(async () => {})` before the drop to let the effect run. This test does not.

At the moment of the drop, `applyBlockRef.current` is still `null`. `handleDrop` exits at:

```typescript
if (!blockId || !applyBlockRef.current) return;
```

The test passes not because `'nonexistent'` is absent from the block store, but because `applyBlockRef.current` is `null`. The intended guard (`if (!block) return`) at line 217 is never reached. If the ref were wired before the drop (correct state), the test would still pass — but it would be testing the correct code path.

This is a latent test isolation bug: if `applyBlockRef.current` initialization becomes synchronous (e.g., moved from `useEffect` to a layout effect or direct assignment), this test could start producing false negatives.

**Fix:**
```typescript
test("drop with unknown blockId is silent no-op (no toast)", async () => {
  const { container } = render(<FormPanel />);
  const scrollArea = container.querySelector('[data-slot="scroll-area"]') as HTMLElement;
  const dataTransfer = createDataTransfer({ blockId: 'nonexistent' });
  // Flush ProtoFormRenderer's useEffect that wires applyBlockRef.current
  await act(async () => {});
  act(() => {
    fireEvent.drop(scrollArea, { dataTransfer });
  });
  expect(mockToastWarning).not.toHaveBeenCalled();
});
```

---

## Info

### IN-01: `closest('div')` couples drag-source tests to JSX nesting depth

**File:** `src/components/blocks/BlockLibraryPanel.test.tsx:374, 381, 388, 402`

**Issue:** Four drag-source tests locate the draggable row via `screen.getByText('...').closest('div')`. If the JSX wraps the block name `<span>` in an additional `<div>` (e.g., for a tooltip or hover menu), `closest('div')` returns the wrong ancestor and the test either fails or silently targets the wrong element.

**Fix:** Add a `data-testid="block-row-{block.id}"` to the draggable `<div>` in `BlockLibraryPanel.tsx` and query by `screen.getByTestId(...)` in tests.

---

### IN-02: Toast copy is correct — no "(s)" form present

**File:** `src/components/form/FormPanel.tsx:228-231`, `src/components/form/__tests__/FormPanel.test.tsx:401, 418`

Verified: singular path produces `"1 field from block not in form: ..."`, plural produces `"2 fields from block not in form: ..."`. Both test assertions match. No "(s)" anti-pattern. No finding — noted as explicitly checked per review scope.

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
