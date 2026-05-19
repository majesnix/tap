# Phase 8: JSON Override Toggle - Research

**Researched:** 2026-05-19
**Domain:** React / CodeMirror 6 / react-hook-form reset semantics / Zustand signal pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `isJsonMode` lives as local `useState` in `FormPanel` — not in ProtoFormRenderer and not in Zustand. Toggle button renders inside the existing header div alongside the message name.
- **D-02:** When `isJsonMode` is true, `FormPanel` unmounts `<ProtoFormRenderer>` entirely and renders `<JsonEditor>` in its place. No CSS-hidden approach.
- **D-03:** JSON snapshot for the editor is read from `latestValues` in Zustand (already kept in sync). No additional ref pattern needed.
- **D-04:** Switching back to form mode calls `resetRef.current(parsedValues)` — same `resetRef` pattern used for HIST-02. ProtoFormRenderer must remain mounted (re-mounts) for `resetRef.current` to be valid before calling it.
- **D-05:** When toggle JSON→form and JSON is invalid, do not switch modes. Show inline error banner below CodeMirror with "Fix JSON" / "Discard changes" buttons.
- **D-06:** "Discard" restores to the `latestValues` snapshot captured at JSON mode entry — not `buildDefaultValues`. User loses only the JSON edits, not pre-existing form state.
- **D-07:** Unknown field names produce a sonner `toast.warning()`. Format: `"2 unknown fields ignored: foo, bar"`. Non-blocking, form populates with known fields.
- **D-08:** Unknown field detection runs after successful JSON parse and before calling `resetRef.current`. Unknown keys are stripped from the object passed to `reset()`.
- **D-09:** JSON editor shows raw react-hook-form internal values via `JSON.stringify(latestValues, null, 2)`. No transformation. oneof shape: `{ _selected, branch_name }`, map shape: `[{ key, value }]` arrays.

### Claude's Discretion

- Toggle button label/icon (recommended: `Braces` from lucide-react with `aria-label`)
- Exact inline error banner layout and Tailwind classes
- Whether to debounce JSON parse validation on keystroke or only on toggle-back click (recommended: only on click; CodeMirror's built-in JSON syntax cues provide live feedback)
- JSON editor height within the flex container (recommended: `height="100%"` filling flex parent)
- Error banner position (below editor is recommended)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JSON-01 | User can toggle between form view and raw JSON edit mode via a button in the form header | Toggle button spec in UI-SPEC; `isJsonMode` useState in FormPanel |
| JSON-02 | Switching to JSON mode pre-fills the editor with current form values (point-in-time snapshot) | `JSON.stringify(latestValues, null, 2)` captured at `setIsJsonMode(true)` time |
| JSON-03 | Switching back to form mode applies the edited JSON to all form fields including repeated/map rows | `setPendingReplayValues` signal → `resetRef.current(cleanedValues)` via existing HIST-02 mechanism |
| JSON-04 | User sees error and explicit "Fix JSON / Discard" choice when switching back with invalid JSON | Inline error banner with `JSON.parse` error message; Fix=stay, Discard=`resetRef.current(entrySnapshot)` |
| JSON-05 | User sees non-blocking warning listing unknown field names | `toast.warning()` from sonner; top-level key comparison against `message.fields` only |
| JSON-06 | JSON editor has syntax highlighting and dark mode support | `@uiw/react-codemirror` `theme` prop; `resolvedTheme` from `next-themes` |

</phase_requirements>

---

## Summary

Phase 8 is a **frontend-only** React feature adding a toggle button to `FormPanel` that swaps the `ProtoFormRenderer` for a CodeMirror JSON editor. The implementation is a vertical slice: one new component (`JsonEditor.tsx`), modifications to `FormPanel.tsx`, and new npm packages (`@uiw/react-codemirror`, `@codemirror/lang-json`).

The most important implementation constraint is **resetRef timing**: D-02 unmounts ProtoFormRenderer in JSON mode, which nullifies `resetRef.current` (ProtoFormRenderer cleanup effect sets it to null). The correct pattern reuses the existing HIST-02 `pendingReplayValues` signal in Zustand — `setPendingReplayValues(cleanedValues)` + `setIsJsonMode(false)` triggers the existing `useEffect` in `FormPanel` that calls `resetRef.current(values)` after ProtoFormRenderer remounts. Calling `resetRef.current()` inline before the remount completes is a silent no-op.

The second constraint is **reset() replace semantics** in react-hook-form: `methods.reset(partialValues)` sets undefined for fields missing from the object. User JSON will typically contain all fields (the snapshot was a full latestValues object), but defensively the implementation should merge parsed values over `buildDefaultValues(message)` before calling reset. This ensures round-trips preserve all field defaults.

**Primary recommendation:** Reuse the `pendingReplayValues` Zustand signal for JSON→form sync (same as HIST-02). Create `src/components/form/JsonEditor.tsx` as a focused component owning the CodeMirror wrapper and inline error banner. Mock `@uiw/react-codemirror` as a textarea stub in tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mode toggle state | Frontend (React local state) | — | isJsonMode is transient session UI state; Zustand is for cross-component shared state only |
| JSON snapshot | Frontend (React local state) | Zustand (latestValues source) | Captured once at entry, stored as local `jsonSnapshot` string |
| Entry snapshot for Discard | Frontend (React local state or ref) | — | Must be captured at mode-entry time; local const/ref prevents stale reads |
| JSON → form value sync | Frontend (Zustand signal) | react-hook-form reset | Reuses existing pendingReplayValues → resetRef mechanism from HIST-02 |
| Unknown field detection | Frontend (inline logic) | — | Top-level key comparison; no server round-trip |
| Toast notification | Frontend (sonner) | — | Already wired in App.tsx |
| Editor syntax/theme | `@uiw/react-codemirror` | next-themes | Library handles highlighting; resolvedTheme drives dark/light mode |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@uiw/react-codemirror` | 4.25.9 | React wrapper for CodeMirror 6 | Highest-quality CM6 React wrapper; actively maintained (last release 2026-03-25) |
| `@codemirror/lang-json` | 6.0.2 | JSON language extension for syntax highlighting | Official CodeMirror language package |

[VERIFIED: npm registry — both versions confirmed as current, 2026-03-25 and 2026-02-xx publish dates]

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next-themes` | 0.4.6 | `resolvedTheme` for dark/light mode | Already used in Phase 5; import `useTheme` in `FormPanel` |
| `sonner` | 2.0.7 | Non-blocking toast for unknown fields warning | Already wired in `App.tsx` via `<Toaster>` |
| `lucide-react` | 1.16.0 | `Braces` icon for toggle button | `Braces` confirmed in installed typedefs |
| `react-hook-form` | 7.76.0 | `reset()` for JSON→form sync | See reset semantics pitfall below |
| `zustand` | 5.0.13 | `pendingReplayValues` signal | Existing HIST-02 mechanism |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@uiw/react-codemirror` built-in `"dark"` theme | `@codemirror/theme-one-dark` explicit import | Built-in `"dark"` string is sufficient; `theme-one-dark` is already a transitive dep but importing it explicitly adds no value |
| Parse-on-click only | Debounce-on-keystroke | Debounce adds complexity with no UX benefit — CodeMirror's syntax highlighting already provides live feedback |

**Installation (new packages only):**
```bash
pnpm add @uiw/react-codemirror @codemirror/lang-json
```

Note: `@uiw/react-codemirror` transitively pulls `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/theme-one-dark`. Only `@codemirror/lang-json` requires an explicit separate install.

---

## Architecture Patterns

### System Architecture Diagram

```
FORM MODE                           JSON MODE
─────────                           ─────────
FormPanel                           FormPanel
  ├─ header div                       ├─ header div
  │    ├─ h2 + p (message name)       │    ├─ h2 + p (message name)
  │    └─ [Braces] Toggle Button ──── │    └─ [Braces] Toggle Button (active)
  └─ ScrollArea                       └─ flex-1 flex flex-col min-h-0 div
       └─ ProtoFormRenderer               └─ JsonEditor
            ↓ onValuesChange                   ├─ CodeMirror (flex-1)
            ↓                                  │    value=jsonDraft, onChange=setJsonDraft
          Zustand: latestValues ──────────────> │    theme=resolvedTheme, extensions=[json()]
                                               └─ [inline error banner if parseError]

Toggle FORM→JSON:
  1. capture entrySnapshot = latestValues (local variable, stored in React state/ref)
  2. setJsonSnapshot(JSON.stringify(latestValues, null, 2))
  3. setIsJsonMode(true)

Toggle JSON→FORM (success path):
  1. JSON.parse(jsonDraft) → parsedValues
  2. detect unknown keys (top-level only) → strip → toast.warning if any
  3. merge cleanedValues over buildDefaultValues(message) → mergedValues
  4. setPendingReplayValues(mergedValues)   ← Zustand signal
  5. setIsJsonMode(false)
     ↓ (ProtoFormRenderer remounts, wires resetRef)
     ↓ FormPanel useEffect fires:
     ↓   resetRef.current(mergedValues)
     ↓   setPendingReplayValues(null)

Toggle JSON→FORM (invalid JSON):
  1. JSON.parse throws → catch e.message
  2. setParseError(e.message)
  3. stay in JSON mode (do NOT setIsJsonMode(false))
  4. inline error banner appears
```

### Recommended File Structure
```
src/
├── components/
│   └── form/
│       ├── FormPanel.tsx            # add isJsonMode, entrySnapshot, handleToggle
│       ├── ProtoFormRenderer.tsx    # FROZEN — no changes
│       ├── JsonEditor.tsx           # NEW — CodeMirror wrapper + inline error banner
│       └── __tests__/
│           ├── FormPanel.test.tsx   # extend: JSON mode toggle, snapshot, error state
│           └── JsonEditor.test.tsx  # NEW — mock CodeMirror, test banner, button callbacks
```

### Pattern 1: resetRef Timing via pendingReplayValues Signal

**What:** When exiting JSON mode with valid values, do not call `resetRef.current()` directly. Instead, write to Zustand `pendingReplayValues`, then `setIsJsonMode(false)`. The existing `useEffect` in FormPanel picks up after ProtoFormRenderer remounts.

**When to use:** Whenever calling `resetRef.current()` after ProtoFormRenderer was unmounted.

**Why this pattern is mandatory:** D-02 unmounts ProtoFormRenderer in JSON mode. ProtoFormRenderer's cleanup effect (lines 117-128 of ProtoFormRenderer.tsx) sets `resetRef.current = null` on unmount. After `setIsJsonMode(false)`, ProtoFormRenderer remounts and re-populates `resetRef.current` — but this happens asynchronously after the render commit. Calling `resetRef.current(values)` inline after `setIsJsonMode(false)` in the same event handler hits `null`.

**Example (existing HIST-02 pattern in FormPanel.tsx):**
```typescript
// Source: src/components/form/FormPanel.tsx lines 62-67
useEffect(() => {
  if (pendingReplayValues && resetRef.current) {
    resetRef.current(pendingReplayValues);
    setPendingReplayValues(null);
  }
}, [pendingReplayValues, setPendingReplayValues]);
```

**JSON exit handler reuses this:**
```typescript
// In handleToggle (JSON → FORM path):
const merged = { ...buildDefaultValues(message), ...cleanedValues };
setPendingReplayValues(merged);  // triggers existing useEffect after remount
setIsJsonMode(false);
```

### Pattern 2: reset() Merge-over-Defaults

**What:** Before calling `resetRef.current(values)`, merge parsed JSON values over `buildDefaultValues(message)`.

**When to use:** Always, when applying JSON→form. Never pass raw parsed JSON directly to reset.

**Why:** `methods.reset(values)` in react-hook-form **replaces** form state — fields missing from `values` become `undefined`, not their defaults. The entry snapshot contains all fields, but the user may edit the JSON and delete keys. Merging over defaults ensures partial JSON edits don't corrupt unedited fields.

```typescript
// Source: [ASSUMED] — react-hook-form reset() replace semantics
const merged = {
  ...buildDefaultValues(message),   // all fields at their defaults
  ...cleanedValues,                 // user edits overlay on top
};
setPendingReplayValues(merged);
```

Note: `buildDefaultValues` is already exported from `ProtoFormRenderer.tsx` for test usage — verify if it needs to be exported for `FormPanel.tsx` use as well, or move to a shared utility.

### Pattern 3: CodeMirror Props

**What:** Minimal CodeMirror setup for JSON editing with dark mode.

**Example (source: @uiw/react-codemirror README, verified via npm):**
```typescript
// Source: https://raw.githubusercontent.com/uiwjs/react-codemirror/master/core/README.md
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

<CodeMirror
  value={jsonDraft}
  height="100%"
  theme={resolvedTheme === "dark" ? "dark" : "light"}
  extensions={[json()]}
  onChange={(value) => setJsonDraft(value)}
  className="flex-1 min-h-0"
/>
```

The `theme` prop accepts the string literals `"light"` or `"dark"` — no external theme package import needed.

### Pattern 4: Top-Level-Only Unknown Field Detection

**What:** Compare the top-level keys of parsed JSON against `message.fields` map. Strip unrecognized keys before reset. Fire toast if any stripped.

**Scope clarification:** Top-level only — do NOT recurse into nested message objects, oneof branches, or map value objects. D-07/D-08 specify field names from `message.fields`, not deep schema traversal.

```typescript
// Source: [ASSUMED] — derived from D-07/D-08 decisions
const knownFieldNames = new Set(message.fields.map((f) => f.name));
const unknownKeys = Object.keys(parsedValues).filter((k) => !knownFieldNames.has(k));

if (unknownKeys.length > 0) {
  const label = unknownKeys.length === 1 ? "field" : "fields";
  toast.warning(`${unknownKeys.length} unknown ${label} ignored: ${unknownKeys.join(", ")}`);
}

const cleanedValues = Object.fromEntries(
  Object.entries(parsedValues).filter(([k]) => knownFieldNames.has(k))
);
```

### Pattern 5: entrySnapshot for Discard

**What:** Capture `latestValues` as a local immutable snapshot at the moment JSON mode is entered. Store it in local React state (not re-read from Zustand at Discard time).

**Why:** While `latestValues` is frozen in JSON mode (no `onValuesChange` fires), reading it live at Discard time is fragile. The snapshot captures the intent of D-06 precisely.

```typescript
// In FormPanel:
const [entrySnapshot, setEntrySnapshot] = useState<Record<string, unknown> | null>(null);

// On enter JSON mode:
setEntrySnapshot(latestValues);   // immutable point-in-time copy
setIsJsonMode(true);

// On Discard:
if (entrySnapshot) {
  setPendingReplayValues(entrySnapshot);  // same signal, same useEffect
  setIsJsonMode(false);
}
```

### Pattern 6: CodeMirror Mock for jsdom Tests

**What:** `@uiw/react-codemirror` uses ContentEditable internally — jsdom does not support ContentEditable. Any test that renders `JsonEditor` without mocking CodeMirror will fail with:
- `TypeError: Cannot read property 'extension' of null` (multiple @codemirror/state instances)
- ContentEditable DOM manipulation failures

**Solution:** `vi.mock("@uiw/react-codemirror")` with a textarea stub. This is the same approach the project uses for Radix UI Select (`vi.mock` with native `<select>` — referenced in STATE.md "Mocked shadcn Select").

```typescript
// Source: established project pattern (App.test.tsx vi.mock pattern) + CodeMirror jsdom issue #506
vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
```

Tests can then use `screen.getByTestId("codemirror-stub")` and `fireEvent.change(...)` normally.

### Anti-Patterns to Avoid

- **Calling `resetRef.current()` directly after `setIsJsonMode(false)` in the same handler:** resetRef.current is null until ProtoFormRenderer remounts. Use the `pendingReplayValues` signal instead.
- **Passing raw parsed JSON to `reset()` without merging over defaults:** Fields absent from the JSON become `undefined`. Always merge over `buildDefaultValues(message)` first.
- **Deep unknown-field traversal:** Spec (D-07) is top-level field names only. Recursing into nested objects significantly expands scope without a requirement to justify it.
- **Nesting CodeMirror inside a `<ScrollArea>`:** Stacks two scroll containers, breaks CodeMirror gutters and line number rendering. Use a plain `flex-1 flex flex-col min-h-0` div instead (UI-SPEC §2 refinement of D-02).
- **Importing `@codemirror/theme-one-dark`:** The `@uiw/react-codemirror` `theme="dark"` string prop is sufficient. The package is already a transitive dep but should not be explicitly imported.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Syntax highlighting JSON editor | Custom textarea + highlight.js | `@uiw/react-codemirror` + `@codemirror/lang-json` | CodeMirror 6 handles bracket matching, incremental parse, accessibility, undo stack, keyboard navigation |
| Dark mode detection | `window.matchMedia` query | `resolvedTheme` from `next-themes` | Already wired; respects user override over system preference; consistent with Phases 5+ |
| Toast notifications | Custom notification UI | `toast.warning()` from `sonner` | Already wired in App.tsx; matches existing pattern (toast.error for 20-file cap) |
| Form value reset after unmount | Tracking whether ProtoFormRenderer is mounted | `pendingReplayValues` Zustand signal → existing `useEffect` in FormPanel | The useEffect already handles the timing correctly for HIST-02 replay |

**Key insight:** Every infrastructure piece (toast, theme, form reset signal) is already in the project. The new code is limited to: one new component, toggle button, and snapshot capture logic.

---

## Common Pitfalls

### Pitfall 1: resetRef Null After Unmount

**What goes wrong:** Developer calls `resetRef.current(values)` after `setIsJsonMode(false)` in the same event handler. The call is a silent no-op — form never populates with JSON values.

**Why it happens:** D-02 unmounts ProtoFormRenderer in JSON mode. `ProtoFormRenderer.tsx` cleanup effect (lines 117-128) sets `resetRef.current = null`. After `setIsJsonMode(false)`, React schedules a re-render — ProtoFormRenderer remounts — but the effect that re-populates `resetRef.current` fires after the current event handler completes.

**How to avoid:** Use the `pendingReplayValues` Zustand signal. Write `setPendingReplayValues(mergedValues)` then `setIsJsonMode(false)`. The existing `useEffect` in `FormPanel` (lines 62-67) handles `resetRef.current(values)` after remount.

**Warning signs:** JSON values appear to silently discard when switching back to form mode; form shows snapshot values (the values from before JSON mode was entered).

### Pitfall 2: reset() Replaces — Undefined Fields

**What goes wrong:** `methods.reset(parsedValues)` where `parsedValues` is missing some message fields. Those fields render as `undefined` — empty but not at their schema defaults.

**Why it happens:** react-hook-form `reset()` is a full replace, not a merge. STATE.md records: "react-hook-form reset() not setValue() for JSON-to-form sync — setValue bypasses useFieldArray internal refs." This means reset is the right tool, but its replace semantics must be compensated.

**How to avoid:** Always merge: `{ ...buildDefaultValues(message), ...cleanedValues }` before passing to reset.

**Warning signs:** After JSON round-trip with all fields present, everything is fine. After user deletes a key in the JSON editor, that field renders empty/undefined rather than at its default.

### Pitfall 3: CodeMirror + jsdom Test Failures

**What goes wrong:** Tests render `JsonEditor` without mocking `@uiw/react-codemirror`. Vitest reports `TypeError: Cannot read property 'extension' of null` or similar ContentEditable-related errors.

**Why it happens:** CodeMirror 6 uses ContentEditable for editing. jsdom does not implement ContentEditable. Multiple `@codemirror/state` instances from module resolution can also trigger "Unrecognized extension value" errors (GitHub issue #506).

**How to avoid:** `vi.mock("@uiw/react-codemirror", ...)` with a textarea stub in all test files that render `JsonEditor` or `FormPanel` in JSON mode. (See Code Examples for the exact stub shape.)

**Warning signs:** Tests that worked before adding CodeMirror suddenly fail with null property errors unrelated to the test logic.

### Pitfall 4: Nesting CodeMirror Inside ScrollArea

**What goes wrong:** CodeMirror gutters misalign, line numbers offset, or horizontal scroll breaks.

**Why it happens:** Both `ScrollArea` (Radix) and CodeMirror's internal scroll container manage overflow. The outer Radix ScrollArea intercepts scroll events before CodeMirror's internal container sees them.

**How to avoid:** In JSON mode, replace the entire `<ScrollArea>` + `<ProtoFormRenderer>` block with a `<div className="flex-1 flex flex-col min-h-0">` + `<JsonEditor>`. CodeMirror manages its own scrolling via `height="100%"`.

**Warning signs:** Scrolling in the JSON editor doesn't work; content clips at the boundary; gutter elements drift.

### Pitfall 5: buildDefaultValues Accessibility

**What goes wrong:** `buildDefaultValues` is defined inside `ProtoFormRenderer.tsx` but is not exported. `FormPanel.tsx` needs it for the merge-over-defaults pattern.

**Why it happens:** The function was originally an internal implementation detail of ProtoFormRenderer.

**How to avoid:** Either export `buildDefaultValues` from `ProtoFormRenderer.tsx` (preferred — keeps it co-located with the schema logic) or move it to a shared utility like `src/lib/schema-utils.ts`. ProtoFormRenderer is FROZEN for additions but an export statement is non-functional change.

**Warning signs:** TypeScript error importing `buildDefaultValues` from ProtoFormRenderer; planner creates a duplicate implementation.

### Pitfall 6: Live Zustand Read for Discard Instead of Captured Snapshot

**What goes wrong:** "Discard" reads `latestValues` from Zustand at click time rather than at JSON mode entry. In practice latestValues is frozen during JSON mode, so values usually match — but this is fragile and doesn't match D-06's intent.

**How to avoid:** Capture `entrySnapshot` in local React state at the moment `setIsJsonMode(true)` is called. Use that snapshot exclusively for Discard.

---

## Code Examples

### Toggle Button (from UI-SPEC §1)
```tsx
// Source: .planning/phases/08-json-override-toggle/08-UI-SPEC.md §1
import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";

<Button
  variant="ghost"
  size="icon-sm"
  aria-label={isJsonMode ? "Return to form" : "Edit as JSON"}
  aria-pressed={isJsonMode}
  title={isJsonMode ? "Return to form" : "Edit as JSON"}
  className={isJsonMode ? "bg-muted text-foreground" : ""}
  onClick={handleToggle}
>
  <Braces />
</Button>
```

### CodeMirror Component (from README + UI-SPEC)
```tsx
// Source: https://raw.githubusercontent.com/uiwjs/react-codemirror/master/core/README.md
// + .planning/phases/08-json-override-toggle/08-UI-SPEC.md §2
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

<CodeMirror
  value={jsonDraft}
  height="100%"
  theme={resolvedTheme === "dark" ? "dark" : "light"}
  extensions={[json()]}
  onChange={(value) => setJsonDraft(value)}
/>
```

### Error Banner (from UI-SPEC §3)
```tsx
// Source: .planning/phases/08-json-override-toggle/08-UI-SPEC.md §3
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

{parseError && (
  <div className="mx-4 mt-2 mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
    <div className="flex items-start gap-2">
      <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-destructive">Invalid JSON</span>
        <p className="text-xs text-destructive mt-1" role="alert">{parseError}</p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={handleFixJson}>
            Fix JSON
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDiscard}>
            Discard changes
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

### Unknown Fields Toast (from UI-SPEC §4)
```tsx
// Source: .planning/phases/08-json-override-toggle/08-UI-SPEC.md §4
import { toast } from "sonner";

const unknownKeys = Object.keys(parsedValues).filter(
  (k) => !knownFieldNames.has(k)
);
if (unknownKeys.length > 0) {
  const label = unknownKeys.length === 1 ? "field" : "fields";
  toast.warning(
    `${unknownKeys.length} unknown ${label} ignored: ${unknownKeys.join(", ")}`
  );
}
```

### Full Toggle Handler Sketch
```typescript
// Source: [ASSUMED] — derived from D-04, D-05, D-06 + resetRef timing analysis
function handleToggle() {
  if (!isJsonMode) {
    // FORM → JSON
    const snapshot = latestValues ?? {};
    setEntrySnapshot(snapshot);
    setJsonSnapshot(JSON.stringify(snapshot, null, 2));
    setJsonDraft(JSON.stringify(snapshot, null, 2));
    setIsJsonMode(true);
    return;
  }

  // JSON → FORM
  let parsedValues: Record<string, unknown>;
  try {
    parsedValues = JSON.parse(jsonDraft) as Record<string, unknown>;
  } catch (e) {
    setParseError(e instanceof Error ? e.message : "Invalid JSON");
    return;  // stay in JSON mode (D-05)
  }

  // Clear any previous error
  setParseError(null);

  // Unknown field detection (top-level only, D-07/D-08)
  const knownFieldNames = new Set(message.fields.map((f) => f.name));
  const unknownKeys = Object.keys(parsedValues).filter((k) => !knownFieldNames.has(k));
  if (unknownKeys.length > 0) {
    const label = unknownKeys.length === 1 ? "field" : "fields";
    toast.warning(`${unknownKeys.length} unknown ${label} ignored: ${unknownKeys.join(", ")}`);
  }

  const cleanedValues = Object.fromEntries(
    Object.entries(parsedValues).filter(([k]) => knownFieldNames.has(k))
  );

  // Merge over defaults so reset() has a complete object (not partial)
  const mergedValues = { ...buildDefaultValues(message), ...cleanedValues };

  // Use existing HIST-02 signal — resets after ProtoFormRenderer remounts
  setPendingReplayValues(mergedValues);
  setIsJsonMode(false);
}
```

### CodeMirror Test Mock
```typescript
// Source: established project vi.mock pattern (App.test.tsx) + CodeMirror jsdom limitation
// [CITED: https://github.com/uiwjs/react-codemirror/issues/506]
vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@codemirror/theme-one-dark` explicit import for dark mode | `theme="dark"` string prop in `@uiw/react-codemirror` | CM6 / uiw v4+ | No extra import needed; built-in theme handling |
| `tailwind.config.js` for Tailwind setup | `@tailwindcss/vite` plugin, CSS `@import` | Tailwind 4.x | Already resolved in this project (shadcn initialized) |
| `setValue()` for programmatic form updates | `reset()` for full form state replacement | react-hook-form 7.x + useFieldArray | `setValue` bypasses useFieldArray refs; `reset()` is correct for JSON→form (locked decision) |

**Deprecated/outdated:**
- `@uiw/react-codemirror` v3 and below: used CodeMirror 5. v4+ uses CodeMirror 6 with full ESM. Do not reference CM5 docs.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `buildDefaultValues` can be exported from `ProtoFormRenderer.tsx` with no side effects (it is a pure function with no side effects) | Code Examples, Pattern 2 | Low — if export causes issues, a copy/shared util is the fallback |
| A2 | `entrySnapshot` local state captures `latestValues` as a value (not reference) — i.e., Zustand `latestValues` is a new object on each `setLatestValues` call | Pattern 5, Discard handler | Low — Zustand set creates new object; no mutation patterns observed |
| A3 | `toast.warning()` call signature is `toast.warning(message: string)` in sonner 2.x | Code Examples | Low — sonner API is stable; `toast.warning` used elsewhere in project |

---

## Open Questions

1. **`buildDefaultValues` export path**
   - What we know: function is defined but not exported in `ProtoFormRenderer.tsx`
   - What's unclear: whether the planner wants to export from `ProtoFormRenderer.tsx` (adding `export`) or move to `src/lib/schema-utils.ts`
   - Recommendation: Add `export` to `buildDefaultValues` in `ProtoFormRenderer.tsx`. It is a pure schema utility — export is safe. ProtoFormRenderer is FROZEN for behavioral changes, not for adding exports to existing functions.

2. **`jsonSnapshot` vs `jsonDraft` state split**
   - What we know: `jsonSnapshot` is the pre-filled value on entry; `jsonDraft` is the live-edited string
   - What's unclear: whether they should be a single state or two
   - Recommendation: Two separate state variables. `jsonSnapshot` is used only once (initial `value` prop), `jsonDraft` is updated on every `onChange`. CodeMirror is uncontrolled after initialization so `jsonSnapshot` can be the initial value passed only at mode entry.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@uiw/react-codemirror` | JSON-06 editor | ✗ (not installed) | — | No fallback — must install |
| `@codemirror/lang-json` | JSON-06 syntax highlighting | ✗ (not installed) | — | No fallback — must install |
| `next-themes` (`useTheme`) | JSON-06 dark mode | ✓ | 0.4.6 | — |
| `sonner` (`toast.warning`) | JSON-05 unknown fields toast | ✓ | 2.0.7 | — |
| `lucide-react` (`Braces`) | JSON-01 toggle icon | ✓ | 1.16.0 | — |
| `vitest` / `@testing-library/react` | Tests | ✓ | 4.1.6 / 16.3.2 | — |

**Missing dependencies requiring install (Wave 0):**
```bash
pnpm add @uiw/react-codemirror @codemirror/lang-json
```

[VERIFIED: npm registry — versions 4.25.9 and 6.0.2 are current as of 2026-03-25]

---

## Security Domain

This phase has no auth, no external API calls, and no user data crossing a trust boundary in a security-sensitive way.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes (limited) | `JSON.parse` with try/catch; error displayed to user as-is from `e.message` — no eval, no dynamic execution |
| V2–V4 Auth/Session/Access | No | Frontend-only dev tool feature |
| V6 Cryptography | No | No crypto operations |

**Threat note:** User JSON input is parsed with `JSON.parse()` (safe — does not eval). The `e.message` from a parse failure is displayed verbatim in the error banner. This is acceptable — the user is editing their own data and the message is never sent to a server.

---

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Tauri 2.x + Rust backend + React frontend. Phase 8 is frontend-only — no Rust changes.
- **Binary protobuf only in v1:** Not relevant to this phase (JSON Override is a form-editing tool, not a serialization format change).
- **ProtoFormRenderer is FROZEN:** No changes to `ProtoFormRenderer.tsx` permitted except adding an `export` qualifier to `buildDefaultValues`.
- **`reset()` not `setValue()`:** Locked in STATE.md — "react-hook-form reset() not setValue() for JSON-to-form sync — setValue bypasses useFieldArray internal refs".
- **`@uiw/react-codemirror ^4.25.9` + `@codemirror/lang-json ^6.0.x`:** Only new npm packages for this phase (locked in STATE.md).
- **`next-themes resolvedTheme`:** Dark mode via resolvedTheme prop (locked in STATE.md).
- **Immutability:** All state updates must return new objects (per coding-style.md). `{ ...buildDefaultValues(message), ...cleanedValues }` satisfies this.
- **No `console.log`:** Use no debug logging in production code.
- **Test coverage 80%+:** TDD approach required; CodeMirror must be mocked for jsdom tests.
- **File size cap 800 lines:** `JsonEditor.tsx` and the `FormPanel.tsx` additions are expected to stay well within this limit.

---

## Sources

### Primary (HIGH confidence)
- npm registry `@uiw/react-codemirror` — version 4.25.9, publish date 2026-03-25
- npm registry `@codemirror/lang-json` — version 6.0.2
- `src/components/form/FormPanel.tsx` — resetRef pattern, pendingReplayValues useEffect (lines 62-67)
- `src/components/form/ProtoFormRenderer.tsx` — resetRef cleanup effect (lines 117-128), buildDefaultValues
- `src/stores/useProtoStore.ts` — latestValues, pendingReplayValues, setPendingReplayValues
- `src/App.test.tsx` — vi.mock("next-themes") pattern
- `.planning/phases/08-json-override-toggle/08-UI-SPEC.md` — approved UI contract
- `.planning/phases/08-json-override-toggle/08-CONTEXT.md` — locked decisions D-01 through D-09
- `src/components/ui/button.tsx` — icon-sm size confirmed, destructive/ghost/outline variants confirmed
- `node_modules/lucide-react/dist/lucide-react.d.ts` — Braces icon confirmed present
- `https://raw.githubusercontent.com/uiwjs/react-codemirror/master/core/README.md` — props API (value, onChange, height, theme, extensions, basicSetup)

### Secondary (MEDIUM confidence)
- `@uiw/react-codemirror` npm dependencies manifest — transitives confirmed (@codemirror/state, view, commands, theme-one-dark bundled)

### Tertiary (LOW confidence / flagged)
- GitHub issue #506 (uiwjs/react-codemirror) — Vitest "Unrecognized extension value" error; documented as open, workaround is vi.mock

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified versions, peer deps confirmed
- Architecture: HIGH — codebase directly read; resetRef timing analysis based on actual source lines
- Pitfalls: HIGH (resetRef, jsdom mock) / MEDIUM (merge-over-defaults semantics)
- UI spec compliance: HIGH — approved UI-SPEC.md read directly

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (30 days — React ecosystem, stable libraries)
