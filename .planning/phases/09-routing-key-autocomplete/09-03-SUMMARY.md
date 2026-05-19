---
plan: 09-03
phase: 09-routing-key-autocomplete
status: complete
completed: 2026-05-19
key-files:
  created: []
  modified:
    - src/components/publish/PublishBar.tsx
    - src/components/publish/__tests__/PublishBar.test.tsx
---

## Summary

Plan 09-03 wired the `RoutingKeyCombobox` component into `PublishBar`, completing the routing key autocomplete feature. Exchange type badges appear in the dropdown, a stale-request–safe bindings fetch drives the combobox, and hint text guides users when an ineligible exchange (fanout/headers) is selected.

## Tasks Completed

### Task 1: Integrate routing key autocomplete into PublishBar

**Imports added:** `fetchBindings` from `@/lib/ipc`, `RoutingKeyCombobox` from the component built in plan 09-02.

**New state variables:** `bindingKeys: string[]`, `isLoadingBindings: boolean`, `useCombobox: boolean`.

**Derived eligibility variables (computed from store + state):**
- `selectedExchangeObj` — finds the `ExchangeSummary` for the selected exchange name
- `selectedExchangeType` — exchange type string ("direct" | "fanout" | "topic" | "headers")
- `isHintExchange` — true for fanout/headers (routing key is irrelevant)
- `isEligibleForCombobox` — true when `!isHintExchange && managementStatus === "live" && selectedExchange` is set

**Bindings useEffect** — fires on `[activeProfileName, selectedExchange, isEligibleForCombobox]`:
- Guards against ineligible state (clears combobox, returns early)
- Sets `cancelled = true` in cleanup (stale-request guard for rapid exchange switching)
- On success: updates `bindingKeys`, clears loading
- On any error: D-10 silent fallback — reverts to plain Input, does NOT call `setManagementAuthError`

**Exchange dropdown** — `SelectItem` now renders exchange name + `[type]` badge (D-05).

**Routing key section** — replaced plain `<Input>` with conditional render:
- `isEligibleForCombobox && useCombobox` → `RoutingKeyCombobox` (with loading state D-04)
- Otherwise → plain `<Input>` (D-03 / D-10 fallback)
- `isHintExchange` → hint text below input (D-06):
  - fanout: "Routing key is ignored for fanout exchanges."
  - headers: "Headers exchanges route by message headers, not routing key."

`npx tsc --noEmit` → no errors.

### Task 2: Update PublishBar tests for Phase 9

Added `vi.mock("../RoutingKeyCombobox")` — renders a simple `<input aria-label="Routing key combobox">` stub to avoid cmdk/Radix portal issues in integration tests.

**7 new Phase 9 tests** in `describe("Phase 9 — Routing Key Autocomplete")`:
1. `fetch_bindings` called when direct exchange selected ✓
2. `fetch_bindings` NOT called for fanout exchange ✓
3. `fetch_bindings` NOT called for headers exchange ✓
4. Hint text for fanout exchange (D-06) ✓
5. Hint text for headers exchange (D-06) ✓
6. `RoutingKeyCombobox` renders when bindings fetch succeeds ✓
7. Plain Input renders on `fetch_bindings` rejection (D-10 silent fallback) ✓

All 9 pre-existing PublishBar tests continue to pass. Total: 197/197 tests pass.

## Deviations

None. Plan executed exactly as specified.

## Self-Check: PASSED

- `grep -c 'RoutingKeyCombobox' src/components/publish/PublishBar.tsx` = 2 ✓ (import + render)
- `grep -c 'fetchBindings' src/components/publish/PublishBar.tsx` = 2 ✓ (import + call)
- `grep -c 'let cancelled = false' src/components/publish/PublishBar.tsx` = 1 ✓
- `grep -c 'return () => {' src/components/publish/PublishBar.tsx` ≥ 1 ✓
- `grep -c 'Routing key is ignored for fanout exchanges\.' src/components/publish/PublishBar.tsx` = 1 ✓
- `grep -c 'Headers exchanges route by message headers, not routing key\.' src/components/publish/PublishBar.tsx` = 1 ✓
- `grep -c 'isEligibleForCombobox' src/components/publish/PublishBar.tsx` = 3 ✓
- `grep -c 'ex\.exchange_type' src/components/publish/PublishBar.tsx` = 1 ✓
- `npm test -- --run` → 197/197 pass ✓
- `npx tsc --noEmit` → no errors ✓
