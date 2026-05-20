# Phase 11: Block Library — Store, Editor, Persistence - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/useBlockStore.ts` | store | CRUD | `src/stores/useHistoryStore.ts` | exact |
| `src/stores/useBlockStore.test.ts` | test | CRUD | `src/stores/useHistoryStore.test.ts` | exact |
| `src/components/blocks/BlockLibraryPanel.tsx` | component | event-driven (view switch) | `src/components/connection/ProfileManagementModal.tsx` | role-match (two-view list+form CRUD panel) |
| `src/components/blocks/BlockListView.tsx` *(optional extract)* | component | CRUD list | `src/components/connection/ProfileManagementModal.tsx` lines 234–273 | role-match |
| `src/components/blocks/BlockEditorView.tsx` *(optional extract)* | component | form/draft | `src/components/publish/AmqpPropertiesSheet.tsx` + `src/components/form/JsonEditor.tsx` | role-match (composite) |
| `src/components/layout/AppLayout.tsx` | layout | n/a | itself — modification of existing file | self-analog |
| `src/components/form/FormPanel.tsx` | component | n/a | itself — modification of existing header | self-analog |
| `src/App.tsx` | bootstrap | mount-effect | `src/components/history/MessageHistoryPanel.tsx` lines 19–23 | role-match |

> **Note on `App.tsx`:** Research claims `loadHistory()` lives in `App.tsx`. It does not — it is called lazily inside `MessageHistoryPanel` (lines 19–23) with a `if (!historyLoaded)` guard. `loadBlocks()` must follow the same lazy-load-on-panel-mount pattern, not a global `App.tsx` effect. The planner should wire `loadBlocks()` inside `BlockLibraryPanel`'s mount effect, not in `App.tsx`.

---

## Pattern Assignments

### `src/stores/useBlockStore.ts` (store, CRUD)

**Analog:** `src/stores/useHistoryStore.ts`
**Match:** Exact — same library (`zustand` + `tauri-plugin-store`), same hydration gate, same immutable CRUD pattern.

**Imports pattern** (`useHistoryStore.ts` lines 1–2):
```typescript
import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
```

**Store constants pattern** (`useHistoryStore.ts` lines 4–6):
```typescript
const HISTORY_STORE_PATH = "history.json";
const HISTORY_KEY = "entries";
```
Copy this: change to `"blocks.json"` and `"blocks"`.

**Persist helper pattern** (`useHistoryStore.ts` lines 28–34):
```typescript
async function persistEntries(entries: HistoryEntry[]): Promise<void> {
  // NEVER use autoSave: true — always call .save() explicitly.
  // Note: load() without options works; passing { autoSave: false } requires 'defaults' field.
  const store = await load(HISTORY_STORE_PATH);
  await store.set(HISTORY_KEY, entries);
  await store.save();
}
```

**Hydration pattern** (`useHistoryStore.ts` lines 40–44):
```typescript
loadHistory: async () => {
  const store = await load(HISTORY_STORE_PATH);
  const saved = await store.get<HistoryEntry[]>(HISTORY_KEY);
  set({ entries: saved ?? [], historyLoaded: true });
},
```

**Hydration guard pattern** (`useHistoryStore.ts` lines 46–56):
```typescript
appendEntry: async (entry) => {
  // Guard: do not write before async store hydration completes
  if (!get().historyLoaded) return;
  const current = get().entries;
  const updated = [entry, ...current].slice(0, MAX_ENTRIES);
  set({ entries: updated });
  await persistEntries(updated);
},
```
Every CRUD action (`addBlock`, `updateBlock`, `deleteBlock`) must open with `if (!get().blocksLoaded) return;`.

**Block-specific additions** (no direct analog — from RESEARCH.md `D-11`):
```typescript
export interface Block {
  id: string;      // crypto.randomUUID() — no uuid dep needed
  name: string;
  content: string; // raw JSON string — NOT parsed here; parsing happens at apply time (Phase 12)
}
```

**`updateBlock` immutable map pattern** (no analog in history store — inferred from `useHistoryStore.clearHistory` + coding-style.md):
```typescript
updateBlock: async (id, updates) => {
  if (!get().blocksLoaded) return;
  const updated = get().blocks.map((b) =>
    b.id === id ? { ...b, ...updates } : b
  );
  set({ blocks: updated });
  await persistBlocks(updated);
},
```

**`deleteBlock` immutable filter pattern**:
```typescript
deleteBlock: async (id) => {
  if (!get().blocksLoaded) return;
  const updated = get().blocks.filter((b) => b.id !== id);
  set({ blocks: updated });
  await persistBlocks(updated);
},
```

---

### `src/stores/useBlockStore.test.ts` (test, CRUD)

**Analog:** `src/stores/useHistoryStore.test.ts`
**Match:** Exact — same `vi.hoisted` mock setup, same `beforeEach` reset, same describe/test structure.

**vi.hoisted mock setup** (`useHistoryStore.test.ts` lines 4–14):
```typescript
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

**beforeEach reset pattern** (`useHistoryStore.test.ts` lines 32–38):
```typescript
beforeEach(() => {
  // Reset store state to prevent Zustand singleton bleed across tests
  useHistoryStore.setState({ entries: [], historyLoaded: false });
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
});
```
Change to `useBlockStore.setState({ blocks: [], blocksLoaded: false })`.

**Guard test pattern** (`useHistoryStore.test.ts` lines 43–48):
```typescript
test("appendEntry when historyLoaded===false returns early (race guard)", async () => {
  const entry = makeEntry({ id: "guarded-entry" });
  await useHistoryStore.getState().appendEntry(entry);
  expect(useHistoryStore.getState().entries).toHaveLength(0);
});
```
Replicate for `addBlock`, `updateBlock`, `deleteBlock`.

**Persist-calls test pattern** (`useHistoryStore.test.ts` lines 80–86):
```typescript
test("appendEntry calls store.set and store.save after updating state", async () => {
  useHistoryStore.setState({ historyLoaded: true });
  const entry = makeEntry({ id: "persist-test" });
  await useHistoryStore.getState().appendEntry(entry);
  expect(mockSet).toHaveBeenCalledOnce();
  expect(mockSave).toHaveBeenCalledOnce();
});
```

---

### `src/components/blocks/BlockLibraryPanel.tsx` (component, event-driven view switch)

**Primary analog:** `src/components/connection/ProfileManagementModal.tsx`
**Secondary analog:** `src/components/form/FormPanel.tsx` (header structure with icon button)
**Match:** Role-match — `ProfileManagementModal` is the only existing component with a two-view `"list" | "create" | "edit"` internal state pattern backed by CRUD actions and an AlertDialog delete confirmation.

**Key divergence from analog:** `BlockLibraryPanel` is a panel column (not a Dialog wrapper), uses `useBlockStore` (Zustand) instead of IPC calls, and uses `size="icon-sm"` buttons per UI-SPEC rather than `size="icon"` / `size="sm"`.

**Two-view state pattern** (`ProfileManagementModal.tsx` lines 58–63):
```typescript
const [formMode, setFormMode] = useState<"list" | "create" | "edit">("list");
const [formValues, setFormValues] = useState<ProfileFormValues>(DEFAULT_FORM_VALUES);
const [error, setError] = useState<string | null>(null);
const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
```
Block equivalent: `formMode` → `view: "list" | "editor"`, `formValues` → `nameDraft` + `contentDraft`, `deleteTarget` → `blockToDelete: Block | null`.

**handleShowNewForm pattern** (`ProfileManagementModal.tsx` lines 65–71):
```typescript
const handleShowNewForm = () => {
  setFormValues(DEFAULT_FORM_VALUES);
  setError(null);
  setFormMode("create");
};
```
Block equivalent: reset `nameDraft("")`, `contentDraft("{}")`, `saveError(null)`, switch `view` to `"editor"`.

**handleShowEditForm pattern** (`ProfileManagementModal.tsx` lines 73–88):
```typescript
const handleShowEditForm = (profile: ConnectionProfile) => {
  setFormValues({ name: profile.name, ... });
  setError(null);
  setFormMode("edit");
};
```
Block equivalent: set `nameDraft(block.name)`, `contentDraft(block.content)`, switch `view` to `"editor"`.

**handleCancel pattern** (`ProfileManagementModal.tsx` lines 90–95):
```typescript
const handleCancel = () => {
  setFormMode("list");
  setError(null);
};
```
Block equivalent: reset `view` to `"list"`, clear draft state.

**List row structure** (`ProfileManagementModal.tsx` lines 238–262):
```tsx
{profiles.map((profile) => (
  <div
    key={profile.name}
    className="flex items-center justify-between rounded-md border px-3 py-2"
  >
    <span className="text-sm font-medium">{profile.name}</span>
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon"
        onClick={() => handleShowEditForm(profile)}
        aria-label={`Edit profile ${profile.name}`}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm"
        onClick={() => setDeleteTarget(profile.name)}
        aria-label={`Delete profile ${profile.name}`}>
        Delete
      </Button>
    </div>
  </div>
))}
```
Block equivalent (per UI-SPEC): change `size="icon"` → `size="icon-sm"`, remove border from row, use `hover:bg-muted rounded-sm`, add `Trash2` icon button instead of text "Delete" button, use `px-3 py-2` (matches `FormPanel` header rhythm). Add `truncate flex-1` on the name span.

**AlertDialog delete pattern** (`ProfileManagementModal.tsx` lines 388–404):
```tsx
<AlertDialog
  open={deleteTarget !== null}
  onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Profile</AlertDialogTitle>
      <AlertDialogDescription>
        Delete {deleteTarget}? This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep Profile</AlertDialogCancel>
      <AlertDialogAction onClick={handleDeleteConfirm}>
        Delete Profile
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
Block equivalent: `deleteTarget` → `blockToDelete: Block | null`. Copy title/description/button copy verbatim from UI-SPEC copywriting contract. Note: `AlertDialogAction` renders as a `Button` via `asChild` — pass `variant="destructive"` prop to get destructive styling (see `src/components/ui/alert-dialog.tsx` lines 148–163).

**handleDeleteConfirm pattern** (`ProfileManagementModal.tsx` lines 210–222):
```typescript
const handleDeleteConfirm = async () => {
  if (!deleteTarget) return;
  try {
    await deleteProfile(deleteTarget);
    const updated = await listProfiles();
    setProfiles(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
  } finally {
    setDeleteTarget(null);
  }
};
```
Block equivalent: `deleteBlock(blockToDelete.id)` from `useBlockStore`, then `setBlockToDelete(null)`. No async error catch needed — `useBlockStore.deleteBlock` is fire-and-forget for UI (errors logged by Tauri).

**Lazy-load-on-mount pattern** (`src/components/history/MessageHistoryPanel.tsx` lines 19–23):
```typescript
useEffect(() => {
  if (!historyLoaded) {
    void loadHistory();
  }
}, [historyLoaded, loadHistory]);
```
Block equivalent: call `loadBlocks()` from `useBlockStore` inside `BlockLibraryPanel`'s mount effect. Do NOT wire to `App.tsx` — `loadHistory()` is not wired there either.

**Panel container structure** (from `FormPanel.tsx` lines 187–188):
```tsx
<div className="flex-1 flex flex-col min-h-0">
  <div className="px-4 py-3 border-b border-border shrink-0 flex items-start justify-between">
```
Block panel equivalent: fixed-width column, no `flex-1`. Use `w-64 flex flex-col h-full border-r border-border` per UI-SPEC Layout Contract.

---

### `src/components/blocks/BlockEditorView.tsx` (component, form/draft)

**Primary analog:** `src/components/publish/AmqpPropertiesSheet.tsx` lines 35–54 (local draft state pattern)
**Secondary analog:** `src/components/form/JsonEditor.tsx` (CodeMirror usage)

**Local draft state pattern** (`AmqpPropertiesSheet.tsx` lines 35–54):
```typescript
// LOCAL DRAFT STATE — does NOT mutate store until Save is clicked
const [draft, setDraft] = useState<AmqpProperties>(
  () => useAmqpStore.getState().properties
);
const [ttlError, setTtlError] = useState<string | null>(null);

// Re-sync draft when panel opens (shows current committed values)
useEffect(() => {
  if (open) {
    setDraft(useAmqpStore.getState().properties);
    setTtlError(null);
  }
}, [open]);
```
Block equivalent: `nameDraft`, `contentDraft`, `saveError` as local `useState`. Initialize from `block?.name ?? ""` and `block?.content ?? "{}"`. No re-sync effect needed (editor is unmounted/remounted on each view switch).

**JSON object validation pattern** (`FormPanel.tsx` lines 130–137 — CR-01):
```typescript
// CR-01: guard against valid but non-object JSON (null, arrays, primitives)
const raw: unknown = JSON.parse(jsonDraft);
if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
  setParseError("JSON must be an object, not a primitive or array");
  return;
}
```
Block equivalent: same check in `handleSave`. Also catch `JSON.parse` throw for invalid JSON (see `FormPanel.tsx` lines 130–142).

**Error banner structure** (`JsonEditor.tsx` lines 40–63):
```tsx
{parseError && (
  <div className="mx-4 mt-2 mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
    <div className="flex items-start gap-2">
      <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-destructive">
          Invalid JSON
        </span>
        <p className="text-xs text-destructive mt-1" role="alert">
          {parseError}
        </p>
      </div>
    </div>
  </div>
)}
```
Block equivalent: reuse same structure. Remove "Fix JSON" / "Discard changes" buttons — block editor error is inline-only; user corrects in place and re-clicks Save.

**CodeMirror usage pattern** (`JsonEditor.tsx` lines 31–39):
```tsx
<CodeMirror
  value={value}
  height="100%"
  theme={resolvedTheme === "dark" ? "dark" : "light"}
  extensions={[json()]}
  onChange={onChange}
  className="flex-1 min-h-0"
  basicSetup={{ lineNumbers: true, bracketMatching: true }}
/>
```
Copy exactly. Pass `resolvedTheme` from `useTheme()`. Wrap the editor in `<div className="flex-1 flex flex-col min-h-0">` — do NOT put inside ScrollArea (FormPanel.tsx line 207 comment).

**useTheme import pattern** (`FormPanel.tsx` lines 11–12):
```typescript
import { useTheme } from "next-themes";
// ...
const { resolvedTheme } = useTheme();
```

---

### `src/components/layout/AppLayout.tsx` (layout, modification)

**Analog:** itself — current file is the baseline; Pattern 3 from RESEARCH.md defines the change.

**Current structure** (`AppLayout.tsx` lines 6–26):
```tsx
export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="w-72 min-w-60 max-w-xs border-r border-border flex flex-col shrink-0">
        <Sidebar />
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <PublishBar />
        <FormPanel />
      </main>
      <aside className="w-80 min-w-64 border-l border-border flex flex-col shrink-0">
        <RightPanel />
      </aside>
    </div>
  );
}
```

**Required modification:**
- Add `const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false)` (local state, D-04)
- Wrap `<FormPanel />` in a `<div className="flex-1 flex flex-row min-h-0">` that also contains the conditional `<BlockLibraryPanel>`
- Pass `onToggleBlockLibrary` prop to `FormPanel`
- `<PublishBar />` stays as a sibling above the new flex-row div inside `<main>`

**Prop-threading toggle pattern** (D-03/D-04 decision + Pitfall 5 in RESEARCH.md):
```tsx
const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);

// Inside <main>:
<main className="flex-1 flex flex-col overflow-hidden">
  <PublishBar />
  <div className="flex-1 flex flex-row min-h-0">
    {isBlockLibraryOpen && (
      <BlockLibraryPanel onClose={() => setIsBlockLibraryOpen(false)} />
    )}
    <FormPanel
      isBlockLibraryOpen={isBlockLibraryOpen}
      onToggleBlockLibrary={() => setIsBlockLibraryOpen((v) => !v)}
    />
  </div>
</main>
```

---

### `src/components/form/FormPanel.tsx` (component, modification)

**Analog:** itself — the existing Braces button in the header (lines 193–204) is the direct pattern for the new Library toggle button.

**Existing toggle button pattern** (`FormPanel.tsx` lines 193–204):
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  aria-label={isJsonMode ? "Return to form" : "Edit as JSON"}
  aria-pressed={isJsonMode}
  title={isJsonMode ? "Return to form" : "Edit as JSON"}
  className={isJsonMode ? "bg-muted text-foreground" : ""}
  onClick={handleToggle}
>
  <Braces />
</Button>
```
Block library toggle: same variant/size. Use `<Library />` from lucide-react. `aria-pressed={isBlockLibraryOpen}`. `className={isBlockLibraryOpen ? "bg-muted text-foreground" : ""}`. Place to the LEFT of the Braces button per D-03.

**Header container** (`FormPanel.tsx` lines 189–205):
```tsx
<div className="px-4 py-3 border-b border-border shrink-0 flex items-start justify-between">
  <div>
    <h2 className="text-sm font-semibold">{message.name}</h2>
    <p className="text-xs text-muted-foreground">{message.full_name}</p>
  </div>
  {/* Right-side buttons: [Library toggle][Braces toggle] */}
  <Button ...>
    <Braces />
  </Button>
</div>
```
Required modification: wrap the right-side buttons in a `<div className="flex items-center gap-1">` and add the Library button before the Braces button.

**New props required on `FormPanel`:**
```typescript
interface FormPanelProps {
  isBlockLibraryOpen: boolean;
  onToggleBlockLibrary: () => void;
}
```

---

### `src/App.tsx` (bootstrap, mount-effect)

**Analog:** `src/components/history/MessageHistoryPanel.tsx` lines 19–23

**Actual load pattern** (`MessageHistoryPanel.tsx` lines 19–23):
```typescript
useEffect(() => {
  if (!historyLoaded) {
    void loadHistory();
  }
}, [historyLoaded, loadHistory]);
```
`loadHistory()` is NOT called from `App.tsx` — it is called lazily inside the panel that owns the data. `loadBlocks()` must follow the same pattern: called from `BlockLibraryPanel`'s mount effect, not from `App.tsx`. The RESEARCH.md Pattern 4 recommendation to wire it in `App.tsx` is incorrect based on the actual codebase pattern. Do not modify `App.tsx` for hydration.

---

## Shared Patterns

### Icon Button (Toggle + Row Actions)
**Source:** `src/components/form/FormPanel.tsx` lines 193–204
**Apply to:** `FormPanel.tsx` (Library toggle), `BlockLibraryPanel.tsx` / `BlockListView.tsx` (Edit/Delete row buttons), `BlockEditorView.tsx` (Back button)
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  aria-label="..."
  aria-pressed={boolean}   // only for toggle buttons
  className={active ? "bg-muted text-foreground" : ""}
  onClick={handler}
>
  <Icon />  {/* lucide-react icon */}
</Button>
```
Note: `size="icon-sm"` is the project standard for panel header icon buttons. The `ProfileManagementModal` uses `size="icon"` — this is a divergence; follow UI-SPEC which specifies `size="icon-sm"`.

### Immutable Zustand State Updates
**Source:** `src/stores/useHistoryStore.ts` lines 51–55
**Apply to:** `useBlockStore.ts` all CRUD actions
```typescript
// Spread into new array — NEVER mutate in place
const updated = [...get().blocks, block];
set({ blocks: updated });
```

### Error Narrowing Pattern
**Source:** `src/components/connection/ProfileManagementModal.tsx` lines 217–219
**Apply to:** `BlockEditorView.tsx` JSON parse catch, `BlockLibraryPanel.tsx` deleteConfirm
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  setError(message);
}
```

### ScrollArea for Scrollable Lists
**Source:** `src/components/history/MessageHistoryPanel.tsx` line 3; `src/components/form/FormPanel.tsx` line 219
**Apply to:** `BlockLibraryPanel.tsx` list view body
```tsx
<ScrollArea className="flex-1 min-h-0">
  {/* block list rows */}
</ScrollArea>
```
CRITICAL: ScrollArea is correct for the list. Do NOT wrap CodeMirror in ScrollArea — use `flex-1 flex flex-col min-h-0` instead (FormPanel.tsx line 207 comment).

### AlertDialog Sub-component Import
**Source:** `src/components/connection/ProfileManagementModal.tsx` lines 9–18
**Apply to:** `BlockLibraryPanel.tsx`
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
Note: `AlertDialogAction` accepts `variant` prop directly (wraps `Button` via `asChild`). Pass `variant="destructive"` for the Delete button — see `alert-dialog.tsx` lines 148–163.

### Vitest CodeMirror Mock
**Source:** `src/components/form/__tests__/FormPanel.test.tsx` lines 11–25
**Apply to:** Every test file rendering `BlockEditorView` or `BlockLibraryPanel`
```typescript
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

---

## No Analog Found

All files have at least a role-match analog. No files lack a pattern reference.

---

## Critical Deviations from Research.md

| Claim in RESEARCH.md | Actual Codebase Behavior | Impact |
|---------------------|--------------------------|--------|
| `loadBlocks()` called in `App.tsx` mount effect (Pattern 4) | `loadHistory()` is called lazily in `MessageHistoryPanel` (lines 19–23), NOT in `App.tsx` | Planner must wire `loadBlocks()` in `BlockLibraryPanel` mount effect, not `App.tsx` |
| AlertDialog described without a consumer analog | `ProfileManagementModal.tsx` is the real AlertDialog consumer with the exact two-view CRUD pattern | `ProfileManagementModal.tsx` is the primary analog for `BlockLibraryPanel` |
| No mention of `size="icon-sm"` vs `size="icon"` divergence | `ProfileManagementModal` uses `size="icon"` but UI-SPEC mandates `size="icon-sm"` | Follow UI-SPEC, not the modal analog, for button sizing |

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/App.tsx`
**Files scanned:** 8 primary analogs read; full file list reviewed for classification
**Pattern extraction date:** 2026-05-19
