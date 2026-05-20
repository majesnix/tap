# Phase 11: Block Library — Store, Editor, Persistence - Research

**Researched:** 2026-05-19
**Domain:** React/Zustand state management, tauri-plugin-store persistence, CodeMirror block editor, shadcn UI panel layout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The block library panel appears as a **left-side column inside `<main>`** when open. `AppLayout`'s `<main>` becomes a flex row: `[BlockLibraryPanel 256px][FormPanel flex-1]`. The panel is conditionally rendered (open/closed state), not always mounted — it slides in by toggling the render.
- **D-02:** Panel width: **fixed 256px** (`w-64`). FormPanel keeps `flex-1` so it expands back to full width when panel is closed.
- **D-03:** Toggle button is placed on the **right side of the FormPanel header**, beside the existing JSON toggle (Braces) button. FormPanel header right side: `[BlockLibrary icon button][Braces icon button]`.
- **D-04:** Panel open/closed state is **local React state in AppLayout** (or FormPanel, depending on where the toggle button lives). It is a session-only UI state — not persisted.
- **D-05:** The panel has **two internal views**: a **list view** (default) and an **editor view** (name field + CodeMirror editor). Clicking "Edit" or "+ New Block" switches to editor view. A Back/Cancel button returns to list view.
- **D-06:** When **creating a new block**, the CodeMirror editor is pre-filled with `{}`. Block name field starts empty.
- **D-07:** When **editing an existing block**, the editor is pre-filled with the block's current JSON content and the name field shows the existing name.
- **D-08:** The editor view has an **explicit Save button**. Save validates name non-empty and JSON is a valid object. Invalid JSON shows an error message inline. Cancel/Back discards unsaved changes.
- **D-09:** Delete confirmation uses a **shadcn `AlertDialog`** (modal).
- **D-10:** Blocks are stored via **`tauri-plugin-store`** in a `blocks.json` file, following the exact same pattern as `useHistoryStore.ts`.
- **D-11:** Block data shape: `Array<{ id: string, name: string, content: string }>` where `id` is `crypto.randomUUID()`, `name` is user-defined, `content` is the raw JSON string.
- **D-12:** A new Zustand store `useBlockStore.ts` owns the block list, `blocksLoaded` boolean, and CRUD actions — mirrors `useHistoryStore` structure.

### Claude's Discretion

None declared in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

None declared in CONTEXT.md. Discussion stayed within phase scope.

**BLK-06, BLK-07, BLK-08** (drag-and-drop application mechanism) are Phase 12 — do not plan or implement in this phase.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLK-01 | User can open and close a block library panel from a toggle button in the FormPanel header | D-01 to D-04 define layout mechanics; `AppLayout.tsx` is the structural change point; toggle state thread from AppLayout to FormPanel header |
| BLK-02 | User can create a named block by entering a name and writing a JSON object in a CodeMirror editor | D-05, D-06, D-08, D-11; block editor uses `JsonEditor.tsx` CodeMirror pattern; local draft state pattern from `AmqpPropertiesSheet` |
| BLK-03 | User can edit an existing block's name and JSON content | D-07, D-08; same editor view as BLK-02 with pre-populated fields; `useBlockStore` `updateBlock` action |
| BLK-04 | User can delete a block with a confirmation prompt | D-09; `AlertDialog` component already installed at `src/components/ui/alert-dialog.tsx`; `useBlockStore` `deleteBlock` action |
| BLK-05 | Blocks persist across app restarts | D-10, D-12; `tauri-plugin-store` `blocks.json` file; `loadBlocks()` called on app mount in `App.tsx`; exact `useHistoryStore` pattern |

</phase_requirements>

---

## Summary

Phase 11 delivers the block library foundation: a 256px fixed-width panel that slides into the left of the center column in `AppLayout`, with a two-view internal structure (list and editor). All technology decisions are locked in CONTEXT.md and UI-SPEC.md. The phase is purely frontend — no Rust backend changes are required.

The implementation reuses three established patterns already working in the codebase: `useHistoryStore.ts` for the Zustand + tauri-plugin-store persistence pattern, `JsonEditor.tsx` for the CodeMirror block editor, and the `AmqpPropertiesSheet` local-draft/explicit-Save idiom. All UI components required are already installed (`Button`, `Input`, `ScrollArea`, `AlertDialog`, `CodeMirror`).

The only non-trivial integration challenge is the toggle state placement: the toggle button lives in `FormPanel`'s header (D-03), but the panel column it controls is rendered in `AppLayout` (D-01). This creates a prop-threading requirement that the planner must resolve by choosing either to lift state to `AppLayout` with a callback prop passed down to `FormPanel`, or to introduce a minimal Zustand slice for the UI toggle.

**Primary recommendation:** Implement `useBlockStore.ts` first (Wave 1), then `BlockLibraryPanel` with its two views (Wave 2), then the `AppLayout` integration (Wave 3).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Panel open/closed state | Browser / Client (React state) | — | Session-only UI state; D-04 explicitly rules out persistence |
| Block data CRUD | Browser / Client (Zustand) | — | Local state store; all mutations go through `useBlockStore` actions |
| Block persistence | Frontend Server / OS storage (`tauri-plugin-store`) | — | `blocks.json` file written by Tauri plugin to app data directory |
| CodeMirror editor | Browser / Client | — | Client-side editor; JSON string stored as raw string, not parsed until Phase 12 apply |
| Delete confirmation UI | Browser / Client (shadcn AlertDialog) | — | Modal rendered in-process; no server roundtrip |
| App-mount hydration | Browser / Client (App.tsx effect) | — | `loadBlocks()` called once at startup, mirrors `loadHistory()` pattern |

---

## Standard Stack

All packages below are already installed. No new dependencies are required for this phase.

### Core

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `zustand` | `^5.0.13` | `useBlockStore` — block list state + CRUD | [VERIFIED: package.json line 38] |
| `@tauri-apps/plugin-store` | `^2.4.3` | `blocks.json` persistence via `load()` / `.set()` / `.save()` | [VERIFIED: package.json line 23] |
| `@uiw/react-codemirror` | `^4.25.9` | CodeMirror editor in block editor view | [VERIFIED: package.json line 24] |
| `@codemirror/lang-json` | `^6.0.2` | JSON syntax highlighting extension for CodeMirror | [VERIFIED: package.json line 16] |

### Supporting (already installed, used in this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^1.16.0` | `Library`, `Plus`, `Pencil`, `Trash2`, `ArrowLeft` icons | Icon buttons in panel header, list rows, editor header |
| `next-themes` | `^0.4.6` | `useTheme()` / `resolvedTheme` | Pass to CodeMirror for dark/light theme sync |
| `radix-ui` | `^1.4.3` | shadcn `AlertDialog` (delete confirmation) | AlertDialog for D-09 |
| `react` | `^19.1.0` | `useState` for local draft state and toggle state | Block editor draft state; AppLayout toggle |

### Alternatives Considered

No alternatives apply — all decisions are locked in CONTEXT.md.

---

## Architecture Patterns

### System Architecture Diagram

```
User click "Library toggle" (FormPanel header)
        │
        ▼
AppLayout toggle state (useState isBlockLibraryOpen)
        │
   open? ─────────────────────────────────────────────────────────────────────┐
   no: FormPanel fills main                                                    yes: flex row
        │                                                                           │
        └─ <FormPanel flex-1> ───────────────────────────────────────────────┐     ├─ <BlockLibraryPanel w-64>
                                                                              │     │       │
                                                                              │     │       ▼
                                                                              │     │   list view or editor view
                                                                              │     │       │
                                                                              │     │   [CRUD actions]
                                                                              │     │       │
                                                                              │     │       ▼
                                                                              │     │   useBlockStore
                                                                              │     │       │
                                                                              │     │       ▼
                                                                              │     │   tauri-plugin-store → blocks.json
                                                                              │     │
                                                                              └─────┘ <FormPanel flex-1>

App mount
  └── useBlockStore.loadBlocks() (App.tsx useEffect, mirrors loadHistory())
        │
        ▼
  blocks.json via tauri-plugin-store → set({ blocks, blocksLoaded: true })
```

### Recommended Project Structure

```
src/
├── stores/
│   └── useBlockStore.ts          # New — mirrors useHistoryStore exactly
├── components/
│   └── blocks/
│       ├── BlockLibraryPanel.tsx # New — two-view panel (list / editor)
│       ├── BlockListView.tsx     # New — extracted list view (optional extraction)
│       └── BlockEditorView.tsx   # New — extracted editor view (optional extraction)
│   └── form/
│       └── FormPanel.tsx         # Modified — add Library toggle button in header
│   └── layout/
│       └── AppLayout.tsx         # Modified — add isBlockLibraryOpen state + conditional render
```

Note: `BlockListView` and `BlockEditorView` can be co-located in `BlockLibraryPanel.tsx` if the combined file stays under 400 lines. Extract into siblings if it grows past that threshold.

### Pattern 1: Zustand Store — `useBlockStore.ts`

Mirror `useHistoryStore.ts` structure exactly.

**What:** Zustand store managing `blocks` array, `blocksLoaded` hydration gate, and async CRUD actions backed by `tauri-plugin-store`.

**When to use:** All reads and writes to the block list go through this store.

```typescript
// Source: src/stores/useHistoryStore.ts (exact pattern to replicate)
import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

const BLOCKS_STORE_PATH = "blocks.json";
const BLOCKS_KEY = "blocks";

export interface Block {
  id: string;      // crypto.randomUUID()
  name: string;
  content: string; // raw JSON string — not parsed here
}

interface BlockStore {
  blocks: Block[];
  blocksLoaded: boolean;
  loadBlocks: () => Promise<void>;
  addBlock: (block: Block) => Promise<void>;
  updateBlock: (id: string, updates: Pick<Block, "name" | "content">) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
}

async function persistBlocks(blocks: Block[]): Promise<void> {
  // load() without options — do NOT pass { autoSave: false } without also
  // providing a 'defaults' field; just call load(path) (useHistoryStore line 31 pattern)
  const store = await load(BLOCKS_STORE_PATH);
  await store.set(BLOCKS_KEY, blocks);
  await store.save();
}

export const useBlockStore = create<BlockStore>((set, get) => ({
  blocks: [],
  blocksLoaded: false,

  loadBlocks: async () => {
    const store = await load(BLOCKS_STORE_PATH);
    const saved = await store.get<Block[]>(BLOCKS_KEY);
    set({ blocks: saved ?? [], blocksLoaded: true });
  },

  addBlock: async (block) => {
    // CRITICAL: guard matches useHistoryStore appendEntry guard (lines 47-50)
    if (!get().blocksLoaded) return;
    const updated = [...get().blocks, block];
    set({ blocks: updated });
    await persistBlocks(updated);
  },

  updateBlock: async (id, updates) => {
    if (!get().blocksLoaded) return;
    const updated = get().blocks.map((b) =>
      b.id === id ? { ...b, ...updates } : b
    );
    set({ blocks: updated });
    await persistBlocks(updated);
  },

  deleteBlock: async (id) => {
    if (!get().blocksLoaded) return;
    const updated = get().blocks.filter((b) => b.id !== id);
    set({ blocks: updated });
    await persistBlocks(updated);
  },
}));
```

### Pattern 2: Local Draft State in Editor View

**What:** Block name and JSON content are held in local `useState` while editing. Only committed to `useBlockStore` when Save is clicked.

**When to use:** All edit-in-progress state in `BlockEditorView`. Never write to Zustand on each keystroke.

```typescript
// Source: AmqpPropertiesSheet pattern (local draft, explicit Save/Cancel — CONTEXT D-08)
function BlockEditorView({ block, onSave, onCancel }: BlockEditorViewProps) {
  const [nameDraft, setNameDraft] = useState(block?.name ?? "");
  const [contentDraft, setContentDraft] = useState(block?.content ?? "{}");
  const [saveError, setSaveError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  function handleSave() {
    // Validation: name non-empty
    if (!nameDraft.trim()) {
      setSaveError("Name is required");
      return;
    }
    // Validation: valid JSON object (CR-01 pattern from FormPanel.tsx line 133)
    let parsed: unknown;
    try {
      parsed = JSON.parse(contentDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setSaveError("JSON must be an object");
      return;
    }
    setSaveError(null);
    onSave({ name: nameDraft.trim(), content: contentDraft });
  }

  // ... JSX with Input, CodeMirror, error banner, Save/Back buttons
}
```

### Pattern 3: AppLayout Toggle State + FormPanel Prop Threading

**What:** `isBlockLibraryOpen` state lives in `AppLayout` (per D-01, the panel renders in `<main>`). FormPanel receives an `onToggleBlockLibrary` prop to wire the toggle button.

**When to use:** This is the structural integration pattern for BLK-01.

```typescript
// Source: AppLayout.tsx — current structure (line 6-26); must be extended
export function AppLayout() {
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="w-72 ..."><Sidebar /></aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <PublishBar />
        <div className="flex-1 flex flex-row min-h-0">
          {isBlockLibraryOpen && <BlockLibraryPanel onClose={() => setIsBlockLibraryOpen(false)} />}
          <FormPanel
            isBlockLibraryOpen={isBlockLibraryOpen}
            onToggleBlockLibrary={() => setIsBlockLibraryOpen((v) => !v)}
          />
        </div>
      </main>
      <aside className="w-80 ..."><RightPanel /></aside>
    </div>
  );
}
```

Note: `PublishBar` sits above the flex row; the flex row holds the panel + FormPanel side by side. See Layout Constraint in UI-SPEC.

### Pattern 4: App Mount Hydration

**What:** `loadBlocks()` called once in `App.tsx` on mount, alongside existing `loadHistory()`.

**When to use:** Required for BLK-05 persistence.

```typescript
// Source: App.tsx — existing useEffect for loadHistory (pattern to mirror)
// Add to the existing app-level mount effect that calls loadHistory():
useEffect(() => {
  void useBlockStore.getState().loadBlocks();
}, []);
```

### Pattern 5: CodeMirror Mock in Tests

**What:** CodeMirror must be mocked as a `<textarea>` stub in Vitest + jsdom tests.

**When to use:** Every test file that renders `BlockEditorView` or `BlockLibraryPanel`.

```typescript
// Source: src/components/form/__tests__/FormPanel.test.tsx lines 11-25
vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
```

### Pattern 6: tauri-plugin-store Mock in Zustand Store Tests

**What:** Mock `@tauri-apps/plugin-store` using `vi.hoisted` to prevent import ordering issues.

**When to use:** `useBlockStore.test.ts`.

```typescript
// Source: src/stores/useHistoryStore.test.ts lines 4-14
const { mockStore, mockGet, mockSet, mockSave } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(null);
  const mockStore = { get: mockGet, set: mockSet, save: mockSave };
  return { mockStore, mockGet, mockSet, mockSave };
});

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));
```

### Anti-Patterns to Avoid

- **Auto-saving on keystrokes:** Do not call `useBlockStore.updateBlock()` on every CodeMirror `onChange`. Save only on explicit Save button click.
- **Nesting CodeMirror inside ScrollArea:** See `FormPanel.tsx` line 207 comment ("RESEARCH Pitfall 4"). The editor view body must be `flex flex-col min-h-0`, not wrapped in `ScrollArea`.
- **Calling `load()` with `autoSave: false` only:** `load(path, { autoSave: false })` requires a `defaults` field — omitting it causes a runtime error. Use `load(path)` with no options (see `useHistoryStore.ts` comment lines 30-31).
- **Missing `blocksLoaded` guard:** Every CRUD action must check `if (!get().blocksLoaded) return;` before writing. Without this, `loadBlocks()` resolving after a write silently overwrites new data (race condition documented in `useHistoryStore.appendEntry` lines 47-50).
- **Using `uuid` dep for IDs:** Use `crypto.randomUUID()` — no npm dependency needed (established project pattern).
- **Calling `resetRef.current()` directly from toggle handler:** Not relevant to this phase, but note the pattern: use Zustand signals, not direct ref calls, for any form interaction (Phase 12 concern).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON editing with syntax highlight | Custom textarea with validation | `@uiw/react-codemirror` + `@codemirror/lang-json` | Already in codebase (`JsonEditor.tsx`); CodeMirror handles bracket matching, syntax errors, dark/light themes |
| File-based persistence | Manual `fs` read/write + JSON.stringify | `tauri-plugin-store` (`load()`, `.set()`, `.save()`) | Handles atomic writes, cross-platform app data directory, type-safe get; already used by `useHistoryStore` and theme store |
| Delete confirmation modal | Custom modal with backdrop | `AlertDialog` from `src/components/ui/alert-dialog.tsx` | Already installed; consistent with shadcn destructive action pattern |
| Block ID generation | `uuid` npm package | `crypto.randomUUID()` | Built into browser/Node; no dep required; established project pattern |
| Dark/light editor theme | Custom CodeMirror theme | `resolvedTheme` from `next-themes` passed as `theme` prop to CodeMirror | Already threaded through `FormPanel`; CodeMirror accepts `"dark"` / `"light"` string directly |

**Key insight:** This phase assembles existing pieces rather than building new infrastructure. All libraries, components, and patterns are proven in the codebase.

---

## Common Pitfalls

### Pitfall 1: Hydration Race Condition

**What goes wrong:** `loadBlocks()` is async. If `addBlock` / `updateBlock` / `deleteBlock` is called before the `load()` promise resolves (e.g., by a fast user action on mount), the data written is immediately overwritten when `loadBlocks()` finally resolves and calls `set({ blocks: saved ?? [] })`.

**Why it happens:** Zustand actions are synchronous state setters but the persistence layer is async. Without a gate, writes can happen before the initial load completes.

**How to avoid:** Every CRUD action opens with `if (!get().blocksLoaded) return;` — exact pattern from `useHistoryStore.appendEntry` lines 47-50.

**Warning signs:** Block appears briefly in the list then disappears on first use after app start.

### Pitfall 2: `load()` with Incomplete Options Object

**What goes wrong:** Calling `load(path, { autoSave: false })` fails at runtime because the options type requires a `defaults` field when options are passed.

**Why it happens:** `tauri-plugin-store` v2 StoreOptions type mandates `defaults` when options are present.

**How to avoid:** Call `load(path)` with no options argument. See `useHistoryStore.ts` comment lines 30-31: `load()` without options works.

**Warning signs:** Runtime `TypeError` or store load fails silently on first run.

### Pitfall 3: Accepting Non-Object JSON as Valid

**What goes wrong:** `JSON.parse("null")`, `JSON.parse("[]")`, and `JSON.parse("42")` all succeed. If the validation only checks `JSON.parse` without a type guard, arrays and null values are accepted as blocks.

**Why it happens:** `JSON.parse` is not an object validator.

**How to avoid:** Apply the exact CR-01 check from `FormPanel.tsx` line 133:
```typescript
if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
  setSaveError("JSON must be an object");
  return;
}
```

**Warning signs:** Users can save array blocks that crash Phase 12 apply logic.

### Pitfall 4: CodeMirror Height in a Flex Container

**What goes wrong:** Wrapping CodeMirror in a `ScrollArea` or omitting `min-h-0` on ancestor elements causes CodeMirror to collapse to zero height or overflow its container.

**Why it happens:** CodeMirror uses `height="100%"` internally; flex containers without `min-h-0` prevent the shrink-to-fit behavior.

**How to avoid:** Editor view body must be `flex-1 flex flex-col min-h-0`. Do not nest CodeMirror inside `ScrollArea`. See `FormPanel.tsx` line 207 comment: "do NOT nest CodeMirror inside ScrollArea (RESEARCH Pitfall 4)".

**Warning signs:** CodeMirror editor is invisible or zero height in the panel.

### Pitfall 5: Toggle State Location vs. Toggle Button Location

**What goes wrong:** The toggle button is in `FormPanel` header (D-03), but the rendered panel column is in `AppLayout` (D-01). If `isBlockLibraryOpen` state is kept in `FormPanel`, `AppLayout` cannot react to it to render the panel column.

**Why it happens:** State is co-located with the trigger (FormPanel) rather than with the output (AppLayout).

**How to avoid:** `isBlockLibraryOpen` state and `setIsBlockLibraryOpen` must live in `AppLayout`. Pass `onToggleBlockLibrary` as a prop to `FormPanel` so the toggle button can call it. See Open Questions below for the Zustand slice alternative.

**Warning signs:** Toggle button clicks don't open the panel, or the panel opens without the button reflecting active state.

---

## Code Examples

### Block Store: CRUD Actions

```typescript
// Source: src/stores/useHistoryStore.ts — pattern being replicated

// addBlock (immutable — spread to new array, prepend or append per UX preference)
addBlock: async (block) => {
  if (!get().blocksLoaded) return;
  const updated = [...get().blocks, block]; // append (chronological order)
  set({ blocks: updated });
  await persistBlocks(updated);
},

// updateBlock (immutable map)
updateBlock: async (id, updates) => {
  if (!get().blocksLoaded) return;
  const updated = get().blocks.map((b) =>
    b.id === id ? { ...b, ...updates } : b
  );
  set({ blocks: updated });
  await persistBlocks(updated);
},

// deleteBlock (immutable filter)
deleteBlock: async (id) => {
  if (!get().blocksLoaded) return;
  const updated = get().blocks.filter((b) => b.id !== id);
  set({ blocks: updated });
  await persistBlocks(updated);
},
```

### Block List View: Hydration Gate + Empty State

```tsx
// Source: UI-SPEC.md §Hydration gate (View 1)
{blocksLoaded && blocks.length === 0 && (
  <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
    <p className="text-sm text-muted-foreground font-medium">No blocks yet</p>
    <p className="text-xs text-muted-foreground text-center">
      Save JSON snippets you can reuse across messages.
    </p>
  </div>
)}
{blocksLoaded && blocks.map((block) => (
  <div key={block.id} className="px-3 py-2 flex items-center justify-between hover:bg-muted rounded-sm">
    <span className="text-sm truncate flex-1">{block.name}</span>
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${block.name}`}
        onClick={() => onEdit(block)}>
        <Pencil size={14} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${block.name}`}
        onClick={() => onDeleteRequest(block)}>
        <Trash2 size={14} />
      </Button>
    </div>
  </div>
))}
```

### AlertDialog Delete Confirmation

```tsx
// Source: src/components/ui/alert-dialog.tsx (already installed)
<AlertDialog open={!!blockToDelete} onOpenChange={() => setBlockToDelete(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "{blockToDelete?.name}"?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep block</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={() => { deleteBlock(blockToDelete!.id); setBlockToDelete(null); }}>
        Delete block
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tauri-plugin-store v1 | tauri-plugin-store v2 (`load()` API) | Tauri 2.x | `v1` plugins incompatible; use `load()` not `Store` constructor |
| `tailwind.config.js` | CSS `@import` (Tailwind 4) | Tailwind 4.x | Config file removed; already addressed in project setup |
| `uuid` npm package for IDs | `crypto.randomUUID()` | Browser baseline | Established project pattern; no dep needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `AlertDialogAction` component accepts a `className` override for destructive styling | Code Examples | Minor visual inconsistency; fallback: use Button with variant=destructive inside AlertDialog footer |

All other claims are verified against the codebase or CONTEXT.md/UI-SPEC.md.

---

## Open Questions (RESOLVED)

1. **Toggle state placement: prop-threading vs. Zustand slice**
   - What we know: `isBlockLibraryOpen` must live in `AppLayout` (D-01, D-04 says session-only, not persisted). The toggle button lives in `FormPanel` header (D-03).
   - What's unclear: Should `AppLayout` pass `onToggleBlockLibrary` + `isBlockLibraryOpen` as props to `FormPanel`, or should a minimal Zustand UI slice (e.g., `useUIStore`) hold this state so both components can access it without prop-threading?
   - Recommendation: Prop-threading is simpler and consistent with YAGNI (the toggle is a single boolean, one level deep). Introduce a Zustand UI slice only if a second consumer emerges. The planner should pick one approach and be consistent.
   - **RESOLVED: Prop-threading chosen.** `isBlockLibraryOpen` state and `setIsBlockLibraryOpen` live in `AppLayout`; `onToggleBlockLibrary` callback and `isBlockLibraryOpen` flag are passed as props to `FormPanel`. Plan 11-03 Task 1 (AppLayout) and Task 2 (FormPanel) implement this pattern exactly. No Zustand UI slice introduced.

2. **`PublishBar` position relative to block panel**
   - What we know: UI-SPEC Layout Contract shows `PublishBar` above the `flex row` of panel + FormPanel.
   - What's unclear: In current `AppLayout`, `PublishBar` is a direct child of `<main>` flex-col. When `<main>` becomes a flex-row container for the block panel + FormPanel, `PublishBar` must stay above both.
   - Recommendation: Wrap the panel + FormPanel in a nested `div` with `flex-1 flex flex-row min-h-0` inside `<main>` (which remains `flex-col`). `PublishBar` stays as the first child of `<main>`. See Pattern 3 code example above.
   - **RESOLVED: PublishBar stays above the flex row.** `<main>` remains `flex-col`; `<PublishBar />` is its first child; a nested `<div className="flex-1 flex flex-row min-h-0">` wraps `<BlockLibraryPanel>` and `<FormPanel>`. Plan 11-03 Task 1 implements this exact structure.

---

## Environment Availability

SKIPPED — this phase makes no external runtime dependencies. All required packages are already installed in `package.json`. No CLI tools, databases, or services are accessed at build or test time beyond the existing Vitest + jsdom setup.

---

## Sources

### Primary (HIGH confidence)

- `src/stores/useHistoryStore.ts` — tauri-plugin-store pattern; `useBlockStore` is a direct replication
- `src/components/form/JsonEditor.tsx` — CodeMirror usage pattern for block editor
- `src/components/form/FormPanel.tsx` — header structure (toggle button placement, CR-01 JSON object guard, CodeMirror/ScrollArea pitfall comment)
- `src/components/layout/AppLayout.tsx` — current layout structure for integration
- `src/App.tsx` — app-mount effect pattern for `loadBlocks()`
- `src/components/form/__tests__/FormPanel.test.tsx` — CodeMirror mock pattern
- `src/stores/useHistoryStore.test.ts` — tauri-plugin-store mock pattern with `vi.hoisted`
- `package.json` — all library versions verified

### Secondary (MEDIUM confidence)

- `.planning/phases/11-block-library-store-editor-persistence/11-CONTEXT.md` — all 12 locked decisions
- `.planning/phases/11-block-library-store-editor-persistence/11-UI-SPEC.md` — component inventory, copywriting contract, interaction states

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified in package.json; no new dependencies
- Architecture: HIGH — direct replication of established codebase patterns; all integration points identified
- Pitfalls: HIGH — all pitfalls sourced from existing codebase comments and patterns

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable stack; Tauri 2 + Zustand 5 are current)
