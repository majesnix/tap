---
plan: 09-02
phase: 09-routing-key-autocomplete
status: complete
completed: 2026-05-19
key-files:
  created:
    - src/components/ui/command.tsx
    - src/components/ui/input-group.tsx
    - src/components/publish/RoutingKeyCombobox.tsx
    - src/components/publish/__tests__/RoutingKeyCombobox.test.tsx
  modified:
    - src/lib/types.ts
    - src/lib/ipc.ts
    - src/stores/useConnectionStore.ts
    - src/components/publish/PublishBar.tsx
    - src/components/ui/dialog.tsx
---

## Summary

Plan 09-02 installed the shadcn Command component, propagated the `ExchangeSummary` type change through the TypeScript layer, and delivered the `RoutingKeyCombobox` widget with full unit test coverage.

## Tasks Completed

### Task 1: Install Command component + update TypeScript contracts

- **`npx shadcn@latest add command`** — generated `src/components/ui/command.tsx` (+ `input-group.tsx`, `dialog.tsx` update)
- **`src/lib/types.ts`** — added `ExchangeSummary { name: string; exchange_type: string }` interface
- **`src/lib/ipc.ts`** — updated `fetchExchanges` return type from `string[]` → `ExchangeSummary[]`; added new `fetchBindings(profileName, exchangeName)` wrapper
- **`src/stores/useConnectionStore.ts`** — typed `exchanges` field as `ExchangeSummary[]`, updated setter signature
- **`src/components/publish/PublishBar.tsx`** — minimal fix: changed exchange `SelectItem` map to use `exchange.name` (required for TypeScript to compile; Plan 09-03 does the full wiring)
- `npx tsc --noEmit` exits 0

### Task 2: Build RoutingKeyCombobox component with tests

TDD cycle followed: tests written first (RED — import error), component implemented (GREEN — 10/10 pass).

**`RoutingKeyCombobox.tsx`** implements:
- D-01: Combobox replaces plain Input when binding keys are available
- D-02: `CommandInput` is controlled (`value` + `onValueChange`) — free-type always permitted
- D-04: `Loader2` spinner in trigger when `isLoading=true`
- D-07: `isWildcard` helper detects `*` or `#` in key string
- D-08: Amber "pattern" badge for wildcard keys
- D-09: `onSelect` copies exact key string as-is (wildcard patterns included)

**Unit tests (10/10 pass):** placeholder display, loading spinner, suggestion rendering, onChange on click, onChange on type, controlled input value, amber badge for `*` keys, amber badge for `#` keys, no badge for exact keys, wildcard selection copies as-is.

## Deviations

None. Plan executed exactly as specified.

## Self-Check: PASSED

- `ls src/components/ui/command.tsx` ✓ (file exists)
- `grep -c 'CommandInput' src/components/ui/command.tsx` = 2 ✓
- `grep -c 'export interface ExchangeSummary' src/lib/types.ts` = 1 ✓
- `grep -c 'Promise<ExchangeSummary\[\]>' src/lib/ipc.ts` = 1 ✓
- `grep -c 'fetchBindings' src/lib/ipc.ts` = 1 ✓
- `grep -c 'ExchangeSummary\[\]' src/stores/useConnectionStore.ts` = 3 ✓
- `npm test -- --run RoutingKeyCombobox.test.tsx` → 10/10 pass ✓
- `npx tsc --noEmit` → no errors ✓
