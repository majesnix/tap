---
phase: 08-json-override-toggle
plan: "01"
subsystem: frontend
tags: [codemirror, json-editor, tdd, form]
dependency_graph:
  requires: []
  provides: [JsonEditor, buildDefaultValues-export]
  affects: [FormPanel]
tech_stack:
  added: ["@uiw/react-codemirror ^4.25.9", "@codemirror/lang-json ^6.0.2"]
  patterns: [controlled-component, tdd-red-green, inline-error-banner]
key_files:
  created:
    - src/components/form/JsonEditor.tsx
    - src/components/form/__tests__/JsonEditor.test.tsx
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/components/form/ProtoFormRenderer.tsx
decisions:
  - "vi.mock(@uiw/react-codemirror) with textarea stub required — jsdom does not support CodeMirror ContentEditable (uiwjs/react-codemirror#506)"
  - "JsonEditorProps exported as interface so FormPanel (Plan 02) can import the type"
  - "role=alert on <p> element containing parseError text (not the wrapper div) — matches ARIA best practice for inline form errors"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-19T11:42:57Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 08 Plan 01: Install Packages, Export buildDefaultValues, JsonEditor Component Summary

**One-liner:** CodeMirror JSON editor controlled component with inline error banner, built TDD with vi.mock textarea stub workaround for jsdom.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install packages and export buildDefaultValues | ed3cdef | package.json, pnpm-lock.yaml, ProtoFormRenderer.tsx |
| 2 (RED) | Add failing JsonEditor tests | 07d3a11 | src/components/form/__tests__/JsonEditor.test.tsx |
| 2 (GREEN) | Implement JsonEditor component | 095e612 | src/components/form/JsonEditor.tsx |

## What Was Built

**Task 1: Package installation and buildDefaultValues export**
- Installed `@uiw/react-codemirror ^4.25.9` and `@codemirror/lang-json ^6.0.2`
- Added `export` keyword to `buildDefaultValues` on line 32 of ProtoFormRenderer.tsx (single-word change, no behavioral modification)
- TypeScript compiled with zero errors post-change

**Task 2: JsonEditor component (TDD)**
- `src/components/form/__tests__/JsonEditor.test.tsx` — 7 tests covering:
  1. Renders CodeMirror stub pre-filled with value prop
  2. Calls onChange when editor content changes
  3. Does not render error banner when parseError is null
  4. Renders error banner with role=alert when parseError is non-null
  5. Calls onFixJson when Fix JSON button is clicked
  6. Calls onDiscard when Discard changes button is clicked
  7. Renders without error when resolvedTheme is dark
- `src/components/form/JsonEditor.tsx` — controlled component with:
  - CodeMirror with JSON syntax highlighting (`@codemirror/lang-json`)
  - Dark/light theme wiring via `resolvedTheme` prop
  - Conditional error banner (shown only when `parseError` is non-null)
  - `role="alert"` on parse error paragraph for accessibility
  - Fix JSON and Discard changes buttons wired to callback props
  - `JsonEditorProps` interface exported for FormPanel import

## TDD Gate Compliance

- RED gate: Commit `07d3a11` — test file created, 0 tests collected (file import failed — JsonEditor.tsx did not exist)
- GREEN gate: Commit `095e612` — implementation created, all 7 tests pass

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing MapField test failure (`formState.isValid is false while duplicates exist`) was present before this plan's changes and is out of scope. Logged to deferred items.

## Known Stubs

None — JsonEditor.tsx has no stubs; all props are wired to real CodeMirror and real callbacks.

## Threat Flags

No new security surface introduced. JsonEditor is a pure controlled UI component — it does not parse JSON itself (parsing occurs in FormPanel, Plan 02). The threat register items T-08-01-01 and T-08-01-02 apply to FormPanel, not to JsonEditor.

## Success Criteria Check

- [x] `@uiw/react-codemirror` and `@codemirror/lang-json` present in package.json
- [x] `export function buildDefaultValues(` present on line 32 of ProtoFormRenderer.tsx
- [x] `JsonEditor.tsx` exists with `JsonEditorProps` interface and `JsonEditor` export
- [x] All 7 JsonEditor tests pass
- [x] Full test suite — no new regressions introduced (pre-existing MapField failure is unrelated)
- [x] JSON-06 CodeMirror with JSON highlighting + dark/light theme wiring is fully deliverable

## Self-Check: PASSED

- [x] `src/components/form/JsonEditor.tsx` — FOUND
- [x] `src/components/form/__tests__/JsonEditor.test.tsx` — FOUND
- [x] Commit `ed3cdef` (Task 1) — FOUND in git log
- [x] Commit `07d3a11` (RED) — FOUND in git log
- [x] Commit `095e612` (GREEN) — FOUND in git log
