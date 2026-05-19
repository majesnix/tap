# Phase 8: JSON Override Toggle - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/form/JsonEditor.tsx` | component | transform | `src/components/form/fields/BytesField.tsx` | role-match |
| `src/components/form/FormPanel.tsx` | component | request-response | `src/components/form/FormPanel.tsx` (self) | exact |
| `src/components/form/ProtoFormRenderer.tsx` | component | transform | `src/components/form/ProtoFormRenderer.tsx` (self) | exact (export-only change) |
| `src/components/form/__tests__/JsonEditor.test.tsx` | test | — | `src/components/form/__tests__/BytesField.test.tsx` | role-match |
| `src/components/form/__tests__/FormPanel.test.tsx` | test | — | `src/components/form/__tests__/FormPanel.test.tsx` (self) | exact |
| `package.json` | config | — | `package.json` (self) | exact |

---

## Pattern Assignments

### `src/components/form/JsonEditor.tsx` (component, transform)

**Analog:** `src/components/form/fields/BytesField.tsx`
**Secondary analog:** `src/components/publish/AmqpPropertiesSheet.tsx`

**Imports pattern** (`BytesField.tsx` lines 1-14):
```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
// JsonEditor will also need:
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { useTheme } from "next-themes";
import { TriangleAlertIcon } from "lucide-react";
```

**Props interface pattern** (`BytesField.tsx` lines 16-19 + `ProtoFormRendererProps` shape):
```typescript
// BytesField.tsx lines 16-19
interface BytesFieldProps {
  field: FieldSchema;
  path: string;
}

// JsonEditor analogous interface — does NOT consume RHF context:
interface JsonEditorProps {
  initialValue: string;                      // JSON.stringify(latestValues, null, 2) from FormPanel
  onApply: (jsonText: string) => void;       // called with raw string; FormPanel parses and signals
  onDiscard: () => void;                     // called when user clicks "Discard changes"
}
```

**Local useState pattern for transient UI state** (`BytesField.tsx` lines 77-79, `AmqpPropertiesSheet.tsx` lines 36-43):
```typescript
// BytesField.tsx lines 77-79
const [popoverOpen, setPopoverOpen] = useState(false);
const [utf8Input, setUtf8Input] = useState("");

// AmqpPropertiesSheet.tsx lines 36-43
const [draft, setDraft] = useState<AmqpProperties>(
  () => useAmqpStore.getState().properties
);
const [ttlError, setTtlError] = useState<string | null>(null);

// JsonEditor analogous state:
const [jsonDraft, setJsonDraft] = useState(initialValue);
const [parseError, setParseError] = useState<string | null>(null);
```

**Inline error banner with role="alert"** (`BytesField.tsx` lines 131-136):
```typescript
// BytesField.tsx lines 131-136
{fieldState.error && (
  <p className="text-xs text-destructive" role="alert">
    {field.label}: {fieldState.error.message}
  </p>
)}
```
JsonEditor uses this same `role="alert"` on the parse error `<p>` inside its error banner.

**Core component return structure** — From UI-SPEC §3 (pre-approved):
```tsx
// Error banner (below CodeMirror, only when parseError is set)
{parseError && (
  <div className="mx-4 mt-2 mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
    <div className="flex items-start gap-2">
      <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-destructive">Invalid JSON</span>
        <p className="text-xs text-destructive mt-1" role="alert">{parseError}</p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => setParseError(null)}>
            Fix JSON
          </Button>
          <Button variant="destructive" size="sm" onClick={onDiscard}>
            Discard changes
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Button variants available** (`src/components/ui/button.tsx` lines 11-22):
```typescript
// Confirmed variants: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
// Confirmed sizes:    "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
// Error banner uses: variant="outline" size="sm" (Fix JSON)
//                    variant="destructive" size="sm" (Discard changes)
```

**Theme detection pattern** (`src/components/sidebar/ThemeToggle.tsx` lines 23-24):
```typescript
// ThemeToggle.tsx lines 23-24
const { theme, setTheme } = useTheme();

// JsonEditor uses resolvedTheme not theme (per CONTEXT D-06 / STATE.md):
const { resolvedTheme } = useTheme();
// Then pass to CodeMirror: theme={resolvedTheme === "dark" ? "dark" : "light"}
// NOTE: ThemeToggle's `mounted` guard (lines 28-31) is NOT needed in JsonEditor —
// isJsonMode prevents JsonEditor from rendering until the user explicitly toggles.
```

**CodeMirror props** (from RESEARCH.md Pattern 3):
```typescript
<CodeMirror
  value={jsonDraft}
  height="100%"
  theme={resolvedTheme === "dark" ? "dark" : "light"}
  extensions={[json()]}
  onChange={(value) => setJsonDraft(value)}
/>
```

**No ScrollArea nesting** — CRITICAL constraint from RESEARCH.md Pitfall 4:
```typescript
// JsonEditor wraps CodeMirror in a plain flex div, NOT <ScrollArea>
// FormPanel JSON-mode branch structure:
<div className="flex-1 flex flex-col min-h-0">
  <JsonEditor ... />
</div>
// CodeMirror manages its own scroll via height="100%"
```

---

### `src/components/form/FormPanel.tsx` (component, request-response)

**Analog:** `src/components/form/FormPanel.tsx` (self — additions only)

**Existing state pattern to extend** (`FormPanel.tsx` lines 1-6, 16-34):
```typescript
// FormPanel.tsx lines 1-6
import { useCallback, useRef, useEffect } from "react";
import { useProtoStore } from "@/stores/useProtoStore";
import { encodeMessage } from "@/lib/ipc";
import { useDebounce } from "@/hooks/useDebounce";
import { ProtoFormRenderer } from "./ProtoFormRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";

// New imports to add:
import { useState } from "react";  // already available via "react"
import { JsonEditor } from "./JsonEditor";
import { toast } from "sonner";
import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDefaultValues } from "./ProtoFormRenderer";  // requires export added to ProtoFormRenderer
import { useTheme } from "next-themes";
```

**New useState additions** — follow `BytesField.tsx` lines 77-79 / `AmqpPropertiesSheet.tsx` lines 36-43 pattern:
```typescript
// Add inside FormPanel() alongside existing refs:
const [isJsonMode, setIsJsonMode] = useState(false);
const [entrySnapshot, setEntrySnapshot] = useState<Record<string, unknown> | null>(null);
const [jsonSnapshot, setJsonSnapshot] = useState<string>("");
```

**pendingReplayValues signal — the exact mechanism for JSON→form sync** (`FormPanel.tsx` lines 62-67):
```typescript
// FormPanel.tsx lines 62-67 — DO NOT change this useEffect, it already handles timing:
useEffect(() => {
  if (pendingReplayValues && resetRef.current) {
    resetRef.current(pendingReplayValues);
    setPendingReplayValues(null);
  }
}, [pendingReplayValues, setPendingReplayValues]);

// handleToggle (JSON → FORM success path) writes to this signal:
// setPendingReplayValues(mergedValues);  // triggers useEffect after ProtoFormRenderer remounts
// setIsJsonMode(false);
// NEVER call resetRef.current() directly after setIsJsonMode(false) in the same handler
```

**Header div — toggle button mount point** (`FormPanel.tsx` lines 88-91):
```tsx
// FormPanel.tsx lines 88-91 — existing header; toggle button goes alongside h2/p:
<div className="px-4 py-3 border-b border-border shrink-0">
  <h2 className="text-sm font-semibold">{message.name}</h2>
  <p className="text-xs text-muted-foreground">{message.full_name}</p>
</div>
// Modify to add a flex layout and toggle button:
<div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
  <div>
    <h2 className="text-sm font-semibold">{message.name}</h2>
    <p className="text-xs text-muted-foreground">{message.full_name}</p>
  </div>
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
</div>
```

**Toggle button pattern** (`ThemeToggle.tsx` lines 40-51):
```typescript
// ThemeToggle.tsx lines 40-51 — ghost/icon pattern with aria-label + title:
<Button
  variant="ghost"
  size="icon"
  className="size-8"
  onClick={() => setTheme(nextMode)}
  aria-label={LABELS[current]}
  title={LABELS[current]}
>
  {ICONS[current]}
</Button>
// FormPanel toggle uses size="icon-sm" (confirmed in button.tsx) and aria-pressed
```

**Conditional render** (`FormPanel.tsx` lines 92-98):
```tsx
// FormPanel.tsx lines 92-98 — existing ScrollArea + ProtoFormRenderer:
<ScrollArea className="flex-1 min-h-0">
  <ProtoFormRenderer
    message={message}
    onValuesChange={handleValuesChange}
    resetRef={resetRef}
  />
</ScrollArea>
// Replace with conditional — JSON mode REMOVES the ScrollArea entirely:
{isJsonMode ? (
  <div className="flex-1 flex flex-col min-h-0">
    <JsonEditor
      initialValue={jsonSnapshot}
      onApply={handleJsonApply}
      onDiscard={handleJsonDiscard}
    />
  </div>
) : (
  <ScrollArea className="flex-1 min-h-0">
    <ProtoFormRenderer
      message={message}
      onValuesChange={handleValuesChange}
      resetRef={resetRef}
    />
  </ScrollArea>
)}
```

**Unknown-fields toast** — follows `useProtoStore.ts` line 90 / `MessageHistoryPanel.tsx` lines 32-36:
```typescript
// useProtoStore.ts line 90 — existing toast.error pattern:
toast.error(`Maximum ${MAX_OPEN_FILES} files open at once`);

// MessageHistoryPanel.tsx lines 32-36 — toast.error on error conditions:
toast.error("Replay failed: .proto file not open. Open the file first.");

// FormPanel handleToggle uses toast.warning (not error) for unknown fields:
toast.warning(`${unknownKeys.length} unknown ${label} ignored: ${unknownKeys.join(", ")}`);
```

**Merge-over-defaults before reset** (RESEARCH.md Pattern 2):
```typescript
// Always merge parsed JSON over buildDefaultValues before signalling reset:
const mergedValues = { ...buildDefaultValues(message), ...cleanedValues };
setPendingReplayValues(mergedValues);
setIsJsonMode(false);
```

---

### `src/components/form/ProtoFormRenderer.tsx` (export-only change)

**Analog:** `src/components/form/ProtoFormRenderer.tsx` (self)

**Scope:** Add `export` keyword to `buildDefaultValues`. No behavioral change. File is FROZEN for all other modifications.

**Change** (`ProtoFormRenderer.tsx` line 32):
```typescript
// Before (line 32):
function buildDefaultValues(

// After:
export function buildDefaultValues(
```

This single-keyword addition allows `FormPanel.tsx` to import `buildDefaultValues` for the merge-over-defaults pattern (RESEARCH.md Pitfall 5).

---

### `src/components/form/__tests__/JsonEditor.test.tsx` (test)

**Analog:** `src/components/form/__tests__/BytesField.test.tsx`

**Test file structure** (`BytesField.test.tsx` lines 1-24):
```typescript
// BytesField.test.tsx lines 1-6 — import pattern:
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { BytesField } from "../fields/BytesField";
import type { FieldSchema } from "@/lib/types";

// JsonEditor test imports — NOTE: no FormProvider wrapper needed.
// JsonEditor owns its own draft state; it does NOT consume RHF context:
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";
import { JsonEditor } from "../JsonEditor";
```

**CodeMirror mock — MANDATORY for all test files that render JsonEditor** (`App.test.tsx` lines 13-24 for vi.mock pattern):
```typescript
// App.test.tsx lines 13-24 — vi.mock idiom used by this project:
const { mockStore, mockGet, mockSet, mockSave } = vi.hoisted(() => { ... });
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn().mockResolvedValue(mockStore) }));
vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

// JsonEditor.test.tsx CodeMirror mock — same idiom:
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
// Tests then use screen.getByTestId("codemirror-stub") and fireEvent.change(...)
```

**Test structure pattern** (`BytesField.test.tsx` lines 34-144 section groupings):
```typescript
// BytesField.test.tsx uses grouped test blocks by feature:
// ─── render ──────────────────────────────────────────────────────────
// ─── badge ───────────────────────────────────────────────────────────
// ─── valid byte count ────────────────────────────────────────────────

// JsonEditor.test.tsx analogous groups:
// ─── render ────────────────────────────────────────────────────────── (editor renders with initial value)
// ─── parse error banner ─────────────────────────────────────────────── (banner appears on onApply with invalid JSON)
// ─── Fix JSON button ─────────────────────────────────────────────────── (banner dismisses, stays in JSON mode)
// ─── Discard changes button ───────────────────────────────────────────── (onDiscard callback fires)
// ─── valid JSON apply ────────────────────────────────────────────────── (onApply fires with raw string)
```

---

### `src/components/form/__tests__/FormPanel.test.tsx` (extended test)

**Analog:** `src/components/form/__tests__/FormPanel.test.tsx` (self)

**Existing test setup to reuse** (`FormPanel.test.tsx` lines 43-58):
```typescript
// FormPanel.test.tsx lines 43-58 — beforeEach/afterEach setup; extend (not replace):
beforeEach(() => {
  act(() => {
    useProtoStore.getState().addOrActivateFile("/fake/test.proto", MINIMAL_SCHEMA);
    useProtoStore.getState().setSelectedType("Msg");
  });
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(ipc.encodeMessage).mockResolvedValue([0x0a, 0x05]);
});

afterEach(() => {
  act(() => {
    useProtoStore.getState().reset();
  });
  vi.useRealTimers();
});
```

**CodeMirror mock required here too** — add same `vi.mock("@uiw/react-codemirror")` at file top (same stub as `JsonEditor.test.tsx`) because FormPanel renders JsonEditor when `isJsonMode` is true.

**next-themes mock** (`App.test.tsx` line 19) — FormPanel tests entering JSON mode need `resolvedTheme`:
```typescript
// App.test.tsx line 19:
vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

// FormPanel.test.tsx must add the same mock + configure return value:
import { useTheme } from "next-themes";
vi.mock("next-themes", () => ({ useTheme: vi.fn() }));
vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "light", ... });
```

**Test cases to add** (extend existing file):
- Toggle button renders in form header
- Clicking toggle switches to JSON mode (ProtoFormRenderer unmounts, JsonEditor mounts)
- Clicking toggle again from JSON mode with valid JSON calls `setPendingReplayValues`
- Clicking toggle with invalid JSON does NOT switch modes (parseError banner visible)
- "Discard changes" restores `entrySnapshot` (not `buildDefaultValues`)
- Unknown fields toast calls `toast.warning` with correct message

---

## Shared Patterns

### Local useState for Transient UI State
**Source:** `src/components/form/fields/BytesField.tsx` lines 77-79, `src/components/publish/AmqpPropertiesSheet.tsx` lines 36-43
**Apply to:** `isJsonMode`, `entrySnapshot`, `jsonSnapshot` in `FormPanel.tsx`; `jsonDraft`, `parseError` in `JsonEditor.tsx`
```typescript
// Pattern: all transient session UI state lives in local useState, NOT Zustand
const [popoverOpen, setPopoverOpen] = useState(false);      // BytesField pattern
const [ttlError, setTtlError] = useState<string | null>(null);  // AmqpPropertiesSheet pattern
```

### Inline Error Display with role="alert"
**Source:** `src/components/form/fields/BytesField.tsx` lines 131-136
**Apply to:** Parse error `<p>` inside `JsonEditor.tsx` error banner
```typescript
// BytesField.tsx lines 131-136
{fieldState.error && (
  <p className="text-xs text-destructive" role="alert">
    {field.label}: {fieldState.error.message}
  </p>
)}
// JsonEditor uses the same role="alert" attribute on the parse error paragraph
```

### Sonner Toast Notifications
**Source:** `src/stores/useProtoStore.ts` line 90, `src/components/history/MessageHistoryPanel.tsx` lines 32-36
**Apply to:** Unknown-fields warning in `FormPanel.tsx` `handleToggle`
```typescript
// useProtoStore.ts line 90:
toast.error(`Maximum ${MAX_OPEN_FILES} files open at once`);

// MessageHistoryPanel.tsx line 32:
toast.error("Replay failed: .proto file not open. Open the file first.");

// FormPanel uses toast.warning (different level, same import and call signature):
import { toast } from "sonner";
toast.warning(`2 unknown fields ignored: foo, bar`);
```

### pendingReplayValues Signal for resetRef Timing
**Source:** `src/components/form/FormPanel.tsx` lines 62-67
**Apply to:** JSON→form sync in `handleToggle` (JSON → FORM success path)
```typescript
// FormPanel.tsx lines 62-67 — existing useEffect already handles timing correctly:
useEffect(() => {
  if (pendingReplayValues && resetRef.current) {
    resetRef.current(pendingReplayValues);
    setPendingReplayValues(null);
  }
}, [pendingReplayValues, setPendingReplayValues]);

// JSON exit handler: write signal, then switch mode — the useEffect fires after remount:
setPendingReplayValues(mergedValues);
setIsJsonMode(false);
// NEVER: resetRef.current(mergedValues); setIsJsonMode(false); — resetRef.current is null until remount
```

### Ghost Icon Button with aria-label + title
**Source:** `src/components/sidebar/ThemeToggle.tsx` lines 40-51
**Apply to:** Toggle button in `FormPanel.tsx` header
```typescript
// ThemeToggle.tsx lines 40-51:
<Button
  variant="ghost"
  size="icon"
  className="size-8"
  onClick={() => setTheme(nextMode)}
  aria-label={LABELS[current]}
  title={LABELS[current]}
>
  {ICONS[current]}
</Button>
// FormPanel variant: size="icon-sm", add aria-pressed={isJsonMode}
```

### vi.mock Pattern for External Libraries
**Source:** `src/App.test.tsx` lines 13-24
**Apply to:** All test files that render `JsonEditor` or `FormPanel` in JSON mode
```typescript
// App.test.tsx lines 19-23:
vi.mock("next-themes", () => ({ useTheme: vi.fn() }));
import { useTheme } from "next-themes";
const mockUseTheme = vi.mocked(useTheme);

// CodeMirror mock follows same pattern — must appear before any import of JsonEditor:
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="codemirror-stub" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
```

---

## No Analog Found

All files have analogs from the existing codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Critical Constraints (planner must honor)

| Constraint | Source | Risk if Violated |
|---|---|---|
| ProtoFormRenderer.tsx is FROZEN except `export buildDefaultValues` | CONTEXT.md canonical_refs | Behavioral regression in form rendering |
| Do NOT nest CodeMirror inside `<ScrollArea>` | RESEARCH.md Pitfall 4 | CodeMirror gutters break, scroll fails |
| Use `setPendingReplayValues` signal, never `resetRef.current()` directly after `setIsJsonMode(false)` | RESEARCH.md Pitfall 1, Pattern 1 | Silent no-op — form never populates with JSON values |
| Always merge over `buildDefaultValues(message)` before reset | RESEARCH.md Pitfall 2, Pattern 2 | Fields deleted in JSON editor become `undefined` not defaults |
| `vi.mock("@uiw/react-codemirror")` required in every test file rendering `JsonEditor` | RESEARCH.md Pitfall 3, Pattern 6 | Test failures: ContentEditable + jsdom incompatibility |
| `entrySnapshot` captured at JSON mode entry (local state), not re-read from Zustand at Discard time | CONTEXT.md D-06, RESEARCH.md Pattern 5 | Fragile Discard that may mismatch intent |

---

## Metadata

**Analog search scope:** `src/components/form/`, `src/components/sidebar/`, `src/components/publish/`, `src/components/history/`, `src/stores/`, `src/App.test.tsx`
**Files scanned:** 10
**Pattern extraction date:** 2026-05-19
