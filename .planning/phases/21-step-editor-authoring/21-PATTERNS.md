# Phase 21: Step Editor (Authoring) - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 9 (3 new components, 2 new pickers, 1 modified panel, 3 modified stores/components)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/plans/PlanDetailPanel.tsx` | component (modify) | request-response | `src/components/plans/PlanView.tsx` | role-match |
| `src/components/plans/StepListPanel.tsx` | component (new) | event-driven | `src/components/plans/PlanListPanel.tsx` | exact |
| `src/components/plans/StepFieldEditor.tsx` | component (new) | CRUD + event-driven | `src/components/form/ProtoFormRenderer.tsx` | role-match |
| `src/components/plans/StepHistoryPicker.tsx` | component (new) | request-response | `src/components/publish/AmqpPropertiesSheet.tsx` + `src/components/history/HistoryTable.tsx` | role-match |
| `src/components/plans/StepBlockPicker.tsx` | component (new) | request-response | `src/components/publish/AmqpPropertiesSheet.tsx` + `src/components/blocks/BlockLibraryPanel.tsx` | role-match |
| `src/stores/usePlanStore.ts` | store (modify) | CRUD | itself | exact |
| `src/stores/useHistoryStore.ts` | store (modify) | CRUD | itself | exact |
| `src/components/publish/PublishBar.tsx` | component (modify) | request-response | itself | exact |

---

## Pattern Assignments

### `src/components/plans/PlanDetailPanel.tsx` (component, modify)

**Analog:** `src/components/plans/PlanView.tsx`

**Role:** Replace the two empty-state placeholder renders with a two-pane sub-split. `selectedStepId` is local React state here, mirroring how `PlanView` holds `selectedPlanId`.

**Current placeholder structure** (`src/components/plans/PlanDetailPanel.tsx` lines 1-29):
```tsx
// REPLACE THIS ENTIRE FILE — keep only the prop signature shape
export function PlanDetailPanel({ selectedPlan }: PlanDetailPanelProps) {
  if (!selectedPlan) { /* icon + text empty state */ }
  return ( /* icon + text placeholder for no steps */ );
}
```

**Target structure to copy from** (`src/components/plans/PlanView.tsx` lines 11-33):
```tsx
// PlanView pattern: local state + two-pane flex layout
export function PlanView({ onViewChange }: PlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const plans = usePlanStore((s) => s.plans);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* ... */}
      <div className="flex flex-1 min-w-0">
        <PlanListPanel selectedPlanId={selectedPlanId} onSelectPlan={setSelectedPlanId} />
        <PlanDetailPanel selectedPlan={selectedPlan} />
      </div>
    </div>
  );
}
```

**New `PlanDetailPanel` target shape:**
```tsx
// selectedStepId is LOCAL React state (D-12 pattern from Phase 20)
// DndContext wraps StepListPanel only — separate from AppLayout's DndContext (D-14)
export function PlanDetailPanel({ selectedPlan }: PlanDetailPanelProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  if (!selectedPlan) {
    return ( /* "Select a plan to get started" empty state — keep existing */ );
  }

  const steps = selectedPlan.steps;
  const selectedStep = steps.find(s => s.id === selectedStepId) ?? null;

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <DndContext ...>
        <StepListPanel
          plan={selectedPlan}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          activeDragId={activeDragId}
          onDragStart={...}
          onDragEnd={...}
        />
      </DndContext>
      <StepFieldEditor step={selectedStep} planId={selectedPlan.id} />
    </div>
  );
}
```

**DndContext sensor setup** — copy from `src/components/layout/AppLayout.tsx` lines 22-24, but change `distance: 8` to `distance: 4` per UI-SPEC:
```tsx
// AppLayout (analog) uses distance: 8 — StepListPanel uses 4 per UI-SPEC D-14/Pitfall 6
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } })  // NOTE: 4, not 8
);
```

**DragOverlay pattern** — copy from `src/components/layout/AppLayout.tsx` lines 59-66:
```tsx
<DragOverlay dropAnimation={null}>
  {activeDragStep ? (
    <div className="bg-background border border-border shadow-md rounded px-3 py-2 text-sm">
      {activeDragStep.name}
    </div>
  ) : null}
</DragOverlay>
```

---

### `src/components/plans/StepListPanel.tsx` (component, new)

**Analog:** `src/components/plans/PlanListPanel.tsx`

**Imports pattern** (`src/components/plans/PlanListPanel.tsx` lines 1-23):
```tsx
import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { usePlanStore } from "@/stores/usePlanStore";
import type { Plan } from "@/lib/types";
```

Add for sortable drag-and-drop:
```tsx
import { GripVertical } from "lucide-react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

**Header + "+" button pattern** (`src/components/plans/PlanListPanel.tsx` lines 148-159):
```tsx
// PlanListPanel header — copy this pattern for StepListPanel header
// Use w-60 (240px) instead of w-72 (288px) per D-01/UI-SPEC
<div className="w-60 border-r border-border flex flex-col shrink-0 bg-background">
  <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
    <h2 className="text-sm font-semibold">Steps</h2>
    {/* "+" opens DropdownMenu with 3 items (D-03) — not a plain button */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1" disabled={!plansLoaded}>
          <Plus size={14} />Add step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={handleAddBlank}>Blank step</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setHistoryPickerOpen(true)}>From history</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setBlockPickerOpen(true)}>From block library</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
```

**ScrollArea + row rendering pattern** (`src/components/plans/PlanListPanel.tsx` lines 161-205):
```tsx
<ScrollArea className="flex-1 min-h-0">
  {steps.length === 0 && (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm text-muted-foreground font-medium">No steps yet</p>
      <p className="text-xs text-muted-foreground">
        Use the + button to add your first step.
      </p>
    </div>
  )}
  <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
    {steps.map((step) => (
      renamingId === step.id
        ? <InlineEditRow key={step.id} ... />   // same InlineEditRow pattern
        : <SortableStepRow key={step.id} ... />
    ))}
  </SortableContext>
</ScrollArea>
```

**Step row layout** — fuse `PlanRow` (PlanListPanel lines 39-76) with `DraggableBlockRow` (BlockLibraryPanel lines 31-67). Key difference: attach `useSortable` listeners to GripVertical ONLY (not the full row — RESEARCH Pitfall 5):
```tsx
function SortableStepRow({ step, isSelected, onSelect, onStartRename, onDuplicate, onDelete }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: step.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center py-2 px-3 cursor-pointer",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
        isDragging && "opacity-50"
      )}
      onClick={onSelect}
    >
      {/* Listeners on grip handle ONLY — not the whole row (RESEARCH Pitfall 5) */}
      <div {...attributes} {...listeners} className="cursor-grab mr-1">
        <GripVertical size={14} className="text-muted-foreground" />
      </div>
      <span className="text-sm truncate flex-1">{step.name}</span>
      {/* Kebab — same pattern as PlanListPanel lines 50-73 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
            <MoreVertical size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => onStartRename()}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate()}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDelete(); }}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

**InlineEditRow** — copy verbatim from `src/components/plans/PlanListPanel.tsx` lines 85-134. The `cancellingRef` guard on Escape (line 87, lines 100-104) is load-bearing — do not omit:
```tsx
// COPY VERBATIM — all three behaviors are required:
// 1. autoFocus (line 125)
// 2. useEffect → inputRef.current?.select() (lines 91-93) — selects all text on mount
// 3. cancellingRef.current = true set BEFORE blur() on Escape (lines 100-103)
function InlineEditRow({ initialValue, isSelected, onCommit, onCancel }: InlineEditRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);
  // ... (see PlanListPanel.tsx lines 85-134 for full implementation)
}
```

**AlertDialog pattern** — copy from `src/components/plans/PlanListPanel.tsx` lines 207-233. Rendered at component root, NOT inside ScrollArea (RESEARCH Pitfall 8). After delete, if deleted step was selected, clear `selectedStepId` to `null`:
```tsx
// At StepListPanel component root — outside ScrollArea (Pitfall 8)
<AlertDialog
  open={!!stepToDelete}
  onOpenChange={(open) => { if (!open) setStepToDelete(null); }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete &quot;{stepToDelete?.name}&quot;?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep step</AlertDialogCancel>
      <AlertDialogAction
        variant="destructive"
        onClick={() => {
          if (stepToDelete) {
            const id = stepToDelete.id;
            const wasSelected = selectedStepId === id;
            deleteStep(planId, id).catch(console.error);
            if (wasSelected) onSelectStep(null);  // mirror PlanListPanel line 225
          }
        }}
      >
        Delete step
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### `src/components/plans/StepFieldEditor.tsx` (component, new)

**Analog:** `src/components/form/ProtoFormRenderer.tsx`

**Critical constraint:** Do NOT import or re-render `ProtoFormRenderer` itself (D-06). Reuse only `buildDefaultValues` from it.

**Imports pattern** (`src/components/form/ProtoFormRenderer.tsx` lines 1-12):
```tsx
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useEffect, useRef } from "react";
import { buildDefaultValues } from "@/components/form/ProtoFormRenderer";  // reuse export
import { ScalarField } from "@/components/form/fields/ScalarField";
import { NestedMessageField } from "@/components/form/fields/NestedMessageField";
import { RepeatedField } from "@/components/form/fields/RepeatedField";
import { EnumField } from "@/components/form/fields/EnumField";
import { OneofField } from "@/components/form/fields/OneofField";
import { WellKnownTypeField } from "@/components/form/fields/WellKnownTypeField";
import { BytesField } from "@/components/form/fields/BytesField";
import { MapField } from "@/components/form/fields/MapField";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { usePlanStore } from "@/stores/usePlanStore";
import { useProtoStore } from "@/stores/useProtoStore";
import type { PlanStep, MessageSchema } from "@/lib/types";
```

**`buildDefaultValues` export** (`src/components/form/ProtoFormRenderer.tsx` lines 45-99):
```tsx
// This function is already exported — import it directly, do not duplicate
export function buildDefaultValues(message: MessageSchema): Record<string, unknown> {
  // ... handles scalar, enum, oneof, message, well_known, map, repeated
}
```

**`safeParseFieldValues` helper** (new, to add in StepFieldEditor):
```tsx
// Never call JSON.parse directly on step.field_values (RESEARCH Pitfall 3)
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

**Isolated `useForm` + reset on stepId change** (RESEARCH Pattern 1, avoids echo loop — RESEARCH Pitfall 1):
```tsx
// ProtoFormRenderer analog (lines 112-127) adapted for step isolation
const methods = useForm({
  defaultValues: safeParseFieldValues(step.field_values, schema),
});

// Reset ONLY when step.id changes — never on step.field_values change (Pitfall 1)
const prevStepIdRef = useRef(step.id);
useEffect(() => {
  if (prevStepIdRef.current !== step.id) {
    prevStepIdRef.current = step.id;
    methods.reset(safeParseFieldValues(step.field_values, schema));
  }
}, [step.id]);  // Deliberately omit step.field_values from deps
```

**Auto-save debounce pattern** (adapted from ProtoFormRenderer lines 117-121, with stale-step guard — RESEARCH Pitfall 2):
```tsx
// ProtoFormRenderer uses: useEffect(() => { onValuesChange(watchedValues); }, [...])
// StepFieldEditor adds debounce + stale-step guard on top:
const watchedValues = useWatch({ control: methods.control });
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const currentStepIdRef = useRef(step.id);
currentStepIdRef.current = step.id;

useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  const capturedStepId = step.id;
  debounceRef.current = setTimeout(() => {
    if (currentStepIdRef.current === capturedStepId) {  // stale-step guard (Pitfall 2)
      const json = JSON.stringify(watchedValues);
      updateStep(planId, capturedStepId, { field_values: json })
        .catch(() => toast.error("Failed to save step. Changes may be lost."));
    }
  }, 300);
  return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
}, [watchedValues]);
```

**FormProvider wrap** (copy from `src/components/form/ProtoFormRenderer.tsx` lines 258-280):
```tsx
// All field primitives call useFormContext() — FormProvider is mandatory (RESEARCH §Field Primitives)
return (
  <FormProvider {...methods}>
    <form onSubmit={(e) => e.preventDefault()}>
      {/* Sections rendered here */}
    </form>
  </FormProvider>
);
```

**Section layout pattern** (from UI-SPEC Layout Contract):
```tsx
// Each section uses this pattern — NOT Tabs (D-08 explicit prohibition)
<div className="px-4 py-3 border-b border-border">
  <h3 className="text-sm font-semibold mb-3">{title}</h3>
  {/* section content */}
</div>
```

**Proto file resolution** (RESEARCH Pattern 5):
```tsx
// Read from useProtoStore.openFiles — never trigger file loading from StepFieldEditor
const openFiles = useProtoStore(s => s.openFiles);
const matchedFile = openFiles.find(f => f.filePath === step.proto_path);
const schema = matchedFile?.schema ?? null;
const message = schema?.message_map[step.message_type] ?? null;
// Four states: no proto_path / proto not open / message type missing / fully resolved
```

**Target section RadioGroup** — copy from `src/components/publish/PublishBar.tsx` lines 300-341. Use local component state (not react-hook-form `watch`) to call `updateStep(planId, stepId, { target: ... })` directly on change:
```tsx
// PublishBar RadioGroup pattern (lines 300-341) — adapt for target section
<RadioGroup value={targetKind} onValueChange={(v) => handleTargetKindChange(v as "queue"|"exchange")} className="flex gap-1">
  <div className="flex items-center">
    <RadioGroupItem value="queue" id={`target-queue-${step.id}`} className="sr-only" />
    <label htmlFor={`target-queue-${step.id}`} className={`cursor-pointer rounded border px-3 py-1 text-sm font-semibold transition-colors ${
      targetKind === "queue"
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background text-foreground border-input hover:bg-muted"
    }`}>Queue</label>
  </div>
  <div className="flex items-center">
    <RadioGroupItem value="exchange" id={`target-exchange-${step.id}`} className="sr-only" />
    <label htmlFor={`target-exchange-${step.id}`} className={/* same conditional */}>Exchange</label>
  </div>
</RadioGroup>
```

**Field dispatch** — copy renderField dispatch from `src/components/form/ProtoFormRenderer.tsx` lines 183-277 (the switch block). Includes the RepeatedField pre-dispatch check (lines 261-275) and the bytes/map early-return guards (lines 196-212).

---

### `src/components/plans/StepHistoryPicker.tsx` (component, new)

**Analog:** `src/components/publish/AmqpPropertiesSheet.tsx` (Sheet shell) + `src/components/history/HistoryTable.tsx` (row content)

**Sheet shell pattern** (`src/components/publish/AmqpPropertiesSheet.tsx` lines 92-100):
```tsx
// AmqpPropertiesSheet is the established Sheet pattern in this app
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="w-80">
    <SheetHeader>
      <SheetTitle>Import from history</SheetTitle>
      <SheetDescription>Select an entry to pre-fill the new step.</SheetDescription>
    </SheetHeader>
    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto py-4">
      {/* Scrollable list of HistoryEntry rows */}
    </div>
  </SheetContent>
</Sheet>
```

**Row content pattern** (`src/components/history/HistoryTable.tsx` lines 61-119):
```tsx
// Mirror HistoryTable row layout — simplified for picker (no resend button, no hex view)
{entries.map((entry) => (
  <div
    key={entry.id}
    className="cursor-pointer hover:bg-muted/50 px-4 py-2 flex flex-col gap-0.5"
    onClick={() => handleSelectEntry(entry)}
  >
    <span className="text-xs font-mono text-muted-foreground">
      {entry.timestamp.slice(11, 19)}
    </span>
    <span className="text-sm truncate" title={entry.messageTypeName}>
      {entry.messageTypeName.split(".").pop() ?? entry.messageTypeName}
    </span>
    <span className="text-xs text-muted-foreground truncate">
      {entry.exchange ? `${entry.exchange} → ${entry.routingKey}` : entry.routingKey}
    </span>
  </div>
))}
```

**Empty state pattern** (`src/components/history/HistoryTable.tsx` lines 38-46):
```tsx
// Adapted empty state for picker context
if (entries.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs p-4 text-center">
      No history yet. Send a message first.
    </div>
  );
}
```

**Proto path resolution on selection** (D-10 fallback, RESEARCH Pitfall 7):
```tsx
function handleSelectEntry(entry: HistoryEntry) {
  // D-10: protoPath is optional — fall back to auto-match by messageTypeName
  const resolvedPath = entry.protoPath
    ?? openFiles.find(f => f.schema?.message_map[entry.messageTypeName])?.filePath
    ?? null;

  if (!resolvedPath) {
    toast.error(`Open the .proto file for ${entry.messageTypeName} first, then retry.`);
    return;
  }
  // construct step, call addStep, close sheet
}
```

---

### `src/components/plans/StepBlockPicker.tsx` (component, new)

**Analog:** `src/components/publish/AmqpPropertiesSheet.tsx` (Sheet shell) + `src/components/blocks/BlockLibraryPanel.tsx` (list rows)

**Sheet shell** — same pattern as `StepHistoryPicker.tsx` above (`AmqpPropertiesSheet.tsx` lines 92-100).

**Block list rows pattern** (`src/components/blocks/BlockLibraryPanel.tsx` lines 236-244):
```tsx
// BlockLibraryPanel list section — simplified for picker (no edit/delete actions)
{blocks.map((block) => (
  <div
    key={block.id}
    className="px-4 py-2 hover:bg-muted/50 cursor-pointer flex flex-col gap-0.5"
    onClick={() => handleSelectBlock(block)}
  >
    <span className="text-sm truncate">{block.name}</span>
  </div>
))}
```

**Empty state**:
```tsx
if (blocks.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs p-4 text-center">
      No blocks saved yet.
    </div>
  );
}
```

**Block import step construction** (D-12 — proto path/message type left blank):
```tsx
function handleSelectBlock(block: Block) {
  const newStep: PlanStep = {
    id: crypto.randomUUID(),
    name: block.name,
    proto_path: "",      // user sets manually after import (D-12)
    message_type: "",    // user sets manually after import (D-12)
    field_values: block.content,
    target: { kind: 'queue', queue: '' },
    response_mode: { mode: 'no-wait', delay_ms: 200 },
  };
  addStep(planId, newStep).catch(console.error);
  onSelectStep(newStep.id);
  onOpenChange(false);
}
```

---

### `src/stores/usePlanStore.ts` (store, modify — add 5 actions)

**Analog:** itself (all five new actions follow the exact optimistic-rollback pattern of existing actions)

**Canonical optimistic-rollback template** (`src/stores/usePlanStore.ts` lines 97-112):
```tsx
// ALL five new actions (addStep, updateStep, deleteStep, duplicateStep, reorderSteps)
// follow this exact shape from renamePlan — do not deviate:
renamePlan: async (id: string, name: string): Promise<void> => {
  if (!get().plansLoaded) return;          // (1) guard: not loaded yet
  let previous: Plan[] = [];
  let updated: Plan[] = [];
  set((state) => {                         // (2) optimistic write
    previous = state.plans;
    updated = state.plans.map((p) => (p.id === id ? { ...p, name } : p));
    return { plans: updated };
  });
  try {
    await persistPlans(updated);           // (3) persist
  } catch (err) {
    set({ plans: previous });             // (4) rollback on failure
    throw err;                             // (5) re-throw for caller's .catch()
  }
},
```

**`addStep` shape:**
```tsx
addStep: async (planId: string, step: PlanStep): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [], updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) =>
      p.id === planId ? { ...p, steps: [...p.steps, step] } : p
    );
    return { plans: updated };
  });
  try { await persistPlans(updated); }
  catch (err) { set({ plans: previous }); throw err; }
},
```

**`updateStep` shape** (partial merge — used for auto-save, rename):
```tsx
updateStep: async (planId: string, stepId: string, partial: Partial<PlanStep>): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [], updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) =>
      p.id === planId
        ? { ...p, steps: p.steps.map((s) => s.id === stepId ? { ...s, ...partial } : s) }
        : p
    );
    return { plans: updated };
  });
  try { await persistPlans(updated); }
  catch (err) { set({ plans: previous }); throw err; }
},
```

**`deleteStep` shape:**
```tsx
deleteStep: async (planId: string, stepId: string): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [], updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) =>
      p.id === planId ? { ...p, steps: p.steps.filter((s) => s.id !== stepId) } : p
    );
    return { plans: updated };
  });
  try { await persistPlans(updated); }
  catch (err) { set({ plans: previous }); throw err; }
},
```

**`duplicateStep` shape** — CRITICAL: step duplication uses `"${name} (copy)"` NOT `"Copy of ${name}"`. The plan duplication convention (`src/stores/usePlanStore.ts` line 141: `` `Copy of ${original.name}` ``) is intentionally different. UI-SPEC Copywriting Contract specifies `"{original name} (copy)"` for steps:
```tsx
duplicateStep: async (planId: string, stepId: string): Promise<PlanStep | null> => {
  if (!get().plansLoaded) return null;
  const plan = get().plans.find((p) => p.id === planId);
  const original = plan?.steps.find((s) => s.id === stepId);
  if (!original) return null;
  const duplicate: PlanStep = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (copy)`,   // UI-SPEC copywriting — NOT "Copy of ${name}"
  };
  let previous: Plan[] = [], updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) =>
      p.id === planId ? { ...p, steps: [...p.steps, duplicate] } : p
    );
    return { plans: updated };
  });
  try { await persistPlans(updated); return duplicate; }
  catch (err) { set({ plans: previous }); throw err; }
},
```

**`reorderSteps` shape:**
```tsx
reorderSteps: async (planId: string, fromIndex: number, toIndex: number): Promise<void> => {
  if (!get().plansLoaded) return;
  let previous: Plan[] = [], updated: Plan[] = [];
  set((state) => {
    previous = state.plans;
    updated = state.plans.map((p) => {
      if (p.id !== planId) return p;
      const steps = [...p.steps];
      const [moved] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, moved);
      return { ...p, steps };
    });
    return { plans: updated };
  });
  try { await persistPlans(updated); }
  catch (err) { set({ plans: previous }); throw err; }
},
```

**Interface additions** — append to `PlanStore` interface (`src/stores/usePlanStore.ts` lines 9-20):
```tsx
// Add these to the PlanStore interface:
addStep: (planId: string, step: PlanStep) => Promise<void>;
updateStep: (planId: string, stepId: string, partial: Partial<PlanStep>) => Promise<void>;
deleteStep: (planId: string, stepId: string) => Promise<void>;
duplicateStep: (planId: string, stepId: string) => Promise<PlanStep | null>;
reorderSteps: (planId: string, fromIndex: number, toIndex: number) => Promise<void>;
```

---

### `src/stores/useHistoryStore.ts` (store, modify)

**Analog:** itself

**Minimal change:** Add `protoPath?: string` to `HistoryEntry` interface (`src/stores/useHistoryStore.ts` lines 8-18). All other store code is unchanged.

```tsx
// BEFORE (line 8-18):
export interface HistoryEntry {
  id: string;
  timestamp: string;
  messageTypeName: string;
  exchange: string;
  routingKey: string;
  status: "sent" | "failed";
  errorMessage?: string;
  fieldValues: Record<string, unknown>;
  payloadBytes: number[];
}

// AFTER — add protoPath only:
export interface HistoryEntry {
  id: string;
  timestamp: string;
  messageTypeName: string;
  exchange: string;
  routingKey: string;
  protoPath?: string;              // NEW — D-10; undefined for entries before Phase 21
  status: "sent" | "failed";
  errorMessage?: string;
  fieldValues: Record<string, unknown>;
  payloadBytes: number[];
}
```

---

### `src/components/publish/PublishBar.tsx` (component, modify)

**Analog:** itself

**Minimal change:** Add `protoPath` to both `appendEntry` call sites.

`activeFilePath` is already on `useProtoStore` — no new store fields needed. Capture it alongside `latestValues` on line 226 (before the await):

```tsx
// BEFORE (lines 225-271 — two appendEntry calls, success and fail):
const { latestValues, selectedMessageType } = useProtoStore.getState();
// ...
void useHistoryStore.getState().appendEntry({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  messageTypeName: selectedMessageType ?? "unknown",
  exchange,
  routingKey: targetRoutingKey,
  status: "sent",
  fieldValues: latestValues ?? {},
  payloadBytes: payload,
});

// AFTER — add protoPath capture and field to both call sites:
const { latestValues, selectedMessageType, activeFilePath } = useProtoStore.getState();
// ...
void useHistoryStore.getState().appendEntry({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  messageTypeName: selectedMessageType ?? "unknown",
  exchange,
  routingKey: targetRoutingKey,
  protoPath: activeFilePath ?? undefined,   // NEW — D-10
  status: "sent",
  fieldValues: latestValues ?? {},
  payloadBytes: payload,
});
```

Apply the same `protoPath` addition to the failed-send `appendEntry` call site (lines 281-291).

---

## Shared Patterns

### Optimistic Write + Rollback
**Source:** `src/stores/usePlanStore.ts` `renamePlan` action, lines 97-112
**Apply to:** All five new `usePlanStore` step actions (`addStep`, `updateStep`, `deleteStep`, `duplicateStep`, `reorderSteps`)

Pattern shape: `plansLoaded` guard → capture `previous` → optimistic `set()` → `persistPlans()` → catch → `set({ plans: previous })` → re-throw.

### Inline Rename (InlineEditRow)
**Source:** `src/components/plans/PlanListPanel.tsx` lines 85-134
**Apply to:** `StepListPanel.tsx` step rows (exact copy, rename `aria-label` to "Step name")

Critical load-bearing details:
- `cancellingRef.current = true` set BEFORE `blur()` fires on Escape (line 101-103)
- `useEffect(() => { inputRef.current?.select(); }, [])` selects all text on mount (lines 91-93)

### AlertDialog at Component Root
**Source:** `src/components/plans/PlanListPanel.tsx` lines 207-233
**Apply to:** `StepListPanel.tsx`

Rules:
- `AlertDialog` always at component root, NOT inside `ScrollArea` or `DropdownMenuContent`
- DropdownMenuItem "Delete" calls `e.preventDefault()` before setting `stepToDelete` state (PlanListPanel line 66)
- After delete, if deleted item was selected → clear selection to `null` (PlanListPanel line 225)

### Sheet Picker Pattern
**Source:** `src/components/publish/AmqpPropertiesSheet.tsx` lines 92-100, 271-279
**Apply to:** `StepHistoryPicker.tsx` and `StepBlockPicker.tsx`

Open/close controlled via `open: boolean` + `onOpenChange: (open: boolean) => void` props. `SheetContent side="right"`.

### RadioGroup Toggle (queue/exchange, response mode)
**Source:** `src/components/publish/PublishBar.tsx` lines 300-341
**Apply to:** `StepFieldEditor.tsx` Target section and Response mode section

Pattern: `RadioGroupItem` with `className="sr-only"` + sibling `<label>` with conditional border/background classes. IDs must be scoped to step (e.g., `id={`target-queue-${step.id}`}`) to avoid conflicts when multiple editors exist in the tree.

### DndContext Setup
**Source:** `src/components/layout/AppLayout.tsx` lines 22-67
**Apply to:** `PlanDetailPanel.tsx` (plan-scoped DndContext wrapping StepListPanel only)

Divergence from AppLayout: use `activationConstraint: { distance: 4 }` (UI-SPEC) instead of AppLayout's `{ distance: 8 }`. Both are valid; step list uses 4 per UI-SPEC explicit specification.

---

## No Analog Found

All files have analogs in the codebase. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/plans/`, `src/components/publish/`, `src/components/history/`, `src/components/blocks/`, `src/components/form/`, `src/components/layout/`, `src/stores/`
**Files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-05-23
