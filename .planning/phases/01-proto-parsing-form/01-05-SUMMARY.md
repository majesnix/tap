---
phase: "01"
plan: "05"
subsystem: "wkt-field-and-include-paths"
tags: ["react", "react-hook-form", "tauri-plugin-store", "well-known-types", "include-paths"]
dependency_graph:
  requires:
    - "01-01 (WellKnownTypeField stub, ProtoFormRenderer dispatch, Sidebar file open)"
  provides:
    - wkt-field-timestamp-duration-fallback
    - include-path-persistence-per-file
    - include-path-dialog-ux
  affects:
    - "Rust encode_message: receives ISO 8601 strings for Timestamp, duration strings for Duration"
tech_stack:
  added:
    - "tauri-plugin-store load() API for per-file include path persistence"
  patterns:
    - "Controller-wrapped datetime-local input for Timestamp WKT"
    - "Controller + validate rule for Duration regex"
    - "Constant prefix pattern for store keys (INCLUDE_PATH_KEY_PREFIX)"
    - "useEffect on dialog open=true to re-initialize internal state from initialPaths"
key_files:
  created:
    - "src/components/form/__tests__/WellKnownTypeField.test.tsx"
    - "src/components/include-paths/IncludePathDialog.tsx"
    - "src/components/sidebar/FileSection.tsx"
  modified:
    - "src/components/form/fields/WellKnownTypeField.tsx"
    - "src/components/sidebar/Sidebar.tsx"
decisions:
  - "WellKnownTypeField prop kept as 'path' (not 'fieldPath') — ProtoFormRenderer dispatch is frozen"
  - "Duration validation triggers on blur (mode: onBlur in test wrapper) — matches ProtoFormRenderer useForm mode"
  - "load() called without options object — StoreOptions.defaults is required when passing options, autoSave defaults work"
  - "Include path key uses constant INCLUDE_PATH_KEY_PREFIX='include_paths:' for clarity and DRY"
  - "IncludePathDialog state reset via useEffect on open=true — ensures stale paths don't persist across file opens"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 1 Plan 05: WellKnownTypeField + Include Path Persistence Summary

Timestamp datetime-local input, Duration text input with regex validation, fallback plain input with WKT badge — plus full include path persistence UX via tauri-plugin-store keyed per file path.

## What Was Built

**WellKnownTypeField (FORM-09):**
- Timestamp: native `<input type="datetime-local">` wrapped in react-hook-form Controller, sends ISO 8601 string to Rust backend which converts to seconds+nanos
- Duration: shadcn `Input` with placeholder "e.g. 1h30m", validated against regex `^(\d+h)?(\d+m)?(\d+(\.\d+)?s)?$`, inline error displayed below the field
- Fallback (all other WKTs including google.protobuf.Any): plain text input with a secondary Badge showing the WKT name (G-8: no Any specialization in Phase 1)
- 5 tests cover all cases (TDD RED → GREEN)

**Include Path UX (PROT-02, D-08/D-09):**
- `IncludePathDialog.tsx`: shadcn Dialog with "Configure include paths" title, path list with remove buttons, "Add path" opens native directory picker, "Load file" confirm, "Discard path changes" cancel
- `FileSection.tsx`: on file open, loads previously saved include paths from `tauri-plugin-store` keyed by `include_paths:{absoluteFilePath}`, pre-populates dialog (parent dir on first open), persists on confirm, calls parseProto
- `Sidebar.tsx`: refactored to delegate file open flow to `FileSection` (removed inline handleOpenFile)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `load()` options type incompatibility**
- **Found during:** Task 2 first build
- **Issue:** `load(STORE_PATH, { autoSave: false })` fails TypeScript — `StoreOptions.defaults` is a required field when passing any options
- **Fix:** Removed options arg from `load()` call; `autoSave` defaults to `true` (100ms debounce) which is acceptable for this use case
- **Files modified:** src/components/sidebar/FileSection.tsx
- **No additional commit** — fixed before Task 2 commit

**2. [Rule 1 - Deviation] Prop name kept as `path` not `fieldPath`**
- **Found during:** Task 1 analysis (plan says `fieldPath`, ProtoFormRenderer passes `path`)
- **Issue:** The plan's code example used `fieldPath` but the frozen ProtoFormRenderer dispatch (01-01) uses `path`
- **Fix:** Kept `path` as the prop name — `ProtoFormRenderer.tsx` was NOT modified (as required)
- **Files modified:** src/components/form/fields/WellKnownTypeField.tsx

**3. [Rule 2 - Missing critical] FileSection + IncludePathDialog not created in Plan 01**
- **Found during:** Task 2 — plan assumes these exist as Plan 01 implementations
- **Issue:** Plan 01 (01-01) embedded file-open logic directly in `Sidebar.tsx` without `FileSection.tsx` or `IncludePathDialog.tsx`
- **Fix:** Created both files now, refactored `Sidebar.tsx` to delegate to `FileSection`
- **Files created:** FileSection.tsx, IncludePathDialog.tsx; modified: Sidebar.tsx

### Plan Path Deviations (inherited from Wave 1)

The plan's frontmatter references `src/components/form/WellKnownTypeField.tsx` but the actual file is at `src/components/form/fields/WellKnownTypeField.tsx` — consistent with all other field components per Wave 1 deviation.

The test file is at `src/components/form/__tests__/WellKnownTypeField.test.tsx` (correct per plan).

## Known Stubs

None — WellKnownTypeField is fully implemented for Phase 1 scope. Include path persistence is complete.

## Threat Flags

No new threat surface introduced beyond what was registered in the plan's threat model:
- T-05-01: Timestamp ISO 8601 — datetime-local browser input constrains format
- T-05-02: Duration string — frontend regex + Rust parse validation
- T-05-03/T-05-04: Include path store — accepted risks (user-controlled paths, non-secret data)

## Self-Check: PASSED

Files exist:
- src/components/form/fields/WellKnownTypeField.tsx: FOUND
- src/components/form/__tests__/WellKnownTypeField.test.tsx: FOUND
- src/components/include-paths/IncludePathDialog.tsx: FOUND
- src/components/sidebar/FileSection.tsx: FOUND
- src/components/sidebar/Sidebar.tsx: FOUND (modified)

Commits exist:
- 60ee94e (Task 1 — WellKnownTypeField implementation): FOUND
- ff7a8e3 (Task 2 — FileSection + IncludePathDialog + Sidebar refactor): FOUND

Tests: 39/39 pass
Build: exit 0
ProtoFormRenderer.tsx: NOT modified (verified)
