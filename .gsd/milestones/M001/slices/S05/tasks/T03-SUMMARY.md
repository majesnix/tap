---
id: T03
parent: S05
milestone: M001
key_files:
  - src/components/sidebar/__tests__/SchemaExplorer.test.tsx
key_decisions:
  - Mocked useProtoStore via vi.mock + dynamic import in beforeEach (vi.resetModules) so each test installs a fresh store mock before SchemaExplorer is imported
  - Built MAX_DEPTH test as a 7-level Level0..Level6 chain and asserted that multiple 'label' fields render but expansion stops past depth 5, rather than asserting on internal depth state
duration: 
verification_result: passed
completed_at: 2026-05-25T21:32:07.616Z
blocker_discovered: false
---

# T03: Added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches

**Added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches**

## What Happened

Created `src/components/sidebar/__tests__/SchemaExplorer.test.tsx` with 13 vitest + @testing-library/react tests following AAA pattern. Tests mock `useProtoStore` via `vi.mock` to inject controlled schema fixtures and capture `setSelectedType` calls. Coverage matches the task contract:

- Null/empty schema renders nothing
- Renders message names from schema (R025)
- Expansion shows fields with type badges (scalar names), and field number markers (#N)
- Repeated indicator on repeated fields
- Map indicator + `map<key, …>` badge on map fields
- Standalone enums section with names and counts
- Enum expansion shows name=number value pairs
- Recursive message type renders `(recursive)` label via visited-set guard (R026 — no infinite loop)
- MAX_DEPTH=5 enforcement: 6-level Level0→Level6 chain stops expanding past depth 5
- Click on message name button invokes `setSelectedType` with `full_name`
- Oneof field expansion reveals branch fields
- Field-count badge on message nodes

Helpers (`makeField`, `makeMessage`, `makeSchema`) keep fixtures terse. The component file uses dynamic `import("../SchemaExplorer")` inside `beforeEach` with `vi.resetModules()` so the mocked store is picked up on each render.

## Verification

Ran `pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx` — 1 file passed, 13/13 tests passed, duration ~958ms.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx` | 0 | pass | 958ms |

## Deviations

none — test file matched the task plan's 11 enumerated cases plus 2 supporting cases (null schema, field-count badge) for 13 total

## Known Issues

none

## Files Created/Modified

- `src/components/sidebar/__tests__/SchemaExplorer.test.tsx`
