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

> **Implementation deviation from D-03 literal wording:** D-03 says "use saved mode as `defaultTheme`". Research (verified via next-themes source) shows `defaultTheme` is only a fallback when localStorage is empty — once the user changes the theme once, localStorage always wins and `defaultTheme` is ignored on all subsequent startups. This research implements DRK-03 spirit (tauri-plugin-store is authoritative) via an explicit `setTheme()` call in a bootstrap effect instead of `defaultTheme`. See Pitfall 3 for full details.

### Claude's Discretion
(None specified — all decisions are locked)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRK-01 | App detects OS dark/light preference on startup and applies automatically when mode is "system" | `next-themes` ThemeProvider with `enableSystem=true` (default) + `matchMedia` listener handles this automatically |
| DRK-02 | User can switch between system/light/dark via toggle control | `useTheme().setTheme()` + cycle button in sidebar footer; mounted-flag pattern prevents undefined `theme` render |
| DRK-03 | Selected theme mode persists across app restarts | Two-store mirror pattern: next-themes writes localStorage; bootstrap effect reads `tauri-plugin-store` and calls `setTheme()` (authoritative override); mirror effect (gated on bootstrap complete) writes back on change |
| DRK-04 | All existing UI surfaces render correctly in dark mode | Both CSS variable blocks in `index.css` are already in place; DRK-04 satisfaction is a manual visual UAT walkthrough per D-07 |
</phase_requirements>

---

## Summary

Phase 5 adds dark mode to an already-scaffolded brownfield Tauri 2 React app. The theming infrastructure is almost entirely in place: `next-themes@0.4.6` is installed, `src/index.css` has two complete `.dark {}` CSS variable blocks (HSL and oklch), and `sonner.tsx` already uses `useTheme()`. The only work is connecting the pieces: wrap the App root in `ThemeProvider`, add a three-state icon toggle in the sidebar footer, and persist the mode choice across restarts.

The non-obvious challenge is the **persistence bridge**. `next-themes` uses `localStorage` internally — there is no custom storage adapter. `tauri-plugin-store` (D-03) is a separate store. The recommended pattern is to let next-themes own the in-session truth via localStorage, mirror each change to `tauri-plugin-store` (gated on bootstrap completion to avoid the startup race), and on startup read `tauri-plugin-store` first — calling `setTheme()` explicitly to override whatever next-themes found in localStorage. The bootstrap-complete flag is the critical guard: without it, the mirror effect can race the bootstrap effect and clobber the saved value before it is read.

**Primary recommendation:** Two-store mirror pattern with a `bootstrapped` boolean gate in `ThemeBootstrap`. Bootstrap reads tauri-plugin-store, calls `setTheme(saved)`, then sets `bootstrapped = true`. The mirror effect only fires when `bootstrapped && theme` are both truthy.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Theme class application (`.dark` on `<html>`) | Browser / Client | — | next-themes injects a script that applies the class synchronously before first paint |
| Theme preference persistence | Browser localStorage (next-themes) | tauri-plugin-store (cross-restart authority) | next-themes cannot be given a custom storage adapter; mirror pattern bridges both |
| OS preference detection (`prefers-color-scheme`) | Browser / Client | — | `matchMedia` is a browser API; next-themes adds/removes the listener automatically |
| Toggle UI | Frontend (React component) | — | Stateless icon button cycling modes via `setTheme()` |
| Theme bootstrap on app start | Frontend (App.tsx / ThemeBootstrap) | — | Async read from tauri-plugin-store then `setTheme()` call; sets bootstrap-complete flag |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-themes` | 0.4.6 (installed) | ThemeProvider + useTheme hook | Already installed; handles matchMedia, localStorage, flash prevention, cross-tab sync |
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
  ├─► ThemeBootstrap useEffect (mount, empty deps)
  │     → tauri-plugin-store.get("theme-mode")
  │     → if found: setTheme(saved)  [overrides localStorage — authoritative]
  │     → setBootstrapped(true)
  │
  └─► All children render; theme class is correct

User changes theme (sidebar toggle)
  │
  ├─► ThemeToggle onClick → cycle(current) → setTheme(nextMode)
  │     → next-themes writes to localStorage + applies class on <html>
  │
  └─► ThemeBootstrap useEffect([theme, bootstrapped])
        → if (!bootstrapped || !theme) return;   [race guard]
        → tauri-plugin-store.set("theme-mode", theme) → store.save()

OS preference changes (matchMedia fires)
  │
  └─► next-themes internal listener → re-evaluates .dark/.light on <html> [D-06 — automatic]
```

### Recommended Project Structure
```
src/
├── App.tsx                              # ThemeProvider wrap + ThemeBootstrap
├── components/
│   ├── sidebar/
│   │   ├── Sidebar.tsx                  # Add ThemeToggle in footer area
│   │   └── ThemeToggle.tsx              # New: icon cycle button (Sun/Moon/Monitor)
│   └── ui/
│       └── sonner.tsx                   # Already uses useTheme — no changes
└── index.css                            # Already complete — no changes
```

### Pattern 1: ThemeProvider Wrapping in App.tsx (with race-safe bootstrap)
**What:** Wrap `AppLayout` and `Toaster` inside `ThemeProvider`. `ThemeBootstrap` is a child of the provider (so `useTheme()` works) and manages the bidirectional persistence bridge.
**When to use:** Root-level, wraps entire component tree.

```tsx
// Source: next-themes README (node_modules/next-themes/README.md) +
//         tauri-plugin-store README (node_modules/@tauri-apps/plugin-store/README.md)
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { load } from "@tauri-apps/plugin-store";

const THEME_STORE_PATH = "tap.json";
const THEME_MODE_KEY = "theme-mode";

function ThemeBootstrap() {
  const { setTheme, theme } = useTheme();
  const [bootstrapped, setBootstrapped] = useState(false);

  // DRK-03 — read authoritative mode from tauri-plugin-store on startup.
  // Must complete before the mirror effect is allowed to write (bootstrapped flag).
  useEffect(() => {
    load(THEME_STORE_PATH).then((store) =>
      store.get<string>(THEME_MODE_KEY).then((saved) => {
        if (saved) setTheme(saved);
        setBootstrapped(true);
      })
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional one-shot

  // DRK-03 — mirror each user-initiated change back to tauri-plugin-store.
  // MUST be gated on bootstrapped: without this guard, the effect fires on
  // first mount (theme = localStorage value) before the async bootstrap read
  // completes, clobbering the saved tauri-plugin-store value with the stale
  // localStorage value and losing the cross-restart truth.
  useEffect(() => {
    if (!bootstrapped || !theme) return;
    load(THEME_STORE_PATH).then((store) => {
      store.set(THEME_MODE_KEY, theme);
      store.save();
    });
  }, [theme, bootstrapped]);

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

**Critical notes:**
- `ThemeBootstrap` must be a _child_ of `ThemeProvider` — placing it as a sibling makes `useTheme()` return a stub where `setTheme` is a no-op.
- `bootstrapped` gate is non-negotiable. See Pitfall 6 for the race scenario.
- Tauri 2 is CSR-only; `suppressHydrationWarning` on `<html>` (mentioned in next-themes docs for SSR) is not needed.

### Pattern 2: ThemeToggle Component with Mounted Guard
**What:** Icon cycle button that only renders after mount (avoids undefined `theme` on first paint).
**When to use:** Sidebar footer. Follows the mounted-flag pattern from next-themes docs.

```tsx
// Source: next-themes README (node_modules/next-themes/README.md)
// Button API: src/components/ui/button.tsx — variant="ghost" and size="icon" both confirmed
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
// Sun, Moon, Monitor verified via Node.js require probe on installed node_modules
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

  // Return same-size placeholder before mount to avoid layout shift
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
**Current sidebar footer (from `Sidebar.tsx`, lines 57-62):**

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
- **Calling `useTheme()` outside ThemeProvider:** Returns a stub. `ThemeBootstrap` must be a child of `ThemeProvider`, not a sibling.
- **Rendering theme-dependent UI without mounted guard:** `theme` is `undefined` before client mount. Return a same-size disabled placeholder, not `null`, to avoid layout shift.
- **Using `defaultTheme` as the persistence mechanism:** `defaultTheme` is only a fallback when localStorage is empty. After any `setTheme()` call, localStorage always wins on subsequent startups — `defaultTheme` is permanently bypassed. See Pitfall 3.
- **`localStorage` direct access:** next-themes owns the `"theme"` localStorage key. Always use `setTheme()` / `useTheme()`.
- **Mirror effect without bootstrap gate:** Causes the race in Pitfall 6. The mirror effect dependency array must include `bootstrapped`.

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

Two parallel `.dark` blocks exist in `src/index.css`. Both are in effect; the oklch block (lines 152-184) wins by cascade order (appears later, outside `@layer`) over the `@layer base` HSL block (lines 32-52).

| Block | Format | Location | Status |
|-------|--------|----------|--------|
| `@layer base :root {}` | HSL `hsl(n n% n%)` | Lines 9-30 | Light variables |
| `@layer base .dark {}` | HSL | Lines 32-52 | Dark overrides (superseded by oklch block) |
| `:root {}` (outside layer) | oklch | Lines 117-150 | Light variables, wins by cascade |
| `.dark {}` (outside layer) | oklch | Lines 152-184 | Dark overrides, wins by cascade; also defines `--sidebar-*` variables |

**For the planner:** Visual defects in dark mode trace to the oklch `.dark {}` block (lines 152-184). The HSL `.dark {}` block (lines 32-52) has no visible effect. No changes are needed to `index.css` for this phase.

---

## Button Component API (Verified)

`src/components/ui/button.tsx` (inspected) confirms these variants and sizes exist:
- `variant="ghost"` — confirmed (line 18 of button.tsx)
- `size="icon"` — confirmed, produces `size-8` (line 29 of button.tsx)

The `ThemeToggle` pattern in Pattern 2 uses these without custom overrides.

---

## Common Pitfalls

### Pitfall 1: `useTheme()` Returns `undefined` Before Mount
**What goes wrong:** `theme` is `undefined` on first render; icon button renders incorrectly or throws.
**Why it happens:** next-themes reads localStorage on the client only. `theme` is undefined until after mount.
**How to avoid:** Use the mounted-flag pattern (shown in ThemeToggle above). Return a same-size disabled placeholder before mount.
**Warning signs:** TypeScript shows `theme: string | undefined`; runtime shows wrong icon on first paint.

### Pitfall 2: `ThemeBootstrap` Placed Outside `ThemeProvider`
**What goes wrong:** `useTheme()` returns the stub context `{ setTheme: () => {}, themes: [] }`, so `setTheme()` is a no-op; DRK-03 fails silently.
**Why it happens:** next-themes exports a stub context for `useTheme()` callers outside the provider boundary.
**How to avoid:** `ThemeBootstrap` (or any component calling `useTheme()`) must be a child of `ThemeProvider` in the tree.
**Warning signs:** Persisted theme not restored on restart; no TypeScript error.

### Pitfall 3: `defaultTheme` Not Sufficient for DRK-03
**What goes wrong:** Setting `defaultTheme={savedMode}` on `ThemeProvider` appears to restore the mode, but only works once (first render with empty localStorage). After first `setTheme()` call, localStorage value persists and `defaultTheme` is ignored on subsequent starts.
**Why it happens:** Verified from next-themes source: `setState(() => localStorage.getItem(storageKey) || defaultTheme)`. The localStorage value always beats `defaultTheme`.
**How to avoid:** Use the `setTheme()` call in `ThemeBootstrap` bootstrap effect — this always overrides localStorage with the tauri-plugin-store value.
**Warning signs:** Mode restored correctly on first install, fails after user changes theme once.

### Pitfall 4: Mirror Effect Fires With `theme = undefined`
**What goes wrong:** The `useEffect([theme])` fires on mount with `theme = undefined`, writing `undefined` to `tauri-plugin-store`, corrupting the persisted value.
**Why it happens:** `theme` is `undefined` before mount; the effect fires immediately on mount.
**How to avoid:** Guard with `if (!theme) return;` in the mirror effect. Shown in Pattern 1.
**Warning signs:** Saved mode becomes `null` or the string `"undefined"` in tauri-plugin-store; mode not restored on next start.

### Pitfall 5: Two `.dark {}` Blocks in index.css
**What goes wrong:** Developers edit the `@layer base .dark {}` block (lines 32-52) expecting it to affect the rendered output, but it has no effect because the later oklch block wins.
**Why it happens:** CSS cascade order: non-layered rules always beat `@layer` rules.
**How to avoid:** Any dark mode visual investigation or future edits must target the oklch `.dark {}` block (lines 152-184).
**Warning signs:** HSL `.dark {}` edits have no visual effect.

### Pitfall 6: Bootstrap-Mirror Race Condition (Critical)
**What goes wrong:** DRK-03 passes on first install, then intermittently fails — the saved mode from tauri-plugin-store is overwritten by the stale localStorage value before it can be read.
**Why it happens:** On mount, both `useEffect` handlers schedule async work:
  1. Bootstrap effect: `load(store).get("theme-mode")` — async, reads authoritative tauri value
  2. Mirror effect: `load(store).set("theme-mode", theme)` — async, writes current localStorage-derived `theme`

  If the mirror's `set()` resolves before the bootstrap's `get()` reads, the bootstrap reads the value that was just overwritten by the mirror and the saved preference is permanently lost.
**How to avoid:** Gate the mirror effect on `bootstrapped === true`. Do not allow any write to tauri-plugin-store until the bootstrap read is confirmed complete. Shown in Pattern 1.
**Warning signs:** Saved theme is reliably restored when testing in isolation; fails intermittently (race-dependent) in normal use, especially on slower machines.

---

## Code Examples

### Persistence Mock Recipe (for tests)
Tests involving `ThemeBootstrap` need the same `@tauri-apps/plugin-store` mock used across the project:

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
// attribute="class"        — applies .dark class to <html> (matches index.css selector)
// defaultTheme="system"    — fallback ONLY when localStorage is empty
// enableSystem={true}      — default; enables matchMedia listener (DRK-01)

// useTheme() returns:
// theme: "system" | "light" | "dark" | undefined (undefined before mount)
// setTheme(name): writes to localStorage + applies class synchronously
// resolvedTheme: "light" | "dark" — what actually shows (system resolves to one or other)
// systemTheme: "light" | "dark" — current OS preference regardless of active theme
```

### Icon Imports (Verified)
```typescript
// Source: Node.js require() probe on node_modules/lucide-react (lucide-react@1.16.0)
// Both bare names and *Icon suffixed variants are exported:
import { Sun, Moon, Monitor } from "lucide-react";
// Sun, Moon, Monitor confirmed as ForwardRefExoticComponent exports
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
| A1 | `localStorage` is available and functional in Tauri 2 webview on all target platforms (macOS, Windows, Linux) | Architecture Patterns | Low — Tauri embeds a real browser engine; localStorage is Web Storage API; the entire project already depends on next-themes which uses localStorage. No explicit Tauri docs check done. |
| A2 | `matchMedia("prefers-color-scheme: dark")` fires reactively on OS theme change in all three Tauri 2 target webviews (WKWebView / WebView2 / WebKitGTK) | D-06, Architecture Patterns | Low on macOS + Windows; medium on very old Linux WebKitGTK where `addListener` may not fire on system theme change. |

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
- `node_modules/next-themes/dist/index.js` — Source-verified: `setTheme` calls `localStorage.setItem(storageKey, value)`; `defaultTheme` is only the fallback when localStorage is empty; no custom storage adapter prop
- `node_modules/lucide-react/dist/lucide-react.d.ts` + Node.js require probe — Sun, Moon, Monitor (and *Icon variants) confirmed exported at lucide-react@1.16.0
- `src/index.css` (inspected) — Two `.dark {}` blocks confirmed; oklch block (lines 152-184) wins by cascade
- `src/App.tsx` (inspected) — Current structure: `<AppLayout />` + `<Toaster />`; no ThemeProvider yet
- `src/components/sidebar/Sidebar.tsx` (inspected) — Footer structure: `flex-1` spacer + version div
- `src/components/ui/button.tsx` (inspected) — `variant="ghost"` (line 18) and `size="icon"` (line 29) confirmed
- `src/stores/useHistoryStore.ts` + `useHistoryStore.test.ts` (inspected) — tauri-plugin-store usage pattern and test mock recipe
- `src/components/sidebar/FileSection.tsx` (inspected) — tauri-plugin-store `load()` + `store.get/set/save` pattern
- `node_modules/@tauri-apps/plugin-store/README.md` — v2 `load()` / `get()` / `set()` / `save()` API confirmed

### Secondary (MEDIUM confidence)
- next-themes source code inspection confirms no custom storage adapter prop exists in v0.4.6

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and verified in node_modules
- Architecture: HIGH — next-themes source confirms localStorage behavior; persistence bridge pattern and bootstrap race fix are derived from verified next-themes source
- Pitfalls: HIGH — Pitfalls 1-4, 6 derived from verified next-themes source behavior; Pitfall 5 from direct CSS inspection

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (next-themes, lucide-react are stable; tauri-plugin-store v2 is stable)
