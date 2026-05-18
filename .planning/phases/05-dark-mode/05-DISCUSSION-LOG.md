# Phase 5: Dark Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 05-dark-mode
**Areas discussed:** Theming engine, Toggle placement & style, Live OS sync, DRK-04 verification scope

---

## Theming Engine

| Option | Description | Selected |
|--------|-------------|----------|
| next-themes as provider | Wrap App in ThemeProvider; Sonner already wired; save to tauri-plugin-store on change | ✓ |
| Custom zustand + tauri-plugin-store | New useThemeStore, manual .dark class management, replace useTheme() in sonner.tsx | |
| next-themes only (localStorage) | Use next-themes purely, ignore tauri-plugin-store | |

**User's choice:** next-themes as provider (with tauri-plugin-store save on change)
**Notes:** ThemeProvider attribute="class" confirmed — matches existing .dark CSS selector exactly.

---

## Toggle Placement & Style

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar footer | Bottom of left sidebar, next to version string | ✓ |
| Sidebar header | Next to "Proto Sender" h1 title | |
| You decide | Claude picks sidebar footer | |

**User's choice:** Sidebar footer

### Style

| Option | Description | Selected |
|--------|-------------|----------|
| Icon button cycling | Sun/Moon/Monitor icon cycles through system→light→dark→system | ✓ |
| 3-way segmented control | [System] [Light] [Dark] buttons side by side | |
| Sun/moon icon only (2-state) | Light/dark only (no system mode — ruled out, violates DRK-02) | |

**User's choice:** Icon button cycling
**Notes:** compact, minimal — fits the dev tool aesthetic.

---

## Live OS Sync

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, live sync | next-themes handles matchMedia listener automatically | ✓ |
| Startup only | Read OS preference at launch only | |

**User's choice:** Yes, live sync (recommended)
**Notes:** next-themes ThemeProvider provides this for free — no extra code.

---

## DRK-04 Verification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Manual visual UAT only | Human walkthrough checklist per surface | ✓ |
| Automated snapshot tests | Vitest snapshots with .dark class applied | |
| You decide | Claude recommends manual UAT | |

**User's choice:** Manual visual UAT only
**Notes:** Snapshot tests for dark mode would verify CSS variable existence, not visual correctness. Human walkthrough is more useful for this requirement.

---

## Claude's Discretion

None — user made explicit choices for all presented options.

## Deferred Ideas

None — discussion stayed within phase scope.
