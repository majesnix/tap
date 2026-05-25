# Phase 26: Block Apply — Conflict Prompt + Oneof — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 4 (modified) + 0 (created)
**Analogs found:** 4 / 4

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/lib/blockApply.ts` | utility (pure function) | transform | self (Phase 25 loop, lines 87-131) | exact |
| `src/lib/blockApply.test.ts` | test | batch | self (Phase 25 AAA helpers, lines 1-54) | exact |
| `src/components/form/FormPanel.tsx` | component + inline sub-component | event-driven | `src/components/blocks/BlockLibraryPanel.tsx` (AlertDialog + open state pattern) | role-match |
| `src/components/form/ProtoFormRenderer.tsx` | component (form write layer) | event-driven | self (commitApply loop, lines 162-194) | exact |

**Note:** `BlockApplyConflictDialog` is NOT a separate file. Per locked decision BLK-EXT-07 it is an inline component defined inside `FormPanel.tsx`. The planner must not create a separate file for it.

---

## Pattern Assignments

### `src/lib/blockApply.ts` (utility, transform)

**Analog:** Self — Phase 25 existing implementation (same file, lines 1-131)

**Type extension pattern** — `ApplyItemKind` union (line 6) and `ConflictItem` type (lines 19-24):
```typescript
// CURRENT (Phase 25):
export type ApplyItemKind = "scalar" | "enum" | "well_known" | "map";

export type ConflictItem = {
  fieldName: string;
  blockValue: unknown;
  currentValue: unknown;
  kind: ApplyItemKind;
};

// PHASE 26 — replace both:
export type ApplyItemKind = "scalar" | "enum" | "well_known" | "map" | "oneof";

export type ConflictItemKind =
  | 'map_key_collision'
  | 'oneof_dirty_subfield'
  | 'oneof_branch_switch';

export type ConflictItem = {
  fieldName: string;
  blockValue: unknown;
  currentValue: unknown;
  kind: ConflictItemKind;
  // oneof_dirty_subfield only:
  subFieldName?: string;
  // oneof_branch_switch only:
  currentBranch?: string;
  blockBranch?: string;
  // map_key_collision only:
  collisionKey?: string;
};

export type ConflictChoices = Record<string, 'skip' | 'overwrite'>;
// Key format:
//   oneof_dirty_subfield:  "{fieldName}:{subFieldName}"  e.g. "payment:card_number"
//   oneof_branch_switch:   "{fieldName}"                 e.g. "payment"
//   map_key_collision:     "{fieldName}:{collisionKey}"  e.g. "labels:env"
```

**`ApplyBlockRef` type extension** (line 47-50) — `commitApply` signature change:
```typescript
// CURRENT (Phase 25):
export type ApplyBlockRef = {
  buildPlan: (blockValues: Record<string, unknown>) => ApplyPlan;
  commitApply: (plan: ApplyPlan) => void;
};

// PHASE 26 — make choices optional (preserves no-conflict fast path):
export type ApplyBlockRef = {
  buildPlan: (blockValues: Record<string, unknown>) => ApplyPlan;
  commitApply: (plan: ApplyPlan, choices?: ConflictChoices) => void;
};
```

**`ELIGIBLE_KINDS` extension** (line 61-66) — add `'oneof'`:
```typescript
// CURRENT (Phase 25):
const ELIGIBLE_KINDS: ReadonlySet<FieldSchema["kind"]["type"]> = new Set([
  "scalar",
  "enum",
  "well_known",
  "map",
] as const);

// PHASE 26:
const ELIGIBLE_KINDS: ReadonlySet<FieldSchema["kind"]["type"]> = new Set([
  "scalar",
  "enum",
  "well_known",
  "map",
  "oneof",
] as const);
```

**Core loop pattern** (lines 105-130) — existing eligibility-then-dirty-then-kind-switch structure to extend:
```typescript
// Analog: src/lib/blockApply.ts lines 105-128
for (const [key, value] of Object.entries(blockValues)) {
  if (!allFields.has(key)) {
    unknownKeys.push(key);
    continue;
  }
  const field = eligibleFields.get(key);
  if (!field) {
    // ineligible kind (e.g. 'message') — silent skip
    continue;
  }
  if (dirtyFields[key]) {
    // Dirty protection — field already touched by user; do not overwrite
    continue;
  }
  if (field.kind.type === "map") {
    const current = formValues[key];
    if (Array.isArray(current) && current.length > 0) {
      // PHASE 26: emit ConflictItems here instead of continue
      continue;
    }
  }
  // PHASE 26: add 'oneof' case here, before the final toApply.push
  toApply.push({ fieldName: key, value, kind: field.kind.type as ApplyItemKind });
}
```

**Oneof branch name convention** — from `src/lib/types.ts:24` and `src/components/form/fields/OneofField.tsx:37`:
```typescript
// FieldKind oneof shape:
// { type: "oneof"; branches: FieldSchema[][] }
// Branch name = first field of each inner array:
const branchName = field.kind.branches[i]?.[0]?.name;  // e.g. "card_number"
```

**Map key collision detection algorithm** (no analog exists — use RESEARCH.md §Section 3):
```typescript
const existingKeys = new Set(current.map((r: {key: unknown}) => String(r.key)));
for (const blockRow of blockRows) {
  const bk = String((blockRow as {key: unknown}).key);
  if (existingKeys.has(bk)) {
    conflicts.push({
      fieldName: key,
      blockValue: blockRow,
      currentValue: current.find((r: {key: unknown}) => String(r.key) === bk),
      kind: 'map_key_collision',
      collisionKey: bk,
    });
  }
  // non-colliding rows: skip here; added during commitApply merge
}
```

---

### `src/lib/blockApply.test.ts` (test, batch)

**Analog:** Self — Phase 25 existing tests (same file, lines 1-254)

**Test helper factory pattern** (lines 7-54) — all helpers follow this shape:
```typescript
// Analog: src/lib/blockApply.test.ts lines 7-14
function makeScalarField(name: string, scalar: ScalarKind = "string"): FieldSchema {
  return {
    name,
    label: name,
    kind: { type: "scalar", scalar },
    repeated: false,
  };
}
```

**New helper to create** — no `makeOneofField` exists in Phase 25. Planner must add:
```typescript
// NEW — no analog exists; construct from types.ts:24
function makeOneofField(name: string, branches: string[][]): FieldSchema {
  return {
    name,
    label: name,
    kind: {
      type: "oneof",
      branches: branches.map((branchFieldNames) =>
        branchFieldNames.map((bName) => makeScalarField(bName))
      ),
    },
    repeated: false,
  };
}
// Usage: makeOneofField("payment", [["card_number"], ["wire_transfer"]])
// Resulting branches[0][0].name === "card_number"
// Resulting branches[1][0].name === "wire_transfer"
```

**AAA test structure** (lines 59-74) — copy this verbatim:
```typescript
it("fills scalar field when not dirty", () => {
  // Arrange
  const fields: FieldSchema[] = [makeScalarField("qty", "int32")];
  const formValues = {};
  const dirtyFields = {};
  const blockValues = { qty: 5 };

  // Act
  const plan = buildApplyPlan(fields, formValues, dirtyFields, blockValues);

  // Assert
  expect(plan.toApply).toHaveLength(1);
  expect(plan.toApply[0]).toEqual({ fieldName: "qty", value: 5, kind: "scalar" });
  expect(plan.conflicts).toEqual([]);
  expect(plan.unknownKeys).toEqual([]);
});
```

**New test cases required** (Phase 26 — build from existing structure):
- oneof same-branch fill (non-dirty sub-field → toApply with `kind: 'oneof'`)
- oneof same-branch dirty sub-field → `conflicts` with `kind: 'oneof_dirty_subfield'`
- oneof branch-switch → `conflicts` with `kind: 'oneof_branch_switch'`
- map key collision → `conflicts` with `kind: 'map_key_collision'`
- `_selected` absent → silent skip (toApply empty, conflicts empty, unknownKeys empty)
- unrecognized branch name in `_selected` → silent skip (same expectations)

---

### `src/components/form/FormPanel.tsx` (component + inline sub-component, event-driven)

**Analog (AlertDialog pattern):** `src/components/blocks/BlockLibraryPanel.tsx` lines 1-19 + 246-278

**AlertDialog imports to copy** (BlockLibraryPanel.tsx lines 10-19):
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

**Additional imports needed for Phase 26** (not in the analog):
```typescript
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import type { ApplyPlan, ConflictChoices } from "@/lib/blockApply";
// Label is already available in the project: "@/components/ui/label"
```

**AlertDialog open-state pattern** (BlockLibraryPanel.tsx lines 247-278) — controlled open + open-change handler:
```typescript
// Analog: BlockLibraryPanel.tsx lines 247-252
<AlertDialog
  open={!!blockToDelete}
  onOpenChange={(open) => {
    if (!open) setBlockToDelete(null);
  }}
>

// PHASE 26 adaptation — state is ApplyPlan | null (not a block entity):
// const [conflictPlan, setConflictPlan] = useState<ApplyPlan | null>(null);
// const [conflictChoices, setConflictChoices] = useState<ConflictChoices>({});
<AlertDialog
  open={!!conflictPlan}
  onOpenChange={(open) => {
    if (!open) setConflictPlan(null);
  }}
>
```

**AlertDialogContent width override** (RESEARCH §AlertDialogContent — not in analog):
```typescript
// Analog's default: max-w-sm. Phase 26 needs wider dialog for conflict rows.
<AlertDialogContent className="sm:max-w-lg">
```

**Cancel/Action footer pattern** (BlockLibraryPanel.tsx lines 258-276):
```typescript
// Analog:
<AlertDialogFooter>
  <AlertDialogCancel>Keep block</AlertDialogCancel>
  <AlertDialogAction
    variant="destructive"
    onClick={() => { /* action */ }}
  >
    Delete block
  </AlertDialogAction>
</AlertDialogFooter>

// PHASE 26 adaptation — Cancel = Discard block, Action = Apply block (not destructive):
<AlertDialogFooter>
  <AlertDialogCancel>Discard block</AlertDialogCancel>
  <AlertDialogAction
    onClick={() => {
      if (conflictPlan) {
        applyBlockRef.current?.commitApply(conflictPlan, conflictChoices);
        setConflictPlan(null);
      }
    }}
  >
    Apply block
  </AlertDialogAction>
</AlertDialogFooter>
```

**onDragEnd gate pattern** (current: FormPanel.tsx lines 55-84) — add conflict branch:
```typescript
// CURRENT (Phase 25) — FormPanel.tsx lines 75-77:
const plan = applyBlockRef.current.buildPlan(blockValues);
// plan.conflicts is always [] in Phase 25 — Phase 26 adds the conflict dialog
applyBlockRef.current.commitApply(plan);

// PHASE 26 replacement:
const plan = applyBlockRef.current.buildPlan(blockValues);
if (plan.conflicts.length > 0) {
  setConflictPlan(plan);
  setConflictChoices({}); // all defaults to 'skip' (Pitfall E)
} else {
  applyBlockRef.current.commitApply(plan);
}
```

**Per-row RadioGroup pattern** — adapted from `OneofField.tsx` lines 66-86. Structural shape (OneofField as structural reference; dialog adapts it with plain state, not RHF Controller):
```typescript
// Analog structure (OneofField.tsx lines 66-86):
<RadioGroup
  value={rhfField.value}
  onValueChange={rhfField.onChange}
  className="flex flex-col gap-1"
>
  {branchNames.map((name) => (
    <div key={name} className="flex items-center gap-2">
      <RadioGroupItem value={name} id={`${path}._${name}`} />
      <Label htmlFor={`${path}._${name}`} className="text-sm">{name}</Label>
    </div>
  ))}
</RadioGroup>

// PHASE 26 per-row adaptation (plain state, not RHF Controller):
// One RadioGroup per ConflictItem, keyed by choices key format from RESEARCH §Section 4:
const choiceKey = item.kind === 'map_key_collision'
  ? `${item.fieldName}:${item.collisionKey}`
  : item.kind === 'oneof_dirty_subfield'
  ? `${item.fieldName}:${item.subFieldName}`
  : item.fieldName; // oneof_branch_switch

<RadioGroup
  value={conflictChoices[choiceKey] ?? 'skip'}
  onValueChange={(val) =>
    setConflictChoices((prev) => ({ ...prev, [choiceKey]: val as 'skip' | 'overwrite' }))
  }
  className="flex gap-4"
>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="skip" id={`${choiceKey}-skip`} />
    <Label htmlFor={`${choiceKey}-skip`} className="text-sm">Skip</Label>
  </div>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="overwrite" id={`${choiceKey}-overwrite`} />
    <Label htmlFor={`${choiceKey}-overwrite`} className="text-sm">Overwrite</Label>
  </div>
</RadioGroup>
```

**Badge pattern** (OneofField.tsx lines 63-65):
```typescript
// Analog (OneofField.tsx):
<Badge variant="outline" className="text-xs px-1.5 py-0">
  oneof
</Badge>

// PHASE 26 adaptation — kind badge on each conflict row:
<Badge variant="outline" className="text-xs px-1.5 py-0">
  {item.kind}
</Badge>
```

---

### `src/components/form/ProtoFormRenderer.tsx` (component, event-driven)

**Analog:** Self — Phase 25 `commitApply` closure (lines 172-189) and `mapReplaceRegistry` (lines 122-131)

**Current `commitApply` loop** (lines 172-189) — extend this, do NOT copy the `setValue` call verbatim:
```typescript
// CURRENT (Phase 25) — ProtoFormRenderer.tsx lines 172-189:
commitApply: (plan) => {
  for (const item of plan.toApply) {
    if (item.kind === "map") {
      mapReplaceRegistry.current[item.fieldName]?.(item.value as unknown[]);
    } else {
      // WARNING: This omits shouldDirty: false — see Pitfall D below.
      methods.setValue(
        item.fieldName,
        item.value as Parameters<typeof methods.setValue>[1]
      );
    }
  }
},
```

**CRITICAL — Pitfall D regression in existing code:** The current `methods.setValue` call at line 185 omits `{ shouldDirty: false }`. Phase 26 must fix this for ALL existing `setValue` calls in `commitApply`, not just the new oneof branches. Copy pattern:
```typescript
// CORRECT (Phase 26 — apply to all setValue calls in commitApply):
methods.setValue(
  item.fieldName,
  item.value as Parameters<typeof methods.setValue>[1],
  { shouldDirty: false }
);
```

**Extended `commitApply` signature** (line 172) — accept choices:
```typescript
// PHASE 26:
commitApply: (plan, choices = {}) => {
  // 1. Apply non-conflict items (existing loop, shouldDirty: false fix applied)
  for (const item of plan.toApply) {
    if (item.kind === "map") {
      mapReplaceRegistry.current[item.fieldName]?.(item.value as unknown[]);
    } else {
      methods.setValue(
        item.fieldName,
        item.value as Parameters<typeof methods.setValue>[1],
        { shouldDirty: false }  // Pitfall D fix
      );
    }
  }

  // 2. Apply conflict overwrite choices
  for (const conflictItem of plan.conflicts) {
    const choiceKey = conflictItem.kind === 'map_key_collision'
      ? `${conflictItem.fieldName}:${conflictItem.collisionKey}`
      : conflictItem.kind === 'oneof_dirty_subfield'
      ? `${conflictItem.fieldName}:${conflictItem.subFieldName}`
      : conflictItem.fieldName;

    if ((choices[choiceKey] ?? 'skip') !== 'overwrite') continue;

    if (conflictItem.kind === 'oneof_branch_switch') {
      // Pitfall A: atomic write — single setValue, not two calls
      const blockOneof = conflictItem.blockValue as { _selected: string; [k: string]: unknown };
      methods.setValue(
        conflictItem.fieldName,
        { _selected: blockOneof._selected, [blockOneof._selected]: blockOneof[blockOneof._selected] },
        { shouldDirty: false }
      );
    } else if (conflictItem.kind === 'oneof_dirty_subfield') {
      // Dotted-path write — _selected is already correct (same branch)
      methods.setValue(
        `${conflictItem.fieldName}.${conflictItem.subFieldName}`,
        conflictItem.blockValue as Parameters<typeof methods.setValue>[1],
        { shouldDirty: false }
      );
    } else if (conflictItem.kind === 'map_key_collision') {
      // Merge rows, then replace via registry
      // (see RESEARCH.md §Section 3 for full merge algorithm)
      // mapReplaceRegistry.current[conflictItem.fieldName]?.(mergedRows);
    }
  }
},
```

**`mapReplaceRegistry` pattern** (lines 122-131) — unchanged in Phase 26:
```typescript
// Analog: ProtoFormRenderer.tsx lines 122-131
const mapReplaceRegistry = useRef<Record<string, ((rows: unknown[]) => void) | null>>({});

const handleRegisterReplace = useCallback(
  (path: string, fn: ((rows: unknown[]) => void) | null) => {
    mapReplaceRegistry.current[path] = fn;
  },
  [] // stable: mapReplaceRegistry.current is mutated in place
);
```

**`applyBlockRef` wiring effect** (lines 162-194) — the useEffect dependency array and cleanup pattern to preserve:
```typescript
// Analog: ProtoFormRenderer.tsx lines 162-194
useEffect(() => {
  if (applyBlockRef) {
    applyBlockRef.current = {
      buildPlan: (blockValues) => buildApplyPlan(/* ... */),
      commitApply: (plan, choices = {}) => { /* ... */ },
    };
  }
  return () => {
    if (applyBlockRef) applyBlockRef.current = null;
  };
}, [applyBlockRef, methods, message]);
```

---

## Shared Patterns

### Atomic Oneof Write (Pitfall A — CRITICAL)
**Source:** CONTEXT.md + RESEARCH.md §Code Examples (codebase verified via `OneofField.tsx:49-56`)
**Apply to:** `commitApply` in `ProtoFormRenderer.tsx` — branch-switch overwrite path
```typescript
// CORRECT — single atomic call prevents unregister race:
methods.setValue(
  fieldName,
  { _selected: newBranch, [newBranch]: blockSubValue },
  { shouldDirty: false }
);

// WRONG — two calls trigger OneofField useEffect mid-write:
methods.setValue(`${fieldName}._selected`, newBranch);
methods.setValue(`${fieldName}.${newBranch}`, blockSubValue);
```

### `shouldDirty: false` on ALL commitApply `setValue` Calls (Pitfall D)
**Source:** CONTEXT.md §Established Patterns; existing code at `ProtoFormRenderer.tsx:183-185` is the WRONG pattern (omits the option)
**Apply to:** Every `setValue` call inside `commitApply` in `ProtoFormRenderer.tsx`
```typescript
// EVERY setValue in commitApply must include this option:
methods.setValue(fieldPath, value, { shouldDirty: false });
// Omitting it marks block-filled fields as user-touched → false conflicts on next drag
```

### Default-to-Skip for Conflict Rows (Pitfall E)
**Source:** CONTEXT.md §Decisions D-04; RESEARCH.md §Pitfall 5
**Apply to:** `FormPanel.tsx` — initial `conflictChoices` state + per-row RadioGroup default
```typescript
// All rows default to 'skip' — use nullish coalescing when reading choices:
const choice = conflictChoices[choiceKey] ?? 'skip';
// Initialize state to {} — absence of key === 'skip', never 'overwrite'
const [conflictChoices, setConflictChoices] = useState<ConflictChoices>({});
```

### AlertDialog Controlled-State Pattern
**Source:** `src/components/blocks/BlockLibraryPanel.tsx:247-252`
**Apply to:** `FormPanel.tsx` — `BlockApplyConflictDialog` open control
```typescript
// Trigger state is nullable entity (null = closed):
const [conflictPlan, setConflictPlan] = useState<ApplyPlan | null>(null);

<AlertDialog
  open={!!conflictPlan}
  onOpenChange={(open) => { if (!open) setConflictPlan(null); }}
>
```

### Silent Skip for Malformed Oneof (D-02)
**Source:** CONTEXT.md §D-02; analogy with existing `'message'` kind handling at `blockApply.ts:113-115`
**Apply to:** `buildApplyPlan` oneof case in `blockApply.ts`
```typescript
// Consistent with message kind silent skip:
if (!field) {
  continue; // ineligible kind — silent skip, NOT unknownKeys
}
// Oneof _selected absent or unrecognized → same continue (not unknownKeys)
if (!blockBranch || typeof blockBranch !== 'string') continue;
if (!validBranchNames.has(blockBranch)) continue;
```

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `makeOneofField` test helper | test utility | No oneof test helper exists in `blockApply.test.ts:7-54`; planner must create one matching `FieldKind.branches: FieldSchema[][]` shape from `types.ts:24` |
| Map-collision merge algorithm in `commitApply` | utility logic | No existing multi-row merge pattern exists; use RESEARCH.md §Section 3 `mergedRows` algorithm verbatim |

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/form/`, `src/components/blocks/`, `src/components/ui/`
**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-05-25
