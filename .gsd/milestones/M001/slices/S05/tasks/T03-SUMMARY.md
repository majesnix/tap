---
id: T03
parent: S05
milestone: M001
key_files:
  - src/components/sidebar/__tests__/SchemaExplorer.test.tsx
key_decisions:
  - Used mockReturnValue instead of selector-based mock since SchemaExplorer uses Zustand destructuring pattern (not selector)
  - All test fixtures are inline makeField/makeMessage/makeSchema helpers — no external fixture files needed
duration: 
verification_result: passed
completed_at: 2026-05-25T21:24:11.372Z
blocker_discovered: false
---

# T03: Added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches

**Added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches**

## What Happened

Created `src/components/sidebar/__tests__/SchemaExplorer.test.tsx` with 13 test cases using vitest + @testing-library/react + userEvent. Tests cover: empty/null schema renders nothing (2 tests), message name rendering, field expansion with type badges and field numbers, repeated indicator, map indicator with key type badge, standalone enums section, enum value pair expansion, recursive message self-reference with '(recursive)' label, MAX_DEPTH=5 enforcement on deeply nested non-recursive types, click-to-select calling setSelectedType with full_name, oneof field branch rendering, and field count badge on message nodes. Mock pattern uses `vi.mocked(useProtoStore).mockReturnValue(...)` since SchemaExplorer uses Zustand's destructuring API (not selector-based). All test fixtures are inline — no external files needed.

## Verification

Ran SchemaExplorer test file — all 13 tests passed. Ran full test suite — all 629 tests across 49 files passed with no regressions.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx` | 0 | pass | 887ms |
| 2 | `pnpm vitest run` | 0 | pass | 6500ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/components/sidebar/__tests__/SchemaExplorer.test.tsx`
