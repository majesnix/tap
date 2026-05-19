---
phase: 10-publisher-confirms-badge
plan: "02"
subsystem: react-frontend
tags: [publisher-confirms, badge, react, typescript, ipc, vitest]
dependency_graph:
  requires: [10-01]
  provides: [PublishOutcome-ts-interface, publishMessage-returns-outcome, PublishBar-badge-jsx]
  affects: [src/lib/types.ts, src/lib/ipc.ts, src/components/publish/PublishBar.tsx, src/components/publish/__tests__/PublishBar.test.tsx]
tech_stack:
  added: []
  patterns: [useRef-dismiss-timer, fake-timers-shouldAdvanceTime, outcome-badge-inline]
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - src/lib/ipc.ts
    - src/components/publish/PublishBar.tsx
    - src/components/publish/__tests__/PublishBar.test.tsx
decisions:
  - "vi.useFakeTimers({ shouldAdvanceTime: true }) required — plain vi.useFakeTimers() blocks RTL waitFor polling in Vitest 4.x (Rule 1 auto-fix)"
  - "D-09 prologue placed after canSend guards but before setIsSending — no-op click preserves prior badge correctly"
  - "Badge positioned left of Send button (D-06) using existing Badge component with className overrides (D-07)"
  - "Timeout badge only: manual dismiss button; ACK/Returned/NACK auto-dismiss (D-08, Pitfall 6)"
metrics:
  duration: "10m"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 10 Plan 02: Publisher Confirms Badge — React Frontend Summary

**One-liner:** Added `PublishOutcome` TypeScript interface, updated `publishMessage` IPC return type, and implemented the ephemeral delivery outcome badge in PublishBar with auto-dismiss timers and a Timeout-only dismiss button.

## What Was Built

### Task 1 — PublishOutcome type and IPC return type update

1. **`src/lib/types.ts`** — Appended `PublishOutcome` interface after the Phase 9 `ExchangeSummary` block:
   ```typescript
   export interface PublishOutcome {
     status: "ack" | "nack" | "returned" | "timeout";
   }
   ```
   Uses `interface` keyword consistent with all other shapes in the file. `status` is a string literal union (D-02).

2. **`src/lib/ipc.ts`** — Two changes:
   - Import `PublishOutcome` from `./types` alongside `ExchangeSummary`
   - `publishMessage` return type changed from `Promise<void>` to `Promise<PublishOutcome>`; `invoke<void>` changed to `invoke<PublishOutcome>` (D-01)

### Task 2 — PublishBar badge state, dismiss timer, and JSX (TDD)

**RED commit (b49b85f):** Added Phase 10 describe block with 7 test cases to `PublishBar.test.tsx`. Tests failed as expected — badge JSX not yet in `PublishBar.tsx`.

**GREEN commit (dff21f8):** Applied all implementation changes to `PublishBar.tsx`:

3. **Imports** — Added `useRef` to React import; added `import type { PublishOutcome } from "@/lib/types"`

4. **State** — Added `const [outcome, setOutcome] = useState<PublishOutcome | null>(null)` and `const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`

5. **Unmount cleanup** — Added `useEffect(() => { return () => { if (dismissTimerRef.current !== null) { clearTimeout(dismissTimerRef.current); } }; }, [])` to prevent timer leak on unmount (Pitfall 4 / T-10-02-02 mitigate)

6. **`handleSend` D-09 prologue** — `clearTimeout(dismissTimerRef.current)` + `setOutcome(null)` before any `await`, canceling the prior timer and clearing the prior badge on every new send

7. **Success toast removed** — `toast(`Message sent to ${targetName}`, { duration: 3000 })` deleted

8. **Outcome capture** — `const result = await publishMessage(...)` replaces the bare `await`; `setOutcome(result)` called immediately; auto-dismiss timer set for ACK (3000ms), Returned (5000ms), NACK (5000ms), none for Timeout

9. **Badge JSX** — Inserted between Properties button and Send button; `variant="outline"` + `className` overrides for four status colors; Timeout-only `<button aria-label="Dismiss timeout badge">` (D-08, Pitfall 6)

## Verification Results

All plan verification checks passed:

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "interface PublishOutcome" src/lib/types.ts` | 1 | 1 |
| `grep -c "Promise<PublishOutcome>" src/lib/ipc.ts` | 1 | 1 |
| `grep -c "dismissTimerRef" src/components/publish/PublishBar.tsx` | >= 3 | 7 |
| `grep -c "Dismiss timeout badge" src/components/publish/PublishBar.tsx` | 1 | 1 |
| `grep -c "Message sent to" src/components/publish/PublishBar.tsx` | 0 | 0 |
| `grep -c "Phase 10 — Publisher Confirms Badge" PublishBar.test.tsx` | 1 | 1 |
| `grep -c "vi.useFakeTimers" PublishBar.test.tsx` | 1 | 1 |
| `grep -c "hexPreview.*0a 05" PublishBar.test.tsx` | 1 | 1 |
| `npm test -- PublishBar` | all pass | 23/23 |
| `npm test` (full suite) | all pass | 204/204 |
| `npx tsc --noEmit` | no errors | no errors |

## Commits

| Task | Phase | Name | Commit | Files |
|------|-------|------|--------|-------|
| 1 | feat | Add PublishOutcome type and update publishMessage return type | 2175b42 | src/lib/types.ts, src/lib/ipc.ts |
| 2 RED | test | Add failing Phase 10 Publisher Confirms Badge test cases | b49b85f | src/components/publish/__tests__/PublishBar.test.tsx |
| 2 GREEN | feat | Add publisher confirms badge to PublishBar with dismiss timer | dff21f8 | src/components/publish/PublishBar.tsx, src/components/publish/__tests__/PublishBar.test.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.useFakeTimers blocking RTL waitFor in Vitest 4.x**
- **Found during:** Task 2 GREEN phase (all 7 Phase 10 tests timing out)
- **Issue:** `vi.useFakeTimers()` without options replaces `setTimeout` globally in Vitest 4.x. RTL's `waitFor` uses `setTimeout` internally to poll its condition callback. With fake timers active, this polling never fires, causing every `waitFor` to time out at 5000ms (the default).
- **Fix:** Changed `vi.useFakeTimers()` to `vi.useFakeTimers({ shouldAdvanceTime: true })`. This makes the fake clock advance with real elapsed time, so `waitFor` polling fires normally. `vi.advanceTimersByTime(N)` still works to jump the clock for auto-dismiss assertions.
- **Files modified:** `src/components/publish/__tests__/PublishBar.test.tsx`
- **Commit:** dff21f8 (included in GREEN commit)
- **Verification:** `grep -c "vi.useFakeTimers"` still outputs 1 (plan verify literal check passes)

All other plan instructions were applied exactly as specified.

## Threat Surface Scan

No new attack surface introduced:
- `PublishOutcome.status` is set by Rust from the broker's `Confirmation` enum — not from user input
- Badge text content (ACK, Returned, NACK, Timeout) discloses no sensitive data
- T-10-02-02 (timer accumulation DoS): mitigated by D-09 prologue + unmount cleanup — verified in test suite

## Known Stubs

None — all four badge status variants are fully wired to real `PublishOutcome` values from the Rust backend.

## Self-Check: PASSED

- [x] `src/lib/types.ts` exists and contains `interface PublishOutcome`
- [x] `src/lib/ipc.ts` contains `Promise<PublishOutcome>` and `invoke<PublishOutcome>`
- [x] `src/components/publish/PublishBar.tsx` contains `dismissTimerRef` (7 occurrences)
- [x] `src/components/publish/PublishBar.tsx` contains `Dismiss timeout badge`
- [x] `src/components/publish/PublishBar.tsx` does NOT contain `Message sent to`
- [x] `src/components/publish/__tests__/PublishBar.test.tsx` contains `Phase 10 — Publisher Confirms Badge`
- [x] Commit 2175b42 exists in git log (Task 1)
- [x] Commit b49b85f exists in git log (Task 2 RED)
- [x] Commit dff21f8 exists in git log (Task 2 GREEN)
- [x] `npm test` passes 204/204 tests across 24 files
- [x] `npx tsc --noEmit` reports no errors
