# Phase 21: Step Editor (Authoring) - Research

**Researched:** 2026-05-23
**Domain:** React drag-and-drop sortable lists, react-hook-form isolation, Tauri/Zustand store mutations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `PlanDetailPanel` becomes a two-pane sub-split: step list (fixed-width ~240px, left) and `StepFieldEditor` (flex-1, right). No resize handle.

**D-02:** Each step row: `GripVertical` drag handle + step name (truncated) + kebab (⋮) menu. Kebab actions: Rename / Duplicate / Delete. Rename uses inline input (Phase 20 pattern). Delete triggers AlertDialog.

**D-03:** Single "+" button opens a shadcn `DropdownMenu` with three options: Blank step / From history / From block library.

**D-04:** Clicking a step row selects it — loads its form in the right pane. Selected step highlighted with `bg-accent text-accent-foreground`.

**D-05:** Right pane empty states: "No steps yet" (no steps in plan) and "Select a step to edit it" (steps exist, none selected).

**D-06:** `StepFieldEditor` renders field primitives (`ScalarField`, `EnumField`, `NestedMessageField`, `OneofField`, `RepeatedField`, `BytesField`, `MapField`, `WellKnownTypeField`) directly — NOT via `ProtoFormRenderer`.

**D-07:** `StepFieldEditor` uses `react-hook-form` (`useForm`) with its own isolated form instance, initialized from `JSON.parse(step.field_values)`. NOT shared with `useProtoStore`.

**D-08:** `StepFieldEditor` layout: scrollable sections with visual dividers, no tabs. Section order: Proto file + message type → Fields → Target → Response mode.

**D-09:** Auto-save via `watch` (debounced ~300ms) serializes field values to JSON and calls `usePlanStore.updateStep`. No Save button. Optimistic write + rollback on error.

**D-10:** `HistoryEntry` gets `protoPath: string` added. Old entries without it fall back to auto-match by `messageTypeName` in `openFiles`.

**D-11:** History picker: Sheet with `HistoryEntry` list (newest first). Selecting creates new PlanStep pre-filled per D-11. Error toast on proto mismatch.

**D-12:** Block picker: Sheet with `useBlockStore.blocks` list. Selecting creates step pre-filled with `field_values` from `block.content`. Proto path + message type left blank (acceptable for v1).

**D-13:** `@dnd-kit/sortable` as new dependency. `SortableContext` + `useSortable` + `arrayMove`.

**D-14:** Plan-scoped `DndContext` wraps the step list inside `PlanDetailPanel` — separate from AppLayout's `DndContext`.

**D-15:** On `dragEnd`: call `usePlanStore.reorderSteps(planId, fromIndex, toIndex)`. `DragOverlay` shows dragged step name.

### Claude's Discretion

- Step list column width: ~240px fixed (`w-60` class)
- StepFieldEditor layout: scrollable with dividers + section headers (no tabs)
- "+" button placement: header of step list column (adjacent to "Steps" label)
- Response mode defaults when creating a blank step: `{ mode: 'no-wait', delay_ms: 200 }`
- PointerSensor activationConstraint: `{ distance: 4 }` (per UI-SPEC; AppLayout uses 8 — see Pitfall 6)

### Deferred Ideas (OUT OF SCOPE)

- Step-level JSON override toggle
- Step reorder via keyboard
- Block import auto-filling proto path
- Response mode default per plan
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STEP-01 | User can add a step: select .proto + message type, fill fields (StepFieldEditor), choose target, set response mode | `addStep` store action + StepFieldEditor component + buildDefaultValues reuse |
| STEP-02 | User can import a step from message history — field values pre-filled | `StepHistoryPicker` Sheet + `HistoryEntry.protoPath` addition + `PublishBar` appendEntry update |
| STEP-03 | User can import a step from block library — field values pre-filled | `StepBlockPicker` Sheet + `block.content` deserialization |
| STEP-04 | User can duplicate an existing step within the same plan | `duplicateStep` store action (new UUID, name `"{original} (copy)"`) |
| STEP-05 | User can reorder steps via drag-and-drop | `@dnd-kit/sortable` SortableContext + `reorderSteps` store action |
| STEP-06 | User can rename or delete individual steps | Inline rename (Phase 20 pattern) + AlertDialog delete + `deleteStep`/`updateStep` store actions |
</phase_requirements>

---

## Summary

Phase 21 fills in the `PlanDetailPanel` placeholder from Phase 20 with a fully functional step authoring UI. The phase is almost entirely frontend work — no new Rust commands, no new IPC calls. The risk concentrates in two areas: (1) correctly isolating the `StepFieldEditor` form from `useProtoStore` while still reusing all existing field primitive components, and (2) the auto-save debounce lifecycle, which can produce echo loops or stale saves if not implemented carefully.

The underlying type system (`PlanStep`, `PublishTarget`, `ResponseMode`) was fully defined in Phase 19 and is stable. The drag-and-drop library (`@dnd-kit/sortable`) is a new npm dependency with a peer requirement of `@dnd-kit/core ^6.3.0`, which matches the installed `6.3.1` version — no version conflicts. All field primitive components call `useFormContext()` to get their `control` reference, so wrapping them in a fresh `<FormProvider>` (with `StepFieldEditor`'s isolated `useForm` instance) is the correct and complete isolation approach.

The `usePlanStore` needs five new actions that CONTEXT.md only partially enumerates: `addStep`, `updateStep`, `deleteStep`, `duplicateStep`, and `reorderSteps`. The planner must include all five.

**Primary recommendation:** Build in waves — store actions first (Wave 1), then StepListPanel (Wave 2), then StepFieldEditor (Wave 3), then import pickers (Wave 4). Dependencies flow one-way: the UI cannot function without the store actions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Step CRUD (add/rename/delete/duplicate) | Frontend state (Zustand) | Plugin-store (Tauri) | All mutations are optimistic writes to Zustand, persisted via `tauri-plugin-store` |
| Step reorder (drag-and-drop) | Frontend state (Zustand) | Plugin-store (Tauri) | `reorderSteps` is a pure array transform in Zustand; persistence follows same pattern |
| Step form state | Component-local (react-hook-form) | Zustand (usePlanStore via debounced updateStep) | Form values live in a `useForm` instance scoped to `StepFieldEditor`; they drain into Zustand only on auto-save |
| Proto schema resolution | Zustand (useProtoStore) | — | `openFiles` in `useProtoStore` is the authoritative list of parsed schemas |
| History import | Zustand (useHistoryStore) | — | `entries` from `useHistoryStore`; picker reads this store directly |
| Block import | Zustand (useBlockStore) | — | `blocks` from `useBlockStore`; picker reads this store directly |
| UI rendering (step list, pickers, editor) | React components (Frontend) | — | Pure UI layer consuming Zustand stores |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 [VERIFIED: node_modules] | DndContext, DragOverlay, PointerSensor | Already used in AppLayout for block drag-and-drop |
| `react-hook-form` | 7.76.0 [VERIFIED: package.json] | Isolated form state for StepFieldEditor | Already used in ProtoFormRenderer; `useWatch` for auto-save |
| `zustand` | 5.0.13 [VERIFIED: package.json] | Store mutations (usePlanStore) | Project-wide state store |

### New Dependency
| Library | Version | Purpose | Why This Version |
|---------|---------|---------|-----------------|
| `@dnd-kit/sortable` | 10.0.0 [VERIFIED: npm registry] | `SortableContext`, `useSortable`, `arrayMove`, `verticalListSortingStrategy` | Peer requires `@dnd-kit/core ^6.3.0` — matches installed 6.3.1 exactly |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/utilities` | 3.2.2 [VERIFIED: npm registry] | `CSS.Transform.toString(transform)` for useSortable transform style | Transitive dep of `@dnd-kit/sortable`; import directly in SortableStepRow |

**Installation:**
```bash
npm install @dnd-kit/sortable@^10.0.0
```

**Version verification note:** `@dnd-kit/sortable@10.0.0` still exports the legacy API (`SortableContext`, `useSortable`, `arrayMove`, `verticalListSortingStrategy`) from `@dnd-kit/sortable`. The Context7 `/clauderic/dnd-kit` migration docs describing `SortableContext is no longer needed` refer to the *new* `@dnd-kit/react` package (a completely separate npm package, not yet a standard recommendation). Do not confuse these. [VERIFIED: npm pack inspection of @dnd-kit/sortable@10.0.0 dist/index.d.ts]

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction
    │
    ├── Step list click/drag ──────────────────────────────────────────────────────┐
    │      │                                                                        │
    │      ▼                                                                        ▼
    │   StepListPanel                                                    usePlanStore
    │   (plan-scoped DndContext)                                         addStep / updateStep /
    │      │  ├── SortableContext + useSortable per row                  deleteStep / duplicateStep /
    │      │  ├── DragOverlay (floating row clone)                       reorderSteps
    │      │  └── dragEnd → reorderSteps(planId, from, to) ─────────────────────┘
    │      │
    │      └── selectStep → selectedStepId (local React state in PlanDetailPanel)
    │
    ├── StepFieldEditor (right pane)
    │      │
    │      ├── init: useForm(defaultValues = JSON.parse(step.field_values))
    │      │         ← reset only when selectedStepId changes
    │      │
    │      ├── Section: Proto file selector
    │      │         reads useProtoStore.openFiles
    │      │         → step.proto_path, step.message_type
    │      │
    │      ├── Section: Fields (FormProvider wraps all)
    │      │         ScalarField / EnumField / ... call useFormContext()
    │      │         → useWatch() → debounce 300ms → updateStep(planId, stepId, {field_values: json})
    │      │
    │      ├── Section: Target (RadioGroup + Input)
    │      │         → updateStep(planId, stepId, {target: ...})
    │      │
    │      └── Section: Response mode (RadioGroup + conditional Inputs)
    │                → updateStep(planId, stepId, {response_mode: ...})
    │
    └── "+" Add menu (DropdownMenu)
           ├── Blank step → addStep(planId, newStep) → auto-select new step
           ├── From history → open StepHistoryPicker Sheet
           │         useHistoryStore.entries → user selects → addStep(planId, prefilled)
           └── From block library → open StepBlockPicker Sheet
                     useBlockStore.blocks → user selects → addStep(planId, prefilled)
```

### Recommended Project Structure

```
src/components/plans/
├── PlanDetailPanel.tsx       # Modified — replace placeholder with two-pane sub-split
├── PlanListPanel.tsx         # Unchanged (Phase 20)
├── PlanView.tsx              # Unchanged (Phase 20)
├── StepListPanel.tsx         # New — left pane: sortable rows, DndContext, "+" menu
├── StepFieldEditor.tsx       # New — right pane: FormProvider + 4 sections + auto-save
├── StepHistoryPicker.tsx     # New — Sheet: history entry list for import
└── StepBlockPicker.tsx       # New — Sheet: block list for import

src/stores/
└── usePlanStore.ts           # Add: addStep, updateStep, deleteStep, duplicateStep, reorderSteps

src/stores/
└── useHistoryStore.ts        # Add protoPath?: string to HistoryEntry interface

src/components/publish/
└── PublishBar.tsx            # Update appendEntry call to include protoPath from useProtoStore
```

### Pattern 1: Isolated Form Instance in StepFieldEditor

```typescript
// Source: ProtoFormRenderer.tsx (adapted — isolate from useProtoStore)
// CRITICAL: initialize from step.field_values ONCE on mount; reset ONLY on stepId change.
// DO NOT re-initialize from step.field_values on every render — causes echo loop.

function StepFieldEditor({ step, planId, schema }: StepFieldEditorProps) {
  const { updateStep } = usePlanStore();
  const methods = useForm({
    defaultValues: safeParseFieldValues(step.field_values, schema),
  });

  // Reset form ONLY when the selected step changes — not on every field_values update
  const prevStepIdRef = useRef(step.id);
  useEffect(() => {
    if (prevStepIdRef.current !== step.id) {
      prevStepIdRef.current = step.id;
      methods.reset(safeParseFieldValues(step.field_values, schema));
    }
  }, [step.id]);  // Deliberately omit step.field_values from deps

  const watchedValues = useWatch({ control: methods.control });

  // Debounce: keyed to stepId via ref to prevent stale saves on rapid step switch
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStepIdRef = useRef(step.id);
  currentStepIdRef.current = step.id;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const capturedStepId = step.id;
    debounceRef.current = setTimeout(() => {
      // Guard: only save if the step hasn't changed during the debounce window
      if (currentStepIdRef.current === capturedStepId) {
        const json = JSON.stringify(watchedValues);
        updateStep(planId, capturedStepId, { field_values: json })
          .catch(() => toast.error("Failed to save step. Changes may be lost."));
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watchedValues]);

  return (
    <FormProvider {...methods}>
      <form>
        {/* sections rendered here — field primitives call useFormContext() */}
      </form>
    </FormProvider>
  );
}
```

### Pattern 2: usePlanStore Step Actions (new)

All five actions follow the identical optimistic-rollback pattern established in Phase 19/20:

```typescript
// Source: usePlanStore.ts (pattern — all five follow this shape)

addStep: async (planId: string, step: PlanStep): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [];
  let updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) =>
      p.id === planId ? { ...p, steps: [...p.steps, step] } : p
    );
    return { plans: updated };
  });
  try {
    await persistPlans(updated);
  } catch (err) {
    set({ plans: previous });
    throw err;
  }
},

updateStep: async (planId: string, stepId: string, partial: Partial<PlanStep>): Promise<void> => {
  // same pattern: map over plans → find plan → map over steps → merge partial
},

deleteStep: async (planId: string, stepId: string): Promise<void> => {
  // same pattern: filter steps array
},

duplicateStep: async (planId: string, stepId: string): Promise<Plan | null> => {
  // new UUID for step; name = `${original.name} (copy)` (UI-SPEC copywriting contract)
},

reorderSteps: async (planId: string, fromIndex: number, toIndex: number): Promise<void> => {
  // arrayMove(steps, fromIndex, toIndex) inline (or import from @dnd-kit/sortable)
},
```

### Pattern 3: SortableContext + useSortable for Step Rows

```typescript
// Source: @dnd-kit/sortable@10.0.0 API (VERIFIED via npm pack dist inspection)
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// In StepListPanel:
<DndContext
  sensors={sensors}  // PointerSensor with { distance: 4 }
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={(event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const fromIndex = steps.findIndex(s => s.id === active.id);
      const toIndex = steps.findIndex(s => s.id === over.id);
      reorderSteps(planId, fromIndex, toIndex).catch(console.error);
    }
    setActiveDragId(null);
  }}
>
  <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
    {steps.map(step => <SortableStepRow key={step.id} step={step} ... />)}
  </SortableContext>
  <DragOverlay dropAnimation={null}>
    {activeDragStep ? (
      <div className="bg-background border border-border shadow-md rounded px-3 py-2 text-sm">
        {activeDragStep.name}
      </div>
    ) : null}
  </DragOverlay>
</DndContext>

// SortableStepRow:
function SortableStepRow({ step, ... }) {
  const {
    attributes,
    listeners,     // attach to GripVertical ONLY, not the row (see Pitfall 5)
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center ...", isDragging && "opacity-50")}>
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical size={14} className="text-muted-foreground" />
      </div>
      <span className="text-sm truncate flex-1">{step.name}</span>
      <DropdownMenu>...</DropdownMenu>
    </div>
  );
}
```

### Pattern 4: Safe field_values Parse

```typescript
// Always wrap JSON.parse — persisted plans can be corrupt
function safeParseFieldValues(
  fieldValues: string,
  schema: MessageSchema | null
): Record<string, unknown> {
  if (!schema) return {};
  try {
    const parsed = JSON.parse(fieldValues);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
  } catch {
    // corrupt JSON — fall back to defaults
  }
  return buildDefaultValues(schema);
}
```

### Pattern 5: Proto File Resolution for StepFieldEditor

```typescript
// StepFieldEditor needs the schema for step.proto_path + step.message_type
// Use useProtoStore.openFiles — do NOT trigger file loading from StepFieldEditor

const openFiles = useProtoStore(s => s.openFiles);
const matchedFile = openFiles.find(f => f.filePath === step.proto_path);
const schema = matchedFile?.schema ?? null;
const message = schema?.message_map[step.message_type] ?? null;

// Four states:
// 1. step.proto_path is empty → "Select a .proto file to get started"
// 2. proto_path set but file not open → "Open [filename] in the file picker first"
// 3. file open but message_type not in schema → same guidance
// 4. both found → render field sections
```

### Anti-Patterns to Avoid

- **Reinitializing form on every `step.field_values` change**: causes echo loop — form resets while user is typing. Initialize only on `step.id` change.
- **Attaching `listeners`/`attributes` to the entire step row**: breaks kebab clicks and row selection. Attach to the `GripVertical` handle element only.
- **Nesting DndContext inside AppLayout's DndContext**: causes nested context conflicts. Phase 21's DndContext lives inside PlanDetailPanel — AppLayout's DndContext is only active in `viewMode === "main"`.
- **Calling `updateStep` synchronously in the `watch` callback**: always debounce; synchronous writes on every keystroke are wasteful and will cause multiple persistence writes per second.
- **Importing from `@dnd-kit/react/sortable`**: this is the NEW separate package (still experimental), not `@dnd-kit/sortable`. Use the latter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable list reorder | Custom mousedown handlers, `onMouseMove` drag tracking | `@dnd-kit/sortable` + `useSortable` | Handles multi-pointer, keyboard accessibility, collision detection, scroll-during-drag |
| Debounced form save | `useEffect` with `setTimeout` re-invented | `useRef`+`setTimeout` inline (no extra library) | `react-hook-form` has no built-in debounce; a simple ref+timeout is sufficient — don't add `use-debounce` or `lodash.debounce` |
| Transform style for dragged element | `window.pageXOffset` math | `CSS.Transform.toString(transform)` from `@dnd-kit/utilities` | Already a transitive dep; exact correct coordinate math for drag |
| Default form values for blank step | Manually constructing `Record<string, unknown>` | `buildDefaultValues(message)` from `ProtoFormRenderer.tsx` | Already handles all FieldKind variants including oneof, repeated, map |

**Key insight:** Virtually all hard problems in this phase (sortable, form isolation, default values) have existing solutions in the installed library set. The only new install is `@dnd-kit/sortable`.

---

## Common Pitfalls

### Pitfall 1: Auto-Save Echo Loop
**What goes wrong:** `watch()` fires → `updateStep()` writes to Zustand → Zustand state change propagates to React → `step.field_values` prop updates → form `reset()` fires again → cursor jumps, selection lost, field loses focus.
**Why it happens:** If `useEffect` initializes the form from `step.field_values` on every render (instead of only on `step.id` change), every save triggers a re-init.
**How to avoid:** Track `prevStepIdRef`; call `methods.reset()` only when `step.id` changes. Never include `step.field_values` in the `useEffect` dependency array that triggers reset.
**Warning signs:** Form loses focus or cursor position after every keystroke that isn't the last.

### Pitfall 2: Stale Debounce Fires on Step Switch
**What goes wrong:** User edits step A, clicks step B within 300ms. The pending debounce fires for `capturedStepId = A`, but `selectedStepId` is now B. If `stepId` isn't checked inside the callback, the old step's partial save runs correctly, but if `currentStepIdRef` tracking is missing, the wrong stepId might receive the update.
**Why it happens:** The `watch` effect closes over `step.id` at render time; if the component re-renders with a new step, a stale closure may have an old ID.
**How to avoid:** Use `currentStepIdRef` updated on every render; check `currentStepIdRef.current === capturedStepId` inside the timeout callback before writing.
**Warning signs:** Editing step B shows step A's values after 300ms.

### Pitfall 3: JSON Parse Failure in field_values
**What goes wrong:** `JSON.parse(step.field_values)` throws if the string is `""` (new step before first save), `"undefined"`, or a truncated write.
**Why it happens:** `crypto.randomUUID()` creation of new blank steps initializes with `buildDefaultValues`-generated values, but if serialization ever produced a non-object, the next load corrupts the form.
**How to avoid:** Always use `safeParseFieldValues()` wrapper that falls back to `buildDefaultValues(schema)` on any parse error or non-object result.
**Warning signs:** StepFieldEditor crashes with "Unexpected token" console error when selecting a step.

### Pitfall 4: DragOverlay Clipped by ScrollArea
**What goes wrong:** If `<DragOverlay>` is placed inside the `<ScrollArea>`, the overlay gets clipped at the scroll boundary and disappears when dragging outside the visible area.
**Why it happens:** ScrollArea uses CSS `overflow: hidden` or `overflow: auto` internally.
**How to avoid:** Place `<DragOverlay>` as a sibling to `<SortableContext>`, inside the `<DndContext>` root but OUTSIDE the `<ScrollArea>`. See AppLayout's pattern: DragOverlay is at the same level as the DndContext children, not nested inside them.
**Warning signs:** Dragged element disappears or clips when moved above or below the visible scroll region.

### Pitfall 5: Drag Listeners on Entire Row Breaks Kebab and Selection
**What goes wrong:** Attaching `{...listeners}` and `{...attributes}` to the full step row div causes every click (including kebab button clicks and row-select clicks) to be captured as drag interaction initiators.
**Why it happens:** `useSortable`'s `listeners` include `onPointerDown`. If applied to the row, clicking the kebab triggers drag sensor before the DropdownMenu can open.
**How to avoid:** Attach `{...listeners}` and `{...attributes}` to the `GripVertical` icon wrapper ONLY. The row itself handles `onClick` for step selection.
**Warning signs:** DropdownMenu doesn't open on kebab click; or it opens but immediately closes.

### Pitfall 6: PointerSensor activationConstraint Distance
**What goes wrong:** UI-SPEC specifies `{ distance: 4 }` but AppLayout uses `{ distance: 8 }`. Using 4 may cause accidental drag activation when clicking in the grip area.
**Why it happens:** At 4px, a slightly unsteady click triggers drag. AppLayout uses 8 for exactly this reason.
**How to avoid:** This is Claude's Discretion — the planner should use 4 per UI-SPEC but note the discrepancy from AppLayout. Either is valid; document the choice explicitly.
**Warning signs:** Step selection or kebab interaction occasionally starts a drag unexpectedly.

### Pitfall 7: History Entry protoPath Fallback
**What goes wrong:** Old `HistoryEntry` records without `protoPath` cause the import to fail silently or show wrong data.
**Why it happens:** D-10 adds `protoPath` to new entries, but stored `history.json` has entries without it.
**How to avoid:** Add `protoPath?: string` (optional, not required) to `HistoryEntry`. In `StepHistoryPicker`, if `entry.protoPath` is undefined, scan `openFiles` for a file whose schema contains `entry.messageTypeName`. If no match found, show error toast (per D-10 copywriting: "Open the .proto file for [messageTypeName] first, then retry.").
**Warning signs:** History picker crashes or shows blank step after import from an old entry.

### Pitfall 8: AlertDialog Must Be Outside ScrollArea
**What goes wrong:** AlertDialog rendered inside a ScrollArea or inside a DropdownMenuItem fails to render correctly — portal target is constrained.
**Why it happens:** AlertDialog renders via a React portal. If its trigger is inside a scrolled container with overflow-hidden, the portal may not work as expected.
**How to avoid:** Follow Phase 20's exact pattern: render `<AlertDialog>` at the component root of `StepListPanel`, NOT inside the `ScrollArea`. DropdownMenuItem "Delete" must call `e.preventDefault()` to prevent menu close before `stepToDelete` state is set.
**Warning signs:** AlertDialog does not appear after clicking Delete, or appears in the wrong position.

---

## Code Examples

### StepListPanel: DndContext Setup

```typescript
// Source: AppLayout.tsx (adapted for step list — plan-scoped DndContext)
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
);
// activationConstraint.distance: 4 per UI-SPEC (AppLayout uses 8 — intentionally different)
```

### Field Primitives: FormContext Dependency

All field primitives call `useFormContext()` internally [VERIFIED: grep of ScalarField.tsx and EnumField.tsx]:

```typescript
// From ScalarField.tsx:
import { Controller, useFormContext } from "react-hook-form";
// ...
const { control } = useFormContext();

// From EnumField.tsx:
import { Controller, useFormContext } from "react-hook-form";
// ...
const { control } = useFormContext();
```

**Conclusion:** Wrapping field primitives inside `<FormProvider {...methods}>` with StepFieldEditor's own `useForm()` instance is the complete and correct isolation approach. No prop-threading needed. No useProtoStore coupling in field components. [VERIFIED: source inspection]

### ResponseMode Sections Pattern (mirroring PublishBar RadioGroup)

```typescript
// Source: PublishBar.tsx (RadioGroup pattern — adapt for response modes)
// PublishBar uses styled label + sr-only RadioGroupItem.
// StepFieldEditor response mode section mirrors this pattern.
<RadioGroup
  value={responseMode.mode}
  onValueChange={(v) => handleResponseModeChange(v)}
  className="flex gap-1"
>
  {["no-wait", "correlation-id", "first-arrival"].map(mode => (
    <div key={mode} className="flex items-center">
      <RadioGroupItem value={mode} id={`mode-${mode}`} className="sr-only" />
      <label htmlFor={`mode-${mode}`} className={modeClass(mode === responseMode.mode)}>
        {modeLabelMap[mode]}
      </label>
    </div>
  ))}
</RadioGroup>
```

---

## Store Action Surface (Complete Map)

CONTEXT.md names `updateStep` and `reorderSteps`. Phase 21 requires all five:

| Action | Signature | Covers Requirement |
|--------|-----------|-------------------|
| `addStep` | `(planId: string, step: PlanStep) => Promise<void>` | STEP-01, STEP-02, STEP-03 |
| `updateStep` | `(planId: string, stepId: string, partial: Partial<PlanStep>) => Promise<void>` | STEP-01 (auto-save), STEP-06 (rename) |
| `deleteStep` | `(planId: string, stepId: string) => Promise<void>` | STEP-06 |
| `duplicateStep` | `(planId: string, stepId: string) => Promise<PlanStep \| null>` | STEP-04 |
| `reorderSteps` | `(planId: string, fromIndex: number, toIndex: number) => Promise<void>` | STEP-05 |

All five follow the optimistic-write + rollback pattern from Phase 19. [VERIFIED: usePlanStore.ts shows the exact pattern for `renamePlan`, `deletePlan`, `duplicatePlan`]

**`duplicateStep` name convention:** UI-SPEC copywriting table specifies `"{original name} (copy)"` [VERIFIED: 21-UI-SPEC.md]. Phase 19 plan duplication uses `"Copy of ${original.name}"` — step duplication uses the *opposite* pattern. Do not copy the plan pattern.

---

## Schema Resolution States for StepFieldEditor

The editor must gracefully handle all four states:

| State | Condition | Editor Shows |
|-------|-----------|-------------|
| No proto selected | `step.proto_path === ""` | "Select a .proto file above to get started." (helper text in Fields section) |
| Proto not open | `proto_path` set but not found in `useProtoStore.openFiles` | "Open [filename.proto] in the file picker, then retry." + file picker shows current path |
| Message type missing | File open but `step.message_type` not in schema | "Select a message type above." (helper text) |
| Fully resolved | File open + message type found | Render field primitives normally |

The same resolution logic applies to the history-import fallback (D-10): scan `openFiles` for a matching `messageTypeName` when `entry.protoPath` is undefined.

---

## Data Flow for Step Creation (Three Paths)

### Blank Step

```
"+" → "Blank step" clicked
→ create new PlanStep:
    id: crypto.randomUUID()
    name: "Untitled Step"
    proto_path: ""
    message_type: ""
    field_values: "{}"
    target: { kind: 'queue', queue: '' }
    response_mode: { mode: 'no-wait', delay_ms: 200 }
→ addStep(planId, newStep)
→ setSelectedStepId(newStep.id)
→ StepFieldEditor shows "no proto" empty state in Fields section
```

### From History

```
"+" → "From history" clicked → StepHistoryPicker Sheet opens
→ User clicks entry:
    resolve protoPath: entry.protoPath ?? autoMatchFromOpenFiles(entry.messageTypeName)
    if no match: toast.error("Open the .proto file for [messageTypeName] first, then retry.")
    else:
    → create new PlanStep:
        id: crypto.randomUUID()
        name: entry.messageTypeName  (or truncated — Claude's discretion)
        proto_path: resolvedProtoPath
        message_type: entry.messageTypeName
        field_values: JSON.stringify(entry.fieldValues)
        target: reconstructed from entry.exchange + entry.routingKey
        response_mode: { mode: 'no-wait', delay_ms: 200 }
→ addStep(planId, newStep) → close Sheet → setSelectedStepId(newStep.id)
```

### From Block Library

```
"+" → "From block library" clicked → StepBlockPicker Sheet opens
→ User clicks block:
    → create new PlanStep:
        id: crypto.randomUUID()
        name: block.name
        proto_path: ""         (user sets manually — D-12)
        message_type: ""       (user sets manually — D-12)
        field_values: block.content
        target: { kind: 'queue', queue: '' }
        response_mode: { mode: 'no-wait', delay_ms: 200 }
→ addStep(planId, newStep) → close Sheet → setSelectedStepId(newStep.id)
```

---

## PublishBar.appendEntry Update

`D-10` requires adding `protoPath` to `HistoryEntry`. The update in `PublishBar.tsx` is minimal:

```typescript
// In handleSend, after resolving latestValues:
const { latestValues, selectedMessageType, activeFilePath } = useProtoStore.getState();

// In appendEntry call:
void useHistoryStore.getState().appendEntry({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  messageTypeName: selectedMessageType ?? "unknown",
  exchange,
  routingKey: targetRoutingKey,
  protoPath: activeFilePath ?? undefined,  // NEW — undefined for entries before this phase
  status: "sent",
  fieldValues: latestValues ?? {},
  payloadBytes: payload,
});
```

`activeFilePath` is already on `useProtoStore` [VERIFIED: useProtoStore.ts line 18]. No new store fields needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@dnd-kit/sortable` v6.x (SortableContext required) | `@dnd-kit/sortable` v10.x (same API — SortableContext still exported) | v10.0.0 released 2024 | No breaking change for our use case; legacy API preserved |
| `@dnd-kit/react` package (new) | Separate package — not this project | 2024+ | Irrelevant to this phase; do not conflate with `@dnd-kit/sortable` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `duplicateStep` should create name `"{original} (copy)"` matching UI-SPEC copywriting | Store Action Surface | Naming inconsistency only — easily fixed post-plan |
| A2 | `PointerSensor activationConstraint: { distance: 4 }` is the correct value per UI-SPEC | Pattern 3 / Pitfall 6 | Slightly affects drag UX; easily tunable |
| A3 | History import: name of new step derived from `entry.messageTypeName` | Data Flow: From History | Low impact — step name is immediately renameable |

All other claims are VERIFIED against source code or npm registry.

---

## Open Questions

1. **Target reconstruction from HistoryEntry**
   - What we know: `HistoryEntry` has `exchange: string` and `routingKey: string`. When `exchange === ""`, it was a queue-mode send (PUBL-01: queue name is routingKey, exchange is empty string).
   - What's unclear: Should the importer reconstruct as `{ kind: 'queue', queue: entry.routingKey }` when `entry.exchange === ""`?
   - Recommendation: Yes — this matches `buildPublishArgs` inverse logic in PublishBar. Document in the plan.

2. **Step name for history import**
   - What we know: UI-SPEC copywriting doesn't specify the auto-generated step name for history imports.
   - What's unclear: Use `entry.messageTypeName` (full qualified name) or the short name (after last `.`)?
   - Recommendation: Use short name `entry.messageTypeName.split(".").pop() ?? entry.messageTypeName` — matches how HistoryTable displays type names.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is purely frontend code changes. No new external services, CLI tools, or runtimes required. `@dnd-kit/sortable` is a new npm dependency (installable via npm).

---

## Sources

### Primary (HIGH confidence)
- `src/stores/usePlanStore.ts` — verified optimistic-rollback pattern; confirmed missing `addStep`/`deleteStep`/`duplicateStep`/`updateStep`/`reorderSteps`
- `src/lib/types.ts` — verified `PlanStep`, `PublishTarget`, `ResponseMode`, `StepStatus` type definitions
- `src/components/form/ProtoFormRenderer.tsx` — verified `buildDefaultValues` export; verified `useWatch` auto-save pattern; confirmed no `useProtoStore` coupling
- `src/components/form/fields/ScalarField.tsx` and `EnumField.tsx` — verified `useFormContext()` usage (not explicit `control` prop); confirms `FormProvider` isolation approach works
- `src/components/plans/PlanListPanel.tsx` — verified inline rename pattern, AlertDialog pattern, kebab DropdownMenu pattern
- `src/components/layout/AppLayout.tsx` — verified existing DndContext structure; confirmed plan-scoped DndContext is completely separate
- `src/stores/useProtoStore.ts` — verified `openFiles: OpenFileEntry[]`, `activeFilePath: string | null`; confirmed `activeFilePath` available for `protoPath` capture
- `src/stores/useHistoryStore.ts` — verified `HistoryEntry` interface; confirmed `protoPath` field is absent and needs adding
- `src/components/publish/PublishBar.tsx` — verified `appendEntry` call site; confirmed `activeFilePath` accessible via `useProtoStore.getState()`
- `@dnd-kit/sortable@10.0.0` — npm pack + dist inspection confirmed: `SortableContext`, `useSortable`, `arrayMove`, `verticalListSortingStrategy` all still exported [VERIFIED: npm registry + dist inspection]
- `@dnd-kit/core@6.3.1` — verified installed version (node_modules); `@dnd-kit/sortable@10.0.0` peer requires `^6.3.0` — compatible
- `package.json` — verified `@dnd-kit/core: "^6.3.1"`, `react-hook-form: "^7.76.0"`, `zustand: "^5.0.13"`, no `@dnd-kit/sortable` yet

### Secondary (MEDIUM confidence)
- Context7 `/clauderic/dnd-kit` docs — confirms SortableContext, useSortable API shape; note: migration guide refers to new `@dnd-kit/react` package, not legacy `@dnd-kit/sortable`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry and node_modules
- Store action surface: HIGH — verified by reading usePlanStore.ts (actions missing); pattern verified from Phase 19 implementations
- Architecture patterns: HIGH — derived from reading actual source files
- Form isolation approach: HIGH — field primitives verified to use useFormContext(); FormProvider pattern confirmed from ProtoFormRenderer.tsx
- Pitfalls: HIGH — echo loop and drag listener pitfalls are well-defined failure modes verifiable from source; ported from real component patterns in the codebase

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (stable dependencies; 30-day window)
