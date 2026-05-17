---
phase: "01"
plan: "04"
subsystem: "enum-oneof-fields"
tags: ["react", "react-hook-form", "shadcn-ui", "radix-ui", "vitest", "tdd"]
dependency_graph:
  requires:
    - "01-01 (walking skeleton, field stubs, ProtoFormRenderer dispatch)"
  provides:
    - "EnumField: shadcn Select with name display / number storage (FORM-04)"
    - "OneofField: RadioGroup + branch mounting + unregister on switch (FORM-05)"
  affects:
    - "01-05 (integration + send flow: enum/oneof values now correctly shaped for Rust encoder)"
tech_stack:
  added: []
  patterns:
    - "shadcn Select mocked with native <select> in tests — Radix UI portal/pointer-event JSDOM workaround"
    - "useMemo for stable branchNames array reference — prevents useEffect infinite loops with array deps"
    - "String(number) <-> Number(string) bridge for shadcn Select (string-only) to form state (number)"
    - "Flat oneof path convention: ${path}.${branchField.name} — avoids double-nesting in form values"
key_files:
  created:
    - "src/components/form/__tests__/EnumField.test.tsx"
    - "src/components/form/__tests__/OneofField.test.tsx"
  modified:
    - "src/components/form/fields/EnumField.tsx"
    - "src/components/form/fields/OneofField.tsx"
    - "src/components/form/ProtoFormRenderer.tsx"
decisions:
  - "Used path prop (not fieldPath) — ProtoFormRenderer dispatch is frozen and uses path"
  - "Mocked shadcn Select with native HTML <select> for JSDOM testability — Radix portals/pointer events incompatible with jsdom"
  - "useMemo with empty deps for branchNames — branches array is stable per field schema lifetime"
  - "Fixed buildDefaultValues in ProtoFormRenderer (Rule 1): enum now uses values[0].number, oneof now uses first branch name"
metrics:
  duration: "~30 minutes"
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 1 Plan 04: EnumField + OneofField Summary

EnumField and OneofField Wave 1 stubs replaced with full implementations: shadcn Select for enum fields (displays names, stores integers), and RadioGroup with conditional branch mounting and sibling unregister for oneof fields. FORM-04 and FORM-05 delivered.

## What Was Built

**EnumField (FORM-04):**
- shadcn `Select` component via `Controller` from react-hook-form
- Dropdown options display enum value **names** (e.g., PENDING, ACTIVE, INACTIVE)
- Form state stores integer **numbers** (e.g., 0, 1, 2) — matching protobuf wire encoding
- String bridge: `value={String(number)}` → `onValueChange={(s) => onChange(Number(s))}`
- Label with "enum" Badge above the Select trigger
- 3 tests: trigger renders, names shown as options, number stored on selection

**OneofField (FORM-05):**
- `RadioGroup` with one `RadioGroupItem` per branch, controlled via `Controller`
- `useWatch` on `${path}._selected` to track active branch
- `useEffect` unregisters sibling branch paths when branch changes (proto wire semantics — only one oneof field set at a time)
- Conditional DOM mount: selected branch renders; siblings are truly unmounted (not CSS-hidden)
- Flat path convention: `${path}.${branchField.name}` matching Rust encoder shape
- `useMemo` stabilizes branch names array to prevent infinite render loops
- 3 tests: radio group renders, first branch default, branch switch mounts/unmounts correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prop name mismatch: plan specifies fieldPath, frozen ProtoFormRenderer uses path**
- **Found during:** Pre-implementation review of ProtoFormRenderer.tsx
- **Issue:** The plan's interface spec uses `fieldPath` for both EnumFieldProps and OneofFieldProps, but ProtoFormRenderer.tsx (frozen since Plan 01) dispatches with `path={path}`. Using `fieldPath` would cause TypeScript errors and runtime failures.
- **Fix:** Implemented both components with `path` prop to match the frozen dispatch contract. All template strings use `${path}` instead of `${fieldPath}`.
- **Tests:** Test wrappers use `path=...` (not `fieldPath=...`) to match.
- **Files modified:** Both component files and test files

**2. [Rule 1 - Bug] buildDefaultValues used string name for enum default, empty string for oneof _selected**
- **Found during:** Advisor review before implementation
- **Issue:** `buildDefaultValues` in ProtoFormRenderer.tsx was stubbed for Wave 1 placeholders:
  - `enum` default: `values[0].name` (string like "PENDING") — but EnumField stores/expects numbers. The Select `value={String(number)}` would show no selection for a string default like "PENDING".
  - `oneof` default: `{ _selected: "" }` — but OneofField's `useWatch` defaultValue is the first branch name. An empty string selects no branch, breaking conditional render.
- **Fix:** Updated `buildDefaultValues`:
  - enum: `values[0].number` (integer, e.g., 0)
  - oneof: `{ _selected: firstBranch }` where `firstBranch = branches[0]?.[0]?.name ?? ""`
- **Files modified:** src/components/form/ProtoFormRenderer.tsx
- **Commit:** 908f55b

**3. [Rule 1 - Bug] useMemo required for branchNames to prevent infinite useEffect loops**
- **Found during:** Task 2 GREEN phase — tests failed with "Maximum update depth exceeded"
- **Issue:** `branchNames = branches.map(...)` created a new array reference on every render. `useEffect` deps included `branchNames`, causing re-registration → state update → re-render → new array → infinite loop.
- **Fix:** Wrapped with `useMemo(() => branches.map(...), [])` — empty deps because branches shape is stable for the field schema lifetime.
- **Files modified:** src/components/form/fields/OneofField.tsx

**4. [Rule 3 - Blocking] Radix UI Select incompatible with JSDOM for testing**
- **Found during:** Task 1 GREEN phase — tests "showed enum value names" failed because dropdown portal content not accessible
- **Issue:** Radix UI Select uses portals (rendering to document.body) and requires pointer events that JSDOM doesn't support. `userEvent.click` on the combobox trigger did not open the dropdown (aria-expanded stayed false).
- **Fix:** Mocked `@/components/ui/select` with proper TypeScript types using a `React.createContext`-based mock that renders a native `<select>` element. All critical behavior tested: trigger renders, options show names, selecting stores number.
- **Files modified:** src/components/form/__tests__/EnumField.test.tsx

## Known Stubs

None — both EnumField and OneofField are fully implemented. WellKnownTypeField (plan 01-04 scope originally included it per STATE.md but not in this PLAN.md's tasks) remains a stub handled by a separate plan.

## TDD Gate Compliance

Both tasks followed RED → GREEN:

| Gate | Task 1 (EnumField) | Task 2 (OneofField) |
|------|-------------------|---------------------|
| RED commit | d4d8acf | fd0c914 |
| GREEN commit | 16405ff | 9e7dd5a |

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Form values flow to existing `encode_message` Tauri command unchanged. Threat mitigations from plan's threat model:

- T-04-01 (OneofField _selected tampering): Rust `encode_message` uses `get_field_by_name()` — unknown branch name silently skips oneof encoding (valid protobuf, no data corruption)
- T-04-02 (EnumField invalid number): Rust validates against `EnumDescriptor.get_value_by_number()` — invalid number returns AppError surfaced as inline error

## Self-Check: PASSED

Files exist:
- src/components/form/fields/EnumField.tsx: FOUND
- src/components/form/fields/OneofField.tsx: FOUND
- src/components/form/__tests__/EnumField.test.tsx: FOUND
- src/components/form/__tests__/OneofField.test.tsx: FOUND

Commits exist:
- d4d8acf (EnumField RED): FOUND
- 16405ff (EnumField GREEN + FORM-04): FOUND
- 908f55b (Rule 1: buildDefaultValues fix): FOUND
- fd0c914 (OneofField RED): FOUND
- 9e7dd5a (OneofField GREEN + FORM-05): FOUND

Tests: 6/6 passed (EnumField + OneofField)
Build: npm run build exits 0
ProtoFormRenderer dispatch switch: NOT modified (only buildDefaultValues utility updated)
