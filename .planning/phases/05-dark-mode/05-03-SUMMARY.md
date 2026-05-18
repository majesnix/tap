---
phase: 05-dark-mode
plan: "03"
subsystem: ui
tags: [dark-mode, uat, visual-inspection, dRK-04, manual-verification]

# Dependency graph
requires:
  - phase: "05-01"
    provides: "ThemeProvider + ThemeBootstrap persistence bridge"
  - phase: "05-02"
    provides: "ThemeToggle component in sidebar footer"
provides:
  - "Human UAT sign-off on DRK-04 visual surface checklist (pending)"
affects:
  - "05-04-PLAN (gap plan if defects found)"

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/05-dark-mode/05-HUMAN-UAT.md (to be created after human sign-off)
  modified: []

key-decisions:
  - "DRK-04 verified by manual visual UAT only per D-07 — no automated check substitutes for visual inspection"
  - "Gap plan (05-04) to be created if defects are found during UAT"

patterns-established: []

requirements-completed: []  # DRK-04 pending human approval

# Metrics
duration: pending
completed: pending
---

# Phase 5 Plan 03: DRK-04 Manual Visual UAT — Dark Mode Surface Walkthrough Summary

**Manual visual UAT checkpoint for DRK-04 — human walks through all UI surfaces in dark mode to confirm correct rendering after Plans 01 and 02 shipped**

## Status

**AWAITING HUMAN APPROVAL** — this plan is a `checkpoint:human-verify` gate. No automated tasks run.

Plans 05-01 and 05-02 have been executed and committed:
- ThemeProvider wraps the App root (DRK-01: OS preference, DRK-03: persistence)
- ThemeToggle icon cycle button is in the sidebar footer (DRK-02: user can switch modes)

The dark mode CSS variables were already complete in `src/index.css` (`.dark {}` block). This UAT verifies the CSS + next-themes integration produces correct visuals across all surfaces.

## Prerequisites for UAT

1. Run the app: `npm run tauri dev` (from project root `/Users/majesnix/gits/proto-sender`)
2. Switch to dark mode using the ThemeToggle button in the sidebar footer (click to cycle: Monitor → Sun → Moon — click twice to reach Moon/dark)

## DRK-04 Surface Checklist

Walk through each surface in dark mode and confirm:
- Text is legible (no invisible text)
- Borders and separators are visible
- Icons and buttons have sufficient contrast
- Interactive elements show visible state changes

### Left Sidebar
- [ ] Sidebar structure — background, separators, section headers
- [ ] FileSection — "Load .proto file" button, include path list items
- [ ] ConnectionSection — profile dropdown, status dot (green/red/yellow), "Manage..." button
- [ ] Message type select — dropdown trigger + content list
- [ ] Footer — version string legible; ThemeToggle visible with icon; hover state visible

### Form Panel
- [ ] Form panel container — background, encode status badge (green/red)
- [ ] Scalar fields — input borders, labels, validation error text
- [ ] NestedMessageField — collapse/expand chevron, nested section border
- [ ] RepeatedField — add/remove row controls, row separators
- [ ] EnumField — Select dropdown trigger and content
- [ ] OneofField — RadioGroup items, branch selector
- [ ] WellKnownTypeField — Duration/Timestamp dual inputs

### Publish Bar
- [ ] PublishBar — exchange/queue picker, routing key input, "Publish" button
- [ ] AmqpPropertiesSheet — open sheet; all fields, content-type, delivery mode switch, TTL, headers table; Apply/Cancel buttons

### Right Panel
- [ ] RightPanel tabs — tab triggers (Form / History / Response), active tab indicator
- [ ] HistoryPanel — entry list rows, filter controls, replay/resend button, status badges
- [ ] Response tab — queue picker (Live/Manual toggle), decoded view, hex section, empty state

### Modals and Overlays
- [ ] Connection profile modal (Dialog) — all inputs, test button, save button
- [ ] AlertDialog confirm/cancel — open delete profile confirm; verify button contrast
- [ ] Sonner toasts — success toast (send message) and error toast (wrong credentials); both legible

### shadcn/ui Component Sweep
- [ ] Input fields — focused state ring visible
- [ ] Select (Radix) — open state, item highlight on hover
- [ ] Switch — checked/unchecked states clearly distinct
- [ ] RadioGroup — selected/unselected item visual difference
- [ ] Tabs — active/inactive tab clear distinction
- [ ] Popover/Tooltip — content background not transparent
- [ ] Badge — status colors readable
- [ ] ScrollArea — scrollbar visible or at minimum functional
- [ ] Separator — visible (not blending with background)

### Theme Toggle Behavior
- [ ] Cycle through all three modes: Moon (dark) → Monitor (system) → Sun (light) → Moon (dark)
- [ ] Each transition applies immediately (no reload)
- [ ] In system mode: matches OS preference
- [ ] Restart the app: previously selected mode is restored (DRK-03 cross-check)

## Resume Signal

After completing the walkthrough:
- Type **"approved"** if all surfaces pass visual inspection
- Or describe any defects found (e.g., "History panel entry text invisible in dark mode")

If defects are found, a gap plan (05-04-PLAN.md) will be created to fix them.

## Deviations from Plan

None — this plan is a checkpoint gate only. No code was written.

## Self-Check: PASSED

- [x] .planning/phases/05-dark-mode/05-03-SUMMARY.md created
- [x] Plans 05-01 and 05-02 committed and referenced (commits 72671e6, bd9c3d3, 9e4bc2c, 9538d43)
- [x] UAT checklist is complete (30+ items covering all surfaces from plan)

---
*Phase: 05-dark-mode*
*Completed: pending human UAT approval*
