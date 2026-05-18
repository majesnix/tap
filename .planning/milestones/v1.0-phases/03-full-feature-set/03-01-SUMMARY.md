---
phase: 03-full-feature-set
plan: "01"
subsystem: ui
tags: [zustand, react, tauri, shadcn, tabs, proto, form]

# Dependency graph
requires:
  - phase: 02-connect-publish
    provides: PublishBar and connection profile infrastructure used by latestValues signal
provides:
  - "useProtoStore expanded with multi-file openFiles array, activeIndex, plain stored activeFilePath/schema"
  - "addOrActivateFile / closeFile / setActiveIndex tab management actions"
  - "latestValues / lastSendAt / pendingReplayValues signal fields for downstream plans"
  - "FileSection Tabs UI with per-file tabs and × close button"
  - "FormPanel lifting latestValues to store + pendingReplayValues replay consumer"
  - "WellKnownTypeField isFallback branch with shortName-based placeholders"
affects:
  - 03-full-feature-set

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-tabs (via shadcn Tabs component)"
  patterns:
    - "Plain stored computed fields: activeFilePath and schema kept in sync by all mutating actions (not getters)"
    - "True no-op pattern in Zustand: return s (same reference) when state is already correct"
    - "resetRef pattern: FormPanel passes a MutableRefObject to ProtoFormRenderer; renderer wires form.reset into it"
    - "Sibling close button: TabsTrigger + <button> siblings in a flex div (avoids invalid nested button HTML)"

key-files:
  created:
    - src/stores/useProtoStore.test.ts
    - src/components/ui/tabs.tsx
  modified:
    - src/stores/useProtoStore.ts
    - src/components/sidebar/FileSection.tsx
    - src/components/form/FormPanel.tsx
    - src/components/form/ProtoFormRenderer.tsx
    - src/components/form/fields/WellKnownTypeField.tsx
    - src/components/form/__tests__/FormPanel.test.tsx

key-decisions:
  - "Plain stored activeFilePath + schema (not getters) — all mutating actions keep them in sync explicitly"
  - "True no-op addOrActivateFile: return s unchanged when same file is already active (prevents spurious re-renders)"
  - "latestValues lifted to Zustand store (D-07 / Option A) — FormPanel calls setLatestValues via getState() in handleValuesChange"
  - "resetRef sibling approach for ProtoFormRenderer: optional prop, renderer wires methods.reset to it post-mount"
  - "Close button as sibling of TabsTrigger (not nested) — avoids invalid nested button HTML"
  - "20-file cap enforced in addOrActivateFile with toast.error (T-03-01-03 mitigate)"

patterns-established:
  - "Signal fields pattern: latestValues / pendingReplayValues / lastSendAt as store fields with typed setters"
  - "Tab management: openFiles array + activeIndex, closeFile clamps to length-1"

requirements-completed:
  - PROT-03
  - PROT-04

# Metrics
duration: 35min
completed: 2026-05-18
---

# Phase 3 Plan 01: Multi-file Tabs + Store Signal Fields Summary

**Zustand store expanded to multi-file tabs (openFiles/activeIndex) with latestValues, lastSendAt, pendingReplayValues signals; FileSection replaced with shadcn Tabs UI; FormPanel lifts latestValues to store and wires pendingReplayValues replay**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-18T00:00:00Z
- **Completed:** 2026-05-18
- **Tasks:** 2 (TDD Task 1 + Task 2)
- **Files modified:** 8 (including 2 new files)

## Accomplishments

- Expanded useProtoStore from single-file to multi-file with openFiles array, activeIndex, and tab management actions (addOrActivateFile, closeFile, setActiveIndex)
- Added signal fields latestValues, lastSendAt, pendingReplayValues with typed setters for downstream plans
- FileSection now shows shadcn Tabs with one tab per open proto file plus × close buttons (sibling pattern, not nested buttons)
- FormPanel lifts latestValues out of local useState into Zustand store; pendingReplayValues replay consumer via resetRef
- WellKnownTypeField isFallback branch updated with shortName-based placeholder: "TypeName (JSON)" for Any/Struct/Value/ListValue, "TypeName value" for others
- All 90 tests pass (16 new store tests + 74 prior)

## Task Commits

1. **TDD RED - Test file for useProtoStore** - `1e6ab26` (test)
2. **Task 1: Expand useProtoStore to multi-file + signal fields** - `be6f0e4` (feat)
3. **Task 2: Replace FileSection with Tabs + update FormPanel signals** - `2e9cf6c` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `src/stores/useProtoStore.ts` - Rewrote with multi-file support, 20-file cap, signal fields
- `src/stores/useProtoStore.test.ts` - 16 unit tests covering all behaviors
- `src/components/ui/tabs.tsx` - shadcn Tabs component (new, via shadcn CLI)
- `src/components/sidebar/FileSection.tsx` - Replaced single-file display with Tabs UI
- `src/components/form/FormPanel.tsx` - Lifted latestValues to store, added pendingReplayValues consumer
- `src/components/form/ProtoFormRenderer.tsx` - Added optional resetRef prop
- `src/components/form/fields/WellKnownTypeField.tsx` - Updated isFallback placeholder logic
- `src/components/form/__tests__/FormPanel.test.tsx` - Fixed setFile → addOrActivateFile (Rule 3)

## Decisions Made

- **Plain stored activeFilePath + schema fields**: Not getters — all mutating actions set them explicitly. Consumers can select them directly via `useProtoStore((s) => s.activeFilePath)`.
- **True no-op addOrActivateFile**: Returns `s` (same reference) when the same file is already the active tab, preventing spurious re-renders.
- **latestValues lifted to store**: FormPanel.handleValuesChange calls `useProtoStore.getState().setLatestValues()` directly; store latestValues feeds debouncedValues for encodeMessage.
- **resetRef pattern**: ProtoFormRenderer accepts an optional `resetRef` and assigns `methods.reset` to it after mount. FormPanel creates the ref and watches pendingReplayValues in a useEffect.
- **Sibling close button**: Each tab is a flex div with `TabsTrigger` and a `<button>` as siblings, avoiding invalid nested button HTML.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated FormPanel.test.tsx to use addOrActivateFile**
- **Found during:** Task 1 (store rewrite)
- **Issue:** FormPanel.test.tsx line 46 used `setFile()` which was removed. Full vitest suite would fail.
- **Fix:** Changed `useProtoStore.getState().setFile(...)` to `useProtoStore.getState().addOrActivateFile(...)`
- **Files modified:** `src/components/form/__tests__/FormPanel.test.tsx`
- **Verification:** Full vitest suite: PASS (90)
- **Committed in:** `be6f0e4` (Task 1 commit)

**2. [Rule 2 - Missing Critical] 20-file cap for T-03-01-03 (mitigate)**
- **Found during:** Task 1 (threat model review)
- **Issue:** Plan body's addOrActivateFile example had no cap; threat register assigned `mitigate` disposition to T-03-01-03 (DoS via unlimited file accumulation)
- **Fix:** Added `if (s.openFiles.length >= MAX_OPEN_FILES)` guard with `toast.error` in addOrActivateFile; added behavior test in test file
- **Files modified:** `src/stores/useProtoStore.ts`, `src/stores/useProtoStore.test.ts`
- **Verification:** 16/16 store tests pass including 20-file cap test
- **Committed in:** `be6f0e4` (Task 1 commit)

**3. [Rule 2 - Correctness] True no-op addOrActivateFile when same file already active**
- **Found during:** Task 1 (plan behavior vs. example code mismatch identified by advisor)
- **Issue:** Plan example code returned a new state object even when `existing === s.activeIndex`, causing spurious re-renders and resetting selectedMessageType
- **Fix:** Return `s` unchanged when `existingIndex !== -1 && existingIndex === s.activeIndex`
- **Files modified:** `src/stores/useProtoStore.ts`
- **Verification:** No-op test passes (selectedMessageType preserved after re-opening active file)
- **Committed in:** `be6f0e4` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 2 Rule 2 critical functionality)
**Impact on plan:** All auto-fixes necessary for correctness and security. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None — all signal fields (latestValues, lastSendAt, pendingReplayValues) are implemented with typed setters. The pendingReplayValues replay signal requires the HIST-02 plan to call `setPendingReplayValues(values)` to trigger replay; this is intentional and documented.

## Threat Flags

No new security-relevant surface introduced beyond what the plan's threat model documents.

## Next Phase Readiness

- Multi-file tab store is ready; Plans 03-02 through 03-04 can now read `openFiles`, `activeIndex`, `latestValues`, `lastSendAt`, and `pendingReplayValues` without additional store work.
- `lastSendAt` is present but not yet called — Plan 03-02 (AMQP props) or 03-03 (RightPanel) should call `setLastSendAt(Date.now())` on successful publish.
- `pendingReplayValues` consumer is wired in FormPanel; HIST-02 sets it by calling `setPendingReplayValues(values)`.

---
*Phase: 03-full-feature-set*
*Completed: 2026-05-18*
