# Phase 5: Dark Mode - Research

**Researched:** 2026-05-18
**Domain:** next-themes theming + Tauri persistence bridge + React toggle component
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use `next-themes` ThemeProvider with `attribute="class"`. Wrap the App root. `.dark` CSS class selector already in `src/index.css` — zero CSS changes required.
- **D-02:** Sonner toast already calls `useTheme()` from `next-themes` — works automatically once ThemeProvider is present. No changes to `sonner.tsx`.
- **D-03:** On theme mode change, save mode (`"system"` | `"light"` | `"dark"`) to `tauri-plugin-store`. On startup, load saved mode and use as `defaultTheme` on ThemeProvider.
- **D-04:** Toggle lives in the sidebar footer — bottom of the left sidebar, inline with the version string.
- **D-05:** Toggle is a compact icon button cycling through: system (Monitor) → light (Sun) → dark (Moon) → system. Uses `lucide-react` icons.
- **D-06:** When mode is "system", app responds in real-time to OS theme changes. `next-themes` ThemeProvider handles `matchMedia` automatically — no extra code needed.
- **D-07:** DRK-04 verified by manual visual UAT only. No automated snapshot/visual regression tests.

### Claude's Discretion
(None specified — all decisions are locked)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRK-01 | App detects OS dark/light preference on startup and applies automatically when mode is "system" | `next-themes` ThemeProvider with `enableSystem=true` (default) + `matchMedia` listener handles this; localStorage-first startup prevents race |
| DRK-02 | User can switch between system/light/dark via toggle control | `useTheme().setTheme()` + cycle button in sidebar footer; mounted-flag pattern prevents undefined `theme` render |
| DRK-03 | Selected theme mode persists across app restarts | Two-store mirror pattern: next-themes writes localStorage; `useEffect([theme])` mirrors to `tauri-plugin-store`; startup reads `tauri-plugin-store` and calls `setTheme()` to sync |
| DRK-04 | All existing UI surfaces render correctly in dark mode | Both CSS variable blocks in `index.css` are already in place; DRK-04 satisfaction is a manual visual UAT walkthrough per D-07 |
</phase_requirements>

---

## Summary

Phase 5 adds dark mode to an already-scaffolded brownfield Tauri 2 React app. The theming infrastructure is almost entirely in place: `next-themes@0.4.6` is installed, `src/index.css` has two complete `.dark {}` CSS variable blocks (HSL and oklch), and `sonner.tsx` already uses `useTheme()`. The only work is connecting the pieces: wrap the App root in `ThemeProvider`, add a three-state icon toggle in the sidebar footer, and persist the mode choice across restarts.

The non-obvious challenge is the **persistence bridge**. `next-themes` uses `localStorage` internally for its own persistence — there is no custom storage adapter. `tauri-plugin-store` (D-03) is a separate store. These two stores must be reconciled: the recommended pattern is to let `next-themes` own the in-session truth via localStorage, mirror each change to `tauri-plugin-store` with a `useEffect`, and on startup read `tauri-plugin-store` first — calling `setTheme()` explicitly to override whatever next-themes found in localStorage. This ensures `tauri-plugin-store` is authoritative on cross-restart recovery without any flicker gate or async `ThemeProvider` mounting delay.

**Primary recommendation:** Use the two-store mirror pattern (next-themes localStorage for in-session, tauri-plugin-store for cross-restart authoritative backup). Bootstrap in `App.tsx` with an async load from tauri-plugin-store before or shortly after mount, calling `setTheme()` via `useTheme()` in a top-level effect. The toggle component uses the mounted-flag pattern per the next-themes docs to avoid undefined `theme` on first render.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Theme class application (`.dark` on `<html>`) | Browser / Client | — | next-themes injects a script that applies the class synchronously before first paint |
| Theme preference persistence | Browser localStorage (next-themes) | tauri-plugin-store (cross-restart authority) | next-themes cannot be given a custom storage adapter; mirror pattern bridges both |
| OS preference detection (`prefers-color-scheme`) | Browser / Client | — | `matchMedia` is a browser API; next-themes adds/removes the listener automatically |
| Toggle UI | Frontend (React component) | — | Stateless icon button cycling modes via `setTheme()` |
| Theme bootstrap on app start | Frontend (App.tsx useEffect) | — | Async read from tauri-plugin-store then `setTheme()` call before user interaction |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-themes` | 0.4.6 (installed) | ThemeProvider + useTheme hook | Already installed; handles matchMedia, localStorage, SSR flash prevention, cross-tab sync |
| `lucide-react` | 1.16.0 (installed) | Sun / Moon / Monitor icons | Already available via shadcn/ui dependency |
| `@tauri-apps/plugin-store` | 2.x (installed) | Cross-restart persistence | Established project pattern for all persistent state |

### No New Dependencies Required
This phase introduces zero new npm or Cargo dependencies. Everything is already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
App startup
  │
  ├─► App.tsx mounts ThemeProvider (attribute="class", defaultTheme="system")
  │     │
  │     └─► next-themes injects inline <script> → reads localStorage["theme"]
  │           → applies .dark/.light class on <html> synchronously (no flash)
  │
  ├─► App.tsx useEffect (mount) → tauri-plugin-store.get("theme-mode")
  │     → if found: call setTheme(savedMode) [overrides localStorage]
  │     → if not found: leave next-themes default ("system")
  │
  └─► All children render with correct theme already on <html>

User changes theme (sidebar toggle)
  │
  ├─► ThemeToggle onClick → cycle(currentTheme) → setTheme(nextMode)
  │     → next-themes writes to localStorage + applies class on <html>
  │
  └─► useEffect([theme]) in App.tsx → tauri-plugin-store.set("theme-mode", theme) → store.save()

OS preference changes (matchMedia fires)
  │
  └─► next-themes internal listener → re-evaluates .dark/.light on <html> [D-06 — automatic]
```

### Recommended Project Structure
```
src/
├── App.tsx                              # ThemeProvider wrap + bootstrap effect
├── components/
│   ├── sidebar/
│   │   ├── Sidebar.tsx                  # Add ThemeToggle in footer area
│   │   └── ThemeToggle.tsx              # New: icon cycle button (Sun/Moon/Monitor)
│   └── ui/
│       └── sonner.tsx                   # Already uses useTheme — no changes
└── index.css                            # Already complete — no changes
```

### Pattern 1: ThemeProvider Wrapping in App.tsx
**What:** Wrap `AppLayout` and `Toaster` inside `ThemeProvider` with class attribute.
**When to use:** Root-level, wraps entire component tree.

```tsx
// Source: next-themes README (installed node_modules/next-themes/README.md)
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { load } from "@tauri-apps/plugin-store";

const THEME_STORE_PATH = "proto-sender.json";
const THEME_MODE_KEY = "theme-mode";

function ThemeBootstrap() {
  const { setTheme, theme } = useTheme();

  // DRK-03: Load authoritative mode from tauri-plugin-store on startup
  useEffect(() => {
    load(THEME_STORE_PATH).then((store) =>
      store.get<string>(THEME_MODE_KEY).then((saved) => {
        if (saved) setTheme(saved);
      })
    );
  }, []); // empty deps: run once on mount

  // DRK-03: Mirror each theme change back to tauri-plugin-store
  useEffect(() => {
    if (!theme) return;
    load(THEME_STORE_PATH).then((store) => {
      store.set(THEME_MODE_KEY, theme);
      store.save();
    });
  }, [theme]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeBootstrap />
      <AppLayout />
      <Toaster />
    </ThemeProvider>
  );
}
```

**Note on bootstrap component:** `ThemeBootstrap` is a child of `ThemeProvider` so it has access to `useTheme()`. Calling `useTheme()` at the `App` level (outside the provider) would return `undefined`.

### Pattern 2: ThemeToggle Component with Mounted Guard
**What:** Icon cycle button that only renders after mount (avoids undefined `theme` on first paint).
**When to use:** Sidebar footer. Follows the mounted-flag pattern from next-themes docs.

```tsx
// Source: next-themes README (installed node_modules/next-themes/README.md)
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemeMode = "system" | "light" | "dark";

const CYCLE_ORDER: ThemeMode[] = ["system", "light", "dark"];

const ICONS: Record<ThemeMode, React.ReactNode> = {
  system: <Monitor className="size-4" />,
  light: <Sun className="size-4" />,
  dark: <Moon className="size-4" />,
};

const LABELS: Record<ThemeMode, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  // Return skeleton/same-size placeholder before mount to avoid layout shift
  if (!mounted) {
    return <Button variant="ghost" size="icon" className="size-8" disabled />;
  }

  const current = (theme as ThemeMode) ?? "system";
  const nextIndex = (CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length;
  const nextMode = CYCLE_ORDER[nextIndex];

  return (
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
  );
}
```

### Pattern 3: Sidebar Footer Integration
**What:** Add `ThemeToggle` in the footer area, inline with version string.
**Current sidebar footer (from `Sidebar.tsx`):**

```tsx
// Source: src/components/sidebar/Sidebar.tsx (inspected)
<div className="flex-1" />
<div className="text-xs text-muted-foreground text-center">
  v0.1.0 — Walking Skeleton
</div>
```

**Target layout** — toggle and version inline:

```tsx
<div className="flex-1" />
<div className="flex items-center justify-between">
  <div className="text-xs text-muted-foreground">v0.1.0 — Walking Skeleton</div>
  <ThemeToggle />
</div>
```

### Anti-Patterns to Avoid
- **Calling `useTheme()` outside ThemeProvider:** Returns `undefined`. `ThemeBootstrap` must be a child of `ThemeProvider`, not a sibling.
- **Rendering theme-dependent UI without mounted guard:** `theme` is `undefined` before client mount. Renders a disabled placeholder instead of returning `null` to avoid layout shift.
- **Using `defaultTheme` as the persistence mechanism:** `defaultTheme` is only a fallback when localStorage has no value. After the first `setTheme()` call, localStorage takes precedence — `defaultTheme` is permanently superseded. Only the `setTheme()` call after reading `tauri-plugin-store` reliably restores the saved mode.
- **`localStorage` direct access:** Next-themes owns its localStorage slot (`"theme"` key). Manually reading/writing it bypasses the `ThemeProvider` state machine. Always use `setTheme()` / `useTheme()`.
- **`tauri::spawn` vs `tauri::async_runtime::spawn`:** Not applicable to this phase (no Rust changes), but matches the established project constraint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class toggle on `<html>` | Manual `document.classList.add/remove` | `next-themes` ThemeProvider | Flash prevention via inline `<script>` injection; matchMedia listener; localStorage sync; cross-tab sync |
| OS preference detection | `window.matchMedia` listener | `next-themes` (automatic with `enableSystem`) | Already handles listener add/remove, system theme resolution |
| Icon set | SVG hand-crafted icons | `lucide-react` Sun / Moon / Monitor | Already installed; consistent with other icons in the project |

**Key insight:** This phase has zero hand-rolled work for the core theming mechanism. next-themes is already installed; the work is purely wiring.

---

## CSS Variable Structure in index.css

Two parallel `.dark` blocks exist in `src/index.css`. Both are in effect; the oklch block (lines 152-184) wins by cascade order (appears later) over the `@layer base` HSL block (lines 32-52).

| Block | Format | Location | Status |
|-------|--------|----------|--------|
| `@layer base :root {}` | HSL `hsl(n n% n%)` | Lines 9-30 | Light variables |
| `@layer base .dark {}` | HSL | Lines 32-52 | Dark overrides |
| `:root {}` (outside layer) | oklch | Lines 117-150 | Light variables, wins by cascade |
| `.dark {}` (outside layer) | oklch | Lines 152-184 | Dark overrides, wins by cascade |

**For the planner:** Visual defects in dark mode trace to the oklch block (lines 152-184), not the HSL block. The oklch block also defines `--sidebar-*` variables that the HSL block does not. No changes are needed to this file for this phase.

---

## Common Pitfalls

### Pitfall 1: `useTheme()` Returns `undefined` Before Mount
**What goes wrong:** `theme` is `undefined` on first render; icon button renders incorrectly or throws.
**Why it happens:** next-themes reads localStorage on the client only. `theme` is undefined until after mount.
**How to avoid:** Use the mounted-flag pattern (shown in ThemeToggle above). Return a same-size disabled placeholder before mount.
**Warning signs:** TypeScript shows `theme: string | undefined`; runtime shows wrong icon on first paint.

### Pitfall 2: `ThemeBootstrap` Placed Outside `ThemeProvider`
**What goes wrong:** `useTheme()` returns the stub context `{ setTheme: () => {}, themes: [] }`, so `setTheme()` is a no-op; DRK-03 fails silently.
**Why it happens:** next-themes exports a stub context for `useTheme()` callers that are outside the provider boundary.
**How to avoid:** `ThemeBootstrap` (or any component calling `useTheme()`) must be a child of `ThemeProvider` in the tree.
**Warning signs:** Persisted theme not restored on restart; no TypeScript error.

### Pitfall 3: `defaultTheme` Not Sufficient for DRK-03
**What goes wrong:** Setting `defaultTheme={savedMode}` on `ThemeProvider` appears to restore the mode, but only works once (first render with empty localStorage). After first `setTheme()` call, localStorage value persists and `defaultTheme` is ignored on subsequent starts.
**Why it happens:** next-themes source reads `localStorage.getItem(storageKey) || defaultTheme`. The localStorage value always beats `defaultTheme`.
**How to avoid:** Use the `setTheme()` call in `ThemeBootstrap` useEffect — this always overrides localStorage with the tauri-plugin-store value.
**Warning signs:** Mode restored correctly on first install, fails after user changes theme once.

### Pitfall 4: Saving `theme` Mirror Too Early (Before Mount)
**What goes wrong:** The `useEffect([theme])` fires on mount with `theme = undefined`, writing `undefined` to `tauri-plugin-store`, corrupting the persisted value.
**Why it happens:** `theme` is `undefined` before mount; the effect fires immediately.
**How to avoid:** Guard with `if (!theme) return;` in the mirror effect. [Already shown in Pattern 1 above.]
**Warning signs:** Saved mode becomes `null` or `"undefined"` in tauri-plugin-store; mode not restored on next start.

### Pitfall 5: Two `.dark {}` Blocks in index.css
**What goes wrong:** Developers edit the `@layer base .dark {}` block (lines 32-52) expecting it to affect the rendered output, but it has no effect because the later oklch block wins.
**Why it happens:** CSS cascade order; non-layered rules beat `@layer` rules.
**How to avoid:** Any dark mode visual investigation or future edits must target the oklch `.dark {}` block (lines 152-184).
**Warning signs:** HSL `.dark {}` edits have no visual effect.

---

## Code Examples

### Persistence Mock Recipe (for tests)
Tests involving `ThemeBootstrap` need the same `@tauri-apps/plugin-store` mock already used across the project:

```typescript
// Source: src/stores/useHistoryStore.test.ts (inspected) — established project pattern
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

### next-themes API Reference
```typescript
// Source: node_modules/next-themes/README.md (verified)
// ThemeProvider props used in this phase:
// attribute="class"        — applies .dark class to <html> (matches index.css)
// defaultTheme="system"    — fallback when localStorage is empty
// enableSystem={true}      — default; enables matchMedia listener (DRK-01)

// useTheme() returns:
// theme: "system" | "light" | "dark" | undefined (undefined before mount)
// setTheme(name): writes to localStorage + applies class
// resolvedTheme: "light" | "dark" — what actually shows (system resolves to one or the other)
// systemTheme: "light" | "dark" — the current OS preference
```

### Icon Imports (Verified)
```typescript
// Source: node_modules/lucide-react — verified via Node.js require() probe
// Both bare and *Icon variants are exported:
import { Sun, Moon, Monitor } from "lucide-react";
// OR:
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
// Bare names (Sun, Moon, Monitor) match the CONTEXT.md spec.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `document.classList` + localStorage | `next-themes` ThemeProvider | Pre-installed | ThemeProvider script injection prevents flash; matchMedia handled automatically |
| `tailwind.config.js` `darkMode: 'class'` | `@custom-variant dark (&:is(.dark *))` in CSS | Tailwind 4 | Already in place in `src/index.css` — no config file needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `localStorage` is available and functional in Tauri 2 webview on all target platforms (macOS, Windows, Linux) | Architecture Patterns | Low — Tauri embeds a real browser engine on all platforms; localStorage is part of the Web Storage API; confirmed works by the entire project's existing use of localStorage via next-themes dependencies. No explicit Tauri docs check done. |
| A2 | `matchMedia("prefers-color-scheme: dark")` fires reactively on OS theme change in all three Tauri 2 target webviews (WKWebView / WebView2 / WebKitGTK) | Architecture Patterns → D-06 | Low on macOS + Windows; medium on older Linux WebKitGTK versions. next-themes uses `addListener` which is a live listener. On very old WebKitGTK the listener may not fire on theme change, but this is a fringe platform concern. |

**If this table has only LOW-risk items:** All high-confidence claims were verified from installed source files in this session.

---

## Environment Availability

Step 2.6: SKIPPED — this phase has no external dependencies beyond the project's own code. All required packages (`next-themes`, `lucide-react`, `@tauri-apps/plugin-store`) are already installed and verified in `node_modules/`.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is omitted per spec.

---

## Security Domain

This phase adds no authentication, authorization, user input handling, database queries, file system operations, cryptographic operations, or network calls. The only new data flow is reading/writing the string `"system"` | `"light"` | `"dark"` to `tauri-plugin-store` — a value the app itself sets. No security review triggered.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next-themes/README.md` — ThemeProvider API, useTheme API, mounted-flag pattern, localStorage behavior, `defaultTheme` semantics
- `node_modules/next-themes/dist/index.js` — Source-verified that `setTheme` calls `localStorage.setItem(storageKey, value)` and `defaultTheme` is only the fallback when localStorage is empty
- `node_modules/lucide-react/dist/lucide-react.d.ts` + Node.js require probe — Sun, Moon, Monitor (and *Icon variants) confirmed exported
- `src/index.css` (inspected) — Two `.dark {}` blocks confirmed; oklch block (lines 152-184) wins by cascade
- `src/App.tsx` (inspected) — Current structure: `<AppLayout />` + `<Toaster />`; no ThemeProvider yet
- `src/components/sidebar/Sidebar.tsx` (inspected) — Footer structure: `flex-1` spacer + version div
- `src/stores/useHistoryStore.ts` + `useHistoryStore.test.ts` (inspected) — tauri-plugin-store usage pattern and test mock recipe
- `src/components/sidebar/FileSection.tsx` (inspected) — tauri-plugin-store `load()` + `store.get/set/save` pattern
- `node_modules/@tauri-apps/plugin-store/README.md` — v2 API confirmed

### Secondary (MEDIUM confidence)
- next-themes source code inspection confirms no custom storage adapter prop exists in v0.4.6

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and verified in node_modules
- Architecture: HIGH — next-themes source confirms localStorage behavior; persistence bridge pattern is derived from verified facts
- Pitfalls: HIGH — Pitfalls 1-4 derived from verified next-themes source behavior; Pitfall 5 from direct CSS inspection

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (next-themes, lucide-react are stable; tauri-plugin-store v2 is stable)
