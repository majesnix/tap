# S05: Schema Explorer Tree — UAT

**Milestone:** M001
**Written:** 2026-05-25T21:34:16.371Z

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: S05 is a frontend tree component with deterministic rendering and pure logic for recursion/depth guards. The 13-test Vitest suite exercises every must-have including recursive-type safety, depth cap, enum expansion, field badges, oneof branches, and click-to-select. No external services, no protocol-level behavior, no operational concerns — the test suite is the proof.

## Preconditions

- Worktree at HEAD of `milestone/M001` branch with all T01–T03 changes applied.
- `pnpm install` has been run; node_modules present.
- `src-tauri/` has been built at least once (so cargo dependencies are resolved if running cargo build).

## Smoke Test

Run `pnpm vitest run src/components/sidebar/__tests__/SchemaExplorer.test.tsx` from the worktree root. Expect 13/13 tests green in under 2s.

## Test Cases

### 1. SchemaExplorer renders all messages and standalone enums as collapsible tree nodes

1. Open the app, load a `.proto` file that defines at least one message and one top-level enum.
2. Open the sidebar; locate the SchemaExplorer section between the message selector and ConnectionSection.
3. **Expected:** Every message in the schema appears as a collapsible row showing the message name and a field-count badge. Every top-level enum appears as a collapsible row alongside.

### 2. Expanding a message shows its fields with type badges and repeated/map/oneof indicators

1. Click the chevron next to a message that has fields including a repeated field, a map<string, X> field, and an `oneof` group.
2. **Expected:** Fields render indented with a type badge (e.g. `string`, `int32`, `MessageName`, `EnumName`). Repeated fields show a `[]` or "repeated" indicator. Map fields show a `map<K,V>` indicator. Oneof branches are visually grouped under the oneof name.

### 3. Expanding a standalone enum shows name=number value pairs

1. Click the chevron next to a top-level enum row.
2. **Expected:** Each enum value renders as `NAME = number`.

### 4. Clicking a message name calls setSelectedType

1. Click on a message-name row in the tree.
2. **Expected:** The form panel switches to that message type (useProtoStore.setSelectedType was called). The selected message indicator in the form updates.

### 5. Recursive message types render safely with "(recursive)" label

1. Load a `.proto` file containing a recursive message (e.g. `message Node { Node parent = 1; }`).
2. Expand the message, then expand the recursive child field.
3. **Expected:** The recursive reference renders with a "(recursive)" label and does not re-expand into infinite children. The UI does not freeze.

### 6. Depth cap at 5 prevents over-deep expansion

1. Load a `.proto` with a 7-level Level0 → Level6 chain of nested messages.
2. Expand every level.
3. **Expected:** Expansion halts past depth 5 — deeper levels are either collapsed by default or render a "(max depth reached)" stop. The page remains responsive.

## Edge Cases

### No proto loaded / null schema

1. Launch the app without opening a `.proto` file.
2. **Expected:** SchemaExplorer renders an empty/placeholder state without crashing. No "undefined" or stack trace appears.

### Proto with zero top-level enums

1. Load a proto that only declares messages, no top-level enums.
2. **Expected:** The enum section is absent or empty; the message tree renders normally.

### Field-count badge accuracy

1. Inspect a message with N fields (including oneof branches).
2. **Expected:** The badge shows the correct total count.

## Failure Signals

- Test file `src/components/sidebar/__tests__/SchemaExplorer.test.tsx` reports any failing test.
- TypeScript compile errors after touching SchemaExplorer.tsx, Sidebar.tsx, or types.ts.
- Loading a recursive proto and observing a frozen UI, browser stack overflow, or React maximum-update-depth error.
- SchemaExplorer rendering "undefined" for field types or missing enum values.
- Clicking a message name does not change the selected message type in the form panel.

## Not Proven By This UAT

- This UAT does not prove visual polish (exact paddings, hover states, icon choices) — only structural correctness.
- It does not prove performance at extreme schema sizes (hundreds of messages); the depth cap is the only formal bound.
- It does not prove the Rust extractor handles malformed `.proto` files — T01's cargo build only proves the type contract compiles.
- No live-runtime UAT was executed; the artifact-driven Vitest suite is the proof surface.

## Notes for Tester

- Tailwind class names in SchemaExplorer indentation are computed via inline `paddingLeft` style; do not refactor to dynamic Tailwind classes — they will be purged.
- SchemaExplorer reads schema directly from `useProtoStore` rather than via props — confirm by inspecting the component file, not by chasing prop chains in Sidebar.tsx.
- If the recursive proto test feels unresponsive in the browser despite tests passing, capture a profile and re-check MAX_DEPTH and the visited-set guard.
