# Phase 25: Block Apply — WKT + Map Empty Case - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/blockApply.ts` | utility (pure function) | transform | `src/components/history/historyHelpers.ts` | role-match |
| `src/lib/blockApply.test.ts` | test | — | `src/components/history/historyHelpers.test.ts` | exact |
| `src/components/form/ProtoFormRenderer.tsx` | component | event-driven | self (lines 134-180) | exact |
| `src/components/form/FormPanel.tsx` | component | event-driven | self (lines 50-83) | exact |
| `src/components/form/fields/MapField.tsx` | component | event-driven | self (lines 113, 138-151) | exact |

---

## Pattern Assignments

### `src/lib/blockApply.ts` (utility, transform)

**Analog:** `src/components/history/historyHelpers.ts`

**Imports pattern** (historyHelpers.ts lines 1-2):
```typescript
import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { ProtoSchema } from "@/lib/types";
```
For blockApply.ts, mirror this top-of-file type-only import pattern:
```typescript
import type { FieldSchema } from "@/lib/types";
```

**JSDoc pattern** (historyHelpers.ts lines 4-10, 61-68):
```typescript
/**
 * Pure filter function for history entries.
 * Used by MessageHistoryPanel.filteredEntries via useMemo.
 *
 * All filters use case-insensitive substring matching.
 */
export function filterHistoryEntries(
  entries: HistoryEntry[],
  ...
): HistoryEntry[] {
```
For blockApply.ts: export named types first, then the pure function with a JSDoc block. No default exports.

**Core pure-function pattern** (historyHelpers.ts lines 69-96 — full function body):
```typescript
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string,
  searchQuery = ""
): HistoryEntry[] {
  return entries
    .filter(...)
    .filter(...);
}
```
For buildApplyPlan: same shape — explicit parameter types, explicit return type, no side effects, no imports from React or form libraries.

**Error handling pattern:** historyHelpers.ts has no try/catch — pure data transforms do not throw. `buildApplyPlan` follows the same pattern: no try/catch; caller (`commitApply` in ProtoFormRenderer) is responsible for handling missing registry entries via optional chaining.

---

### `src/lib/blockApply.test.ts` (test)

**Analog:** `src/components/history/historyHelpers.test.ts`

**Imports pattern** (historyHelpers.test.ts lines 1-9):
```typescript
import { describe, it, expect } from "vitest";
import {
  filterHistoryEntries,
  findReplayTabIndex,
  collectFieldNames,
  collectSearchTokens,
} from "./historyHelpers";
import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { ProtoSchema } from "@/lib/types";
```
For blockApply.test.ts:
```typescript
import { describe, it, expect } from "vitest";
import { buildApplyPlan } from "@/lib/blockApply";
import type { FieldSchema } from "@/lib/types";
```

**Test helper pattern** (historyHelpers.test.ts lines 13-25):
```typescript
function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "test-id",
    timestamp: new Date().toISOString(),
    ...
    ...overrides,
  };
}
```
For blockApply.test.ts, create a `makeField` helper and `makeScalarField`/`makeWktField`/`makeMapField` shorthands following the same `overrides: Partial<FieldSchema>` pattern.

**AAA test body pattern** (historyHelpers.test.ts lines 69-78):
```typescript
it("returns all entries when both filters are empty", () => {
  // Arrange
  // Act
  const result = filterHistoryEntries(entries, "", "");
  // Assert
  expect(result).toHaveLength(3);
  expect(result).toEqual(entries);
});
```
All tests in blockApply.test.ts must follow `describe("buildApplyPlan", () => { it("...", () => { /* Arrange / Act / Assert */ }); })` — no inline arrange-act blocks without AAA comments per project conventions.

---

### `src/components/form/ProtoFormRenderer.tsx` (component, event-driven)

**Analog:** self — existing `resetRef` useEffect and existing `applyBlockRef` useEffect

**Ref-wiring pattern — resetRef** (ProtoFormRenderer.tsx lines 134-145):
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
The new `applyBlockRef` object-ref useEffect and the new `mapReplaceRegistry` callback (`handleRegisterReplace`) follow this exact structure: guard on the prop, assign `ref.current`, return cleanup that nulls the ref. Dependency array must be `[applyBlockRef, methods, message]` for the block ref (same as current line 180).

**Existing applyBlockRef implementation** (ProtoFormRenderer.tsx lines 149-180) — this is the code being refactored:
```typescript
useEffect(() => {
  if (applyBlockRef) {
    applyBlockRef.current = (blockValues: Record<string, unknown>): string[] => {
      const skipped: string[] = [];
      const eligibleFields = new Set(
        message.fields
          .filter(f =>
            f.kind.type === 'scalar' ||
            f.kind.type === 'enum' ||
            f.kind.type === 'message'   // NOTE: OQ-4 — see RESEARCH.md OQ-4 before implementing
          )
          .map(f => f.name)
      );
      for (const [key, value] of Object.entries(blockValues)) {
        if (!eligibleFields.has(key)) {
          skipped.push(key);
        } else if (methods.formState.dirtyFields[key]) {
          // dirty — skip silently
        } else {
          methods.setValue(key, value as Parameters<typeof methods.setValue>[1]);
        }
      }
      return skipped;
    };
  }
  return () => {
    if (applyBlockRef) applyBlockRef.current = null;
  };
}, [applyBlockRef, methods, message]);
```
The refactored version assigns `applyBlockRef.current = { buildPlan, commitApply }` (D-01) using the same guard/cleanup structure. The eligibility logic moves to `buildApplyPlan` in `src/lib/blockApply.ts`.

**mapReplaceRegistry ref declaration** — add adjacent to resetRef/applyBlockRef declarations:
```typescript
// New ref — keyed by full field path string; value is replace fn or null after unmount
const mapReplaceRegistry = useRef<Record<string, ((rows: unknown[]) => void) | null>>({});
```

**handleRegisterReplace callback** — stable via useCallback (see RESEARCH.md Pitfall 5):
```typescript
const handleRegisterReplace = useCallback(
  (path: string, fn: ((rows: unknown[]) => void) | null) => {
    mapReplaceRegistry.current[path] = fn;
  },
  [] // stable: mapReplaceRegistry ref object never changes
);
```

**MapField dispatch site** (ProtoFormRenderer.tsx lines 205-215) — add `onRegisterReplace` prop:
```typescript
if (field.kind.type === "map") {
  return (
    <MapField
      key={path}
      field={field}
      path={path}
      depth={depth}
      renderValue={renderField}
      onRegisterReplace={handleRegisterReplace}  // NEW
    />
  );
}
```

**Props type update** (ProtoFormRenderer.tsx lines 38-40) — update applyBlockRef type and export the new type from blockApply.ts:
```typescript
// OLD
applyBlockRef?: React.MutableRefObject<
  ((blockValues: Record<string, unknown>) => string[]) | null
>;
// NEW — import ApplyBlockRef from "@/lib/blockApply"
applyBlockRef?: React.MutableRefObject<ApplyBlockRef | null>;
```

---

### `src/components/form/FormPanel.tsx` (component, event-driven)

**Analog:** self — existing applyBlockRef declaration and onDragEnd handler

**Ref declaration** (FormPanel.tsx lines 50-52) — type must match ProtoFormRendererProps:
```typescript
// OLD
const applyBlockRef = useRef<((blockValues: Record<string, unknown>) => string[]) | null>(
  null
);
// NEW — import ApplyBlockRef from "@/lib/blockApply"
const applyBlockRef = useRef<ApplyBlockRef | null>(null);
```

**onDragEnd handler** (FormPanel.tsx lines 56-83) — update the call site:
```typescript
useDndMonitor({
  onDragEnd(event) {
    if (event.over?.id !== 'form-drop-zone' || isJsonMode) return;
    const blockId = event.active.id as string;
    if (!applyBlockRef.current) return;
    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) return;
    let blockValues: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(block.content);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      blockValues = parsed as Record<string, unknown>;
    } catch {
      toast.warning('Block content is not valid JSON — could not apply');
      return;
    }
    // OLD: const skipped = applyBlockRef.current(blockValues);
    // NEW: two-phase plan/commit (D-01)
    const plan = applyBlockRef.current.buildPlan(blockValues);
    // plan.conflicts is always [] in Phase 25 — Phase 26 adds conflict dialog
    applyBlockRef.current.commitApply(plan);
    // OQ-1: skipped toast — see RESEARCH.md OQ-1 before finalizing
  },
});
```

---

### `src/components/form/fields/MapField.tsx` (component, event-driven)

**Analog:** self — existing useFieldArray destructure and register/unregister useEffect

**useFieldArray destructure** (MapField.tsx line 113) — add `replace`:
```typescript
// OLD
const { fields, append, remove } = useFieldArray({ control, name: path });
// NEW
const { fields, append, remove, replace } = useFieldArray({ control, name: path });
```

**Props type update** (MapField.tsx lines 23-28):
```typescript
// OLD
interface MapFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderValue: RenderFieldFn;
}
// NEW — add optional prop
interface MapFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderValue: RenderFieldFn;
  onRegisterReplace?: (path: string, fn: ((rows: unknown[]) => void) | null) => void;
}
```

**useEffect registration pattern** — mirror the existing register/unregister useEffect (MapField.tsx lines 138-143):
```typescript
// EXISTING (analog to copy from):
useEffect(() => {
  register(guardName, {
    validate: () => (hasDuplicatesRef.current ? "Duplicate key" : true),
  });
  return () => unregister(guardName);
}, [register, unregister, guardName]);

// NEW (onRegisterReplace useEffect — same mount/unmount structure):
useEffect(() => {
  onRegisterReplace?.(path, replace);
  return () => { onRegisterReplace?.(path, null); };
}, [path, replace, onRegisterReplace]);
```
Note: `replace` is a stable function reference from `useFieldArray` — safe in the dependency array. Optional chaining `?.()` on `onRegisterReplace` covers the case where the prop is not passed (ProtoFormRenderer.test.tsx renders MapField without this prop in existing tests).

---

## Shared Patterns

### Ref-wiring useEffect with cleanup
**Source:** `src/components/form/ProtoFormRenderer.tsx` lines 134-145 (resetRef) and 149-180 (applyBlockRef)
**Apply to:** All new ref assignments in ProtoFormRenderer (object-ref applyBlockRef, mapReplaceRegistry wiring)
```typescript
useEffect(() => {
  if (ref) {
    ref.current = <value>;
  }
  return () => {
    if (ref) ref.current = null;
  };
}, [ref, ...stableDeps]);
```

### useCallback for stable callback props
**Source:** `src/components/form/FormPanel.tsx` lines 92-96 (handleValuesChange)
**Apply to:** `handleRegisterReplace` in ProtoFormRenderer
```typescript
const handleValuesChange = useCallback((values: unknown) => {
  useProtoStore.getState().setLatestValues(values as Record<string, unknown>);
}, []);
```

### Type-only imports from @/lib/types
**Source:** `src/components/form/ProtoFormRenderer.tsx` lines 3-4
**Apply to:** `src/lib/blockApply.ts`
```typescript
import type { FieldSchema, MessageSchema, RenderFieldFn } from "@/lib/types";
```

---

## No Analog Found

No files in this phase lack an analog. All five files have close in-project matches.

---

## Metadata

**Analog search scope:** `src/components/form/`, `src/components/history/`, `src/lib/`
**Files scanned:** 6 (ProtoFormRenderer.tsx, FormPanel.tsx, MapField.tsx, historyHelpers.ts, historyHelpers.test.ts, types.ts)
**Pattern extraction date:** 2026-05-25

**Open question flags (do not resolve in planning without user input):**
- OQ-1: Whether `ApplyPlan` needs a `skipped: string[]` field for the toast — see RESEARCH.md OQ-1
- OQ-4: Whether `'message'` kind is intentionally dropped from `ELIGIBLE_KINDS` vs current line 158 of ProtoFormRenderer.tsx — see RESEARCH.md OQ-4
