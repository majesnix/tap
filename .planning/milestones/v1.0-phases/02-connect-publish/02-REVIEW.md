---
phase: 02-connect-publish
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/components/connection/ProfileManagementModal.tsx
  - src/components/connection/__tests__/ProfileManagementModal.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 02: Code Review Report — UAT Gap Closure (Scroll Layout Fix)

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

This is a targeted CSS/layout fix that adds `max-h-[85vh] flex flex-col overflow-hidden` to `DialogContent` and wraps the modal body in a `flex-1 min-h-0 overflow-y-auto` scroll container. The fix is mechanically correct: `src/lib/utils.ts` confirms `cn()` is backed by `tailwind-merge`, so the base `DialogContent` class of `display: grid` (dialog.tsx:64) is correctly overridden to `display: flex`. The three-class combination (`flex flex-col` on the container, `flex-1 min-h-0` on the child, `overflow-y-auto` on the child) is the canonical pattern for a constrained-height flex-scroll region and will scroll as intended.

Three warnings are raised: action buttons are trapped inside the scroll wrapper making them unreachable without scrolling on small viewports; the scroll container lacks `tabIndex={0}` so keyboard users cannot scroll to non-focusable error/status content; and the absolutely-positioned close button will visually overlap scrolled content. Three info items flag test brittleness, a misplaced test case, and a magic number.

---

## Warnings

### WR-01: Action Buttons Are Inside the Scroll Wrapper — Unreachable Without Scrolling on Small Viewports

**File:** `src/components/connection/ProfileManagementModal.tsx:270-380`

**Issue:** The "+ New Profile" button (line 270-274) and the Cancel / Test Connection / Save & Connect row (lines 364-380) are children of the scroll container. On a viewport where the form body is taller than `85vh`, these buttons scroll off the bottom of the visible area. Before this fix the modal simply overflowed the viewport and all buttons were reachable via page scroll; now the modal is height-capped and the buttons can be hidden. A user who fills in all fields and cannot see the Save button will be blocked.

**Fix:** Move the action button rows out of the scroll wrapper into sibling `div`s that are direct children of `DialogContent`. Both live at the same flex level and sit below the scroll region, always visible:

```tsx
<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
  <DialogHeader>
    <DialogTitle>Connection Profiles</DialogTitle>
  </DialogHeader>

  {/* Scrollable body — field rows only, no buttons */}
  <div className="flex-1 min-h-0 overflow-y-auto" data-testid="profile-modal-scroll">
    {/* profile list rows */}
    {/* form field groups */}
    {/* error message <p> */}
    {/* ConnectionTestResult */}
  </div>

  {/* Always-visible footer */}
  {formMode === "list" && (
    <div className="pt-2 border-t">
      <Button variant="outline" onClick={handleShowNewForm} className="w-full">
        + New Profile
      </Button>
    </div>
  )}
  {(formMode === "create" || formMode === "edit") && (
    <div className="flex justify-end gap-2 pt-2 border-t">
      <Button variant="outline" onClick={handleCancel}>Cancel</Button>
      {formMode === "create" && (
        <Button variant="outline" onClick={handleTestOnly} disabled={testState === "testing"}>
          Test Connection
        </Button>
      )}
      <Button onClick={handleSave} disabled={testState === "testing"}>
        Save &amp; Connect
      </Button>
    </div>
  )}
</DialogContent>
```

---

### WR-02: Scroll Container Is Not Keyboard-Scrollable — Non-Focusable Status Content Unreachable

**File:** `src/components/connection/ProfileManagementModal.tsx:232`

**Issue:** The scroll wrapper has no `tabIndex={0}`:

```tsx
<div className="flex-1 min-h-0 overflow-y-auto" data-testid="profile-modal-scroll">
```

Focusable inputs (text fields, buttons) auto-scroll into view when tabbed to, so typical Tab-key navigation works. However, the validation error `<p>` (lines 358-360) and the `<ConnectionTestResult>` component (line 362) are non-focusable. If these elements render below the visible fold — for example, on a short display or after the error appears mid-form — keyboard-only users cannot reach them via arrow keys or Page Down because those keys only scroll a focused scroll container. This fails WCAG 2.1 SC 2.1.1 (Keyboard).

**Fix:** Make the region focusable and label it:

```tsx
<div
  className="flex-1 min-h-0 overflow-y-auto"
  data-testid="profile-modal-scroll"
  tabIndex={0}
  role="region"
  aria-label="Profile form"
>
```

`tabIndex={0}` inserts the container into the Tab order so keyboard users can focus it and scroll with arrow keys / Page Down / Page Up. The `role="region"` + `aria-label` pair satisfies the ARIA requirement that landmark regions are named.

---

### WR-03: Absolutely-Positioned Close Button Overlaps Scrolled Content

**File:** `src/components/ui/dialog.tsx:74` (close button) / `src/components/connection/ProfileManagementModal.tsx:227` (overflow-hidden container)

**Issue:** `DialogContent` renders a close button with `className="absolute top-2 right-2"` (dialog.tsx:74). Now that `DialogContent` has `overflow-hidden`, content that scrolls upward passes behind this button in the top-right corner — the profile name row at position zero, or the form header, slides directly under the X button with no visual separation. The `overflow-hidden` clips the scroll region so nothing protrudes outside the dialog boundary, but content within that boundary can still underlap the absolute-positioned button.

**Fix:** Add `pr-8` (or equivalent right padding) to the scroll container so the rightmost 2rem of each row is clear of the button:

```tsx
<div
  className="flex-1 min-h-0 overflow-y-auto pr-8"
  data-testid="profile-modal-scroll"
>
```

Alternatively, add `pr-8` to the `DialogHeader` and any full-width rows inside the scroll container.

---

## Info

### IN-01: Scroll Layout Tests Verify Class Strings, Not Scroll Behaviour

**File:** `src/components/connection/__tests__/ProfileManagementModal.test.tsx:343-363`

**Issue:** The two `describe("scroll layout")` tests at lines 343-363 assert that specific Tailwind class strings are present on DOM nodes (`toHaveClass("max-h-[85vh]")`, `toHaveClass("overflow-y-auto")`, etc.). JSDOM does not compute layout, so these tests cannot detect whether scrolling actually works, whether the flex container collapses, or whether the action buttons are inaccessible. They will pass even if the layout is broken. They also fail on harmless refactors (e.g., renaming a class to a CSS variable-based utility). These tests are a class-presence regression guard only — they do not validate the fix's stated goal.

The authoritative verification requires Playwright measuring rendered scroll height or manual UAT on a viewport shorter than the form content. Retain the tests as deletion guards but do not treat them as evidence that scroll works.

**Suggestion:** Add an explanatory comment:

```ts
// Guards that layout classes are present. Does NOT verify scroll behaviour — use Playwright E2E for that.
it("DialogContent has max-h-[85vh] flex flex-col overflow-hidden classes", async () => {
```

---

### IN-02: "Save & Connect" Integration Test Is Nested in the Wrong `describe` Block

**File:** `src/components/connection/__tests__/ProfileManagementModal.test.tsx:181`

**Issue:** The test `"Save & Connect button continues to save, test, and activate as before"` (lines 181-216) is nested inside `describe("handleTestOnly")`. It exercises `handleSave`, not `handleTestOnly`. Future developers looking for `handleSave` coverage will not find this test in the expected location, and the `handleTestOnly` block appears to contain unrelated coverage.

**Fix:** Move the test into its own `describe("handleSave")` block.

---

### IN-03: `85vh` Is a Magic Number Without Explanation

**File:** `src/components/connection/ProfileManagementModal.tsx:227`

**Issue:** The value `85vh` in `max-h-[85vh]` is used without a comment explaining why `85vh` was chosen rather than `80vh`, `90vh`, or `100vh`. Per the project coding-style rule on magic numbers, meaningful thresholds should be documented. Future changes (e.g., adding a modal footer that reduces available height) will have no baseline to reason from.

**Fix:** Add an inline comment:

```tsx
{/* max-h-[85vh]: leaves visible margin so the modal does not touch screen edges on small viewports */}
<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
```

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
