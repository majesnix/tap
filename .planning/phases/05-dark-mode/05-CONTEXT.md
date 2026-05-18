# Phase 5: Dark Mode - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add OS-aware theme support to the app: detect the OS dark/light preference on startup, provide an in-app icon button cycling between system/light/dark modes, apply the theme immediately across all existing UI surfaces, and persist the user's mode choice across restarts.

This phase is brownfield — all existing UI surfaces (form panel, connection sidebar, publish bar, AMQP properties sheet, message history panel, response tab, modals, shadcn/ui components) must render correctly in dark mode.

</domain>

<decisions>
## Implementation Decisions

### Theming Engine
- **D-01:** Use `next-themes` ThemeProvider with `attribute="class"` as the primary theming mechanism. Wrap the App root with `<ThemeProvider defaultTheme="system" attribute="class">`. The `.dark` CSS class selector is already defined in `src/index.css` — zero CSS changes required.
- **D-02:** Sonner toast component already calls `useTheme()` from `next-themes` — it works automatically once ThemeProvider is in the component tree. No changes to `sonner.tsx` needed.
- **D-03:** On theme mode change, save the selected mode (`"system"` | `"light"` | `"dark"`) to `tauri-plugin-store` (same persistence mechanism as connection profiles). On app startup, load the saved mode from the store and use it as `defaultTheme` on ThemeProvider to satisfy DRK-03.

### Toggle UI
- **D-04:** The toggle lives in the **sidebar footer** — bottom of the left sidebar, inline with the version string. Low prominence, set-and-forget placement consistent with dev tool conventions.
- **D-05:** The toggle is a compact **icon button that cycles** through three states: system (Monitor icon) → light (Sun icon) → dark (Moon icon) → system. Uses `lucide-react` icons (already available via shadcn/ui). The current mode is communicated by which icon is displayed.

### Live OS Sync
- **D-06:** When mode is "system", the app responds in **real-time** to OS theme changes while running (e.g., auto dark mode at sunset). `next-themes` ThemeProvider handles the `matchMedia` change listener automatically — no extra code needed.

### DRK-04 Verification
- **D-07:** DRK-04 is verified by **manual visual UAT only** — a human walkthrough checklist covering each surface (form panel, connection sidebar, publish bar, AMQP properties sheet, message history panel, response tab, modals). No automated snapshot/visual regression tests. The CSS variables are already defined; what matters is visual inspection of the actual rendered output.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Phase Goals
- `.planning/REQUIREMENTS.md` — 4 DRK requirements (DRK-01 through DRK-04) with exact acceptance criteria
- `.planning/ROADMAP.md` §Phase 5 — phase goal, success criteria, and "UI hint: yes" flag

### Existing Theme Infrastructure
- `src/index.css` — `.dark {}` CSS variables already defined at lines 30–50; `:root {}` light variables at lines 6–28. The `@custom-variant dark (&:is(.dark *))` rule is set. No CSS changes needed.
- `src/components/ui/sonner.tsx` — already imports `useTheme` from `next-themes`; works automatically once ThemeProvider is present

### Dependencies in Play
- `package.json` — `next-themes@^0.4.6` already declared and installed; `tauri-plugin-store` already available

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `next-themes@0.4.6`: ThemeProvider, useTheme — installed, zero new dependencies
- `lucide-react` (via shadcn/ui): Sun, Moon, Monitor icons for the toggle button
- `shadcn/ui` Button component: wraps the icon toggle
- `tauri-plugin-store` (JS bindings already in use): save/load theme mode key
- `src/stores/useConnectionStore.ts`: reference pattern for how tauri-plugin-store is used for persistence

### Established Patterns
- Persistence via `tauri-plugin-store` (not localStorage directly) — see connection profile storage in `useConnectionStore.ts`
- shadcn/ui components for all UI elements — Button, icons from lucide-react
- Zustand stores for global state — but theme state is owned by next-themes context (no new zustand store needed)

### Integration Points
- `src/App.tsx`: wrap `<AppLayout />` and `<Toaster />` inside `<ThemeProvider attribute="class" defaultTheme={savedMode}>`. Load saved mode from tauri-plugin-store here (or in a useEffect before render).
- `src/components/sidebar/Sidebar.tsx` footer section: add icon cycle button between version string and bottom. The `<div className="flex-1" />` spacer and the `text-xs text-muted-foreground text-center` version div are the target area.
- `src/index.css`: no changes needed — `.dark` class and all CSS variables already in place.

</code_context>

<specifics>
## Specific Ideas

- The cycle order is: system → light → dark → system (wrap around)
- Icon per mode: Monitor (system), Sun (light), Moon (dark) — standard convention
- The toggle should be small and unobtrusive — consistent with the "v0.1.0 — Walking Skeleton" version string aesthetic in the same footer area

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Dark-Mode*
*Context gathered: 2026-05-18*
