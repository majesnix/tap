# Phase 12: Block Library — Drag-and-Drop Layer - Research

**Researched:** 2026-05-20
**Domain:** Native HTML5 Drag-and-Drop API, react-hook-form formState internals (dirtyFields vs touchedFields), jsdom DnD testing
**Confidence:** HIGH (all core findings verified against official sources or codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Native HTML5 drag-and-drop only — no `@dnd-kit` or other DnD library. `draggable="true"` and `onDragStart` on block list cards; `onDragOver` + `onDrop` + `onDragLeave` on the form scroll area.
- **D-02:** Block ID only in drag payload — `dataTransfer.setData('blockId', block.id)`. Drop handler looks up block content from `useBlockStore.getState().blocks` by ID.
- **D-03:** A field is empty (fillable) when `formState.dirtyFields[fieldName]` is falsy. (See Open Question 1 — semantic mismatch with stated behavior.)
- **D-04:** `applyBlockRef` pattern — sibling ref to existing `resetRef` in `ProtoFormRenderer`/`FormPanel`.
- **D-05:** Top-level scalar and enum fields only — nested/map/repeated treated as absent.
- **D-06:** BLK-08 warning via `toast.warning()` from `sonner`. Wording: `"N field(s) from block not in form: [fieldA, fieldB, …]"`.
- **D-07:** Drop target = FormPanel's `<ScrollArea>` wrapping `ProtoFormRenderer` only.
- **D-08:** `isDraggingOver` local state → `ring-2 ring-primary/50` visual feedback.
- **D-09:** `cursor-grab` on block card rows.

### Claude's Discretion

- Whether to disable drag from the editor view (naturally handled — editor view shows no block items).
- Error handling for `JSON.parse` failure on block content at apply time (silent no-op is fine).
- Test strategy for native HTML5 DnD: use `fireEvent.dragStart`, `fireEvent.dragOver`, `fireEvent.drop` with a minimal `DataTransfer` mock.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLK-06 | User can apply a block to the current form by dragging it from the block library panel and dropping it onto the form | D-01 through D-09 cover full implementation; native HTML5 DnD patterns documented in Architecture Patterns below |
| BLK-07 | Block merge fills only empty (unmodified/not-dirty) form fields — never overwrites a field the user has already edited | D-03 mechanism verified; Open Question 1 flags a behavioral nuance between `dirtyFields` and `touchedFields` |
| BLK-08 | User sees a warning toast listing field names from the block that had no matching field in the current form | D-05 + D-06 define field eligibility check and toast format; `sonner` already installed |
</phase_requirements>

---

## Summary

Phase 12 adds the drag-and-drop interaction layer on top of the Phase 11 block library foundation. All architecture and UI decisions are locked in CONTEXT.md. Research confirms the standard native HTML5 DnD pattern, verifies one behavioral nuance in react-hook-form's `formState.dirtyFields` that the planner must resolve, documents the canonical jsdom DnD test mock, and catalogues the two most dangerous native DnD footguns (the `preventDefault` requirement and the `dragLeave` child-element problem).

No new npm packages are required. All shadcn components are already installed. The only substantive open question is whether D-03 should use `dirtyFields` or `touchedFields` to protect user-edited fields — these have different behaviors when a user types a value back to the default, and the stated CONTEXT.md intent is closer to `touchedFields` semantics.

**Primary recommendation:** Implement exactly as CONTEXT.md specifies. Resolve Open Question 1 (dirtyFields vs touchedFields) before beginning the `applyBlockRef` implementation — it is a one-line difference but a user-visible behavioral difference.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag source (block card rows) | Browser / Client | — | `draggable` attribute, `onDragStart`, `dataTransfer.setData` are pure browser DnD APIs on existing DOM elements in `BlockLibraryPanel` |
| Drop zone / drag feedback | Browser / Client | — | `onDragOver`, `onDragLeave`, `onDrop` event handlers on `FormPanel`'s `<ScrollArea>`; `isDraggingOver` local state drives CSS ring class |
| Block ID → content lookup | Browser / Client | — | `useBlockStore.getState().blocks` — Zustand store in-memory, already loaded |
| Field eligibility check + apply | Browser / Client | — | `formState.dirtyFields` + `schema.fields` iteration inside `ProtoFormRenderer` via `applyBlockRef.current`; `methods.setValue()` for partial write |
| Skipped-field warning | Browser / Client | — | `toast.warning()` fired from `FormPanel` drop handler using the skipped list returned by `applyBlockRef.current` |

---

## Standard Stack

### Core (no changes — all already installed)

| Library | Version (pinned) | Purpose | Role in Phase 12 |
|---------|-----------------|---------|-----------------|
| `react-hook-form` | ^7.76.0 | Form state | `formState.dirtyFields`, `methods.setValue()`, `methods.getValues()` — all used inside `applyBlockRef.current` |
| `sonner` | ^2.0.7 | Toast notifications | `toast.warning()` for BLK-08 skipped-fields warning |
| `zustand` | ^5.0.13 | Global state | `useBlockStore.getState().blocks` — ID→content lookup on drop |

**No new packages required.** [VERIFIED: package.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 DnD | `@dnd-kit/core` | dnd-kit has better cross-platform consistency and avoids the `dragLeave` child-element problem, but D-01 locks native DnD |
| `dirtyFields` guard | `touchedFields` guard | `touchedFields` matches the stated "protect any field the user touched" semantic more precisely — see Open Question 1 |

---

## Architecture Patterns

### System Architecture Diagram

```
BlockLibraryPanel (list view)
  block row <div draggable="true">
    onDragStart → dataTransfer.setData('blockId', block.id)
         │
         │  (browser DnD gesture)
         ▼
FormPanel
  <ScrollArea>  ← drop zone
    onDragOver  → e.preventDefault()  (REQUIRED or onDrop never fires)
                  setIsDraggingOver(true)
    onDragLeave → guard child-element leak
                  setIsDraggingOver(false)
    onDrop      → e.preventDefault()
                  setIsDraggingOver(false)
                  blockId = e.dataTransfer.getData('blockId')
                  block = useBlockStore.getState().blocks.find(b => b.id === blockId)
                  blockValues = JSON.parse(block.content)   ← try/catch no-op
                  skipped = applyBlockRef.current(blockValues)
                  if skipped.length > 0: toast.warning(...)
                  ↓
  ProtoFormRenderer (applyBlockRef.current wired via useEffect)
    for each key in blockValues:
      field = schema.fields.find(f => f.name === key && isEligible(f))
      if !field → add to skipped[]
      elif formState.dirtyFields[key] → skip (protected)
      else → methods.setValue(key, value)
    return skipped[]
```

### Recommended File Touch Set

```
src/components/blocks/
└── BlockLibraryPanel.tsx        # add draggable, onDragStart, cursor-grab

src/components/form/
├── FormPanel.tsx                # add applyBlockRef, onDrop/onDragOver/onDragLeave, isDraggingOver
└── ProtoFormRenderer.tsx        # add applyBlockRef prop + useEffect wiring
```

No new files are created. All changes are additive modifications to existing files.

### Pattern 1: Native HTML5 Drop Zone — the `preventDefault` Requirement

**What:** `onDragOver` MUST call `e.preventDefault()` or the browser cancels the drop and `onDrop` never fires.
**When to use:** Any time `onDrop` is needed on an element.
**Example:**
```typescript
// Source: MDN Web Docs — HTML Drag and Drop API
<ScrollArea
  className={cn("flex-1 min-h-0", isDraggingOver && "ring-2 ring-primary/50")}
  onDragOver={(e) => {
    e.preventDefault();            // REQUIRED — without this, onDrop never fires
    setIsDraggingOver(true);
  }}
  onDragLeave={(e) => {
    // Guard against child-element flicker (see Pitfall 2)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }}
  onDrop={(e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const blockId = e.dataTransfer.getData('blockId');
    // ... lookup and apply
  }}
>
```
[VERIFIED: MDN Web Docs — https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations#droptargets]

### Pattern 2: `applyBlockRef` — sibling to `resetRef`

**What:** A `MutableRefObject` wired in a `useEffect` inside `ProtoFormRenderer`, giving `FormPanel` a stable handle to call RHF methods.
**When to use:** Any time `FormPanel` needs to drive `ProtoFormRenderer`'s form state without prop-drilling or context.
**Example:**
```typescript
// ProtoFormRenderer — new prop (mirrors resetRef exactly)
interface ProtoFormRendererProps {
  // ... existing props
  applyBlockRef?: React.MutableRefObject<
    ((blockValues: Record<string, unknown>) => string[]) | null
  >;
}

// Inside ProtoFormRenderer, new useEffect alongside existing resetRef effect:
useEffect(() => {
  if (applyBlockRef) {
    applyBlockRef.current = (blockValues: Record<string, unknown>): string[] => {
      const skipped: string[] = [];
      const eligibleFields = new Set(
        message.fields
          .filter(f => !f.repeated && (f.kind.type === 'scalar' || f.kind.type === 'enum'))
          .map(f => f.name)
      );
      for (const [key, value] of Object.entries(blockValues)) {
        if (!eligibleFields.has(key)) {
          skipped.push(key);
        } else if (methods.formState.dirtyFields[key]) {
          // field is protected — do not overwrite
        } else {
          methods.setValue(key, value);
        }
      }
      return skipped;
    };
  }
  return () => {
    if (applyBlockRef) applyBlockRef.current = null;
  };
}, [applyBlockRef, methods, message]);

// FormPanel — new ref alongside existing resetRef:
const applyBlockRef = useRef<((values: Record<string, unknown>) => string[]) | null>(null);
```
[ASSUMED: Pattern derived from existing resetRef wiring in codebase — not a third-party API]

### Pattern 3: jsdom DataTransfer Mock for Tests

**What:** jsdom does not implement `DataTransfer`. Tests must manually construct an object with `getData`/`setData` and attach it to the event.
**When to use:** Any test that fires `dragStart`, `dragOver`, or `drop` events.
**Example:**
```typescript
// Source: @testing-library/react community pattern — fireEvent.drop with DataTransfer mock
function createDataTransfer(data: Record<string, string>) {
  const store: Record<string, string> = { ...data };
  return {
    getData: (key: string) => store[key] ?? '',
    setData: vi.fn((key: string, value: string) => { store[key] = value; }),
    types: Object.keys(data),
  };
}

// Drag source test:
const row = screen.getByText('My Block').closest('div')!;
const dataTransfer = createDataTransfer({});
fireEvent.dragStart(row, { dataTransfer });
expect(dataTransfer.setData).toHaveBeenCalledWith('blockId', 'block-1');

// Drop zone test:
const dropZone = screen.getByTestId('form-drop-zone');
fireEvent.dragOver(dropZone, { dataTransfer: createDataTransfer({ blockId: 'block-1' }) });
fireEvent.drop(dropZone, { dataTransfer: createDataTransfer({ blockId: 'block-1' }) });
```
[CITED: jsdom known limitation, fireEvent pattern from testing-library docs — no DataTransfer native implementation in jsdom v29]

### Anti-Patterns to Avoid

- **Calling `reset()` instead of `setValue()` for partial updates:** `reset()` clears all `dirtyFields` and `touchedFields`, destroying protection tracking on other fields. Use `setValue(key, value)` per-field. [VERIFIED: CONTEXT.md D-04 established pattern, codebase docs]
- **Skipping `e.preventDefault()` on `onDragOver`:** Drop will silently never fire. No error in console. [VERIFIED: MDN Drag and Drop API]
- **Using the drag payload for block content:** Block content is looked up by ID from store at drop time — never serialized into `dataTransfer`. Avoids stale content if block was edited mid-drag. [VERIFIED: CONTEXT.md D-02]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notification | Custom warning UI | `toast.warning()` from `sonner` | Already installed, already used in `BlockLibraryPanel.tsx` and `FormPanel.tsx`; consistent UX |
| Field-level form write | Custom value injection | `methods.setValue(key, value)` from RHF | `setValue` handles validation mode, dirty state, and re-render triggering correctly |
| Store content lookup | Re-serialize via dataTransfer | `useBlockStore.getState().blocks.find()` | Always-fresh, avoids stale content from mid-drag edit |

**Key insight:** The DnD mechanism is pure browser; the heavy lifting (dirty tracking, form write) is already provided by react-hook-form. Phase 12 is a thin coordination layer.

---

## Common Pitfalls

### Pitfall 1: `onDragOver` Without `e.preventDefault()` — Drop Never Fires

**What goes wrong:** The drop event is silently discarded by the browser. `onDrop` is never called. No error message.
**Why it happens:** The browser's default drag behavior is to disallow drops. `preventDefault()` on `dragover` signals to the browser that this element accepts drops.
**How to avoid:** Always add `e.preventDefault()` as the first line of every `onDragOver` handler.
**Warning signs:** Drag-over class applies (ring shows) but dropping does nothing.
[VERIFIED: MDN — https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations#droptargets]

### Pitfall 2: `onDragLeave` Fires on Child Element Crossing

**What goes wrong:** When the dragged item moves from the drop zone container into a child element (e.g., a form label inside the ScrollArea), `dragLeave` fires on the container and `isDraggingOver` flickers to false, even though the pointer is still inside the drop zone.
**Why it happens:** `dragLeave` fires whenever the pointer leaves *any* boundary, including entering a child. The `relatedTarget` is the child element, not null.
**How to avoid:** Guard the `onDragLeave` handler:
```typescript
onDragLeave={(e) => {
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    setIsDraggingOver(false);
  }
}}
```
**Warning signs:** Drop zone ring flickers rapidly while hovering over form labels/inputs.
[ASSUMED: Standard HTML5 DnD community pattern — multiple sources confirm; no official MDN single reference]

### Pitfall 3: `setValue` Without `shouldDirty` Marks Fields Dirty

**What goes wrong:** Calling `methods.setValue(key, value)` by default marks the field as dirty, meaning a subsequent block drop would skip that field (treating it as user-protected).
**Why it happens:** RHF's `setValue` sets `shouldDirty: false` by default — but this means the field is NOT marked dirty, which is actually the correct behavior for block apply. No action needed.
**How to avoid:** Rely on the default `shouldDirty: false` in `setValue` — this is correct. Do NOT pass `{ shouldDirty: true }`.
**Warning signs:** Fields filled by a block drop are skipped on a second block drop.
[CITED: RHF setValue docs — https://react-hook-form.com/docs/useform/setvalue]

### Pitfall 4: `dirtyFields` vs `touchedFields` — Behavioral Gap at D-03

**What goes wrong:** The CONTEXT.md states "a field the user edited (even if they typed the default value back) is protected." This description matches `touchedFields` semantics, not `dirtyFields`.
**Why it happens:** `dirtyFields` in RHF v7 is value-based: a field is removed from `dirtyFields` when the user types back the exact default value. `touchedFields` tracks interaction history: once a field is touched (blur/focus), it remains in `touchedFields` regardless of value changes.
**How to avoid:** See Open Question 1. Decision is between `dirtyFields` (value-comparison semantics) and `touchedFields` (interaction-history semantics). D-03 explicitly chose `dirtyFields` — but the stated intent matches `touchedFields`.
**Warning signs:** Users who type a value into a field and then clear it back to the default see that field get overwritten by a block drop (because `dirtyFields[key]` is falsy again).
[CITED: RHF formState docs + GitHub discussion #7860 — https://github.com/orgs/react-hook-form/discussions/7860]

---

## Code Examples

Verified patterns from codebase and official sources:

### Drag Source Row (BlockLibraryPanel list view)
```typescript
// Source: CONTEXT.md D-01, D-02, D-09 + HTML5 DnD API
<div
  key={block.id}
  draggable="true"
  onDragStart={(e) => {
    e.dataTransfer.setData('blockId', block.id);
  }}
  className="px-3 py-2 flex items-center justify-between hover:bg-muted rounded-sm cursor-grab active:cursor-grabbing"
>
  {/* existing content unchanged */}
</div>
```

### Drop Zone (FormPanel — ScrollArea wrapping ProtoFormRenderer)
```typescript
// Source: CONTEXT.md D-07, D-08 + MDN DnD API
<ScrollArea
  className={cn(
    "flex-1 min-h-0",
    isDraggingOver && "ring-2 ring-primary/50"
  )}
  onDragOver={(e) => {
    e.preventDefault();  // REQUIRED — enables onDrop
    setIsDraggingOver(true);
  }}
  onDragLeave={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }}
  onDrop={(e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const blockId = e.dataTransfer.getData('blockId');
    if (!blockId || !applyBlockRef.current) return;
    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) return;
    let blockValues: Record<string, unknown>;
    try {
      blockValues = JSON.parse(block.content) as Record<string, unknown>;
    } catch {
      return; // silent no-op — unreachable (Save validated JSON)
    }
    const skipped = applyBlockRef.current(blockValues);
    if (skipped.length > 0) {
      const n = skipped.length;
      const label = n === 1 ? 'field' : 'fields';
      toast.warning(`${n} ${label}(s) from block not in form: ${skipped.join(', ')}`);
    }
  }}
>
  <ProtoFormRenderer
    message={message}
    onValuesChange={handleValuesChange}
    resetRef={resetRef}
    applyBlockRef={applyBlockRef}
  />
</ScrollArea>
```

### Field Eligibility Check (inside applyBlockRef.current)
```typescript
// Source: CONTEXT.md D-05 + src/lib/types.ts FieldKind definition
// Eligible: top-level scalar or enum, not repeated, not nested/map/well_known/oneof/bytes(repeated)
function isEligibleField(field: FieldSchema): boolean {
  if (field.repeated) return false;
  return field.kind.type === 'scalar' || field.kind.type === 'enum';
}
// Note: bytes is a scalar sub-kind — field.kind.type === 'scalar' with field.kind.scalar === 'bytes'
// D-05 says scalar eligible, so bytes fields ARE eligible for block apply unless clarified.
// Check with planner if bytes should be excluded.
```

### Toast Warning Copy (BLK-08)
```typescript
// Source: CONTEXT.md D-06 + UI-SPEC copywriting contract
// Note: UI-SPEC says "field(s)" with literal parens in the wording
const n = skipped.length;
const label = n === 1 ? 'field' : 'fields';
toast.warning(`${n} ${label}(s) from block not in form: ${skipped.join(', ')}`);
// Literal result examples:
// "1 field(s) from block not in form: unknownKey"
// "2 field(s) from block not in form: nestedMsg, repeatedArr"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DnD libraries (`react-dnd`, `@dnd-kit`) | Native HTML5 DnD | Project decision (D-01) | Simpler bundle, some edge cases (see Pitfall 2) require manual handling |
| `reset()` for form value injection | `setValue()` per field | CONTEXT.md D-04 established pattern | Preserves dirty/touched state on unaffected fields |

**No deprecated approaches in this phase.** No new library versions introduced.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bytes` scalar fields are eligible for block apply (implied by D-05: "scalar and enum") | Code Examples — field eligibility | If bytes should be excluded, the eligibility filter needs `&& field.kind.scalar !== 'bytes'`; a bytes field silently receiving a string value from a block could cause encoding errors |
| A2 | `onDragLeave` `relatedTarget` containment guard works correctly with Radix ScrollArea's DOM structure | Code Examples — drop zone | If ScrollArea renders a portal or shadow DOM boundary, `e.currentTarget.contains(e.relatedTarget)` may not traverse correctly; ring may still flicker |
| A3 | `active:cursor-grabbing` applies during an HTML5 drag operation | Code Examples — drag source | CSS `active` pseudo-class may not apply during a native drag gesture in all browsers; visual is a nice-to-have |

---

## Open Questions (RESOLVED)

### Open Question 1: D-03 — `dirtyFields` vs `touchedFields` for field protection

**What we know:**
- CONTEXT.md D-03: "A field the user edited (even if they typed the default value back) is protected."
- RHF v7 `dirtyFields` semantics: a field is removed from `dirtyFields` when the current value equals the `defaultValue`. Typing back the default makes the field NOT dirty. [CITED: GitHub discussion #7860]
- RHF v7 `touchedFields` semantics: once a field is blurred after interaction, it remains in `touchedFields` regardless of value. Typing back the default does NOT remove it from `touchedFields`. [CITED: RHF docs on formState]

**What's unclear:** The stated intent in D-03 ("even if they typed the default value back") matches `touchedFields`, not `dirtyFields`. Using `dirtyFields` as written will NOT protect a field where the user typed back the default value.

**Behavioral difference:**
- User types "hello" into a string field → types "" → block drops → `dirtyFields` guard: field is NOT protected (value equals default ""); `touchedFields` guard: field IS protected.
- Both guards protect a field where the user typed "hello" and left it.

**Recommendation:** Ask the user before planning starts: "Should a field be protected only when its current value differs from the default (dirtyFields behavior), or once the user has touched it at all (touchedFields behavior)?" If the CONTEXT.md description "even if they typed the default value back" is the authoritative intent, implement with `touchedFields`. If `dirtyFields` was an intentional choice knowing the trade-off, keep D-03 as-is.

This is a one-line change: `formState.dirtyFields[key]` → `formState.touchedFields[key]`, but the user-visible behavior differs.

**RESOLVED:** Plans use `dirtyFields` per D-03's explicit choice. The behavioral trade-off is accepted: a field cleared back to its default value becomes fillable again by a subsequent block drop. This is acceptable for a dev tool — users who clear a field intend to reset it. If the "touched forever" semantic proves necessary, switching to `touchedFields` is a one-line change.

### Open Question 2: `bytes` field eligibility for block apply

**What we know:** D-05 says "top-level scalar and enum fields only." `bytes` is a sub-kind of `scalar` (kind.type === "scalar", kind.scalar === "bytes").

**What's unclear:** Is a bytes field intended to be fillable by a block? Block content is JSON — bytes in JSON must be base64 strings. The form's BytesField uses base64. So the block value would need to be a valid base64 string.

**Recommendation:** Include bytes in the eligibility set (consistent with D-05 "scalar"). If it causes issues, the user can exclude it in a follow-up. Document this assumption clearly in the task.

**RESOLVED:** `bytes` IS eligible for block apply. D-05 specifies "top-level scalar and enum fields only", and `bytes` has `kind.type === 'scalar'` — it falls squarely within the scalar category. The block content (JSON) stores bytes as base64 strings, which the BytesField already handles. No special exclusion is needed.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 introduces no external tool, CLI, or service dependencies. All changes are frontend-only modifications to existing TypeScript/React files using already-installed packages.

---

## Security Domain

Phase 12 handles user-initiated drag-and-drop of block content (JSON strings already validated at save time in Phase 11). No new attack surface beyond what Phase 11 introduced.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes (low risk) | Block content is JSON-parsed via `try/catch`; only top-level scalar/enum values are written to the form via `methods.setValue` — RHF handles type coercion; no eval or DOM injection |
| V6 Cryptography | No | N/A |

**No security concerns introduced.** Block content was validated as a JSON object at save time. At apply time, `JSON.parse` is wrapped in try/catch (silent no-op). Values are passed to `methods.setValue` — no HTML rendering, no eval, no IPC call from drop.

---

## Sources

### Primary (HIGH confidence)
- `src/components/form/FormPanel.tsx` — confirmed existing `resetRef` pattern, `<ScrollArea>` at line 237, `toast` import, existing JSON mode guards
- `src/components/form/ProtoFormRenderer.tsx` — confirmed `useForm`, `formState.dirtyFields`, `methods.setValue`, `resetRef` wiring via `useEffect([resetRef, methods])`
- `src/stores/useBlockStore.ts` — confirmed `Block` type, `getState().blocks` lookup pattern
- `src/lib/types.ts` — confirmed `FieldKind` union: `scalar | enum | message | oneof | well_known | map`; `FieldSchema.repeated` flag
- `src/components/blocks/BlockLibraryPanel.tsx` — confirmed `toast` from `sonner` already imported; `ScrollArea` list structure; block row class pattern
- `package.json` — confirmed `react-hook-form ^7.76.0`, `sonner ^2.0.7`, `zustand ^5.0.13`; no DataTransfer in `jsdom ^29.1.1`

### Secondary (MEDIUM confidence)
- MDN — HTML Drag and Drop API, Drag operations: `preventDefault()` on dragover requirement — https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations#droptargets
- GitHub discussion react-hook-form #7860 — `isDirty` vs `dirtyFields` semantics clarified by maintainer — https://github.com/orgs/react-hook-form/discussions/7860
- GitHub issue react-hook-form #13141 — `dirtyFields` behavior when typing back default value — https://github.com/react-hook-form/react-hook-form/issues/13141

### Tertiary (LOW confidence)
- `dragLeave` child-element containment guard pattern — widely documented in community, no single canonical MDN reference; treat as ASSUMED

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — all patterns derived from existing codebase (`resetRef` template) + verified DnD API
- Pitfalls: HIGH (Pitfall 1 MDN-verified), MEDIUM (Pitfall 2 community pattern), HIGH (Pitfall 3 RHF docs), HIGH (Pitfall 4 GitHub discussion)
- Open questions: Open Question 1 is the only substantive unresolved item before planning

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable ecosystem — react-hook-form, sonner, native DnD API all stable)
