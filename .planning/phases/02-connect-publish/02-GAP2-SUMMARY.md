---
phase: 02-connect-publish
plan: GAP2
subsystem: ui
tags: [react, tailwind, shadcn, dialog, scroll, layout]

# Dependency graph
requires:
  - phase: 02-connect-publish
    provides: ProfileManagementModal component with connection profile CRUD
provides:
  - Scrollable modal layout via max-h-[85vh] flex-col on DialogContent and overflow-y-auto scroll container
affects: [02-connect-publish]

# Tech tracking
tech-stack:
  added: []
  patterns: [flex flex-col layout with overflow-y-auto scroll container for bounded modal height]

key-files:
  created: []
  modified:
    - src/components/connection/ProfileManagementModal.tsx
    - src/components/connection/__tests__/ProfileManagementModal.test.tsx

key-decisions:
  - "max-h-[85vh] on DialogContent — 85vh leaves ~15% chrome for OS chrome on compact displays"
  - "overflow-hidden on DialogContent prevents visual bleed before inner scroll kicks in"
  - "flex-1 min-h-0 on scroll container — min-h-0 required to defeat flexbox default min-height:auto"
  - "DialogHeader kept outside scroll container so title is always pinned at top"
  - "Action buttons scroll with form content (simplest approach, within gap scope)"
  - "data-testid='profile-modal-scroll' added for test targeting"

patterns-established:
  - "Bounded modal pattern: DialogContent gets max-h-[Xvh] flex flex-col overflow-hidden; inner scroll wrapper gets flex-1 min-h-0 overflow-y-auto"

requirements-completed: [CONN-01]

# Metrics
duration: 10min
completed: 2026-05-17
---

# Phase 02 Plan GAP2: Modal Scroll Layout Summary

**ProfileManagementModal bounded to 85vh with flex scroll container so many profiles cannot push content off-screen**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-17T23:49:00Z
- **Completed:** 2026-05-17T23:51:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- DialogContent capped at `max-h-[85vh]` with `flex flex-col overflow-hidden` — modal never grows off-screen
- Scroll wrapper div (`flex-1 min-h-0 overflow-y-auto`) wraps all body content below DialogHeader
- DialogHeader (title "Connection Profiles") pinned outside the scroll container — always visible
- Two new scroll layout tests pass (RED/GREEN TDD); all 14 ProfileManagementModal tests green
- TypeScript compiles clean; no Rust files or dialog.tsx touched; AlertDialogContent unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scroll container to ProfileManagementModal layout** - `1398733` (feat)

**Plan metadata:** (added in final commit)

## Files Created/Modified
- `src/components/connection/ProfileManagementModal.tsx` - Added `max-h-[85vh] flex flex-col overflow-hidden` to DialogContent; wrapped body in scroll container div
- `src/components/connection/__tests__/ProfileManagementModal.test.tsx` - Added `describe("scroll layout")` block with two class-presence tests

## Decisions Made
- `max-h-[85vh]` chosen over fixed px height to stay proportional across display sizes (768p laptops through 4K)
- `overflow-hidden` on DialogContent prevents the outer dialog box from visually leaking; the inner scroll div handles actual overflow
- `min-h-0` on the scroll container is required — without it, flexbox children default to `min-height: auto`, which defeats the scroll constraint
- Action buttons (Cancel / Test Connection / Save & Connect) scroll with form content — simplest approach, within gap scope, acceptable UX for a dev tool

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- UAT gap 2 closed — modal scrolls correctly when many profiles are saved
- Phase 03 planning can proceed

## Known Stubs

None.

## Threat Flags

None — pure layout change, no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check

- [x] `src/components/connection/ProfileManagementModal.tsx` — modified
- [x] `src/components/connection/__tests__/ProfileManagementModal.test.tsx` — modified
- [x] Task commit `1398733` exists in git log
- [x] All 14 tests pass (npm test exits 0)
- [x] TypeScript compiles clean (npx tsc --noEmit exits 0)
- [x] grep confirms: max-h-[85vh]=1, flex flex-col overflow-hidden=1, min-h-0 overflow-y-auto=1, data-testid="profile-modal-scroll"=1, AlertDialogContent=3

## Self-Check: PASSED

---
*Phase: 02-connect-publish*
*Completed: 2026-05-17*
