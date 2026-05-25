# Phase 21: Step Editor (Authoring) - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `PlanDetailPanel` empty-state placeholder (Phase 20) with a fully functional step editor. The panel becomes a sub-split: a fixed-width step list on the left (scrollable, drag-reorderable rows, kebab CRUD, "+" add/import menu) and a `StepFieldEditor` on the right (proto selector + field form + target + response mode). Users can add blank steps, import from message history, import from block library, rename/duplicate/delete steps, and reorder via drag-and-drop. All step mutations auto-save to `usePlanStore`. No execution, no run status — authoring only.

</domain>

<decisions>
## Implementation Decisions

### Step List + Editor Layout
- **D-01:** `PlanDetailPanel` becomes a two-pane sub-split: step list (fixed-width, left) and `StepFieldEditor` (flex-1, right). Step list width: **~240px** (matches Phase 20's plan list proportions). No resize handle — consistent with existing fixed-width panes in the app.
- **D-02:** Each step row contains: `GripVertical` drag handle + step name (truncated) + kebab (⋮) menu. Kebab actions: **Rename / Duplicate / Delete**. Rename uses inline input (same pattern as Phase 20 plan rename). Delete triggers an `AlertDialog` confirmation (same pattern as Phase 20 plan delete).
- **D-03:** Step list has a **single "+" button** (at the bottom or header of the step list column). Clicking it opens a shadcn `DropdownMenu` with three options: **Blank step** / **From history** / **From block library**. This consolidates all add/import entry points.
- **D-04:** Clicking a step row selects it and loads its form in the right pane. Selected step highlighted with background tint (same approach as plan list selection in Phase 20).
- **D-05:** When no steps exist, the right pane shows "No steps yet — use the + button to add your first step." When steps exist but none is selected, right pane shows "Select a step to edit it."

### StepFieldEditor Composition
- **D-06:** `StepFieldEditor` is a new component that renders the step's proto fields using the **existing field primitives** (`ScalarField`, `EnumField`, `NestedMessageField`, `OneofField`, `RepeatedField`, `BytesField`, `MapField`, `WellKnownTypeField`) directly — **not** via `ProtoFormRenderer`. `ProtoFormRenderer` is NOT reused. Reason: `ProtoFormRenderer` is tightly coupled to `useProtoStore.latestValues`; step editing needs isolated form state that writes to `PlanStep.field_values`.
- **D-07:** `StepFieldEditor` uses `react-hook-form` (`useForm`) with its own form instance, initialized from `JSON.parse(step.field_values)`. Form state is NOT shared with `useProtoStore`. `buildDefaultValues` (already exported from `ProtoFormRenderer`) is reused to generate defaults for new/blank steps.
- **D-08:** Layout within `StepFieldEditor`: **scrollable sections with visual dividers/headers** (no tabs). Section order:
  1. **Proto file + message type** — file picker (reuse open files list from `useProtoStore`) + message type select
  2. **Fields** — field primitives rendered from the selected message schema
  3. **Target** — queue vs exchange radio + queue/exchange input + routing key input (mirrors PublishBar patterns)
  4. **Response mode** — no-wait / correlation-id / first-arrival radio + per-mode config inputs (delay_ms, reply_queue, timeout_ms)
- **D-09:** Auto-save on every change. Form `watch` (debounced ~300ms) serializes field values to JSON string and calls a new `usePlanStore.updateStep(planId, stepId, partial)` action. `updateStep` follows the same optimistic-write + rollback pattern as other store mutations. No explicit "Save" button.

### History Import — Proto Path
- **D-10:** Add `protoPath: string` to `HistoryEntry`. Update `PublishBar`'s `appendEntry` calls to include the active file's path from `useProtoStore`. Old entries without `protoPath` (undefined) fall back to auto-match: scan `useProtoStore.openFiles` for a file whose schema contains a message type matching `entry.messageTypeName`. If no match, show error toast: "Open the .proto file for [messageTypeName] first, then retry."
- **D-11:** The "From history" picker is a **Sheet or Dialog** (shadcn) listing recent `HistoryEntry` items (newest first, same layout as `HistoryTable`). Selecting an entry creates a new `PlanStep` pre-filled with: `proto_path` from entry, `message_type` from `entry.messageTypeName`, `field_values` from `JSON.stringify(entry.fieldValues)`, `target` reconstructed from `entry.exchange` + `entry.routingKey`, `response_mode` defaulting to `{ mode: 'no-wait', delay_ms: 200 }`.
- **D-12:** The "From block library" picker is a similar Sheet/Dialog listing saved blocks from `useBlockStore`. Selecting a block creates a new step pre-filled with `field_values` from `block.content`. Proto file and message type must be set manually after import (block doesn't store proto path — this is acceptable for v1).

### Drag-and-Drop Step Reorder
- **D-13:** Install `@dnd-kit/sortable` as a new dependency. Use `SortableContext` + `useSortable` for step rows. `arrayMove` from `@dnd-kit/sortable` handles the reorder.
- **D-14:** A **plan-scoped `DndContext`** wraps the step list inside `PlanDetailPanel` — completely separate from the `AppLayout` `DndContext` (which handles block drag-and-drop). No nesting conflict; `PlanView` replaces `AppLayout` as the rendered root when `viewMode === "plans"`.
- **D-15:** On `dragEnd`: call a new `usePlanStore.reorderSteps(planId, fromIndex, toIndex)` action. Persist immediately (same auto-save pattern). `DragOverlay` shows the dragged step name (consistent with `AppLayout`'s block `DragOverlay`).

### Claude's Discretion
- Step list column width: **~240px** fixed (consistent with Phase 20 plan list proportions).
- StepFieldEditor section layout: scrollable with dividers + section headers (no tabs) — dev tool users benefit from seeing all fields at once without tab switching.
- "+" button placement: footer of step list column (bottom, after the step rows), above any scrollarea constraint.
- Response mode defaults when creating a blank step: `{ mode: 'no-wait', delay_ms: 200 }`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §Plan Steps (STEP-01 through STEP-06) — All 6 requirements in scope for Phase 21
- `.planning/ROADMAP.md` §Phase 21 — Goal, success criteria, dependency notes

### Foundation phases (MUST read — Phase 21 builds directly on these)
- `.planning/phases/19-plan-data-model-and-persistence/19-CONTEXT.md` — All type definitions (`Plan`, `PlanStep`, `StepStatus`, `ResponseMode`, `PublishTarget`), `usePlanStore` API, persistence pattern decisions. D-01/D-02/D-12 from Phase 19 are load-bearing for StepFieldEditor.
- `.planning/phases/20-plan-view-shell-and-navigation/20-CONTEXT.md` — `PlanDetailPanel` placeholder that Phase 21 fills in; plan list and inline-rename/delete patterns Phase 21 replicates for steps.
- `src/stores/usePlanStore.ts` — CRUD store; Phase 21 adds `updateStep` and `reorderSteps` actions.
- `src/lib/types.ts` — `PlanStep`, `PublishTarget`, `ResponseMode`, `StepStatus` type definitions.

### Field primitives (StepFieldEditor reuses these directly — NOT ProtoFormRenderer)
- `src/components/form/fields/ScalarField.tsx`
- `src/components/form/fields/EnumField.tsx`
- `src/components/form/fields/NestedMessageField.tsx`
- `src/components/form/fields/OneofField.tsx`
- `src/components/form/fields/RepeatedField.tsx`
- `src/components/form/fields/BytesField.tsx`
- `src/components/form/fields/MapField.tsx`
- `src/components/form/fields/WellKnownTypeField.tsx`
- `src/components/form/ProtoFormRenderer.tsx` — Read for `buildDefaultValues` export (reused by StepFieldEditor) and to understand what NOT to replicate (the `useProtoStore` coupling). Do NOT reuse ProtoFormRenderer itself.

### Structural analogs (follow these patterns for new components)
- `src/components/plans/PlanListPanel.tsx` — Step list rows follow the same pattern: inline rename input, kebab DropdownMenu, AlertDialog delete confirmation.
- `src/components/blocks/BlockLibraryPanel.tsx` — Import-from-blocks picker; also has the `useDraggable` pattern from `@dnd-kit/core`.
- `src/components/layout/AppLayout.tsx` — AppLayout DndContext (block drag-and-drop); Plan 21's step DndContext is SEPARATE and lives inside PlanDetailPanel, not here.
- `src/components/publish/PublishBar.tsx` — Target (queue/exchange) and response mode UI patterns to replicate in StepFieldEditor §Target and §Response mode sections. Also the source of `appendEntry` calls to update with `protoPath`.
- `src/stores/useHistoryStore.ts` — `HistoryEntry` type; Phase 21 adds `protoPath: string` field. Update `appendEntry` in `PublishBar` accordingly.
- `src/components/history/HistoryTable.tsx` — Reuse or mirror for the "From history" picker dialog.

### DnD
- `@dnd-kit/sortable` — Install this package. `SortableContext`, `useSortable`, `arrayMove` are the primary APIs.
- `@dnd-kit/core` — Already installed. `DndContext`, `DragOverlay`, `PointerSensor` are reused (same pattern as AppLayout).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePlanStore` (`src/stores/usePlanStore.ts`) — Add `updateStep(planId, stepId, partial: Partial<PlanStep>)` and `reorderSteps(planId, fromIndex, toIndex)` actions following the existing optimistic-rollback pattern.
- `buildDefaultValues` (exported from `src/components/form/ProtoFormRenderer.tsx`) — Reuse to generate default field values for blank steps and for initializing StepFieldEditor's form.
- `shadcn/ui DropdownMenu` — For "+" add/import menu and step kebab CRUD menu.
- `shadcn/ui AlertDialog` — For step delete confirmation (same pattern as Phase 20 plan delete).
- `shadcn/ui Sheet` or `Dialog` — For "From history" and "From block library" import pickers.
- `useHistoryStore.entries` — Feed the history picker.
- `useBlockStore.blocks` — Feed the block picker.
- `useProtoStore.openFiles` — For proto file selector within StepFieldEditor.
- `GripVertical` icon (lucide-react) — Already used in AppLayout's DragOverlay; reuse for step row drag handles.

### Established Patterns
- **Auto-save + optimistic rollback** — All store mutations (Phase 19/20) write optimistically then rollback on error. `updateStep` and `reorderSteps` follow the same pattern.
- **Inline rename** — Phase 20's plan rename pattern (auto-focused input replacing name text, Enter = commit, Escape = discard). Step rename follows the same pattern.
- **No viewMode in Zustand** — Active step selection (`selectedStepId`) is local React state in `PlanDetailPanel`, NOT in `usePlanStore`. Mirrors Phase 20's `selectedPlanId` pattern (D-12 from Phase 20).
- **field_values as JSON string** — Never store `Record<string, unknown>`; always serialize before store write, parse at render time (Phase 19 D-12).
- **`loadPlans()` already called at App mount** — Steps load as part of the plan; no extra load calls needed.
- **DndContext collision detection** — AppLayout uses default `closestCenter`; Phase 21's step DndContext should also use `closestCenter` or `verticalListSortingStrategy`.

### Integration Points
- `src/components/plans/PlanDetailPanel.tsx` — Replace empty-state placeholder with full sub-split layout (step list + StepFieldEditor). This is the main deliverable file.
- New: `src/components/plans/StepListPanel.tsx` — Left sub-pane: sortable step rows, "+" dropdown menu, DndContext.
- New: `src/components/plans/StepFieldEditor.tsx` — Right sub-pane: proto selector + field form + target + response mode.
- New: `src/components/plans/StepHistoryPicker.tsx` (or dialog) — "From history" import picker.
- New: `src/components/plans/StepBlockPicker.tsx` (or dialog) — "From block library" import picker.
- `src/stores/useHistoryStore.ts` — Add `protoPath?: string` to `HistoryEntry` type.
- `src/components/publish/PublishBar.tsx` — Update `appendEntry` calls to include `protoPath` from active `useProtoStore` file.

</code_context>

<specifics>
## Specific Ideas

- The "+" add/import button opens a shadcn `DropdownMenu` with three items: **Blank step** / **From history** / **From block library**. This mirrors the "From block library" import concept from the main publish flow, now applied to plan step authoring.
- Block import in Phase 21 (v1) does NOT pre-fill proto path or message type — user sets those manually after import. This is acceptable because blocks are message-agnostic content stores.
- `protoPath` added to `HistoryEntry` is `string | undefined` (not required) to avoid breaking old entries. Import fallback: auto-match by `messageTypeName` in `openFiles`.
- Step rename uses the same inline-input pattern as Phase 20's plan rename (keyboard-accessible, auto-focus, Enter/Escape).
- `selectedStepId: string | null` is local React state in `PlanDetailPanel` (same reasoning as `selectedPlanId` in Phase 20 — selection state is not persisted).

</specifics>

<deferred>
## Deferred Ideas

- Step-level JSON override toggle (like the main form's JSON editor mode) — post-v1.6 concern.
- Step reorder via keyboard (up/down shortcuts) — accessibility improvement, post-v1.6.
- Block import auto-filling proto path — not feasible in v1 since blocks don't store proto path.
- Response mode default per plan (rather than per step) — Phase 22 concern if needed.

</deferred>

---

*Phase: 21-Step Editor (Authoring)*
*Context gathered: 2026-05-23*
