---
phase: "01"
plan: "02"
subsystem: "scalar-field-renderer"
tags: ["react", "react-hook-form", "zod", "vitest", "shadcn-ui", "form-validation", "tdd"]
dependency_graph:
  requires:
    - "01-01 (walking skeleton — field stub + ProtoFormRenderer dispatch)"
  provides:
    - "full-scalar-field-renderer"
    - "per-field-zod-validation"
    - "form-default-values-FORM-07"
  affects:
    - "01-03 (RabbitMQ UI — ScalarField now sends correct typed values to Rust encode)"
tech_stack:
  added:
    - "@vitest/coverage-v8 (coverage reporting)"
  patterns:
    - "Single Controller pattern: input + error display in one render cycle (eliminates second Controller)"
    - "mode: onBlur on useForm for consistent blur-triggered validation"
    - "getZodSchema() / getInputType() pure functions: scalar kind → zod schema / input type"
    - "INT32_MIN / INT32_MAX / UINT32_MAX constants for int32 range validation"
    - "64-bit int as type=text with regex (not number) — JS precision preservation"
key_files:
  created:
    - "src/components/form/__tests__/ScalarField.test.tsx"
    - "src/components/form/__tests__/ProtoFormRenderer.test.tsx"
  modified:
    - "src/components/form/fields/ScalarField.tsx"
    - "src/components/form/ProtoFormRenderer.tsx"
    - "tsconfig.json"
    - "package.json"
    - "package-lock.json"
decisions:
  - "Single Controller pattern over two Controllers — fieldState.error only updates reliably when input and error display share the same Controller render"
  - "mode: onBlur on useForm — required for per-field validation to trigger on tab/blur without form submit"
  - "Test wrapper uses mode: onBlur to match production form behavior"
  - "bytes field is enabled (not disabled) — accepts base64 input per RESEARCH.md Open Question 3 resolution"
  - "bytes test checks exact string 'bytes (base64)' not regex /bytes/i — avoids ambiguity with scalar type badge"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 5
---

# Phase 1 Plan 02: ScalarField Full Implementation Summary

Full ScalarField implementation covering all 16 proto scalar kinds with correct input controls, zod validation per type, inline error display, and zero-value defaults — replacing the Wave 1 stub.

## What Was Built

**ScalarField (src/components/form/fields/ScalarField.tsx):**
- All 16 scalar kinds dispatched to correct HTML input controls
- `bool` → shadcn Checkbox
- `string` → Input type="text"
- `bytes` → Input type="text" + "bytes (base64)" secondary badge
- `int32` / `sint32` / `sfixed32` → Input type="number" with zod range [-2147483648, 2147483647]
- `uint32` / `fixed32` → Input type="number" with zod range [0, 4294967295]
- `int64` / `sint64` / `sfixed64` → Input type="text" with regex /^-?\d+$/ (JS precision)
- `uint64` / `fixed64` → Input type="text" with regex /^\d+$/ (JS precision)
- `float` / `double` → Input type="number" with zod z.number()
- Inline validation error rendered via `role="alert"` paragraph below input (FORM-06)
- `defaultValue` from `field.default_value` schema field (FORM-07)

**Test files:**
- `src/components/form/__tests__/ScalarField.test.tsx` — 20 tests, 90%+ coverage
- `src/components/form/__tests__/ProtoFormRenderer.test.tsx` — 2 regression guard tests

**ProtoFormRenderer fix (FORM-07):**
- `buildDefaultValues` now reads `field.default_value` from schema for scalar fields
- Falls back to type-correct zeros: bool→false, int64-family→"0", string/bytes→"", number→0

## TDD Gate Compliance

- RED commit: caff256 — 20 failing tests across all scalar kinds
- GREEN commit: f5fda9f — all 22 tests passing (20 ScalarField + 2 ProtoFormRenderer)
- REFACTOR: not needed (implementation was clean on first pass)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] FORM-07 gap in buildDefaultValues**
- **Found during:** Task 2 implementation review (prompted by advisor)
- **Issue:** `buildDefaultValues` in ProtoFormRenderer used `defaults[field.name] = ""` for ALL scalar fields, ignoring `field.default_value`. Controller's `defaultValue` prop is shadowed by `useForm`'s `defaultValues` at the same path, so FORM-07 would silently not work.
- **Fix:** Updated `buildDefaultValues` to read `field.default_value` when present, with type-correct fallbacks per scalar kind. ProtoFormRenderer declared FINAL in Wave 1 but this was a correctness fix, not a structural change.
- **Files modified:** src/components/form/ProtoFormRenderer.tsx
- **Commit:** f5fda9f

**2. [Rule 3 - Blocking] tsconfig missing vitest/globals types**
- **Found during:** Task 2 `npm run build`
- **Issue:** `tsc` failed with "Cannot find name 'test'" because `globals: true` in vitest config doesn't automatically add types to TypeScript. Test files are in `src/` which is included in the main tsconfig.
- **Fix:** Added `"types": ["vitest/globals"]` to `tsconfig.json` compilerOptions.
- **Files modified:** tsconfig.json
- **Commit:** f5fda9f

**3. [Rule 3 - Blocking] @vitest/coverage-v8 not installed**
- **Found during:** Task 2 coverage check
- **Issue:** `npx vitest run --coverage` failed with "Cannot find dependency '@vitest/coverage-v8'"
- **Fix:** `npm install -D @vitest/coverage-v8`
- **Files modified:** package.json, package-lock.json
- **Commit:** f5fda9f

**4. [Rule 1 - Bug] Two-Controller pattern: error not reactive**
- **Found during:** Task 2 test execution (validation tests failing in GREEN phase)
- **Issue:** Original plan's two-Controller pattern (one for input, second for error display) does not reliably re-render when the first Controller's validation runs. The second Controller's `fieldState.error` was stale.
- **Fix:** Merged into single Controller — input + error display share the same render function.
- **Files modified:** src/components/form/fields/ScalarField.tsx
- **Commit:** f5fda9f

**5. [Rule 1 - Bug] bytes badge test ambiguous with getByText(/bytes/i)**
- **Found during:** Task 2 green phase (test failing despite implementation correct)
- **Issue:** `getByText(/bytes/i)` matched both the scalar type badge ("bytes") and "bytes (base64)" badge — two elements, so `getByText` threw "Found multiple elements".
- **Fix:** Changed test assertion to `getByText("bytes (base64)")` for precise match.
- **Files modified:** src/components/form/__tests__/ScalarField.test.tsx
- **Commit:** f5fda9f

**6. [Rule 2 - Missing critical] mode: onBlur required for blur-triggered validation**
- **Found during:** Task 2 validation tests failing
- **Issue:** react-hook-form defaults to `mode: "onSubmit"`. With default mode, `validate` rules in Controller only fire on form submit, not on blur. Validation tests typed into fields and tabbed away — no error appeared.
- **Fix:** Added `mode: "onBlur"` to `useForm()` in both ProtoFormRenderer and the test wrapper.
- **Files modified:** src/components/form/ProtoFormRenderer.tsx, ScalarField.test.tsx
- **Commit:** f5fda9f

### Plan Deviations (non-bug)

**Wave 1 location mismatch (inherited):** Plan frontmatter references `src/components/form/ScalarField.tsx` but Wave 1 placed the file at `src/components/form/fields/ScalarField.tsx`. This plan correctly edited the Wave 1 file location. No duplicate was created. Test imports use `../fields/ScalarField` accordingly.

**Prop name `path` not `fieldPath`:** Plan code templates used `fieldPath` as the prop name. Wave 1 implementation used `path` to match the ProtoFormRenderer callsite (`<ScalarField key={path} field={field} path={path} />`). This plan preserved `path` — a critical correctness requirement since ProtoFormRenderer is FINAL.

## Known Stubs

No stubs introduced by this plan. The ScalarField stub from Wave 1 is fully replaced.

The following Wave 1 stubs remain for later plans (unchanged):
- src/components/form/fields/NestedMessageField.tsx — Badge placeholder
- src/components/form/fields/RepeatedField.tsx — Badge placeholder
- src/components/form/fields/EnumField.tsx — Badge placeholder
- src/components/form/fields/OneofField.tsx — Badge placeholder
- src/components/form/fields/WellKnownTypeField.tsx — Badge placeholder

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The threat model mitigations from the plan are fully implemented:

- T-02-01 (int64 string tampering): JS regex `/^-?\d+$/` + Rust `str::parse::<i64>()` double-layer validation — JS side done.
- T-02-02 (int32 range): zod `z.number().int().min(-2147483648).max(2147483647)` — implemented.
- T-02-03 (bytes base64): accepted by design, input accepts any string as per threat model.

## Self-Check: PASSED

Files exist:
- src/components/form/fields/ScalarField.tsx: FOUND
- src/components/form/__tests__/ScalarField.test.tsx: FOUND
- src/components/form/__tests__/ProtoFormRenderer.test.tsx: FOUND

Commits exist:
- caff256 (test(01-02): RED phase failing tests): FOUND
- f5fda9f (feat(01-02): GREEN phase implementation): FOUND

Tests: 22/22 passing
Build: exit 0
ScalarField coverage: 90% statements, 87.5% branch, 100% functions
