# Phase 26: Block Apply — Conflict Prompt + Oneof — Research

**Researched:** 2026-05-25
**Domain:** React form state management, conflict resolution UX, RHF `dirtyFields` nesting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: `buildApplyPlan` accepts ONLY the RHF-native strict shape for oneof values: `{ payment: { _selected: "card_number", card_number: "value" } }`. The `_selected` discriminator is REQUIRED.
- **D-02**: If `_selected` is absent or contains an unrecognized branch name → **silent skip**. Does NOT appear in `unknownKeys`. Consistent with how `'message'` kind is handled.
- **D-03**: `buildApplyPlan` must add `'oneof'` to `ELIGIBLE_KINDS`.
- **D-04**: A block targeting a different oneof branch produces a **branch-switch conflict row inside the same batched dialog** as all other conflicts. Row label: "switch [fieldLabel] from [currentBranch] to [blockBranch]". Defaults to skip.
- **D-05**: When "overwrite" on a branch-switch row: `commitApply` performs a **single atomic `setValue`** — `setValue(fieldName, { _selected: newBranch, [newBranch]: blockSubValue }, { shouldDirty: false })`. No second dialog follows.
- **D-06**: When "skip" on a branch-switch row: all block values for that oneof field are discarded (no partial apply).

### Locked from Phase 25 (carry forward)

- `applyBlockRef.current = { buildPlan, commitApply }` — two-phase ref shape unchanged
- `mapReplaceRegistry` useRef pattern for map fields — unchanged
- `BlockApplyConflictDialog` lives in `FormPanel` (BLK-EXT-07) — already locked
- **Pitfall A**: oneof must be set atomically — `setValue(key, { _selected, [branch]: value }, { shouldDirty: false })`
- **Pitfall D**: `shouldDirty: false` on ALL block apply `setValue` calls
- **Pitfall E**: All conflict rows default to **skip** (not overwrite)

### Claude's Discretion

- Exact mechanism for passing conflict choices from `BlockApplyConflictDialog` to `commitApply` — options: extend signature to `commitApply(plan, choices)` or merge confirmed conflicts into a modified plan before calling. Either approach acceptable; document chosen shape in plan.
- `ConflictItem.kind` union shape — whether to use three flat literals or a single `'oneof'` with sub-discriminator.

### Deferred Ideas (OUT OF SCOPE)

- Block apply in JSON mode (BLK-EXT-FUTURE-01)
- Recursive nested-message merge (BLK-EXT-FUTURE-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLK-EXT-03 | Map field key collision dialog: batched, per-row overwrite/skip | Map row shape confirmed: `Array<{key, value}>`. Collision = `current.some(r => r.key === blockRow.key)`. Overwrite uses `mapReplaceRegistry.replace()` with merged rows. |
| BLK-EXT-04 | Oneof same-branch: fill non-dirty sub-fields, conflict dirty sub-fields | `dirtyFields` mirrors nested object structure — `dirtyFields[fieldName]?.[subFieldName]` is the correct access pattern (verified via RHF source types). |
| BLK-EXT-05 | Oneof branch-switch: batched conflict row in same dialog; switch on overwrite | D-04/D-05 locked. Atomic setValue bypasses OneofField unregister race (Pitfall A). |
| BLK-EXT-06 | All conflicts from one drag in one dialog; Apply and Cancel; rows default to skip | `AlertDialog` primitive confirmed in codebase. Three conflict `kind` values map directly to three row label templates in UI-SPEC. |
</phase_requirements>

---

## Summary

Phase 26 extends the block-apply pipeline — already split into `buildApplyPlan` (pure) + `commitApply` (write) in Phase 25 — with conflict detection and a batched resolution dialog. The work is contained to four files: `blockApply.ts` (type extensions + algorithm), `blockApply.test.ts` (new test cases), `FormPanel.tsx` (dialog + trigger logic), and `ProtoFormRenderer.tsx` (commitApply extended to accept conflict choices).

No new packages are needed. All UI primitives (`AlertDialog`, `RadioGroup`, `Badge`, `ScrollArea`) are already installed and confirmed present in `/src/components/ui/`. The `nyquist_validation` config flag is `false`, so no test infrastructure section is required.

**Primary recommendation:** Implement `ConflictItem.kind` as a three-literal flat union (`'map_key_collision' | 'oneof_dirty_subfield' | 'oneof_branch_switch'`) so the dialog renderer can `switch(kind)` directly to the label template from UI-SPEC without an inner discriminator lookup.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Conflict detection (pure) | `src/lib/blockApply.ts` | — | Pure function, no React, no side effects — stays in lib |
| Conflict choice state | `FormPanel.tsx` (React local state) | — | Dialog is owned by FormPanel (BLK-EXT-07 locked decision) |
| Conflict write execution | `ProtoFormRenderer.tsx` (`commitApply`) | — | Already owns all `setValue` and `mapReplaceRegistry` access |
| Dialog UI | `FormPanel.tsx` (new `BlockApplyConflictDialog` component) | — | Collocated with `FormPanel` per BLK-EXT-07 |

---

## Standard Stack

No new packages are installed in this phase. All dependencies are already present.

### Confirmed Present in `package.json`

| Library | Installed Version | Used For |
|---------|------------------|----------|
| `react-hook-form` | `^7.76.0` | `dirtyFields`, `setValue`, `useFormContext` |
| `radix-ui` (AlertDialog) | `^1.4.3` | Dialog primitive via `@/components/ui/alert-dialog` |
| `radix-ui` (RadioGroup) | `^1.4.3` | Per-row skip/overwrite choice |
| `radix-ui` (Badge) | `^1.4.3` | Kind badge on conflict rows |
| `radix-ui` (ScrollArea) | `^1.4.3` | Scroll container for conflict row list |

[VERIFIED: package.json] — all packages confirmed in `/Users/majesnix/gits/proto-sender/package.json`.
[VERIFIED: codebase] — all component files confirmed in `/src/components/ui/`.

### AlertDialogContent Width Override

The existing `AlertDialogContent` uses `data-[size=default]:max-w-xs` / `sm:max-w-sm` (confirmed in `alert-dialog.tsx:59`). The UI-SPEC requires `sm:max-w-lg` via `className` override on `AlertDialogContent`. This is a `className` prop pass-through — no component modification needed. [VERIFIED: codebase]

---

## Package Legitimacy Audit

No new packages are installed in this phase. This section is not applicable.

---

## Architecture Patterns

### Conflict Resolution Flow

```
onDragEnd (FormPanel)
  → buildApplyPlan(blockValues)          [pure, in blockApply.ts]
      → for each oneof field:
          validate _selected present + branch name recognized
          if same branch: per-sub-field dirty check → ConflictItem / ApplyItem
          if different branch: single ConflictItem (kind: 'oneof_branch_switch')
      → for each non-empty map field:
          per-key collision check → ConflictItem / merged into ApplyItem
  → plan.conflicts.length > 0?
      YES → setState(plan) → open BlockApplyConflictDialog
      NO  → commitApply(plan, {})        [immediate, unchanged Phase 25 path]
  
BlockApplyConflictDialog
  → renders ConflictRow × N (RadioGroup per row, default "skip")
  → Apply block → commitApply(plan, choices)
  → Discard block → dismiss, no writes

commitApply(plan, choices) [ProtoFormRenderer.tsx]
  → toApply items (unchanged Phase 25 loop)
  → conflicts where choices[key] === 'overwrite':
      oneof_dirty_subfield → per-sub-field setValue({shouldDirty:false})
      oneof_branch_switch  → atomic setValue({_selected, [branch]: val}, {shouldDirty:false})
      map_key_collision    → merge rows → mapReplaceRegistry replace()
```

### Recommended Project Structure (affected files only)

```
src/
├── lib/
│   ├── blockApply.ts         — extend: ConflictItem kind union, ELIGIBLE_KINDS, buildApplyPlan oneof+map collision
│   └── blockApply.test.ts    — extend: oneof same-branch fill, dirty conflict, branch-switch, map collision, _selected absent
└── components/form/
    ├── FormPanel.tsx          — add BlockApplyConflictDialog, update onDragEnd gate, state for open/plan/choices
    └── ProtoFormRenderer.tsx  — extend commitApply signature to (plan, choices), add oneof+map_collision write branches
```

---

## Critical Implementation Details

### 1. `dirtyFields` Shape for Nested Oneof Sub-Fields

`formState.dirtyFields` mirrors the **nested object structure** of the form values, not flat dotted keys. [CITED: react-hook-form docs, type definition `DeepMap<DeepPartial<TFieldValues>, boolean>`]

For a oneof field `payment` with active branch `card_number` that the user has edited:
```
dirtyFields = { payment: { card_number: true } }
```
NOT:
```
dirtyFields = { "payment.card_number": true }
```

**Algorithm in `buildApplyPlan` for same-branch dirty sub-field detection:**
```typescript
// dirtyFields is Partial<Record<string, unknown>> — cast to nested shape at use site
const dirtyOneof = (dirtyFields[key] ?? {}) as Partial<Record<string, boolean>>;
const subDirty = dirtyOneof[subFieldName] === true;  // true = user has touched this sub-field
```

`buildApplyPlan` currently receives `dirtyFields` as `Partial<Record<string, unknown>>`. The oneof sub-field check must cast `dirtyFields[key]` to a nested object and check individual sub-field names.

### 2. `ConflictItem` Kind Union — Recommended Shape

Recommend **three flat literals** matching the UI-SPEC row label table exactly:

```typescript
// In blockApply.ts — replace the existing ConflictItem definition
export type ConflictItemKind =
  | 'map_key_collision'
  | 'oneof_dirty_subfield'
  | 'oneof_branch_switch';

export type ConflictItem = {
  fieldName: string;      // top-level form field key (e.g. "payment", "labels")
  blockValue: unknown;
  currentValue: unknown;
  kind: ConflictItemKind;
  // oneof_dirty_subfield only:
  subFieldName?: string;  // e.g. "card_number"
  // oneof_branch_switch only:
  currentBranch?: string; // e.g. "card_number"
  blockBranch?: string;   // e.g. "wire_transfer"
  // map_key_collision only:
  collisionKey?: string;  // e.g. "env"
};
```

The dialog renderer can then `switch(item.kind)` directly to the label template from UI-SPEC:
- `'map_key_collision'` → `"{mapFieldLabel}" — key "{collisionKey}" already exists`
- `'oneof_dirty_subfield'` → `"{oneofLabel}.{subFieldLabel}" already has a value`
- `'oneof_branch_switch'` → `Switch "{fieldLabel}" from "{currentBranch}" to "{blockBranch}"`

**Why not a sub-discriminator:** The flat 3-literal union avoids an extra object layer that would complicate the switch in `commitApply` and the label template switch in the dialog. The optional fields per kind are narrow enough that a discriminated union suffices.

### 3. Map Row Shape — Confirmed

Map fields store rows as `Array<{key: unknown, value: unknown}>` via `useFieldArray`. [VERIFIED: codebase, `MapField.tsx:117`, `handleAppend` at line 182]

Block values for a map field must be in the same shape: `[{ key: "env", value: "prod" }]`. This is already working in Phase 25 (BLK-EXT-02), so the shape is consistent. No coercion needed.

**Key collision detection algorithm:**
```typescript
// current = formValues[key] as Array<{key: unknown}>
// blockRows = blockValues[key] as Array<{key: unknown}>
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
  } else {
    // Non-colliding block rows: go into toApply as kind:'map' (or handled during commit)
  }
}
```

**Merge strategy at commitApply time (overwrite):**
```typescript
// Merge: keep all existing rows; replace colliding rows with block values for those marked overwrite
const overwriteKeys = new Set(
  conflictsForField
    .filter(c => choices[`${c.fieldName}:${c.collisionKey}`] === 'overwrite')
    .map(c => c.collisionKey!)
);
const mergedRows = [
  ...existingRows.map((r: {key: unknown}) =>
    overwriteKeys.has(String(r.key))
      ? blockRows.find((br: {key: unknown}) => String(br.key) === String(r.key)) ?? r
      : r
  ),
  ...blockRows.filter((br: {key: unknown}) => !existingKeys.has(String(br.key))),
];
mapReplaceRegistry.current[fieldName]?.(mergedRows);
```

### 4. `commitApply` Signature Recommendation

Extend to `commitApply(plan: ApplyPlan, choices: ConflictChoices)` where:

```typescript
// In blockApply.ts
export type ConflictChoices = Record<string, 'skip' | 'overwrite'>;
// Key format:
//   oneof_dirty_subfield:  "{fieldName}:{subFieldName}"  e.g. "payment:card_number"
//   oneof_branch_switch:   "{fieldName}"                 e.g. "payment"
//   map_key_collision:     "{fieldName}:{collisionKey}"  e.g. "labels:env"
```

**Rationale for compound keys:** A single map field can generate multiple `ConflictItem` entries (one per colliding key). Using `"{fieldName}:{collisionKey}"` as the choices key disambiguates these. Branch-switch conflicts are one-per-field, so a bare `fieldName` key suffices. Keeping all choices in a single flat `Record` is simpler than a two-level structure.

`ApplyBlockRef.commitApply` type in `blockApply.ts:49` changes from `(plan: ApplyPlan) => void` to `(plan: ApplyPlan, choices?: ConflictChoices) => void`. Making `choices` optional with default `{}` allows `FormPanel`'s no-conflict fast path (`plan.conflicts.length === 0`) to call `commitApply(plan)` unchanged.

### 5. Atomic Oneof Write — Pitfall A Interaction with OneofField

When `commitApply` performs the atomic branch-switch write:
```typescript
methods.setValue(
  fieldName,
  { _selected: newBranch, [newBranch]: blockSubValue },
  { shouldDirty: false }
);
```

`OneofField`'s `useEffect` (line 49–56 in `OneofField.tsx`) fires when `_selected` changes via `useWatch`. It calls `unregister(path.${name})` for all branches where `name !== selected`. This **unregisters the old branch** (correct) and does NOT unregister `newBranch` (correct — `newBranch === selected` at that point). The new branch value written atomically is safe from this side effect. [VERIFIED: codebase, `OneofField.tsx:43-56`]

The atomic write approach bypasses the mount-wait concern entirely because `setValue` writes directly to form state without requiring branch component re-mount.

### 6. `buildApplyPlan` Oneof Algorithm (same-branch case)

When a block provides `{ payment: { _selected: "card_number", card_number: "4111..." } }` and the form's active branch is also `card_number`:

```typescript
// Inside the 'oneof' case in buildApplyPlan
const blockOneof = value as { _selected: string; [branch: string]: unknown };
const blockBranch = blockOneof._selected;
if (!blockBranch || typeof blockBranch !== 'string') continue; // D-02 silent skip

// Validate branch name exists in schema
const validBranchNames = new Set(field.kind.branches.map(b => b[0]?.name).filter(Boolean));
if (!validBranchNames.has(blockBranch)) continue; // D-02 silent skip

const currentValue = formValues[key] as { _selected?: string } | undefined;
const currentBranch = currentValue?._selected;

if (currentBranch !== blockBranch) {
  // Branch switch — single conflict row per D-04
  conflicts.push({
    fieldName: key,
    blockValue: value,
    currentValue: currentValue,
    kind: 'oneof_branch_switch',
    currentBranch: currentBranch ?? '',
    blockBranch,
  });
} else {
  // Same branch — check each sub-field for dirty state
  const dirtyOneof = (dirtyFields[key] ?? {}) as Partial<Record<string, boolean>>;
  const branchFields = field.kind.branches.find(b => b[0]?.name === blockBranch) ?? [];
  for (const branchField of branchFields) {
    const subFieldName = branchField.name;
    const subValue = blockOneof[subFieldName];
    if (subValue === undefined) continue;
    if (dirtyOneof[subFieldName]) {
      // Dirty sub-field → conflict
      conflicts.push({
        fieldName: key,
        blockValue: subValue,
        currentValue: (currentValue as Record<string, unknown>)?.[subFieldName],
        kind: 'oneof_dirty_subfield',
        subFieldName,
      });
    } else {
      // Clean sub-field → apply directly (dotted-path: same-branch, _selected unchanged)
      toApply.push({ fieldName: `${key}.${subFieldName}`, value: subValue, kind: 'oneof' });
    }
  }
}
```

**Note on `ApplyItemKind`:** `'oneof'` must be added to the `ApplyItemKind` union in `blockApply.ts:6`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog primitive | Custom modal | `AlertDialog` from `@/components/ui/alert-dialog` | Already installed; handles focus trap, Escape, overlay |
| Per-row radio | Custom toggle buttons | `RadioGroup` + `RadioGroupItem` from `@/components/ui/radio-group` | Already installed; correct accessible semantics for skip/overwrite |
| Scroll container | `div` with `overflow-y-auto` | `ScrollArea` from `@/components/ui/scroll-area` — or a plain `div` per UI-SPEC | UI-SPEC allows either; plain `div` is fine since no custom scrollbar styling is needed |
| Choices state | Zustand store | `useState` in `FormPanel` | Choices are ephemeral per-drag; no need to persist or share outside the dialog |

---

## Common Pitfalls

### Pitfall 1: `ApplyItemKind` Missing `'oneof'`

**What goes wrong:** The `kind` field on `ApplyItem` does not include `'oneof'`, causing a TypeScript error when `buildApplyPlan` tries to push oneof items to `toApply`.
**How to avoid:** Add `'oneof'` to the `ApplyItemKind` union in `blockApply.ts:6` AND to `ELIGIBLE_KINDS` at line 61. Both must be updated together.
**Warning signs:** TypeScript compiler error on the push: `'oneof' is not assignable to type 'ApplyItemKind'`.

### Pitfall 2: Oneof Non-Atomic Write (Pitfall A, CRITICAL)

**What goes wrong:** Calling `setValue(fieldName + '._selected', newBranch)` then `setValue(fieldName + '.' + newBranch, value)` as separate calls triggers `OneofField.useEffect` mid-write, causing the new branch field to be unregistered before the second call lands.
**How to avoid:** Always use the single atomic form: `setValue(fieldName, { _selected: newBranch, [newBranch]: value }, { shouldDirty: false })`.
**Warning signs:** Form shows the new branch selected but the value field is empty/disappeared.

### Pitfall 3: `shouldDirty: false` Omission (Pitfall D)

**What goes wrong:** `setValue` without `{ shouldDirty: false }` marks block-applied fields as user-touched. On the next block drag, `buildApplyPlan` sees those fields as dirty and emits false conflicts.
**How to avoid:** Every `setValue` inside `commitApply` must pass `{ shouldDirty: false }`. No exceptions.
**Warning signs:** Dragging the same block twice produces a conflict dialog the second time when no user edits have occurred.

### Pitfall 4: Map Conflict Choices Key Format

**What goes wrong:** Using bare `fieldName` as the `ConflictChoices` key for map collisions means all collisions for the same map field share one choice, losing per-key granularity.
**How to avoid:** Use compound key `"${fieldName}:${collisionKey}"` for `map_key_collision` entries in `ConflictChoices`. See Section 4 above.
**Warning signs:** All colliding map keys are overwritten or skipped together instead of individually.

### Pitfall 5: Dialog Default Focus Must Be Cancel

**What goes wrong:** If `AlertDialogAction` receives auto-focus, a user pressing Enter immediately applies all block values at their default skip state — unexpected if they expected to review first.
**How to avoid:** `AlertDialogCancel` must receive auto-focus (Radix AlertDialog default behavior). Verify no `autoFocus` prop is placed on `AlertDialogAction`.
**Warning signs:** Pressing Enter immediately after the dialog opens closes it and fires `commitApply`.

### Pitfall 6: `_selected` Silent Skip vs Unknown Key

**What goes wrong:** A block with a oneof field missing `_selected` (e.g., `{ payment: { card_number: "..." } }`) might be wrongly pushed to `unknownKeys`, causing a toast warning.
**How to avoid:** Per D-02, the silent skip path is inside the `'oneof'` eligible-kind branch — after `allFields.has(key)` is true and `eligibleFields.get(key)` returns the field. A missing `_selected` is caught inside the oneof handler and the loop `continue`s. The key must NOT reach the `unknownKeys.push(key)` path.
**Warning signs:** Users see a "N fields from block not in form" toast for oneof fields with malformed block shapes.

---

## Code Examples

### Atomic Oneof Write (Pitfall A enforcement)

```typescript
// Source: STATE.md Accumulated Context + OneofField.tsx:49-56 (codebase verified)
// CORRECT — single atomic call:
methods.setValue(
  fieldName,
  { _selected: newBranch, [newBranch]: blockSubValue },
  { shouldDirty: false }
);

// WRONG — two separate calls trigger unregister race:
methods.setValue(`${fieldName}._selected`, newBranch);
methods.setValue(`${fieldName}.${newBranch}`, blockSubValue);
```

### `buildApplyPlan` Oneof Branch Detection (same-branch sub-field)

```typescript
// Source: analysis of OneofField.tsx + RHF dirtyFields type definition
// dirtyFields mirrors nested object structure — NOT flat dotted keys
const dirtyOneof = (dirtyFields[key] ?? {}) as Partial<Record<string, boolean>>;
const subDirty = dirtyOneof[subFieldName] === true;
```

### Map Overwrite Merge in `commitApply`

```typescript
// Source: analysis of MapField.tsx useFieldArray pattern
const existingRows = currentValue as Array<{key: unknown; value: unknown}>;
const blockRows = blockValues as Array<{key: unknown; value: unknown}>;
const overwriteKeys = new Set(/* choices filtered to 'overwrite' + map collisions */);
const mergedRows = [
  ...existingRows.map(r =>
    overwriteKeys.has(String(r.key))
      ? blockRows.find(br => String(br.key) === String(r.key)) ?? r
      : r
  ),
  ...blockRows.filter(br => !existingKeySet.has(String(br.key))),
];
mapReplaceRegistry.current[fieldName]?.(mergedRows);
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dirtyFields` for nested oneof mirrors object structure (`dirtyFields.payment.card_number`), not dotted keys | Section 1 + BLK-EXT-04 algorithm | If wrong: dirty sub-field detection always returns false; all dirty sub-fields would be overwritten silently |
| A2 | Block content for map fields is already stored as `Array<{key, value}>` consistent with MapField row shape | Section 3 | If wrong: collision detection fails; block map values would not match form row shape |

Note: A2 is low-risk — Phase 25 BLK-EXT-02 (empty map fill) is in production and already uses this shape. If it were wrong, Phase 25 would have been broken.

A1 is the only load-bearing assumption. It is MEDIUM confidence (cited from RHF type definitions + documentation, not directly tested in this codebase). The planner should add a test case specifically asserting dirty sub-field detection works as expected.

---

## Open Questions

1. **`buildApplyPlan` oneof `toApply` item shape — RESOLVED: dotted-path fine-grained.**
   - **Decision:** One `ApplyItem` per clean sub-field, with `fieldName = "${fieldName}.${subFieldName}"` and `value = subValue`, `kind = 'oneof'`. See Section 6 code example.
   - **Rationale:** Avoids clobber bug — multiple `setValue("payment", { ... })` calls in a loop overwrite each other; only the last sub-field survives. RHF `setValue("payment.card_number", v, { shouldDirty: false })` writes into the nested object without touching siblings. The atomic form (`{ _selected, [branch]: value }`) is ONLY needed for the branch-switch overwrite path in `commitApply` — not for same-branch clean fills where `_selected` is already correct.

---

## Environment Availability

Step 2.6: SKIPPED — phase installs no external dependencies; all required packages confirmed present.

---

## Security Domain

This phase involves no network I/O, authentication, user input persistence, or cryptographic operations. All conflict resolution is synchronous local React form state. No ASVS categories apply. Security domain not applicable.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/blockApply.ts` — types, ELIGIBLE_KINDS, existing algorithm (codebase, read directly)
- `src/lib/blockApply.test.ts` — existing test structure (codebase, read directly)
- `src/components/form/FormPanel.tsx` — current onDragEnd flow, applyBlockRef pattern (codebase, read directly)
- `src/components/form/ProtoFormRenderer.tsx` — commitApply current implementation, mapReplaceRegistry pattern (codebase, read directly)
- `src/components/form/fields/OneofField.tsx` — `_selected` tracking, unregister effect (codebase, read directly)
- `src/components/form/fields/MapField.tsx` — useFieldArray row shape `{key, value}`, replace fn registration (codebase, read directly)
- `src/components/ui/alert-dialog.tsx` — width constraint via data-size, component API (codebase, read directly)
- `package.json` — installed versions of all dependencies (codebase, read directly)

### Secondary (MEDIUM confidence)
- react-hook-form `dirtyFields` type definition — `DeepMap<DeepPartial<TFieldValues>, boolean>` mirrors nested object structure [CITED: react-hook-form type system, verified via web search confirming nested boolean object shape]

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json and src/components/ui/
- Architecture: HIGH — existing patterns fully read from source; no guessing
- Pitfalls: HIGH — derived directly from existing code and locked STATE.md pitfall list
- dirtyFields nesting shape: MEDIUM — cited from RHF type definitions, not directly tested via a test case in this codebase

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable libraries; no fast-moving ecosystem questions)
