# Phase 5: Dark Mode - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 3 (1 new, 2 modified)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/sidebar/ThemeToggle.tsx` | component | event-driven | `src/components/ui/sonner.tsx` + `src/components/ui/button.tsx` | role-match |
| `src/App.tsx` | provider/root | request-response (async bootstrap) | `src/stores/useHistoryStore.ts` (bootstrap-guard pattern) | role-match |
| `src/components/sidebar/Sidebar.tsx` | component | — (footer markup only) | `src/components/sidebar/Sidebar.tsx` lines 57-61 (target site) | exact |

---

## Pattern Assignments

### `src/components/sidebar/ThemeToggle.tsx` (component, event-driven)

**New file.** No exact analog; strongest matches are `sonner.tsx` for `useTheme()` usage and `button.tsx` for the ghost icon button API.

**Imports pattern** — follow `sonner.tsx` lines 1-4 for next-themes import and `button.tsx` line 1 for shadcn import style:

```tsx
// src/components/ui/sonner.tsx lines 1-4 (useTheme import pattern)
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// src/components/ui/button.tsx lines 1-6 (import style + cn utility)
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"
```

**For ThemeToggle — combined imports:**
```tsx
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
```

**Ghost icon button API** — `src/components/ui/button.tsx` lines 17-18 and 29 confirm the variants:

```tsx
// button.tsx line 18 — ghost variant
ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
// button.tsx line 29 — icon size
icon: "size-8",

// Usage (confirmed API):
<Button variant="ghost" size="icon" className="size-8" ... />
```

**Inline icon-button-in-sidebar pattern** — `src/components/sidebar/FileSection.tsx` lines 133-141 (the × close button in the same sidebar):

```tsx
// FileSection.tsx lines 133-141 — small icon button inline in sidebar row
<button
  type="button"
  aria-label={`Close ${fileName}`}
  onClick={(e) => {
    e.stopPropagation();
    closeFile(index);
  }}
  className="ml-1 flex items-center justify-center rounded-sm px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
>
  ×
</button>
```

**Mounted-guard pattern** — `sonner.tsx` line 6 shows the `useTheme()` call with a fallback; the mounted guard (useState + useEffect) is the ThemeToggle-specific pattern to prevent undefined `theme` on first render:

```tsx
// sonner.tsx line 6 — useTheme with fallback
const { theme = "system" } = useTheme()

// ThemeToggle mounted guard (from RESEARCH.md Pattern 2 — no existing analog):
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) {
  return <Button variant="ghost" size="icon" className="size-8" disabled />;
}
```

---

### `src/App.tsx` — ThemeProvider wrap + inline ThemeBootstrap (modify, provider/root)

**Analog:** `src/stores/useHistoryStore.ts` for the bootstrap-guard / race-prevention pattern.

**Current file structure** (`src/App.tsx` lines 1-11 — full file):

```tsx
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <>
      <AppLayout />
      <Toaster />
    </>
  );
}
```

**Bootstrap-guard pattern** — `src/stores/useHistoryStore.ts` lines 28-56 is the primary analog. The `historyLoaded` flag blocking writes until the async load completes is structurally identical to the `bootstrapped` flag that blocks the mirror effect in `ThemeBootstrap`:

```ts
// useHistoryStore.ts lines 28-44 — load/get/set/save lifecycle
async function persistEntries(entries: HistoryEntry[]): Promise<void> {
  const store = await load(HISTORY_STORE_PATH);
  await store.set(HISTORY_KEY, entries);
  await store.save();
}

// useHistoryStore.ts lines 40-56 — bootstrap guard that prevents writes before async hydration
loadHistory: async () => {
  const store = await load(HISTORY_STORE_PATH);
  const saved = await store.get<HistoryEntry[]>(HISTORY_KEY);
  set({ entries: saved ?? [], historyLoaded: true });
},

appendEntry: async (entry) => {
  // Guard: do not write before async store hydration completes
  if (!get().historyLoaded) return;
  // ...
},
```

**tauri-plugin-store load/get/set/save lifecycle** — `src/components/sidebar/FileSection.tsx` lines 57-78 shows the exact async call sequence used for reads and writes in a component context (as opposed to a Zustand action):

```tsx
// FileSection.tsx lines 57-66 — store load + get in component
const store = await load(STORE_PATH);
const savedPaths = await store.get<string[]>(
  `${INCLUDE_PATH_KEY_PREFIX}${selected}`
);
const initialPaths = savedPaths ?? [parentDir];

// FileSection.tsx lines 74-78 — store load + set + save in component
const store = await load(STORE_PATH);
await store.set(`${INCLUDE_PATH_KEY_PREFIX}${pendingFilePath}`, paths);
await store.save();
```

**Store path constant pattern** — `src/components/sidebar/FileSection.tsx` lines 10-11 and `src/stores/useHistoryStore.ts` lines 4-6:

```ts
// FileSection.tsx lines 10-11
const STORE_PATH = "proto-sender.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";

// useHistoryStore.ts lines 4-6
const HISTORY_STORE_PATH = "history.json";
const HISTORY_KEY = "entries";
const MAX_ENTRIES = 100;

// ThemeBootstrap should follow the same top-of-file constant convention:
const THEME_STORE_PATH = "proto-sender.json"; // same store file as FileSection
const THEME_MODE_KEY = "theme-mode";
```

**Note:** `ThemeBootstrap` must be declared as a separate named component *inside* `App.tsx` — as a child of `ThemeProvider` in the JSX tree. It cannot be a sibling of `ThemeProvider` because `useTheme()` returns a no-op stub outside the provider boundary (see RESEARCH.md Pitfall 2).

---

### `src/components/sidebar/Sidebar.tsx` — footer insertion (modify)

**Target site** — `src/components/sidebar/Sidebar.tsx` lines 57-61 (current footer):

```tsx
// Sidebar.tsx lines 57-61 — exact insertion point
<div className="flex-1" />

<div className="text-xs text-muted-foreground text-center">
  v0.1.0 — Walking Skeleton
</div>
```

**Target layout after change** — replace the version div with a flex row:

```tsx
<div className="flex-1" />
<div className="flex items-center justify-between">
  <div className="text-xs text-muted-foreground">v0.1.0 — Walking Skeleton</div>
  <ThemeToggle />
</div>
```

**Import style to follow** — `src/components/sidebar/Sidebar.tsx` lines 1-11 (existing import block — add `ThemeToggle` here):

```tsx
import { useProtoStore } from "@/stores/useProtoStore";
import { FileSection } from "@/components/sidebar/FileSection";
import { ConnectionSection } from "@/components/sidebar/ConnectionSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
// Add: import { ThemeToggle } from "@/components/sidebar/ThemeToggle";
```

---

## Shared Patterns

### tauri-plugin-store Load/Get/Set/Save Lifecycle
**Source:** `src/stores/useHistoryStore.ts` lines 28-44 (Zustand action context) and `src/components/sidebar/FileSection.tsx` lines 57-78 (component context)
**Apply to:** `ThemeBootstrap` component in `src/App.tsx`

```ts
// Pattern: load() returns the store object; always explicit .save() after .set()
const store = await load(STORE_PATH);
const saved = await store.get<string>(KEY);
// ... use saved value ...
await store.set(KEY, value);
await store.save();
// NOTE: Never use autoSave: true — always call .save() explicitly (comment in useHistoryStore.ts line 30)
```

### Bootstrap Race-Guard (Boolean Flag)
**Source:** `src/stores/useHistoryStore.ts` lines 40-56 (`historyLoaded` flag pattern)
**Apply to:** `ThemeBootstrap` in `src/App.tsx` (`bootstrapped` flag)

The load-then-flag pattern is critical. The `historyLoaded` guard prevents `appendEntry` from writing before `loadHistory` resolves. `ThemeBootstrap`'s `bootstrapped` flag plays the same role: the mirror effect must not write to tauri-plugin-store until the bootstrap read has completed, or it will clobber the saved value with the stale localStorage-derived theme.

```ts
// useHistoryStore.ts pattern (lines 40-56):
// 1. Async read from store
// 2. Apply loaded value to state
// 3. Set bootstrapped/loaded flag = true

// 4. All write effects gate on the flag:
if (!get().historyLoaded) return; // write guard
```

### Icon Size Convention in Sidebar
**Source:** `src/components/sidebar/FileSection.tsx` lines 133-141 and `src/components/ui/button.tsx` line 29 (`icon: "size-8"`)
**Apply to:** `ThemeToggle` button

All icon buttons in the project use `size-8` (32×32px). Use `size="icon"` on `<Button>` which resolves to `size-8` automatically. Do not override with a custom `className` size unless deliberately deviating.

### useTheme() Fallback
**Source:** `src/components/ui/sonner.tsx` line 6
**Apply to:** Any component calling `useTheme()`

```tsx
// sonner.tsx line 6 — always destructure with a fallback for the pre-mount undefined case
const { theme = "system" } = useTheme()
```

---

## Test Analog (Planner Discretion)

D-07 specifies manual visual UAT only — no automated tests are required. However, the `ThemeBootstrap` persistence logic (async read/write + race guard) is testable unit logic. If the planner opts in to a test file, the established mock recipe is:

**Source:** `src/stores/useHistoryStore.test.ts` lines 1-14

```ts
// useHistoryStore.test.ts lines 1-14 — tauri-plugin-store mock pattern (project standard)
const { mockStore, mockGet, mockSet, mockSave } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(null); // null = no saved theme
  const mockStore = { get: mockGet, set: mockSet, save: mockSave };
  return { mockStore, mockGet, mockSet, mockSave };
});

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));
```

**Reset pattern between tests:**

```ts
// useHistoryStore.test.ts lines 32-37
beforeEach(() => {
  // Reset store state to prevent Zustand singleton bleed across tests
  useHistoryStore.setState({ entries: [], historyLoaded: false });
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
});
```

---

## No Analog Found

No files in this phase are without analog. All three files have strong role-match or exact analogs.

---

## CSS / Config Notes (No Changes Required)

| File | Status | Reason |
|---|---|---|
| `src/index.css` | NO CHANGE | `.dark {}` oklch block (lines 152-184) and `@custom-variant dark (&:is(.dark *))` (line 6) are already complete |
| `src/components/ui/sonner.tsx` | NO CHANGE | Already calls `useTheme()` from next-themes; works automatically once ThemeProvider is in the tree |
| `tailwind.config.*` | NOT APPLICABLE | Tailwind 4 uses `@custom-variant` in CSS; no config file needed |

The oklch `.dark {}` block at lines 152-184 is the cascade winner over the `@layer base .dark {}` block at lines 32-52. Any future dark mode visual investigation must target lines 152-184, not lines 32-52.

---

## Metadata

**Analog search scope:** `src/components/`, `src/stores/`, `src/App.tsx`, `src/index.css`
**Files scanned:** 9 source files read directly
**Pattern extraction date:** 2026-05-18
