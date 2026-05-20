---
phase: 12-block-library-drag-and-drop-layer
plan: "01"
subsystem: form-renderer
tags: [applyBlockRef, react-hook-form, tdd, block-library, drag-and-drop]
dependency_graph:
  requires: []
  provides: [applyBlockRef-contract]
  affects: [ProtoFormRenderer, FormPanel-plan02]
tech_stack:
  added: []
  patterns: [ref-wiring-pattern, useEffect-cleanup, formState-dirtyFields]
key_files:
  created: []
  modified:
    - src/components/form/ProtoFormRenderer.tsx
    - src/components/form/__tests__/ProtoFormRenderer.test.tsx
decisions:
  - "applyBlockRef uses dirtyFields (value-based) semantics per D-03 — a field typed back to default is not protected"
  - "setValue without shouldDirty: true — block-filled fields remain non-dirty so subsequent drops can overwrite"
  - "Dependency array includes message to rebuild eligibleFields set when message changes"
  - "Dirty fields are silently skipped (not added to skipped[]) — protection is intentional, not a missing-field warning"
metrics:
  duration: "3m 4s"
  completed: "2026-05-20T16:00:08Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 12 Plan 01: applyBlockRef Prop + useEffect Wiring Summary

ProtoFormRenderer now accepts an `applyBlockRef` prop; calling `applyBlockRef.current(blockValues)` fills all non-dirty top-level scalar/enum fields from the block and returns the array of skipped field names.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 | RED (test) | 0ee4d8d | Add 6 failing tests for applyBlockRef behavior |
| 2 | GREEN (feat) | 332f14e | Wire applyBlockRef prop and useEffect into ProtoFormRenderer |

## What Was Built

### applyBlockRef Contract

- `ProtoFormRendererProps` extended with `applyBlockRef?: React.MutableRefObject<((blockValues: Record<string, unknown>) => string[]) | null>`
- New `useEffect` after the existing `resetRef` useEffect, dependency array `[applyBlockRef, methods, message]`
- On mount: populates `applyBlockRef.current` with a function that:
  - Builds `eligibleFields` Set from `message.fields` filtered to non-repeated scalar/enum fields
  - For each block key: skips (adds to returned array) if not eligible; silently skips if dirty; otherwise calls `methods.setValue(key, value)` with default `shouldDirty: false`
- On unmount: sets `applyBlockRef.current = null`

### TDD Gate Compliance

- RED gate commit: `0ee4d8d` — 6 failing tests, 6 existing passing
- GREEN gate commit: `332f14e` — all 8 tests pass, `tsc --noEmit` exits 0

## Test Results

All 8 ProtoFormRenderer tests pass (12 total across 3 test files):
- `applyBlockRef.current is set after ProtoFormRenderer mounts`
- `applyBlockRef.current fills a non-dirty scalar field and returns []`
- `applyBlockRef.current returns skipped array for unknown key`
- `applyBlockRef.current skips nested message field and returns it in skipped`
- `applyBlockRef.current skips repeated scalar field and returns it in skipped`
- `applyBlockRef.current does not overwrite a dirty field and does not add it to skipped`

## Deviations from Plan

None — plan executed exactly as written.

The advisor note about not importing `useRef` was correct: plain object literals (`{ current: null as ... }`) are used in tests, not `useRef()`. Only `act` from react and `fireEvent`/`waitFor` from @testing-library/react were needed.

## Known Stubs

None. All applyBlockRef contract points are fully implemented and tested.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced.
The `applyBlockRef` function writes only to RHF-managed form state via `methods.setValue` — no eval, no DOM injection, no HTML rendering. Matches T-12-01-01 disposition: mitigate (only top-level scalar/enum fields, no untrusted remote input).

## Self-Check: PASSED

- `src/components/form/ProtoFormRenderer.tsx` — FOUND, contains `applyBlockRef` (8 occurrences)
- `src/components/form/__tests__/ProtoFormRenderer.test.tsx` — FOUND, contains `describe('applyBlockRef'`
- Task 1 commit `0ee4d8d` — verified in git log
- Task 2 commit `332f14e` — verified in git log
- All 12 tests pass (`npm test -- ProtoFormRenderer` 2>&1)
- `npx tsc --noEmit` exits 0
