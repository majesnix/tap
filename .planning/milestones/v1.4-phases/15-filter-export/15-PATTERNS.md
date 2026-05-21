# Phase 15: Filter + Export - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 1 modified (MessageFeedTab.tsx — primary change surface)
**Analogs found:** 4 / 4

## Prerequisites (planner must include as tasks)

`tauri_plugin_fs::init()` is already registered in `src-tauri/src/lib.rs` (line 37) and `tauri_plugin_dialog::init()` (line 36). However `src-tauri/capabilities/default.json` is missing two permissions required for export:

| Missing permission | Why needed |
|--------------------|-----------|
| `"dialog:allow-save"` | `save()` call in the export handler |
| `"fs:allow-write-text-file"` | `writeTextFile()` call in the export handler |

The planner must include a task to add both permissions to `src-tauri/capabilities/default.json` alongside the existing `"dialog:allow-open"` and `"fs:allow-read-text-file"` entries. No Rust code changes are needed — only the JSON capabilities file.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/response/MessageFeedTab.tsx` | component | request-response + transform | `src/components/history/MessageHistoryPanel.tsx` | exact — same local filter state + useMemo pattern |
| `src/components/ui/input.tsx` | ui (read-only, shadcn) | — | self | — |
| `src/components/ui/select.tsx` | ui (read-only, shadcn) | — | self | — |
| `src/components/ui/button.tsx` | ui (read-only, shadcn) | — | self | — |
| export handler (inline in MessageFeedTab) | utility | file-I/O | `src/components/sidebar/FileSection.tsx` | role-match — same dialog + async write pattern |
| `src-tauri/capabilities/default.json` | config | — | self | — |

---

## Pattern Assignments

### `src/components/response/MessageFeedTab.tsx` — filter state + visibleMessages

**Primary analog:** `src/components/history/MessageHistoryPanel.tsx`

**Imports pattern** (MessageHistoryPanel.tsx lines 1-11):
```typescript
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
```
Add to existing MessageFeedTab imports:
```typescript
import { useMemo } from "react";  // useState already present; add useMemo
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
```

**Local filter state pattern** (MessageHistoryPanel.tsx lines 16-17):
```typescript
const [typeFilter, setTypeFilter] = useState("");
const [targetFilter, setTargetFilter] = useState("");
```
Phase 15 equivalent:
```typescript
const [filterRoutingKey, setFilterRoutingKey] = useState("");
// Three-state model: null = show all, "__none__" = match null contentType, string = match that string
const [filterContentType, setFilterContentType] = useState<string | null>(null);
```

**useMemo derived filter pattern** (MessageHistoryPanel.tsx lines 25-28):
```typescript
const filteredEntries = useMemo(
  () => filterHistoryEntries(entries, typeFilter, targetFilter),
  [entries, typeFilter, targetFilter]
);
```
Phase 15 equivalent — inline logic (no helper needed, simpler than historyHelpers):
```typescript
const visibleMessages = useMemo(() => {
  return messages.filter((msg) => {
    const keyMatch = !filterRoutingKey ||
      msg.routingKey.toLowerCase().includes(filterRoutingKey.toLowerCase());
    // Three-state sentinel: null = All, "__none__" matches null contentType, otherwise exact string
    const typeMatch =
      filterContentType === null ||
      (filterContentType === "__none__" ? msg.contentType === null : msg.contentType === filterContentType);
    return keyMatch && typeMatch;
  });
}, [messages, filterRoutingKey, filterContentType]);
```

**Distinct content-type options (derived from messages):**
```typescript
const contentTypeOptions = useMemo(() => {
  const seen = new Set<string | null>();
  for (const msg of messages) {
    seen.add(msg.contentType);
  }
  return Array.from(seen).sort((a, b) => {
    if (a === null) return 1;   // null sorts last (shown as "(none)")
    if (b === null) return -1;
    return a.localeCompare(b);
  });
}, [messages]);
```

**Filter row JSX — follows existing subscribe panel row container pattern** (MessageFeedTab.tsx lines 112-120):
```tsx
{/* Existing subscribe panel row — copy container class pattern */}
{mode === "subscribe" && (
  <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
    <SubscribePanel ... />
  </div>
)}
```
Phase 15 filter row (new sibling after SubscribePanel slot, always rendered):
```tsx
{/* Filter row — always visible, D-01 */}
<div className="px-4 py-2 border-b border-border flex items-center gap-2">
  <Input
    placeholder="Filter by routing key"
    value={filterRoutingKey}
    onChange={(e) => setFilterRoutingKey(e.target.value)}
    className="flex-1 h-7 text-xs"
  />
  <Select
    value={filterContentType ?? "all"}
    onValueChange={(v) => setFilterContentType(v === "all" ? null : v)}
  >
    <SelectTrigger className="w-52 h-7 text-xs">
      <SelectValue placeholder="All content-types" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All content-types</SelectItem>
      {contentTypeOptions.map((ct) => (
        <SelectItem key={ct ?? "__none__"} value={ct ?? "__none__"}>
          {ct ?? "(none)"}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <Button
    variant="outline"
    size="sm"
    onClick={() => void handleExport()}
    disabled={visibleMessages.length === 0}
  >
    <Download className="w-4 h-4 mr-1" />
    Export
  </Button>
</div>
```

Note on sentinel value `"__none__"`: `Select` requires string values. When user picks "(none)" from the dropdown, `filterContentType` stores `"__none__"`. The filter check explicitly handles this: `filterContentType === "__none__" ? msg.contentType === null : msg.contentType === filterContentType`. The sentinel never leaks into the serialized export — the export handler reads `msg.contentType` directly from the FeedMessage.

**Feed header count label update** (MessageFeedTab.tsx lines 82-88 — replace):
```typescript
// Existing:
const messageCount = messages.length;
const countLabel =
  messageCount === 0
    ? "No messages"
    : messageCount === 1
      ? "1 message"
      : `${messageCount} messages`;

// Phase 15 replacement:
const messageCount = messages.length;
const visibleCount = visibleMessages.length;
const isFiltered = filterRoutingKey !== "" || filterContentType !== null;
const countLabel =
  messageCount === 0
    ? "No messages"
    : isFiltered
      ? `${visibleCount} of ${messageCount} messages`
      : messageCount === 1
        ? "1 message"
        : `${messageCount} messages`;
```

**Feed body empty-state update** (MessageFeedTab.tsx lines 144-156 — extend):
```tsx
<ScrollArea className="flex-1 overflow-hidden">
  {messages.length === 0 ? (
    <p className="text-xs text-muted-foreground p-4">
      Select a queue and choose a mode
    </p>
  ) : visibleMessages.length === 0 ? (
    <p className="text-xs text-muted-foreground p-4">
      No messages match filter
    </p>
  ) : (
    <Accordion type="single" collapsible className="w-full">
      {visibleMessages.map((msg) => (
        <MessageFeedRow key={msg.id} message={msg} />
      ))}
    </Accordion>
  )}
</ScrollArea>
```

---

### Export handler (inline in `MessageFeedTab.tsx`)

**Primary analog:** `src/components/sidebar/FileSection.tsx`

**Plugin-dialog `open()` import pattern** (FileSection.tsx line 2):
```typescript
import { open } from "@tauri-apps/plugin-dialog";
```
Phase 15 uses `save` instead of `open`:
```typescript
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
```

**Async dialog call + early-return on cancel pattern** (FileSection.tsx lines 41-46):
```typescript
const handleOpenFile = async () => {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Proto files", extensions: ["proto"] }],
  });
  if (!selected || typeof selected !== "string") return;  // user cancelled — silent
  // ...
};
```
Phase 15 equivalent (D-08: cancel is silent):
```typescript
const handleExport = async () => {
  const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 16);
  const defaultPath = `feed-export-${timestamp}.json`;

  const filePath = await save({
    defaultPath,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!filePath) return;  // user cancelled — silent (D-08)

  const payload = {
    exportedAt: new Date().toISOString(),
    messageCount: visibleMessages.length,
    messages: visibleMessages.map(({ routingKey, exchange, contentType, timestamp, decodedAs, decoded, error }) => ({
      routingKey,
      exchange,
      contentType,
      // D-11: epoch seconds → ISO 8601 string; null passthrough
      timestamp: timestamp !== null ? new Date(timestamp * 1000).toISOString() : null,
      decodedAs,
      decoded,
      error,
      // id and hexString intentionally omitted (D-10)
    })),
  };

  try {
    await writeTextFile(filePath, JSON.stringify(payload, null, 2));
    toast.success(`Exported ${visibleMessages.length} messages`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Export failed: ${message}`);
  }
};
```

**Error narrowing pattern** (MessageFeedTab.tsx lines 73-75, also FileSection.tsx lines 85-86):
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  toast.error(`Export failed: ${message}`);
}
```

---

### `src-tauri/capabilities/default.json` — capability additions

**Analog:** existing file at `src-tauri/capabilities/default.json`

Add these two permission strings to the `"permissions"` array alongside the existing entries:
```json
"dialog:allow-save",
"fs:allow-write-text-file"
```

Current state of relevant entries (lines 9-12):
```json
"dialog:default",
"dialog:allow-open",
"fs:default",
"fs:allow-read-text-file",
```

After change:
```json
"dialog:default",
"dialog:allow-open",
"dialog:allow-save",
"fs:default",
"fs:allow-read-text-file",
"fs:allow-write-text-file",
```

---

## Shared Patterns

### Zustand per-field selector
**Source:** `src/components/response/MessageFeedTab.tsx` lines 29-38
**Apply to:** all additions in MessageFeedTab
```typescript
const messages = useResponseStore((s) => s.messages);
// Always use per-field selectors — never destructure the whole store at once
```

### Toast usage
**Source:** `src/components/response/MessageFeedTab.tsx` lines 5, 59, 63, 75
**Apply to:** export handler
```typescript
import { toast } from "sonner";
// ...
toast.info("Queue is empty");
toast.error(`Drain failed: ${message}`);
toast.success(`Exported ${N} messages`);  // success variant used in Phase 15
```

### Row container layout (filter/subscribe/toolbar rows)
**Source:** `src/components/response/MessageFeedTab.tsx` lines 93 and 112-120
**Apply to:** new filter row container
```tsx
<div className="px-4 py-2 border-b border-border flex items-center gap-2">
  {/* row contents */}
</div>
```

### Filter bar Input sizing
**Source:** `src/components/history/HistoryFilterBar.tsx` lines 17-30
**Apply to:** routing key Input inside filter row
```tsx
<Input
  placeholder="Filter by type…"
  value={typeFilter}
  onChange={(e) => onTypeChange(e.target.value)}
  className="h-7 text-xs flex-1"
/>
```

### Select component import
**Source:** `src/components/response/ResponseQueuePicker.tsx` lines 8-12
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

### Button variant="outline" size="sm"
**Source:** `src/components/include-paths/IncludePathDialog.tsx` line 87; ResponseQueuePicker for `size="sm"` usage
```tsx
<Button variant="outline" size="sm" onClick={...} disabled={...}>
  <Download className="w-4 h-4 mr-1" />
  Export
</Button>
```

### Error narrowing (unknown catch)
**Source:** `src/components/response/MessageFeedTab.tsx` lines 73-75
**Apply to:** export handler catch block
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  toast.error(`Export failed: ${message}`);
}
```

---

## Test Patterns

### Test file analog
**Source:** `src/components/response/MessageFeedTab.test.tsx`

**Mock pattern for sonner toast** (lines 14-24) — extend with `success` for Phase 15:
```typescript
const { mockToastInfo, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToastInfo: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),  // add for export test assertions
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    info: mockToastInfo,
    error: mockToastError,
    success: mockToastSuccess,
  }),
}));
```

**Mock pattern for Radix Select** (lines 26-58) — copy verbatim for filter tests:
```typescript
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)} role="listbox">
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
    <option value={value}>{children}</option>,
}));
```

**Mock pattern for Tauri plugins** (new for Phase 15 export tests):
```typescript
const { mockSave, mockWriteTextFile } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mockSave,
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: mockWriteTextFile,
}));
```

**Store state injection pattern** (lines 82-87):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  useResponseStore.setState(FEED_STATE);
  useConnectionStore.setState(CONNECTED_STATE);
});
```

---

## No Analog Found

None — all patterns have close matches in the codebase.

---

## Metadata

**Analog search scope:** `src/components/`, `src/stores/`, `src/lib/`, `src-tauri/`
**Files scanned:** 12 (MessageFeedTab.tsx, useResponseStore.ts, types.ts, MessageHistoryPanel.tsx, HistoryFilterBar.tsx, historyHelpers.ts, FileSection.tsx, IncludePathDialog.tsx, ResponseQueuePicker.tsx, MessageFeedTab.test.tsx, src-tauri/src/lib.rs, src-tauri/capabilities/default.json)
**Pattern extraction date:** 2026-05-21
