# Phase 12: Block Library — Drag-and-Drop Layer - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 3 source files, 2 test files
**Analogs found:** 3 / 3 (all source files have strong existing analogs)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/blocks/BlockLibraryPanel.tsx` | component | event-driven | `src/components/blocks/BlockLibraryPanel.tsx` (self — additive) | exact |
| `src/components/form/FormPanel.tsx` | component | event-driven | `src/components/form/FormPanel.tsx` (self — additive, resetRef pattern) | exact |
| `src/components/form/ProtoFormRenderer.tsx` | component | request-response | `src/components/form/ProtoFormRenderer.tsx` (self — additive, resetRef wiring) | exact |
| `src/components/blocks/BlockLibraryPanel.test.tsx` | test | — | `src/components/blocks/BlockLibraryPanel.test.tsx` (self — additive) | exact |
| `src/components/form/__tests__/FormPanel.test.tsx` | test | — | `src/components/form/__tests__/FormPanel.test.tsx` (self — additive) | exact |

All changes are **additive modifications to existing files** — no new files are created.

---

## Pattern Assignments

### `src/components/form/ProtoFormRenderer.tsx` (component, request-response)

**Change:** Add `applyBlockRef` prop to `ProtoFormRendererProps` interface; add a new `useEffect` to wire `applyBlockRef.current` to a function that iterates block values, checks field eligibility and dirty state, calls `methods.setValue`, and returns a list of skipped field names.

**FROZEN constraint:** The dispatch table (switch block) must NOT be modified (lines 133-232).

#### Imports pattern (lines 1-11)
```typescript
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useEffect } from "react";
import type { FieldSchema, MessageSchema, RenderFieldFn } from "@/lib/types";
```
`applyBlockRef` needs no new imports — `useEffect` and `React.MutableRefObject` are already available.

#### Props interface — `resetRef` template (lines 15-26)
This is the EXACT shape to copy for `applyBlockRef`. Difference: the function signature returns `string[]` instead of `void`.
```typescript
interface ProtoFormRendererProps {
  message: MessageSchema;
  onValuesChange: (values: unknown) => void;
  /**
   * Optional ref that will be populated with a form.reset function once the
   * form is mounted. FormPanel uses this to trigger replay without prop-drilling
   * all the way through the component tree.
   */
  resetRef?: React.MutableRefObject<
    ((values: Record<string, unknown>) => void) | null
  >;
}
```
New prop to add alongside `resetRef`:
```typescript
applyBlockRef?: React.MutableRefObject<
  ((blockValues: Record<string, unknown>) => string[]) | null
>;
```

#### Core ref-wiring pattern — `resetRef` useEffect (lines 117-128)
This is the EXACT template for the `applyBlockRef` useEffect. Copy structure verbatim; replace body with block-apply logic.
```typescript
useEffect(() => {
  if (resetRef) {
    resetRef.current = (values: Record<string, unknown>) => {
      methods.reset(values);
    };
  }
  return () => {
    if (resetRef) {
      resetRef.current = null;  // Nullify on actual unmount only
    }
  };
}, [resetRef, methods]);
```
- Dependency array: `[applyBlockRef, methods, message]` (message needed because `message.fields` drives eligible field set)
- Cleanup: `if (applyBlockRef) applyBlockRef.current = null;`
- `methods.formState.dirtyFields[key]` (per D-03) guards writes
- `methods.setValue(key, value)` with default `shouldDirty: false` — do NOT pass `{ shouldDirty: true }`

#### Field eligibility check — types reference (`src/lib/types.ts` lines 20-40)
```typescript
export type FieldKind =
  | { type: "scalar"; scalar: ScalarKind }
  | { type: "message"; full_name: string }
  | { type: "enum"; values: EnumValue[] }
  | { type: "oneof"; branches: FieldSchema[][] }
  | { type: "well_known"; wkt: "Timestamp" | "Duration" | string }
  | { type: "map"; key_type: ScalarKind; value_kind: FieldKind };

export interface FieldSchema {
  name: string;
  label: string;
  kind: FieldKind;
  repeated: boolean;
  oneof_group?: string;
  default_value?: unknown;
}
```
Eligible fields: `!field.repeated && (field.kind.type === 'scalar' || field.kind.type === 'enum')`.

---

### `src/components/form/FormPanel.tsx` (component, event-driven)

**Change:** Add `applyBlockRef` (mirroring `resetRef`); add `isDraggingOver` local state; wire `onDragOver`, `onDragLeave`, `onDrop` to the existing `<ScrollArea>`; fire `toast.warning` when skipped fields are returned.

#### Ref declaration pattern — `resetRef` analog (lines 43-46)
```typescript
const resetRef = useRef<((values: Record<string, unknown>) => void) | null>(
  null
);
```
New ref to add alongside it:
```typescript
const applyBlockRef = useRef<((blockValues: Record<string, unknown>) => string[]) | null>(
  null
);
```

#### Drop zone target — existing `<ScrollArea>` (lines 237-243)
This is the exact element that receives the three DnD event handlers and the `isDraggingOver` CSS class. Currently:
```typescript
<ScrollArea className="flex-1 min-h-0">
  <ProtoFormRenderer
    message={message}
    onValuesChange={handleValuesChange}
    resetRef={resetRef}
  />
</ScrollArea>
```
After Phase 12:
- `className` gains `isDraggingOver && "ring-2 ring-primary/50"` (use `cn()` — already used in the codebase)
- Add `onDragOver`, `onDragLeave`, `onDrop` props to `<ScrollArea>`
- Add `applyBlockRef={applyBlockRef}` to `<ProtoFormRenderer>`

**Structural note:** The drop zone is inside the `else` branch of the `isJsonMode` ternary (line 236). JSON mode naturally has no `<ScrollArea>` and therefore no drop target. No explicit `!isJsonMode` guard is needed — it is already structurally impossible to drop in JSON mode.

#### BLK-08 warning toast analog — unknown-field warning (lines 151-161)
This is the closest existing analog for the BLK-08 skipped-fields warning. Same shape: build a known set, filter, conditional `toast.warning` with singular/plural label. Copy the structure directly.
```typescript
const knownFieldNames = new Set(message.fields.map((f) => f.name));
const unknownKeys = Object.keys(parsedValues).filter(
  (k) => !knownFieldNames.has(k)
);
if (unknownKeys.length > 0) {
  const label = unknownKeys.length === 1 ? "field" : "fields";
  toast.warning(
    `${unknownKeys.length} unknown ${label} ignored: ${unknownKeys.join(", ")}`
  );
}
```
BLK-08 toast wording (from D-06): `"N field(s) from block not in form: [fieldA, fieldB, …]"` — adapt the template above with this exact copy.

#### Imports already present in FormPanel.tsx (lines 1-11)
```typescript
import { useCallback, useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
```
Also add `useBlockStore` import:
```typescript
import { useBlockStore } from "@/stores/useBlockStore";
```

---

### `src/components/blocks/BlockLibraryPanel.tsx` (component, event-driven)

**Change:** Add `draggable="true"`, `onDragStart`, and `cursor-grab` class to each block row `<div>` in the list view. Editor view is unaffected (editor view has no block rows).

#### Drag source target — block row div (lines 193-216)
Current block row in list view:
```typescript
<div
  key={block.id}
  className="px-3 py-2 flex items-center justify-between hover:bg-muted rounded-sm"
>
  <span className="text-sm truncate flex-1">{block.name}</span>
  <div className="flex items-center gap-2 shrink-0">
    {/* Edit and Delete buttons */}
  </div>
</div>
```
Add to this div:
- `draggable="true"`
- `onDragStart={(e) => { e.dataTransfer.setData('blockId', block.id); }}`
- `cursor-grab active:cursor-grabbing` appended to `className`

The `useBlockStore` import (line 20) and `toast` import (line 19) are already present.

---

## Test Pattern Assignments

### `src/components/blocks/BlockLibraryPanel.test.tsx` — drag source tests

**Add to existing test file** alongside the existing `List view` describe block.

#### Store mock pattern (lines 22-50) — reuse for drag tests
```typescript
const { mockLoadBlocks, mockAddBlock, mockUpdateBlock, mockDeleteBlock } = vi.hoisted(() => ({
  mockLoadBlocks: vi.fn().mockResolvedValue(undefined),
  mockAddBlock: vi.fn().mockResolvedValue(undefined),
  mockUpdateBlock: vi.fn().mockResolvedValue(undefined),
  mockDeleteBlock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/stores/useBlockStore", () => ({
  useBlockStore: vi.fn(),
}));

function setupStore(overrides: Partial<ReturnType<typeof useBlockStore>> = {}) {
  vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "light" } as ReturnType<typeof useTheme>);
  vi.mocked(useBlockStore).mockReturnValue({
    blocks: [],
    blocksLoaded: true,
    loadBlocks: mockLoadBlocks,
    addBlock: mockAddBlock,
    updateBlock: mockUpdateBlock,
    deleteBlock: mockDeleteBlock,
    ...overrides,
  } as unknown as ReturnType<typeof useBlockStore>);
}
```

#### DataTransfer mock pattern (no existing analog — see below)
No DnD tests exist in the codebase. Use RESEARCH.md Pattern 3 verbatim:
```typescript
function createDataTransfer(data: Record<string, string>) {
  const store: Record<string, string> = { ...data };
  return {
    getData: (key: string) => store[key] ?? '',
    setData: vi.fn((key: string, value: string) => { store[key] = value; }),
    types: Object.keys(data),
  };
}
```

---

### `src/components/form/__tests__/FormPanel.test.tsx` — drop zone tests

**Add to existing test file** alongside the existing `Block Library Toggle` describe block.

#### Toast mock pattern (lines 30-33) — reuse for BLK-08 test
```typescript
const { mockToastWarning } = vi.hoisted(() => ({
  mockToastWarning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { warning: mockToastWarning } }));
```

#### BLK-08 toast test analog (lines 266-283)
This test is the structural template for the BLK-08 drop warning test. It fires an event, checks `mockToastWarning` was called with the exact message copy.
```typescript
test("unknown top-level keys trigger toast.warning with correct message", () => {
  render(<FormPanel />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
  });
  act(() => {
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: '{"value":"ok","ghost":"here"}' },
    });
  });
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Return to form" }));
  });
  expect(mockToastWarning).toHaveBeenCalledWith(
    "1 unknown field ignored: ghost"
  );
});
```
Adapt this structure for DnD drop → `fireEvent.drop` with DataTransfer mock → assert `mockToastWarning` called with BLK-08 wording.

**Note:** Drop zone tests require `applyBlockRef.current` to be callable. Since `ProtoFormRenderer` mounts inside `FormPanel`, the ref will be populated after render. Use `waitFor` or a second `act` cycle to let the `useEffect` that wires `applyBlockRef.current` run.

---

## Shared Patterns

### Ref Wiring (Cross-cutting — ProtoFormRenderer + FormPanel)
**Source:** `src/components/form/ProtoFormRenderer.tsx` lines 117-128 + `src/components/form/FormPanel.tsx` lines 43-46
**Apply to:** `applyBlockRef` in both files
```typescript
// FormPanel: declare the ref
const applyBlockRef = useRef<((blockValues: Record<string, unknown>) => string[]) | null>(null);

// ProtoFormRenderer: wire the ref in useEffect
useEffect(() => {
  if (applyBlockRef) {
    applyBlockRef.current = (blockValues: Record<string, unknown>): string[] => {
      // ... apply logic here
    };
  }
  return () => {
    if (applyBlockRef) applyBlockRef.current = null;
  };
}, [applyBlockRef, methods, message]);
```

### Toast Warning (Cross-cutting — FormPanel drop handler)
**Source:** `src/components/form/FormPanel.tsx` lines 151-161
**Apply to:** BLK-08 warning in `onDrop` handler
Pattern: build known-name set, filter, conditional `toast.warning` with singular/plural label.

### `vi.hoisted` Mock Pattern (Cross-cutting — both test files)
**Source:** `src/components/form/__tests__/FormPanel.test.tsx` lines 30-33 and `src/components/blocks/BlockLibraryPanel.test.tsx` lines 17-20
**Apply to:** `mockToastWarning` in FormPanel tests; any new `useBlockStore.getState` mock in drop tests
```typescript
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock("module", () => ({ export: mockFn }));
```

---

## No Analog Found

| File / Pattern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| Native HTML5 DnD event handlers | — | event-driven | No DnD tests or handlers exist in the codebase. Use RESEARCH.md Pattern 1 (drop zone with `preventDefault`) and Pattern 3 (DataTransfer mock) |
| `createDataTransfer` test helper | test utility | — | jsdom does not implement DataTransfer; no existing mock in the repo. Use RESEARCH.md Pattern 3 verbatim |

---

## Metadata

**Analog search scope:** `src/components/form/`, `src/components/blocks/`, `src/lib/types.ts`, `src/stores/useBlockStore.ts`
**Files scanned:** 8 (ProtoFormRenderer.tsx, FormPanel.tsx, BlockLibraryPanel.tsx, BlockLibraryPanel.test.tsx, FormPanel.test.tsx, ProtoFormRenderer.test.tsx, types.ts, useBlockStore.ts)
**Pattern extraction date:** 2026-05-20
