---
phase: 05-dark-mode
fixed_at: 2026-05-18T20:38:00Z
review_path: .planning/phases/05-dark-mode/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-05-18T20:38:00Z
**Source review:** .planning/phases/05-dark-mode/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Bootstrap failure silences theme persistence for the entire session

**Files modified:** `src/App.tsx`
**Commit:** 5b0ff56
**Applied fix:** Restructured the bootstrap `useEffect` to use flat `.then()` chaining. Moved `setBootstrapped(true)` from inside the `.then` branch into a `.finally()` so it always runs regardless of success or error. Added a `.catch()` handler that logs the error to `console.error` for diagnosability.

### WR-03: No validation of `saved` value from tauri-plugin-store

**Files modified:** `src/App.tsx`
**Commit:** 0d67672
**Applied fix:** Added a `VALID_THEMES: string[]` constant at module level containing `["system", "light", "dark"]`. Changed `if (saved) setTheme(saved)` to `if (saved && VALID_THEMES.includes(saved)) setTheme(saved)` so corrupted, manually edited, or legacy store entries cannot inject arbitrary strings into next-themes.

### WR-01: Mirror effect swallows `store.set` and `store.save` failures

**Files modified:** `src/App.tsx`
**Commit:** 182d0ae
**Applied fix:** Changed the mirror effect to chain `store.save()` on the resolved value of `store.set()` — `store.set(THEME_MODE_KEY, theme).then(() => store.save())` — so `save()` only runs when `set()` succeeds. Added a `.catch()` handler to log persistence failures.

### WR-02: Unsafe `as ThemeMode` cast — unknown theme value renders blank button

**Files modified:** `src/components/sidebar/ThemeToggle.tsx`
**Commit:** df9bd3e
**Applied fix:** Replaced `const current = (theme as ThemeMode) ?? "system"` with a runtime validation check: `const raw = theme ?? "system"; const current: ThemeMode = CYCLE_ORDER.includes(raw as ThemeMode) ? (raw as ThemeMode) : "system"`. Unexpected string values now fall back to `"system"` instead of producing `undefined` for icons and labels.

### IN-01: Mirror-effect test does not assert the bootstrap value is not overwritten

**Files modified:** `src/App.test.tsx`
**Commit:** c64b1b7
**Applied fix:** Added a `mockSet.mock.calls` assertion after the first `act` to verify exactly one write occurred (`[["theme-mode", "system"]]`) before the rerender. After the rerender, asserts the full call sequence is `[["theme-mode", "system"], ["theme-mode", "dark"]]` and uses `toHaveBeenLastCalledWith` instead of `toHaveBeenCalledWith` to verify the most recent write specifically.

### IN-02: Non-null assertion on possibly-undefined variable in test

**Files modified:** `src/App.test.tsx`
**Commit:** 2c640cd
**Applied fix:** Changed `let resolvePending: (value: string | null) => void;` to `let resolvePending: (value: string | null) => void = () => {};` and removed the `!` operator at the call site (`resolvePending!(null)` → `resolvePending(null)`).

---

_Fixed: 2026-05-18T20:38:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
