# Phase 3: Full Feature Set — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 15 (8 new, 7 modified)
**Analogs found:** 13 / 15 (2 with no codebase analog — see No Analog Found section)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/useAmqpStore.ts` | store | request-response | `src/stores/useConnectionStore.ts` | exact |
| `src/stores/useHistoryStore.ts` | store | CRUD + file-I/O | `src/stores/useConnectionStore.ts` + `src/components/sidebar/FileSection.tsx` | role-match |
| `src/components/layout/RightPanel.tsx` | component | request-response | `src/components/preview/HexPreviewPanel.tsx` | partial (header pattern) |
| `src/components/history/MessageHistoryPanel.tsx` | component | CRUD | `src/components/preview/HexPreviewPanel.tsx` | role-match |
| `src/components/history/HistoryFilterBar.tsx` | component | transform | `src/components/publish/PublishBar.tsx` (Input usage) | partial |
| `src/components/history/HistoryTable.tsx` | component | CRUD | no analog — Table is new | none |
| `src/components/history/HexViewDialog.tsx` | component | request-response | `src/components/include-paths/IncludePathDialog.tsx` | exact (dialog structure) |
| `src/components/publish/AmqpPropertiesSheet.tsx` | component | request-response | `src/components/include-paths/IncludePathDialog.tsx` | role-match (form-modal + footer Apply/Reset) |
| `src/stores/useProtoStore.ts` (modify) | store | CRUD | self (current file) | exact |
| `src/components/layout/AppLayout.tsx` (modify) | component | request-response | self (current file) | exact |
| `src/components/sidebar/FileSection.tsx` (modify) | component | file-I/O | self (current file) | exact |
| `src/components/form/fields/WellKnownTypeField.tsx` (modify) | component | transform | self (current file) | exact |
| `src/components/publish/PublishBar.tsx` (modify) | component | request-response | self (current file) | exact |
| `src/lib/ipc.ts` (modify) | utility | request-response | self (current file) | exact |
| `src-tauri/src/commands/publish.rs` (modify) | command | request-response | self (current file) | exact |

---

## Pattern Assignments

### `src/stores/useAmqpStore.ts` (store, request-response)

**Analog:** `src/stores/useConnectionStore.ts` — exact copy of structure

**Full analog for reference** (`src/stores/useConnectionStore.ts` lines 1–47):
```typescript
import { create } from "zustand";
import type { ConnectionProfile, ConnectionStatus, ManagementStatus } from "@/lib/types";

interface ConnectionStore {
  profiles: ConnectionProfile[];
  activeProfileName: string | null;
  // ...state fields
  setProfiles: (profiles: ConnectionProfile[]) => void;
  // ...setters
  reset: () => void;
}

const INITIAL_STATE = {
  profiles: [] as ConnectionProfile[],
  activeProfileName: null as string | null,
  // ...initial values
} as const;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...INITIAL_STATE,
  setProfiles: (profiles) => set({ profiles }),
  // ...setters
  reset: () => set({ ...INITIAL_STATE }),
}));
```

**Implementation for `useAmqpStore.ts`** (follow this pattern exactly):
```typescript
import { create } from "zustand";

interface AmqpProperties {
  contentType: string;
  deliveryMode: 1 | 2;
  ttl: string;          // empty string = not set
  correlationId: string;
  replyTo: string;
  headers: Array<{ key: string; value: string }>;
}

interface AmqpStore {
  properties: AmqpProperties;
  setProperties: (props: AmqpProperties) => void;
  reset: () => void;
}

const INITIAL_STATE: AmqpProperties = {
  contentType: "application/octet-stream",
  deliveryMode: 2,
  ttl: "",
  correlationId: "",
  replyTo: "",
  headers: [],
};

export const useAmqpStore = create<AmqpStore>((set) => ({
  properties: INITIAL_STATE,
  setProperties: (props) => set({ properties: props }),
  reset: () => set({ properties: INITIAL_STATE }),
}));
```

**Note:** Session-only (D-04) — no `tauri-plugin-store` persistence needed. `INITIAL_STATE` is declared as a regular `const` object (not `as const`) because the typed literal `1 | 2` on `deliveryMode` is enforced at the interface level.

---

### `src/stores/useHistoryStore.ts` (store, CRUD + file-I/O)

**Analogs:**
- Store shape: `src/stores/useConnectionStore.ts` lines 1–47
- Persistence (tauri-plugin-store): `src/components/sidebar/FileSection.tsx` lines 9, 48–51, 67–69

**Store shape pattern** (from `useConnectionStore.ts` lines 35–47):
```typescript
export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...INITIAL_STATE,
  setProfiles: (profiles) => set({ profiles }),
  reset: () => set({ ...INITIAL_STATE }),
}));
```

**Persistence pattern** (`src/components/sidebar/FileSection.tsx` lines 9, 48–51, 67–69):
```typescript
// Line 9
const STORE_PATH = "tap.json";

// Lines 48–51 (load + get)
const store = await load(STORE_PATH);
const savedPaths = await store.get<string[]>(
  `${INCLUDE_PATH_KEY_PREFIX}${selected}`
);

// Lines 67–69 (set + save)
const store = await load(STORE_PATH);
await store.set(`${INCLUDE_PATH_KEY_PREFIX}${pendingFilePath}`, paths);
await store.save();
```

**Implementation pattern for `useHistoryStore.ts`:**
```typescript
import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

// Use separate store file from profiles (D-01 / CONTEXT.md specifics)
const HISTORY_STORE_PATH = "history.json";
const HISTORY_KEY = "history";
const HISTORY_CAP = 100;  // D-02

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

interface HistoryStore {
  entries: HistoryEntry[];
  setEntries: (entries: HistoryEntry[]) => void;
  // appendEntry and loadHistory are async helpers — defined as module-level fns
}

const INITIAL_STATE = {
  entries: [] as HistoryEntry[],
} as const;

export const useHistoryStore = create<HistoryStore>((set) => ({
  ...INITIAL_STATE,
  setEntries: (entries) => set({ entries }),
}));

// Persistence helpers (called from components, not inside create())
export async function appendHistoryEntry(entry: HistoryEntry): Promise<void> {
  const store = await load(HISTORY_STORE_PATH, { autoSave: false });
  const existing = (await store.get<HistoryEntry[]>(HISTORY_KEY)) ?? [];
  const updated = [entry, ...existing].slice(0, HISTORY_CAP);  // immutable prepend + cap
  await store.set(HISTORY_KEY, updated);
  await store.save();
  useHistoryStore.getState().setEntries(updated);
}

export async function loadHistory(): Promise<void> {
  const store = await load(HISTORY_STORE_PATH, { autoSave: false });
  const entries = (await store.get<HistoryEntry[]>(HISTORY_KEY)) ?? [];
  useHistoryStore.getState().setEntries(entries);
}
```

**Dual-representation note:** History has two layers — persisted in `history.json` via `tauri-plugin-store`, and mirrored in Zustand for reactive UI. The load/sync mechanism (when `loadHistory()` is called, how Zustand stays in sync on write) is a planner-decides detail. The pattern above shows one viable approach; the planner chooses the exact initialization point. Natural call site: `App.tsx` `useEffect(() => { void loadHistory(); }, [])` on mount — parallel to how `listProfiles` is likely called in `ConnectionSection`.

**Immutability rule (global coding-style):** Always `[entry, ...existing].slice(0, HISTORY_CAP)` — never `existing.unshift(entry)`.

---

### `src/components/layout/RightPanel.tsx` (component, request-response)

**Analog:** `src/components/preview/HexPreviewPanel.tsx` — panel composition and header pattern (lines 5–17); Tabs is new (no codebase analog — see No Analog Found).

**Panel header + composition pattern** (`src/components/preview/HexPreviewPanel.tsx` lines 5–17):
```typescript
export function HexPreviewPanel() {
  const { hexPreview, isEncoding, encodeError } = useProtoStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Hex Preview</h2>
        {isEncoding && (
          <span className="text-xs text-muted-foreground animate-pulse">
            encoding...
          </span>
        )}
      </div>
      // ...content
    </div>
  );
}
```

**`RightPanel.tsx` implementation pattern:**
```typescript
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HexPreviewPanel } from "@/components/preview/HexPreviewPanel";
import { MessageHistoryPanel } from "@/components/history/MessageHistoryPanel";

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<"hex" | "history">("hex");
  // Pitfall 6 from RESEARCH.md: userManualTab MUST be local state, not global store
  const [userManualTab, setUserManualTab] = useState(false);

  // Called from outside (e.g., PublishBar) to auto-switch to History after send
  // Only switches if user hasn't manually selected Hex
  const handleAutoSwitchToHistory = () => {
    if (!userManualTab) {
      setActiveTab("history");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as "hex" | "history");
        setUserManualTab(true);
      }} className="flex flex-col h-full">
        <TabsList className="border-b border-border rounded-none px-4">
          <TabsTrigger value="hex" className="text-sm font-semibold">Hex</TabsTrigger>
          <TabsTrigger value="history" className="text-sm font-semibold">History</TabsTrigger>
        </TabsList>
        <TabsContent value="hex" className="flex-1 overflow-hidden mt-0">
          <HexPreviewPanel />
        </TabsContent>
        <TabsContent value="history" className="flex-1 overflow-hidden mt-0">
          <MessageHistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**`AppLayout.tsx` modification** (`src/components/layout/AppLayout.tsx` lines 21–23 — replace right aside):
```typescript
// Before (line 21–23):
<aside className="w-80 min-w-64 border-l border-border flex flex-col shrink-0">
  <HexPreviewPanel />
</aside>

// After:
<aside className="w-80 min-w-64 border-l border-border flex flex-col shrink-0">
  <RightPanel />
</aside>
```

---

### `src/components/history/MessageHistoryPanel.tsx` (component, CRUD)

**Analog:** `src/components/preview/HexPreviewPanel.tsx` — right-panel composition using Zustand store (lines 1–42)

**Panel composition pattern** (`HexPreviewPanel.tsx` lines 1–42):
```typescript
import { useProtoStore } from "@/stores/useProtoStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function HexPreviewPanel() {
  const { hexPreview, isEncoding, encodeError } = useProtoStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Hex Preview</h2>
        // ...header content
      </div>
      <Separator />
      <ScrollArea className="flex-1 p-4">
        // ...body content
      </ScrollArea>
    </div>
  );
}
```

**`MessageHistoryPanel.tsx` implementation pattern:**
```typescript
import { useState } from "react";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { HistoryTable } from "./HistoryTable";
import { HexViewDialog } from "./HexViewDialog";
import type { HistoryEntry } from "@/stores/useHistoryStore";

export function MessageHistoryPanel() {
  const { entries } = useHistoryStore();
  const [typeFilter, setTypeFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [hexEntry, setHexEntry] = useState<HistoryEntry | null>(null);

  const filtered = entries.filter(
    (e) =>
      e.messageTypeName.toLowerCase().includes(typeFilter.toLowerCase()) &&
      (e.exchange + e.routingKey).toLowerCase().includes(targetFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <HistoryFilterBar
        typeFilter={typeFilter}
        targetFilter={targetFilter}
        onTypeFilterChange={setTypeFilter}
        onTargetFilterChange={setTargetFilter}
      />
      <HistoryTable
        entries={filtered}
        onHexView={(entry) => setHexEntry(entry)}
      />
      <HexViewDialog
        entry={hexEntry}
        open={!!hexEntry}
        onClose={() => setHexEntry(null)}
      />
    </div>
  );
}
```

---

### `src/components/history/HistoryFilterBar.tsx` (component, transform)

**Analog:** `src/components/publish/PublishBar.tsx` — Input usage pattern (lines 232–244)

**Input usage pattern** (`PublishBar.tsx` lines 232–244):
```typescript
<Input
  placeholder={mode === "queue" ? "Queue name" : "Exchange name"}
  className="w-48"
  value={mode === "queue" ? selectedQueue : selectedExchange}
  onChange={(e) =>
    mode === "queue"
      ? setSelectedQueue(e.target.value)
      : setSelectedExchange(e.target.value)
  }
/>
```

**`HistoryFilterBar.tsx` implementation pattern:**
```typescript
import { Input } from "@/components/ui/input";

interface HistoryFilterBarProps {
  typeFilter: string;
  targetFilter: string;
  onTypeFilterChange: (value: string) => void;
  onTargetFilterChange: (value: string) => void;
}

export function HistoryFilterBar({
  typeFilter,
  targetFilter,
  onTypeFilterChange,
  onTargetFilterChange,
}: HistoryFilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
      <Input
        className="h-7 text-xs"
        placeholder="Filter by type…"
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value)}
      />
      <Input
        className="h-7 text-xs"
        placeholder="Filter by queue/exchange…"
        value={targetFilter}
        onChange={(e) => onTargetFilterChange(e.target.value)}
      />
    </div>
  );
}
```

---

### `src/components/history/HexViewDialog.tsx` (component, request-response)

**Analog:** `src/components/include-paths/IncludePathDialog.tsx` — exact Dialog structure (lines 57–101)

**Dialog structure pattern** (`IncludePathDialog.tsx` lines 57–101):
```typescript
return (
  <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Configure include paths</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">...</p>
      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
        {/* list items */}
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Discard path changes
        </Button>
        <Button type="button" onClick={() => onConfirm(paths)}>
          Load file
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

**`HexViewDialog.tsx` implementation pattern:**
```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/stores/useHistoryStore";

interface HexViewDialogProps {
  entry: HistoryEntry | null;
  open: boolean;
  onClose: () => void;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function HexViewDialog({ entry, open, onClose }: HexViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Binary Payload — {entry?.messageTypeName}</DialogTitle>
          <DialogDescription>
            {entry ? `${new Date(entry.timestamp).toLocaleTimeString()} → ${entry.exchange ? `${entry.exchange} → ${entry.routingKey}` : entry.routingKey}` : ""}
          </DialogDescription>
        </DialogHeader>
        <pre className="text-xs font-mono break-all whitespace-pre-wrap bg-muted rounded p-4 max-h-80 overflow-auto">
          {entry ? bytesToHex(entry.payloadBytes) : ""}
        </pre>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Note:** The `bytesToHex` function mirrors `FormPanel.tsx` line 13 (`bytesToHex`) — inverse of `hexToBytes` in `PublishBar.tsx` lines 47–55. If both live in separate components, extract to `src/lib/utils.ts`.

---

### `src/components/publish/AmqpPropertiesSheet.tsx` (component, request-response)

**Analog:** `src/components/include-paths/IncludePathDialog.tsx` — form-modal with Apply/Cancel footer pattern (lines 57–101)

**Modal footer pattern** (`IncludePathDialog.tsx` lines 91–98):
```typescript
<DialogFooter className="gap-2">
  <Button type="button" variant="ghost" onClick={onCancel}>
    Discard path changes
  </Button>
  <Button type="button" onClick={() => onConfirm(paths)}>
    Load file
  </Button>
</DialogFooter>
```

**Sheet-specific implementation pattern** (Sheet replaces Dialog; side="right"):
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import { useAmqpStore } from "@/stores/useAmqpStore";

interface AmqpPropertiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AmqpPropertiesSheet({ open, onOpenChange }: AmqpPropertiesSheetProps) {
  const { properties, setProperties, reset } = useAmqpStore();
  // local draft state — only committed on "Apply Properties"
  const [draft, setDraft] = useState(properties);

  // Reset draft when sheet opens (dismissing without Apply discards edits)
  useEffect(() => {
    if (open) setDraft(properties);
  }, [open, properties]);

  const handleApply = () => {
    setProperties(draft);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>AMQP Properties</SheetTitle>
          <SheetDescription>Set per-message AMQP properties. Applied on next send.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-6">
          {/* fields using draft state */}
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => setDraft({ ...INITIAL_AMQP_STATE })}>
            Reset to defaults
          </Button>
          <Button variant="default" onClick={handleApply}>
            Apply Properties
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

**Note on "dismiss without apply" (UI-SPEC):** The UI-SPEC states "Sheet dismissed (click outside or Esc) — closes WITHOUT applying changes." The pattern above achieves this by keeping a local `draft` state; `setProperties` is only called from `handleApply`. The Sheet's `onOpenChange` callback fires on outside-click/Esc without touching the store.

---

### `src/stores/useProtoStore.ts` (modify — add multi-proto support)

**Self-analog.** Key pattern is the existing `setFile` action (lines 32–40) — its behavior is preserved but generalized to `addOrActivateFile`.

**Current `setFile` pattern** (`src/stores/useProtoStore.ts` lines 32–40):
```typescript
setFile: (filePath, schema) =>
  set({
    activeFilePath: filePath,
    schema,
    selectedMessageType:
      schema.messages.length > 0 ? schema.messages[0].full_name : null,
    hexPreview: "",
    encodeError: null,
  }),
```

**Expanded store interface** (D-07):
```typescript
interface ProtoStore {
  openFiles: Array<{ filePath: string; schema: ProtoSchema }>;
  activeIndex: number;
  // Transient state (reset on index change — same as current setFile resets)
  selectedMessageType: string | null;
  hexPreview: string;
  isEncoding: boolean;
  encodeError: string | null;
  pendingReplayValues: Record<string, unknown> | null;  // See note below

  addOrActivateFile: (filePath: string, schema: ProtoSchema) => void;
  closeFile: (index: number) => void;
  setActiveIndex: (index: number) => void;
  setSelectedType: (messageType: string) => void;
  setHexPreview: (hex: string) => void;
  setEncoding: (isEncoding: boolean) => void;
  setEncodeError: (error: string | null) => void;
  setPendingReplayValues: (values: Record<string, unknown> | null) => void;
  reset: () => void;
}
```

**`addOrActivateFile` behavior** (mirrors current `setFile` reset behavior):
```typescript
addOrActivateFile: (filePath, schema) =>
  set((state) => {
    const existingIndex = state.openFiles.findIndex(
      (f) => f.filePath === filePath
    );
    if (existingIndex !== -1) {
      // Activate existing tab — reset transient state (D-06: no per-tab type memory)
      return {
        activeIndex: existingIndex,
        selectedMessageType: state.openFiles[existingIndex].schema.messages[0]?.full_name ?? null,
        hexPreview: "",
        encodeError: null,
      };
    }
    // New file — push and activate
    const newFiles = [...state.openFiles, { filePath, schema }];
    return {
      openFiles: newFiles,
      activeIndex: newFiles.length - 1,
      selectedMessageType: schema.messages[0]?.full_name ?? null,
      hexPreview: "",
      encodeError: null,
    };
  }),
```

**`closeFile` empty-state guard** (Pitfall 5 from RESEARCH.md):
```typescript
closeFile: (index) =>
  set((state) => {
    const newFiles = state.openFiles.filter((_, i) => i !== index);
    if (newFiles.length === 0) {
      return {
        openFiles: [],
        activeIndex: -1,
        selectedMessageType: null,
        hexPreview: "",
        encodeError: null,
      };
    }
    const newActive = Math.min(state.activeIndex, newFiles.length - 1);
    const nextSchema = newFiles[newActive].schema;
    return {
      openFiles: newFiles,
      activeIndex: newActive,
      selectedMessageType: nextSchema.messages[0]?.full_name ?? null,
      hexPreview: "",
      encodeError: null,
    };
  }),
```

**`pendingReplayValues` note (ASSUMED — Open Question 3, RESEARCH.md):** Adding `pendingReplayValues: Record<string, unknown> | null` to the store is one mechanism for cross-component `form.reset()` injection (History panel → FormPanel). The planner should evaluate alternatives (React context, callback ref, event emitter) and is not locked to this approach. If chosen, `FormPanel` watches this via `useEffect` and calls `form.reset(pendingReplayValues)` then clears it with `setPendingReplayValues(null)`.

**`FormPanel` empty-state guard** (`src/components/form/FormPanel.tsx` lines 45–51 — already present, verify still covers `openFiles.length === 0`):
```typescript
if (!schema || !selectedMessageType) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Open a .proto file to get started
    </div>
  );
}
```

The planner must confirm that `schema` derived from `openFiles[activeIndex]` returns `null` when `activeIndex === -1` — add a derived getter or guard in all consumers.

---

### `src/components/sidebar/FileSection.tsx` (modify — add multi-proto Tabs)

**Self-analog.** The existing open/parse flow (lines 34–88) is reused for each new tab's `+` button. Tabs wrap this flow without replacing it.

**File open flow to preserve** (`FileSection.tsx` lines 34–88):
```typescript
const handleOpenFile = async () => {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Proto files", extensions: ["proto"] }],
  });
  if (!selected || typeof selected !== "string") return;

  const pathParts = selected.split("/");
  pathParts.pop();
  const parentDir = pathParts.join("/") || "/";

  const store = await load(STORE_PATH);
  const savedPaths = await store.get<string[]>(
    `${INCLUDE_PATH_KEY_PREFIX}${selected}`
  );
  const initialPaths = savedPaths ?? [parentDir];

  setPendingFilePath(selected);
  setPendingIncludePaths(initialPaths);
  setParseError(null);
  setDialogOpen(true);
};

const handleConfirm = async (paths: string[]) => {
  if (!pendingFilePath) return;
  setDialogOpen(false);
  try {
    const store = await load(STORE_PATH);
    await store.set(`${INCLUDE_PATH_KEY_PREFIX}${pendingFilePath}`, paths);
    await store.save();
    const schema = await parseProto(pendingFilePath, paths);
    setFile(pendingFilePath, schema);  // → becomes addOrActivateFile
    setParseError(null);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);  // error-narrowing pattern
    // ...error handling
  }
};
```

**Tabs integration** — `setFile` call on line 72 becomes `addOrActivateFile(pendingFilePath, schema)`. The tab list is derived from `useProtoStore((state) => state.openFiles)`. Closing a tab calls `closeFile(index)`.

**Tab close — no confirmation** (UI-SPEC: "Tab close — last tab: Tab removed instantly, no AlertDialog"):
```typescript
// No AlertDialog needed; action is recoverable with + button
<Button
  variant="ghost"
  size="icon"
  className="h-4 w-4"
  onClick={(e) => { e.stopPropagation(); closeFile(index); }}
  aria-label={`Close ${fileName}`}
>
  ✕
</Button>
```

---

### `src/components/form/fields/WellKnownTypeField.tsx` (modify — PROT-03 placeholder delta)

**Self-analog.** Only the fallback branch changes (lines 104–120). The Timestamp and Duration branches are unchanged.

**Current fallback branch** (`WellKnownTypeField.tsx` lines 104–120):
```typescript
{isFallback && (
  <Controller
    name={path}
    control={control}
    defaultValue=""
    render={({ field: rhfField }) => (
      <Input
        id={path}
        type="text"
        value={rhfField.value as string}
        onChange={rhfField.onChange}
        onBlur={rhfField.onBlur}
        placeholder={`${wkt} value`}  // ← CHANGE THIS
      />
    )}
  />
)}
```

**PROT-03 delta** — update placeholder only:
```typescript
// Determine placeholder based on WKT type
const isJsonWkt = wkt === "Any" || wkt === "Struct";
const placeholder = isJsonWkt ? `${wkt} (JSON)` : `${wkt} value`;

// In the render prop:
placeholder={placeholder}
```

**Badge text** (lines 36–47) — already shows `{wkt}` name via `<Badge>{wkt}</Badge>` at line 46. No change needed.

---

### `src/components/publish/PublishBar.tsx` (modify — wire AMQP props + history)

**Self-analog.** The `handleSend` function (lines 127–163) is the primary integration point.

**Current `handleSend`** (`PublishBar.tsx` lines 127–163):
```typescript
const handleSend = async () => {
  if (!activeProfileName || !canSend) return;

  const targetName = mode === "queue" ? selectedQueue : selectedExchange;
  if (!targetName) return;

  const { exchange, routingKey: targetRoutingKey } = buildPublishArgs(
    mode, selectedQueue, selectedExchange, routingKey,
  );

  if (!hexPreview) {
    toast.error("Send failed: No encoded message. Fill out the form first.");
    return;
  }

  const payload = hexToBytes(hexPreview);  // line 146 — capture BEFORE await

  setIsSending(true);
  try {
    await publishMessage(activeProfileName, exchange, targetRoutingKey, payload);
    toast(`Message sent to ${targetName}`, { duration: 3000 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Send failed: ${message}`, { duration: 5000 });
    setConnectionStatus("error", message);
  } finally {
    setIsSending(false);
  }
};
```

**Extended `handleSend` pattern** (add AMQP props + history capture):
```typescript
const handleSend = async () => {
  if (!activeProfileName || !canSend) return;
  // ...existing guard code...

  // PITFALL 3 (RESEARCH.md): capture payload + fieldValues BEFORE any await
  const payload = hexToBytes(hexPreview);
  // PLANNER-DECIDES (Gap 1): fieldValues must be a snapshot of the current form values.
  // PublishBar has no react-hook-form context — the form state lives in FormPanel.tsx
  // (latestValues local state, line 20) and is NOT exposed to PublishBar.
  // Options (most consistent first):
  //   A. Lift latestValues from FormPanel into useProtoStore (mirrors hexPreview placement)
  //   B. Expose a callback ref from FormPanel to PublishBar via AppLayout or context
  // The planner must choose and document the mechanism before implementing handleSend.
  // Placeholder: const fieldValues = /* TBD */;
  const amqpProps = useAmqpStore.getState().properties;

  setIsSending(true);
  try {
    await publishMessage(activeProfileName, exchange, targetRoutingKey, payload, amqpProps);
    toast(`Message sent to ${targetName}`, { duration: 3000 });
    // Append history entry after successful send
    await appendHistoryEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      messageTypeName: selectedMessageType ?? "",
      exchange,
      routingKey: targetRoutingKey,
      status: "sent",
      fieldValues,
      payloadBytes: payload,
    });
    // PLANNER-DECIDES (Gap 2): Auto-switch RightPanel to History tab after send.
    // RightPanel is a sibling of PublishBar in AppLayout — not a direct parent/child.
    // Options (most consistent first):
    //   A. Add a shared signal in useProtoStore (e.g. lastSendAt: number) that RightPanel
    //      watches via useEffect to trigger its own tab switch.
    //   B. Lift activeTab state up to AppLayout and pass a callback down to PublishBar.
    //   C. Use a simple Zustand field in a UI store (e.g. useRightPanelStore.autoSwitchToHistory).
    // Pitfall 6 (RESEARCH.md) locks: userManualTab MUST remain local state in RightPanel.
    // The auto-switch mechanism is planner-decides, but the userManualTab guard is locked.
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Send failed: ${message}`, { duration: 5000 });
    setConnectionStatus("error", message);
    await appendHistoryEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      messageTypeName: selectedMessageType ?? "",
      exchange,
      routingKey: targetRoutingKey,
      status: "failed",
      errorMessage: message,
      fieldValues,
      payloadBytes: payload,
    });
  } finally {
    setIsSending(false);
  }
};
```

**Properties trigger button** (insert before Send button — UI-SPEC PublishBar item order):
```typescript
import { Settings2 } from "lucide-react";
// ...
<Button
  variant="outline"
  size="sm"
  onClick={() => setPropertiesOpen(true)}
>
  <Settings2 className="w-4 h-4 mr-2" />
  Properties
</Button>
<AmqpPropertiesSheet open={propertiesOpen} onOpenChange={setPropertiesOpen} />
```

---

### `src/lib/ipc.ts` (modify — extend publishMessage)

**Self-analog.** Current `publishMessage` at lines 55–62.

**Current signature** (`src/lib/ipc.ts` lines 55–62):
```typescript
export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[]
): Promise<void> {
  return invoke<void>("publish_message", { profileName, exchange, routingKey, payload });
}
```

**Extended signature** (D-08):
```typescript
export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[],
  amqpProps?: {
    contentType?: string;
    deliveryMode?: number;
    ttl?: number;           // milliseconds as positive integer
    correlationId?: string;
    replyTo?: string;
    headers?: Array<{ key: string; value: string }>;
  }
): Promise<void> {
  return invoke<void>("publish_message", {
    profileName,
    exchange,
    routingKey,
    payload,
    contentType: amqpProps?.contentType ?? null,
    deliveryMode: amqpProps?.deliveryMode ?? null,
    ttl: amqpProps?.ttl ?? null,
    correlationId: amqpProps?.correlationId ?? null,
    replyTo: amqpProps?.replyTo ?? null,
    headers: amqpProps?.headers ?? null,
  });
}
```

---

### `src-tauri/src/commands/publish.rs` (modify — AMQP properties extension)

**Self-analog.** Current `publish_message` function (lines 18–80).

**Current command signature + BasicProperties chain** (`publish.rs` lines 18–69):
```rust
#[tauri::command]
pub async fn publish_message(
    app: AppHandle,
    profile_name: String,
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
) -> Result<(), AppError> {
    // ...setup code...
    channel
        .basic_publish(
            exchange.as_str().into(),
            routing_key.as_str().into(),
            BasicPublishOptions::default(),
            &payload,
            BasicProperties::default()
                .with_content_type("application/x-protobuf".into()),
        )
        .await...
}
```

**Extended signature** (D-08 + RESEARCH.md Pattern 4):
```rust
// PITFALL 2 (RESEARCH.md): Use named struct, NOT Vec<(String, String)>
// Serde serializes tuples as ["k","v"] but TypeScript sends {key,value} objects
#[derive(serde::Deserialize)]
pub struct AmqpHeader {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn publish_message(
    app: AppHandle,
    profile_name: String,
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
    // All optional — None when not set by user
    content_type: Option<String>,
    delivery_mode: Option<u8>,
    ttl: Option<u32>,                      // PITFALL 1: converted to ShortString in Rust
    correlation_id: Option<String>,
    reply_to: Option<String>,
    headers: Option<Vec<AmqpHeader>>,
) -> Result<(), AppError> {
    // ...existing connection setup (lines 28–54 unchanged)...

    // Build BasicProperties — extend existing .with_content_type() chain
    let mut props = BasicProperties::default()
        .with_content_type(
            content_type
                .unwrap_or_else(|| "application/x-protobuf".to_string())
                .into()
        );

    if let Some(dm) = delivery_mode {
        props = props.with_delivery_mode(dm);
    }
    if let Some(t) = ttl {
        // PITFALL 1 (RESEARCH.md): AMQP expiration is ShortString (decimal ms as ASCII string)
        // with_expiration expects ShortString, NOT u32 — compile error otherwise
        props = props.with_expiration(t.to_string().into());
    }
    if let Some(cid) = correlation_id {
        if !cid.is_empty() {
            props = props.with_correlation_id(cid.into());
        }
    }
    if let Some(rt) = reply_to {
        if !rt.is_empty() {
            props = props.with_reply_to(rt.into());
        }
    }
    if let Some(hdrs) = headers {
        let mut table = lapin::types::FieldTable::default();
        for h in hdrs {
            table.insert(
                h.key.into(),
                lapin::types::AMQPValue::LongString(h.value.into()),
            );
        }
        props = props.with_headers(table);
    }

    // ...rest of basic_publish + close (lines 57–80 structure preserved)...
}
```

**Import additions** (at top of `publish.rs`, after existing imports):
```rust
// Add to existing lapin imports (line 1–3):
use lapin::types::{AMQPValue, FieldTable};
```

---

## Shared Patterns

### Error Narrowing
**Source:** `src/components/publish/PublishBar.tsx` lines 100–101 and 154–155; `src/components/sidebar/FileSection.tsx` line 75
**Apply to:** All components that catch errors from `invoke()` or `tauri-plugin-store` calls
```typescript
const message = err instanceof Error ? err.message : String(err);
```

### Toast Notifications
**Source:** `src/components/publish/PublishBar.tsx` lines 152–158
**Apply to:** `PublishBar.tsx` (resend path), `MessageHistoryPanel.tsx` (replay guard)
```typescript
// Success toast — 3s, non-blocking
toast(`Message sent to ${targetName}`, { duration: 3000 });
// Failure toast — 5s, destructive
toast.error(`Send failed: ${message}`, { duration: 5000 });
// Pattern for Phase 3 resend:
toast(`Message resent to ${targetName}`, { duration: 3000 });
toast.error(`Resend failed: ${message}`, { duration: 5000 });
```

### tauri-plugin-store Load/Get/Set/Save
**Source:** `src/components/sidebar/FileSection.tsx` lines 9, 48–51, 67–69
**Apply to:** `useHistoryStore.ts` persistence helpers
```typescript
const STORE_PATH = "tap.json";  // Note: history uses "history.json" (separate)
// Load:
const store = await load(STORE_PATH);
// Get:
const value = await store.get<T>(KEY);
// Set + save:
await store.set(KEY, value);
await store.save();
```

### AmqpHeader Named Struct (Rust — shared pitfall fix)
**Source:** RESEARCH.md Pitfall 2; applies to `publish.rs`
**Apply to:** `src-tauri/src/commands/publish.rs`
```rust
// CRITICAL: Define this struct in publish.rs (or a shared types module)
// DO NOT use Vec<(String, String)> — Serde serializes tuples as ["k","v"] arrays,
// but TypeScript sends {key: string, value: string} objects → IPC deserialization panic
#[derive(serde::Deserialize)]
pub struct AmqpHeader {
    pub key: String,
    pub value: String,
}
```

### Immutable Store Updates (Zustand)
**Source:** `src/stores/useConnectionStore.ts` lines 38–46; coding-style.md
**Apply to:** All Zustand stores and components mutating arrays
```typescript
// CORRECT: spread into new arrays
const updated = [entry, ...existing].slice(0, HISTORY_CAP);
// WRONG: existing.unshift(entry) — mutates in place
```

### Test File Structure
**Source:** `src/components/publish/__tests__/PublishBar.test.tsx` lines 1–70
**Apply to:** New component test files
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Module-scope Tauri mock (line 12–14)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Sonner mock with vi.hoisted (lines 9–10) — required when toast is called at module scope
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

// Radix Select native replacement (lines 17–33) — avoids portal/pointer-event issues in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)} role="combobox">
      {children}
    </select>
  ),
  // ...
}));

// Store reset per test (lines 56–70)
beforeEach(() => {
  vi.clearAllMocks();
  useConnectionStore.setState({ /* reset to initial */ });
});
```

**Source:** `src/components/form/__tests__/WellKnownTypeField.test.tsx` lines 11–21
**Apply to:** Tests for history table rows, AMQP sheet that use react-hook-form
```typescript
// FormProvider wrapper for RHF components
function renderWkt(field: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({ defaultValues: { [field.name]: "" }, mode: "onBlur" });
    return (
      <FormProvider {...methods}>
        <WellKnownTypeField field={field} path={field.name} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns + shadcn official docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/history/HistoryTable.tsx` | component | CRUD | `shadcn/ui Table` is not yet installed; no table-based components exist in codebase |
| shadcn/ui `table`, `sheet`, `tabs`, `switch`, `textarea`, `popover` | UI primitive | — | All new to this project; run `npx shadcn add <component>` per RESEARCH.md Standard Stack section |

**For `HistoryTable.tsx`**, use shadcn Table docs pattern:
```typescript
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
// Columns: Time (140px) | Type (auto) | Target (auto) | Status (64px) | Actions (80px)
// Per UI-SPEC: row hover bg-muted/50, selected row bg-muted
// Empty state: centered text in TableBody when entries.length === 0
```

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/lib/`, `src-tauri/src/commands/`
**Files read:** 16 source files + 3 test files + 3 planning documents
**Pattern extraction date:** 2026-05-18

**Key patterns identified:**
- All stores follow `interface + INITIAL_STATE + create<Interface>((set) => ({ ...INITIAL_STATE, ...setters }))` exactly — `useAmqpStore` is a direct copy of this structure
- `tauri-plugin-store` persistence always uses `load(PATH, { autoSave: false })` → `get` → `set` → `save()` — no autoSave in this codebase
- Error handling is always `err instanceof Error ? err.message : String(err)` — never `any`, never silent catch
- Rust `AppError` variants serialize as strings via custom `Serialize` impl; frontend catches them as plain error messages
- The `publish.rs` command follows: load profile → build URI → drop password → connect with timeout → create channel → build BasicProperties → basic_publish → await confirm → close conn → log debug
- `AmqpHeader` named struct is required (not `Vec<(String, String)>`) to avoid Serde IPC deserialization failure
- TTL must be converted `u32` → `ShortString` via `.to_string().into()` before passing to `with_expiration`
