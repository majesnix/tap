---
phase: 01-proto-parsing-form
plan: "06"
subsystem: ui
tags: [react, vitest, debounce, react-hook-form, zustand, testing]

requires:
  - phase: 01-proto-parsing-form plan 05
    provides: WellKnownTypeField + include path persistence — FormPanel was the consumer

provides:
  - FormPanel with live reactive useState → useDebounce → useEffect encoding pipeline
  - Vitest fake-timer test suite verifying the 200ms debounced encode path

affects:
  - Phase 02 RabbitMQ connection UI (FormPanel is the primary message composition component)

tech-stack:
  added: []
  patterns:
    - "useState-as-debounce-input: pass state value (not ref .current) to useDebounce to get reactive debounce"
    - "useEffect encode gate: trigger side-effect IPC calls from debouncedValues useEffect, not inline callbacks"
    - "vi.clearAllMocks in beforeEach: required to isolate mock call counts across tests in the same file"

key-files:
  created:
    - src/components/form/__tests__/FormPanel.test.tsx
  modified:
    - src/components/form/FormPanel.tsx
    - src/test/setup.ts

key-decisions:
  - "useState (not useRef) for latestValues — ref mutation is invisible to React, state triggers re-renders"
  - "encodeMessage moved to useEffect([debouncedValues]) — not inside handleValuesChange callback"
  - "handleValuesChange deps reduced to [] — only calls setLatestValues, no store side-effects"
  - "vi.clearAllMocks() added to test beforeEach — required to isolate mock call counts across tests"
  - "ResizeObserver stub added to test setup — @radix-ui/react-scroll-area requires it in jsdom"
  - "fireEvent.change used instead of userEvent.type — avoids hanging with fake timers in this stack"

patterns-established:
  - "Debounce pattern: useState value → useDebounce → useEffect to keep the reactive pipeline live"

requirements-completed: ["FORM-01"]

duration: 18min
completed: "2026-05-17"
---

# Phase 01 Plan 06: FormPanel Debounce Fix Summary

**Replaced dead useRef debounce gate with live useState pipeline so encodeMessage fires only once after a 200ms idle window, not on every keystroke**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-17T15:44:00Z
- **Completed:** 2026-05-17T16:02:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Fixed the root cause of VERIFICATION.md Truth #3: `latestValues` was a `useRef` whose `.current` mutation was invisible to React, so `useDebounce` always received the same stale value and never fired
- Replaced `useRef<unknown>(null)` with `useState<unknown>(null)` — `setLatestValues` triggers re-renders, making `useDebounce(latestValues, 200)` see live values and start the timer correctly
- Moved `encodeMessage` out of `handleValuesChange` into a `useEffect` depending on `debouncedValues` — IPC is now called only after 200ms idle
- Wrote Vitest fake-timer tests confirming the debounced behavior; both pass GREEN against the fixed implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing test for the debounced encode path** — `e230aff` (test)
2. **Task 2: Fix FormPanel to use reactive state so tests go GREEN** — `2e9bd3f` (fix)

**Plan metadata:** (docs commit follows)

_TDD plan: RED commit then GREEN commit_

## Files Created/Modified

- `src/components/form/FormPanel.tsx` — Replaced `useRef`/`void debouncedValues` pattern with `useState` + `useEffect` encode gate
- `src/components/form/__tests__/FormPanel.test.tsx` — Created: 2 Vitest fake-timer tests verifying the 200ms debounce gate
- `src/test/setup.ts` — Added `ResizeObserver` stub (jsdom polyfill required by `@radix-ui/react-scroll-area`)

## Decisions Made

- **useState over useRef** — ref mutation does not trigger re-renders; useDebounce depends on React's render cycle to observe value changes
- **useEffect encode gate** — keeps `handleValuesChange` a pure setState callback, separates concerns between form capture and IPC dispatch
- **fireEvent.change over userEvent.type** — `userEvent.type` hung indefinitely under `vi.useFakeTimers()` in this stack; `fireEvent.change` is synchronous and works correctly
- **vi.clearAllMocks() in beforeEach** — mock call counts persisted across tests without it, causing false negatives in test 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ResizeObserver stub to test setup**
- **Found during:** Task 1 (first test run attempt)
- **Issue:** `@radix-ui/react-scroll-area` (used in FormPanel's `ScrollArea`) throws `ReferenceError: ResizeObserver is not defined` in jsdom
- **Fix:** Added `window.ResizeObserver = ResizeObserverStub` class to `src/test/setup.ts`
- **Files modified:** `src/test/setup.ts`
- **Verification:** Tests loaded and ran without the error
- **Committed in:** `e230aff` (Task 1 commit)

**2. [Rule 3 - Blocking] Switched from userEvent.type to fireEvent.change**
- **Found during:** Task 1 (timeout debugging)
- **Issue:** `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` + `await user.type()` timed out (5000ms STACK_TRACE_ERROR) under `vi.useFakeTimers()` in Vitest 4.x / user-event 14.6.1
- **Fix:** Replaced `await user.type()` with synchronous `fireEvent.change()` calls inside `act()`. The plan recommended `userEvent.type` but this is incompatible with the fake timer stack in this project.
- **Files modified:** `src/components/form/__tests__/FormPanel.test.tsx`
- **Verification:** Tests ran successfully and correctly detected the bug
- **Committed in:** `e230aff` (Task 1 commit)

**3. [Rule 3 - Blocking] Added vi.clearAllMocks() in beforeEach**
- **Found during:** Task 2 (GREEN phase — test 2 still failed after fix)
- **Issue:** Test 2 failed with "called 1 time" after 100ms because test 1's mock call count persisted into test 2. The mock was re-configured with `mockResolvedValue` but call history was not cleared.
- **Fix:** Added `vi.clearAllMocks()` before `vi.useFakeTimers()` in `beforeEach`
- **Files modified:** `src/components/form/__tests__/FormPanel.test.tsx`
- **Verification:** Both tests pass after fix
- **Committed in:** `2e9bd3f` (Task 2 commit)

**4. [Acceptance Criteria Note] `grep -c "useState"` returns 2, not 1**
- **Found during:** Post-task verification
- **Issue:** The acceptance criteria `grep -c "useState" src/components/form/FormPanel.tsx returns 1` is an off-by-one — `grep -c` counts matching lines, and `useState` appears on both the import line and the declaration line (2 lines)
- **Not a code defect** — the implementation is correct (one state variable, one import usage)
- **Plan fix:** The criterion should be `grep -c "setLatestValues" src/components/form/FormPanel.tsx returns 2` (declaration + useCallback body) or better, a behavioral check

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking), 1 acceptance criteria note (off-by-one in grep check, not a code issue)
**Impact on plan:** All auto-fixes were required to run tests in this environment. No scope creep. The fix strategy (Path B) was implemented exactly as specified.

## Issues Encountered

- Vitest 4.x + user-event 14.6.1 + vi.useFakeTimers() incompatibility: `userEvent.setup` with `advanceTimers` hangs on `await user.type()`. The workaround (`fireEvent.change` in `act()`) is a common pattern for testing components under fake timers in the React Testing Library ecosystem.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- FORM-01 fully satisfied: FormPanel now has the correct reactive debounce pipeline
- All 41 tests pass; TypeScript clean; build succeeds
- VERIFICATION.md Truth #3 is resolved: changing a form field triggers a debounced (200ms) encode call, not an immediate one on every keystroke
- Ready for Phase 02 — RabbitMQ connection UI

## TDD Gate Compliance

- RED gate: PRESENT — `e230aff test(01-06): add failing tests for debounced encode path`
- GREEN gate: PRESENT as `fix(...)` not `feat(...)` — `2e9bd3f fix(01-06): gate encodeMessage behind 200ms debounce using useState`
- Rationale for `fix` over `feat`: plan was `gap_closure: true` — a bug fix against VERIFICATION.md Truth #3 (dead debounce gate). Semantic commit type matches the actual change. The functional TDD cycle (failing test → minimal implementation → all tests pass) was followed correctly.
- REFACTOR gate: not used — minimal implementation needed no cleanup pass

## Self-Check: PASSED

- FOUND: .planning/phases/01-proto-parsing-form/01-06-SUMMARY.md
- FOUND: src/components/form/FormPanel.tsx
- FOUND: src/components/form/__tests__/FormPanel.test.tsx
- FOUND: src/test/setup.ts
- FOUND: commit e230aff (test: failing tests RED)
- FOUND: commit 2e9bd3f (fix: FormPanel debounce GREEN)
- All 41 tests pass, TypeScript clean, build succeeds

---
*Phase: 01-proto-parsing-form*
*Completed: 2026-05-17*
