---
phase: 08-json-override-toggle
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - package.json
  - src/components/form/FormPanel.tsx
  - src/components/form/JsonEditor.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/components/form/__tests__/FormPanel.test.tsx
  - src/components/form/__tests__/JsonEditor.test.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase adds a JSON Override Toggle to `FormPanel`: a Braces button that swaps out `ProtoFormRenderer` for a `JsonEditor` (CodeMirror), lets users edit message values as raw JSON, then parses and feeds the result back through the existing `pendingReplayValues` channel. The implementation is logically correct for the happy path and the documented edge cases (invalid JSON syntax, unknown fields, discard). However, one unchecked type assumption in the toggle handler creates an unguarded crash path on valid-but-wrong-shaped JSON, and the toggle's local state is not reset when the active schema changes.

---

## Critical Issues

### CR-01: `JSON.parse` result is not validated as an object before `Object.keys()` — crash on valid non-object JSON

**File:** `src/components/form/FormPanel.tsx:116-127`

**Issue:** `JSON.parse(jsonDraft)` is cast to `Record<string, unknown>` with `as`, but TypeScript `as` casts provide no runtime guarantee. `JSON.parse` happily returns `null`, booleans, numbers, arrays, or strings for valid JSON like `null`, `true`, `42`, `[1,2]`, or `"hello"`. The very next statement calls `Object.keys(parsedValues)` unconditionally:

```ts
parsedValues = JSON.parse(jsonDraft) as Record<string, unknown>; // line 116
// ...
const unknownKeys = Object.keys(parsedValues).filter(...)         // line 127
```

- When `jsonDraft` is `null`, `Object.keys(null)` throws `TypeError: Cannot convert undefined or null to object`. This is an uncaught synchronous exception inside a click handler, resulting in a broken React tree or silent failure depending on the error boundary setup.
- When `jsonDraft` is `[1,2,3]`, `Object.keys` returns `["0","1","2"]`, all flagged as "unknown fields ignored". The form is then reset to defaults, silently discarding the user's JSON.
- Neither case is covered by any test.

The `try/catch` around `JSON.parse` only catches parse syntax errors; a syntactically valid `null` or array passes through undetected.

**Fix:** Add a shape guard immediately after the `try/catch` block, before any use of `parsedValues`:

```ts
let parsedValues: Record<string, unknown>;
try {
  const raw: unknown = JSON.parse(jsonDraft);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    setParseError("JSON root must be an object (e.g. { \"field\": value })");
    return;
  }
  parsedValues = raw as Record<string, unknown>;
} catch (e) {
  setParseError(e instanceof Error ? e.message : "Invalid JSON");
  return;
}
```

---

## Warnings

### WR-01: JSON-mode local state is not reset when the active schema changes

**File:** `src/components/form/FormPanel.tsx:44-47`

**Issue:** `isJsonMode`, `entrySnapshot`, `jsonDraft`, and `parseError` are local `useState` values. They are never reset in response to `selectedMessageType` or `schema` changes. If the user enters JSON mode, then switches to a different message type (or file tab) while still in JSON mode, the component will:

1. Show the toggle button in the "active / pressed" state (`aria-pressed={isJsonMode}`) even though the form for the new message type is rendered.
2. Display a stale `jsonDraft` from the previous schema when the user next opens the JSON editor.
3. Trigger spurious "N unknown fields ignored" toasts on toggle-out, because the stale JSON keys do not match the new message's fields.

The `message` variable used for field validation in `handleToggle` is always the *current* message (from `schema.message_map[selectedMessageType]`), but `jsonDraft` is from the *old* message. The mismatch is silent and user-visible.

**Fix:** Add a `useEffect` keyed on `selectedMessageType` (and `schema`) that exits JSON mode and clears draft state:

```ts
useEffect(() => {
  setIsJsonMode(false);
  setEntrySnapshot(null);
  setJsonDraft("");
  setParseError(null);
}, [selectedMessageType, schema]);
```

---

### WR-02: External replay signal (`pendingReplayValues`) is silently dropped while in JSON mode

**File:** `src/components/form/FormPanel.tsx:75-80`

**Issue:** The effect that consumes `pendingReplayValues` (HIST-02 replay):

```ts
useEffect(() => {
  if (pendingReplayValues && resetRef.current) {
    resetRef.current(pendingReplayValues);
    setPendingReplayValues(null);
  }
}, [pendingReplayValues, setPendingReplayValues]);
```

When `isJsonMode` is `true`, `ProtoFormRenderer` is unmounted, so `resetRef.current` is `null`. The condition `resetRef.current` is falsy; `pendingReplayValues` is NOT cleared. The effect runs once and does nothing. When `isJsonMode` later becomes `false` and `ProtoFormRenderer` remounts, `pendingReplayValues` is still set from the old signal — but the effect dependency `pendingReplayValues` has not changed, so the effect does NOT re-fire. The replay signal is permanently stuck until the next external replay trigger.

This means: if HIST-02 fires while the user is in JSON mode, the replay is silently dropped. The user returns to form mode and sees stale values, not the replayed ones.

**Fix:** Include `isJsonMode` in the effect so it re-evaluates when the user exits JSON mode:

```ts
useEffect(() => {
  if (pendingReplayValues && resetRef.current && !isJsonMode) {
    resetRef.current(pendingReplayValues);
    setPendingReplayValues(null);
  }
}, [pendingReplayValues, isJsonMode, setPendingReplayValues]);
```

---

## Info

### IN-01: Test suite does not cover valid-but-wrong-shaped JSON inputs

**File:** `src/components/form/__tests__/FormPanel.test.tsx:212-230`

**Issue:** The "clicking toggle with invalid JSON" test only covers a syntax error (`{bad json`). There are no tests for valid JSON that is not an object: `null`, `true`, `42`, `[1,2]`, `"string"`. Once CR-01 is fixed, these cases should be covered to prevent regression.

**Fix:** Add test cases after the CR-01 fix is applied:

```ts
test.each([
  ["null literal", "null"],
  ["boolean", "true"],
  ["number", "42"],
  ["array", '[{"value":"x"}]'],
])("valid non-object JSON (%s) stays in JSON mode with error banner", (_label, input) => {
  render(<FormPanel />);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" })));
  act(() => fireEvent.change(screen.getByTestId("codemirror-stub"), { target: { value: input } }));
  act(() => fireEvent.click(screen.getByRole("button", { name: "Return to form" })));
  expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
```

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
