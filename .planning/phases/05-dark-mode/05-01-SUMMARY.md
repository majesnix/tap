---
phase: 05-dark-mode
plan: 01
subsystem: ui
tags: [next-themes, tauri-plugin-store, react, dark-mode, theming]

# Dependency graph
requires: []
provides:
  - ThemeProvider wrapping App root with attribute="class", defaultTheme="system", enableSystem
  - ThemeBootstrap component bridging tauri-plugin-store (cross-restart authority) to next-themes localStorage
  - Bootstrap-mirror race guard via bootstrapped boolean flag
  - Unit tests for ThemeBootstrap persistence bridge (4 tests)
affects: [05-02-PLAN, 05-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ThemeBootstrap: child-of-ThemeProvider component for async store bootstrap with race guard"
    - "Bootstrap-mirror race guard: bootstrapped boolean gates mirror effect until async read completes"
    - "tauri-plugin-store bridge pattern for next-themes persistence (same as useHistoryStore bootstrap)"

key-files:
  created:
    - src/App.test.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "ThemeBootstrap exported as named export for direct unit test imports"
  - "bootstrapped flag gates mirror effect — prevents Pitfall 6 race where stale localStorage value clobbers tauri-plugin-store before bootstrap read completes"
  - "eslint-disable-line on bootstrap useEffect exhaustive-deps is intentional (one-shot mount effect)"
  - "Store path proto-sender.json and key theme-mode are top-level constants per project convention"

patterns-established:
  - "ThemeBootstrap pattern: child of ThemeProvider, reads tauri-plugin-store on mount, gates mirror writes on bootstrapped flag"

requirements-completed: [DRK-01, DRK-03]

# Metrics
duration: 2min
completed: 2026-05-18
---

# Phase 5 Plan 01: Dark Mode — ThemeProvider + ThemeBootstrap Persistence Bridge Summary

**next-themes ThemeProvider wrapping App root with ThemeBootstrap component bridging tauri-plugin-store to next-themes localStorage, race-safe via bootstrapped flag**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-18T19:43:32Z
- **Completed:** 2026-05-18T19:45:34Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Wrapped App root in ThemeProvider with `attribute="class"`, `defaultTheme="system"`, `enableSystem` — satisfies DRK-01 (OS preference detection via matchMedia)
- Implemented ThemeBootstrap component that reads tauri-plugin-store `"theme-mode"` on startup, calls `setTheme(saved)` to override localStorage (DRK-03 cross-restart persistence)
- Race guard via `bootstrapped` boolean flag prevents mirror effect from writing stale localStorage value to tauri-plugin-store before bootstrap read completes (Pitfall 6)
- 4 unit tests written and passing: load saved value, null-check guard, race guard, mirror write after bootstrap

## Task Commits

Each task was committed atomically:

1. **Task 1: ThemeBootstrap tests (RED)** - `72671e6` (test)
2. **Task 2: Implement ThemeProvider + ThemeBootstrap (GREEN)** - `bd9c3d3` (feat)

_TDD tasks: test commit (RED) then feat commit (GREEN)_

## TDD Gate Compliance

- RED gate: `test(05-01)` commit `72671e6` exists — all 4 tests failed as expected (ThemeBootstrap not yet exported)
- GREEN gate: `feat(05-01)` commit `bd9c3d3` exists — all 4 tests pass, build succeeds

## Files Created/Modified
- `src/App.tsx` - ThemeProvider root wrap + exported ThemeBootstrap component with bootstrap/mirror effects
- `src/App.test.tsx` - Unit tests for ThemeBootstrap persistence bridge (4 tests, vi.hoisted pattern)

## Decisions Made
- ThemeBootstrap is a named export (`export function ThemeBootstrap`) so `src/App.test.tsx` can import it directly without default import gymnastics
- Mirror effect includes both `theme` and `bootstrapped` in its dependency array — `bootstrapped` must be there to ensure the effect re-evaluates once bootstrap completes and the race is cleared
- `eslint-disable-line react-hooks/exhaustive-deps` on bootstrap `useEffect` is intentional: the effect is a one-shot mount read, not reactive

## Deviations from Plan

None — plan executed exactly as written. The verbatim App.tsx code from the plan was used without modification. Tests were written following the vi.hoisted() project standard pattern with a re-configurable `useTheme` mock per advisor guidance for Test 4.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. next-themes is already installed; tauri-plugin-store is already installed. No new dependencies added.

## Known Stubs
None. ThemeBootstrap is fully wired: reads from tauri-plugin-store on mount, writes back on theme change. No placeholder values in the UI flow.

## Next Phase Readiness
- Plan 05-02: ThemeToggle component (sidebar footer icon cycle button) can now call `useTheme().setTheme()` — the ThemeProvider context is in place
- Plan 05-03: DRK-04 visual UAT can now be run since ThemeProvider applies `.dark` class on `<html>` correctly
- DRK-01 and DRK-03 are delivered; DRK-02 awaits Plan 05-02 (ThemeToggle)

---
*Phase: 05-dark-mode*
*Completed: 2026-05-18*
