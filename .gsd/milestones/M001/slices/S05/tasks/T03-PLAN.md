---
estimated_steps: 17
estimated_files: 1
skills_used: []
---

# T03: Added 13 SchemaExplorer tests covering tree rendering, field badges, repeated/map indicators, enum expansion, recursive guard, MAX_DEPTH enforcement, click-to-select, and oneof branches

**Why:** R025 and R026 need test coverage proving the tree renders correctly and handles recursive types safely. Tests also verify the click-to-select integration with useProtoStore.

**Do:**
1. Create `src/components/sidebar/__tests__/SchemaExplorer.test.tsx` with these test cases:
   - Renders message names from schema (flat list, no expansion)
   - Expands a message node to show its fields with type badges and field numbers
   - Shows repeated indicator on repeated fields
   - Shows map indicator on map fields
   - Renders standalone enums section with enum names
   - Expands an enum to show name=number value pairs
   - Handles recursive message type with visited-set guard — shows '(recursive)' label, does not infinite-loop
   - Enforces MAX_DEPTH=5 — deeply nested non-recursive types stop at depth 5
   - Click on message name calls setSelectedType with full_name
   - Renders empty state gracefully when schema has no messages
   - Handles oneof fields showing branches
2. Mock `useProtoStore` with schema data containing messages, nested messages, enums, recursive types, oneof, map, and repeated fields.
3. Use vitest + @testing-library/react. Follow AAA pattern.

**Done when:** All tests pass via `pnpm vitest run`. Tests cover R025 (tree display) and R026 (recursive safety).

## Inputs

- `src/components/sidebar/SchemaExplorer.tsx`
- `src/lib/types.ts`

## Expected Output

- `src/components/sidebar/__tests__/SchemaExplorer.test.tsx`

## Verification

pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx
