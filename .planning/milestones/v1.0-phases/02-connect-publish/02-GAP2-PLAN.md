---
phase: 02-connect-publish
plan: GAP2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/connection/ProfileManagementModal.tsx
  - src/components/connection/__tests__/ProfileManagementModal.test.tsx
autonomous: true
requirements: [CONN-01]
gap_closure: true
uat_gap: "ProfileManagementModal does not scroll when there are many saved profiles, causing content to overflow off-screen"

must_haves:
  truths:
    - "The modal dialog itself never exceeds 85% of viewport height (max-h-[85vh])"
    - "When many profiles are listed, the content area scrolls vertically instead of overflowing off-screen"
    - "The DialogHeader (title) is always visible at the top — it does not scroll away"
    - "The scrollable content area has overflow-y-auto and min-h-0 so it actually scrolls under flexbox"
    - "The inline create/edit form also scrolls inside the same container if it is taller than the available space"
  artifacts:
    - path: "src/components/connection/ProfileManagementModal.tsx"
      provides: "Scrollable modal layout via max-h-[85vh] flex flex-col on DialogContent and overflow-y-auto flex-1 min-h-0 scroll container"
      contains: "overflow-y-auto"
    - path: "src/components/connection/__tests__/ProfileManagementModal.test.tsx"
      provides: "Class-presence tests verifying scroll container structure"
      contains: "overflow-y-auto"
  key_links:
    - from: "DialogContent className"
      to: "max-h-[85vh] flex flex-col"
      via: "tailwind-merge (cn() uses twMerge so flex wins over the base grid class)"
      pattern: "max-h-\\[85vh\\]"
    - from: "scroll wrapper div"
      to: "flex-1 min-h-0 overflow-y-auto"
      via: "flex child with min-h-0 to defeat default min-height:auto"
      pattern: "min-h-0"
---

<objective>
Fix modal overflow by adding a constrained height and a scrollable content wrapper to ProfileManagementModal.tsx.

Purpose: UAT Gap 2 — when many profiles are saved, the modal content grows beyond the viewport and parts become unreachable with no scroll affordance. This is a pure CSS/layout fix with no Rust backend changes.

Output: One modified React component file, one updated test file. The AlertDialogContent (delete confirmation) is out of scope — it is short and unaffected.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/02-connect-publish/02-UI-SPEC.md

<interfaces>
<!-- Key types and contracts the executor needs. No codebase exploration required. -->

From src/components/ui/dialog.tsx (line 64) — DialogContent base className (abridged):
```
"fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2
 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 ..."
```
Key fact: the base includes `grid` and `gap-4`. Passing `className="... flex flex-col"` to DialogContent
resolves via cn() → twMerge, which replaces `grid` with `flex`. The `gap-4` carries over (valid in both).
Do NOT edit dialog.tsx — override at the consumer (ProfileManagementModal.tsx) only.

From src/lib/utils.ts:
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
twMerge is active — `flex` WILL override `grid` automatically.

From src/components/connection/ProfileManagementModal.tsx (current DialogContent, line 227):
```tsx
<DialogContent className="sm:max-w-lg">
```
Target state after fix:
```tsx
<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
```

Current body structure inside DialogContent (simplified):
```tsx
<DialogHeader>
  <DialogTitle>Connection Profiles</DialogTitle>
</DialogHeader>

{/* Profile list — grows unboundedly today */}
{profiles.length > 0 && (
  <div className="flex flex-col gap-2">
    {profiles.map(...)}
  </div>
)}

{/* Empty state */}
{profiles.length === 0 && formMode === "list" && (...)}

{/* New profile button */}
{formMode === "list" && (...)}

{/* Inline form */}
{(formMode === "create" || formMode === "edit") && (
  <div className="flex flex-col gap-3">
    ...
    {/* Action buttons row — stays inside scroll, scrolls with content (acceptable for this gap scope) */}
    <div className="flex justify-end gap-2">...</div>
  </div>
)}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add scroll container to ProfileManagementModal layout</name>
  <files>src/components/connection/ProfileManagementModal.tsx, src/components/connection/__tests__/ProfileManagementModal.test.tsx</files>

  <read_first>
    - src/components/connection/ProfileManagementModal.tsx (read the full file to see exact current JSX structure before touching anything)
    - src/components/connection/__tests__/ProfileManagementModal.test.tsx (read the full file to understand existing test structure before adding new tests)
    - src/components/ui/dialog.tsx (lines 50-90 — confirm DialogContent className to understand what twMerge will resolve)
  </read_first>

  <behavior>
    - DialogContent element has class `max-h-[85vh]` applied
    - DialogContent element has class `flex` and `flex-col` applied (overriding the base `grid`)
    - A direct child div of DialogContent (after DialogHeader, wrapping all body content) has classes `flex-1 min-h-0 overflow-y-auto`
    - That div also has `data-testid="profile-modal-scroll"` for test targeting
    - The DialogHeader is NOT inside the scroll container (it remains a direct child of DialogContent so the title is always pinned at the top)
    - The action buttons row (Cancel / Test Connection / Save & Connect) stays inside the scroll container — it scrolls with the form content (simplest approach, within gap scope)
    - No changes to AlertDialogContent (delete confirmation dialog) — out of scope
  </behavior>

  <action>
**RED phase: add two failing tests before touching the component.**

Open `src/components/connection/__tests__/ProfileManagementModal.test.tsx` and add a new `describe` block at the end (after the `"edit mode"` describe block):

```tsx
describe("scroll layout", () => {
  it("DialogContent has max-h-[85vh] flex flex-col overflow-hidden classes", async () => {
    renderModal();
    // DialogContent renders as role="dialog"
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("max-h-[85vh]");
    expect(dialog).toHaveClass("flex");
    expect(dialog).toHaveClass("flex-col");
    expect(dialog).toHaveClass("overflow-hidden");
  });

  it("scroll container div has flex-1 min-h-0 overflow-y-auto classes", async () => {
    renderModal();
    await screen.findByRole("dialog");
    const scrollContainer = document.querySelector('[data-testid="profile-modal-scroll"]');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveClass("flex-1");
    expect(scrollContainer).toHaveClass("min-h-0");
    expect(scrollContainer).toHaveClass("overflow-y-auto");
  });
});
```

Run `npm test -- --reporter=verbose ProfileManagementModal` and confirm both new tests FAIL (RED) before proceeding.

---

**GREEN phase: implement the layout fix.**

Open `src/components/connection/ProfileManagementModal.tsx`.

**Change 1 — DialogContent className (line ~227).**

Find:
```tsx
<DialogContent className="sm:max-w-lg">
```
Replace with:
```tsx
<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
```

Rationale for `max-h-[85vh]`: 85 vh leaves ~15% chrome for OS title bars and taskbars on compact displays (e.g., 768px-height laptop screens). A fixed `600px` would clip on smaller screens; `80vh` is common but 85 vh gives 51px extra headroom on a 1080p monitor without touching the title bar area. `flex flex-col` is required so the children can participate in the scroll layout; twMerge will resolve the base `grid` → `flex` conflict automatically. `overflow-hidden` prevents the dialog box itself from visually leaking before the inner scroll kicks in.

**Change 2 — wrap body content in a scroll container.**

Immediately after the closing `</DialogHeader>` tag, insert an opening div:
```tsx
<div className="flex-1 min-h-0 overflow-y-auto" data-testid="profile-modal-scroll">
```

Then, immediately before the closing `</DialogContent>` tag (but AFTER the inline form closes its `</div>` for `formMode === "create" || formMode === "edit"`), close the scroll wrapper:
```tsx
</div>
```

The resulting structure inside `<DialogContent>` must be exactly:
```tsx
<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
  {/* Header stays outside scroll — always visible */}
  <DialogHeader>
    <DialogTitle>Connection Profiles</DialogTitle>
  </DialogHeader>

  {/* Scroll container — wraps all body content */}
  <div className="flex-1 min-h-0 overflow-y-auto" data-testid="profile-modal-scroll">
    {/* Profile list */}
    {profiles.length > 0 && (
      <div className="flex flex-col gap-2">
        {profiles.map((profile) => (...))}
      </div>
    )}

    {/* Empty state */}
    {profiles.length === 0 && formMode === "list" && (
      <p className="text-sm text-muted-foreground">No profiles saved yet.</p>
    )}

    {/* New profile button */}
    {formMode === "list" && (
      <Button variant="outline" onClick={handleShowNewForm} className="w-full mt-2">
        + New Profile
      </Button>
    )}

    {/* Inline form (create or edit) — action buttons scroll with form content */}
    {(formMode === "create" || formMode === "edit") && (
      <div className="flex flex-col gap-3">
        {/* ... all form fields unchanged ... */}
        <div className="flex justify-end gap-2">
          {/* ... Cancel / Test Connection / Save & Connect unchanged ... */}
        </div>
      </div>
    )}
  </div>
</DialogContent>
```

Important: Do NOT add a top margin to the scroll container div itself — the `gap-4` from DialogContent's base className already provides separation between DialogHeader and the scroll container in flex mode.

Do NOT change any field, button, handler, or logic — this is a layout-only change. No Rust files. No dialog.tsx.

After implementing, run `npm test -- --reporter=verbose ProfileManagementModal` and confirm:
1. Both new scroll layout tests pass (GREEN).
2. All pre-existing tests in handleTestOnly and edit mode describe blocks continue to pass (no regressions).
  </action>

  <verify>
    <automated>npm test -- --reporter=verbose ProfileManagementModal</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c 'max-h-\[85vh\]' src/components/connection/ProfileManagementModal.tsx` outputs `1`
    - `grep -c 'flex flex-col overflow-hidden' src/components/connection/ProfileManagementModal.tsx` outputs `1`
    - `grep -c 'min-h-0 overflow-y-auto' src/components/connection/ProfileManagementModal.tsx` outputs `1`
    - `grep -c 'data-testid="profile-modal-scroll"' src/components/connection/ProfileManagementModal.tsx` outputs `1`
    - `grep -c 'profile-modal-scroll' src/components/connection/__tests__/ProfileManagementModal.test.tsx` outputs at least `1`
    - `npm test -- --reporter=verbose ProfileManagementModal` exits 0 with all tests (including new scroll layout tests) passing
    - `npx tsc --noEmit` exits 0 — no TypeScript errors introduced
    - AlertDialogContent is NOT modified (verify: `grep -c 'AlertDialogContent' src/components/connection/ProfileManagementModal.tsx` count unchanged from current file)
  </acceptance_criteria>

  <done>
    DialogContent has max-h-[85vh], flex, flex-col, overflow-hidden applied.
    A scroll wrapper div with flex-1, min-h-0, overflow-y-auto, and data-testid="profile-modal-scroll" wraps all body content below DialogHeader.
    Both new scroll layout tests pass.
    All pre-existing ProfileManagementModal tests continue to pass.
    TypeScript compiles clean.
    No Rust files touched. dialog.tsx not touched.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → DOM layout | Pure CSS/layout change; no new trust boundaries introduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-GAP2-01 | Information Disclosure | data-testid attribute in production DOM | accept | data-testid is a testing convention; exposes no sensitive data; removed by build tools if tree-shaking is configured, but harmless either way for a desktop dev tool |
| T-GAP2-02 | Denial of Service | Unbounded profile list rendering inside scroll container | accept | Profile list was already unbounded before this fix; scrolling does not increase attack surface; this is a dev tool, not a public endpoint; rendering cost is unchanged |
</threat_model>

<verification>
Run in order after the task is complete:

```bash
# TypeScript clean
npx tsc --noEmit

# Unit tests — all must pass, no regressions
npm test -- --reporter=verbose ProfileManagementModal

# Class presence checks (must each return 1)
grep -c 'max-h-\[85vh\]' src/components/connection/ProfileManagementModal.tsx
grep -c 'min-h-0 overflow-y-auto' src/components/connection/ProfileManagementModal.tsx
grep -c 'data-testid="profile-modal-scroll"' src/components/connection/ProfileManagementModal.tsx

# Confirm AlertDialog is untouched
grep -c 'AlertDialogContent' src/components/connection/ProfileManagementModal.tsx
# Should return 3 (import + opening + closing tags) — same as before

# Manual smoke test (no RabbitMQ needed):
# 1. Open app → gear icon
# 2. In ProfileManagementModal: add 8+ profiles (use any host values)
# 3. Expected: profile list scrolls inside the modal; modal itself does not
#    grow off-screen; title "Connection Profiles" stays pinned at the top
# 4. Click "+ New Profile": form appears inside scroll container and scrolls
#    if it overflows the modal height on small screens
# 5. Confirm Delete confirmation AlertDialog still works (unaffected)
```
</verification>

<success_criteria>
- TypeScript compiles with zero errors (`npx tsc --noEmit` exits 0)
- All ProfileManagementModal tests pass including two new scroll layout tests
- All pre-existing handleTestOnly and edit mode tests continue to pass (no regressions)
- DialogContent receives `max-h-[85vh] flex flex-col overflow-hidden` via className
- Scroll container div has `flex-1 min-h-0 overflow-y-auto` and `data-testid="profile-modal-scroll"`
- DialogHeader is NOT inside the scroll container (title always visible)
- No changes to Rust backend files
- No changes to src/components/ui/dialog.tsx
- AlertDialogContent is not modified
</success_criteria>

<output>
After completion, create `.planning/phases/02-connect-publish/02-GAP2-SUMMARY.md` using the standard summary template at `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
